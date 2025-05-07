const SharePath = await Plugins.AbsolutePath(Plugin.SharePath)
const SavePath = await Plugins.AbsolutePath(Plugin.SavePath)

const MIME_MAPPING = {
  html: 'text/html; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8'
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isRunning())) {
    await startService()
  }
  Plugins.BrowserOpenURL('http://127.0.0.1:5233')
  return 1
}

/**
 * 插件钩子 - APP就绪时
 */
const onReady = async () => {
  if (Plugin.AutoStart && !(await isRunning())) {
    await startService()
    return 1
  }
  if (await isRunning()) {
    // 重启服务，恢复web服务的处理程序
    await stopService()
    await startService()
    return 1
  }
  return 2
}

/**
 * 插件菜单项 - 运行服务
 */
const Start = async () => {
  if (await isRunning()) {
    throw '当前服务已经在运行了'
  }
  await startService()
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isRunning())) {
    throw '当前服务并未在运行'
  }
  await stopService()
  return 2
}

/**
 * 插件菜单项 - 已保存
 */
const Saved = async () => {
  Plugins.BrowserOpenURL(SavePath)
}

/**
 * 插件菜单项 - 共享中
 */
const Share = async () => {
  Plugins.BrowserOpenURL(SharePath)
}

/**
 * 启动服务
 */
const startService = async () => {
  const CommandMapping = {
    '/发送文本': (req) => {
      const { text } = JSON.parse(atob(req.body))
      const msg = decodeURIComponent(text)
      Plugins.alert('接收到来自手机的文本，已复制', msg)
      Plugins.ClipboardSetText(msg)
    },
    '/接收文本': () => Plugins.ClipboardGetText()
  }

  const ShareHtml = 'data/third/file-transfer-assistant/share.html'

  if (!(await Plugins.FileExists(ShareHtml))) {
    await Plugins.Download(
      'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-file-transfer-assistant/share.html',
      ShareHtml
    )
  }

  if (!(await Plugins.FileExists(SharePath))) {
    await Plugins.Makedir(SharePath)
    Plugins.message.info('已自动创建共享文件夹')
  }

  const Shortcut = SharePath + '/文件互传.shortcut'
  if (!(await Plugins.FileExists(ShareHtml))) {
    await Plugins.Download(
      'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-file-transfer-assistant/文件互传.shortcut',
      Shortcut
    )
    Plugins.message.info('已下载快捷指令到共享文件夹')
  }

  await Plugins.StartServer(
    '0.0.0.0:5233',
    Plugin.id,
    async (req, res) => {
      if (req.url == '/' || req.url == '/index.html') {
        const html = await Plugins.Readfile(ShareHtml)
        return res.end(200, { 'Content-Type': MIME_MAPPING.html }, html)
      }

      if (req.url.startsWith('/download')) {
        return await handleDownload(req, res)
      }

      if (req.url.startsWith('/dir')) {
        return await handleDir(req, res)
      }

      const command = decodeURIComponent(req.url)
      if (CommandMapping[command]) {
        try {
          const result = await CommandMapping[command](req)
          return res.end(200, { 'Content-Type': MIME_MAPPING.txt }, result || '')
        } catch (error) {
          console.log('指令执行出现错误', error)
          return res.end(500, { 'Content-Type': MIME_MAPPING.txt }, error.message || error)
        }
      }

      res.end(404, { 'Content-Type': MIME_MAPPING.txt }, '指令未找到:' + command)
    },
    {
      StaticPath: SharePath,
      UploadPath: SavePath,
      UploadRoute: '/发送文件',
      MaxUploadSize: 4096 * 1024 * 1024 // 4GB
    }
  )
}

/**
 * 停止服务
 */
const stopService = async () => {
  await Plugins.StopServer(Plugin.id)
}

/**
 * 检测服务是否在运行
 */
const isRunning = async () => {
  return (await Plugins.ListServer()).includes(Plugin.id)
}

const handleDir = async (req, res) => {
  const path = new URLSearchParams(req.url.slice(5)).get('path')
  const fullPath = await Plugins.AbsolutePath(SharePath + '/' + path)
  if (!fullPath?.startsWith(SharePath)) {
    return res.end(403, { 'Content-Type': MIME_MAPPING.txt }, '禁止访问此目录:' + path)
  }
  const dirs = await Plugins.Readdir(fullPath)
  res.end(200, { 'Content-Type': MIME_MAPPING.json }, JSON.stringify(dirs.map((v) => ({ ...v, size: Plugins.formatBytes(v.size) }))))
}

const handleDownload = async (req, res) => {
  const path = new URLSearchParams(req.url.slice(req.url.indexOf('?'))).get('path')
  const fullPath = await Plugins.AbsolutePath(SharePath + '/' + path)
  if (!fullPath?.startsWith(SharePath)) {
    return res.end(403, { 'Content-Type': MIME_MAPPING.txt }, '禁止访问此文件:' + path)
  }
  return res.end(302, { Location: '/static/' + path }, '')
}
