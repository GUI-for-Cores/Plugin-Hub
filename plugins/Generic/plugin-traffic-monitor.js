/**
 * 本插件使用开源项目：https://github.com/zhongyang219/TrafficMonitor
 */

const PATH = 'data/third/traffic-monitor'
const BIN = PATH + '/TrafficMonitor.exe'
const PID = PATH + '/pid.txt'

/* 触发器 手动触发 */
const onRun = async () => {
  if (await isRunning()) {
    throw '插件已经在运行了'
  }
  await startService()
  return 1
}

/* 触发器 安装 */
const onInstall = async () => {
  const envStore = Plugins.useEnvStore()
  const { os, arch } = envStore.env
  if (os !== 'windows') {
    throw '此插件不支持非Windows系统'
  }

  let url
  if (arch === 'amd64') {
    url = 'https://github.com/zhongyang219/TrafficMonitor/releases/download/V1.85.1/TrafficMonitor_V1.85.1_x64_Lite.zip'
  } else if (arch === '386') {
    url = 'https://github.com/zhongyang219/TrafficMonitor/releases/download/V1.85.1/TrafficMonitor_V1.85.1_x86_Lite.zip'
  } else {
    url = 'https://github.com/zhongyang219/TrafficMonitor/releases/download/V1.85.1/TrafficMonitor_V1.85.1_arm64ec_Lite.zip'
  }

  const { update, destroy } = Plugins.message.info('正在下载...', 99999)

  const TMP_FILE = 'data/.cache/trafficmonitor.zip'
  try {
    await Plugins.Download(url, TMP_FILE, {}, (c, t) => {
      update('正在下载...' + ((c / t) * 100).toFixed(2) + '%')
    })
  } finally {
    destroy()
  }

  await Plugins.UnzipZIPFile(TMP_FILE, 'data/.cache')
  await Plugins.MoveFile('data/.cache/TrafficMonitor', PATH)
  await Plugins.RemoveFile(TMP_FILE)

  Plugins.message.success('安装成功')
  return 0
}

/* 触发器 卸载 */
const onUninstall = async () => {
  if (await isRunning()) {
    throw '请先停止插件'
  }
  await Plugins.RemoveFile(PATH)
  return 0
}

/* 触发器 启动APP时 */
const onStartup = async () => {
  if (Plugin.AutoStartup) {
    if (!(await isRunning())) {
      await startService()
      return 1
    }
  }
}

/* 触发器 关闭APP时 */
const onShutdown = async () => {
  if (Plugin.AutoStartup) {
    return await Stop()
  }
}

// 右键菜单 - 停止
const Stop = async () => {
  const pid = await isRunning()
  if (pid) {
    // 小小进程还挺难杀
    await Plugins.KillProcess(pid, 1).catch(() => false)
    await Plugins.RemoveFile(PID)
  }
  return 2
}

const startService = async () => {
  const pid = await Plugins.ExecBackground(
    BIN,
    [],
    (out) => {
      console.log(`[${Plugin.name}]`, out)
    },
    () => {
      console.log(`[${Plugin.name}]`, '已停止')
    }
  )
  await Plugins.WriteFile(PID, String(pid))
}

const isRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.ReadFile, PID)
  if (!pid || pid === '0') {
    return false
  }

  const name = await Plugins.ProcessInfo(Number(pid)).catch(() => 0)
  if (name !== 'TrafficMonitor.exe') {
    return false
  }

  return Number(pid)
}
