window[Plugin.id] = window[Plugin.id] ?? {
  configs: Vue.ref([])
}

const BASE_PATH = `data/third/${Plugin.id}`
const CACHE_PATH = `data/.cache/${Plugin.id}`
const MANAGE_FILE_PATH = `${BASE_PATH}/${Plugin.id}.json`
const TEMP_CHECK_PATH = `${CACHE_PATH}/temp-check.json`

const getState = () => window[Plugin.id]

const readManagerConfigs = async () => {
  const content = await Plugins.ReadFile(MANAGE_FILE_PATH).catch(() => '[]')
  try {
    const list = JSON.parse(content)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

const ensureDirectories = async () => {
  if (!(await Plugins.FileExists(CACHE_PATH).catch(() => false))) {
    await Plugins.MakeDir(CACHE_PATH)
  }
  if (!(await Plugins.FileExists(BASE_PATH).catch(() => false))) {
    await Plugins.MakeDir(BASE_PATH)
  }
  if (!(await Plugins.FileExists(MANAGE_FILE_PATH).catch(() => false))) {
    await Plugins.WriteFile(MANAGE_FILE_PATH, '[]')
  }
}

const saveConfigs = async () => {
  await Plugins.WriteFile(MANAGE_FILE_PATH, JSON.stringify(getState().configs.value, null, 2))
}

const getProfileName = (profileId) => {
  return Plugins.useProfilesStore().getProfileById(profileId)?.name ?? 'Not Found'
}

const normalizePath = (path) =>
  String(path || '')
    .trim()
    .replace(/\[(\d+)\]/g, '.$1')

const getAppendPaths = () => {
  const paths = Plugin.appendPaths
  if (!Array.isArray(paths)) {
    return []
  }
  return paths.map(normalizePath).filter(Boolean)
}

const isAppendArrayPath = (path, ctx) => {
  const currentPath = normalizePath(path)
  const appendPaths = ctx?.appendPaths || getAppendPaths()
  return appendPaths.includes(currentPath)
}

const setAppendPaths = (paths) => {
  const nextPaths = Array.from(new Set((paths || []).map(normalizePath).filter(Boolean)))
  const appSettingsStore = Plugins.useAppSettingsStore()
  appSettingsStore.app.pluginSettings[Plugin.id] ||= {}
  appSettingsStore.app.pluginSettings[Plugin.id].appendPaths = nextPaths
}

const createMergeContext = () => ({
  appendPaths: getAppendPaths(),
  hitAppendPaths: new Set(),
  warnings: [],
  warnedPaths: new Set()
})

const warnMergePath = (ctx, path, reason) => {
  if (!ctx || !path || ctx.warnedPaths.has(path)) {
    return
  }
  ctx.warnedPaths.add(path)
  ctx.warnings.push(`[${path}] ${reason}`)
}

const cloneArrayValue = (value) =>
  value.map((item) => {
    if (Array.isArray(item)) return cloneArrayValue(item)
    if (item && typeof item === 'object') return deepMerge({}, item, '', undefined)
    return item
  })

const deepMerge = (target, source, currentPath = '', ctx) => {
  if (Array.isArray(source)) {
    if (isAppendArrayPath(currentPath, ctx)) {
      ctx?.hitAppendPaths.add(normalizePath(currentPath))
    }
    if (isAppendArrayPath(currentPath, ctx) && Array.isArray(target)) {
      return cloneArrayValue(target).concat(cloneArrayValue(source))
    }
    if (isAppendArrayPath(currentPath, ctx) && !Array.isArray(target)) {
      warnMergePath(ctx, currentPath, '目标值不是数组，已回退为覆盖模式')
    }
    return cloneArrayValue(source)
  }

  if (!source || typeof source !== 'object') {
    return source
  }

  const output = target && typeof target === 'object' && !Array.isArray(target) ? { ...target } : {}

  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = output[key]
    const nextPath = currentPath ? `${currentPath}.${key}` : key

    if (isAppendArrayPath(nextPath, ctx)) {
      ctx?.hitAppendPaths.add(normalizePath(nextPath))
      if (!Array.isArray(sourceValue)) {
        warnMergePath(ctx, nextPath, 'override 值不是数组，已回退为覆盖模式')
      }
    }

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      output[key] = deepMerge(targetValue, sourceValue, nextPath, ctx)
    } else if (Array.isArray(sourceValue)) {
      output[key] = deepMerge(targetValue, sourceValue, nextPath, ctx)
    } else {
      output[key] = sourceValue
    }
  }

  return output
}

