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
  if (Plugin.AutoStart) {
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
 * 启动服务
 */
const startService = async () => {
  const MIME_MAPPING = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    shtml: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    xml: 'text/xml; charset=utf-8',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    js: 'application/javascript; charset=utf-8',
    atom: 'application/atom+xml',
    rss: 'application/rss+xml; charset=utf-8',
    mml: 'text/mathml',
    txt: 'text/plain; charset=utf-8',
    jad: 'text/vnd.sun.j2me.app-descriptor',
    wml: 'text/vnd.wap.wml',
    htc: 'text/x-component',
    avif: 'image/avif',
    png: 'image/png',
    svg: 'image/svg+xml',
    svgz: 'image/svg+xml',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    wbmp: 'image/vnd.wap.wbmp',
    webp: 'image/webp',
    ico: 'image/x-icon',
    jng: 'image/x-jng',
    bmp: 'image/x-ms-bmp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    jar: 'application/java-archive',
    war: 'application/java-archive',
    ear: 'application/java-archive',
    json: 'application/json; charset=utf-8',
    hqx: 'application/mac-binhex40',
    doc: 'application/msword',
    pdf: 'application/pdf',
    ps: 'application/postscript',
    eps: 'application/postscript',
    ai: 'application/postscript',
    rtf: 'application/rtf',
    m3u8: 'application/vnd.apple.mpegurl',
    kml: 'application/vnd.google-earth.kml+xml',
    kmz: 'application/vnd.google-earth.kmz',
    xls: 'application/vnd.ms-excel',
    eot: 'application/vnd.ms-fontobject',
    ppt: 'application/vnd.ms-powerpoint',
    odg: 'application/vnd.oasis.opendocument.graphics',
    odp: 'application/vnd.oasis.opendocument.presentation',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
    odt: 'application/vnd.oasis.opendocument.text',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    wmlc: 'application/vnd.wap.wmlc',
    wasm: 'application/wasm',
    '7z': 'application/x-7z-compressed',
    cco: 'application/x-cocoa',
    jardiff: 'application/x-java-archive-diff',
    jnlp: 'application/x-java-jnlp-file',
    run: 'application/x-makeself',
    pl: 'application/x-perl',
    pm: 'application/x-perl',
    prc: 'application/x-pilot',
    pdb: 'application/x-pilot',
    rar: 'application/x-rar-compressed',
    rpm: 'application/x-redhat-package-manager',
    sea: 'application/x-sea',
    swf: 'application/x-shockwave-flash',
    sit: 'application/x-stuffit',
    tcl: 'application/x-tcl',
    tk: 'application/x-tcl',
    der: 'application/x-x509-ca-cert',
    pem: 'application/x-x509-ca-cert',
    crt: 'application/x-x509-ca-cert',
    xpi: 'application/x-xpinstall',
    xhtml: 'application/xhtml+xml',
    xspf: 'application/xspf+xml',
    zip: 'application/zip',
    bin: 'application/octet-stream',
    exe: 'application/octet-stream',
    dll: 'application/octet-stream',
    deb: 'application/octet-stream',
    dmg: 'application/octet-stream',
    iso: 'application/octet-stream',
    img: 'application/octet-stream',
    msi: 'application/octet-stream',
    msp: 'application/octet-stream',
    msm: 'application/octet-stream',
    mid: 'audio/midi',
    midi: 'audio/midi',
    kar: 'audio/midi',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    m4a: 'audio/x-m4a',
    ra: 'audio/x-realaudio',
    '3gpp': 'video/3gpp',
    '3gp': 'video/3gpp',
    ts: 'video/mp2t',
    mp4: 'video/mp4',
    mpeg: 'video/mpeg',
    mpg: 'video/mpeg',
    mov: 'video/quicktime',
    webm: 'video/webm',
    flv: 'video/x-flv',
    m4v: 'video/x-m4v',
    mng: 'video/x-mng',
    asx: 'video/x-ms-asf',
    asf: 'video/x-ms-asf',
    wmv: 'video/x-ms-wmv',
    avi: 'video/x-msvideo'
  }

  const CommandMapping = {
    '/发送文本': (req) => {
      const { text } = JSON.parse(atob(req.body))
      const msg = decodeURIComponent(text)
      Plugins.alert('接收到来自手机的文本，已复制', msg)
      Plugins.ClipboardSetText(msg)
    },
    '/接收文本': () => Plugins.ClipboardGetText(),
    '/发送文件': (req) => {
      const { 'File-Name': filename = '', 'File-Suffix': suffix = '', 'Content-Length': size = '', 'Content-Type': type } = req.headers
      const basePath = Plugin.SavePath || 'data/third/file-transfer-assistant/Saved'
      const _suffix = Object.entries(MIME_MAPPING).find((v) => v[1].includes(type))?.[0]
      const path = `${basePath}/${filename || '未知文件_' + Date.now()}.${suffix ? suffix.toLowerCase() : _suffix}`
      Plugins.Writefile(path, req.body, { Mode: 'Binary' })
      Plugins.alert(
        '接收到来自手机的文件',
        `文件名：${filename || '未知文件'}\n文件大小: ${Plugins.formatBytes(size)}\n文件类型: ${suffix || _suffix}\n保存位置: ${path}`
      )
    }
  }

  const _share = await Plugins.AbsolutePath(Plugin.SharePath)

  if (!(await Plugins.FileExists(_share))) {
    await Plugins.Makedir(_share)
    Plugins.message.info('已自动创建共享文件夹')
  }

  await Plugins.StartServer('0.0.0.0:5233', Plugin.id, async (req, res) => {
    if (req.url == '/' || req.url == '/index.html') {
      return res.end(200, { 'Content-Type': MIME_MAPPING.html }, INDEX_TEMPLATE)
    }

    if (req.url.startsWith('/download')) {
      const path = new URLSearchParams(req.url.slice(req.url.indexOf('?'))).get('path')
      const _path = await Plugins.AbsolutePath(path)
      if (_path?.startsWith(_share)) {
        const suffix = path.split('.').pop().toLowerCase()
        const file = await Plugins.Readfile(path, { Mode: 'Binary' })
        res.end(200, { 'Content-Type': MIME_MAPPING[suffix] || MIME_MAPPING.txt }, file, { Mode: 'Binary' })
      }
      return res.end(403, { 'Content-Type': MIME_MAPPING.txt }, '禁止访问此文件:' + path)
    }

    if (req.url.startsWith('/dir')) {
      const path = new URLSearchParams(req.url.slice(5)).get('path')
      const _path = await Plugins.AbsolutePath(path)
      if (_path?.startsWith(_share)) {
        const dirs = await Plugins.Readdir(_path)
        res.end(200, { 'Content-Type': MIME_MAPPING.json }, JSON.stringify(dirs.map((v) => ({ ...v, size: Plugins.formatBytes(v.size) }))))
      }
      return res.end(403, { 'Content-Type': MIME_MAPPING.txt }, '禁止访问此目录:' + path)
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
  })
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

/**
 * index.html
 */
const INDEX_TEMPLATE = /* html */ `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${Plugin.name}</title>
<style>
  .item {
      display: flex;
      padding: 16px 8px;
      align-items: center;
      margin: 4px;
      background: rgba(0, 0, 0, .04);
  }
  .icon{
      width: 20px;
      height: 20px;
  }
  .size{
      text-align: center;
      width: 80px;
      font-size: 12px;
  }
  .title{
      font-weight: bold;
      margin-left: 16px;
  }
  .file {
      background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAWBJREFUeNqEUj1LxEAQnd1MVA4lyIEWx6UIKEGUExGsbC3tLfwJ/hT/g7VlCnubqxXBwg/Q4hQP/LhKL5nZuBsvuGfW5MGyuzM7jzdvVuR5DgYnZ+f99ai7Vt5t9K9unu4HLweI3qWYxI6PDosdy0fhcntxO44CcOBzPA7mfEyuHwf7ntQk4jcnywOxIlfxOCNYaLVgb6cXbkTdhJXq2SIlNMC0xIqhHczDbi8OVzpLSUa0WebRfmigLHqj1EcPZnwf7gbDIrYVRyEinurj6jTBHyI7pqVrFQqEbt6TEmZ9v1NRAJNC1xTYxIQh/MmRUlmFQE3qWOW1nqB2TWk1/3tgJV0waVvkFIEeZbHq4ElyKzAmEXOx6gnEVJuWBzmkRJBRPYGZBDsVaOlpSgVJE2yVaAe/0kx/3azBRO0VsbMFZE3CDSZKweZfYIVg+DZ6v7h9GDVOwZPw/PoxKu/fAgwALbDAXf7DdQkAAAAASUVORK5CYII=");
      background-size: 100% 100%;
  }
  .folder {
    background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAIlJREFUOE9jZKAQMFKonwFsQED/pwQGhv8KqIb9W7ChUPABIQsgBkz4+B+LwgcM//85EjIEnwEgMx8w/GdYiN0VjA82FPItIGQAXh9sKOBnHN4G/D+AGgCMDugBgj8M/v9zRGhgVmBg/D+fNAMIpSAGBgYqxgLWpEzICf8ObCgUPECdzETILnzyANUYRBF567JvAAAAAElFTkSuQmCC");
    background-size: 100% 100%;
  }
  .footer{
    text-align: center;
    font-size: 12px;
  }
  #loading{
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 999;
    background: rgba(0,0,0,0);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000;
    font-size: 22px;
  }
</style>
</head>
<body>
<div id="app">
  <h1>文件列表</h1>
  <p id="pwd"></p>
  <div id="list"></div>
  <p class="footer">本页面由 GUI.for.Cores 项目组下的【${Plugin.name}】插件提供支持</p>
  <div id="loading">Loading...</div>
</div>
<script>
  const loading = document.getElementById('loading')
  const list = document.getElementById('list')
  const pwd = document.getElementById('pwd')
  const history = []

  function back() {
      if(history.length === 1) return
      history.pop()
      readDir(history.pop())
  }

  async function readDir(path) {
      loading.style.display = 'flex'
      try {
        const res = await fetch('/dir?path=' + path)
        if(res.status !== 200) {
          throw await res.text()
        }
        const files = await res.json()
        
        history.push(path)
        pwd.textContent = '当前目录：' + history[history.length - 1]
  
        let str = \`
        <div class="item" onclick="back()">
            <div class="title">..</div>
        </div>
        \`
        files.forEach(file => {
            str += /*html*/\`
            <div class="item" onclick="\${file.isDir ? 'readDir' : 'download'}('\${path}/\${file.name}', '\${file.name}')">
                <div class="icon \${file.isDir ? 'folder' : 'file'}"></div>
                <div class="title">\${file.name}</div>
                <div class="size">\${ file.isDir ? '' : file.size}</div>
            </div>
            \`
            })
        list.innerHTML = str
      }catch(err) {
        alert(err.message || err)
      }
      loading.style.display = 'none'
  }

  async function download(path, filename) {
    open(\`/download/\${filename}?path=\${path}\`)
  }

  readDir('${Plugin.SharePath}')
</script>
</body>
</html>
`
