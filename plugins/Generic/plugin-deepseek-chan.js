/**
 * 本插件使用项目：https://github.com/stevenjoezhang/live2d-widget
 * 模型：DeepSeek-chan，插画与 PSD 分层 Kamiya Ryoko（https://x.com/kamiya_ryoko），Live2D 绑定 霓虹猫_NeonNeko
 * 作者不允许二次分发模型文件，请自行到 VGen 免费领取
 */

const LIVE2D_PATH = 'https://fastly.jsdelivr.net/npm/live2d-widgets@1.0.1/dist/'
const MODEL_DIR = 'data/third/deepseek-chan'
const SERVER_ADDRESS = '127.0.0.1:53423'
const PRIMARY_COLOR = 'rgb(77,107,254)'
const DOWNLOAD_URL = 'https://vgen.co/KAMIYA/product/deepseek-chan-deepseek-free-live2d-model-layered-psd-psd/1c55a71a-2747-4616-819d-2dc0a934089d'
const GUIDE = `
### 安装 DeepSeek 娘模型

模型由 **Kamiya Ryoko** 免费发布，作者不允许二次分发模型文件，所以需要你自己领取：

1. 点击下方「前往下载」，会打开 VGen 下载页和插件的模型目录 \`${MODEL_DIR}\`。
2. 在 VGen 登录后免费领取，下载 ZIP 压缩包。
3. 把压缩包**完整解压**到模型目录，保持原有文件夹结构，不要改名或删减文件。
4. 回到插件列表手动运行本插件，或重启 GUI，DeepSeek 娘就会出现在左下角。

> 模型需要在线加载 Live2D 官方的 Cubism Core，离线时无法显示。
> 公开分享截图或视频时，请注明：插画与 PSD 分层 Kamiya Ryoko，Live2D 绑定 霓虹猫_NeonNeko。
`

/** @type {EsmPlugin} */
export default (Plugin) => {
  const loadExternalResource = (url, type) => {
    return new Promise((resolve, reject) => {
      let tag
      if (type === 'css') {
        tag = document.createElement('link')
        tag.rel = 'stylesheet'
        tag.href = url
      } else {
        tag = document.createElement('script')
        tag.type = 'module'
        tag.src = url
      }
      tag.onload = () => resolve(url)
      tag.onerror = () => reject(url)
      document.head.appendChild(tag)
    })
  }

  // 递归查找 *.model3.json，兼容直接解压 VGen 的压缩包（模型在两层文件夹内）
  const findModel = async (dir = '') => {
    const entries = await Plugins.ReadDir(dir ? `${MODEL_DIR}/${dir}` : MODEL_DIR)
    const file = entries.find((f) => !f.isDir && f.name.endsWith('.model3.json'))
    if (file) return [...(dir ? dir.split('/') : []), file.name].map(encodeURIComponent).join('/')
    for (const sub of entries.filter((f) => f.isDir)) {
      const path = await findModel(dir ? `${dir}/${sub.name}` : sub.name)
      if (path) return path
    }
  }

  const loadDeepSeekChan = async () => {
    if (document.getElementById('waifu') || screen.width < 768) return true

    await Plugins.MakeDir(MODEL_DIR)
    const modelPath = await findModel()
    if (!modelPath) return false

    await Plugins.StopServer(Plugin.id).catch(() => {})
    await Plugins.StartServer(SERVER_ADDRESS, Plugin.id, async (req, res) => res.end(200, {}, 'DeepSeek-chan'), {
      StaticPath: MODEL_DIR,
      StaticHeaders: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*'
      }
    })

    const tips = await fetch(LIVE2D_PATH + 'waifu-tips.json').then((r) => r.json())
    tips.models = [
      {
        name: 'DeepSeek-chan',
        paths: [`http://${SERVER_ADDRESS}/static/${modelPath}`],
        message: '我是 DeepSeek 娘，有什么可以帮你的吗？'
      }
    ]
    const waifuPath = URL.createObjectURL(new Blob([JSON.stringify(tips)], { type: 'application/json' }))

    // 避免图片资源跨域问题
    const OriginalImage = window.Image
    window.Image = function (...args) {
      const img = new OriginalImage(...args)
      img.crossOrigin = 'anonymous'
      return img
    }
    window.Image.prototype = OriginalImage.prototype

    if (Plugin.DisableMessage) {
      const style = document.createElement('style')
      style.textContent = '#waifu-tips { display: none !important; }'
      document.head.appendChild(style)
    }

    // 模型有 49 组剪贴蒙版，超过 live2d-widgets 默认 1 张蒙版纹理的上限（36 组），蒙版错乱会让脸部的粉色正片叠底图层整片露出来，导致脸发红
    // 这里把 Cubism 5 渲染模块改成 2 张蒙版纹理（上限 64 组），再用 blob 加载
    const chunk = (await fetch(LIVE2D_PATH + 'chunk/index2.js').then((r) => r.text()))
      .replace('createRenderer(t=1)', 'createRenderer(t=2)')
      .replace('"../waifu-tips.js"', `"${LIVE2D_PATH}waifu-tips.js"`)
    const chunkUrl = URL.createObjectURL(new Blob([chunk], { type: 'text/javascript' }))
    const main = (await fetch(LIVE2D_PATH + 'waifu-tips.js').then((r) => r.text()))
      .replace('"./chunk/index2.js"', `"${chunkUrl}"`)
      .replace('"./chunk/index.js"', `"${LIVE2D_PATH}chunk/index.js"`)
    const mainUrl = URL.createObjectURL(new Blob([main], { type: 'text/javascript' }))

    await Promise.all([loadExternalResource(LIVE2D_PATH + 'waifu.css', 'css'), loadExternalResource(mainUrl, 'js')])

    localStorage.setItem('modelId', '0')
    window.initWidget({
      waifuPath,
      cubism5Path: 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
      tools: ['quit'],
      logLevel: 'warn'
    })

    if (Plugin.ApplyTheme) {
      document.documentElement.style.setProperty('--primary-color', PRIMARY_COLOR)
      document.documentElement.style.setProperty('--secondary-color', PRIMARY_COLOR)
    }
    return true
  }

  const onRun = async () => {
    if (!(await loadDeepSeekChan())) await Guide()
  }

  const onInstall = async () => {
    await Guide()
  }

  const onReady = () => {
    Plugin.AutoStart && loadDeepSeekChan().catch((e) => console.error(`[${Plugin.name}]`, e))
  }

  const OpenModelDir = async () => {
    await Plugins.MakeDir(MODEL_DIR)
    await Plugins.OpenDir(MODEL_DIR)
  }

  const Guide = async () => {
    const ok = await Plugins.confirm(Plugin.name, GUIDE, { type: 'markdown', okText: '前往下载', cancelText: '稍后再说' }).catch(() => false)
    if (!ok) return
    Plugins.BrowserOpenURL(DOWNLOAD_URL)
    await OpenModelDir()
  }

  return { onRun, onReady, onInstall, OpenModelDir, Guide }
}
