window[Plugin.id] = window[Plugin.id] || {}

const TMP_DIR = 'data/.cache'

class Logger {
  constructor() {
    this.coreType = Plugins.APP_TITLE.includes('SingBox') ? 'sing-box' : 'clash'
  }

  static getInstance() {
    if (!window[Plugin.id].logger) {
      window[Plugin.id].logger = new Logger()
    }
    return window[Plugin.id].logger
  }

  init() {
    this.maxLogCount = Number(Plugin.MaxRecords) || 1000
    this.logsBuffer = []
    this.cleanUp()
  }

  start() {
    this.registerLogsHandler()
    this.addComponent()
  }

  destroy() {
    if (this.logsBuffer?.length > 0) {
      this.logsBuffer.length = 0
    }
    this.cleanUp()
    window[Plugin.id].logger = null
  }

  cleanUp() {
    this.unregisterLogsHandler?.()
    this.unregisterLogsHandler = null

    this.removeComponent?.()
    this.removeComponent = null
  }

  handleNewLog(logData) {
    if (this.logsBuffer.length >= this.maxLogCount) {
      this.logsBuffer.shift()
    }

    this.logsBuffer.push({
      ...logData,
      time: Date.now()
    })
  }

  registerLogsHandler() {
    const kernelApi = Plugins.useKernelApiStore()
    this.unregisterLogsHandler = kernelApi.onLogs((logData) => this.handleNewLog(logData))
  }

  addComponent() {
    const appStore = Plugins.useAppStore()
    this.removeComponent = appStore.addCustomActions('core_state', {
      component: 'Button',
      componentProps: {
        type: 'link',
        size: 'small',
        onClick: () => this.exportLogsToFile()
      },
      componentSlots: {
        default: '⬇️ 导出日志'
      }
    })
  }

  async exportLogsToFile() {
    if (this.logsBuffer.length === 0) {
      return
    }
    const logTexts = this.logsBuffer.map((log) => `${Plugins.formatDate(log.time, 'YYYY-MM-DD HH:mm:ss')} ${log.type.toUpperCase()} ${log.payload}`).join('\n')
    const savedTime = Plugins.formatDate(Date.now(), 'YYYY-MM-DD_HH-mm-ss')
    const fileName = `${this.coreType}_${savedTime}.log`
    const filePath = await Plugins.AbsolutePath(`${TMP_DIR}/${fileName}`)

    await Plugins.WriteFile(filePath, logTexts.trim())

    Plugins.message.info(`日志已导出到 ${filePath}`)
  }
}

/* 触发器 核心启动后 */
const onCoreStarted = () => {
  const logger = Logger.getInstance()
  logger.init()
  logger.start()
}

/* 触发器 核心停止后 */
const onCoreStopped = () => {
  const logger = Logger.getInstance()
  logger.destroy()
}
