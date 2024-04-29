/**
 * 本插件使用项目：https://github.com/fatedier/frp
 */

const FRP_PATH = 'data/third/frpc'
const PROCESS_NAME = 'frpc.exe'
const FRP_FILE = FRP_PATH + '/' + PROCESS_NAME
const PID_FILE = FRP_PATH + '/frpc.pid'

/**
 * 检测FRP是否在运行
 */
const isFRPRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return name === PROCESS_NAME
  }
  return false
}

/**
 * 停止FRP服务
 */
const stopFRPService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
  }
}

/**
 * 启动FRP服务
 */
const startFRPService = async () => {
  const config = await Plugins.AbsolutePath(FRP_PATH + '/frpc.toml')
  await Plugins.Writefile(config, Plugin.Config)
  return new Promise(async (resolve, reject) => {
    try {
      const pid = await Plugins.ExecBackground(
        FRP_FILE,
        ['-c', config],
        async (out) => {
          if (out.includes('login to server success')) {
            await Plugins.Writefile(PID_FILE, pid.toString())
            resolve()
          } else if (out.includes('login to the server failed')) {
            reject(out)
          }
        },
        async () => {
          await Plugins.Writefile(PID_FILE, '0')
        }
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 安装FRP
 */
const installFRP = async () => {
  const { env } = Plugins.useEnvStore()
  const tmpZip = 'data/.cache/frpc.zip'
  const tmpDir = `data/.cache/frp_0.56.0_windows_${env.arch}`
  const url = `https://github.com/fatedier/frp/releases/download/v0.56.0/frp_0.56.0_windows_${env.arch}.zip`
  const { id } = Plugins.message.info('下载FRP压缩包...', 9999999)
  try {
    await Plugins.Download(url, tmpZip, {}, (progress, total) => {
      Plugins.message.update(id, '下载FRP压缩包...' + ((progress / total) * 100).toFixed(2) + '%')
    })
    await Plugins.UnzipZIPFile(tmpZip, 'data/.cache')
    await Plugins.Makedir(FRP_PATH)
    await Plugins.Movefile(tmpDir + '/frpc.exe', FRP_FILE)
    await Plugins.Removefile(tmpZip)
    await Plugins.Removefile(tmpDir)
    Plugins.message.update(id, '安装FRP完成', 'success')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/* 卸载FRP */
const uninstallFRP = async () => {
  await Plugins.Removefile(FRP_PATH)
}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installFRP()
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isFRPRunning()) {
    throw '请先停止运行FRP服务！'
  }
  await Plugins.confirm('提示', `确定卸载frp吗，将删除: ${FRP_PATH}`)
  await uninstallFRP()
  return 0
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isFRPRunning())) {
    await startFRPService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isFRPRunning())) {
    await stopFRPService()
    return 2
  }
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (await isFRPRunning()) {
    throw '当前服务已经在运行了'
  }
  await startFRPService()
  Plugins.message.success('✨FRP 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isFRPRunning()) {
    throw '当前服务已经在运行了'
  }
  await startFRPService()
  Plugins.message.success('✨FRP 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isFRPRunning())) {
    throw '当前服务并未在运行'
  }
  await stopFRPService()
  Plugins.message.success('停止FRP成功')
  return 2
}
