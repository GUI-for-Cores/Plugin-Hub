/**
 * 随机壁纸
 *
 * 点一下运行就从图源随机下载一张壁纸并设为桌面壁纸。
 * 下载过的壁纸都保存在插件目录（data/third/random-wallpaper/history），可以随时从历史里切回去。
 * Windows 通过 PowerShell 调用 user32 SystemParametersInfo 设置；macOS、Linux 尽力支持。
 */

const PATH = 'data/third/random-wallpaper'
const HISTORY_DIR = PATH + '/history'
const INDEX_FILE = PATH + '/history.json'

const BING_HOST = 'https://cn.bing.com'
const BING_MARKETS = ['zh-CN', 'en-US', 'ja-JP', 'en-GB', 'de-DE', 'fr-FR', 'en-CA', 'en-AU', 'en-IN', 'it-IT', 'es-ES', 'pt-BR']

const SOURCE_NAMES = { bing: '必应', wallhaven: 'Wallhaven', picsum: 'Picsum', custom: '自定义' }

// Windows 壁纸填充方式：[WallpaperStyle, TileWallpaper]
const WINDOWS_STYLES = {
  fill: ['10', '0'],
  fit: ['6', '0'],
  stretch: ['2', '0'],
  center: ['0', '0'],
  tile: ['0', '1'],
  span: ['22', '0']
}

// 只用 ASCII，路径和填充方式通过环境变量传入，避免空格、中文路径的转义问题；
// 出错时输出纯文本，避免 -EncodedCommand 下错误被序列化成 CLIXML
const WINDOWS_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  $path = [System.IO.Path]::GetFullPath($env:RW_WALLPAPER_PATH)
  $key = 'HKCU:\\Control Panel\\Desktop'
  Set-ItemProperty -Path $key -Name WallpaperStyle -Value $env:RW_WALLPAPER_STYLE
  Set-ItemProperty -Path $key -Name TileWallpaper -Value $env:RW_WALLPAPER_TILE
  Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class RandomWallpaper {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
'@
  # SPI_SETDESKWALLPAPER = 20, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE = 3
  if (-not [RandomWallpaper]::SystemParametersInfo(20, 0, $path, 3)) {
    throw ('SystemParametersInfo failed: ' + [System.Runtime.InteropServices.Marshal]::GetLastWin32Error())
  }
} catch {
  # Plain-text error instead of CLIXML
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
`

// PowerShell -EncodedCommand 需要 UTF-16LE 的 Base64，脚本是纯 ASCII，直接补零字节即可
const WINDOWS_ENCODED_SCRIPT = btoa(
  WINDOWS_SCRIPT.split('')
    .map((c) => c + '\0')
    .join('')
)

const MACOS_SCRIPT = [
  'on run argv',
  'set wallpaperFile to POSIX file (item 1 of argv)',
  'tell application "System Events" to tell every desktop to set picture to wallpaperFile',
  'end run'
]

// $1 = 文件路径，$2 = file:// URI
const LINUX_SCRIPT = `
f="$1"; uri="$2"
de=$(printf '%s' "\${XDG_CURRENT_DESKTOP:-$DESKTOP_SESSION}" | tr '[:upper:]' '[:lower:]')
gnome() {
  gsettings set org.gnome.desktop.background picture-uri "$uri" || return 1
  gsettings set org.gnome.desktop.background picture-uri-dark "$uri" 2>/dev/null
  gsettings set org.gnome.desktop.background picture-options zoom 2>/dev/null
  return 0
}
case "$de" in
  *kde*|*plasma*)
    if command -v plasma-apply-wallpaperimage >/dev/null 2>&1; then plasma-apply-wallpaperimage "$f"; exit $?; fi
    ;;
  *cinnamon*)
    gsettings set org.cinnamon.desktop.background picture-uri "$uri"; exit $?
    ;;
  *mate*)
    gsettings set org.mate.background picture-filename "$f"; exit $?
    ;;
  *xfce*)
    props=$(xfconf-query -c xfce4-desktop -l 2>/dev/null | grep -E 'last-image$')
    if [ -n "$props" ]; then
      for p in $props; do xfconf-query -c xfce4-desktop -p "$p" -s "$f"; done
      exit 0
    fi
    ;;
  *lxqt*)
    if command -v pcmanfm-qt >/dev/null 2>&1; then pcmanfm-qt --set-wallpaper="$f" --wallpaper-mode=zoom; exit $?; fi
    ;;
  *gnome*|*unity*|*budgie*|*pantheon*|*deepin*|*ubuntu*|*pop*|*cosmic*)
    gnome && exit 0
    ;;
