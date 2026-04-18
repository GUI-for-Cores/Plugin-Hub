/** @type {EsmPlugin} */
export default (Plugin) => {
  const basePath = `data/third/${Plugin.id}`
  const cacheDir = `data/.cache/${Plugin.id}`
  const managerPath = `${basePath}/${Plugin.id}.json`
  const appStore = Plugins.useAppStore()
  const profilesStore = Plugins.useProfilesStore()
  const manager = new NativeConfigManager({ cacheDir, managerPath })
  /* 触发器 手动触发 */
  const onRun = async () => {
    await manager.init()
    openMainUI(manager)
  }
  /* 触发器 APP就绪后 */
  const onReady = async () => {
    await manager.init()
    appStore.addCustomActions('profiles_header', {
      id: Plugin.id,
      component: 'Button',
      componentProps: {
        type: 'link',
        onClick: onRun
      },
      componentSlots: {
        default: '管理原生配置'
      }
    })
  }
  /* 触发器 生成配置时 */
  const onGenerate = async (config, profile) => {
    const cfg = manager.configs.value.find((c) => c.profileId === profile.id)
    if (!cfg) return config
    let nativeConfig
    try {
      if (cfg.type === 'local') {
        const content = await Plugins.ReadFile(cfg.configPath)
        nativeConfig = JSON.parse(content)
      } else {
        let content
        if (cfg.cache?.enable && cfg.cache.path) {
          content = await Plugins.ReadFile(cfg.cache.path)
        } else {
          content = await fetchRemoteFile(cfg.configUrl)
        }
        nativeConfig = JSON.parse(content)
      }
    } catch (error) {
      throw `原始配置获取失败：${error instanceof Error ? error.message : String(error)}`
    }
    return {
      ...nativeConfig,
      experimental: {
        ...nativeConfig.experimental,
        clash_api: {
          ...nativeConfig.experimental?.clash_api,
          external_controller: config.experimental?.clash_api?.external_controller ?? '127.0.0.1:20123',
          secret: config.experimental?.clash_api?.secret ?? ''
        }
      }
    }
  }
  const onInstall = async () => {
    await Promise.all([basePath, cacheDir].map((dir) => Plugins.MakeDir(dir)))
    await Plugins.WriteFile(managerPath, '[]')
  }
  const onUninstall = async () => {
    await Promise.all([basePath, cacheDir].map((dir) => Plugins.RemoveFile(dir)))
  }
  const openMainUI = (manager) => {
    const { h, resolveComponent, defineComponent } = Vue
    const getProfileName = (cfg) => {
      return profilesStore.getProfileById(cfg.profileId)?.name ?? 'Not Found'
    }
    const component = defineComponent({
      template: `
    <div class="h-full w-full">
      <div v-if="manager.configs.value.length === 0"
        class="flex items-center justify-center h-full min-h-[200px] cursor-pointer" @click="openGuide">
        <span class="text-16 font-bold text-gray-400 hover:text-gray-600 transition-colors">
          尚未添加任何原生配置，点击添加
        </span>
      </div>
      <div v-else class="grid grid-cols-3 gap-8 p-8 overflow-y-auto max-h-[500px]">
        <Card v-for="cfg in manager.configs.value" :key="cfg.id" :title="getProfileName(cfg)">
          <template #extra>
            <Button class="text-red-500 hover:text-red-700" size="small" type="text" @click.stop="deleteConfig(cfg)">
              删除
            </Button>
          </template>
          <div class="flex flex-col min-h-[70px]">
            <div class="mt-auto pt-4 flex justify-between items-center w-full">
              <div class="text-12 text-gray-500">
                {{ cfg.type === 'local' ? '本地' : '远程' + (cfg.cache?.path ? '「已缓存」' : '') }}
              </div>
              <Button size="small" type="primary" @click.stop="editConfig(cfg)">
                编辑
              </Button>
            </div>
          </div>
        </Card>
        <Button class="col-span-3 mt-4" type="dashed" @click="openGuide">
          添加新配置
        </Button>
      </div>
    </div>
    `,
      setup(_, { expose }) {
        expose({
          modalSlots: {
            toolbar: () => [
              h(
                resolveComponent('Button'),
                {
                  type: 'link',
                  onClick: async () => {
                    await Plugins.OpenDir(basePath)
                  }
                },
                () => '打开插件目录'
              ),
              h(
                resolveComponent('Button'),
                {
                  type: 'link',
                  onClick: async () => {
                    await Plugins.OpenDir(cacheDir)
                  }
                },
                () => '打开缓存目录'
              ),
              h(
                resolveComponent('Button'),
                {
                  type: 'link',
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
          openGuide: () => {
            openGuideModal(manager)
          },
          editConfig: (cfg) => {
            openEditModal(cfg, manager)
          },
          deleteConfig: async (cfg) => {
            await manager.deleteConfig(cfg)
          },
          getProfileName
        }
      }
    })
    const modal = Plugins.modal({
      title: '原生配置管理',
      submit: false,
      cancelText: '关闭',
      width: '80',
      height: '80',
      afterClose: () => {
        modal.destroy()
      }
    })
    modal.setContent(component)
    modal.open()
  }
  const openGuideModal = (manager) => {
    const { ref, defineComponent } = Vue
    const showUrlInput = ref(false)
    const remoteUrl = ref('')
    const enableCache = ref(false)
    const component = defineComponent({
      template: `
    <div class="flex flex-col gap-8 p-8">
      <ul class="list-disc pl-6 text-14 text-gray-600 space-y-6 leading-relaxed">
        <li>你可以通过此插件添加与 sing-box 原始配置关联的 GUI 配置方案。你可以直接编辑所关联的原始配置，将修改应用到运行时配置，而无需重新导入。</li>
        <li>此插件不支持任何解码操作。要关联的本地或远程配置必须是原始 JSON 文件。</li>
        <li>请勿直接修改此插件创建的 GUI 配置，因为这将不会生效。如果你需要修改或删除配置，请在此插件内进行操作。</li>
      </ul>
      <div class="flex gap-8 mt-8">
        <Button class="flex-1" type="primary" @click="handleLocal">添加本地配置</Button>
        <Button class="flex-1" type="primary" @click="showUrlInput = !showUrlInput; enableCache = false">添加远程配置</Button>
      </div>
      <div v-if="showUrlInput" class="flex flex-col mt-4">
        <div class="py-12 flex items-center justify-between gap-8">
        <Input v-model="remoteUrl" placeholder="http(s)://..." allow-paste class="w-[75%]" />
        <Button type="primary" @click="handleRemote">确认</Button>
      </div>
        <div class="py-12 flex items-center justify-between">
          <div class="text-16 font-bold">启用缓存</div>
          <Switch v-model="enableCache" />
        </div>
      </div>
    </div>
    `,
      setup() {
        const handleLocal = async () => {
          const success = await manager.handleAddLocal()
          if (success) modal.close()
        }
        const handleRemote = async () => {
          const success = await manager.handleAddRemote(remoteUrl.value.trim(), enableCache.value)
          if (success) modal.close()
        }
        return { showUrlInput, remoteUrl, enableCache, handleLocal, handleRemote }
      }
    })
    const modal = Plugins.modal({
      title: '原生配置添加向导',
      submit: false,
      cancelText: '关闭',
      width: '60',
      afterClose: () => {
        modal.destroy()
      }
    })
    modal.setContent(component)
    modal.open()
  }
  const openEditModal = (cfg, manager) => {
    const { ref, defineComponent } = Vue
    const inputValue = ref(cfg.type === 'local' ? cfg.configPath : cfg.configUrl)
    const cacheOptions = ref(cfg.type === 'remote' ? (cfg.cache?.enable ?? false) : undefined)
    const component = defineComponent({
      template: `
    <div class="flex flex-col">
      <div class="px-8 py-12 flex items-center justify-between gap-8">
        <div class="text-16 font-bold shrink-0">
          {{ label }}
        </div>
        <Input v-model="inputValue" :placeholder="placeholder" allow-paste class="w-[75%] text-14" />
      </div>
      <div v-if="isRemote" class="px-8 py-12 flex items-center justify-between gap-8">
        <div class="text-16 font-bold shrink-0">启用缓存</div>
        <Switch v-model="cacheOptions" />
      </div>
    </div>
    `,
      setup() {
        const isRemote = cfg.type === 'remote'
        const label = isRemote ? '配置链接' : '配置路径'
        const placeholder = isRemote ? 'http(s)://...' : '/PATH/TO/FILE.json'
        return { inputValue, label, placeholder, isRemote, cacheOptions }
      }
    })
    const modal = Plugins.modal({
      title: '编辑',
      width: '50',
      submitText: '保存',
      cancelText: '取消',
      onOk: async () => {
        if (!inputValue.value.length) {
          Plugins.message.error('输入不能为空')
          return false
        }
        try {
          await manager.updateConfig(cfg, {
            input: inputValue.value,
            cache: cacheOptions.value
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
  return { onRun, onReady, onGenerate, onInstall, onUninstall }
}
class NativeConfigManager {
  configs = Vue.ref([])
  cacheDir
  managerPath
  tempPath
  constructor(opts) {
    this.cacheDir = opts.cacheDir
    this.managerPath = opts.managerPath
    this.tempPath = `${this.cacheDir}/temp.json`
  }
  async init() {
    try {
      const content = await Plugins.ReadFile(this.managerPath)
      this.configs.value = JSON.parse(content)
    } catch (error) {
      console.error('管理器配置读取失败', error)
      this.configs.value = []
    }
  }
  async handleAddLocal() {
    const file = await selectLocalJsonFile()
    if (!file) return false
    const content = await file.text()
    const isValid = await this.validateConfig(content)
    if (!isValid) return false
    const id = Plugins.sampleID()
    const cachePath = `${this.cacheDir}/${id}.json`
    await Plugins.WriteFile(cachePath, content)
    Plugins.message.info(`配置已缓存至 ${cachePath}，可自行修改为其他路径，本地配置缓存不会触发更新`)
    const sourceConfig = JSON.parse(content)
    const profileName = file.name.replace(/\.json$/i, '')
    const profilesStore = Plugins.useProfilesStore()
    const profile = profilesStore.getProfileTemplate(profileName)
    profile.experimental.clash_api.external_controller = sourceConfig.experimental?.clash_api?.external_controller ?? '127.0.0.1:20123'
    profile.experimental.clash_api.secret = sourceConfig.experimental?.clash_api?.secret ?? ''
    await profilesStore.addProfile(profile)
    const newItem = {
      id,
      type: 'local',
      profileId: profile.id,
      configPath: cachePath
    }
    this.configs.value.push(newItem)
    await this.saveConfigs()
    Plugins.message.success('本地配置添加成功')
    return true
  }
  async handleAddRemote(url, cache) {
    if (!url.length) {
      Plugins.message.error('URL 不能为空')
      return false
    }
    if (!/^https?:\/\/[^\s]+$/.test(url)) {
      Plugins.message.error('URL 格式错误')
      return false
    }
    try {
      const content = await fetchRemoteFile(url)
      const isValid = await this.validateConfig(content)
      if (!isValid) return false
      const id = Plugins.sampleID()
      const handleCache = async () => {
        if (!cache) return { enable: false }
        const cachePath = `${this.cacheDir}/${id}.json`
        await Plugins.WriteFile(cachePath, content)
        Plugins.message.info(`配置已缓存至 ${cachePath}，请在远程配置发生变化时，手动更新`)
        return { enable: true, path: cachePath }
      }
      const sourceConfig = JSON.parse(content)
      const profileName = extractProfileNameFromUrl(url)
      const profilesStore = Plugins.useProfilesStore()
      const profile = profilesStore.getProfileTemplate(profileName)
      profile.experimental.clash_api.external_controller = sourceConfig.experimental?.clash_api?.external_controller ?? '127.0.0.1:20123'
      profile.experimental.clash_api.secret = sourceConfig.experimental?.clash_api?.secret ?? ''
      await profilesStore.addProfile(profile)
      const newItem = {
        id,
        type: 'remote',
        profileId: profile.id,
        configUrl: url,
        cache: await handleCache()
      }
      this.configs.value.push(newItem)
      await this.saveConfigs()
      Plugins.message.success('远程配置添加成功')
      return true
    } catch (error) {
      Plugins.message.error(`远程配置获取失败：${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }
  async validateConfig(content) {
    try {
      JSON.parse(content)
      await Plugins.WriteFile(this.tempPath, content)
      const isAlpha = Plugins.useAppSettingsStore().app.kernel.branch === 'alpha'
      const coreName = await Plugins.getKernelFileName(isAlpha)
      const corePath = await Plugins.AbsolutePath(`data/sing-box/${coreName}`)
      const tempPath = await Plugins.AbsolutePath(this.tempPath)
      await Plugins.Exec(corePath, ['check', '-c', tempPath])
      return true
    } catch (error) {
      Plugins.message.error(`配置效验不通过：${error instanceof Error ? error.message : String(error)}`)
      return false
    } finally {
      await Plugins.RemoveFile(this.tempPath).catch(() => {
        /*  */
      })
    }
  }
  async saveConfigs() {
    await Plugins.WriteFile(this.managerPath, JSON.stringify(this.configs.value, null, 2))
  }
  async deleteConfig(cfg) {
    if (!(await Plugins.confirm('提示', '确定要删除该配置吗？').catch(() => false))) return
    const idx = this.configs.value.findIndex((c) => c.id === cfg.id)
    if (idx === -1) {
      Plugins.message.error('配置不存在')
      return
    }
    this.configs.value?.splice(idx, 1)
    await this.saveConfigs()
    await Plugins.useProfilesStore().deleteProfile(cfg.profileId)
    await Plugins.RemoveFile(`${this.cacheDir}/${cfg.id}.json`).catch(() => {
      /*  */
    })
    Plugins.message.success('配置删除成功')
  }
  async updateConfig(cfg, options) {
    const { input, cache } = options
    if (cfg.type === 'local') {
      cfg.configPath = input
    } else {
      cfg.configUrl = input
      if (cache !== undefined) {
        cfg.cache = {
          ...cfg.cache,
          enable: cache
        }
      }
    }
    await this.saveConfigs()
    Plugins.message.success('配置保存成功')
  }
  async updateCache() {
    const configs = this.configs.value ?? []
    for (const cfg of configs) {
      const profileName = Plugins.useProfilesStore().getProfileById(cfg.profileId)?.name ?? 'Not Found'
      if (cfg.type !== 'remote' || !cfg.cache?.enable) continue
      try {
        const content = await fetchRemoteFile(cfg.configUrl)
        if (!(await this.validateConfig(content))) {
          throw 'Validation failed'
        }
        if (!cfg.cache.path) {
          const cachePath = `${this.cacheDir}/${cfg.id}.json`
          await Plugins.WriteFile(cachePath, content)
          cfg.cache.path = cachePath
          await this.saveConfigs()
        } else {
          await Plugins.WriteFile(cfg.cache.path, content)
        }
        Plugins.message.success(`配置 ${profileName} 更新成功`)
      } catch {
        Plugins.message.warn(`配置 ${profileName} 更新失败`)
        continue
      }
    }
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
const extractProfileNameFromUrl = (url) => {
  const id = Plugins.sampleID()
  const profileName = `remote-config-${id}`
  try {
    const urlObj = new URL(url)
    const filename = urlObj.pathname.split('/').pop() ?? profileName
    return decodeURIComponent(filename).replace(/\.json$/i, '')
  } catch {
    return profileName
  }
}
