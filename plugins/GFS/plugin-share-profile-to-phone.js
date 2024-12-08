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
  // 旧配置
  if (_profile.tunConfig) {
    // * 开启TUN
    _profile.tunConfig.enable = true
    // * 替换本地规则集为远程规则集（仅从规则集中心添加的可替换）
    ;[..._profile.dnsRulesConfig, ..._profile.rulesConfig].forEach((rule) => {
      if (rule.type === 'rule_set') {
        // 符合这一规则的说明是从规则集中心添加的，可以安全的转为远程规则集
        if (rule.payload.startsWith('geosite_') || rule.payload.startsWith('geoip_')) {
          rule.type = 'rule_set_url'
          rule['ruleset-name'] = rule.payload
          rule.payload = rule.payload.replace('geosite_', 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo-lite/geosite/')
          rule.payload = rule.payload.replace('geoip_', 'https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@sing/geo-lite/geoip/')
          rule.payload = rule.payload.replace('.binary', '.srs')
          rule.payload = rule.payload.replace('.source', '.json')
        }
      }
    })
  }
  // 新配置
  else {
    // * 开启TUN
    let tun = _profile.inbounds.find((v) => v.type === 'tun')
    const mixed = _profile.inbounds.find((v) => v.type === 'mixed')
    const http = _profile.inbounds.find((v) => v.type === 'http')
    if (!tun) {
      tun = {
        id: Plugins.sampleID(),
        type: 'tun',
        tag: 'tun-in',
        enable: true,
        tun: {
          address: ['172.18.0.1/30', 'fdfe:dcba:9876::1/126'],
          mtu: 9000,
          auto_route: true,
          strict_route: true,
          route_address: ['0.0.0.0/1', '128.0.0.0/1', '::/1', '8000::/1'],
          endpoint_independent_nat: false,
          stack: 'mixed'
        }
      }
      _profile.inbounds.push(tun)
    }
    tun.enable = true
    if (mixed) {
      tun.tun.platform = {
        http_proxy: {
          enabled: false,
          server: '127.0.0.1',
          server_port: mixed.mixed.listen.listen_port
        }
      }
    } else if (http) {
      tun.tun.platform = {
        http_proxy: {
          enabled: false,
          server: '127.0.0.1',
          server_port: http.http.listen.listen_port
        }
      }
    }
    // * 替换本地规则集为远程规则集
    const rulesetsStore = Plugins.useRulesetsStore()
    for (const ruleset of _profile.route.rule_set) {
      if (ruleset.type === 'local') {
        const _ruleset = rulesetsStore.getRulesetById(ruleset.path)
        if (_ruleset) {
          if (_ruleset.type === 'Http') {
            ruleset.type = 'remote'
            ruleset.url = _ruleset.url
            ruleset.path = ''
          } else if (_ruleset.type === 'File') {
            if (_ruleset.format === 'source') {
              const _rules = JSON.parse(await Plugins.Readfile(_ruleset.path)).rules
              ruleset.type = 'inline'
              ruleset.rules = JSON.stringify(_rules)
              ruleset.url = ''
              ruleset.path = ''
            }
          }
        }
      }
    }
  }

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
  const os = Plugins.useEnvStore().env.os
  const cmd = {
    windows: 'ipconfig',
    linux: 'ip',
    darwin: 'ifconfig'
  }[os]
  const arg = {
    windows: [],
    linux: ['a'],
    darwin: []
  }[os]
  const text = await Plugins.Exec(cmd, arg, { convert: os === 'windows' })
  const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
  let ips = text.match(ipv4Pattern) || []
  ips.unshift('127.0.0.1')
  ips = ips.filter((ip) => {
    return !ip.startsWith('255') && !ip.endsWith('255')
  })
  return [...new Set(ips)]
}
