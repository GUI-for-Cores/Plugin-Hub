// @ts-ignore
window[Plugin.id] = window[Plugin.id] || {}

// 常量和枚举定义
const RequestMethod = {
  Get: 'GET',
  Post: 'POST',
  Delete: 'DELETE',
  Put: 'PUT',
  Head: 'HEAD',
  Patch: 'PATCH'
}

const LogLevel = {
  Trace: 'trace',
  Debug: 'debug',
  Info: 'info',
  Warn: 'warn',
  Error: 'error',
  Fatal: 'fatal',
  Panic: 'panic'
}

const ClashMode = {
  Global: 'global',
  Rule: 'rule',
  Direct: 'direct'
}

const TunStack = {
  System: 'system',
  GVisor: 'gvisor',
  Mixed: 'mixed'
}

const RulesetType = {
  Inline: 'inline',
  Local: 'local',
  Remote: 'remote'
}

const RulesetFormat = {
  Source: 'source',
  Binary: 'binary'
}

const Inbound = {
  Mixed: 'mixed',
  Socks: 'socks',
  Http: 'http',
  Tun: 'tun'
}

const Outbound = {
  Direct: 'direct',
  Selector: 'selector',
  Urltest: 'urltest'
}

const RuleType = {
  Inbound: 'inbound',
  Network: 'network',
  Protocol: 'protocol',
  Domain: 'domain',
  DomainSuffix: 'domain_suffix',
  DomainKeyword: 'domain_keyword',
  DomainRegex: 'domain_regex',
  SourceIPCidr: 'source_ip_cidr',
  IPCidr: 'ip_cidr',
  SourcePort: 'source_port',
  SourcePortRange: 'source_port_range',
  Port: 'port',
  PortRange: 'port_range',
  ProcessName: 'process_name',
  ProcessPath: 'process_path',
  ProcessPathRegex: 'process_path_regex',
  RuleSet: 'rule_set',
  IpIsPrivate: 'ip_is_private',
  ClashMode: 'clash_mode',
  IpAcceptAny: 'ip_accept_any',
  Inline: 'inline'
}

const RuleAction = {
  Route: 'route',
  RouteOptions: 'route-options',
  Reject: 'reject',
  HijackDNS: 'hijack-dns',
  Sniff: 'sniff',
  Resolve: 'resolve',
  Predefined: 'predefined'
}

const DnsServer = {
  Local: 'local',
  Hosts: 'hosts',
  Tcp: 'tcp',
  Udp: 'udp',
  Tls: 'tls',
  Https: 'https',
  Quic: 'quic',
  H3: 'h3',
  Dhcp: 'dhcp',
  FakeIP: 'fakeip'
}

const Strategy = {
  Default: 'default',
  PreferIPv4: 'prefer_ipv4',
  PreferIPv6: 'prefer_ipv6',
  IPv4Only: 'ipv4_only',
  IPv6Only: 'ipv6_only'
}

const SubscribeType = {
  Http: 'Http',
  Local: 'File',
  Manual: 'Manual'
}

const ImportType = { Local: 'local', Remote: 'remote' }

const DefaultTunAddress = ['172.18.0.1/30', 'fdfe:dcba:9876::1/126']

const DefaultTestURL = 'https://www.gstatic.com/generate_204'

const DefaultExcludeProtocols = 'direct|reject|selector|urltest|block|dns|shadowsocksr'

const DefaultSubscribeScript = `const onSubscribe = async (proxies, subscription) => {\n  return { proxies, subscription }\n}`

// 默认值生成函数
const DefaultLog = () => ({
  disabled: false,
  level: LogLevel.Info,
  output: '',
  timestamp: false
})

const DefaultExperimental = () => ({
  clash_api: {
    external_controller: '127.0.0.1:20123',
    external_ui: '',
    external_ui_download_url: '',
    external_ui_download_detour: '',
    secret: '',
    default_mode: ClashMode.Rule,
    access_control_allow_origin: ['*'],
    access_control_allow_private_network: false
  },
  cache_file: {
    enabled: true,
    path: 'cache.db',
    cache_id: '',
    store_fakeip: true,
    store_rdrc: true,
    rdrc_timeout: '7d'
  }
})

