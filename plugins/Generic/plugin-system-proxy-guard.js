/** @type {EsmPlugin} */
export default (Plugin) => {
  let timer
  const ui_id = Plugin.id + '_ui'

  const appStore = Plugins.useAppStore()
  const envStore = Plugins.useEnvStore()
  const kernelApiStore = Plugins.useKernelApiStore()

  const updateWidget = (value) => {
    appStore.removeCustomActions('core_state', [ui_id])
    appStore.addCustomActions('core_state', {
      id: ui_id,
      component: 'Switch',
      componentSlots: {
        default: '代理守卫'
      },
      componentProps: {
        size: 'small',
        border: 'square',
        modelValue: value,
        onChange: async (val) => {
          if (val) {
            startProxyGuard()
            Plugin.status = 1
          } else {
            stopProxyGuard()
            Plugin.status = 2
          }
        }
      }
    })
  }

  const del_ui = () => {
    appStore.removeCustomActions('core_state', [ui_id])
  }

  const onRun = async () => {
    startProxyGuard()
    updateWidget(true)
    return 1
  }

  const onReady = async () => {
    if (Plugin.status === 1) {
      setTimeout(startProxyGuard, 3000)
    }
    updateWidget(Plugin.status === 1)
  }

  const Stop = async () => {
    stopProxyGuard()
    updateWidget(false)
    return 2
  }

  /* Trigger on::configure */
  const onConfigure = async (config, old) => {
    if (config.Interval < 10) {
      throw '间隔时间不能小于10秒'
    }
    if (config.Interval > 60) {
      throw '间隔时间不能大于60秒'
    }
    if (timer && config.Interval !== old.Interval) {
      startProxyGuard(config.Interval)
    }
  }

  const startProxyGuard = (interval) => {
    clearInterval(timer)

    console.log(`[${Plugin.name}]`, '守卫已启动')

    timer = Plugins.setIntervalImmediately(
      async () => {
        if (!kernelApiStore.running) {
          // console.log(`[${Plugin.name}]`, '核心不在运行')
          return
        }
        await envStore.updateSystemProxyStatus()
        if (envStore.systemProxy) {
          // console.log(`[${Plugin.name}]`, '代理已配置')
          return
        }
        try {
          await envStore.setSystemProxy()
          console.log(`[${Plugin.name}]`, '守卫成功')
          Plugins.message.success(`[${Plugin.name}]: 守卫成功`)
        } catch (error) {
          Plugins.message.error(error.message || error)
        }
      },
      (interval || Plugin.Interval) * 1000
    )
  }

  const stopProxyGuard = () => {
    clearInterval(timer)
    console.log(`[${Plugin.name}]`, '守卫已停止')
  }

  const onDispose = () => {
    stopProxyGuard()
    del_ui()
  }

  return { onRun, onReady, Stop, onConfigure, onDispose }
}
