const UPLOAD_VARIANTS = ['original', 'linux']
const DEFAULT_ORIGINAL_UPLOAD_SCRIPT = `const onUpload = async (config, profile, target) => {
  return config
}`
const DEFAULT_LINUX_UPLOAD_SCRIPT = `const onUpload = async (config, profile, target) => {
  const inbounds = Array.isArray(config.inbounds) ? config.inbounds : []
  for (const inbound of inbounds) {
    if (inbound && inbound.type === 'tun') {
      inbound.auto_route = true
      inbound.auto_redirect = true
    }
  }
  return config
}`

const onReady = async () => {
  await refreshProfileOptions()
}

const onConfigure = async () => {
  await refreshProfileOptions()
}

const onRun = async () => {
  return updateGist()
}

const onTask = async () => {
  return updateGist()
}

async function refreshProfileOptions() {
  try {
    const profiles = Plugins.useProfilesStore().profiles
    const pluginsStore = Plugins.usePluginsStore()
    const plugin = pluginsStore.getPluginById(Plugin.id)
    if (!plugin || !Array.isArray(plugin.configuration)) return

    const profileConfiguration = plugin.configuration.find((configuration) => configuration.key === 'ProfileIds')
    if (!profileConfiguration) return

    const options = (Array.isArray(profiles) ? profiles : []).map((profile) => {
      const label = String(profile.name || profile.id)
        .replace(/,/g, '，')
        .replace(/\r?\n/g, ' ')
      return `${label},${profile.id}`
    })
    if (JSON.stringify(profileConfiguration.options) === JSON.stringify(options)) return

    const nextPlugin = Plugins.deepClone(plugin)
    const nextProfileConfiguration = nextPlugin.configuration.find((configuration) => configuration.key === 'ProfileIds')
    nextProfileConfiguration.options = options
    await pluginsStore.updatePluginState(Plugin.id, nextPlugin)
  } catch (error) {
    console.warn(`[${Plugin.name}] 更新配置候选项失败：${getErrorMessage(error)}`)
  }
}

const updateGist = async () => {
  if (!Plugin.GistId) throw '未配置GIST ID'
  if (!Plugin.Authorization) throw '未配置TOKEN'

  const store = Plugins.useProfilesStore()
  const allProfiles = Array.isArray(store.profiles) ? store.profiles : []
  const profiles = getSelectedProfiles(allProfiles, Plugin.ProfileIds)
  const variants = getUploadVariants()
  if (profiles.length === 0) throw '没有可同步的配置'

  assertUniqueFileNames(profiles, variants)

  const fileCount = profiles.length * variants.length
  const { id: messageId } = Plugins.message.info(`正在生成配置 [ 0/${fileCount} ]`, 60 * 60 * 1000)
  try {
    const files = {}
    let generatedCount = 0
    for (const sourceProfile of profiles) {
      const profile = Plugins.deepClone(sourceProfile)
      await transformLocalRuleset(profile)
      const baseConfig = await Plugins.generateConfig(profile)

      for (const variant of variants) {
        let config = Plugins.deepClone(baseConfig)
        config = await applyUploadScript(config, profile, variant, getUploadScript(variant))

        files[getProfileFileName(profile, variant)] = {
          content: JSON.stringify(config, null, 4)
        }
        generatedCount++
        Plugins.message.update(messageId, `正在生成配置 [ ${generatedCount}/${fileCount} ]`)
      }
    }

    const targetFileNames = Object.keys(files)

    Plugins.message.update(messageId, `正在上传 [ ${targetFileNames.length} 个文件 ]`)
    await patchGist(Plugin.GistId, files)

    const result = `同步成功：${targetFileNames.join('、')}`
    Plugins.message.update(messageId, result, 'success')
    return result
  } catch (error) {
    const message = getErrorMessage(error)
    Plugins.message.update(messageId, `同步失败：${message}`, 'error')
    throw error
  } finally {
    await Plugins.sleep(1500)
    Plugins.message.destroy(messageId)
  }
}

function getSelectedProfiles(profiles, configuredIds) {
  const selectedIds = normalizeStringArray(configuredIds)
  if (selectedIds.length === 0) return profiles

  const profileMap = new Map(profiles.map((profile) => [String(profile.id), profile]))
  const missingIds = selectedIds.filter((id) => !profileMap.has(id))
  if (missingIds.length > 0) {
    throw `已选择的配置不存在，请重新保存插件设置：${missingIds.join(', ')}`
  }

  return selectedIds.map((id) => profileMap.get(id))
}