const DefaultMixin = () => ({
  priority: 'gui',
  format: 'json',
  config: '{}'
})
const DefaultScript = () => ({
  code: `const onGenerate = async (config) => {\n  return config\n}`
})

/* 打开文件选择器 */
const selectFile = (options = {}) => {
  return new Promise((resolve) => {
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.style.display = 'none'
    fileInput.multiple = options.multiple ?? false
    fileInput.accept = options.accept ?? ''

    const cleanup = () => {
      window.removeEventListener('focus', onFocus)
      document.body.removeChild(fileInput)
    }

    const onFocus = () => {
      requestAnimationFrame(() => {
        if (fileInput.files.length === 0) {
          resolve(null)
          cleanup()
        }
      })
    }

    fileInput.addEventListener('change', () => {
      resolve(fileInput.files.length > 0 ? fileInput.files : null)
      cleanup()
    })

    window.addEventListener('focus', onFocus, { once: true })
    document.body.appendChild(fileInput)
    fileInput.click()
  })
}

/* 读取单个文件并解析 */
const readAndParseSelectedFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result
        resolve(JSON.parse(String(text)))
      } catch (err) {
        reject(`文件 "${file.name}" 解析失败: ${err.message || err}`)
      }
    }
    reader.onerror = () => reject(`无法读取文件 "${file.name}"`)
    reader.readAsText(file)
  })
}

/* 将原始配置解析为 GUI 格式 */
class ConfigParser {
  constructor(originConfig) {
    this.origConfig = originConfig
    // 初始化 GUI 配置对象
    this.guiProfile = {
      id: Plugins.sampleID(),
      name: '',
      log: DefaultLog(),
      experimental: DefaultExperimental(),
      inbounds: [],
      outbounds: [],
      route: {
        rule_set: [],
        rules: [],
        auto_detect_interface: true,
        find_process: false,
        default_interface: '',
        final: '',
        default_domain_resolver: { server: '', client_subnet: '' }
      },
      dns: {
        servers: [],
        rules: [],
        disable_cache: false,
        disable_expire: false,
        independent_cache: false,
        client_subnet: '',
        final: '',
        strategy: Strategy.Default
      },
      mixin: DefaultMixin(),
      script: DefaultScript()
    }
  }

  /* 解析通用设置 */
  parseGeneral() {
    // @ts-ignore
    const outboundTagToId = window[Plugin.id]?.outboundTagToId || {}
    const { log, experimental } = this.origConfig

    this.guiProfile.log = { ...DefaultLog(), ...log }

    if (!experimental) return

    const { clash_api, cache_file } = experimental
    const defaultExperimental = DefaultExperimental()

    if (clash_api) {
      this.guiProfile.experimental.clash_api = {
        ...defaultExperimental.clash_api,
        ...clash_api,
        // 单独处理特殊属性
        external_ui_download_detour: outboundTagToId[clash_api.external_ui_download_detour] ?? '',
        // `secret` 若未提供，则动态生成
        // @ts-ignore
        secret: clash_api.secret ?? Plugins.generateSecureKey()
      }
    }

    if (cache_file) {
      this.guiProfile.experimental.cache_file = { ...defaultExperimental.cache_file, ...cache_file }
    }
  }

  /* 解析入站设置 */
  parseInbounds() {
    const supportedTypes = new Set(Object.values(Inbound))
    // @ts-ignore
    const inboundTagToId = window[Plugin.id].inboundTagToId

    this.guiProfile.inbounds = (this.origConfig.inbounds ?? [])
      .filter((ib) => supportedTypes.has(ib.type))
      .map((ib, idx) => {
        const newId = Plugins.sampleID()
        inboundTagToId[ib.tag] = newId

        const baseInbound = { id: newId, tag: ib.tag, type: ib.type, enable: true }

        if (ib.type === Inbound.Tun) {
          return {
            ...baseInbound,
            tun: {
              interface_name: ib.interface_name ?? '',
              address: ib.address || DefaultTunAddress,
              mtu: ib.mtu ?? 9000,
              auto_route: ib.auto_route ?? true,
              strict_route: ib.strict_route ?? true,
              route_address: ib.route_address ?? [],
              route_exclude_address: ib.route_exclude_address ?? [],
              endpoint_independent_nat: ib.endpoint_independent_nat ?? false,
              stack: ib.stack ?? TunStack.Mixed
            }
          }
        }

        return {
          ...baseInbound,
          [ib.type]: {
            listen: {
              listen: ib.listen ?? '127.0.0.1',
              listen_port: ib.listen_port ?? 20120 + idx,
              tcp_fast_open: ib.tcp_fast_open ?? false,
              tcp_multi_path: ib.tcp_multi_path ?? false,
              udp_fragment: ib.udp_fragment ?? false
            },
            users: (ib.users ?? []).map((u) => `${u.username}:${u.password}`)
          }
        }
      })
  }

