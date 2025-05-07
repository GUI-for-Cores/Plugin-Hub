/**
 * 插件钩子：运行按钮 - onRun
 */
const onRun = async () => {
  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.kernel.running) {
    throw '请先启动内核'
  }
  await openDash()
}

/**
 * 生成本地仪表板配置
 */
const onGenerate = async (config) => {
  if (Plugin.dashType !== 'local') return config

  let uiPath, uiDownloadUrl
  switch (Plugin.dashName) {
    case 'yacdmeta':
      uiPath = 'ui/yacdmeta'
      uiDownloadUrl = 'https://github.com/MetaCubeX/Yacd-meta/archive/gh-pages.zip'
      break
    case 'metacubexd':
      uiPath = 'ui/metacubexd'
      uiDownloadUrl = 'https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip'
      break
    case 'zashboard':
      uiPath = 'ui/zashboard'
      uiDownloadUrl = 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip'
      break
  }

  if (Plugins.APP_TITLE.includes('SingBox')) {
    config = {
      ...config,
      experimental: {
        ...config.experimental,
        clash_api: {
          ...config.experimental.clash_api,
          external_ui: uiPath,
          external_ui_download_url: uiDownloadUrl
        }
      }
    }
  } else {
    config = {
      ...config,
      'external-ui': uiPath,
      'external-ui-url': uiDownloadUrl
    }
  }
  return config
}

/**
 * 创建仪表板链接，并访问
 */
const openDash = async () => {
  const { external_controller: controller, external_ui: configUiPath, secret } = await getApiConfig()
  const [, port] = controller.split(':')
  let openUrl
  if (Plugin.dashType === 'online') {
    let dashLink
    switch (Plugin.dashName) {
      case 'yacdmeta':
        dashLink = 'http://yacd.metacubex.one/'
        break
      case 'metacubexd':
        dashLink = 'http://metacubex.github.io/metacubexd/#/setup'
        break
      case 'zashboard':
        dashLink = 'http://board.zash.run.place/#/setup'
        break
    }
    openUrl = `${dashLink}?hostname=127.0.0.1&port=${port}${secret ? `&secret=${secret}` : ''}&http=1`
  } else {
    let uiPath, urlPath
    switch (Plugin.dashName) {
      case 'yacdmeta':
        uiPath = 'ui/yacdmeta'
        urlPath = '/'
        break
      case 'metacubexd':
        uiPath = 'ui/metacubexd'
        urlPath = '/#/setup'
        break
      case 'zashboard':
        uiPath = 'ui/zashboard'
        urlPath = '/#/setup'
        break
    }
    openUrl = `http://127.0.0.1:${port}/ui${urlPath}?hostname=127.0.0.1&port=${port}${secret ? `&secret=${secret}` : ''}&http=1`
    if (configUiPath !== uiPath) {
      const kernelApiStore = Plugins.useKernelApiStore()
      kernelApiStore.restartKernel()
      await Plugins.sleep(3_000)
    }
  }
  Plugins.BrowserOpenURL(openUrl)
}

/**
 * 获取 Clash API 配置
 */
const getApiConfig = async () => {
  if (Plugins.APP_TITLE.includes('SingBox')) {
    const coreConfigFilePath = 'data/sing-box/config.json'
    const coreConfig = await Plugins.Readfile(coreConfigFilePath)
    const {
      experimental: {
        clash_api: { external_controller, external_ui, secret }
      }
    } = JSON.parse(coreConfig)
    return { external_controller, external_ui, secret }
  } else {
    const coreConfigFilePath = 'data/mihomo/config.yaml'
    const coreConfig = await Plugins.Readfile(coreConfigFilePath)
    const { 'external-controller': external_controller, 'external-ui': external_ui, secret } = Plugins.YAML.parse(coreConfig)
    return { external_controller, external_ui, secret }
  }
}
