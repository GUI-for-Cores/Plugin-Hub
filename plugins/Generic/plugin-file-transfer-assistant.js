const PATH = 'data/third/file-transfer-assistant'

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
  openTransferUI()
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

const openTransferUI = () => {
  const component = {
    template: `
      <iframe
        ref="iframeRef"
        :style="{ height: 'calc(100% - 6px)' }"
        src="http://127.0.0.1:5233"
        class="w-full h-full border-0"
      ></iframe>
    `,
    setup() {
      const { ref, watch, onMounted, onUnmounted } = Vue

      const iframeRef = ref()
      const appSettings = Plugins.useAppSettingsStore()

      watch(
        () => appSettings.themeMode,
        (theme) => {
          iframeRef.value?.contentWindow.postMessage(theme, 'http://127.0.0.1:5233')
        },
        {
          immediate: true
        }
      )

      const onMessage = (e) => {
        if (e.data.source === Plugin.id && e.data.method === 'refreshTheme') {
          iframeRef.value?.contentWindow.postMessage(appSettings.themeMode, 'http://127.0.0.1:5233')
        }
      }
      onMounted(() => window.addEventListener('message', onMessage))
      onUnmounted(() => window.removeEventListener('message', onMessage))
      return { iframeRef }
    }
  }
  const modal = Plugins.modal(
    {
      title: Plugin.name,
      width: '90',
      height: '90',
      footer: false,
      maskClosable: true,
      afterClose() {
        modal.destroy()
      }
    },
    {
      toolbar: () => [
        Vue.h(
          Vue.resolveComponent('Button'),
          {
            type: 'text',
            onClick: () => {
              Plugins.BrowserOpenURL(`http://127.0.0.1:5233`)
            }
          },
          () => '浏览器中打开'
        ),
        Vue.h(Vue.resolveComponent('Button'), {
          type: 'text',
          icon: 'close',
          onClick: () => modal.destroy()
        })
      ],
      default: () => Vue.h(component)
    }
  )
  modal.open()
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

  if (!(await Plugins.FileExists(SharePath))) {
    await Plugins.MakeDir(SharePath)
    Plugins.message.success('已自动创建共享文件夹')
  }

  const ShareHtml = PATH + '/share.html'
  const UploadHtml = PATH + '/upload.html'
  const Shortcut = SharePath + '/文件互传.shortcut'

  const versionFile = PATH + '/version.txt'
  const version = await Plugins.ReadFile(versionFile).catch(() => '')
  // 如果插件升级了，则总是获取最新资源文件
  const shouldFetch = Plugin.version !== version
  if (shouldFetch) {
    await Promise.all([
      // 下载下载页面
      Plugins.Download(
        'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-file-transfer-assistant/share.html',
        ShareHtml
      ),
      // 下载上传页面
      Plugins.Download(
        'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-file-transfer-assistant/upload.html',
        UploadHtml
      ),
      // 下载快捷指令
      Plugins.Download(
        'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-file-transfer-assistant/文件互传.shortcut',
        Shortcut
      )
    ])
    await Plugins.WriteFile(versionFile, Plugin.version)
  }

  await Plugins.StartServer(
    '0.0.0.0:5233',
    Plugin.id,
    async (req, res) => {
      if (req.url == '/' || req.url == '/index.html') {
        const html = await Plugins.ReadFile(ShareHtml)
        return res.end(200, { 'Content-Type': MIME_MAPPING.html }, html)
      }

      if (req.url == '/upload.html') {
        const html = await Plugins.ReadFile(UploadHtml)
        return res.end(200, { 'Content-Type': MIME_MAPPING.html }, html)
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
      MaxUploadSize: 100 * 1024 * 1024 * 1024 // 100GB 真能传输这么大文件吗，管他的写大点
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
  const dirs = await Plugins.ReadDir(fullPath)
  res.end(200, { 'Content-Type': MIME_MAPPING.json }, JSON.stringify(dirs.map((v) => ({ ...v, size: Plugins.formatBytes(v.size) }))))
}
