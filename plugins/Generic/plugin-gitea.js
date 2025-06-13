/**
 * 本插件用于安装、配置和管理 Gitea 服务
 * 本插件使用项目：https://github.com/go-gitea/gitea
 * 本插件参考项目：https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-alist.js
 */

// 统一路径钩子
function useGiteaPaths() {
  const GITEA_VERSION = "1.24.0"
  const GITEA_PATH = "data/third/gitea"
  const PID_FILE = `${GITEA_PATH}/gitea.pid`
  const CONFIG_FILE = `${GITEA_PATH}/custom/conf/app.ini`
  const { env } = Plugins.useEnvStore()
  const { url, fileName, binName } = getGiteaDownloadInfo(GITEA_VERSION, env)
  const BIN_FILE = `${GITEA_PATH}/${fileName}`
  const TMP_FILE = `data/.cache/${fileName}`

  return {
    GITEA_VERSION,
    GITEA_PATH,
    PID_FILE,
    CONFIG_FILE,
    BIN_FILE,
    TMP_FILE,
    binName,
    fileName,
    env,
    url
  }
}

const getGiteaDownloadInfo = (version, env) => {
  let os = env.os
  let arch = env.arch
  let fileName = ''
  let binName = 'gitea'
  if (os === 'windows') {
    binName += '.exe'
    arch = arch === 'x64' ? 'amd64' : arch
    fileName = `gitea-${version}-windows-4.0-${arch}.exe`
  } else if (os === 'darwin') {
    fileName = `gitea-${version}-darwin-10.12-${arch}`
  } else if (os === 'linux') {
    fileName = `gitea-${version}-linux-${arch}`
  } else {
    throw new Error('暂不支持该平台')
  }
  const url = `https://github.com/go-gitea/gitea/releases/download/v${version}/${fileName}`
  return {
    url,
    binName,
    fileName
  }
}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  const { BIN_FILE } = useGiteaPaths()
  await installGitea()
  if (!(await Plugins.FileExists(BIN_FILE))) {
    throw `Gitea 文件未能成功安装在 ${BIN_FILE}`
  }
  Plugins.message.success("Gitea 安装成功！")
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isGiteaRunning()) {
    throw "请先停止 Gitea 服务！"
  }
  await Plugins.confirm("确定要删除 Gitea 吗？", "配置文件将不会保留")
  await uninstallGitea()
  return 0
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isGiteaRunning())) {
    await startGiteaService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isGiteaRunning())) {
    await stopGiteaService()
    return 2
  }
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isGiteaRunning())) {
    await startGiteaService()
  }
  const port = await readGiteaConfigPort()
  Plugins.BrowserOpenURL(`http://127.0.0.1:${port}`)
  return 1
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isGiteaRunning()) {
    throw "当前服务已经在运行了"
  }
  await startGiteaService()
  Plugins.message.success("✨ Gitea 启动成功!")
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isGiteaRunning())) {
    throw "当前服务并未在运行"
  }
  await stopGiteaService()
  Plugins.message.success("停止 Gitea 成功")
  return 2
}

/**
 * 插件菜单项 - 配置文件
 */
const Config = async () => {
  const { CONFIG_FILE } = useGiteaPaths()
  Plugins.BrowserOpenURL(await Plugins.AbsolutePath(CONFIG_FILE))
}

/**
 * 从 gitea.ini 文件中读取端口配置
 */
const readGiteaConfigPort = async () => {
  const { CONFIG_FILE } = useGiteaPaths()
  if (!(await Plugins.FileExists(CONFIG_FILE))) {
    return 3000
  }
  const configContent = await Plugins.Readfile(CONFIG_FILE)
  const portMatch = configContent.match(/^HTTP_PORT\s*=\s*(\d+)/m)
  if (portMatch && portMatch[1]) {
    return portMatch[1]
  }
  const listenPortMatch = configContent.match(/^HTTP_LISTEN_PORT\s*=\s*(\d+)/m)
  if (listenPortMatch && listenPortMatch[1]) {
    return listenPortMatch[1]
  }
  return 3000
}