const parseJSONObject = (content, label = 'JSON') => {
  let data
  try {
    data = JSON.parse(content)
  } catch (error) {
    throw `${label} 解析失败：${error instanceof Error ? error.message : String(error)}`
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw `${label} 必须是 JSON 对象`
  }

  return data
}

const validateJSONText = (content, label = 'JSON') => {
  parseJSONObject(content, label)
  return true
}

const validateLocalConfigPath = async (path, label = '覆盖配置') => {
  if (!(await Plugins.FileExists(path).catch(() => false))) {
    throw `${label} 文件不存在：${path}`
  }

  const content = await Plugins.ReadFile(path)
  validateJSONText(content, label)
  return content
}

const getCurrentCorePath = async () => {
  const isAlpha = Plugins.useAppSettingsStore().app.kernel.branch === 'alpha'
  const coreName = await Plugins.getKernelFileName(isAlpha)
  return Plugins.AbsolutePath(`data/sing-box/${coreName}`)
}

const validateMergedConfig = async (config) => {
  try {
    const corePath = await getCurrentCorePath()
    const tempPath = await Plugins.AbsolutePath(TEMP_CHECK_PATH)
    await Plugins.WriteFile(TEMP_CHECK_PATH, JSON.stringify(config, null, 2))
    await Plugins.Exec(corePath, ['check', '-c', tempPath])
  } finally {
    await Plugins.RemoveFile(TEMP_CHECK_PATH).catch(() => {
      /* noop */
    })
  }
}

const fetchRemoteFile = async (url) => {
  const { body } = await Plugins.Requests({
    method: 'GET',
    url,
    headers: { 'User-Agent': 'sing-box' },
    autoTransformBody: false
  })
  return body
}

const readOverrideContent = async (cfg) => {
  if (cfg.type === 'local') {
    return Plugins.ReadFile(cfg.configPath)
  }

  if (cfg.cache?.enable) {
    if (cfg.cache.path && (await Plugins.FileExists(cfg.cache.path).catch(() => false))) {
      return Plugins.ReadFile(cfg.cache.path)
    }

    const content = await fetchRemoteFile(cfg.configUrl)
    const cachePath = cfg.cache.path || `${CACHE_PATH}/${cfg.id}.json`
    await Plugins.WriteFile(cachePath, content)
    cfg.cache.path = cachePath
    cfg.cache.lastTime = Date.now()
    await saveConfigs()
    return content
  }

  return fetchRemoteFile(cfg.configUrl)
}

const ensureProfileUnbound = (profileId, currentId) => {
  const duplicated = getState().configs.value.find((item) => item.profileId === profileId && item.id !== currentId)
  if (duplicated) {
    throw `配置 ${getProfileName(profileId)} 已存在覆盖规则`
  }
}

const addProfilesHeaderAction = () => {
  const appStore = Plugins.useAppStore()
  appStore.removeCustomActions('profiles_header', Plugin.id)
  appStore.addCustomActions('profiles_header', {
    id: Plugin.id,
    component: 'Button',
    componentProps: {
      type: 'link',
      onClick: onRun
    },
    componentSlots: {
      default: '管理配置覆盖'
    }
  })
}

const onRun = async () => {
  const manager = new ConfigOverrideManager()
  await manager.init()
  openMainUI(manager)
}

const onReady = async () => {
  await ensureDirectories()
  getState().configs.value = await readManagerConfigs()
  addProfilesHeaderAction()
}

