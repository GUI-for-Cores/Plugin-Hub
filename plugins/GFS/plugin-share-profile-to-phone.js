const JS_FILE = 'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.js'
const PATH = 'data/third/share-profile-to-phone'

/* 触发器 手动触发 */
const onRun = async () => {
  await loadDependence()
  const store = Plugins.useProfilesStore()
  if (store.profiles.length === 0) {
    throw '请先创建一个配置'
  }
  let profile = null
  if (store.profiles.length === 1) {
    profile = store.profiles[0]
  } else {
    profile = await Plugins.picker.single(
      '请选择要分享的配置',
      store.profiles.map((v) => ({
        label: v.name,
        value: v
      })),
      []
    )
  }
  const _profile = Plugins.deepClone(profile)
  // * 开启TUN
  _profile.tunConfig.enable = true
  // * 替换本地规则集为远程规则集（仅从规则集中心添加的可替换）
  ;[..._profile.dnsRulesConfig, ..._profile.rulesConfig].forEach((rule) => {
    if (rule.type === 'rule_set') {
      // 符合这一规则的说明是从规则集中心添加的，可以安全的转为远程规则集
      if (rule.payload.startsWith('geosite_') || rule.payload.startsWith('geoip_')) {
        rule.type = 'rule_set_url'
        rule['ruleset-name'] = rule.payload
        rule.payload = rule.payload.replace('geosite_', 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geosite/')
        rule.payload = rule.payload.replace('geoip_', 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo/geoip/')
        rule.payload = rule.payload.replace('.binary', '.srs')
        rule.payload = rule.payload.replace('.source', '.json')
      }
    }
  })
  const config = await Plugins.generateConfig(_profile)
  const ips = await getIPAddress()
  const urls = await Promise.all(
    ips.map((ip) => {
      const url = `http://${ip}:${Plugin.Port}`
      return getQRCode(url, `sing-box://import-remote-profile?url=${encodeURIComponent(url)}#${_profile.name}`)
    })
  )
  // await Plugins.StopServer(Plugin.id)
  const { close } = await Plugins.StartServer('0.0.0.0:' + Plugin.Port, Plugin.id, async (req, res) => {
    res.end(200, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify(config, null, 2))
  })
  await Plugins.alert(Plugin.name, '|分享链接|二维码|\n|-|-|\n' + urls.map((url) => `|${url.url}|![](${url.qrcode})|`).join('\n'), { type: 'markdown' })
  close()
}

/* 触发器 安装 */
const onInstall = async () => {
  await Plugins.Download(JS_FILE, PATH + '/qrcode.min.js')
  await Plugins.message.success('安装成功')
  return 0
}

/* 触发器 卸载 */
const onUninstall = async () => {
  await Plugins.Removefile(PATH)
  return 0
}

/**
 * 动态引入依赖
 */
function loadDependence() {
  return new Promise(async (resolve, reject) => {
    if (window.QRCode) {
      resolve()
      return
    }
    try {
      const text = await Plugins.Readfile(PATH + '/qrcode.min.js')
      const script = document.createElement('script')
      script.id = Plugin.id
      script.text = text
      document.body.appendChild(script)
      resolve()
    } catch (error) {
      console.error(error)
      reject('二维码生成依赖安装失败，请重新安装本插件')
    }
  })
}

function getQRCode(rawUrl, rawStr) {
  return new Promise((resolve) => {
    QRCode.toDataURL(rawStr, async (err, url) => {
      resolve({ url: rawUrl, qrcode: url })
    })
  })
}

async function getIPAddress() {
  const isWindows = Plugins.useEnvStore().env.os === 'windows'
  const cmd = isWindows ? 'ipconfig' : 'ip'
  const arg = isWindows ? [] : ['a']
  const text = await Plugins.Exec(cmd, arg, { convert: isWindows })
  const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
  let ips = text.match(ipv4Pattern) || []
  ips.unshift('127.0.0.1')
  ips = ips.filter((ip) => {
    return !ip.startsWith('255') && !ip.endsWith('255')
  })
  return [...new Set(ips)]
}
