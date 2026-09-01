import * as QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm'

/** @type {EsmPlugin} */
export default (Plugin) => {
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
    // * 开启TUN
    let tun = profile.inbounds.find((v) => v.type === 'tun')
    const mixed = profile.inbounds.find((v) => v.type === 'mixed' && v.enable)
    const http = profile.inbounds.find((v) => v.type === 'http' && v.enable)
    const inbound = mixed || http
    if (!tun) {
      tun = {
        id: Plugins.sampleID(),
        type: 'tun',
        tag: 'tun-in',
        enable: true,
        tun: {
          address: ['172.18.0.1/30', 'fdfe:dcba:9876::1/126'],
          mtu: 0,
          auto_route: true,
          strict_route: true,
          endpoint_independent_nat: false,
          stack: 'mixed'
        }
      }
      profile.inbounds.push(tun)
    }
    tun.enable = true
    if (inbound) {
      const port = inbound.type === 'mixed' ? inbound.mixed.listen.listen_port : inbound.http.listen.listen_port
      tun.tun.platform = {
        http_proxy: {
          enabled: true,
          server: '127.0.0.1',
          server_port: port
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
              const _rules = JSON.parse(await Plugins.ReadFile(_ruleset.path)).rules
              ruleset.type = 'inline'
              ruleset.rules = JSON.stringify(_rules)
              ruleset.url = ''
              ruleset.path = ''
            }
          }
        }
      }
    }

    const version = await Plugins.picker.single(
      '生成的配置版本',
      [
        { label: '更老版本已不再支持，请更新至1.14+', value: 1 },
        { label: '稳定版(v1.14.0+)', value: 3 }
      ],
      [3]
    )
    const config = await Plugins.generateConfig(profile)
    if (version !== 3) {
      throw '请选择更新的版本'
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
    await Plugins.alert(
      Plugin.name,
      '### 注意事项： \n\n - 请保证电脑和手机处于同一局域网内\n - 请关闭电脑防火墙\n - 如果仍无法导入，请更换不同二维码尝试\n\n|分享链接|二维码|\n|-|-|\n' +
        urls.map((url) => `|${url.url}|![](${url.qrcode})|`).join('\n'),
      { type: 'markdown' }
    )
    close()
  }

  return { onRun, Share }
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
  const text = await Plugins.Exec(cmd, arg, { Convert: os === 'windows' })
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