const onBeforeCoreStart = async (config, profile) => {
  const configs = getState().configs.value ?? []
  const cfg = configs.find((item) => item.profileId === profile.id)

  if (!cfg) {
    return config
  }

  let content
  try {
    content = await readOverrideContent(cfg)
  } catch (error) {
    throw `读取覆盖配置失败：${error instanceof Error ? error.message : String(error)}`
  }

  const overrideObject = parseJSONObject(content, '覆盖配置')
  const mergeContext = createMergeContext()
  const mergedConfig = deepMerge(config, overrideObject, '', mergeContext)

  const unmatchedPaths = mergeContext.appendPaths.filter((path) => !mergeContext.hitAppendPaths.has(normalizePath(path)))

  unmatchedPaths.forEach((path) => {
    warnMergePath(mergeContext, path, '未命中任何 override 路径，已忽略该数组追加规则')
  })

  if (mergeContext.warnings.length > 0) {
    console.warn(`[${Plugin.id}] 数组追加路径警告:\n- ${mergeContext.warnings.join('\n- ')}`)
    Plugins.message.warn('部分数组追加路径未按追加模式生效，详情请查看控制台')
  }

  try {
    await validateMergedConfig(mergedConfig)
  } catch (error) {
    throw `覆盖后的 sing-box 配置校验失败：${error instanceof Error ? error.message : String(error)}`
  }

  return mergedConfig
}

const openMainUI = (manager) => {
  const { h, resolveComponent, defineComponent, computed } = Vue

  const component = defineComponent({
    template: `
    <div class="h-full w-full">
      <div
        v-if="manager.configs.value.length === 0"
        class="flex items-center justify-center h-full min-h-[200px] cursor-pointer"
        @click="openGuide"
      >
        <span class="text-16 font-bold text-gray-400 hover:text-gray-600 transition-colors">
          尚未添加任何配置覆盖规则，点击添加
        </span>
      </div>
      <div v-else class="grid grid-cols-3 gap-8 p-8 overflow-y-auto max-h-[500px]">
        <Card v-for="cfg in manager.configs.value" :key="cfg.id" :title="profileName(cfg.profileId)">
          <template #extra>
            <Button class="text-red-500 hover:text-red-700" size="small" type="text" @click.stop="remove(cfg)">
              删除
            </Button>
          </template>
          <div class="flex flex-col gap-6 min-h-[90px]">
            <div class="text-12 text-gray-500 break-all">
              {{ sourceText(cfg) }}
            </div>
            <div class="text-12 text-gray-500">
              {{ cacheText(cfg) }}
            </div>
            <div class="mt-auto pt-4 flex justify-end">
              <Button size="small" type="primary" @click.stop="edit(cfg)">
                编辑
              </Button>
            </div>
          </div>
        </Card>
        <Button class="col-span-3 mt-4" type="dashed" @click="openGuide">
          添加新覆盖规则
        </Button>
      </div>
    </div>
    `,
    setup(_, { expose }) {
      const remoteCount = computed(() => manager.configs.value.filter((item) => item.type === 'remote' && item.cache?.enable).length)

      expose({
        modalSlots: {
          toolbar: () => [
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: () => {
                  openAppendPathsModal()
                }
              },
              () => '数组追加路径'
            ),
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: async () => {
                  await Plugins.OpenDir(BASE_PATH)
                }
              },
              () => '打开插件目录'
            ),
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: async () => {
                  await Plugins.OpenDir(CACHE_PATH)
                }
              },
              () => '打开缓存目录'
            ),
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                disabled: remoteCount.value === 0,
                onClick: async () => {
                  await manager.updateCache()
                }
              },
              () => '更新缓存'
            )
          ]
        }
      })

      return {
        manager,
        openGuide: () => openGuideModal(manager),
        edit: (cfg) => openEditModal(cfg, manager),
        remove: (cfg) => manager.deleteConfig(cfg),
        profileName: getProfileName,
        sourceText: (cfg) => (cfg.type === 'local' ? `本地快照：${cfg.configPath}` : `远程链接：${cfg.configUrl}`),
        cacheText: (cfg) => {
          if (cfg.type !== 'remote') {
            return '该规则读取导入后的本地快照，不会自动跟踪原始文件变更'
          }
          if (!cfg.cache?.enable) {
            return '缓存：关闭'
          }
          return `缓存：${cfg.cache.path || '尚未生成'}`
        }
      }
    }
  })

  const modal = Plugins.modal({
    title: '配置覆盖管理',
    submit: false,
    cancelText: '关闭',
    width: '82',
    height: '80',
    afterClose: () => {
      modal.destroy()
    }
  })

  modal.setContent(component)
  modal.open()
}

