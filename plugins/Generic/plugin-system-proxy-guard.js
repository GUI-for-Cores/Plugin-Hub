// 存储变量状态
window[Plugin.id] = window[Plugin.id] || {}

/* Trigger on::manual */
const onRun = async () => {
  startProxyGuard()
  updateWidget(true)
  return 1
}

/* Trigger on::ready */
const onReady = async () => {
  if (Plugin.status === 1) {
    setTimeout(startProxyGuard, 3000)
  }
  updateWidget(Plugin.status === 1)
}

const updateWidget = (value) => {
  const appStore = Plugins.useAppStore()
  window[Plugin.id].delWidget?.()
  window[Plugin.id].delWidget = appStore.addCustomActions('core_state', {
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
          clearInterval(window[Plugin.id].interval)
          Plugin.status = 2
        }
      }
    }
  })
}

const Stop = async () => {
  clearInterval(window[Plugin.id].interval)
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
  if (window[Plugin.id].interval && config.Interval !== old.Interval) {
    startProxyGuard(config.Interval)
  }
}

const startProxyGuard = (interval) => {
  clearInterval(window[Plugin.id].interval)
  const envStore = Plugins.useEnvStore()
  const kernelApiStore = Plugins.useKernelApiStore()

  window[Plugin.id].interval = Plugins.setIntervalImmediately(
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
        Plugins.message.success(`[${Plugin.name}]: 守卫成功`)
      } catch (error) {
        Plugins.message.error(error.message || error)
      }
    },
    (interval || Plugin.Interval) * 1000
  )
}