  /* 解析出站设置 */
  parseOutbounds() {
    const supportedTypes = new Set(Object.values(Outbound))
    // @ts-ignore
    const { outboundTagToId, proxyTagToIdMap, subscribeId, subscribeName } = window[Plugin.id]
    const outbounds = (this.origConfig.outbounds ?? []).filter((ob) => supportedTypes.has(ob.type))

    outbounds.forEach((ob) => {
      outboundTagToId[ob.tag] = Plugins.sampleID()
    })

    this.guiProfile.outbounds = outbounds.map((ob) => {
      const guiOutbound = {
        id: outboundTagToId[ob.tag],
        tag: ob.tag,
        type: ob.type,
        outbounds: [],
        url: ob.url ?? DefaultTestURL,
        interval: ob.interval ?? '3m',
        tolerance: ob.tolerance ?? 150,
        interrupt_exist_connections: ob.interrupt_exist_connections ?? true,
        include: '',
        exclude: ''
      }

      if (ob.type === Outbound.Selector || ob.type === Outbound.Urltest) {
        guiOutbound.outbounds = (ob.outbounds ?? [])
          .map((tag) => {
            // 引用的是一个内置出站
            if (outboundTagToId[tag]) return { id: outboundTagToId[tag], tag, type: 'Built-in' }
            // 引用的是订阅中的节点
            if (proxyTagToIdMap[tag]) return { id: proxyTagToIdMap[tag], tag, type: subscribeId }
            return null
          })
          .filter(Boolean)

        // 如果出站引用了订阅中的所有节点，则简化为引用整个订阅
        const allProxyTagsInSub = Object.keys(proxyTagToIdMap)
        const outboundProxyTags = new Set(guiOutbound.outbounds.filter((o) => o.type === subscribeId).map((o) => o.tag))

        if (
          subscribeId &&
          allProxyTagsInSub.length > 0 &&
          outboundProxyTags.size === allProxyTagsInSub.length &&
          allProxyTagsInSub.every((tag) => outboundProxyTags.has(tag))
        ) {
          const nonSubOutbounds = guiOutbound.outbounds.filter((o) => o.type !== subscribeId)
          guiOutbound.outbounds = [{ id: subscribeId, tag: subscribeName, type: 'Subscription' }, ...nonSubOutbounds]
        }
      }
      return guiOutbound
    })
  }

  /* 格式化 hosts 类型的 predefined 属性 */
  _formatHostsPredefined(predefinedObject) {
    if (!predefinedObject || typeof predefinedObject !== 'object') {
      return {}
    }
    const formattedEntries = Object.entries(predefinedObject).map(([domain, ips]) => {
      const ipString = [].concat(ips).join(',')
      return [domain, ipString]
    })

    return Object.fromEntries(formattedEntries)
  }

