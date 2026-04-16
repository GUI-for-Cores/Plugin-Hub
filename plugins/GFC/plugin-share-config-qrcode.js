import * as QRCode from 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm'

/* 触发器 手动触发 */
const onRun = async () => {
  const profilesStore = Plugins.useProfilesStore()
  if (profilesStore.profiles.length === 0) {
    throw '请先创建一个配置'
  }

  let profile = null
  if (profilesStore.profiles.length === 1) {
    profile = profilesStore.profiles[0]
  } else {
    profile = await Plugins.picker.single(
      '请选择要分享的配置',
      profilesStore.profiles.map((v) => ({
        label: v.name,
        value: v
      })),
      [profilesStore.profiles[0]]
    )
  }

  if (!profile) return
  await share(Plugins.deepClone(profile))
}

const share = async (profile) => {
  const port = Plugin.Port && Plugin.Port !== 'undefined' && Plugin.Port !== '' ? Plugin.Port : '18963'

  // 1. 条件继承 TUN：PC 端已启用则补全手机端必要字段，否则原样保留
  //    未启用 TUN 时 CMFA 通过 Android VPN Service 按钮控制流量，无需干预
  if (profile.tunConfig?.enable) {
    profile.tunConfig.stack = 'mixed'
    profile.tunConfig['auto-route'] = true
    profile.tunConfig['auto-detect-interface'] = true
    profile.tunConfig['dns-hijack'] = profile.tunConfig['dns-hijack']?.length ? profile.tunConfig['dns-hijack'] : ['any:53']
    profile.tunConfig['strict-route'] = true
  }

  // 2. 替换本地规则集为远程规则集
  const rulesetsStore = Plugins.useRulesetsStore()
  for (const rule of profile.rulesConfig || []) {
    if (rule.type !== 'RULE-SET' || !rule.enable) continue
    if (rule['ruleset-type'] === 'file' && rule.payload) {
      const ruleset = rulesetsStore.getRulesetById(rule.payload)
      if (ruleset && ruleset.type === 'Http' && ruleset.url) {
        rule['ruleset-type'] = 'http'
        rule['ruleset-name'] = ruleset.name || rule.payload
        rule['ruleset-format'] = ruleset.format || rule['ruleset-format']
        rule['ruleset-behavior'] = ruleset.behavior || rule['ruleset-behavior']
        rule.payload = ruleset.url
      }
    }
  }

  // 3. 生成 Mihomo 配置
  const config = await Plugins.generateConfig(profile)

  // 4. 消除 proxy-providers：全部内联节点，展开 use 引用
  //    展开失败时：有 URL 则降级为 http 类型保留，无 URL 则报错要求先更新订阅
  const subscribesStore = Plugins.useSubscribesStore()
  if (config['proxy-providers']) {
    const existingNames = new Set((config.proxies || []).map((p) => p.name))
    const failedProviders = []

    for (const [id, provider] of Object.entries(config['proxy-providers'])) {
      const sub = subscribesStore.getSubscribeById(id)
      const subPath = sub ? sub.path : provider.path?.replace(/^\.\.\//, 'data/')
      let providerProxyNames = []
      let inlined = false

      if (subPath) {
        try {
          const content = await Plugins.ReadFile(subPath)
          const parsed = Plugins.YAML.parse(content)
          const proxies = parsed.proxies || []
          for (const proxy of proxies) {
            if (!existingNames.has(proxy.name)) {
              config.proxies = config.proxies || []
              config.proxies.push(proxy)
              existingNames.add(proxy.name)
            }
          }
          providerProxyNames = proxies.map((p) => p.name)
          inlined = true
        } catch (e) {
          console.warn(`无法读取订阅 ${id} 的缓存:`, e)
        }
      }

      if (inlined) {
        delete config['proxy-providers'][id]
        for (const group of config['proxy-groups'] || []) {
          if (group.use && group.use.includes(id)) {
            group.use = group.use.filter((u) => u !== id)
            if (group.use.length === 0) delete group.use
            group.proxies = group.proxies || []
            group.proxies.push(...providerProxyNames.filter((n) => !group.proxies.includes(n)))
          }
        }
      } else if (provider.url) {
        const { path: _path, ...rest } = provider
        config['proxy-providers'][id] = { ...rest, type: 'http' }
      } else {
        failedProviders.push(id)
      }
    }

    if (failedProviders.length > 0) {
      throw `以下订阅没有缓存也没有远程 URL，无法导出到手机端：${failedProviders.join(', ')}。请先更新订阅后重试。`
    }

    if (Object.keys(config['proxy-providers']).length === 0) {
      delete config['proxy-providers']
    }
  }

  // 5. 兜底：检查 rule-providers 中残留的 file 类型
  if (config['rule-providers']) {
    for (const [name, provider] of Object.entries(config['rule-providers'])) {
      if (provider.type !== 'file') continue
      const ruleset = rulesetsStore.rulesets.find((r) => r.name === name || r.id === name)
      if (ruleset && ruleset.type === 'Http' && ruleset.url) {
        provider.type = 'http'
        provider.url = ruleset.url
        provider.interval = 86400
        delete provider.path
      }
    }
  }

  // 6. CMFA 只显示 GLOBAL 组引用的代理组，确保自定义组可见
  const groups = config['proxy-groups'] || []
  const globalGroup = groups.find((g) => g.name === 'GLOBAL')
  if (globalGroup) {
    const globalProxies = new Set(globalGroup.proxies || [])
    for (const group of groups) {
      if (group === globalGroup || group.hidden) continue
      if (!globalProxies.has(group.name)) {
        globalGroup.proxies = globalGroup.proxies || []
        globalGroup.proxies.push(group.name)
      }
    }
  }

  // 7. 清理 PC 专属配置
  delete config.secret
  config['external-controller'] = '127.0.0.1:9090'
  config['allow-lan'] = false

  // 8. DNS 适配
  //    a) 只要 DNS 启用，无论是否 TUN，都必须保证 proxy-server-nameserver 存在
  //       否则 Mihomo 用 DoT/DoH 解析代理节点域名时会经过代理路由，形成死循环
  if (config.dns?.enable) {
    if (!config.dns['proxy-server-nameserver']?.length) {
      config.dns['proxy-server-nameserver'] = ['223.5.5.5', '119.29.29.29']
    }
  }
  //    b) TUN 模式额外要求：强制启用 DNS 并补全所有 bootstrap 字段
  if (profile.tunConfig?.enable) {
    config.dns = config.dns || {}
    config.dns.enable = true
    if (!config.dns['default-nameserver']?.length) {
      config.dns['default-nameserver'] = ['223.5.5.5', '119.29.29.29']
    }
    if (!config.dns['proxy-server-nameserver']?.length) {
      config.dns['proxy-server-nameserver'] = ['223.5.5.5', '119.29.29.29']
    }
    if (!config.dns.nameserver?.length) {
      config.dns.nameserver = ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query']
    }
  }

  // 9. 最终校验：拒绝导出仍含 file 类型的 rule-providers
  const residualFileProviders = Object.entries(config['rule-providers'] || {})
    .filter(([, rp]) => rp.type === 'file')
    .map(([name]) => name)
  if (residualFileProviders.length > 0) {
    throw `以下 rule-providers 仍为本地文件类型，手机端无法访问：${residualFileProviders.join(', ')}。请将其配置为 http 类型后重试。`
  }

  const configYaml = Plugins.YAML.stringify(config)

  // 10. 获取本机局域网 IP 并启动 HTTP 服务
  const ips = await getIPAddress()
  if (ips.length === 0) throw '未找到局域网 IP 地址，请检查网络连接'

  const urls = await Promise.all(
    ips.map((ip) => {
      const url = `http://${ip}:${port}`
      return getQRCode(url, url)
    })
  )

  let close
  try {
    ;({ close } = await Plugins.StartServer('0.0.0.0:' + port, Plugin.id, async (req, res) => {
      res.end(200, { 'Content-Type': 'text/yaml; charset=utf-8' }, configYaml)
    }))
  } catch {
    throw `端口 ${port} 启动失败，可能已被占用。请修改插件端口配置后重试。`
  }

  try {
    await Plugins.alert(
      Plugin.name,
      '### 注意事项：\n\n' +
        ' - 请保证电脑和手机处于同一局域网内\n' +
        ' - 请关闭电脑防火墙或放行端口 ' +
        port +
        '\n' +
        ' - 扫描二维码后，若 CMFA 未自动导入，请复制链接手动添加\n' +
        ' - 如果仍无法导入，请更换不同二维码尝试\n\n' +
        '|分享链接|二维码|\n|-|-|\n' +
        urls.map((item) => `|${item.url}|![](${item.qrcode})|`).join('\n'),
      { type: 'markdown' }
    )
  } finally {
    close()
  }
}

/**
 * 生成二维码 Data URL
 */
function getQRCode(rawUrl, content) {
  return new Promise((resolve, reject) => {
    QRCode.toDataURL(content, { width: 256, margin: 2 }, (err, dataUrl) => {
      if (err) reject(err)
      else resolve({ url: rawUrl, qrcode: dataUrl })
    })
  })
}

/**
 * 判断是否为私有 IP
 */
function isPrivateIP(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const first = parseInt(parts[0], 10)
  const second = parseInt(parts[1], 10)
  const fourth = parseInt(parts[3], 10)
  if (first === 255 || fourth === 255) return false
  if (first === 10) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  return false
}

/**
 * 获取本机局域网 IP 列表
 */
async function getIPAddress() {
  const os = Plugins.useEnvStore().env.os
  const cmd = { windows: 'ipconfig', linux: 'ip', darwin: 'ifconfig' }[os]
  const arg = { windows: [], linux: ['a'], darwin: [] }[os]
  if (!cmd) throw `不支持的操作系统 "${os}"，无法自动获取局域网 IP`
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
