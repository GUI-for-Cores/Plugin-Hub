/**
 * 本插件使用项目：https://github.com/sub-store-org/Sub-Store
 */

const BackendUrl = 'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
const FrontendUrl = 'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip'
const SUBSTORE_PATH = 'data/third/sub-store'
const PID_FILE = SUBSTORE_PATH + '/sub-store.pid'
const SUB_STORE_FRONTEND_PATH = SUBSTORE_PATH + '/frontend'
const SUB_STORE_BACKEND_PATH = SUBSTORE_PATH + '/sub-store.bundle.js'

/**
 * 启动Sub-Store服务
 */
const startSubStoreService = () => {
  return new Promise(async (resolve, reject) => {
    const { env } = Plugins.useEnvStore()
    let backendFlag = false
    let timeout = true
    setTimeout(() => timeout && reject('启动Sub-Store服务超时'), 5000)
    try {
      const pid = await Plugins.ExecBackground(
        'node',
        [env.basePath + '/' + SUB_STORE_BACKEND_PATH],
        (out) => {
          if (out.includes('[sub-store] INFO: [BACKEND]')) {
            backendFlag = true
          }
          if (out.includes('[sub-store] INFO: [FRONTEND]') && backendFlag) {
            Plugins.Writefile(PID_FILE, pid.toString())
            timeout = false
            resolve()
          }
        },
        async () => {
          await Plugins.Writefile(PID_FILE, '0')
        },
        {
          env: {
            SUB_STORE_BACKEND_API_HOST: Plugin.SUB_STORE_BACKEND_API_HOST,
            SUB_STORE_FRONTEND_HOST: Plugin.SUB_STORE_FRONTEND_HOST,
            SUB_STORE_FRONTEND_API_PORT: Plugin.SUB_STORE_FRONTEND_API_PORT,
            SUB_STORE_BACKEND_API_PORT: Plugin.SUB_STORE_BACKEND_API_PORT,
            SUB_STORE_FRONTEND_PATH: env.basePath + '/' + SUB_STORE_FRONTEND_PATH,
            SUB_STORE_DATA_BASE_PATH: env.basePath + '/' + SUBSTORE_PATH
          }
        }
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 停止Sub-Store服务
 */
const stopSubStoreService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
  }
}

/**
 * 检测Sub-Store是否在运行
 */
const isSubStoreRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return ['node.exe', 'node'].includes(name)
  }
  return false
}

/**
 * 下载Sub-Store前端和后端文件
 */
const InstallSubStore = async () => {
  const { id } = Plugins.message.info('正在执行安装Sub-Store...', 999999)
  const tmpZip = 'data/.cache/sub-store.zip'
  const tmpDir = 'data/.cache/sub-store-frontend'
  try {
    Plugins.message.update(id, '正在下载前端资源')
    await Plugins.Download(FrontendUrl, tmpZip, {}, (c, t) => {
      Plugins.message.update(id, '正在下载前端资源...' + ((c / t) * 100).toFixed(2) + '%')
    })
    Plugins.message.update(id, '前端资源下载完成，正在解压...')
    await Plugins.sleep(1000)
    await Plugins.UnzipZIPFile(tmpZip, tmpDir)
    await Plugins.Makedir(SUBSTORE_PATH)
    await Plugins.Movefile(tmpDir + '/dist', SUB_STORE_FRONTEND_PATH)
    await Plugins.Removefile(tmpDir)
    await Plugins.Removefile(tmpZip)
    Plugins.message.update(id, '安装前端完成, 正在安装后端...')
    await Plugins.sleep(1000)
    await Plugins.Download(BackendUrl, SUB_STORE_BACKEND_PATH)
    Plugins.message.update(id, '安装后端完成', 'success')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await InstallSubStore()
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isSubStoreRunning()) {
    throw '请先停止Sub-Store服务！'
  }
  await Plugins.confirm('确定要删除Sub-Store吗？', '配置文件将不会保留！')
  await Plugins.Removefile(SUBSTORE_PATH)
  return 0
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isSubStoreRunning())) {
    if (!(await Plugins.ignoredError(Plugins.Exec, 'node', ['-v']))) {
      throw '检测到系统未安装Nodejs环境，请先安装。'
    }
    await startSubStoreService()
  }
  const url = 'http://127.0.0.1:' + Plugin.SUB_STORE_FRONTEND_API_PORT + '?api=http://127.0.0.1:' + Plugin.SUB_STORE_BACKEND_API_PORT
  Plugin.useInternalBrowser ? open(url) : Plugins.BrowserOpenURL(url)
  return 1
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isSubStoreRunning())) {
    await startSubStoreService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isSubStoreRunning())) {
    await stopSubStoreService()
    return 2
  }
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isSubStoreRunning()) {
    throw '当前服务已经在运行了'
  }
  if (!(await Plugins.ignoredError(Plugins.Exec, 'node', ['-v']))) {
    throw '检测到系统未安装Nodejs环境，请先安装。'
  }
  await startSubStoreService()
  Plugins.message.success('✨Sub-Store 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isSubStoreRunning())) {
    throw '当前服务并未在运行'
  }
  await stopSubStoreService()
  Plugins.message.success('停止Sub-Store成功')
  return 2
}