  /* 交叉解析路由和 DNS */
  parseRouteAndDNS() {
    const { route, dns } = this.origConfig
    if (!route && !dns) return

    // @ts-ignore
    const { dnsServerTagToId, rulesetTagToId, outboundTagToId, inboundTagToId } = window[Plugin.id]

    ;(dns?.servers ?? []).forEach((s) => {
      dnsServerTagToId[s.tag] = Plugins.sampleID()
    })
    ;(route?.rule_set ?? []).forEach((rs) => {
      rulesetTagToId[rs.tag] = Plugins.sampleID()
    })

    const supportedDNSServerTypes = new Set(Object.values(DnsServer))
    this.guiProfile.dns.servers = (dns?.servers ?? [])
      .filter((s) => supportedDNSServerTypes.has(s.type))
      .map((s) => ({
        id: dnsServerTagToId[s.tag],
        tag: s.tag,
        type: s.type,
        detour: outboundTagToId[s.detour] ?? '',
        domain_resolver: dnsServerTagToId[s.domain_resolver] ?? '',
        server: s.address ?? s.server ?? '',
        server_port: String(s.server_port ?? ''),
        path: s.path ?? '',
        interface: s.interface ?? '',
        inet4_range: s.inet4_range ?? '198.18.0.0/15',
        inet6_range: s.inet6_range ?? 'fc00::/18',
        hosts_path: s.path ?? [],
        predefined: s.type === DnsServer.Hosts ? this._formatHostsPredefined(s.predefined) : {}
      }))

    this.guiProfile.route.rule_set = (route?.rule_set ?? []).map((rs) => ({
      id: rulesetTagToId[rs.tag],
      type: rs.type ?? RulesetType.Remote,
      tag: rs.tag,
      format: rs.format ?? RulesetFormat.Binary,
      url: rs.url ?? '',
      download_detour: outboundTagToId[rs.download_detour] ?? '',
      update_interval: rs.update_interval ?? '',
      rules: rs.rules ? JSON.stringify(rs.rules) : '',
      path: rs.path ?? ''
    }))

    const routeRuleMaps = { outbound: outboundTagToId, ruleset: rulesetTagToId, inbound: inboundTagToId }
    this.guiProfile.route.rules = (route?.rules ?? []).map((r) => this._parseRule(r, routeRuleMaps))

    const dnsRuleMaps = { server: dnsServerTagToId, ruleset: rulesetTagToId, inbound: inboundTagToId }
    this.guiProfile.dns.rules = (dns?.rules ?? []).map((r) => this._parseRule(r, dnsRuleMaps))

    if (route) {
      this.guiProfile.route.final = outboundTagToId[route.final] ?? ''
      this.guiProfile.route.auto_detect_interface = route.auto_detect_interface ?? true
      this.guiProfile.route.default_interface = route.default_interface ?? ''
      this.guiProfile.route.find_process = route.find_process ?? false
      this.guiProfile.route.default_domain_resolver.server = dnsServerTagToId[route.default_domain_resolver?.server] ?? ''
      this.guiProfile.route.default_domain_resolver.client_subnet = route.default_domain_resolver?.client_subnet ?? ''
    }
    if (dns) {
      this.guiProfile.dns.disable_cache = dns.disable_cache ?? false
      this.guiProfile.dns.disable_expire = dns.disable_expire ?? false
      this.guiProfile.dns.independent_cache = dns.independent_cache ?? false
      this.guiProfile.dns.client_subnet = dns.client_subnet ?? ''
      this.guiProfile.dns.final = dnsServerTagToId[dns.final] ?? ''
      this.guiProfile.dns.strategy = dns.strategy ?? Strategy.Default
    }
  }

  /* 解析规则的匹配条件部分 */
  _parseMatchingCondition(condition, maps) {
    const supportedTypes = new Set(Object.values(RuleType))
    const matchingTypeKeys = Object.keys(condition).filter((key) => supportedTypes.has(key))

    // 当只有一个匹配的类型时，视为简单规则
    if (matchingTypeKeys.length === 1) {
      const type = matchingTypeKeys[0]
      let payload = condition[type]

      if (type === RuleType.RuleSet && maps.ruleset) {
        payload = (Array.isArray(payload) ? payload : [payload])
          .map((tag) => maps.ruleset[tag])
          .filter(Boolean)
          .join(',')
      } else if (type === RuleType.Inbound && maps.inbound) {
        payload = maps.inbound[payload] ?? payload
      } else if (Array.isArray(payload)) {
        payload = payload.join(',')
      }
      return { type, payload: String(payload) }
    }

    // 其他所有情况（0个或多个类型，或不支持的类型）都视为内联规则
    return { type: RuleType.Inline, payload: JSON.stringify(condition) }
  }

