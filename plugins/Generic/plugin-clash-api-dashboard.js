window[Plugin.id] = window[Plugin.id] || {}

const Dashboard = {
  Yacd: {
    Link: 'http://yacd.metacubex.one',
    Icon: 'https://raw.githubusercontent.com/haishanh/yacd/refs/heads/master/assets/yacd.ico'
  },
  Zashboard: {
    Link: 'http://board.zash.run.place/#/setup',
    Icon: 'https://raw.githubusercontent.com/Zephyruso/zashboard/refs/heads/main/public/icon.svg'
  },
  MetaCubeXD: {
    Link: 'http://metacubex.github.io/metacubexd/#/setup',
    Icon: 'https://raw.githubusercontent.com/MetaCubeX/metacubexd/refs/heads/main/public/favicon.svg'
  }
}

/* 创建仪表板链接 */
const generateDashboardUrl = (dashboardName) => {
  const { port, secret } = getClashApiConfig()
  const dashboardLink = Dashboard[dashboardName]?.Link
  return `${dashboardLink}?hostname=127.0.0.1&port=${port}${secret ? `&secret=${secret}` : ''}&http=1`
}

/* 获取 Clash API 配置 */
const getClashApiConfig = () => {
  const appSettingsStore = Plugins.useAppSettingsStore()
  const profilesStore = Plugins.useProfilesStore()
  const profile = profilesStore.getProfileById(appSettingsStore.app.kernel.profile)
  let port = 20123
  let secret = ''
  if (Plugins.APP_TITLE.includes('SingBox')) {
    const controller = profile.experimental.clash_api.external_controller || '127.0.0.1:20123'
    port = controller.split(':')[1]
    secret = profile.experimental.clash_api.secret || ''
  } else {
    const controller = profile.advancedConfig['external-controller'] || '127.0.0.1:20113'
    port = controller.split(':')[1]
    secret = profile.advancedConfig.secret || ''
  }
  return { port, secret }
}

/* 加载 WebUI 组件 */
const loadWebUIComponent = (dashboardName) => {
  window[Plugin.id].removeWebUI?.()
  const appStore = Plugins.useAppStore()
  window[Plugin.id].removeWebUI = appStore.addCustomActions('core_state', {
    component: 'div',
    componentSlots: {
      default: ({ h }) => {
        return h(
          'Button',
          {
            type: 'link',
            size: 'small',
            onClick: () => openWebUI(dashboardName)
          },
          () => [
            h('img', {
              src: Dashboard[dashboardName]?.Icon,
              width: '16px',
              height: '16px',
              style: {
                borderRadius: '4px',
                marginRight: '4px'
              }
            }),
            dashboardName
          ]
        )
      }
    }
  })
}

/* 获取 Clash 模式 */
const getClashModeList = () => {
  const { config } = Plugins.useKernelApiStore()
  return { currentMode: config.mode, modeList: config['mode-list'] }
}

const capitalizeFirstLetter = (string) => {
  if (!string) return ''
  return string.charAt(0).toUpperCase() + string.slice(1)
}

/* 加载 Clash Mode 组件 */
const loadClashModeComponent = () => {
  window[Plugin.id].removeClashMode?.()
  const appStore = Plugins.useAppStore()

  window[Plugin.id].removeClashMode = appStore.addCustomActions('core_state', [
    {
      component: 'Dropdown',
      componentProps: {
        trigger: ['hover']
      },
      componentSlots: {
        default: ({ h }) => {
          return h(
            'Button',
            {
              type: 'link',
              icon: 'more',
              size: 'small'
            },
            () => capitalizeFirstLetter(getClashModeList().currentMode)
          )
        },
        overlay: ({ h }) => {
          return h(
            'div',
            { class: 'flex flex-col gap-4 min-w-64 p-4' },
            getClashModeList().modeList.map((mode) =>
              h(
                'Button',
                {
                  type: 'link',
                  size: 'small',
                  onClick: () => Plugins.handleChangeMode(mode)
                },
                () => capitalizeFirstLetter(mode)
              )
            )
          )
        }
      }
    }
  ])
}

/* 添加到概览页 */
const addToCoreStatePanel = () => {
  loadWebUIComponent(Plugin.DashboardName)
  if (Plugin.ClashModeAction) {
    loadClashModeComponent()
  }
}

/* 从概览页移除 */
const removeFromCoreStatePanel = () => {
  window[Plugin.id].removeWebUI?.()
  window[Plugin.id].removeClashMode?.()
}

const openWebUI = (dashboardName) => {
  const src = generateDashboardUrl(dashboardName)
  const modal = Plugins.modal(
    {
      title: dashboardName,
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
              Plugins.BrowserOpenURL(src)
            }
          },
          () => '浏览器中打开'
        ),
        Vue.h(Vue.resolveComponent('Button'), {
          type: 'text',
          icon: 'close',
          onClick: () => modal.destroy()
        })
      ],
      default: () =>
        Vue.h('iframe', {
          src: src,
          class: 'w-full h-full border-0',
          style: {
            height: 'calc(100% - 6px)'
          }
        })
    }
  )
  modal.open()
}

/* 触发器 手动触发 */
const onRun = () => {
  const kernelApiStore = Plugins.useKernelApiStore()
  if (!kernelApiStore.running) {
    throw '请先启动内核'
  }
  openWebUI(Plugin.DashboardName)
}

/* 触发器 核心启动后 */
const onCoreStarted = () => {
  addToCoreStatePanel()
}

/* 触发器 核心停止后 */
const onCoreStopped = () => {
  removeFromCoreStatePanel()
}
