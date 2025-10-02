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

const BuiltOutboundType = {
  BuiltIn: 'Built-in',
  Subscription: 'Subscription'
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
  // GUI
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

const RuleActionReject = {
  Default: 'default',
  Drop: 'drop',
  Reply: 'reply'
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

const FilterMode = {
  Include: 'include',
  Exclude: 'exclude'
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
    // @ts-ignore
    secret: Plugins.generateSecureKey(),
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

const DefaultInboundListen = () => ({
  listen: '127.0.0.1',
  listen_port: 20120,
  tcp_fast_open: false,
  tcp_multi_path: false,
  udp_fragment: false
})

const DefaultInboundTun = () => ({
  interface_name: '',
  address: DefaultTunAddress,
  mtu: 9000,
  auto_route: true,
  strict_route: true,
  route_address: [],
  route_exclude_address: [],
  endpoint_independent_nat: false,
  stack: TunStack.Mixed
})

const DefaultOutbound = () => ({
  id: Plugins.sampleID(),
  tag: '',
  type: '',
  outbounds: [],
  interrupt_exist_connections: true,
  url: DefaultTestURL,
  interval: '3m',
  tolerance: 150,
  include: '',
  exclude: ''
})

const DefaultRouteRule = () => ({
  id: Plugins.sampleID(),
  type: RuleType.RuleSet,
  payload: '',
  invert: false,
  action: RuleAction.Route,
  outbound: '',
  sniffer: [],
  strategy: Strategy.Default,
  server: ''
})

const RouteRuleActionProperties = () => ({
  ...DefaultRouteRule(),
  method: RuleActionReject.Default,
  override_address: '',
  override_port: 0,
  network_strategy: '',
  fallback_delay: '',
  udp_disable_domain_unmapping: false,
  udp_connect: false,
  udp_timeout: '',
  tls_fragment: false,
  tls_fragment_fallback_delay: '',
  tls_record_fragment: ''
})

const DefaultRouteRuleset = () => ({
  id: Plugins.sampleID(),
  type: RulesetType.Local,
  tag: '',
  format: RulesetFormat.Binary,
  url: '',
  download_detour: '',
  update_interval: '',
  rules: '',
  path: ''
})

const DefaultRouteGeneral = () => ({
  auto_detect_interface: true,
  default_interface: '',
  final: '',
  find_process: false,
  default_domain_resolver: {
    server: '',
    client_subnet: ''
  }
})

const DefaultDnsServer = () => ({
  id: Plugins.sampleID(),
  tag: '',
  type: DnsServer.Local,
  detour: '',
  domain_resolver: '',
  server: '',
  server_port: '',
  path: '',
  interface: '',
  inet4_range: '',
  inet6_range: '',
  hosts_path: [],
  predefined: {}
})

const DefaultDnsRule = () => ({
  id: Plugins.sampleID(),
  type: RuleType.RuleSet,
  payload: '',
  action: RuleAction.Route,
  invert: false,
  server: '',
  strategy: Strategy.Default,
  disable_cache: false,
  client_subnet: ''
})

const DnsRuleActionProperties = () => ({
  ...DefaultDnsRule(),
  method: RuleActionReject.Default,
  rcode: '',
  answer: [],
  ns: [],
  extra: []
})

const DefaultDnsGeneral = () => ({
  disable_cache: false,
  disable_expire: false,
  independent_cache: false,
  client_subnet: '',
  final: '',
  strategy: Strategy.Default
})

const DefaultMixin = () => ({
  priority: 'gui',
  format: 'json',
  config: JSON.stringify({})
})

const DefaultScript = () => ({
  code: `const onGenerate = async (config) => {\n  return config\n}`
})

const DefaultGuiProfile = () => ({
  id: Plugins.sampleID(),
  name: '',
  log: DefaultLog(),
  experimental: DefaultExperimental(),
  inbounds: [],
  outbounds: [],
  route: {
    rule_set: [],
    rules: [],
    ...DefaultRouteGeneral()
  },
  dns: {
    servers: [],
    rules: [],
    ...DefaultDnsGeneral()
  },
  mixin: DefaultMixin(),
  script: DefaultScript()
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
      setTimeout(() => {
        if (fileInput.files.length === 0) {
          resolve(null)
          cleanup()
        }
      }, 200)
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

/* 根据指定的键列表和模式过滤对象 */
const filterObjectKeys = (sourceObj, keyList, mode = FilterMode.Include) => {
  if (!sourceObj || typeof sourceObj !== 'object') {
    return {}
  }

  const keySet = new Set(keyList)
  const allKeys = Object.keys(sourceObj)

  const filteredKeys = allKeys.filter((key) => {
    const keyExistsInList = keySet.has(key)
    if (mode === FilterMode.Include) {
      return keyExistsInList
    } else if (mode === FilterMode.Exclude) {
      return !keyExistsInList
    }
    return false
  })

  return filteredKeys.reduce((acc, key) => {
    acc[key] = sourceObj[key]
    return acc
  }, {})
}

/* 将原始配置解析为 GUI 格式 */
class ConfigParser {
  constructor(originConfig) {
    this.origConfig = originConfig
    // 初始化 GUI 配置对象
    this.guiProfile = DefaultGuiProfile()
  }

  /* 解析入站设置 */
  _parseInbounds() {
    const { inbounds: origInbounds } = this.origConfig
    if (!origInbounds || origInbounds.length === 0) return
    const supportedTypes = new Set(Object.values(Inbound))
    // @ts-ignore
    const { inboundTagToId } = window[Plugin.id]
    this.guiProfile.inbounds = origInbounds
      .filter((ib) => supportedTypes.has(ib.type))
      .map((ib, idx) => {
        const newId = Plugins.sampleID()
        inboundTagToId[ib.tag] = newId

        const DefaultInboundHeader = () => ({
          id: newId,
          type: ib.type,
          tag: ib.tag,
          enable: true
        })

        if (ib.type === Inbound.Tun) {
          return {
            ...DefaultInboundHeader(),
            tun: {
              ...DefaultInboundTun(),
              ...filterObjectKeys(ib, Object.keys(DefaultInboundTun()), FilterMode.Include)
            }
          }
        }

        return {
          ...DefaultInboundHeader(),
          [ib.type]: {
            listen: {
              ...DefaultInboundListen(),
              ...filterObjectKeys(ib, Object.keys(DefaultInboundListen()), FilterMode.Include)
            },
            users: ib.users?.map((u) => `${u.username}:${u.password}`) || []
          }
        }
      })
  }

  /* 解析出站设置 */
  _parseOutbounds() {
    const { outbounds: origOutbounds } = this.origConfig
    if (!origOutbounds || origOutbounds.length === 0) return
    const supportedTypes = new Set(Object.values(Outbound))
    // @ts-ignore
    const { outboundTagToId, proxyTagToId, subscribeId, subscribeName } = window[Plugin.id]
    const supportedOutbounds = origOutbounds.filter((ob) => supportedTypes.has(ob.type))

    supportedOutbounds.forEach((ob) => {
      outboundTagToId[ob.tag] = Plugins.sampleID()
    })

    this.guiProfile.outbounds = supportedOutbounds.map((ob) => {
      const guiOutbound = {
        ...DefaultOutbound(),
        ...ob,
        id: outboundTagToId[ob.tag],
        outbounds: []
      }

      if (ob.type === Outbound.Selector || ob.type === Outbound.Urltest) {
        guiOutbound.outbounds =
          ob.outbounds
            ?.map((tag) => {
              // 引用的是一个内置出站
              if (outboundTagToId[tag]) return { id: outboundTagToId[tag], tag, type: BuiltOutboundType.BuiltIn }
              // 引用的是订阅中的节点
              if (proxyTagToId[tag]) return { id: proxyTagToId[tag], tag, type: subscribeId }
              return null
            })
            .filter(Boolean) || []

        // 如果出站引用了订阅中的所有节点，则简化为引用整个订阅
        const allProxyTagsInSub = Object.keys(proxyTagToId)
        const outboundProxyTags = new Set(guiOutbound.outbounds.filter((o) => o.type === subscribeId).map((o) => o.tag))

        if (
          subscribeId &&
          allProxyTagsInSub.length > 0 &&
          outboundProxyTags.size === allProxyTagsInSub.length &&
          allProxyTagsInSub.every((tag) => outboundProxyTags.has(tag))
        ) {
          const nonSubOutbounds = guiOutbound.outbounds.filter((o) => o.type !== subscribeId)
          guiOutbound.outbounds = [{ id: subscribeId, tag: subscribeName, type: BuiltOutboundType.Subscription }, ...nonSubOutbounds]
        }
      }
      return guiOutbound
    })
  }

  /* 解析通用设置 */
  _parseGeneral() {
    // @ts-ignore
    const { outboundTagToId } = window[Plugin.id]
    const { log: origLog, experimental: origExperimental } = this.origConfig

    if (origLog) {
      this.guiProfile.log = { ...this.guiProfile.log, ...origLog }
    }

    if (!origExperimental) return

    const { clash_api: origClashApi, cache_file: origCacheFile } = origExperimental

    if (origClashApi) {
      this.guiProfile.experimental.clash_api = {
        ...this.guiProfile.experimental.clash_api,
        ...origClashApi,
        // 单独处理特殊属性
        default_mode: origClashApi.default_mode ? String(origClashApi.default_mode).toLowerCase() : ClashMode.Rule,
        external_ui_download_detour: outboundTagToId[origClashApi.external_ui_download_detour] ?? ''
      }
    }

    if (origCacheFile) {
      this.guiProfile.experimental.cache_file = {
        ...this.guiProfile.experimental.cache_file,
        ...origCacheFile
      }
    }
  }

  /* 解析路由规则集 */
  _parseRouteRuleset(origRuleset) {
    // @ts-ignore
    const { rulesetTagToId, outboundTagToId } = window[Plugin.id]

    origRuleset.forEach((rs) => {
      rulesetTagToId[rs.tag] = Plugins.sampleID()
    })

    this.guiProfile.route.rule_set = origRuleset.map((rs) => ({
      ...DefaultRouteRuleset(),
      ...rs,
      id: rulesetTagToId[rs.tag],
      download_detour: outboundTagToId[rs.download_detour] ?? '',
      rules: rs.rules ? JSON.stringify(rs.rules, null, 2) : JSON.stringify([])
    }))
  }

  /* 格式化 Hosts 服务器的 Predefined 属性 */
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

  /* 解析 DNS 服务器 */
  _parseDnsServers(origDnsServers) {
    // @ts-ignore
    const { dnsServerTagToId, outboundTagToId } = window[Plugin.id]

    origDnsServers.forEach((s) => {
      dnsServerTagToId[s.tag] = Plugins.sampleID()
    })

    const supportedDNSServerTypes = new Set(Object.values(DnsServer))
    this.guiProfile.dns.servers = origDnsServers
      .filter((s) => supportedDNSServerTypes.has(s.type))
      .map((s) => ({
        ...DefaultDnsServer(),
        ...filterObjectKeys(s, Object.keys(DefaultDnsServer()), FilterMode.Include),
        id: dnsServerTagToId[s.tag],
        detour: outboundTagToId[s.detour] ?? '',
        domain_resolver: dnsServerTagToId[s.domain_resolver] ?? '',
        server_port: String(s.server_port ?? ''),
        path: [DnsServer.Https, DnsServer.H3].includes(s.type) ? (s.path ?? '') : '',
        hosts_path: s.type === DnsServer.Hosts ? (s.path ?? []) : [],
        predefined: s.type === DnsServer.Hosts ? this._formatHostsPredefined(s.predefined) : {}
      }))
  }

  /* 解析规则的匹配条件部分 */
  _parseMatchingCondition(condition, maps) {
    const ruleTypeList = Object.values(RuleType)
    const supportedTypes = Object.keys(filterObjectKeys(condition, ruleTypeList, FilterMode.Include))
    const unsupportedTypes = Object.keys(filterObjectKeys(condition, ruleTypeList, FilterMode.Exclude))

    // 当只有一个支持的类型时，视为简单规则
    if (supportedTypes.length === 1 && unsupportedTypes.length === 0) {
      const type = supportedTypes[0]
      let payload = condition[type]

      if (type === RuleType.RuleSet) {
        payload = (Array.isArray(payload) ? payload : [payload])
          .map((tag) => maps.ruleset[tag])
          .filter(Boolean)
          .join(',')
      } else if (type === RuleType.Inbound) {
        if (Array.isArray(payload) && payload.length > 1) {
          return { type: RuleType.Inline, payload: JSON.stringify(condition, null, 2) }
        }
        payload = Array.isArray(payload) && payload.length === 1 ? (maps.inbound[payload[0]] ?? '') : (maps.inbound[payload] ?? '')
      } else if (type === RuleType.ClashMode) {
        payload = String(payload).toLowerCase()
      } else if (Array.isArray(payload)) {
        payload = payload.join(',')
      }
      return { type, payload: String(payload) }
    }

    if (condition.clash_mode) {
      condition.clash_mode = String(condition.clash_mode).toLowerCase()
    }

    // 其他所有情况（0个或多个类型，或不支持的类型）都视为内联规则
    return { type: RuleType.Inline, payload: typeof condition === 'object' ? JSON.stringify(condition, null, 2) : String(condition) }
  }

  /* 解析路由规则 */
  _parseRouteRules(origRouteRules) {
    // @ts-ignore
    const { dnsServerTagToId, rulesetTagToId, inboundTagToId, outboundTagToId } = window[Plugin.id]
    const maps = { ruleset: rulesetTagToId, inbound: inboundTagToId }

    this.guiProfile.route.rules = origRouteRules.map((rule) => {
      const actionProperties = filterObjectKeys(rule, Object.keys(RouteRuleActionProperties()), FilterMode.Include)
      const matchingCondition = filterObjectKeys(rule, Object.keys(RouteRuleActionProperties()), FilterMode.Exclude)

      if (rule.type) {
        matchingCondition.type = rule.type
      }
      const { type, payload } = this._parseMatchingCondition(matchingCondition, maps)

      const guiRule = {
        ...DefaultRouteRule(),
        ...filterObjectKeys(actionProperties, Object.keys(DefaultRouteRule()), FilterMode.Include),
        id: Plugins.sampleID(),
        type,
        payload,
        outbound:
          actionProperties.action === RuleAction.Reject
            ? (actionProperties.method ?? RuleActionReject.Default)
            : actionProperties.action === RuleAction.RouteOptions
              ? JSON.stringify(filterObjectKeys(actionProperties, Object.keys(DefaultRouteRule()), FilterMode.Exclude), null, 2)
              : (outboundTagToId[actionProperties.outbound] ?? ''),
        server: dnsServerTagToId[actionProperties.server] ?? ''
      }
      return guiRule
    })
  }

  /* 解析路由设置 */
  _parseRoute() {
    const { route: origRoute, dns: origDns } = this.origConfig
    if (!origRoute && !origDns) return
    // @ts-ignore
    const { dnsServerTagToId, outboundTagToId } = window[Plugin.id]
    if (origRoute.rule_set && origRoute.rule_set.length > 0) {
      this._parseRouteRuleset(origRoute.rule_set)
    }
    if (origDns.servers && origDns.servers.length > 0) {
      this._parseDnsServers(origDns.servers)
    }
    if (origRoute.rules && origRoute.rules.length > 0) {
      this._parseRouteRules(origRoute.rules)
    }
    if (origRoute) {
      this.guiProfile.route = {
        ...this.guiProfile.route,
        ...filterObjectKeys(origRoute, Object.keys(DefaultRouteGeneral()), FilterMode.Include),
        final: outboundTagToId[origRoute.final] ?? '',
        default_domain_resolver: {
          ...this.guiProfile.route.default_domain_resolver,
          ...(origRoute.default_domain_resolver && typeof origRoute.default_domain_resolver === 'object'
            ? filterObjectKeys(origRoute.default_domain_resolver, Object.keys(DefaultRouteGeneral().default_domain_resolver), FilterMode.Include)
            : {}),
          server: dnsServerTagToId[origRoute.default_domain_resolver?.server ?? origRoute.default_domain_resolver] ?? ''
        }
      }
    }
  }

  /* 解析 DNS 规则 */
  _parseDnsRules(origDnsRules) {
    // @ts-ignore
    const { dnsServerTagToId, rulesetTagToId, inboundTagToId } = window[Plugin.id]
    const maps = { ruleset: rulesetTagToId, inbound: inboundTagToId }

    this.guiProfile.dns.rules = origDnsRules.map((rule) => {
      const actionProperties = filterObjectKeys(rule, Object.keys(DnsRuleActionProperties()), FilterMode.Include)
      const matchingCondition = filterObjectKeys(rule, Object.keys(DnsRuleActionProperties()), FilterMode.Exclude)

      if (rule.type) {
        matchingCondition.type = rule.type
      }
      const { type, payload } = this._parseMatchingCondition(matchingCondition, maps)

      const guiRule = {
        ...DefaultDnsRule(),
        ...filterObjectKeys(actionProperties, Object.keys(DefaultDnsRule()), FilterMode.Include),
        id: Plugins.sampleID(),
        type,
        payload,
        server:
          actionProperties.action === RuleAction.Reject
            ? (actionProperties.method ?? RuleActionReject.Default)
            : actionProperties.action === RuleAction.Predefined || actionProperties.action === RuleAction.RouteOptions
              ? JSON.stringify(filterObjectKeys(actionProperties, Object.keys(DefaultDnsRule()), FilterMode.Exclude), null, 2)
              : (dnsServerTagToId[actionProperties.server] ?? '')
      }

      return guiRule
    })
  }

  /* 解析 DNS 设置 */
  _parseDns() {
    const { dns: origDns } = this.origConfig
    if (!origDns) return
    // @ts-ignore
    const { dnsServerTagToId } = window[Plugin.id]

    if (origDns.rules && origDns.rules.length > 0) {
      this._parseDnsRules(origDns.rules)
    }

    this.guiProfile.dns = {
      ...this.guiProfile.dns,
      ...filterObjectKeys(origDns, Object.keys(DefaultDnsGeneral()), FilterMode.Include),
      final: dnsServerTagToId[origDns.final] ?? ''
    }
  }

  /* 解析额外字段 */
  _parseExtraFields() {
    const supportedFields = Object.keys(DefaultGuiProfile())

    // 过滤出原始配置中所有未被支持的顶级字段
    const unsupportedFields = filterObjectKeys(this.origConfig, supportedFields, FilterMode.Exclude)

    if (Object.keys(unsupportedFields).length > 0) {
      this.guiProfile.mixin.config = JSON.stringify(unsupportedFields, null, 2)
    }
  }

  async process(fileName) {
    this.guiProfile.name = `${fileName.replace(/\.json$/, '')}-profile`
    this._parseInbounds()
    this._parseOutbounds()
    this._parseGeneral()
    this._parseRoute()
    this._parseDns()
    this._parseExtraFields()
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

    const proxyTagToId = Object.fromEntries(proxies.map((p) => [p.tag, Plugins.sampleID()]))

    // @ts-ignore
    window[Plugin.id] = {
      // @ts-ignore
      proxyTagToId,
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
      proxies: proxies.map((p) => ({ id: window[Plugin.id].proxyTagToId[p.tag], tag: p.tag, type: p.type })),
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
    const { body } = await Plugins.Requests({
      method: 'GET',
      url,
      headers: { 'User-Agent': 'sing-box' },
      autoTransformBody: false
    })
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
    `此插件将解析所有 GUI 支持的配置字段，如果你的配置文件中包含 GUI 不支持的配置字段，
对于顶级字段将会写入 **混入配置** 中，其他字段可能还需要你通过 **混入和脚本** 功能手动添加。
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

/* 触发器 APP就绪后 */
const onReady = async () => {
  const appStore = Plugins.useAppStore()
  // appStore.removeCustomActions('profiles_header', Plugin.id)
  appStore.addCustomActions('profiles_header', {
    id: Plugin.id,
    component: 'Dropdown',
    componentSlots: {
      default: ({ h }) => h('Button', { type: 'link' }, () => Plugin.name),
      overlay: ({ h }) =>
        h('div', { class: 'flex flex-col gap-4 min-w-64 p-4' }, [
          h('Button', { type: 'text', onClick: importLocalConfig }, () => '从文件导入'),
          h('Button', { type: 'text', onClick: importRemoteConfig }, () => '从URL导入')
        ])
    }
  })
}