function getUploadVariants() {
  const hasVariantSwitches = typeof Plugin.UploadOriginal === 'boolean' || typeof Plugin.UploadLinux === 'boolean'
  const variants = hasVariantSwitches
    ? [...(Plugin.UploadOriginal === true ? ['original'] : []), ...(Plugin.UploadLinux === true ? ['linux'] : [])]
    : normalizeStringArray(Plugin.UploadVariants)
  if (variants.length === 0) throw '至少选择一个上传版本'

  const unknown = variants.filter((variant) => !UPLOAD_VARIANTS.includes(variant))
  if (unknown.length > 0) throw `未知的上传版本：${unknown.join(', ')}`
  return variants
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return [...new Set(value.map(String).filter(Boolean))]
  if (value === undefined || value === null || value === '') return []
  return [String(value)]
}

function assertUniqueFileNames(profiles, variants) {
  const fileNames = profiles.flatMap((profile) => variants.map((variant) => getProfileFileName(profile, variant)))
  const duplicated = fileNames.find((fileName, index) => fileNames.indexOf(fileName) !== index)
  if (duplicated) throw `配置名称重复，无法同步：${duplicated}`
}

function getProfileFileName(profile, variant) {
  const suffix = variant === 'linux' ? '_linux' : ''
  return `${profile.name}${suffix}.json`
}

function getUploadScript(target) {
  const configuredScript = target === 'linux' ? Plugin.LinuxUploadScript : Plugin.OriginalUploadScript
  if (typeof configuredScript === 'string') return configuredScript

  // 兼容旧版共用的上传前脚本；新设置保存后改用两个独立脚本。
  if (typeof Plugin.UploadScript === 'string' && Plugin.UploadScript.trim() !== '') {
    return Plugin.UploadScript
  }

  return target === 'linux' ? DEFAULT_LINUX_UPLOAD_SCRIPT : DEFAULT_ORIGINAL_UPLOAD_SCRIPT
}

async function applyUploadScript(config, profile, target, script) {
  if (typeof script !== 'string' || script.trim() === '') return config

  const AsyncFunction =
    globalThis.window && globalThis.window.AsyncFunction ? globalThis.window.AsyncFunction : Object.getPrototypeOf(async function () {}).constructor
  const fn = new AsyncFunction('config', 'profile', 'target', `${script}; return await onUpload(config, profile, target)`)

  let result
  try {
    result = await fn(config, profile, target)
  } catch (error) {
    throw `上传前脚本执行失败 [${target}]：${getErrorMessage(error)}`
  }

  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw `上传前脚本必须返回配置对象 [${target}]`
  }
  return result
}

async function transformLocalRuleset(profile) {
  const rulesets = profile && profile.route && Array.isArray(profile.route.rule_set) ? profile.route.rule_set : []
  const rulesetsStore = Plugins.useRulesetsStore()
  for (const ruleset of rulesets) {
    if (ruleset.type !== 'local') continue

    const localRuleset = rulesetsStore.getRulesetById(ruleset.path)
    if (!localRuleset) continue

    if (localRuleset.type === 'Http') {
      ruleset.type = 'remote'
      ruleset.url = localRuleset.url
      ruleset.path = ''
    } else if (['File', 'Manual'].includes(localRuleset.type) && localRuleset.format === 'source') {
      const source = JSON.parse(await Plugins.ReadFile(localRuleset.path))
      ruleset.type = 'inline'
      ruleset.rules = JSON.stringify(source.rules)
      ruleset.url = ''
      ruleset.path = ''
    }
  }
}

async function patchGist(gistId, files) {
  const { body } = await Plugins.HttpPatch(`https://api.github.com/gists/${gistId}`, getHeaders(true), { files })
  throwForGitHubError(body)
  return body
}

function getHeaders(hasContent = false) {
  const headers = {
    'User-Agent': 'GUI.for.Cores',
    'X-GitHub-Api-Version': '2022-11-28',
    Accept: 'application/vnd.github+json',
    Connection: 'close',
    Authorization: 'Bearer ' + Plugin.Authorization
  }
  if (hasContent) headers['Content-Type'] = 'application/json'
  return headers
}

function throwForGitHubError(body) {
  if (body && body.message) throw body.message
}

function getErrorMessage(error) {
  return error && error.message ? error.message : String(error)
}