  /* 解析单条规则（路由或DNS）*/
  _parseRule(rule, maps) {
    const {
      action = RuleAction.Route,
      outbound,
      server,
      invert = false,
      sniffer,
      method,
      strategy,
      disable_cache = false,
      client_subnet = '',
      rcode,
      answer,
      ns,
      extra,
      ...matchingCondition
    } = rule
    const { type, payload } = this._parseMatchingCondition(matchingCondition, maps)

    const guiRule = {
      id: Plugins.sampleID(),
      type,
      payload,
      invert,
      action,
      outbound: '',
      sniffer: [],
      strategy: Strategy.Default,
      server: '',
      disable_cache,
      client_subnet
    }

    if (action === RuleAction.Reject) {
      guiRule.server = method ?? 'default'
    } else if (action === RuleAction.Predefined) {
      const { rcode, answer, ns, extra } = rule
      guiRule.server = JSON.stringify({ rcode, answer, ns, extra })
    } else {
      guiRule.outbound = maps.outbound?.[outbound] ?? ''
      guiRule.server = maps.server?.[server] ?? ''
      guiRule.sniffer = sniffer ?? []
      guiRule.strategy = strategy ?? Strategy.Default
    }

    return guiRule
  }

  async process(fileName) {
    this.guiProfile.name = `${fileName.replace(/\.json$/, '')}-profile`
    this.parseInbounds()
    this.parseOutbounds()
    this.parseGeneral()
    this.parseRouteAndDNS()
    return this.guiProfile
  }
}

/* 导入 sing-box 的原始配置 */
class ConfigImporter {
  constructor(config, fileName) {
    this.config = config
    this.fileName = fileName
  }

  /* 提取配置中的节点部分 */
  _extractProxies() {
    if (!this.config.outbounds?.length) {
      throw '缺少有效出站配置'
    }
    const excludeTypes = new Set(DefaultExcludeProtocols.split('|'))
    const proxies = this.config.outbounds.filter((o) => !excludeTypes.has(o.type))

    this.config.outbounds = this.config.outbounds.filter((o) => excludeTypes.has(o.type))

    const proxyTagToIdMap = Object.fromEntries(proxies.map((p) => [p.tag, Plugins.sampleID()]))

    // @ts-ignore
    window[Plugin.id] = {
      // @ts-ignore
      proxyTagToIdMap,
      subscribeId: '',
      subscribeName: '',
      inboundTagToId: {},
      outboundTagToId: {},
      rulesetTagToId: {},
      dnsServerTagToId: {}
    }

    return proxies
  }

  /* 创建 GUI 订阅 */
  async _createSubscribe() {
    const proxies = this._extractProxies()
    if (proxies.length === 0) return

    const subscribesStore = Plugins.useSubscribesStore()
    const id = Plugins.sampleID()
    const name = `${this.fileName.replace(/\.json$/, '')}-nodes`
    const path = `data/subscribes/${name}.json`

    // @ts-ignore
    window[Plugin.id].subscribeId = id
    // @ts-ignore
    window[Plugin.id].subscribeName = name

    await Plugins.WriteFile(path, JSON.stringify(proxies, null, 2))

    await subscribesStore.addSubscribe({
      id,
      name,
      path,
      type: SubscribeType.Manual,
      updateTime: 0,
      upload: 0,
      download: 0,
      total: 0,
      expire: 0,
      url: '',
      website: '',
      include: '',
      exclude: '',
      includeProtocol: '',
      excludeProtocol: DefaultExcludeProtocols,
      proxyPrefix: '',
      disabled: false,
      inSecure: false,
      requestMethod: RequestMethod.Get,
      header: { request: {}, response: {} },
      // @ts-ignore
      proxies: proxies.map((p) => ({ id: window[Plugin.id].proxyTagToIdMap[p.tag], tag: p.tag, type: p.type })),
      script: DefaultSubscribeScript
    })
  }

  /* 创建 GUI 配置 */
  async _createProfile() {
    const profilesStore = Plugins.useProfilesStore()
    const parser = new ConfigParser(this.config)
    const guiProfile = await parser.process(this.fileName)
    await profilesStore.addProfile(guiProfile)
  }

