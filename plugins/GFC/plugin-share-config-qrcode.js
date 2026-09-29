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

  // 4. 消除 proxy-providers：按 Mihomo 的 filter/exclude-filter 语义内联节点并展开 use 引用。
  //    无法安全复现过滤时，有 URL 则保留为 http 类型；没有 URL 则明确中止分享。
  const subscribesStore = Plugins.useSubscribesStore()
  if (config['proxy-providers']) {
    const existingNames = new Set((config.proxies || []).map((p) => p.name))
    const failedProviders = []

    for (const [id, provider] of Object.entries(config['proxy-providers'])) {
      const sub = subscribesStore.getSubscribeById(id)
      const subPath = sub ? sub.path : provider.path?.replace(/^\.\.\//, 'data/')
      let providerProxies = []
      let inlineError = null
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
          providerProxies = proxies
          inlined = true
        } catch (e) {
          inlineError = e
          console.warn(`无法读取订阅 ${id} 的缓存或复现过滤条件:`, e)
        }
      }

      const groupProxyNames = []
      if (inlined) {
        try {
          for (const group of config['proxy-groups'] || []) {
            if (!Array.isArray(group.use) || !group.use.includes(id)) continue
            groupProxyNames.push([group, filterProviderProxyNames(providerProxies, provider, group, id)])
          }
        } catch (e) {
          inlineError = e
          inlined = false
          console.warn(`无法安全复现订阅 ${id} 的过滤条件:`, e)
        }
      }

      if (inlined) {
        delete config['proxy-providers'][id]
        for (const [group, proxyNames] of groupProxyNames) {
          group.use = group.use.filter((u) => u !== id)
          group.proxies = group.proxies || []
          group.proxies.push(...proxyNames.filter((name) => !group.proxies.includes(name)))

          // filter/exclude-filter 仅作用于 provider；所有 use 已展开后不应遗留到手机配置。
          if (group.use.length === 0) {
            delete group.use
            delete group.filter
            delete group['exclude-filter']
          }
        }
      } else if (provider.url) {
        const { path: _path, ...rest } = provider
        config['proxy-providers'][id] = { ...rest, type: 'http' }
      } else {
        failedProviders.push(inlineError ? `${id}（${inlineError?.message || inlineError}）` : id)
      }
    }

    if (failedProviders.length > 0) {
      throw `以下订阅无法安全内联且没有远程 URL，无法导出到手机端：${failedProviders.join(', ')}。请先更新订阅或修正过滤表达式后重试。`
    }

    if (Object.keys(config['proxy-providers']).length === 0) {
      delete config['proxy-providers']
    }
  }

  // 5. 兜底：检查 rule-providers 中残留的 file 类型
  if (config['rule-providers']) {
    for (const [name, provider] of Object.entries(config['rule-providers'])) {
      if (provider.type !== 'file') continue
      const ruleset = findRuleset(rulesetsStore.rulesets, name, provider)
      if (ruleset && ruleset.type === 'Http' && ruleset.url) {
        provider.type = 'http'
        provider.url = ruleset.url
        provider.interval = 86400
        delete provider.path
      }
    }
  }

  // 6. 对无法转换为 HTTP 的本地 YAML/文本 rule-provider 做受限内联。
  //    仅在规则可完整解析时继续导出；MRS、不可读文件或未知格式仍中止分享。
  if (config['rule-providers']) {
    const localProviderNames = new Set(
      Object.entries(config['rule-providers'])
        .filter(([, provider]) => provider.type === 'file')
        .map(([name]) => name)
    )
    const expandedRules = []
    const failedLocalRules = []

    for (const rawRule of config.rules || []) {
      const parts = typeof rawRule === 'string' ? rawRule.split(',') : Array.isArray(rawRule) ? rawRule : []
      if (parts[0] !== 'RULE-SET' || !localProviderNames.has(parts[1])) {
        expandedRules.push(rawRule)
        continue
      }

      const providerName = parts[1]
      const provider = config['rule-providers'][providerName]
      const ruleset = findRuleset(rulesetsStore.rulesets, providerName, provider)
      const path = normalizeRulesetPath(ruleset?.path || provider?.path)
      const isMRS = ruleset?.format === 'mrs' || /\.mrs$/i.test(path)
      if (!path || isMRS) {
        failedLocalRules.push(`${providerName}（仅支持 YAML/文本规则，不支持 MRS 二进制规则）`)
        continue
      }

      try {
        const content = await Plugins.ReadFile(path)
        const payload = parseLocalYamlRules(content)
        if (!payload.length) throw new Error('规则为空或格式不受支持')
        const target = parts.slice(2).join(',')
        for (const item of payload) {
          const rule = normalizeMihomoRule(item, ruleset?.behavior || 'classical')
          if (!rule) throw new Error(`无法转换规则：${item}`)
          expandedRules.push(target ? `${rule},${target}` : rule)
        }
        delete config['rule-providers'][providerName]
      } catch (e) {
        failedLocalRules.push(`${providerName}（${e?.message || e}）`)
      }
    }

    if (failedLocalRules.length) {
      throw `以下本地规则无法内联，未生成分享配置：${failedLocalRules.join('；')}`
    }
    config.rules = expandedRules
    if (Object.keys(config['rule-providers']).length === 0) {
      delete config['rule-providers']
    }
  }

  // 7. CMFA 只显示 GLOBAL 组引用的代理组，确保自定义组可见
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

  // 8. 清理 PC 专属配置
  delete config.secret
  config['external-controller'] = '127.0.0.1:9090'
  config['allow-lan'] = false

  // 9. DNS 适配
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

  // 10. 最终校验：拒绝导出仍含 file 类型的 rule-providers
  const residualFileProviders = Object.entries(config['rule-providers'] || {})
    .filter(([, rp]) => rp.type === 'file')
    .map(([name]) => name)
  if (residualFileProviders.length > 0) {
    throw `以下 rule-providers 仍为本地文件类型，手机端无法访问：${residualFileProviders.join(', ')}。请将其配置为 http 类型后重试。`
  }

  const configYaml = Plugins.YAML.stringify(config)

  // 11. 获取本机局域网 IP 并启动 HTTP 服务
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