const openAppendPathsModal = () => {
  const { ref, defineComponent } = Vue

  const items = ref(getAppendPaths())

  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-8 p-8">
      <div class="text-14 text-gray-600 leading-relaxed">
        命中的数组路径会使用“追加”而不是“覆盖”。示例：route.rules、dns.rules、route.rule_set。
      </div>
      <InputList v-model="items" />
    </div>
    `,
    setup() {
      return { items }
    }
  })

  const modal = Plugins.modal({
    title: '数组追加路径',
    width: '56',
    submitText: '保存',
    cancelText: '取消',
    onOk: async () => {
      setAppendPaths(items.value)
      Plugins.message.success('数组追加路径已保存')
      return true
    },
    afterClose: () => {
      modal.destroy()
    }
  })

  modal.setContent(component)
  modal.open()
}

const openGuideModal = (manager) => {
  const { ref, defineComponent, computed } = Vue

  const selectedProfileId = ref('')
  const mode = ref('local')
  const remoteUrl = ref('')
  const enableCache = ref(true)

  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-8 p-8">
      <ul class="list-disc pl-6 text-14 text-gray-600 space-y-6 leading-relaxed">
        <li>该插件会在 sing-box 启动前，把外部 JSON 作为 override 合并进当前 profile 生成的配置。</li>
        <li>外部文件必须是 JSON 对象。对象会递归合并，数组默认整体覆盖；命中“数组追加路径”的数组会改为追加。</li>
        <li>导入本地 JSON 时，插件会把内容复制到缓存目录并以该快照作为后续运行时输入，不会自动跟踪原始文件更新；编辑本地规则时会重新导入到该快照。</li>
        <li>运行前会对合并后的最终配置执行一次 sing-box check，校验失败会阻止启动。</li>
      </ul>
      <div class="py-12 flex items-center justify-between gap-8">
        <div class="text-16 font-bold shrink-0">关联配置</div>
        <Select v-model="selectedProfileId" class="w-[70%]" :options="profileOptions" />
      </div>
      <div class="flex gap-8">
        <Button class="flex-1" :type="mode === 'local' ? 'primary' : 'default'" @click="mode = 'local'">
          本地 JSON
        </Button>
        <Button class="flex-1" :type="mode === 'remote' ? 'primary' : 'default'" @click="mode = 'remote'">
          远程 JSON
        </Button>
      </div>
      <div v-if="mode === 'remote'" class="flex flex-col gap-8">
        <div class="py-12 flex items-center justify-between gap-8">
          <Input v-model="remoteUrl" placeholder="http(s)://..." allow-paste class="w-[75%]" />
          <Button type="primary" @click="handleRemote">确认</Button>
        </div>
        <div class="py-12 flex items-center justify-between">
          <div class="text-16 font-bold">启用缓存</div>
          <Switch v-model="enableCache" />
        </div>
      </div>
      <div v-else class="flex">
        <Button class="w-full" type="primary" @click="handleLocal">选择本地 JSON 文件</Button>
      </div>
    </div>
    `,
    setup() {
      const profileOptions = computed(() =>
        Plugins.useProfilesStore().profiles.map((profile) => ({
          label: profile.name,
          value: profile.id
        }))
      )

      const ensureProfileSelected = () => {
        if (!selectedProfileId.value) {
          Plugins.message.error('请选择一个 profile')
          return false
        }
        return true
      }

      const handleLocal = async () => {
        if (!ensureProfileSelected()) return
        const success = await manager.handleAddLocal(selectedProfileId.value)
        if (success) modal.close()
      }

      const handleRemote = async () => {
        if (!ensureProfileSelected()) return
        const success = await manager.handleAddRemote(selectedProfileId.value, remoteUrl.value.trim(), enableCache.value)
        if (success) modal.close()
      }

      return {
        mode,
        remoteUrl,
        enableCache,
        selectedProfileId,
        profileOptions,
        handleLocal,
        handleRemote
      }
    }
  })

  const modal = Plugins.modal({
    title: '添加配置覆盖',
    submit: false,
    cancelText: '关闭',
    width: '64',
    afterClose: () => {
      modal.destroy()
    }
  })

  modal.setContent(component)
  modal.open()
}

