const FilterMode = { Include: 'include', Exclude: 'exclude' }
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
  Block: 'block',
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
const DefaultTunAddress = ['172.18.0.1/30', 'fdfe:dcba:9876::1/126']
const DefaultTestURL = 'https://www.gstatic.com/generate_204'
const DefaultExcludeProtocols = 'direct|reject|selector|urltest|block|dns|shadowsocksr'
const DefaultSubscribeScript = `const onSubscribe = async (proxies, subscription) => {\n  return { proxies, subscription }\n}`
const DefaultLog = {
  disabled: false,
  level: LogLevel.Info,
  output: '',
  timestamp: false
}
const DefaultExperimental = {
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
}
const DefaultInboundListen = {
  listen: '127.0.0.1',
  listen_port: 20120,
  tcp_fast_open: false,
  tcp_multi_path: false,
  udp_fragment: false
}
const DefaultInboundTun = {
  interface_name: '',
  address: DefaultTunAddress,
  mtu: 0,
  auto_route: true,
  strict_route: true,
  route_address: [],
  route_exclude_address: [],
  endpoint_independent_nat: false,
  stack: TunStack.Mixed
}
const DefaultOutbound = {
  id: '',
  tag: '',
  type: Outbound.Selector,
  outbounds: [],
  interrupt_exist_connections: true,
  url: DefaultTestURL,
  interval: '3m',
  tolerance: 150,
  include: '',
  exclude: ''
}
const DefaultRouteRule = {
  id: '',
  type: RuleType.RuleSet,
  enable: true,
  payload: '',
  invert: false,
  action: RuleAction.Route,
  outbound: '',
  sniffer: [],
  strategy: Strategy.Default,
  server: ''
}
const DefaultRuleSet = {
  id: '',
  type: RulesetType.Local,
  tag: '',
  format: RulesetFormat.Binary,
  url: '',
  download_detour: '',
  update_interval: '',
  rules: '',
  path: ''
}
const DefaultRouteGeneral = {
  auto_detect_interface: true,
  default_interface: '',
  final: '',
  find_process: false,
  default_domain_resolver: {
    server: '',
    client_subnet: ''
  }
}
const DefaultDnsServer = {
  id: '',
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
}
const DefaultDnsRule = {
  id: '',
  type: RuleType.RuleSet,
  enable: true,
  payload: '',
  action: RuleAction.Route,
  invert: false,
  server: '',
  strategy: Strategy.Default,
  disable_cache: false,
  client_subnet: ''
}
const DefaultDnsGeneral = {
  disable_cache: false,
  disable_expire: false,
  independent_cache: false,
  client_subnet: '',
  final: '',
  strategy: Strategy.Default
}
const RouteOptions = {
  override_address: '',
  override_port: 0,
  network_strategy: 'default',
  fallback_delay: '300ms',
  udp_disable_domain_unmapping: false,
  udp_connect: false,
  udp_timeout: '10s',
  tls_fragment: false,
  tls_fragment_fallback_delay: '500ms',
  tls_record_fragment: false
}
const PredefinedOptions = {
  rcode: 'NOERROR',
  answer: [],
  ns: [],
  extra: []
}
const DefaultMixin = () => ({
  priority: 'mixin',
  format: 'json',
  config: '{}'
})
const DefaultScript = () => ({
  code: `const onGenerate = async (config) => {\n  return config\n}`
})
const DefaultGuiProfile = () => ({
  id: generateId(),
  name: '',
  log: structuredClone(DefaultLog),
  experimental: structuredClone(DefaultExperimental),
  inbounds: [],
  outbounds: [],
  route: {
    rule_set: [],
    rules: [],
    ...structuredClone(DefaultRouteGeneral)
  },
  dns: {
    servers: [],
    rules: [],
    ...structuredClone(DefaultDnsGeneral)
  },
  mixin: DefaultMixin(),
  script: DefaultScript()
})
const createPlaceholderInbound = (id, tag) => ({
  id,
  tag,
  type: 'mixed',
  mixed: {
    listen: { ...DefaultInboundListen },
    users: []
  },
  enable: true
})
const createPlaceholderOutbound = (id, tag) => ({
  ...DefaultOutbound,
  id,
  tag,
  type: 'direct'
})
const createPlaceholderDnsServer = (id, tag) => ({
  ...DefaultDnsServer,
  id,
  tag,
  type: 'local'
})
const getKeys = (obj) => {
  return Object.keys(obj)
}
const getValues = (obj) => {
  return Object.values(obj)
}
const hasOwn = (obj, key) => {
  if (!Object.hasOwn(obj, key)) return false
  return obj[key] !== undefined
}
const invertObject = (obj) => {
  if (!obj) return {}
  const inverted = Object.entries(obj).map(([key, value]) => [value, key])
  return Object.fromEntries(inverted)
}
const filterProps = (sourceObj, templateObj, mode) => {
  if (typeof sourceObj !== 'object') {
    return {}
  }
  const filtered = Object.entries(sourceObj).filter(([key]) => {
    const hasKey = hasOwn(templateObj, key)
    return mode === FilterMode.Include ? hasKey : !hasKey
  })
  return Object.fromEntries(filtered)
}
const ensureArray = (value) => {
  if (!value) return []
  return Array.isArray(value) ? [...value] : [value]
}
const stringifyJson = (value) => {
  if (!value) return ''
  return JSON.stringify(value, null, 2)
}
const mapToRecord = (map) => {
  if (!map.size) return {}
  return Object.fromEntries(map)
}
const generateId = () => Plugins.sampleID()
const inferRuleSetFormat = (rs) => {
  if (rs.type === RulesetType.Remote) {
    return SOURCE_SUFFIX_REGEX.test(new URL(rs.url).pathname) ? RulesetFormat.Source : RulesetFormat.Binary
  } else if (rs.type === RulesetType.Local) {
    return SOURCE_SUFFIX_REGEX.test(rs.path) ? RulesetFormat.Source : RulesetFormat.Binary
  }
  return RulesetFormat.Binary
}
/* 格式化 Hosts 服务器的 Predefined 属性 */
const formatHostsPredefined = (predefinedObject) => {
  if (!predefinedObject) return {}
  const formatted = Object.entries(predefinedObject).map(([domain, ips]) => {
    const ipStr = typeof ips === 'string' ? ips : ips.join(',')
    return [domain, ipStr]
  })
  return Object.fromEntries(formatted)
}
const normalizeClashMode = (rule) => {
  const normalized = structuredClone(rule)
  if (hasOwn(normalized, 'clash_mode')) {
    normalized.clash_mode = normalized.clash_mode.toLowerCase()
  }
  if (hasOwn(normalized, 'rules')) {
    normalized.rules = normalized.rules.map((rule) => {
      if (hasOwn(rule, 'clash_mode')) {
        return {
          ...rule,
          clash_mode: rule.clash_mode.toLowerCase()
        }
      }
      return rule
    })
  }
  return normalized
}
const SOURCE_SUFFIX_REGEX = /\.json[c5]?$/
const BASE_RULES = invertObject(RuleType)
/* 将原始配置解析为 GUI 格式 */
class ConfigParser {
  guiProfile = DefaultGuiProfile()
  rawConfig
  states
  scriptProcessSegments = []
  constructor(rawConfig, states) {
    this.rawConfig = rawConfig
    this.states = states
  }
  process(fileName) {
    this.guiProfile.name = `${fileName.replace(SOURCE_SUFFIX_REGEX, '')}-profile`
    this.refreshTagToIdMaps()
    this.processEndpoints()
    this.parseInbounds()
    this.parseOutbounds()
    this.parseGeneral()
    this.parseDnsServers()
    this.parseRuleSets()
    this.parseRoute()
    this.parseDns()
    this.processExtraFields()
    this.composeProcessScript()
    return this.guiProfile
  }
  refreshTagToIdMaps() {
    const { inbounds, outbounds, route, dns } = this.rawConfig
    const { inboundTagToId, outboundTagToId, rulesetTagToId, dnsServerTagToId } = this.states
    const tagToIdTasks = [
      [inbounds, inboundTagToId],
      [outbounds, outboundTagToId],
      [route?.rule_set, rulesetTagToId],
      [dns?.servers, dnsServerTagToId]
    ]
    for (const [items, idMap] of tagToIdTasks) {
      if (!items?.length) continue
      for (const item of items) {
        idMap.set(item.tag, generateId())
      }
    }
  }
  processEndpoints() {
    const { endpoints: rawEndpoints } = this.rawConfig
    if (!rawEndpoints?.length) return
    for (const { tag } of rawEndpoints) {
      const id = generateId()
      this.states.inboundTagToId.set(tag, id)
      this.states.outboundTagToId.set(tag, id)
      this.guiProfile.inbounds.push(createPlaceholderInbound(id, tag))
      this.guiProfile.outbounds.push(createPlaceholderOutbound(id, tag))
    }
    const endpointsProcessing = `
config.endpoints = ${stringifyJson(rawEndpoints)};
const isNotEndpoint = (item) => !config.endpoints.some((ep) => ep.tag === item.tag);
config.inbounds = config.inbounds.filter(isNotEndpoint);
config.outbounds = config.outbounds.filter(isNotEndpoint);
`
    this.appendScriptSegment(endpointsProcessing)
  }
  /* 解析入站设置 */
  parseInbounds() {
    const { inbounds: rawInbounds } = this.rawConfig
    if (!rawInbounds?.length) return
    const extraInbounds = new Map()
    const inboundExtProps = new Map()
    const supportedInbounds = getValues(Inbound)
    const isSupportedInbound = (ib) => {
      return supportedInbounds.includes(ib.type)
    }
    const parsedInbounds = rawInbounds.map((ib) => {
      const { tag, type } = ib
      const inboundBase = {
        id: this.getInboundId(tag),
        tag,
        type,
        enable: true
      }
      if (!isSupportedInbound(ib)) {
        extraInbounds.set(tag, ib)
        return createPlaceholderInbound(inboundBase.id, tag)
      }
      if (type === Inbound.Tun) {
        const { route_address, route_exclude_address, address } = ib
        const { type, tag, ...tunExtProps } = filterProps(ib, DefaultInboundTun, FilterMode.Exclude)
        if (getKeys(tunExtProps).length > 0) inboundExtProps.set(tag, tunExtProps)
        return {
          ...inboundBase,
          tun: {
            ...DefaultInboundTun,
            ...filterProps(ib, DefaultInboundTun, FilterMode.Include),
            route_address: ensureArray(route_address),
            route_exclude_address: ensureArray(route_exclude_address),
            address: ensureArray(address)
          }
        }
      } else {
        const { users } = ib
        const { type, tag, ...otherExtProps } = filterProps(ib, { ...DefaultInboundListen, users }, FilterMode.Exclude)
        if (getKeys(otherExtProps).length > 0) inboundExtProps.set(tag, otherExtProps)
        return {
          ...inboundBase,
          [type]: {
            listen: {
              ...DefaultInboundListen,
              ...filterProps(ib, DefaultInboundListen, FilterMode.Include)
            },
            users: users?.map((u) => `${u.username}:${u.password}`) ?? []
          }
        }
      }
    })
    this.guiProfile.inbounds.push(...parsedInbounds)
    if (!extraInbounds.size && !inboundExtProps.size) return
    const inboundsProcessing = `
const extraInboundsMap = ${stringifyJson(mapToRecord(extraInbounds))};
const inboundExtPropsMap = ${stringifyJson(mapToRecord(inboundExtProps))};
config.inbounds = config.inbounds.map((ib) => {
  const tag = ib.tag;
  const extInbound = extraInboundsMap[tag];
  const extProps = inboundExtPropsMap[tag];
  if (extInbound) {
    return extInbound;
  }
  if (extProps) {
    return {
      ...ib,
      ...extProps,
    };
  }
  return ib;
});
`
    this.appendScriptSegment(inboundsProcessing)
  }
  /* 解析出站设置 */
  parseOutbounds() {
    const { outbounds: rawOutbounds } = this.rawConfig
    if (!rawOutbounds?.length) return
    const { subscribeId, subscribeName, proxyTagToId } = this.states
    const outboundExtProps = new Map()
    const parsedOutbounds = rawOutbounds.map((ob) => {
      const { type, tag } = ob
      if (type === Outbound.Selector || type === Outbound.Urltest) {
        const outboundGroup = {
          ...DefaultOutbound,
          ...filterProps(ob, DefaultOutbound, FilterMode.Include),
          id: this.getOutboundId(tag),
          outbounds: []
        }
        const groupExtProps = filterProps(ob, DefaultOutbound, FilterMode.Exclude)
        if (getKeys(groupExtProps).length > 0) outboundExtProps.set(tag, groupExtProps)
        outboundGroup.outbounds = ob.outbounds.flatMap((tag) => {
          const outId = this.getOutboundId(tag)
          const proxyId = this.getProxyId(tag)
          // 引用的是一个内置出站
          if (outId) return [{ id: outId, tag, type: BuiltOutboundType.BuiltIn }]
          // 引用的是订阅中的节点
          if (proxyId) return [{ id: proxyId, tag, type: subscribeId }]
          return []
        })
        // 如果出站引用了订阅中的所有节点，则简化为引用整个订阅
        const referencedProxyTags = new Set(
          outboundGroup.outbounds.flatMap((o) => {
            if (o.type !== subscribeId) return []
            return [o.tag]
          })
        )
        if (referencedProxyTags.size === proxyTagToId.size) {
          for (const pTag of proxyTagToId.keys()) {
            if (!referencedProxyTags.has(pTag)) return outboundGroup
          }
          const nonProxyOutbounds = outboundGroup.outbounds.filter((o) => o.type !== subscribeId)
          outboundGroup.outbounds = [{ id: subscribeId, tag: subscribeName, type: BuiltOutboundType.Subscription }, ...nonProxyOutbounds]
        }
        return outboundGroup
      } else {
        if (type === Outbound.Direct) {
          const directExtProps = filterProps(ob, { type, tag }, FilterMode.Exclude)
          if (getKeys(directExtProps).length > 0) outboundExtProps.set(tag, directExtProps)
        }
        return {
          ...DefaultOutbound,
          id: this.getOutboundId(tag),
          tag,
          type
        }
      }
    })
    this.guiProfile.outbounds.push(...parsedOutbounds)
    if (!outboundExtProps.size) return
    const outboundsProcessing = `
const outboundExtPropsMap = ${stringifyJson(mapToRecord(outboundExtProps))};
config.outbounds = config.outbounds.map((ob) => {
  const extProps = outboundExtPropsMap[ob.tag];
  if (extProps) {
    return {
      ...ob,
      ...extProps,
    };
  }
  return ob;
});
`
    this.appendScriptSegment(outboundsProcessing)
  }
  /* 解析通用设置 */
  parseGeneral() {
    const { log: rawLog, experimental: rawExperimental } = this.rawConfig
    if (rawLog) {
      this.guiProfile.log = { ...DefaultLog, ...rawLog }
    }
    if (!rawExperimental) return
    const { clash_api: rawClashApi, cache_file: rawCacheFile } = rawExperimental
    if (rawClashApi) {
      this.guiProfile.experimental.clash_api = {
        ...DefaultExperimental.clash_api,
        ...rawClashApi,
        secret: Plugins.generateSecureKey(),
        default_mode: rawClashApi.default_mode?.toLowerCase() ?? ClashMode.Rule,
        access_control_allow_origin: ensureArray(rawClashApi.access_control_allow_origin),
        external_ui_download_detour: this.getOutboundId(rawClashApi.external_ui_download_detour)
      }
    }
    if (rawCacheFile) {
      this.guiProfile.experimental.cache_file = {
        ...DefaultExperimental.cache_file,
        ...rawCacheFile
      }
      if (rawCacheFile.rdrc_timeout) {
        const rdrcTimeoutOverride = `
config.experimental.cache_file.rdrc_timeout = '${rawCacheFile.rdrc_timeout}';
`
        this.appendScriptSegment(rdrcTimeoutOverride)
      }
    }
  }
  /* 解析 DNS 服务器 */
  parseDnsServers() {
    const rawDnsServers = this.rawConfig.dns?.servers
    if (!rawDnsServers?.length) return
    const extraDnsServers = new Map()
    const dnsServerExtProps = new Map()
    const supportedServers = getValues(DnsServer)
    const isSupportedDnsServer = (ds) => {
      return supportedServers.includes(ds.type)
    }
    const parsedDnsServers = rawDnsServers.flatMap((ds) => {
      if (!hasOwn(ds, 'type')) return []
      const tag = ds.tag
      if (!isSupportedDnsServer(ds)) {
        extraDnsServers.set(tag, ds)
        return [createPlaceholderDnsServer(this.getDnsServerId(tag), tag)]
      }
      let dnsExtProps = filterProps(ds, DefaultDnsServer, FilterMode.Exclude)
      if (hasOwn(ds, 'domain_resolver') && typeof ds.domain_resolver === 'object' && getKeys(ds.domain_resolver).length > 1) {
        dnsExtProps = { ...dnsExtProps, domain_resolver: ds.domain_resolver }
      }
      if (getKeys(dnsExtProps).length > 0) dnsServerExtProps.set(tag, dnsExtProps)
      return [
        {
          ...DefaultDnsServer,
          ...filterProps(ds, DefaultDnsServer, FilterMode.Include),
          id: this.getDnsServerId(ds.tag),
          detour: hasOwn(ds, 'detour') ? this.getOutboundId(ds.detour) : '',
          domain_resolver: hasOwn(ds, 'domain_resolver') ? this.getDomainResolverId(ds.domain_resolver) : '',
          server_port: hasOwn(ds, 'server_port') ? String(ds.server_port) : '',
          hosts_path: ds.type === DnsServer.Hosts ? ensureArray(ds.path) : [],
          predefined: ds.type === DnsServer.Hosts ? formatHostsPredefined(ds.predefined) : {},
          path: DnsServer.Https === ds.type || DnsServer.H3 === ds.type ? (ds.path ?? '') : ''
        }
      ]
    })
    this.guiProfile.dns.servers.push(...parsedDnsServers)
    if (!extraDnsServers.size && !dnsServerExtProps.size) return
    const dnsServersProcessing = `
const extraDnsServersMap = ${stringifyJson(mapToRecord(extraDnsServers))};
const dnsServerExtPropsMap = ${stringifyJson(mapToRecord(dnsServerExtProps))};
config.dns.servers = config.dns.servers.map((ds) => {
  const tag = ds.tag;
  const extDnsServer = extraDnsServersMap[tag];
  const extProps = dnsServerExtPropsMap[tag];
  if (extDnsServer) {
    return extDnsServer;
  }
  if (extProps) {
    return {
      ...ds,
      ...extProps,
    };
  }
  return ds;
});
    `
    this.appendScriptSegment(dnsServersProcessing)
  }
  /* 解析规则集 */
  parseRuleSets() {
    const rawRuleSets = this.rawConfig.route?.rule_set
    if (!rawRuleSets?.length) return
    const parsedRuleSet = rawRuleSets.map((rs) => {
      return {
        ...DefaultRuleSet,
        ...rs,
        id: this.getRuleSetId(rs.tag),
        rules: rs.type === RulesetType.Inline ? stringifyJson(rs.rules) : '',
        download_detour: rs.type === RulesetType.Remote ? this.getOutboundId(rs.download_detour) : '',
        format: inferRuleSetFormat(rs)
      }
    })
    this.guiProfile.route.rule_set.push(...parsedRuleSet)
  }
  /* 解析路由设置 */
  parseRoute() {
    const { route: rawRoute } = this.rawConfig
    if (!rawRoute) return
    this.parseRouteRules(rawRoute.rules)
    this.guiProfile.route = {
      ...this.guiProfile.route,
      ...filterProps(rawRoute, DefaultRouteGeneral, FilterMode.Include),
      final: this.getOutboundId(rawRoute.final),
      default_domain_resolver: {
        ...DefaultRouteGeneral.default_domain_resolver,
        server: this.getDomainResolverId(rawRoute.default_domain_resolver)
      }
    }
    let routeExtProps = filterProps(rawRoute, { ...DefaultRouteGeneral, rules: [], rule_set: [] }, FilterMode.Exclude)
    if (typeof rawRoute.default_domain_resolver === 'object' && getKeys(rawRoute.default_domain_resolver).length > 1) {
      routeExtProps = { ...routeExtProps, default_domain_resolver: rawRoute.default_domain_resolver }
    }
    if (!getKeys(routeExtProps).length) return
    const routeProcessing = `
const routeExtProps = ${stringifyJson(routeExtProps)};
config.route = {
  ...config.route,
  ...routeExtProps,
};
`
    this.appendScriptSegment(routeProcessing)
  }
  /* 解析 DNS 设置 */
  parseDns() {
    const { dns: rawDns } = this.rawConfig
    if (!rawDns) return
    this.parseDnsRules(rawDns.rules)
    this.guiProfile.dns = {
      ...this.guiProfile.dns,
      ...filterProps(rawDns, DefaultDnsGeneral, FilterMode.Include),
      final: this.getDnsServerId(rawDns.final)
    }
    const dnsExtProps = filterProps(rawDns, { ...DefaultDnsGeneral, servers: [], rules: [] }, FilterMode.Exclude)
    if (!getKeys(dnsExtProps).length) return
    const dnsProcessing = `
const dnsExtProps = ${stringifyJson(dnsExtProps)};
config.dns = {
  ...config.dns,
  ...dnsExtProps,
};
`
    this.appendScriptSegment(dnsProcessing)
  }
  processExtraFields() {
    const { ntp, certificate, services, experimental } = this.rawConfig
    if (ntp) {
      const ntpAppend = `
config.ntp = ${stringifyJson(ntp)};
`
      this.appendScriptSegment(ntpAppend)
    }
    if (certificate) {
      const certificateAppend = `
config.certificate = ${stringifyJson(certificate)};
`
      this.appendScriptSegment(certificateAppend)
    }
    if (services) {
      const servicesAppend = `
config.services = ${stringifyJson(services)};
`
      this.appendScriptSegment(servicesAppend)
    }
    if (experimental?.v2ray_api) {
      const v2rayApiAppend = `
config.experimental.v2ray_api = ${stringifyJson(experimental.v2ray_api)};
`
      this.appendScriptSegment(v2rayApiAppend)
    }
  }
  composeProcessScript() {
    const compositeScript = this.scriptProcessSegments.join('\n\n')
    this.guiProfile.script.code = `const onGenerate = async (config) => {\n  ${compositeScript}\n  return config\n}`
  }
  /* 解析路由规则 */
  parseRouteRules(rawRouteRules) {
    if (!rawRouteRules?.length) return
    const parsedRouteRules = rawRouteRules.map((rule) => {
      const id = generateId()
      const { action, invert } = rule
      const ruleBase = {
        ...DefaultRouteRule,
        id,
        action: action ?? 'route',
        invert: invert ?? false
      }
      switch (action) {
        case RuleAction.Route: {
          const { outbound, ...rest } = rule
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            outbound: this.getOutboundId(outbound)
          }
        }
        case RuleAction.RouteOptions: {
          const routeOptions = filterProps(rule, RouteOptions, FilterMode.Include)
          const rest = filterProps(rule, RouteOptions, FilterMode.Exclude)
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            outbound: stringifyJson(routeOptions)
          }
        }
        case RuleAction.Reject: {
          const { method, ...rest } = rule
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            outbound: method ?? RuleActionReject.Default
          }
        }
        case RuleAction.Sniff: {
          const { sniffer, ...rest } = rule
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            sniffer: ensureArray(sniffer)
          }
        }
        case RuleAction.Resolve: {
          const { strategy, server, ...rest } = rule
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            strategy: strategy ?? Strategy.Default,
            server: this.getDnsServerId(server)
          }
        }
        default: {
          return {
            ...ruleBase,
            ...this.parseMatchRule(rule)
          }
        }
      }
    })
    this.guiProfile.route.rules.push(...parsedRouteRules)
  }
  /* 解析 DNS 规则 */
  parseDnsRules(rawDnsRules) {
    if (!rawDnsRules?.length) return
    const parsedDnsRules = rawDnsRules.map((rule) => {
      const id = generateId()
      const { action, invert } = rule
      const ruleBase = {
        ...DefaultDnsRule,
        id,
        action: action ?? 'route',
        invert: invert ?? false
      }
      switch (action) {
        case RuleAction.Route: {
          const { server, strategy, disable_cache, client_subnet, ...rest } = rule
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            server: this.getDnsServerId(server),
            strategy: strategy ?? Strategy.Default,
            disable_cache: disable_cache ?? false,
            client_subnet: client_subnet ?? ''
          }
        }
        case RuleAction.RouteOptions: {
          const { disable_cache, rewrite_ttl, client_subnet, ...rest } = rule
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            disable_cache: disable_cache ?? false,
            client_subnet: client_subnet ?? '',
            server: stringifyJson({ rewrite_ttl: rewrite_ttl ?? 0 })
          }
        }
        case RuleAction.Reject: {
          const { method, ...rest } = rule
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            server: method ?? RuleActionReject.Default
          }
        }
        case RuleAction.Predefined: {
          const predefined = filterProps(rule, PredefinedOptions, FilterMode.Include)
          const rest = filterProps(rule, PredefinedOptions, FilterMode.Exclude)
          return {
            ...ruleBase,
            ...this.parseMatchRule(rest),
            server: stringifyJson(predefined)
          }
        }
        default: {
          return {
            ...ruleBase,
            ...this.parseMatchRule(rule)
          }
        }
      }
    })
    this.guiProfile.dns.rules.push(...parsedDnsRules)
  }
  /* 解析规则的匹配条件部分 */
  parseMatchRule(rule) {
    const { action, invert, ...rest } = rule
    const normalizedRule = normalizeClashMode(rest)
    const baseRules = filterProps(normalizedRule, BASE_RULES, FilterMode.Include)
    const baseRuleKeys = getKeys(baseRules)
    const extraRuleKeys = getKeys(filterProps(normalizedRule, BASE_RULES, FilterMode.Exclude))
    // 当只有一个支持的类型时，视为简单规则
    if (baseRuleKeys.length === 1 && extraRuleKeys.length === 0) {
      const type = baseRuleKeys[0]
      let payload = baseRules[type]
      switch (type) {
        case RuleType.RuleSet:
          {
            payload = ensureArray(baseRules.rule_set)
              .map((tag) => [this.getRuleSetId(tag)])
              .join(',')
          }
          break
        case RuleType.Inbound: {
          const inboundList = ensureArray(baseRules.inbound)
          if (inboundList.length > 1) {
            return {
              type: RuleType.Inline,
              payload: stringifyJson({ inbound: inboundList })
            }
          }
          payload = this.getInboundId(inboundList[0])
          break
        }
        case RuleType.ClashMode: {
          if (!getValues(ClashMode).includes(baseRules.clash_mode)) {
            return {
              type: RuleType.Inline,
              payload: stringifyJson({ clash_mode: baseRules.clash_mode })
            }
          }
          break
        }
        default:
          if (Array.isArray(payload)) {
            payload = payload.join(',')
          }
      }
      return { type, payload: typeof payload !== 'string' ? String(payload) : payload }
    }
    // 其他所有情况（0个或多个类型，或不支持的类型）都视为内联规则
    return {
      type: RuleType.Inline,
      payload: stringifyJson(normalizedRule)
    }
  }
  appendScriptSegment(segment) {
    this.scriptProcessSegments.push(segment.trim())
  }
  getDomainResolverId(resolver) {
    return typeof resolver === 'string' ? this.getDnsServerId(resolver) : this.getDnsServerId(resolver?.server)
  }
  getInboundId(tag) {
    if (!tag) return ''
    return this.states.inboundTagToId.get(tag) ?? ''
  }
  getOutboundId(tag) {
    if (!tag) return ''
    return this.states.outboundTagToId.get(tag) ?? ''
  }
  getRuleSetId(tag) {
    return this.states.rulesetTagToId.get(tag) ?? ''
  }
  getDnsServerId(tag) {
    if (!tag) return ''
    return this.states.dnsServerTagToId.get(tag) ?? ''
  }
  getProxyId(tag) {
    return this.states.proxyTagToId.get(tag) ?? ''
  }
}
/* 导入 sing-box 的原始配置 */
class ConfigImporter {
  config
  fileName
  states = {
    subscribeId: '',
    subscribeName: '',
    proxyTagToId: new Map(),
    inboundTagToId: new Map(),
    outboundTagToId: new Map(),
    rulesetTagToId: new Map(),
    dnsServerTagToId: new Map()
  }
  constructor(config, fileName) {
    this.config = config
    this.fileName = fileName
  }
  async process() {
    await this.createSubscribe()
    await this.createProfile()
  }
  /* 创建 GUI 订阅 */
  async createSubscribe() {
    const proxies = this.extractProxies()
    if (!proxies?.length) return
    const subscribesStore = Plugins.useSubscribesStore()
    const id = generateId()
    const name = `${this.fileName.replace(SOURCE_SUFFIX_REGEX, '')}-proxies`
    const path = `data/subscribes/${name}.json`
    this.states.subscribeId = id
    this.states.subscribeName = name
    await Plugins.WriteFile(path, stringifyJson(proxies))
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
      proxies: proxies.map((p) => ({ id: this.states.proxyTagToId.get(p.tag), tag: p.tag, type: p.type })),
      script: DefaultSubscribeScript
    })
  }
  /* 创建 GUI 配置 */
  async createProfile() {
    const profilesStore = Plugins.useProfilesStore()
    const parser = new ConfigParser(this.config, this.states)
    const guiProfile = parser.process(this.fileName)
    await profilesStore.addProfile(guiProfile)
  }
  /* 提取配置中的节点部分 */
  extractProxies() {
    if (!this.config.outbounds?.length) {
      Plugins.message.warn('缺少出站配置，可能导致解析出错')
      return
    }
    const excludeTypes = DefaultExcludeProtocols.split('|')
    const proxies = this.config.outbounds.filter((o) => {
      if (excludeTypes.includes(o.type)) return false
      this.states.proxyTagToId.set(o.tag, generateId())
      return true
    })
    const builtOutbounds = getValues(Outbound)
    this.config.outbounds = this.config.outbounds.filter((o) => builtOutbounds.includes(o.type))
    return proxies
  }
}
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
        if (fileInput.files?.length === 0) {
          resolve(null)
          cleanup()
        }
      }, 200)
    }
    fileInput.addEventListener('change', () => {
      resolve(fileInput.files && fileInput.files.length > 0 ? fileInput.files : null)
      cleanup()
    })
    window.addEventListener('focus', onFocus, { once: true })
    document.body.appendChild(fileInput)
    fileInput.click()
  })
}
/* 读取单个文件并解析 */
const readJson = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = event.target?.result
        resolve(JSON.parse(data))
      } catch (err) {
        reject(`文件 "${file.name}" 解析失败: ${err.message ?? String(err)}`)
      }
    }
    reader.onerror = () => {
      reject(`无法读取文件 "${file.name}"`)
    }
    reader.readAsText(file)
  })
}
/* 获取并解析远程文件 */
const fetchJson = async (url) => {
  try {
    const { body } = await Plugins.Requests({
      method: 'GET',
      url,
      headers: { 'User-Agent': 'sing-box' },
      autoTransformBody: false
    })
    return JSON.parse(body)
  } catch (err) {
    throw `链接 "${url}" 解析失败: ${err.message ?? String(err)}`
  }
}
const processRemoteImport = async (urls) => {
  Plugins.message.info(`开始解析 ${urls.length} 个链接...`)
  const results = await Promise.allSettled(urls.map(fetchJson))
  let failCount = 0
  for (const [i, result] of results.entries()) {
    const url = urls[i]
    if (result.status === 'fulfilled') {
      try {
        const host = new URL(url).hostname
        const importer = new ConfigImporter(result.value, host)
        await importer.process()
        Plugins.message.info(`链接 "${url}" 导入成功`)
      } catch (err) {
        failCount++
        Plugins.message.error(`链接 "${url}" 导入失败: ${err.message ?? String(err)}`)
      }
    } else {
      failCount++
      Plugins.message.error(result.reason.message ?? result.reason)
    }
  }
  return failCount
}
/* 导入本地配置 */
const importLocalConfig = async () => {
  const files = await selectFile({ multiple: true, accept: '.json, application/json' })
  if (!files) {
    Plugins.message.warn('未选择任何文件')
    return
  }
  Plugins.message.info(`开始解析 ${files.length} 个文件...`)
  const fileList = Array.from(files)
  const results = await Promise.allSettled(fileList.map(readJson))
  for (const [i, result] of results.entries()) {
    const fileName = fileList[i].name
    if (result.status === 'fulfilled') {
      try {
        const importer = new ConfigImporter(result.value, fileName)
        await importer.process()
        Plugins.message.info(`文件 "${fileName}" 导入成功`)
      } catch (err) {
        Plugins.message.error(`文件 "${fileName}" 导入失败: ${err.message ?? String(err)}`)
      }
    } else {
      Plugins.message.error(result.reason.message ?? result.reason)
    }
  }
}
/* 导入远程配置 */
const importRemoteConfig = () => {
  const { h, ref, computed, defineComponent } = Vue
  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-4">
      <div>
        <div class="text-14 opacity-80 mb-4">请输入链接（每行一个）：</div>
        <textarea
          v-model="remoteUrls"
          class="w-full p-8 rounded border outline-none resize-none font-mono text-14 box-border"
          style="height: 120px; background: transparent; color: inherit; border-color: var(--el-border-color); box-sizing: border-box;"
          placeholder="https://example.com/config.json"
        ></textarea>
      </div>

      <div class="flex justify-end mt-2">
          <Button type="primary" @click="handleImport" :loading="importing" icon="play">
          {{ importBtnText }}
        </Button>
      </div>
    </div>
    `,
    setup() {
      const remoteUrls = ref('')
      const importing = ref(false)
      const urlCount = computed(() => {
        return remoteUrls.value.split('\n').filter((u) => u.trim().length > 0).length
      })
      const importBtnText = computed(() => {
        return urlCount.value > 0 ? `导入 (${urlCount.value})` : '开始导入'
      })
      const handleImport = async () => {
        const urls = remoteUrls.value.split('\n').flatMap((u) => {
          const clean = u.trim()
          return clean.length > 0 ? [clean] : []
        })
        if (urls.length === 0) {
          Plugins.message.warn('未输入任何链接')
          return
        }
        importing.value = true
        try {
          const failCount = await processRemoteImport(urls)
          if (failCount === 0) {
            modal.close()
          }
        } finally {
          importing.value = false
        }
      }
      return {
        remoteUrls,
        importing,
        importBtnText,
        handleImport
      }
    }
  })
  const modal = Plugins.modal(
    {
      title: '批量导入 URL',
      width: '420px',
      submit: false,
      cancelText: '关闭',
      maskClosable: false,
      afterClose: () => {
        modal.destroy()
      }
    },
    {
      default: () => h(component),
      action: () => h('div', { class: 'mr-auto text-12 opacity-60' }, '注：请确保导入来源可信')
    }
  )
  modal.open()
}
const openUI = () => {
  const { h, defineComponent } = Vue
  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-4">
      <Card>
        <div class="text-12" style="line-height: 1.6;">
          <div class="mb-8">
            <span class="font-bold text-primary">格式要求：</span>
            <span>此插件仅支持导入 <b>sing-box v1.12.0</b> 及以上版本的配置。</span>
          </div>

          <div class="mb-8">
            <div class="font-bold text-primary mb-4">工作原理：</div>
            <p class="mb-4 opacity-80">
              如果你的配置中包含 GUI 尚未支持的设置项，插件将采取<b>动态生成脚本</b>的方式处理：
            </p>
            <ul class="list-disc pl-20 opacity-80 mb-4">
              <li>
                对于尚未支持的端点、入站和 DNS 服务器，插件会创建同名的<b>占位项</b>。
                <div class="mt-2 text-11 italic opacity-90">
                  * 注：端点占位项将同步在<b>入站</b>与<b>出站</b>中创建。
                </div>
                <div class="mt-2">
                  为了脚本能正确还原配置，<span style="color: #ff4d4f;">请勿删除这些占位项</span>，它们将在运行时被脚本替换为原始配置。
                </div>
              </li>
              <li>
                其他<b>尚未支持</b>的字段同样会在运行时通过脚本自动<b>还原</b>。
              </li>
            </ul>
            <p class="opacity-80">
              在大多数情况下，GUI 最终生成的运行时配置将与你导入的原始配置<b>保持一致</b>。
            </p>
          </div>
        </div>
      </Card>

      <div class="flex gap-12 mt-2">
        <Button class="flex-1 h-48" type="primary" @click="handleLocal" block>
          <div class="flex items-center justify-center gap-8">
            <Icon icon="file" :size="20" />
            <span>从文件导入</span>
          </div>
        </Button>
        <Button class="flex-1 h-48" type="primary" @click="handleRemote" block>
            <div class="flex items-center justify-center gap-8">
            <Icon icon="link" :size="20" />
            <span>从链接导入</span>
          </div>
        </Button>
      </div>
    </div>
    `,
    setup() {
      const handleLocal = () => {
        modal.close()
        void importLocalConfig()
      }
      const handleRemote = () => {
        modal.close()
        importRemoteConfig()
      }
      return {
        handleLocal,
        handleRemote
      }
    }
  })
  const modal = Plugins.modal(
    {
      title: '配置导入帮助',
      width: '420px',
      submit: false,
      cancelText: '关闭',
      maskClosable: true,
      afterClose: () => {
        modal.destroy()
      }
    },
    {
      default: () => h(component),
      action: () => h('div', { class: 'mr-auto text-12 opacity-60' }, '注：如果看不懂以上说明，建议使用快速开始。')
    }
  )
  modal.open()
}
/* 触发器 手动触发 */
const onRun = async () => {
  openUI()
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
