window[Plugin.id] = window[Plugin.id] || {}

const SINGBOX_LOG_FILE_PATH = 'data/sing-box/sing-box.log'
const CLASH_LOG_FILE_PATH = 'data/mihomo/clash.log'

/* 触发器 核心启动后 */
const onCoreStarted = async () => {
  window[Plugin.id].state = 'stop'
  await reloadRecordComponent()
}

/* 触发器 核心停止后 */
const onCoreStopped = async () => {
  window[Plugin.id].remove?.()
  if (window[Plugin.id].state === 'recording') {
    await stopRecordLogs()
  }
}

const reloadRecordComponent = async () => {
  const appStore = Plugins.useAppStore()
  window[Plugin.id].remove?.()
  window[Plugin.id].remove = appStore.addCustomActions('core_state', {
    component: 'Button',
    componentProps: {
      type: 'link',
      size: 'small',
      onClick: async () => {
        if (window[Plugin.id].state === 'stop') {
          await startRecordLogs()
        } else {
          await stopRecordLogs()
        }
      }
    },
    componentSlots: {
      default: window[Plugin.id].state === 'stop' ? `🟢 开始记录` : `🔴 停止记录 ${window[Plugin.id].logCount > 0 ? `(${window[Plugin.id].logCount}s)` : ''}`
    }
  })
}

const startRecordLogs = async () => {
  const kernelApi = Plugins.useKernelApiStore()
  window[Plugin.id].state = 'recording'
  await reloadRecordComponent()
  let logStartTime = Date.now()
  let logs = []
  window[Plugin.id].logCount = 0
  window[Plugin.id].unregisterLogsHandler = kernelApi.onLogs(async (data) => {
    const currentTime = Date.now()
    data.time = currentTime
    logs.push(data)
    await writeLogFile(logs)
    if (window[Plugin.id].logCount >= Number(Plugin.RecordTime)) {
      await stopRecordLogs()
    }
    if (currentTime - logStartTime >= 1000) {
      window[Plugin.id].logCount++
      logStartTime = currentTime
      await reloadRecordComponent()
    }
  })
}

const stopRecordLogs = async () => {
  window[Plugin.id].state = 'stop'
  await reloadRecordComponent()
  if (window[Plugin.id].logCount >= Number(Plugin.RecordTime)) {
    Plugins.message.info(`停止记录：超出最大记录时长 ${Plugin.RecordTime} 秒`)
  }
  window[Plugin.id].logCount = 0
  window[Plugin.id].unregisterLogsHandler()
}

const writeLogFile = async (logs) => {
  const logTexts = logs
    .map((log) => `${formatTime(log.time)} ${log.type.toUpperCase()} ${log.payload}`)
    .join(`\n`)
    .trim()
  if (Plugins.APP_TITLE.includes('SingBox')) {
    await Plugins.Writefile(SINGBOX_LOG_FILE_PATH, logTexts)
  } else {
    await Plugins.Writefile(CLASH_LOG_FILE_PATH, logTexts)
  }
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const hour = String(date.getUTCHours() + 8).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  const second = String(date.getUTCSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}
