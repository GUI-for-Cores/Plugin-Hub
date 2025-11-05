// 确保插件的全局命名空间已初始化
window[Plugin.id] = window[Plugin.id] || {}

const SINGBOX_LOG_FILE_PATH = 'data/sing-box/sing-box.log'
const CLASH_LOG_FILE_PATH = 'data/mihomo/clash.log'

/* 切换日志记录的开启/关闭状态 */
const toggleRecording = () => {
  if (window[Plugin.id].state === 'logging') {
    stopRecording()
  } else {
    startRecording()
  }
}

/* 刷新并更新自定义按钮组件 */
const refreshComponent = () => {
  const appStore = Plugins.useAppStore()
  window[Plugin.id].remove?.()
  window[Plugin.id].remove = appStore.addCustomActions('core_state', {
    component: 'Button',
    componentProps: {
      type: 'link',
      size: 'small',
      onClick: toggleRecording
    },
    componentSlots: {
      default: window[Plugin.id].state === 'logging' ? '🔴 日志记录中' : '🟢 开始记录'
    }
  })
}

/* 启动日志记录 */
const startRecording = () => {
  const kernelApi = Plugins.useKernelApiStore()
  if (window[Plugin.id].state === 'logging') {
    return
  }
  window[Plugin.id].state = 'logging'
  window[Plugin.id].logsBuffer = []
  refreshComponent()
  // @ts-ignore
  window[Plugin.id].unregisterLogsHandler = kernelApi.onLogs((logData) => handleNewLog(logData))
  Plugins.message.info('日志持续记录中')
}

/* 停止日志记录 */
const stopRecording = (isShutdown = false) => {
  if (window[Plugin.id].state === 'stop' && !isShutdown) {
    return
  }
  window[Plugin.id].unregisterLogsHandler?.()
  writeLogsToFile('append')
  if (!isShutdown) {
    window[Plugin.id].state = 'stop'
    refreshComponent()
    Plugins.message.info('已手动停止记录，追加写入日志')
  }
}

/* 处理接收到的新日志数据 */
const handleNewLog = (logData) => {
  const maxRecords = Number(Plugin.MaxRecords) || 1000
  window[Plugin.id].logsBuffer.push({
    ...logData,
    time: Date.now()
  })
  if (window[Plugin.id].logsBuffer.length >= maxRecords) {
    writeLogsToFile('overwrite')
    Plugins.message.info('达到最大记录条数，写入新的日志')
  }
}

/* 将缓冲区中的日志数据写入到文件 */
const writeLogsToFile = async (mode) => {
  if (window[Plugin.id].logsBuffer.length === 0) {
    return
  }
  const logsToWrite = [...window[Plugin.id].logsBuffer]
  window[Plugin.id].logsBuffer = []
  const logTexts = logsToWrite.map((log) => `${Plugins.formatDate(log.time, 'YYYY-MM-DD HH:mm:ss')} ${log.type.toUpperCase()} ${log.payload}`).join('\n')
  const filePath = Plugins.APP_TITLE.includes('SingBox') ? SINGBOX_LOG_FILE_PATH : CLASH_LOG_FILE_PATH
  let contentToWrite = logTexts
  if (mode === 'append') {
    let existingContent = ''
    if (await Plugins.FileExists(filePath)) {
      existingContent = await Plugins.ReadFile(filePath)
    }
    if (existingContent) {
      contentToWrite = `${existingContent}\n${logTexts}`
    }
  }
  await Plugins.WriteFile(filePath, contentToWrite.trim())
}

/* 销毁日志记录器，清理资源 */
const destroyLogRecorder = () => {
  window[Plugin.id].remove?.()
  stopRecording(true)
  window[Plugin.id].logsBuffer = []
  window[Plugin.id].state = 'stop'
}

/* 触发器 核心启动后 */
const onCoreStarted = async () => {
  startRecording()
}

/* 触发器 核心停止后 */
const onCoreStopped = async () => {
  destroyLogRecorder()
}