function compileProxyNameFilter(pattern, label) {
  if (pattern === undefined || pattern === null || pattern === '') return null
  try {
    return new RegExp(String(pattern))
  } catch (e) {
    throw new Error(`${label} 正则无效，无法安全内联订阅节点：${e?.message || e}`)
  }
}

function filterProviderProxyNames(proxies, provider, group, providerId) {
  const providerName = providerId || '未命名订阅'
  const groupName = group.name || '未命名策略组'
  const providerFilter = compileProxyNameFilter(provider.filter, `订阅 ${providerName} 的 filter`)
  const providerExclude = compileProxyNameFilter(provider['exclude-filter'], `订阅 ${providerName} 的 exclude-filter`)
  const groupFilter = compileProxyNameFilter(group.filter, `策略组 ${groupName} 的 filter`)
  const groupExclude = compileProxyNameFilter(group['exclude-filter'], `策略组 ${groupName} 的 exclude-filter`)

  return proxies
    .map((proxy) => String(proxy?.name || ''))
    .filter(Boolean)
    .filter((name) => !providerFilter || providerFilter.test(name))
    .filter((name) => !providerExclude || !providerExclude.test(name))
    .filter((name) => !groupFilter || groupFilter.test(name))
    .filter((name) => !groupExclude || !groupExclude.test(name))
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
function normalizeRulesetPath(value) {
  const path = String(value || '').replace(/\\/g, '/')
  if (path.startsWith('../data/')) return path.slice(3)
  if (path.startsWith('../')) return `data/${path.slice(3)}`
  return path.replace(/^\.\//, '')
}

function findRuleset(rulesets, providerName, provider) {
  const items = Array.isArray(rulesets) ? rulesets : []
  const clean = (value) =>
    String(value || '')
      .replace(/[^\p{L}\p{N}]+/gu, '')
      .toLowerCase()
  const wanted = clean(providerName)
  const providerPath = normalizeRulesetPath(provider?.path)

  // 精确匹配优先，避免近似名称覆盖准确 ID。
  const exact = items.find((r) => r.id === providerName || r.name === providerName)
  if (exact) return exact

  if (providerPath) {
    const pathMatched = items.find((r) => normalizeRulesetPath(r.path) === providerPath)
    if (pathMatched) return pathMatched
  }

  if (wanted) {
    return items.find((r) => clean(r.id) === wanted || clean(r.name) === wanted)
  }
}

function parseLocalYamlRules(content) {
  const text = String(content || '').trim()
  if (!text) return []
  const toRuleLines = (values) => values.map((value) => String(value).trim().replace(/^-\s+/, '')).filter(isRuleLine)

  try {
    const parsed = Plugins.YAML.parse(text)
    if (Array.isArray(parsed)) return toRuleLines(parsed)
    if (Array.isArray(parsed?.payload)) return toRuleLines(parsed.payload)
    if (Array.isArray(parsed?.rules)) return toRuleLines(parsed.rules)
    // YAML 已解析但没有可识别规则字段时，不将键名误当作规则行。
    if (parsed && typeof parsed === 'object') return []
  } catch (_) {}

  return toRuleLines(text.split(/\r?\n/))
}

function isRuleLine(line) {
  const value = String(line).trim()
  return Boolean(value) && !value.startsWith('#') && !value.startsWith(';') && !value.startsWith('//') && value !== 'payload:' && value !== 'rules:'
}

function normalizeMihomoRule(value, behavior) {
  const line = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
  if (!line) return null
  if (line.includes(',')) return line
  if (behavior === 'domain') return line.startsWith('+.') ? `DOMAIN-SUFFIX,${line.slice(2)}` : `DOMAIN,${line}`
  if (behavior === 'ipcidr') return line.includes(':') ? `IP-CIDR6,${line}` : `IP-CIDR,${line}`
  return null
}

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