const openEditModal = (cfg, manager) => {
  const { ref, defineComponent, computed } = Vue

  const selectedProfileId = ref(cfg.profileId)
  const inputValue = ref(cfg.type === 'local' ? '' : cfg.configUrl)
  const cacheEnabled = ref(cfg.type === 'remote' ? (cfg.cache?.enable ?? false) : false)

  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-8">
      <div class="px-8 py-12 flex items-center justify-between gap-8">
        <div class="text-16 font-bold shrink-0">关联配置</div>
        <Select v-model="selectedProfileId" class="w-[75%]" :options="profileOptions" />
      </div>
      <div class="px-8 py-12 flex items-center justify-between gap-8">
        <div class="text-16 font-bold shrink-0">{{ inputLabel }}</div>
        <Input v-model="inputValue" :placeholder="placeholder" allow-paste class="w-[75%] text-14" />
      </div>
      <div v-if="cfg.type === 'local'" class="px-8 text-12 text-gray-500 break-all">
        当前快照文件：{{ cfg.configPath }}
      </div>
      <div v-if="cfg.type === 'remote'" class="px-8 py-12 flex items-center justify-between gap-8">
        <div class="text-16 font-bold shrink-0">启用缓存</div>
        <Switch v-model="cacheEnabled" />
      </div>
    </div>
    `,
    setup() {
      const profileOptions = computed(() =>
        Plugins.useProfilesStore().profiles.map((profile) => ({
          label: profile.name,
          value: profile.id
        }))
      )

      return {
        cfg,
        inputValue,
        selectedProfileId,
        cacheEnabled,
        profileOptions,
        inputLabel: cfg.type === 'local' ? '重新导入文件路径' : '配置链接',
        placeholder: cfg.type === 'local' ? '/PATH/TO/override.json' : 'http(s)://...'
      }
    }
  })

  const modal = Plugins.modal({
    title: '编辑覆盖规则',
    width: '56',
    submitText: '保存',
    cancelText: '取消',
    onOk: async () => {
      if (!selectedProfileId.value) {
        Plugins.message.error('请选择一个 profile')
        return false
      }
      if (!inputValue.value.trim()) {
        Plugins.message.error('输入不能为空')
        return false
      }

      try {
        await manager.updateConfig(cfg, {
          profileId: selectedProfileId.value,
          input: inputValue.value.trim(),
          cache: cacheEnabled.value
        })
        return true
      } catch (error) {
        Plugins.message.error(`保存失败：${error instanceof Error ? error.message : String(error)}`)
        return false
      }
    },
    afterClose: () => {
      modal.destroy()
    }
  })

  modal.setContent(component)
  modal.open()
}

class ConfigOverrideManager {
  configs = getState().configs

  async init() {
    await ensureDirectories()
    this.configs.value = await readManagerConfigs()
  }

  async handleAddLocal(profileId) {
    ensureProfileUnbound(profileId)

    const file = await selectLocalJsonFile()
    if (!file) {
      return false
    }

    const content = await file.text()

    try {
      validateJSONText(content, '覆盖配置')
    } catch (error) {
      Plugins.message.error(String(error))
      return false
    }

    const id = Plugins.sampleID()
    const cachePath = `${CACHE_PATH}/${id}.json`

    await Plugins.WriteFile(cachePath, content)

    this.configs.value.push({
      id,
      profileId,
      type: 'local',
      configPath: cachePath,
      cache: {
        enable: true,
        path: cachePath,
        lastTime: Date.now()
      }
    })

    await saveConfigs()
    Plugins.message.success('本地覆盖配置添加成功')
    Plugins.message.info(`已将导入内容写入快照 ${cachePath}`)
    return true
  }

  async handleAddRemote(profileId, url, enableCache) {
    ensureProfileUnbound(profileId)

    if (!url) {
      Plugins.message.error('URL 不能为空')
      return false
    }

    if (!/^https?:\/\/[^\s]+$/.test(url)) {
      Plugins.message.error('URL 格式错误')
      return false
    }

    try {
      const content = await fetchRemoteFile(url)
      validateJSONText(content, '远程覆盖配置')

      const id = Plugins.sampleID()
      const config = {
        id,
        profileId,
        type: 'remote',
        configUrl: url,
        cache: {
          enable: enableCache,
          path: '',
          lastTime: 0
        }
      }

      if (enableCache) {
        config.cache.path = `${CACHE_PATH}/${id}.json`
        config.cache.lastTime = Date.now()
        await Plugins.WriteFile(config.cache.path, content)
      }

      this.configs.value.push(config)
      await saveConfigs()
      Plugins.message.success('远程覆盖配置添加成功')
      return true
    } catch (error) {
      Plugins.message.error(`远程配置获取失败：${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async deleteConfig(cfg) {
    if (!(await Plugins.confirm('提示', '确定要删除该覆盖规则吗？').catch(() => false))) {
      return
    }

    const idx = this.configs.value.findIndex((item) => item.id === cfg.id)
    if (idx === -1) {
      Plugins.message.error('配置不存在')
      return
    }

    this.configs.value.splice(idx, 1)
    await saveConfigs()

    if (cfg.cache?.path?.startsWith(CACHE_PATH)) {
      await Plugins.RemoveFile(cfg.cache.path).catch(() => {
        /* noop */
      })
    }

    Plugins.message.success('覆盖规则删除成功')
  }

  async updateConfig(cfg, options) {
    ensureProfileUnbound(options.profileId, cfg.id)

    cfg.profileId = options.profileId

    if (cfg.type === 'local') {
      const content = await validateLocalConfigPath(options.input, '本地覆盖文件')
      const snapshotPath = cfg.cache?.path || cfg.configPath || `${CACHE_PATH}/${cfg.id}.json`
      await Plugins.WriteFile(snapshotPath, content)
      cfg.configPath = snapshotPath
      cfg.cache = {
        ...(cfg.cache || {}),
        enable: true,
        path: snapshotPath,
        lastTime: Date.now()
      }
    } else {
      cfg.configUrl = options.input
      cfg.cache = {
        ...(cfg.cache || {}),
        enable: !!options.cache,
        path: cfg.cache?.path || `${CACHE_PATH}/${cfg.id}.json`
      }

      if (cfg.cache.enable) {
        const content = await fetchRemoteFile(cfg.configUrl)
        validateJSONText(content, '远程覆盖配置')
        await Plugins.WriteFile(cfg.cache.path, content)
        cfg.cache.lastTime = Date.now()
      }
    }

    await saveConfigs()
    Plugins.message.success('覆盖规则保存成功')
  }

  async updateCache() {
    const remoteItems = this.configs.value.filter((item) => item.type === 'remote' && item.cache?.enable)

    if (remoteItems.length === 0) {
      Plugins.message.info('没有可更新的远程缓存')
      return
    }

    let success = 0
    let failure = 0

    for (const cfg of remoteItems) {
      try {
        const content = await fetchRemoteFile(cfg.configUrl)
        parseJSONObject(content, '远程覆盖配置')
        const cachePath = cfg.cache.path || `${CACHE_PATH}/${cfg.id}.json`
        await Plugins.WriteFile(cachePath, content)
        cfg.cache.path = cachePath
        cfg.cache.lastTime = Date.now()
        success += 1
      } catch (error) {
        failure += 1
        Plugins.message.warn(`更新 ${getProfileName(cfg.profileId)} 失败：${error}`)
      }
    }

    await saveConfigs()
    Plugins.message.success(`缓存更新完成：成功 ${success}，失败 ${failure}`)
  }
}

const selectLocalJsonFile = () => {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.style.display = 'none'
    input.multiple = false
    input.accept = '.json, application/json'

    const cleanup = () => {
      window.removeEventListener('focus', onFocus)
      document.body.removeChild(input)
    }

    const onFocus = () => {
      setTimeout(() => {
        if (input.files?.length === 0) {
          resolve(null)
          cleanup()
        }
      }, 200)
    }

    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
      cleanup()
    })

    window.addEventListener('focus', onFocus, { once: true })
    document.body.appendChild(input)
    input.click()
  })
}