esac
if command -v gsettings >/dev/null 2>&1 && gnome 2>/dev/null; then exit 0; fi
if command -v feh >/dev/null 2>&1; then feh --bg-fill "$f"; exit $?; fi
echo "unsupported desktop: $de" >&2
exit 3
`

/** @type {EsmPlugin} */
export default (Plugin) => {
  let absPath = null
  let busy = false

  // 插件目录的绝对路径只解析一次
  const getAbsPath = () =>
    (absPath ??= Plugins.AbsolutePath(PATH).catch((err) => {
      absPath = null
      throw err
    }))

  const getOS = () => Plugins.useEnvStore().env.os

  const configNumber = (key, fallback, min, max) => {
    const n = Number(Plugin[key])
    if (!Number.isFinite(n) || n <= 0) return fallback
    return Math.min(max, Math.max(min, Math.round(n)))
  }

  const errorText = (err) => (typeof err === 'string' ? err : err?.message || String(err))

  const pad = (n) => String(n).padStart(2, '0')

  const formatTime = (ts) => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const fileStamp = (ts) =>
    formatTime(ts)
      .replace(/[-: ]/g, '')
      .replace(/^(\d{8})/, '$1-')

  const randomItem = (list) => list[Math.floor(Math.random() * list.length)]

  /* -------------------------------- 历史记录 -------------------------------- */

  /** @returns {Promise<{ current: string, items: Array<{ id: string, file: string, time: number, source: string, url: string, title: string }> }>} */
  const readIndex = async () => {
    if (!(await Plugins.FileExists(INDEX_FILE))) return { current: '', items: [] }
    try {
      const data = JSON.parse(await Plugins.ReadFile(INDEX_FILE))
      return { current: data.current || '', items: Array.isArray(data.items) ? data.items : [] }
    } catch {
      return { current: '', items: [] }
    }
  }

  const writeIndex = (index) => Plugins.WriteFile(INDEX_FILE, JSON.stringify(index, null, 2))

  // 超过上限时删除最旧的记录，当前壁纸不删
  const pruneIndex = async (index) => {
    const max = configNumber('MaxHistory', 50, 1, 1000)
    const keep = []
    const removed = []
    for (const item of index.items) {
      if (keep.length < max || item.id === index.current) keep.push(item)
      else removed.push(item)
    }
    await Promise.all(removed.map((item) => Plugins.RemoveFile(`${HISTORY_DIR}/${item.file}`).catch(() => {})))
    index.items = keep
  }

  /* -------------------------------- 图源 -------------------------------- */

  const isUHD = () => Plugin.Resolution !== '1080'

  const pickUnused = (candidates, index) => {
    const used = new Set(index.items.map((item) => item.url))
    const fresh = candidates.filter((c) => !used.has(c.url))
    return randomItem(fresh.length ? fresh : candidates)
  }

  const fetchBing = async (index) => {
    const market = Plugin.BingMarket && Plugin.BingMarket !== 'random' ? Plugin.BingMarket : randomItem(BING_MARKETS)
    // 必应只提供最近约 15 天：idx=0 和 idx=7 各取 8 张
    const idx = randomItem([0, 7])
    const { body } = await Plugins.HttpGet(`${BING_HOST}/HPImageArchive.aspx?format=js&idx=${idx}&n=8&mkt=${market}`)
    const images = (typeof body === 'string' ? JSON.parse(body) : body)?.images || []
    if (!images.length) throw '必应没有返回壁纸'
    const size = isUHD() ? 'UHD' : '1920x1080'
    const candidates = images.map((img) => ({
      url: `${BING_HOST}${img.urlbase}_${size}.jpg`,
      fallback: `${BING_HOST}${img.urlbase}_1920x1080.jpg`,
      title: img.copyright || img.title || ''
    }))
    return pickUnused(candidates, index)
  }

  const fetchWallhaven = async (index) => {
    const params = new URLSearchParams({
      sorting: 'random',
      categories: '100',
      purity: '100',
      atleast: isUHD() ? '3840x2160' : '1920x1080',
      ratios: '16x9,16x10'
    })
    if (Plugin.Keyword?.trim()) params.set('q', Plugin.Keyword.trim())
    const { body } = await Plugins.HttpGet(`https://wallhaven.cc/api/v1/search?${params}`)
    const list = (typeof body === 'string' ? JSON.parse(body) : body)?.data || []
    if (!list.length) throw 'Wallhaven 没有找到符合条件的壁纸'
    const candidates = list.map((item) => ({ url: item.path, title: `${item.id}（${item.resolution}）` }))
    return pickUnused(candidates, index)
  }

  const fetchPicsum = async () => {
    const [w, h] = isUHD() ? [3840, 2160] : [1920, 1080]
    return { url: `https://picsum.photos/${w}/${h}?random=${Date.now()}`, title: '' }
  }

  const fetchCustom = async () => {
    const url = Plugin.CustomUrl?.trim()
    if (!/^https?:\/\//i.test(url || '')) throw '请先在插件配置里填写自定义图片地址'
    return { url, title: '' }
  }

  const SOURCES = { bing: fetchBing, wallhaven: fetchWallhaven, picsum: fetchPicsum, custom: fetchCustom }

  const extFromType = (type) => {
    if (/png/i.test(type)) return 'png'
    if (/bmp/i.test(type)) return 'bmp'
    if (/webp/i.test(type)) return 'webp'
    return 'jpg'
  }

  // 下载到历史目录，返回文件名
  const downloadImage = async (urls, time) => {
    const base = `${fileStamp(time)}-${Math.random().toString(36).slice(2, 6)}`
    const tmp = `${HISTORY_DIR}/${base}.tmp`
    let lastError = ''
    for (const url of urls) {
      try {
        const { status, headers } = await Plugins.Download(url, tmp, { Accept: 'image/jpeg,image/png,image/*;q=0.8' })
        const type = headers['Content-Type'] || headers['content-type'] || ''
        if (status !== 200 || (type && !/^image\//i.test(type))) {
          lastError = `HTTP ${status}${type ? `，${type}` : ''}`
          continue
        }
        const file = `${base}.${extFromType(type)}`
        await Plugins.MoveFile(tmp, `${HISTORY_DIR}/${file}`)
        return file
      } catch (err) {
        lastError = errorText(err)
      }
    }
    await Plugins.RemoveFile(tmp).catch(() => {})
    throw `下载壁纸失败：${lastError}`
  }

  /* -------------------------------- 设置壁纸 -------------------------------- */

  const setWallpaper = async (file) => {
    const abs = `${await getAbsPath()}/history/${file}`
    const os = getOS()
    if (os === 'windows') {
      const [style, tile] = WINDOWS_STYLES[Plugin.Style] || WINDOWS_STYLES.fill
      await Plugins.Exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', WINDOWS_ENCODED_SCRIPT], {
        Env: { RW_WALLPAPER_PATH: abs, RW_WALLPAPER_STYLE: style, RW_WALLPAPER_TILE: tile }
      })
    } else if (os === 'darwin') {
      await Plugins.Exec('osascript', [...MACOS_SCRIPT.flatMap((line) => ['-e', line]), abs])
    } else if (os === 'linux') {
      const uri = 'file://' + abs.split('/').map(encodeURIComponent).join('/')
      await Plugins.Exec('sh', ['-c', LINUX_SCRIPT, 'random-wallpaper', abs, uri]).catch((err) => {
        throw /unsupported desktop/.test(errorText(err)) ? '当前桌面环境暂不支持自动设置壁纸，图片已保存，可打开壁纸目录手动设置' : err
      })
    } else {
      throw `暂不支持当前系统：${os}`
    }
  }

  const switchTo = async (index, item) => {
    if (!(await Plugins.FileExists(`${HISTORY_DIR}/${item.file}`))) {
      index.items = index.items.filter((i) => i.id !== item.id)
      await writeIndex(index)
      throw '这张壁纸的文件已经不存在，已从历史中移除'
    }
    await setWallpaper(item.file)
    index.current = item.id
    await writeIndex(index)
  }

  const withLock = async (fn) => {
    if (busy) throw '正在设置壁纸，请稍候'
    busy = true
    try {
      return await fn()
    } finally {
      busy = false
    }
  }

  /* -------------------------------- 插件入口 -------------------------------- */

  const onRun = () =>
    withLock(async () => {
      const source = SOURCES[Plugin.Source] ? Plugin.Source : 'bing'
      const { id: msgId } = Plugins.message.info(`正在从 ${SOURCE_NAMES[source]} 获取壁纸...`, 60_000)
      try {
        const index = await readIndex()
        const picked = await SOURCES[source](index)
        const time = Date.now()
        const file = await downloadImage([picked.url, picked.fallback].filter(Boolean), time)
        const item = { id: `${time}`, file, time, source, url: picked.url, title: picked.title }
        index.items.unshift(item)
        await pruneIndex(index)
        await writeIndex(index)
        Plugins.message.update(msgId, '正在设置壁纸...')
        await setWallpaper(file)
        index.current = item.id
        await writeIndex(index)
        Plugins.message.update(msgId, picked.title ? `壁纸已更换：${picked.title}` : '壁纸已更换', 'success')
        setTimeout(() => Plugins.message.destroy(msgId), 3000)
      } catch (err) {
        // 错误交给 GUI 统一提示
        Plugins.message.destroy(msgId)
        throw err
      }
    })

  const History = async () => {
    const index = await readIndex()
    if (!index.items.length) throw '还没有历史壁纸，先运行一次插件吧'
    const options = index.items.map((item) => ({
      label: `${item.id === index.current ? '【当前】' : ''}${formatTime(item.time)} · ${SOURCE_NAMES[item.source] || item.source}`,
      description: item.title || item.url,
      value: item.id
    }))
    const id = await Plugins.picker.single('历史壁纸', options, index.current ? [index.current] : [])
    const item = index.items.find((i) => i.id === id)
    if (!item) return
    await withLock(() => switchTo(index, item))
    Plugins.message.success('已切换到这张壁纸')
  }

  const Previous = () =>
    withLock(async () => {
      const index = await readIndex()
      const pos = index.items.findIndex((i) => i.id === index.current)
      const item = index.items[pos + 1]
      if (!item) throw index.items.length ? '已经是最早的一张了' : '还没有历史壁纸，先运行一次插件吧'
      await switchTo(index, item)
      Plugins.message.success(`已切回 ${formatTime(item.time)} 的壁纸`)
    })

  const OpenFolder = async () => {
    await Plugins.MakeDir(HISTORY_DIR)
    await Plugins.OpenDir(HISTORY_DIR)
  }

  const ClearHistory = async () => {
    const index = await readIndex()
    const removable = index.items.filter((i) => i.id !== index.current)
    if (!removable.length) throw '没有可清理的历史壁纸'
    await Plugins.confirm('清理历史', `将删除 ${removable.length} 张历史壁纸（保留当前壁纸），确定吗？`)
    await Promise.all(removable.map((item) => Plugins.RemoveFile(`${HISTORY_DIR}/${item.file}`).catch(() => {})))
    index.items = index.items.filter((i) => i.id === index.current)
    await writeIndex(index)
    Plugins.message.success(`已清理 ${removable.length} 张历史壁纸`)
  }

  return { onRun, History, Previous, OpenFolder, ClearHistory }
}