/**
 * 检测 Gitea 是否在运行
 */
const isGiteaRunning = async () => {
  const { PID_FILE, fileName } = useGiteaPaths()
  try {
    const port = await readGiteaConfigPort()
    if (!port) {
      throw new Error("无法从 gitea.ini 中读取端口")
    }
    const response = await Plugins.HttpGet(`http://127.0.0.1:${port}`)
    if (response.status === 200) {
      return true
    }
    const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
    if (pid && pid !== "0") {
      const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
      if ([fileName, "gitea", "gitea.exe"].includes(name)) {
        return true
      }
    }
    return false
  } catch (e) {
    console.error("检测 Gitea 是否运行失败:", e)
    return false
  }
}

/**
 * 停止 Gitea 服务
 */
const stopGiteaService = async () => {
  const { PID_FILE, fileName } = useGiteaPaths()
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== "0") {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    if (name && [fileName, "gitea", "gitea.exe"].includes(name)) {
      await Plugins.KillProcess(Number(pid))
      await Plugins.Writefile(PID_FILE, "0")
      Plugins.message.success("Gitea 服务已成功停止！")
    } else {
      throw "找不到运行中的 Gitea 进程"
    }
  } else {
    throw "当前没有运行的 Gitea 服务"
  }
}

/**
 * 启动 Gitea 服务
 */
const startGiteaService = () => {
  const { BIN_FILE, CONFIG_FILE, PID_FILE } = useGiteaPaths()
  return new Promise(async (resolve, reject) => {
    let runArgs = ["web"]
    const absConfigPath = await Plugins.AbsolutePath(CONFIG_FILE)
    if (await Plugins.FileExists(BIN_FILE)) {
      runArgs = ["web", "--config", absConfigPath]
    }
    try {
      const pid = await Plugins.ExecBackground(
        BIN_FILE, runArgs,
        async (out) => {
          if (out.includes("Starting new Web server")) {
            await Plugins.Writefile(PID_FILE, String(pid))
            resolve()
          }
        },
        (error) => {
          console.error("启动 Gitea 失败:", error)
          Plugins.Writefile(PID_FILE, "0")
          reject(error)
        }
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 安装 Gitea
 */
const installGitea = async () => {
  const { BIN_FILE, TMP_FILE, GITEA_PATH, env, url } = useGiteaPaths()
  const { id } = Plugins.message.info("下载 Gitea 安装包...", 999999999)
  try {
    await Plugins.Makedir(GITEA_PATH)
    await Plugins.Download(
      url,
      TMP_FILE,
      {},
      (progress, total) => {
        Plugins.message.update(
          id,
          `下载 Gitea 安装包：${((progress / total) * 100).toFixed(2)}%`
        )
      }
    )
    if (!(await Plugins.FileExists(TMP_FILE))) {
      throw "Gitea 安装包下载失败！"
    }
    await Plugins.Movefile(TMP_FILE, BIN_FILE)
    if (!(await Plugins.FileExists(BIN_FILE))) {
      throw `无法移动文件到目标路径: ${BIN_FILE}`
    }
    await Plugins.Removefile(TMP_FILE)
    if (env.os !== 'windows') {
      const absPath = await Plugins.AbsolutePath(BIN_FILE)
      await Plugins.Exec('chmod', ['+x', absPath])
    }
    Plugins.message.update(id, "Gitea 安装包下载完成", "success")
    Plugins.message.info("Gitea 安装成功！")
  } catch (error) {
    Plugins.message.error(`Gitea 安装失败: ${error.message || error}`)
    console.error("Gitea 安装失败:", error)
    throw error
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/**
 * 卸载 Gitea
 */
const uninstallGitea = async () => {
  const { GITEA_PATH } = useGiteaPaths()
  const absPath = await Plugins.AbsolutePath(GITEA_PATH)
  await Plugins.Removefile(absPath)
}