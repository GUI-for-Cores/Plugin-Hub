/**
 * 本插件用于安装、配置和管理 Gitea 服务
 * 本插件使用项目：https://github.com/go-gitea/gitea
 * 本插件参考项目：https://github.com/GUI-for-Cores/Plugin-Hub/blob/main/plugins/Generic/plugin-alist.js
 */

const GITEA_VERSION = "1.24.0"
const GITEA_PATH = "data/third/gitea"
const PID_FILE = GITEA_PATH + "/gitea.pid"
const BIN_FILE = GITEA_PATH + `/gitea-${GITEA_VERSION}-windows-4.0-amd64.exe`
const LOCAL_BIN_FILE = GITEA_PATH + `/gitea.exe`
const CONFIG_FILE = GITEA_PATH + "/gitea.ini"
const DATA_PATH = GITEA_PATH + "/data"

const { env } = Plugins.useEnvStore()

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installGitea()
  if (!(await Plugins.FileExist(BIN_FILE))) {
    throw `Gitea 文件未能成功安装在 ${BIN_FILE}`
  }

  const res = await Plugins.Exec(BIN_FILE, ["web"])
  await Plugins.message.success("Gitea 安装并启动成功！")
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
  Plugins.BrowserOpenURL(`http://127.0.0.1:${port}`) // 动态使用配置中的端口
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
  Plugins.BrowserOpenURL(await Plugins.AbsolutePath(CONFIG_FILE))
}

/**
 * 从 gitea.ini 文件中读取端口配置
 */
const readGiteaConfigPort = async () => {
  const configContent = await Plugins.Readfile(CONFIG_FILE)
  const portMatch = configContent.match(/^HTTP_PORT\s*=\s*(\d+)/m)
  if (portMatch && portMatch[1]) {
    return portMatch[1] // 返回配置中的 HTTP_PORT
  }
  // 如果没有找到 HTTP_PORT，尝试读取 HTTP_LISTEN_PORT
  const listenPortMatch = configContent.match(/^HTTP_LISTEN_PORT\s*=\s*(\d+)/m)
  if (listenPortMatch && listenPortMatch[1]) {
    return listenPortMatch[1] // 返回配置中的 HTTP_LISTEN_PORT
  }
  return null // 如果没有找到端口，返回 null
}

/**
 * 检测 Gitea 是否在运行
 */
const isGiteaRunning = async () => {
  try {
    const port = await readGiteaConfigPort()
    if (!port) {
      throw new Error("无法从 gitea.ini 中读取端口")
    }

    // 1. 检查 HTTP 服务是否响应，使用动态端口
    const response = await Plugins.HttpGet(`http://127.0.0.1:${port}`)
    if (response.status === 200) {
      return true
    }

    // 2. 检查 PID 文件中进程是否存在
    const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
    if (pid && pid !== "0") {
      const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
      if (["gitea", "gitea.exe"].includes(name)) {
        return true // 如果是 Gitea 进程
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
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== "0") {
    // 1. 确保 PID 文件中的进程存在
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    if (name && ["gitea", "gitea.exe"].includes(name)) {
      // 2. 如果进程存在，杀死进程
      await Plugins.KillProcess(Number(pid))
      await Plugins.Writefile(PID_FILE, "0") // 清空 PID 文件
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
  return new Promise(async (resolve, reject) => {
    try {
      const pid = await Plugins.ExecBackground(
        LOCAL_BIN_FILE,
        ["web", "--config", CONFIG_FILE], // 显式指定配置文件路径
        async (out) => {
          if (out.includes("Starting new Web server")) {
            await Plugins.Writefile(PID_FILE, String(pid)) // 保存 PID
            resolve()
          }
        },
        (error) => {
          console.error("启动 Gitea 失败:", error)
          Plugins.Writefile(PID_FILE, "0") // 发生错误时，确保 PID 文件恢复为 "0"
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
  const tmp_file = "data/.cache/gitea.exe"
  const { id } = Plugins.message.info("下载 Gitea 安装包...", 999999999)

  try {
    await Plugins.Makedir(GITEA_PATH) // 确保目标目录存在

    // 下载 Gitea 安装包
    await Plugins.Download(
      `https://github.com/go-gitea/gitea/releases/download/v${GITEA_VERSION}/gitea-${GITEA_VERSION}-windows-4.0-amd64.exe`,
      tmp_file,
      {},
      (progress, total) => {
        Plugins.message.update(
          id,
          `下载 Gitea 安装包：${((progress / total) * 100).toFixed(2)}%`
        )
      }
    )

    // 确保下载成功
    if (!(await Plugins.FileExist(tmp_file))) {
      throw "Gitea 安装包下载失败！"
    }

    // 移动到目标目录
    await Plugins.Movefile(tmp_file, BIN_FILE)

    if (!(await Plugins.FileExist(BIN_FILE))) {
      throw `无法移动文件到目标路径: ${BIN_FILE}`
    }

    Plugins.message.update(id, "Gitea 安装包下载完成", "success")

    // 创建配置文件
    await createDefaultGiteaConfig()

    Plugins.message.info("Gitea 安装成功！")
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/**
 * 创建默认的 Gitea 配置文件
 */
const createDefaultGiteaConfig = async () => {
  const configContent = `
[server]
HTTP_PORT = 3000
ROOT_URL = http://127.0.0.1:3000
`
  await Plugins.Makedir(GITEA_PATH)
  await Plugins.Writefile(CONFIG_FILE, configContent)
}

/**
 * 卸载 Gitea
 */
const uninstallGitea = async () => {
  await Plugins.Removefile(GITEA_PATH)
}
