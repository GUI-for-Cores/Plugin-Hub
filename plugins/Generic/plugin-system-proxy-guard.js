/**
 * 不采用计划任务，而是浏览器的interval来执行，因为够简单
 */

// 存储变量状态
window[Plugin.id] = window[Plugin.id] || {}

/* Trigger on::manual */
const onRun = async () => {
  startProxyGuard()
  Plugins.message.success('系统代理守卫启动成功')
  return 1
}

/* Trigger on::ready */
const onReady = async () => {
  const isRunning = Plugin.status === 1
  if (isRunning) {
    setTimeout(startProxyGuard, 3000)
  }

  const appStore = Plugins.useAppStore()
  appStore.addCustomActions('core_state', {
    component: 'Switch',
    componentSlots: {
      default: '代理守卫'
    },
    componentProps: {
      modelValue: isRunning,
      onChange: async (val) => {
        ;(!val ? onRun() : Stop()).catch((err) => Plugins.message.error(err))
      }
    }
  })
}

const Stop = async () => {
  clearInterval(window[Plugin.id].interval)
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
  window[Plugin.id].interval = Plugins.setIntervalImmediately(
    () => {
      const appSettings = Plugins.useAppSettingsStore()
      if (!appSettings.app.kernel.running) return

      const kernelApiStore = Plugins.useKernelApiStore()
      if (kernelApiStore.config.tun.enable) return

      const envStore = Plugins.useEnvStore()
      const flag = !envStore.systemProxy
      envStore
        .setSystemProxy()
        .catch(Plugins.message.error)
        .then(() => {
          if (flag) {
            Plugins.message.success(`[${Plugin.name}]: 守卫成功`)
          }
        })
    },
    (interval || Plugin.Interval) * 1000
  )
}
