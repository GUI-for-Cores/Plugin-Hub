const PATH = 'data/third/file-server'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const absPathCache = {}

  const parsePort = () => {
    const [_, port] = Plugin.Address.split(':')
    return port
  }

  const onRun = async () => {
    await StopServer().catch(() => {})
    await startService()
    Plugins.message.success('服务启动成功')
    return 1
  }

  const onDispose = async () => {
    await StopServer().catch(() => {})
    return 2
  }

  const onReady = async () => {
    await StopServer().catch(() => {})
    await startService()
    return 1
  }

  const onShutdown = async () => {
    await StopServer().catch(() => {})
    return 2
  }

  const onInstall = async () => {
    await Plugins.Download(
      'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-file-server/index.html',
      PATH + '/index.html'
    )
  }

  const onUninstall = async () => {
    await Plugins.confirm('提示', '要删除此插件目录吗？\n\n' + PATH)
    await Plugins.RemoveFile(PATH)
  }

  const StopServer = async () => {
    await Plugins.StopServer(Plugin.id)
    return 2
  }

  const startService = async () => {
    await Plugins.StartServer(
      Plugin.Address,
      Plugin.id,
      async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        console.log(`[${Plugin.name}]`, url)
        if (url.pathname === '/dir') {
          const path = Plugin.StaticPath + url.searchParams.get('path')
          let path_abs = absPathCache[path]
          if (!path_abs) {
            path_abs = await Plugins.AbsolutePath(path)
            absPathCache[path] = path_abs
          }
          let static_abs = absPathCache[Plugin.StaticPath]
          if (!static_abs) {
            static_abs = await Plugins.AbsolutePath(Plugin.StaticPath)
            absPathCache[Plugin.StaticPath] = static_abs
          }
          if (!path_abs.startsWith(static_abs)) {
            return res.end(401, {}, 'Access Denied: ' + path_abs)
          }
          const dirs = await Plugins.ReadDir(path_abs)
          return res.end(200, { 'Content-Type': 'application/json' }, JSON.stringify(dirs))
        }
        if (url.pathname === '/' || url.pathname === '/index.html') {
          return res.end(200, { 'Content-Type': 'text/html; charset=utf-8' }, await Plugins.ReadFile(`${PATH}/index.html`))
        }
        return res.end(200, {}, '')
      },
      {
        StaticPath: Plugin.StaticPath
      }
    )
    return 1
  }

  const OpenURL = () => {
    Plugins.OpenURI(`http://${Plugin.LanIP}:${parsePort()}/`)
  }

  const OpenFiles = () => {
    Plugins.OpenDir(PATH)
  }

  const CopyURL = async () => {
    await Plugins.ClipboardSetText(`http://${Plugin.LanIP}:${parsePort()}/`)
    Plugins.message.success('复制成功')
  }

  return { onRun, onReady, onDispose, onInstall, onUninstall, onShutdown, OpenURL, OpenFiles, CopyURL }
}
