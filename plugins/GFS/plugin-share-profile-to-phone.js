const JS_FILE = 'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.js'
const PATH = 'data/third/share-profile-to-phone'

/* 触发器 手动触发 */
const onRun = async () => {
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
      [store.profiles[0]]
    )
  }
  await Share(Plugins.deepClone(profile))
}

const Share = async (profile) => {
  await loadDependence()
  // 旧配置
  if (profile.tunConfig) {
    const ok = await Plugins.confirm('提示', '你正在使用旧版客户端，请升级至新版以获取完整支持！', { cancelText: '继续使用旧版', okText: '好的' }).catch(
      () => false
    )
    if (ok) return
    // * 开启TUN
    profile.tunConfig.enable = true
    // * 替换本地规则集为远程规则集（仅从规则集中心添加的可替换）
    ;[...profile.dnsRulesConfig, ...profile.rulesConfig].forEach((rule) => {
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
    let tun = profile.inbounds.find((v) => v.type === 'tun')
    let mixed = profile.inbounds.find((v) => v.type === 'mixed')
    const http = profile.inbounds.find((v) => v.type === 'http')
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
          endpoint_independent_nat: false,
          stack: 'mixed'
        }
      }
      profile.inbounds.push(tun)
    }
    tun.enable = true
    if (mixed) {
      tun.tun.platform = {
        http_proxy: {
          enabled: true,
          server: '127.0.0.1',
          server_port: mixed.mixed.listen.listen_port
        }
      }
    } else if (http) {
      tun.tun.platform = {
        http_proxy: {
          enabled: true,
          server: '127.0.0.1',
          server_port: http.http.listen.listen_port
        }
      }
    } else {
      mixed = {
        id: Plugins.sampleID(),
        tag: 'mixed-in',
        type: 'mixed',
        enable: true,
        mixed: {
          listen: {
            listen: '127.0.0.1',
            listen_port: 20122
          },
          users: []
        }
      }
      profile.inbounds.push(mixed)
      tun.tun.platform = {
        http_proxy: {
          enabled: true,
          server: '127.0.0.1',
          server_port: mixed.mixed.listen.listen_port
        }
      }
    }
    // * 替换本地规则集为远程规则集
    const rulesetsStore = Plugins.useRulesetsStore()
    for (const ruleset of profile.route.rule_set) {
      if (ruleset.type === 'local') {
        const _ruleset = rulesetsStore.getRulesetById(ruleset.path)
        if (_ruleset) {
          if (_ruleset.type === 'Http') {
            ruleset.type = 'remote'
            ruleset.url = _ruleset.url
            ruleset.path = ''
          } else if (['File', 'Manual'].includes(_ruleset.type)) {
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

  const type = await Plugins.picker.single(
    '生成的配置类型',
    [
      { label: 'v1.11.0之前版本', value: 'legacy' },
      { label: '稳定版(v1.11.0+)', value: 'stable' },
      { label: '内测版(v1.12.0+)', value: 'alpha' }
    ],
    ['stable']
  )
  const config = await Plugins.generateConfig(profile, type === 'stable' || type === 'legacy')
  if (type === 'legacy') {
    _adaptToLegacy(config)
  }
  // 新配置且禁用IPv6
  if (!profile.tunConfig && Plugin.Ipv6Mode === 'disabled') {
    config.dns.strategy = 'ipv4_only'
    config.inbounds.forEach((inbound) => {
      if (inbound.type === 'tun') {
        inbound.address = inbound.address.filter((address) => Plugins.isValidIPv4(address.split('/')[0]))
      }
    })
    config.dns.rules.forEach((rule) => {
      if (rule.strategy) rule.strategy = 'ipv4_only'
    })
    config.route.rules.forEach((rule) => {
      if (rule.strategy) rule.strategy = 'ipv4_only'
    })
  }
  const ips = await getIPAddress()
  const urls = await Promise.all(
    ips.map((ip) => {
      const url = `http://${ip}:${Plugin.Port}`
      return getQRCode(url, `sing-box://import-remote-profile?url=${encodeURIComponent(url)}#${profile.name}`)
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

const _adaptToLegacy = (config) => {
  config.outbounds.push(
    {
      type: 'direct',
      tag: 'direct'
    },
    {
      type: 'dns',
      tag: 'dns-out'
    },
    {
      type: 'block',
      tag: 'block'
    }
  )
  config.route.rules = config.route.rules.flatMap((rule) => {
    if (rule.action === 'sniff') {
      if (rule.inbound) {
        const inbound = config.inbounds.find((v) => v.tag === rule.inbound)
        if (inbound) {
          inbound.sniff = true
        }
      }
      return []
    } else if (rule.action === 'resolve') {
      if (rule.inbound) {
        const inbound = config.inbounds.find((v) => v.tag === rule.inbound)
        if (inbound) {
          inbound.domain_strategy = rule.strategy
        }
      }
      return []
    } else if (rule.action === 'reject') {
      rule.outbound = 'block'
    } else if (rule.action === 'hijack-dns') {
      rule.outbound = 'dns-out'
    }
    rule.action = undefined
    return rule
  })

  config.dns.rules.forEach((rule) => {
    if (rule.action === 'reject') {
      rule.outbound = 'block'
    }
    rule.action = undefined
  })
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

function isPrivateIP(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const first = parseInt(parts[0], 10)
  const second = parseInt(parts[1], 10)
  const fourth = parseInt(parts[3], 10)
  if (first === 255 || fourth === 1 || fourth === 255) return false
  // Check 10.0.0.0/8 (10.x.x.x)
  if (first === 10) return true
  // Check 172.16.0.0/12 (172.16.x.x to 172.31.x.x)
  if (first === 172 && second >= 16 && second <= 31) return true
  // Check 192.168.0.0/16 (192.168.x.x)
  if (first === 192 && second === 168) return true
  return false
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
  ips = ips.filter((ip) => isPrivateIP(ip))

  const getPriority = (ip) => {
    if (ip.startsWith('192.')) return 0
    if (ip.startsWith('10.')) return 1
    if (ip.startsWith('172.')) return 2
    return 3
  }
  return [...new Set(ips)].sort((a, b) => getPriority(a) - getPriority(b))
}
