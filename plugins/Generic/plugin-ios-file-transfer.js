/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  //   if (!(await isShortcutRunning())) {
  //     await startShortcutService()
  //   }
  await stopShortcutService()
  await startShortcutService()
  return 1
}

/**
 * 插件钩子 - APP就绪时
 */
const onReady = async () => {
  if (await isShortcutRunning()) {
    // 重启服务，恢复web服务的处理程序
    await stopShortcutService()
    await startShortcutService()
    return 1
  }
  return 2
}

/**
 * 插件菜单项 - 运行服务
 */
const Start = async () => {
  if (await isShortcutRunning()) {
    throw '当前服务已经在运行了'
  }
  await startShortcutService()
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isShortcutRunning())) {
    throw '当前服务并未在运行'
  }
  await stopShortcutService()
  return 2
}

/**
 * 启动服务
 */
const startShortcutService = async () => {
  const CommandMapping = {
    '/发送文本': (req) => {
      const { text } = JSON.parse(atob(req.body))
      Plugins.alert('接收到来自手机的文本，已复制', text)
      Plugins.ClipboardSetText(text)
    },
    '/接收文本': () => Plugins.ClipboardGetText(),
    '/发送文件': (req) => {
      const { 'File-Name': filename, 'File-Suffix': suffix } = req.headers
      const basePath = Plugin.SavePath || 'data/third/ios-file-transfer/MobilePhone'
      Plugins.Writefile(`${basePath}/${filename}.${suffix.toLowerCase()}`, req.body, { Mode: 'Binary' })
    }
  }

  await Plugins.StartServer('0.0.0.0:5233', Plugin.id, async (req, res) => {
    if (req.url.startsWith('/share')) {
      return res.end(200, { 'Content-Type': 'text/html; charset=utf-8' }, `TODO: 文件浏览器`)
    }

    const command = decodeURIComponent(req.url)
    if (CommandMapping[command]) {
      const result = await CommandMapping[command](req)
      return res.end(200, { 'Content-Type': 'text/plain; charset=utf-8' }, result ?? '')
    }

    res.end(404, { 'Content-Type': 'text/plain; charset=utf-8' }, '指令未找到:' + command)
  })
}

/**
 * 停止服务
 */
const stopShortcutService = async () => {
  await Plugins.StopServer(Plugin.id)
}

/**
 * 检测服务是否在运行
 */
const isShortcutRunning = async () => {
  return (await Plugins.ListServer()).includes(Plugin.id)
}
