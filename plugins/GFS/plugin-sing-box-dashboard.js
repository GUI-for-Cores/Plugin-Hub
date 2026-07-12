/** @type {EsmPlugin} */
export default (plugin) => {
  const appStore = Plugins.useAppStore()
  const appSettingsStore = Plugins.useAppSettingsStore()
  const kernelApiStore = Plugins.useKernelApiStore()
  const isAlphaCore = () => appSettingsStore.app.kernel.branch === 'alpha'
  const getApiService = () => {
    const [host = '127.0.0.1', port = '20190'] = plugin.listen_address.split(':')
    return {
      type: 'api',
      listen: host,
      listen_port: Number(port),
      secret: plugin.secret,
      access_control_allow_private_network: true,
      dashboard: true
    }
  }
  const getFormData = () => {
    const { listen: host, listen_port: port, secret } = getApiService()
    const url = `${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`
    return {
      name: 'Default',
      url,
      secret
    }
  }
  const openDashboardUI = () => {
    if (!isAlphaCore()) {
      Plugins.message.warn('此 Web 面板仅支持内测版核心')
      return
    }
    const { url, secret } = getFormData()
    const dashboardUrl = `http://${url}/dashboard`
    const modal = Plugins.modal(
      {
        title: 'sing-box Dashboard',
        width: '90',
        height: '90',
        footer: false,
        maskClosable: true
      },
      {
        toolbar: () => [
          Vue.h(
            Vue.resolveComponent('Button'),
            {
              type: 'text',
              onClick: () => {
                void Plugins.ClipboardSetText(url)
              }
            },
            () => '复制 URL'
          ),
          Vue.h(
            Vue.resolveComponent('Button'),
            {
              type: 'text',
              onClick: () => {
                void Plugins.ClipboardSetText(secret)
              }
            },
            () => '复制密钥'
          ),
          Vue.h(
            Vue.resolveComponent('Button'),
            {
              type: 'text',
              onClick: () => {
                Plugins.BrowserOpenURL(dashboardUrl)
              }
            },
            () => '浏览器中打开'
          ),
          Vue.h(Vue.resolveComponent('Button'), {
            type: 'text',
            icon: 'close',
            onClick: () => {
              modal.destroy()
            }
          })
        ],
        default: () =>
          Vue.h('iframe', {
            src: dashboardUrl,
            allow: 'clipboard-read; clipboard-write',
            class: 'w-full h-full border-0',
            style: {
              height: 'calc(100% - 6px)'
            }
          })
      }
    )
    modal.open()
  }
  const del_ui = () => {
    appStore.removeCustomActions('core_state', plugin.id)
  }
  const add_ui = () => {
    del_ui()
    const { url } = getFormData()
    const faviconUrl = `http://${url}/dashboard/favicon.svg`
    appStore.addCustomActions('core_state', {
      id: plugin.id,
      component: 'div',
      componentSlots: {
        default: ({ h }) => {
          return h(
            'Button',
            {
              type: 'link',
              size: 'small',
              onClick: openDashboardUI
            },
            () => [
              h('img', {
                src: faviconUrl,
                width: '16px',
                height: '16px',
                style: {
                  borderRadius: '4px',
                  marginRight: '4px'
                }
              }),
              'Dashboard'
            ]
          )
        }
      }
    })
  }
  const onRun = () => {
    if (!kernelApiStore.running) {
      throw '请先启动核心'
    }
    openDashboardUI()
  }
  const onBeforeCoreStart = (config) => {
    if (isAlphaCore()) {
      config.services ??= []
      config.services.push({
        tag: Plugins.sampleID(),
        ...getApiService()
      })
    }
    return config
  }
  const onCoreStarted = () => {
    add_ui()
  }
  const onCoreStopped = () => {
    del_ui()
  }
  const onDispose = () => {
    del_ui()
  }
  const onReady = () => {
    add_ui()
  }
  return {
    onRun,
    onBeforeCoreStart,
    onCoreStarted,
    onCoreStopped,
    onDispose,
    onReady
  }
}
