window[Plugin.id] = window[Plugin.id] ?? {
  configs: Vue.ref([])
}

const BASE_PATH = `data/third/${Plugin.id}`
const MANAGE_FILE_PATH = `${BASE_PATH}/manage.json`
const TEMP_CHECK_PATH = 'data/.cache/temp-check.json'

/* 触发器 手动触发 */
const onRun = async () => {
  const manager = new NativeConfigManager()
  await manager.init()
  openMainUI(manager)
}

/* 触发器 生成配置时 */
const onGenerate = async (config, profile) => {
  const configs = window[Plugin.id].configs.value ?? []
  const configItem = configs.find((c) => c.profileId === profile.id)
  if (!configItem) return config
  let nativeConfig
  try {
    if (configItem.type === 'local') {
      const content = await Plugins.ReadFile(configItem.configPath)
      nativeConfig = JSON.parse(content)
    } else {
      const { body } = await Plugins.Requests({
        method: 'GET',
        url: configItem.configUrl,
        headers: { 'User-Agent': 'sing-box' },
        autoTransformBody: false
      })
      nativeConfig = JSON.parse(body)
    }
  } catch (error) {
    throw `原生配置获取失败：${error instanceof Error ? error.message : String(error)}`
  }
  nativeConfig.experimental = {
    ...nativeConfig.experimental,
    clash_api: {
      ...nativeConfig.experimental?.clash_api,
      external_controller: config.experimental?.clash_api?.external_controller ?? '127.0.0.1:20123',
      secret: config.experimental?.clash_api?.secret ?? ''
    }
  }
  return nativeConfig
}

