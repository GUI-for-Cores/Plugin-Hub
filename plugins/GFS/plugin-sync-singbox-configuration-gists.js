const UPLOAD_VARIANTS = ['windows', 'linux', 'macos']
const UPLOAD_KEYS = { windows: 'Windows', linux: 'Linux', macos: 'MacOS' }
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
const DEFAULT_DESKTOP_UPLOAD_SCRIPT = `const onUpload = async (config, profile, target) => {
  const inbounds = Array.isArray(config.inbounds) ? config.inbounds : []
  for (const inbound of inbounds) {
    if (inbound && inbound.type === 'tun') {
      inbound.auto_route = true
      // Windows / macOS 不支持 Linux 的 auto_redirect；由系统自动分配 TUN 名称。
      delete inbound.interface_name
      for (const key of Object.keys(inbound)) {
        if (key === 'auto_redirect' || key.startsWith('auto_redirect_')) delete inbound[key]
      }
    }
  }
  return config
}`

let unsubscribeProfiles
let refreshQueue = Promise.resolve()

const onReady = async () => {
  await initializeConfiguration()
}

const onEnabled = async () => {
  await initializeConfiguration()
}

const onInstall = async () => {
  await initializeConfiguration()
}

const onDisabled = async () => {
  await stopProfileWatcher()
}

const onDispose = async () => {
  await stopProfileWatcher()
}

const onConfigure = async () => {
  await initializeConfiguration()
}

const onRun = async () => {
  return updateGist()
}

const onTask = async () => {
  return updateGist()
}

async function initializeConfiguration() {
  if (!unsubscribeProfiles) {
    unsubscribeProfiles = Plugins.useProfilesStore().$subscribe(() => refreshProfileOptions(), { detached: true })
  }
  await refreshProfileOptions()
}

async function stopProfileWatcher() {
  if (unsubscribeProfiles) unsubscribeProfiles()
  unsubscribeProfiles = undefined
  await refreshQueue
}

function refreshProfileOptions() {
  // 串行读取最新状态，避免快速新增/删除时较早的保存覆盖较新的候选项。
  refreshQueue = refreshQueue
    .then(async () => {
      const profiles = Plugins.useProfilesStore().profiles
      const pluginsStore = Plugins.usePluginsStore()
      const plugin = pluginsStore.getPluginById(Plugin.id)
      if (!plugin || !Array.isArray(plugin.configuration)) return

      let changed = ensureUploadConfiguration(plugin)
      const profileConfiguration = plugin.configuration.find((configuration) => configuration.key === 'ProfileIds')

      const options = (Array.isArray(profiles) ? profiles : []).map((profile) => {
        const label = String(profile.name || profile.id)
          .replace(/,/g, '，')
          .replace(/\r?\n/g, ' ')
        return `${label},${profile.id}`
      })
      if (profileConfiguration && JSON.stringify(profileConfiguration.options) !== JSON.stringify(options)) {
        // 保留配置对象的引用，让已打开的设置弹窗也能收到更新。
        profileConfiguration.options = options
        changed = true
      }
      if (changed) await pluginsStore.updatePluginState(Plugin.id, plugin)
    })
    .catch((error) => {
      console.warn(`[${Plugin.name}] 更新配置候选项失败：${getErrorMessage(error)}`)
    })
  return refreshQueue
}

function getUploadSettings() {
  const plugin = Plugins.usePluginsStore().getPluginById(Plugin.id)
  const defaults = Object.fromEntries(((plugin && plugin.configuration) || []).map(({ key, value }) => [key, value]))
  // 直接读 store，避免插件元数据的短暂缓存使刚保存的设置延迟生效。
  return Object.assign(defaults, Plugins.useAppSettingsStore().app.pluginSettings[Plugin.id])
}

function ensureUploadConfiguration(plugin) {
  let changed = false
  const labels = { windows: 'Windows', linux: 'Linux', macos: 'macOS' }
  for (const [targetIndex, target] of UPLOAD_VARIANTS.entries()) {
    const key = UPLOAD_KEYS[target]
    const defaults = [
      {
        id: `ID_upload_${target}`,
        title: `上传 ${labels[target]} 配置`,
        description: `开启后生成并上传 名称_${target}.json；可与其他版本同时勾选`,
        key: `Upload${key}`,
        component: 'Switch',
        value: false,
        options: []
      },
      {
        id: `ID_${target}_upload_script`,
        title: `${labels[target]}配置上传前脚本`,
        description: `仅在对应上传开关开启时执行；target 为 ${target}，onUpload(config, profile, target) 必须返回配置对象，可自行修改。`,
        key: `${key}UploadScript`,
        component: 'CodeEditor',
        value: getUploadScript(target),
        options: []
      }
    ]
    for (const configuration of defaults) {
      const existing = plugin.configuration.find((item) => item.key === configuration.key)
      if (!existing) {
        const nextKeys = UPLOAD_VARIANTS.slice(targetIndex + 1).map((variant) => `Upload${UPLOAD_KEYS[variant]}`)
        const nextIndex =
          configuration.component === 'CodeEditor'
            ? plugin.configuration.findIndex((item) => item.key === `Upload${key}`) + 1
            : plugin.configuration.findIndex((item) => nextKeys.includes(item.key))
        plugin.configuration.splice(nextIndex < 0 ? plugin.configuration.length : nextIndex, 0, configuration)
        changed = true
      } else {
        for (const field of ['title', 'description']) {
          if (existing[field] !== configuration[field]) {
            existing[field] = configuration[field]
            changed = true
          }
        }
      }
    }
  }
  return changed
}

const updateGist = async () => {
  await initializeConfiguration()
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
  const selected = selectedIds.filter((id) => profileMap.has(id)).map((id) => profileMap.get(id))
  // 已选配置全部被删除时不能按“未选择”处理，否则会意外上传全部配置。
  if (selected.length === 0) throw '已选择的配置均已删除，请重新选择要同步的配置'
  return selected
}

function getUploadVariants() {
  const settings = getUploadSettings()
  const variants = UPLOAD_VARIANTS.filter((target) => settings[`Upload${UPLOAD_KEYS[target]}`] === true)
  if (variants.length === 0) throw '至少选择一个上传版本'
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
  return `${profile.name}_${variant}.json`
}

function getUploadScript(target) {
  const settings = getUploadSettings()
  const configuredScript = settings[`${UPLOAD_KEYS[target]}UploadScript`]
  if (typeof configuredScript === 'string') return configuredScript

  if (target === 'linux') return DEFAULT_LINUX_UPLOAD_SCRIPT
  return DEFAULT_DESKTOP_UPLOAD_SCRIPT
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
