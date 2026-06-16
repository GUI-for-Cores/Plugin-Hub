const DASHBOARD_URL = 'http://sing-box-dashboard.sagernet.org'
const FAVICON_URL = `${DASHBOARD_URL}/favicon.svg`
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
      secret: plugin.secret
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
    const form = getFormData()
    const modal = Plugins.modal(
      {
        title: 'sing-box Dashboard',
        width: '90',
        height: '90',
        footer: false,
        maskClosable: true,
        afterClose() {
          modal.destroy()
        }
      },
      {
        toolbar: () => [
          Vue.h(
            Vue.resolveComponent('Button'),
            {
              type: 'text',
              onClick: () => {
                void Plugins.ClipboardSetText(form.url)
              }
            },
            () => '复制 URL'
          ),
          Vue.h(
            Vue.resolveComponent('Button'),
            {
              type: 'text',
              onClick: () => {
                void Plugins.ClipboardSetText(form.secret)
              }
            },
            () => '复制密钥'
          ),
          Vue.h(
            Vue.resolveComponent('Button'),
            {
              type: 'text',
              onClick: () => {
                Plugins.BrowserOpenURL(DASHBOARD_URL)
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
            src: DASHBOARD_URL,
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
  const onRun = () => {
    if (!isAlphaCore()) {
      throw '请先切换为内测版核心'
    }
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
  const removeCustomAction = () => {
    appStore.removeCustomActions('core_state', plugin.id)
  }
  const onCoreStarted = () => {
    removeCustomAction()
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
                src: FAVICON_URL,
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
  const onCoreStopped = () => {
    removeCustomAction()
  }
  return {
    onRun,
    onBeforeCoreStart,
    onCoreStarted,
    onCoreStopped
  }
}