const openMainUI = (manager) => {
  const { defineComponent } = Vue
  const component = defineComponent({
    template: `
    <div class="h-full w-full">
        <div v-if="manager.configs.value.length === 0"
             class="flex items-center justify-center h-full min-h-[200px] cursor-pointer"
             @click="openGuide">
            <span class="text-16 font-bold text-gray-400 hover:text-gray-600 transition-colors">
                尚未添加任何原生配置，点击添加
            </span>
        </div>
        <div v-else class="grid grid-cols-3 gap-6 p-8 overflow-y-auto max-h-[500px]" style="gap: 10px;">
            <Card v-for="cfg in manager.configs.value" :key="cfg.id" class="border-none shadow-sm" :body-style="{ padding: '0px' }">
                <div class="flex flex-col box-border" style="min-height: 75px; padding: 4px 0px;">
                    <div class="flex justify-between items-start gap-4">
                        <div class="font-bold text-16 truncate text-white" :title="cfg.profileName">
                            {{ cfg.profileName }}
                        </div>
                        <Button class="text-gray-400 hover:text-red-500 flex-shrink-0" size="small" type="text" @click="deleteConfig(cfg)">
                            删除
                        </Button>
                    </div>
                    <div class="mt-auto flex items-center justify-between w-full">
                        <div class="text-12 text-gray-400">
                            类型：{{ cfg.type === 'local' ? '本地' : '远程' }}
                        </div>
                        <Button size="small" @click="editConfig(cfg)">
                            编辑
                        </Button>
                    </div>

                </div>
            </Card>
            <div class="col-span-3 mt-4">
                <Button class="w-full" type="dashed" @click="openGuide">
                    添加新配置
                </Button>
            </div>

        </div>
    </div>
        `,
    setup() {
      return {
        manager,
        openGuide: () => {
          openGuideModal(manager)
        },
        editConfig: (cfg) => {
          openEditModal(cfg, manager)
        },
        deleteConfig: async (cfg) => {
          if (!(await Plugins.confirm('提示', '确定要删除该配置吗？'))) return
          const idx = manager.configs.value.findIndex((c) => c.id === cfg.id)
          if (idx !== -1) {
            manager.configs.value?.splice(idx, 1)
            await manager.saveConfigs()
            const profilesStore = Plugins.useProfilesStore()
            await profilesStore.deleteProfile(cfg.profileId)
            Plugins.message.success('配置删除成功')
          }
        }
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
  const component = defineComponent({
    template: `
            <div class="flex flex-col gap-8 p-8">
                <ul class="list-disc pl-6 text-14 text-gray-600 space-y-6 leading-relaxed">
                    <li>你可以通过此插件添加与 sing-box 原生配置关联的 GUI 配置方案。你可以直接编辑所关联的原始配置，以将修改应用到运行时配置，而无需重新导入。</li>
                    <li>此插件不支持任何解码操作。要关联的本地或远程配置必须是原始 JSON 文件。</li>
                    <li>请勿直接修改所创建的 GUI 配置，因为这将不会生效。如果你需要修改或删除配置，请在此插件内进行操作。</li>
                    <li>为确保插件正常运行，请确保要关联的本地原生配置放置在 <code class="bg-gray-200 px-2 py-1 rounded">data/sing-box</code> 目录中。</li>
                </ul>
                <div class="flex gap-8 mt-8">
                    <Button class="flex-1" type="primary" @click="handleLocal">添加本地配置</Button>
                    <Button class="flex-1" type="primary" @click="showUrlInput = !showUrlInput">添加远程配置</Button>
                </div>
                <div v-if="showUrlInput" class="mt-8 flex gap-4 items-center">
                    <Input v-model="remoteUrl" placeholder="输入远程文件链接..." class="flex-1" />
                    <Button type="primary" @click="handleRemote">确认</Button>
                </div>
            </div>
        `,
    setup() {
      const handleLocal = async () => {
        const success = await manager.handleAddLocal()
        if (success) modal.close()
      }

      const handleRemote = async () => {
        const success = await manager.handleAddRemote(remoteUrl.value.trim())
        if (success) modal.close()
      }
      return { showUrlInput, remoteUrl, handleLocal, handleRemote }
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
  const jsonStr = ref(JSON.stringify(cfg, null, 2))
  const component = defineComponent({
    template: `
            <div class="flex flex-col h-full gap-4 p-4">
                <CodeViewer v-model="jsonStr" lang="json" editable class="flex-1 min-h-[300px] border rounded" />
            </div>
        `,
    setup() {
      return { jsonStr }
    }
  })
  const modal = Plugins.modal({
    title: '编辑',
    width: '50',
    submitText: '保存',
    cancelText: '取消',
    onOk: async () => {
      try {
        const updatedConfig = JSON.parse(jsonStr.value)
        const idx = manager.configs.value.findIndex((c) => c.id === cfg.id)
        if (idx !== -1) {
          manager.configs.value[idx] = updatedConfig
          await manager.saveConfigs()
          Plugins.message.success('配置保存成功')
        }
        return true
      } catch (error) {
        Plugins.message.error(`保存格式错误：${error instanceof Error ? error.message : String(error)}`)
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
class NativeConfigManager {
  configs = window[Plugin.id].configs

  async init() {
    if (!(await Plugins.FileExists(BASE_PATH))) {
      await Plugins.MakeDir(BASE_PATH)
      await Plugins.WriteFile(MANAGE_FILE_PATH, '[]')
      this.configs.value = []
    } else {
      try {
        const content = await Plugins.ReadFile(MANAGE_FILE_PATH)
        this.configs.value = JSON.parse(content)
      } catch (error) {
        console.log('管理文件解析失败', error)
        this.configs.value = []
      }
    }
  }

  async saveConfigs() {
    await Plugins.WriteFile(MANAGE_FILE_PATH, JSON.stringify(this.configs.value, null, 2))
  }

  async validateConfig(content) {
    try {
      JSON.parse(content)
      await Plugins.WriteFile(TEMP_CHECK_PATH, content)
      const coreName = await Plugins.getKernelFileName(false)
      const corePath = await Plugins.AbsolutePath(`data/sing-box/${coreName}`)
      const tempPath = await Plugins.AbsolutePath(TEMP_CHECK_PATH)
      await Plugins.Exec(corePath, ['check', '-c', tempPath])
      return true
    } catch (error) {
      Plugins.message.error(`配置效验不通过：${error instanceof Error ? error.message : String(error)}`)
      return false
    } finally {
      await Plugins.RemoveFile(TEMP_CHECK_PATH).catch(() => {
        /*  */
      })
    }
  }

  async handleAddLocal() {
    const file = await selectLocalJsonFile()
    if (!file) return false
    const content = await file.text()
    const isValid = await this.validateConfig(content)
    if (!isValid) return false
    const targetPath = `data/sing-box/${file.name}`
    await Plugins.WriteFile(targetPath, content)
    const sourceConfig = JSON.parse(content)
    const profileName = file.name.replace(/\.json$/i, '')
    const profilesStore = Plugins.useProfilesStore()
    const profile = profilesStore.getProfileTemplate(profileName)
    profile.experimental.clash_api.external_controller = sourceConfig.experimental?.clash_api?.external_controller ?? '127.0.0.1:20123'
    profile.experimental.clash_api.secret = sourceConfig.experimental?.clash_api?.secret ?? ''
    await profilesStore.addProfile(profile)
    const newItem = {
      id: Plugins.sampleID(),
      type: 'local',
      profileId: profile.id,
      profileName,
      configPath: targetPath
    }
    this.configs.value.push(newItem)
    await this.saveConfigs()
    Plugins.message.success('本地原生配置添加成功')
    return true
  }

  async handleAddRemote(url) {
    if (!url.length) {
      Plugins.message.error('URL 不能为空')
      return false
    }
    if (!/^https?:\/\/[^\s]+$/.test(url)) {
      Plugins.message.error('URL 格式错误')
      return false
    }
    try {
      const { body } = await Plugins.Requests({
        method: 'GET',
        url,
        headers: { 'User-Agent': 'sing-box' },
        autoTransformBody: false
      })
      const isValid = await this.validateConfig(body)
      if (!isValid) return false
      const sourceConfig = JSON.parse(body)
      const profileName = extractProfileNameFromUrl(url)
      const profilesStore = Plugins.useProfilesStore()
      const profile = profilesStore.getProfileTemplate(profileName)
      profile.experimental.clash_api.external_controller = sourceConfig.experimental?.clash_api?.external_controller ?? '127.0.0.1:20123'
      profile.experimental.clash_api.secret = sourceConfig.experimental?.clash_api?.secret ?? ''
      await profilesStore.addProfile(profile)
      const newItem = {
        id: Plugins.sampleID(),
        type: 'remote',
        profileId: profile.id,
        profileName,
        configUrl: url
      }
      this.configs.value.push(newItem)
      await this.saveConfigs()
      Plugins.message.success('远程原生配置添加成功')
      return true
    } catch (error) {
      Plugins.message.error(`远程配置获取失败：${error instanceof Error ? error.message : String(error)}`)
      return false
    }
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