  async process() {
    Plugins.message.info(`正在处理来自 "${this.fileName}" 的配置...`)
    await this._createSubscribe()
    await this._createProfile()
  }
}

/* 导入本地配置 */
const importLocalConfig = async () => {
  Plugins.message.info('请选择一个或多个 JSON 文件...')
  const files = await selectFile({ multiple: true, accept: '.json, application/json' })
  if (!files) {
    Plugins.message.warn('已取消文件选择或未选择任何文件')
    return
  }

  Plugins.message.info(`已选择 ${files.length} 个文件，开始解析和导入...`)
  const fileArray = Array.from(files)
  const results = await Promise.allSettled(fileArray.map(readAndParseSelectedFile))

  for (const [i, result] of results.entries()) {
    const fileName = fileArray[i].name
    if (result.status === 'fulfilled') {
      try {
        const importer = new ConfigImporter(result.value, fileName)
        await importer.process()
        Plugins.message.success(`文件 "${fileName}" 导入成功`)
      } catch (err) {
        Plugins.message.error(`处理文件 "${fileName}" 时发生错误: ${err.message || err}`)
      }
    } else {
      Plugins.message.error(result.reason.message || result.reason)
    }
  }
}

/* 获取并解析远程文件 */
const getAndParseRemoteFile = async (url) => {
  try {
    const { body } = await Plugins.HttpGet(url, { 'User-Agent': 'sing-box' })
    return JSON.parse(body)
  } catch (err) {
    throw `链接 "${url}" 解析失败: ${err.message || err}`
  }
}

/* 导入远程配置 */
const importRemoteConfig = async () => {
  const input = await Plugins.prompt('请输入配置链接：', '', { placeholder: 'http(s):// -- 多个链接请换行输入', type: 'code' })
  const urls =
    input
      ?.split('\n')
      .map((url) => url.trim())
      .filter(Boolean) ?? []

  if (urls.length === 0) {
    Plugins.message.warn('未输入任何链接')
    return
  }

  Plugins.message.info(`已输入 ${urls.length} 个链接，开始解析和导入...`)
  const results = await Promise.allSettled(urls.map(getAndParseRemoteFile))

  for (const [i, result] of results.entries()) {
    const url = urls[i]
    if (result.status === 'fulfilled') {
      try {
        const host = new URL(url).hostname
        const importer = new ConfigImporter(result.value, host)
        await importer.process()
        Plugins.message.success(`链接 "${url}" 导入成功`)
      } catch (err) {
        Plugins.message.error(`处理链接 "${url}" 时发生错误: ${err.message || err}`)
      }
    } else {
      Plugins.message.error(result.reason.message || result.reason)
    }
  }
}

/* 选择导入类型 */
const selectImportType = async () => {
  const typeList = [
    { label: '本地配置', value: ImportType.Local, description: '导入本地配置文件，必须是标准的 JSON 格式，可以同时导入多个文件。' },
    {
      label: '远程配置',
      value: ImportType.Remote,
      description: '导入远程配置文件，可以是订阅或远程文件链接，必须是标准的 JSON 格式，可以同时导入多个链接。'
    }
  ]
  return await Plugins.picker.single('请选择要导入的配置类型', typeList, [typeList[0].value])
}

/* 触发器 手动触发 */
const onRun = async () => {
  await Plugins.alert(
    '插件使用须知：',
    `此插件只解析 GUI 支持的配置字段，如果你的配置文件中包含 GUI 不支持的配置字段，在导入后可能还需要通过 **混入和脚本** 功能手动添加。
如果你不知道自己在做什么，请不要使用此插件，而是应该考虑 **快速开始** 或添加 **默认配置**。`,
    { type: 'markdown' }
  )

  try {
    const type = await selectImportType()
    if (!type) {
      Plugins.message.warn('未选择任何类型')
      return
    }
    if (type === ImportType.Local) await importLocalConfig()
    if (type === ImportType.Remote) await importRemoteConfig()
  } catch (e) {
    Plugins.message.error(e.message || e)
  }
}
