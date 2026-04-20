const TMP_DIR = 'data/.cache'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const logLimit = Number(Plugin.MaxRecords) || 1000
  const logger = new Logger(logLimit)

  return {
    onCoreStarted: () => {
      logger.start()
    },
    onCoreStopped: () => {
      logger.destroy()
    }
  }
}

class Logger {
  core = Plugins.APP_TITLE.includes('SingBox') ? 'sing-box' : 'mihomo'
  logsBuffer = []
  unregisterLogsHandle
  removeComponent

  constructor(logLimit) {
    this.logLimit = logLimit
  }

  start() {
    this.destroy()
    this.registerLogsHandler()
    this.addComponent()
  }

  destroy() {
    this.logsBuffer.length = 0

    this.unregisterLogsHandler?.()
    this.unregisterLogsHandler = null

    this.removeComponent?.()
    this.removeComponent = null
  }

  handleNewLog(logData) {
    if (this.logsBuffer.length >= this.logLimit) {
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
    const fileName = `${this.core}_${savedTime}.log`
    const filePath = await Plugins.AbsolutePath(`${TMP_DIR}/${fileName}`)

    await Plugins.WriteFile(filePath, logTexts.trim())

    Plugins.message.info(`日志已导出到 ${filePath}`)
  }
}
