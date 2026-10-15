/* 流量统计 v2 — collection core */
const PATH = 'data/third/traffic-statistics-vibe'
const TAGS_FILE = PATH + '/tags.json'
const DataVersion = '-v2'
const LegacyVersion = '-v1'
const SCHEMA = 2
const LIMITS = { big: 3000, mid: 500, pivot: 200, top: 20 }
const DIMS = [
  'domains',
  'roots',
  'nodes',
  'processes',
  'process_names',
  'rules',
  'rule_payloads',
  'groups',
  'chains',
  'ports',
  'networks',
  'conn_types',
  'inbounds',
  'dest_ips',
  'src_ports_kind',
  'tags'
]
const PIVOTS = ['pivot_node_domain', 'pivot_node_process', 'pivot_domain_node', 'pivot_process_domain', 'pivot_tag_node']

window[Plugin.id] = window[Plugin.id] || { state: {} }
const store = window[Plugin.id].state
Object.assign(store, {
  currentMonth: store.currentMonth || '',
  data: store.data || null,
  tagsConfig: store.tagsConfig || {},
  lastConnections: store.lastConnections || {},
  lastTotals: store.lastTotals || null,
  unregs: store.unregs || [],
  realtime: store.realtime || [],
  autosaveTimer: store.autosaveTimer || null,
  nodeMetaAt: store.nodeMetaAt || 0
})

const pad2 = (n) => String(n).padStart(2, '0')
const monthKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`

const getRootDomain = (host) => {
  if (!host) return host
  let hostname = host
    .split(':')[0]
    .replace(/[\[\]]/g, '')
    .replace(/\.$/, '')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || !hostname.includes('.')) return hostname
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname
  const secondToLast = parts[parts.length - 2].toLowerCase()
  const last = parts[parts.length - 1].toLowerCase()
  if (last.length === 2 && ['com', 'co', 'net', 'org', 'gov', 'edu', 'ac'].includes(secondToLast)) return parts.slice(-3).join('.')
  return parts.slice(-2).join('.')
}

const createHourly = () => Array.from({ length: 24 }, () => ({ up: 0, down: 0, hits: 0, peakUp: 0, peakDown: 0 }))
const createEmptyStats = () => {
  const details = {}
  DIMS.forEach((k) => (details[k] = {}))
  PIVOTS.forEach((k) => (details[k] = {}))
  Object.assign(details, {
    log_levels: {},
    dns_types: {},
    dns_domains: {},
    dns_ip_kinds: { 'fake-ip': 0, 'real-ip': 0 },
    failed_hosts: {},
    clients: {}
  })
  return {
    summary: { up: 0, down: 0 },
    details,
    hourly: createHourly(),
    conn: { count: 0, closed: 0, durTotal: 0, durMax: 0, rejected: 0, direct: { up: 0, down: 0, hits: 0 }, proxy: { up: 0, down: 0, hits: 0 } },
    peak: { up: 0, down: 0, upAt: 0, downAt: 0 },
    memory: { peak: 0, peakAt: 0 },
    top_conns: [],
    long_conns: []
  }
}
const createMonth = () => ({ version: SCHEMA, ...createEmptyStats(), node_meta: {}, residual: { up: 0, down: 0 }, daily: {} })

// fill missing fields of v1/partial data with defaults (non-destructive)
const fillDefaults = (obj, def) => {
  for (const k in def) {
    if (obj[k] === undefined || obj[k] === null) obj[k] = def[k]
    else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && typeof obj[k] === 'object') fillDefaults(obj[k], def[k])
  }
  return obj
}
const LEGACY = '历史(v1)'
// v1 stats lack the v2 dimensions: put their totals into a "历史(v1)" bucket so every view sums to the same total
const backfillV1 = (t) => {
  const d = t.details
  const up = t.summary.up || 0
  const down = t.summary.down || 0
  if (!up && !down) return
  const sumHits = (map) => Object.values(map || {}).reduce((s, v) => s + ((v && v.hits) || 0), 0)
  const hits = sumHits(d.rules)
  ;['process_names', 'rule_payloads', 'groups', 'chains', 'ports', 'networks', 'conn_types', 'inbounds', 'dest_ips'].forEach((k) => {
    d[k][LEGACY] = { up, down, hits }
  })
  const direct = d.nodes?.DIRECT || { up: 0, down: 0 }
  t.conn.direct = { up: direct.up || 0, down: direct.down || 0, hits: 0 }
  t.conn.proxy = { up: Math.max(0, up - (direct.up || 0)), down: Math.max(0, down - (direct.down || 0)), hits: 0 }
  t.conn.count = hits
  t.legacy = { up, down }
}
const migrate = (raw) => {
  const isV1 = !raw || raw.version !== SCHEMA
  const m = raw || {}
  const hadConn = !!m.conn
  fillDefaults(m, createMonth())
  if (!Array.isArray(m.hourly) || m.hourly.length !== 24) m.hourly = createHourly()
  if (isV1 && !hadConn) backfillV1(m)
  for (const k in m.daily) {
    const day = m.daily[k] || (m.daily[k] = {})
    const dayHadConn = !!day.conn
    fillDefaults(day, createEmptyStats())
    if (!Array.isArray(day.hourly) || day.hourly.length !== 24) day.hourly = createHourly()
    for (const ip in day.details.clients)
      fillDefaults(day.details.clients[ip], { up: 0, down: 0, hits: 0, domains: {}, nodes: {}, processes: {}, rules: {}, tags: {} })
    if (isV1 && !dayHadConn) backfillV1(day)
  }
  for (const ip in m.details.clients)
    fillDefaults(m.details.clients[ip], { up: 0, down: 0, hits: 0, domains: {}, nodes: {}, processes: {}, rules: {}, tags: {} })
  if (isV1 && !m.v2Since) m.v2Since = Date.now()
  m.version = SCHEMA
  return m
}

const readMonth = async (month) => {
  try {
    return migrate(JSON.parse(await Plugins.ReadFile(`${PATH}/${month}${DataVersion}.json`)))
  } catch (e) {}
  try {
    return migrate(JSON.parse(await Plugins.ReadFile(`${PATH}/${month}${LegacyVersion}.json`)))
  } catch (e) {}
  return null
}

const initMonthlyData = async (now = new Date()) => {
  const month = monthKey(now)
  store.data = (await readMonth(month)) || createMonth()
  store.currentMonth = month
}

const ensureData = async () => {
  if (!store.data || !store.currentMonth) await initMonthlyData()
  else if (store.data.version !== SCHEMA) store.data = migrate(store.data) // live v1 state after plugin reload
}

// merge long tail of a map into "其他"
const capMap = (map, max) => {
  if (!map || typeof map !== 'object') return
  const keys = Object.keys(map)
  if (keys.length <= max) return
  const score = (v) => (typeof v === 'number' ? v : (v.up || 0) + (v.down || 0) + (v.hits || 0))
  keys.sort((a, b) => score(map[b]) - score(map[a]))
  const other = map['其他'] && typeof map['其他'] === 'object' ? map['其他'] : { up: 0, down: 0, hits: 0 }
  for (const k of keys.slice(max)) {
    if (k === '其他') continue
    const v = map[k]
    if (typeof v === 'object') {
      other.up = (other.up || 0) + (v.up || 0)
      other.down = (other.down || 0) + (v.down || 0)
      other.hits = (other.hits || 0) + (v.hits || 0)
    }
    delete map[k]
  }
  if (typeof map[keys[0]] === 'object') map['其他'] = other
}
const pruneStats = (s) => {
  const d = s && s.details
  if (!d) return
  ;['domains', 'dest_ips', 'dns_domains', 'failed_hosts'].forEach((k) => capMap(d[k], LIMITS.big))
  ;['roots', 'processes', 'process_names', 'rule_payloads', 'chains', 'ports', 'rules'].forEach((k) => capMap(d[k], LIMITS.mid))
  PIVOTS.forEach((p) => {
    capMap(d[p], LIMITS.mid)
    for (const k in d[p] || {}) capMap(d[p][k], LIMITS.pivot)
  })
  for (const ip in d.clients || {})
    ['domains', 'nodes', 'processes', 'rules', 'tags'].forEach((k) => d.clients[ip][k] && capMap(d.clients[ip][k], LIMITS.pivot))
}
const pruneAll = () => {
  if (!store.data) return
  pruneStats(store.data)
  for (const d in store.data.daily) pruneStats(store.data.daily[d])
}

const saveMonthlyData = async () => {
  if (!store.data || !/^\d{4}-\d{2}$/.test(store.currentMonth)) return false // guards the old "-v1.json" bug
  if (store.data.version !== SCHEMA) store.data = migrate(store.data)
  pruneAll()
  await Plugins.WriteFile(`${PATH}/${store.currentMonth}${DataVersion}.json`, JSON.stringify(store.data))
  return true
}

const bump = (map, key, up, down, isNew) => {
  if (key === undefined || key === null || key === '') return
  const e = map[key] || (map[key] = { up: 0, down: 0, hits: 0 })
  e.up += up
  e.down += down
  if (isNew) e.hits = (e.hits || 0) + 1
}
const bumpPivot = (pivot, a, b, up, down, isNew) => {
  if (!a || !b) return
  bump(pivot[a] || (pivot[a] = {}), b, up, down, isNew)
}

const updateStats = (target, diffUp, diffDown, isNew, info) => {
  if (!target) return
  target.summary.up += diffUp
  target.summary.down += diffDown
  const d = target.details
  const pairs = [
    ['domains', info.fqdn],
    ['roots', info.root],
    ['nodes', info.node],
    ['processes', info.process],
    ['process_names', info.processName],
    ['rules', info.rule],
    ['rule_payloads', info.rulePayload],
    ['groups', info.group],
    ['chains', info.chain],
    ['ports', info.port],
    ['networks', info.network],
    ['conn_types', info.type],
    ['inbounds', info.inbound],
    ['dest_ips', info.destIP],
    ['src_ports_kind', info.portKind]
  ]
  pairs.forEach(([k, v]) => bump(d[k] || (d[k] = {}), v, diffUp, diffDown, isNew))
  ;(info.tags || []).forEach((tag) => {
    bump(d.tags, tag, diffUp, diffDown, isNew)
    bumpPivot(d.pivot_tag_node, tag, info.node, diffUp, diffDown, isNew)
  })
  bumpPivot(d.pivot_node_domain, info.node, info.fqdn, diffUp, diffDown, isNew)
  bumpPivot(d.pivot_node_process, info.node, info.process, diffUp, diffDown, isNew)
  bumpPivot(d.pivot_domain_node, info.root, info.node, diffUp, diffDown, isNew)
  bumpPivot(d.pivot_process_domain, info.process, info.root, diffUp, diffDown, isNew)

  if (info.clientIP) {
    const c = d.clients[info.clientIP] || (d.clients[info.clientIP] = { up: 0, down: 0, hits: 0, domains: {}, nodes: {}, processes: {}, rules: {}, tags: {} })
    c.up += diffUp
    c.down += diffDown
    if (isNew) c.hits++
    bump(c.domains, info.fqdn, diffUp, diffDown, isNew)
    bump(c.nodes, info.node, diffUp, diffDown, isNew)
    bump(c.processes, info.process, diffUp, diffDown, isNew)
    bump(c.rules, info.rule, diffUp, diffDown, isNew)
    ;(info.tags || []).forEach((t) => bump(c.tags, t, diffUp, diffDown, isNew))
  }

  if (target.hourly && info.hour !== undefined) {
    const h = target.hourly[info.hour]
    h.up += diffUp
    h.down += diffDown
    if (isNew) h.hits++
  }
  if (target.conn) {
    const bucket = info.isDirect ? target.conn.direct : target.conn.proxy
    bucket.up += diffUp
    bucket.down += diffDown
    if (isNew) {
      bucket.hits++
      target.conn.count++
      if (info.isReject) target.conn.rejected++
    }
  }
}

// connection closed: durations + top lists
const recordClosed = (target, rec, endTs) => {
  if (!target?.conn) return
  const dur = Math.max(0, (endTs - rec.start) / 1000)
  target.conn.closed++
  target.conn.durTotal += dur
  if (dur > target.conn.durMax) target.conn.durMax = dur
  const item = {
    host: rec.info.fqdn,
    node: rec.info.node,
    chain: rec.info.chain,
    process: rec.info.processName || rec.info.process,
    rule: rec.info.rulePayload,
    network: rec.info.network,
    client: rec.info.clientIP,
    up: rec.up,
    down: rec.down,
    start: rec.start,
    duration: Math.round(dur)
  }
  const push = (list, key) => {
    list.push(item)
    list.sort((a, b) => key(b) - key(a))
    if (list.length > LIMITS.top) list.length = LIMITS.top
  }
  push(target.top_conns, (x) => x.up + x.down)
  push(target.long_conns, (x) => x.duration)
}

// sing-box reports `rule` as "<matcher> => <action>", e.g. "rule_set=GeoLocation-!CN => route(Proxy)",
// "final => route(Proxy)", "protocol=dns => hijack-dns", "domain=x => reject"; rulePayload is empty.
// mihomo reports `rule` = "RuleSet" and `rulePayload` = "GeoLocation". Normalize both to { rule, payload, action }.
const parseRule = (conn) => {
  const raw = String(conn.rule || '')
  const i = raw.indexOf(' => ')
  if (i < 0) return { rule: raw || 'Match', payload: conn.rulePayload || '', action: '' }
  const matcher = raw.slice(0, i).trim()
  const action = raw.slice(i + 4).trim()
  const eq = matcher.indexOf('=')
  return eq > 0 ? { rule: matcher.slice(0, eq), payload: matcher.slice(eq + 1), action } : { rule: matcher || 'final', payload: '', action }
}

const buildInfo = (conn, now) => {
  const m = conn.metadata || {}
  const r = parseRule(conn)
  const actionKind = (r.action.match(/^[a-z-]+/i) || [''])[0].toLowerCase()
  // sing-box rule actions (reject / hijack-dns ...) produce connections without an outbound chain
  const fallback = actionKind === 'reject' ? 'REJECT' : actionKind && actionKind !== 'route' ? actionKind.toUpperCase() : 'DIRECT'
  const chains = Array.isArray(conn.chains) && conn.chains.length ? conn.chains : [fallback]
  const host = m.host || m.sniffHost || m.destinationIP || 'unknown'
  const root = getRootDomain(host)
  let clientIP = m.sourceIP || 'unknown'
  if (clientIP.startsWith('fdfe') || clientIP.startsWith('172.18.') || clientIP === '::1') clientIP = '127.0.0.1'
  const node = chains[0]
  const processPath = m.processPath || m.process || 'system'
  // mihomo: type "HTTP" + inboundName; sing-box: type "<inbound type>/<inbound tag>" (e.g. "mixed/mixed-in")
  const rawType = m.type || 'unknown'
  const slash = rawType.indexOf('/')
  const type = slash > 0 ? rawType.slice(0, slash) : rawType
  const inboundTag = m.inboundName || (slash > 0 ? rawType.slice(slash + 1) : '')
  const meta = store.data?.node_meta?.[node]
  return {
    node,
    group: chains[chains.length - 1],
    chain: chains.slice().reverse().join(' → '),
    fqdn: host,
    root,
    process: processPath,
    processName: m.process || processPath.split(/[\\/]/).pop() || 'system',
    rule: r.rule,
    rulePayload: r.payload ? `${r.rule}(${r.payload})` : r.rule,
    tags: store.tagsConfig[root] || store.tagsConfig[host] || [],
    clientIP,
    port: m.destinationPort ? String(m.destinationPort) : '',
    network: (m.network || 'unknown').toUpperCase(),
    type,
    inbound: inboundTag || m.inboundUser || (m.inboundPort ? `${type}:${m.inboundPort}` : type),
    destIP: m.remoteDestination || m.destinationIP || '',
    portKind: m.dnsMode ? `dns:${m.dnsMode}` : '',
    // sing-box direct outbounds can have any tag ("direct", "🎯 Direct" ...): also trust the outbound type
    isDirect: node === 'DIRECT' || /^direct$/i.test(node) || meta?.type === 'Direct',
    isReject: chains.some((c) => /^REJECT/i.test(c)) || actionKind === 'reject' || meta?.type === 'Reject' || meta?.type === 'Block',
    hour: now.getHours()
  }
}

const dayBucket = (now) => {
  const day = String(now.getDate())
  if (!store.data.daily[day]) store.data.daily[day] = createEmptyStats()
  return store.data.daily[day]
}

const checkRollover = async (now) => {
  const month = monthKey(now)
  if (month !== store.currentMonth) {
    if (store.currentMonth) await saveMonthlyData()
    store.data = (await readMonth(month)) || createMonth()
    store.currentMonth = month
  }
}

const handleConnections = async (data, nowArg) => {
  await ensureData()
  const now = nowArg ? new Date(nowArg) : new Date()
  await checkRollover(now)
  const dayData = dayBucket(now)
  const connections = data.connections || []
  const totals = { up: Number(data.uploadTotal) || 0, down: Number(data.downloadTotal) || 0, has: data.downloadTotal !== undefined }

  // core restart / counter reset: totals went backwards → drop baselines
  if (store.lastTotals && totals.has && (totals.down < store.lastTotals.down || totals.up < store.lastTotals.up)) {
    store.lastConnections = {}
    store.lastTotals = null
  }

  const seen = new Set()
  let attributedUp = 0
  let attributedDown = 0
  for (const conn of connections) {
    if (!conn || !conn.id || seen.has(conn.id)) continue
    seen.add(conn.id)
    const prev = store.lastConnections[conn.id]
    const isNew = !prev || !prev.info
    let pDown = prev ? prev.download || 0 : 0
    let pUp = prev ? prev.upload || 0 : 0
    if ((conn.download || 0) < pDown || (conn.upload || 0) < pUp) pDown = pUp = 0 // per-conn reset
    let diffDown = Math.max(0, (conn.download || 0) - pDown)
    let diffUp = Math.max(0, (conn.upload || 0) - pUp)
    const info = !isNew ? prev.info : buildInfo(conn, now)
    info.hour = now.getHours()
    if (info.isReject) diffUp = diffDown = 0 // REJECT / REJECT-DROP: no payload is relayed
    if (isNew || diffDown > 0 || diffUp > 0) {
      updateStats(store.data, diffUp, diffDown, isNew, info)
      updateStats(dayData, diffUp, diffDown, isNew, info)
    }
    attributedUp += diffUp
    attributedDown += diffDown
    const start = prev && prev.start ? prev.start : Date.parse(conn.start) || now.getTime()
    store.lastConnections[conn.id] = {
      download: conn.download || 0,
      upload: conn.upload || 0,
      info,
      start,
      lastDiff: diffUp + diffDown,
      up: (isNew ? 0 : prev.up || 0) + diffUp,
      down: (isNew ? 0 : prev.down || 0) + diffDown
    }
  }

  // closed connections
  const closed = []
  for (const id in store.lastConnections) {
    if (!seen.has(id)) {
      if (store.lastConnections[id].info) closed.push(store.lastConnections[id])
      else delete store.lastConnections[id]
      delete store.lastConnections[id]
    }
  }
  // bytes moved by connections that closed between snapshots: totals delta − attributed
  if (store.lastTotals && totals.has) {
    const resUp = totals.up - store.lastTotals.up - attributedUp
    const resDown = totals.down - store.lastTotals.down - attributedDown
    if (resUp > 0 || resDown > 0) {
      const payers = closed.filter((x) => !x.info.isReject)
      if (payers.length) {
        const closed = payers
        const raw = closed.reduce((s, c) => s + (c.lastDiff || 0), 0)
        const weight = (c) => (raw ? (c.lastDiff || 0) / raw : 1 / closed.length) // by last observed speed
        let leftUp = Math.max(0, resUp)
        let leftDown = Math.max(0, resDown)
        closed.forEach((c, i) => {
          const w = weight(c)
          const u = i === closed.length - 1 ? leftUp : Math.round(Math.max(0, resUp) * w)
          const dn = i === closed.length - 1 ? leftDown : Math.round(Math.max(0, resDown) * w)
          leftUp -= u
          leftDown -= dn
          c.info.hour = now.getHours()
          updateStats(store.data, u, dn, false, c.info)
          updateStats(dayData, u, dn, false, c.info)
          c.up += u
          c.down += dn
        })
      } else {
        store.data.residual.up += Math.max(0, resUp)
        store.data.residual.down += Math.max(0, resDown)
      }
    }
  }
  closed.forEach((c) => {
    recordClosed(store.data, c, now.getTime())
    recordClosed(dayData, c, now.getTime())
  })
  if (totals.has) store.lastTotals = { up: totals.up, down: totals.down }
}

const handleTraffic = (data, nowArg) => {
  const now = nowArg ? new Date(nowArg) : new Date()
  const up = Number(data.up) || 0
  const down = Number(data.down) || 0
  store.realtime.push({ t: now.getTime(), up, down })
  if (store.realtime.length > 180) store.realtime.splice(0, store.realtime.length - 180)
  if (!store.data || !store.data.peak || monthKey(now) !== store.currentMonth) return
  const dayData = dayBucket(now)
  for (const t of [store.data, dayData]) {
    if (up > t.peak.up) ((t.peak.up = up), (t.peak.upAt = now.getTime()))
    if (down > t.peak.down) ((t.peak.down = down), (t.peak.downAt = now.getTime()))
    const h = t.hourly[now.getHours()]
    if (up > h.peakUp) h.peakUp = up
    if (down > h.peakDown) h.peakDown = down
  }
}

const handleMemory = (data, nowArg) => {
  if (!store.data || !store.data.memory) return
  const now = nowArg ? new Date(nowArg) : new Date()
  const inuse = Number(data.inuse) || 0
  if (inuse > store.data.memory.peak) store.data.memory = { peak: inuse, peakAt: now.getTime() }
}

// node protocol type + latest delay from kernel /proxies
const refreshNodeMeta = () => {
  try {
    const proxies = Plugins.useKernelApiStore().proxies || {}
    const list = Array.isArray(proxies) ? proxies : Object.values(proxies)
    for (const p of list) {
      if (!p?.name) continue
      const hist = Array.isArray(p.history) ? p.history : []
      const last = hist[hist.length - 1]
      store.data.node_meta[p.name] = {
        type: p.type,
        udp: !!p.udp,
        delay: last ? last.delay : (store.data.node_meta[p.name]?.delay ?? null),
        group: Array.isArray(p.all)
      }
    }
  } catch (e) {}
}

const handleLogs = async (data) => {
  if (!store.data || store.data.version !== SCHEMA) return
  const now = new Date()
  const dayData = dayBucket(now)
  const type = data.type || 'unknown'
  const payload = data.payload || ''
  for (const t of [store.data, dayData]) t.details.log_levels[type] = (t.details.log_levels[type] || 0) + 1

  let dnsInfo = null
  const dnsMatch = payload.match(/\[DNS\](?:\s+cache\s+hit)?\s+([^\s]+)\s+-->\s+\[(.*?)\]\s+([A-Z0-9]+)/i)
  if (dnsMatch) {
    dnsInfo = { domain: dnsMatch[1].replace(/\.$/, ''), result: dnsMatch[2].trim().split(/\s+/)[0] || '', dnsType: dnsMatch[3].toUpperCase() }
  } else if (payload.includes('dns: exchanged')) {
    const lm = payload.match(/dns: exchanged\s+([A-Z0-9]+)\s+([^\s]+)\s+\d+\s+IN\s+[A-Z0-9]+\s+([^\s]+)/i)
    if (lm) dnsInfo = { dnsType: lm[1].toUpperCase(), domain: lm[2].replace(/\.$/, ''), result: lm[3] }
  }
  if (dnsInfo) {
    const { dnsType, domain, result } = dnsInfo
    for (const t of [store.data, dayData]) {
      const d = t.details
      d.dns_types[dnsType] = (d.dns_types[dnsType] || 0) + 1
      const e = d.dns_domains[domain] || (d.dns_domains[domain] = { hits: 0, types: {} })
      e.hits++
      e.types[dnsType] = (e.types[dnsType] || 0) + 1
      if ((dnsType === 'A' || dnsType === 'AAAA') && result) {
        const r = result.toLowerCase()
        const kind = r.startsWith('198.18.') || r.startsWith('fc00') || r.startsWith('fd00') ? 'fake-ip' : 'real-ip'
        d.dns_ip_kinds[kind] = (d.dns_ip_kinds[kind] || 0) + 1
      }
    }
  }
  // failed dials: "... --> host:port error: ..." / "dial ... failed"
  if (type === 'warning' || type === 'error') {
    const fm = payload.match(/-->\s+([^\s]+?)(?::\d+)?\s+(?:error|match)/i) || payload.match(/dial\s+[^\s]+\s+.*?([a-z0-9.-]+\.[a-z]{2,})/i)
    if (fm && /error|fail|timeout|refused/i.test(payload)) {
      for (const t of [store.data, dayData]) {
        const e = t.details.failed_hosts[fm[1]] || (t.details.failed_hosts[fm[1]] = { hits: 0, last: 0 })
        e.hits++
        e.last = now.getTime()
      }
    }
  }
}

const autosaveMinutes = () => {
  const v = Number(Plugin.AutoSaveMinutes)
  return v > 0 ? v : 5
}

const Start = async (params = Plugin) => {
  console.log(`[${Plugin.name}] Start()`)
  await ensureData()
  try {
    store.tagsConfig = JSON.parse(await Plugins.ReadFile(TAGS_FILE))
  } catch (e) {}
  await Plugins.StopServer(Plugin.id).catch(() => {})
  const router = new Router()
  registerStatsApi(router)
  registerTagsApi(router)
  router.get('/v1/docs/json', {}, (req, res) =>
    res.json(
      200,
      router.routes.map((r) => ({ method: r.method, path: r.path, metadata: r.metadata }))
    )
  )
  await Plugins.StartServer(params.ApiAddress || '127.0.0.1:23328', Plugin.id, async (req, res) => router.match(req, res))
  registerHandler()
  if (store.autosaveTimer) clearInterval(store.autosaveTimer)
  store.autosaveTimer = setInterval(() => saveMonthlyData().catch((e) => console.log(`[${Plugin.name}] autosave`, e)), autosaveMinutes() * 60000)
  return 1
}

const Stop = async () => {
  console.log(`[${Plugin.name}] Stop()`)
  if (store.autosaveTimer) clearInterval(store.autosaveTimer)
  store.autosaveTimer = null
  await saveMonthlyData()
  await Plugins.StopServer(Plugin.id)
  unRegisterHandler()
  return 2
}

const registerHandler = () => {
  unRegisterHandler() // prevent double subscription (double counting) when Start runs twice
  const kernel = Plugins.useKernelApiStore()
  store.unregs.push(kernel.onConnections((d) => handleConnections(d).catch((e) => console.log(`[${Plugin.name}] conn`, e))))
  store.unregs.push(kernel.onLogs((d) => handleLogs(d).catch(() => {})))
  store.unregs.push(kernel.onTraffic((d) => handleTraffic(d)))
  store.unregs.push(kernel.onMemory((d) => handleMemory(d)))
}

const unRegisterHandler = () => {
  store.unregs.forEach((u) => u?.())
  store.unregs = []
}

const onBeforeCoreStart = async (config, profile) => {
  if (Plugins.APP_TITLE.includes('SingBox')) config.log.level = 'debug'
  return config
}

const onReady = async () => {
  await initMonthlyData()
  await Stop().catch((err) => console.log(`[${Plugin.name}] onReady: Stop()`, err))
  await Start().catch((err) => console.log(`[${Plugin.name}] onReady: Start()`, err))
  return 1
}

const onShutdown = async () => {
  await Stop().catch((err) => console.log(`[${Plugin.name}] onShutdown: Stop()`, err))
  return 2
}

const onReload = async () => {
  await saveMonthlyData()
}

const Utils = {
  paginate(data, pageNum, pageSize) {
    pageNum = Math.max(1, Number(pageNum))
    pageSize = Math.max(1, Number(pageSize))
    const startIndex = (pageNum - 1) * pageSize
    return { pageNum, pageSize, total: data.length, list: data.slice(startIndex, startIndex + pageSize) }
  },
  sortByField(arr, field, order = 'desc') {
    return arr.sort((a, b) => {
      const valA = a[field]
      const valB = b[field]
      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1
      if (typeof valA === 'number' && typeof valB === 'number') return order === 'desc' ? valB - valA : valA - valB
      return order === 'desc' ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB))
    })
  },
  paginateAndSort(list, query) {
    const { sort, pageNum = 1, pageSize = 10, order } = query
    sort && Utils.sortByField(list, sort, order)
    return Utils.paginate(list, pageNum, pageSize)
  },
  empty(query) {
    return { pageNum: Number(query.pageNum || 1), pageSize: Number(query.pageSize || 10), total: 0, list: [] }
  },
  toList(map) {
    return Object.entries(map || {}).map(([name, val]) =>
      typeof val === 'number' ? { name, count: val } : { name, ...val, total: (val.up || 0) + (val.down || 0) }
    )
  },
  async getMonthData(month) {
    await ensureData()
    if (!month || month === store.currentMonth) return store.data
    return await readMonth(month)
  },
  async getTargetData(query) {
    const m = await Utils.getMonthData(query.month)
    if (!m) return null
    return query.day ? m.daily[query.day] : m
  },
  async listMonths() {
    let names = []
    try {
      names = (await Plugins.ReadDir(PATH)).map((f) => f.name)
    } catch (e) {}
    const set = new Set(store.currentMonth ? [store.currentMonth] : [])
    names.forEach((n) => {
      const m = n.match(/^(\d{4}-\d{2})-v[12]\.json$/)
      if (m) set.add(m[1])
    })
    return [...set].sort().reverse()
  }
}

function registerStatsApi(router) {
  router.get('/v1/stats/overview', { description: { zh: '实时统计概览' } }, (req, res) => {
    const d = store.data
    res.json(200, {
      month_summary: d ? d.summary : null,
      current_month: store.currentMonth,
      conn: d?.conn,
      peak: d?.peak,
      memory: d?.memory,
      residual: d?.residual,
      realtime: store.realtime.slice(-1)[0] || null,
      active_connections: Object.keys(store.lastConnections).length
    })
  })
  router.get(
    '/v1/stats/rank/:dimension',
    {
      description: { zh: '按维度统计: ' + DIMS.concat(['log_levels', 'dns_types', 'dns_domains', 'dns_ip_kinds', 'failed_hosts', 'clients']).join(',') },
      examples: { 节点下行流量排行: '/v1/stats/rank/nodes?sort=down', 端口排行: '/v1/stats/rank/ports?sort=total', 代理链: '/v1/stats/rank/chains?sort=total' }
    },
    async (req, res, { dimension }) => {
      const target = await Utils.getTargetData(req.query)
      if (!target || !target.details[dimension]) return res.json(200, Utils.empty(req.query))
      res.json(200, Utils.paginateAndSort(Utils.toList(target.details[dimension]), req.query))
    }
  )
  router.get('/v1/stats/clients/:ip', { description: { zh: '按客户端查询: ip' } }, async (req, res, { ip }) => {
    const target = await Utils.getTargetData(req.query)
    if (!target || !target.details.clients[ip]) return res.end(404, {}, `Client not found: ${ip}`)
    res.json(200, target.details.clients[ip])
  })
  router.get('/v1/stats/clients/:ip/:dimension', { description: { zh: '按客户端和维度查询' } }, async (req, res, { ip, dimension }) => {
    const target = await Utils.getTargetData(req.query)
    if (!target || !target.details.clients[ip]?.[dimension]) return res.json(200, Utils.empty(req.query))
    res.json(200, Utils.paginateAndSort(Utils.toList(target.details.clients[ip][dimension]), req.query))
  })
  router.get(
    '/v1/stats/pivot/:type/:key',
    { description: { zh: '交叉统计 type: node | node_process | domain | process | tag' } },
    async (req, res, { type, key }) => {
      const target = await Utils.getTargetData(req.query)
      if (!target) return res.json(200, Utils.empty(req.query))
      const field =
        { node: 'pivot_node_domain', node_process: 'pivot_node_process', domain: 'pivot_domain_node', process: 'pivot_process_domain', tag: 'pivot_tag_node' }[
          type
        ] || 'pivot_tag_node'
      const detail = target.details[field]?.[key]
      if (!detail) return res.json(404, 'No Data')
      res.json(200, Utils.paginateAndSort(Utils.toList(detail), req.query))
    }
  )
  router.get('/v1/stats/hourly', { description: { zh: '24 小时分布 (?month=&day=)' } }, async (req, res) => {
    const target = await Utils.getTargetData(req.query)
    res.json(200, target ? target.hourly : [])
  })
  router.get('/v1/stats/daily', { description: { zh: '每日汇总 (?month=)' } }, async (req, res) => {
    const m = await Utils.getMonthData(req.query.month)
    res.json(200, m ? Object.entries(m.daily).map(([day, d]) => ({ day, ...d.summary, conns: d.conn?.count || 0, peakDown: d.peak?.down || 0 })) : [])
  })
  router.get('/v1/stats/connections', { description: { zh: '连接统计 / 峰值 / 直连代理比' } }, async (req, res) => {
    const t = await Utils.getTargetData(req.query)
    res.json(200, t ? { conn: t.conn, peak: t.peak } : null)
  })
  router.get('/v1/stats/top/:kind', { description: { zh: 'kind: bytes | duration' } }, async (req, res, { kind }) => {
    const t = await Utils.getTargetData(req.query)
    res.json(200, t ? (kind === 'duration' ? t.long_conns : t.top_conns) : [])
  })
  router.get('/v1/stats/realtime', { description: { zh: '最近 120 个实时速率采样' } }, (req, res) => res.json(200, store.realtime))
  router.get('/v1/stats/nodes/meta', { description: { zh: '节点协议类型与延迟' } }, (req, res) => res.json(200, store.data?.node_meta || {}))
  router.get('/v1/stats/history/months', {}, async (req, res) => res.json(200, await Utils.listMonths()))
}

function registerTagsApi(router) {
  router.get('/v1/tags', {}, (req, res) => res.json(200, store.tagsConfig))
  router.post('/v1/tags', {}, async (req, res) => {
    store.tagsConfig = Plugins.deepAssign(store.tagsConfig, typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body)
    await Plugins.WriteFile(TAGS_FILE, JSON.stringify(store.tagsConfig))
    res.json(200, 'OK')
  })
}

/* ======================= UI ======================= */
/* ======================= UI ======================= */
const onRun = async () => {
  // clicked right after a close: queue the open (300ms) instead of dropping it
  const since = Date.now() - (TrafficUI.closedAt || 0)
  if (since < 300) await new Promise((r) => setTimeout(r, 300 - since))
  // a previous window may still be playing its close animation: wait for it (bounded) instead of racing it
  if (TrafficUI.closing) await Promise.race([TrafficUI.closing, new Promise((r) => setTimeout(r, 600))])
  TrafficUI.closing = null
  if (TrafficUI.modal) {
    // stale instance from an earlier open: drop it so this click always opens a fresh window
    try {
      TrafficUI.modal.destroy()
    } catch (e) {}
    TrafficUI.modal = null
  }
  TrafficUI.stopTimer()
  await ensureData()
  refreshNodeMeta()
  const modal = Plugins.modal({
    title: '流量统计',
    width: '92',
    height: '92',
    minWidth: '90',
    minHeight: '90',
    maxWidth: '96',
    maxHeight: '96',
    submit: false,
    cancelText: '关闭',
    maskClosable: true,
    beforeClose: () => {
      // the fading mask would swallow a Run click during the close animation: let clicks pass through it
      const mask = TrafficUI.rootEl && TrafficUI.rootEl.closest && TrafficUI.rootEl.closest('.gui-modal-mask')
      if (mask) mask.style.pointerEvents = 'none'
      TrafficUI.closing = new Promise((r) => (TrafficUI.closed = r))
      return true
    },
    afterClose: () => {
      TrafficUI.closed && TrafficUI.closed()
      TrafficUI.closedAt = Date.now()
      TrafficUI.closing = null
      // destroyOnClose (default true) unmounts it; calling destroy() here re-entered close and could leave a stale instance
      TrafficUI.stopTimer()
      if (TrafficUI.modal === modal) TrafficUI.modal = null
    }
  })
  TrafficUI.modal = modal
  // the component exposes modalSlots (toolbar / action), setContent patches them into the modal
  modal.setContent(TrafficUI.createComponent(), null, null, false)
  modal.open()
}

const TrafficUI = {
  timer: null,
  PALETTE: ['#4e79a7', '#59a14f', '#e0a33a', '#c75c5c', '#76a3b8', '#8f7bb0', '#b0876a', '#8a9a5b', '#a0a4ab'],
  TABS: [
    { label: '节点', value: 'nodes' },
    { label: '域名', value: 'domains' },
    { label: '根域名', value: 'roots' },
    { label: '进程', value: 'process_names' },
    { label: '进程路径', value: 'processes' },
    { label: '规则', value: 'rules' },
    { label: '规则+载荷', value: 'rule_payloads' },
    { label: '策略组', value: 'groups' },
    { label: '代理链', value: 'chains' },
    { label: '端口', value: 'ports' },
    { label: '协议', value: 'networks' },
    { label: '入站', value: 'inbounds' },
    { label: '目标 IP', value: 'dest_ips' },
    { label: '客户端', value: 'clients' },
    { label: '标签', value: 'tags' },
    { label: '失败', value: 'failed_hosts' }
  ],
  DRILL: {
    nodes: [
      { label: '域名', field: 'pivot_node_domain' },
      { label: '进程', field: 'pivot_node_process' }
    ],
    domains: [{ label: '节点', field: 'pivot_domain_node', keyOf: (r) => getRootDomain(r.name) }],
    roots: [{ label: '节点', field: 'pivot_domain_node' }],
    processes: [{ label: '域名', field: 'pivot_process_domain' }],
    tags: [{ label: '节点', field: 'pivot_tag_node' }],
    clients: [
      { label: '域名', client: 'domains' },
      { label: '节点', client: 'nodes' },
      { label: '进程', client: 'processes' },
      { label: '规则', client: 'rules' },
      { label: '标签', client: 'tags' }
    ]
  },
  stopTimer() {
    if (TrafficUI.timer) clearInterval(TrafficUI.timer)
    TrafficUI.timer = null
  },
  fmt(n) {
    n = Number(n) || 0
    const u = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    while (n >= 1024 && i < u.length - 1) ((n /= 1024), i++)
    return (i === 0 ? n : n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)) + ' ' + u[i]
  },
  speed(n) {
    return TrafficUI.fmt(n) + '/s'
  },
  num(n) {
    n = Number(n) || 0
    return n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1) + '万' : n.toLocaleString()
  },
  dur(s) {
    s = Math.round(Number(s) || 0)
    if (s < 60) return s + '秒'
    if (s < 3600) return Math.floor(s / 60) + '分' + (s % 60 ? (s % 60) + '秒' : '')
    if (s < 86400) return Math.floor(s / 3600) + '时' + Math.floor((s % 3600) / 60) + '分'
    return Math.floor(s / 86400) + '天' + Math.floor((s % 86400) / 3600) + '时'
  },
  time(ts) {
    if (!ts) return '-'
    const d = new Date(ts)
    return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  },
  // ---- pure view-model builders (tested in node) ----
  buildRows(map, { search = '', sort = 'total', order = 'desc' } = {}) {
    const rows = Object.entries(map || {}).map(([name, v]) => {
      if (typeof v === 'number') return { name, up: 0, down: 0, total: 0, hits: v }
      const up = v.up || 0
      const down = v.down || 0
      return { name, up, down, total: up + down, hits: v.hits || 0, last: v.last }
    })
    const sumBytes = rows.reduce((s, r) => s + r.total, 0)
    const sumHits = rows.reduce((s, r) => s + r.hits, 0)
    rows.forEach((r) => (r.percent = sumBytes ? (r.total / sumBytes) * 100 : sumHits ? (r.hits / sumHits) * 100 : 0))
    const q = search.trim().toLowerCase()
    const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows
    list.sort((a, b) => {
      const x = a[sort]
      const y = b[sort]
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return order === 'desc' ? -c : c
    })
    return list
  },
  buildDaily(monthData, month) {
    const [y, m] = (month || '').split('-').map(Number)
    const days = y && m ? new Date(y, m, 0).getDate() : 31
    const list = []
    for (let d = 1; d <= days; d++) {
      const dd = monthData?.daily?.[String(d)]
      const s = dd?.summary || {}
      list.push({ day: String(d), up: s.up || 0, down: s.down || 0, conns: dd?.conn?.count || 0, hourly: dd?.hourly || null })
    }
    return list
  },
  buildChart(daily, selectedDay, W = 960, H = 220) {
    const L = 56 // left gutter for y labels
    const T = 14 // top padding so the top label is never clipped
    const B = 20 // bottom area for day labels
    const plot = H - T - B
    const base = T + plot
    const peak = Math.max(0, ...daily.map((d) => d.up + d.down)) // stacked value
    // 4 equal steps with a "nice" step size, so max = 4 × step ≥ peak
    const rawStep = Math.max(256, peak / 4)
    const p = Math.pow(1024, Math.floor(Math.log(rawStep) / Math.log(1024)))
    const step = p * [1, 1.25, 2, 2.5, 5, 7.5, 10, 12.5, 20, 25, 50, 75, 100, 125, 200, 250, 500, 750, 1000, 1024].find((x) => x * p >= rawStep)
    const max = step * 4
    const yOf = (v) => base - (v / max) * plot
    const ticks = [0, 1, 2, 3, 4].map((k) => ({ y: yOf(step * k), label: TrafficUI.fmt(step * k) }))
    const bw = (W - L) / daily.length
    const bars = daily.map((d, i) => {
      const hDown = (d.down / max) * plot
      const hUp = (d.up / max) * plot
      return {
        ...d,
        x: L + i * bw + bw * 0.18,
        w: Math.max(1, bw * 0.64),
        yDown: base - hDown,
        hDown,
        yUp: base - hDown - hUp,
        hUp,
        lx: L + i * bw + bw / 2,
        bx: L + i * bw,
        bw,
        active: selectedDay === d.day,
        tip: `${d.day} 日  合计 ${TrafficUI.fmt(d.up + d.down)}\n上传 ${TrafficUI.fmt(d.up)}  下载 ${TrafficUI.fmt(d.down)}\n连接 ${d.conns}`
      }
    })
    return { bars, ticks, W, H, plot, L, T, base, max }
  },
  HEAT: [0, 0.18, 0.34, 0.52, 0.74, 1],
  buildHeatmap(monthData, daily, selectedDay) {
    const rows = selectedDay ? daily.filter((d) => d.day === selectedDay) : daily.filter((d) => d.up + d.down > 0)
    let max = 0
    rows.forEach((r) => (r.hourly || []).forEach((h) => (max = Math.max(max, (h.up || 0) + (h.down || 0)))))
    const has = max > 0
    const out = rows.map((r) => ({
      day: r.day,
      cells: Array.from({ length: 24 }, (_, h) => {
        const v = r.hourly?.[h] || {}
        const t = (v.up || 0) + (v.down || 0)
        const lvl = !t ? 0 : Math.min(5, 1 + Math.floor(Math.sqrt(t / max) * 4.999))
        return {
          h,
          lvl,
          alpha: TrafficUI.HEAT[lvl],
          tip: `${r.day} 日 ${pad2(h)}:00-${pad2(h + 1)}:00\n流量 ${TrafficUI.fmt(t)}  连接 ${v.hits || 0}${v.peakDown ? '\n下载峰值 ' + TrafficUI.speed(v.peakDown) : ''}`
        }
      })
    }))
    const legend = TrafficUI.HEAT.map((a) => ({ alpha: a }))
    return { rows: has ? out : [], max, legend, single: !!selectedDay }
  },
  buildDonut(map, limit = 6, valueOf = (v) => (v.up || 0) + (v.down || 0)) {
    const entries = Object.entries(map || {})
      .map(([name, v]) => ({ name, value: typeof v === 'number' ? v : valueOf(v) }))
      .filter((e) => e.value > 0)
    entries.sort((a, b) => b.value - a.value)
    const top = entries.slice(0, limit)
    const rest = entries.slice(limit).reduce((s, e) => s + e.value, 0)
    if (rest > 0) top.push({ name: '其他', value: rest })
    const total = top.reduce((s, e) => s + e.value, 0)
    const R = 42
    const C = 2 * Math.PI * R
    let acc = 0
    const segs = top.map((e, i) => {
      const len = total ? (e.value / total) * C : 0
      const seg = {
        ...e,
        label: e.name,
        color: TrafficUI.PALETTE[i % TrafficUI.PALETTE.length],
        dash: `${len} ${C - len}`,
        offset: -acc,
        percent: total ? (e.value / total) * 100 : 0
      }
      acc += len
      return seg
    })
    return { segs, total, R }
  },
  // smallest "nice" value ≥ v (1/2/2.5/5 × 1024^k), so bars never exceed the top tick
  niceMax(v, floor = 1024) {
    v = Math.max(floor, v)
    const p = Math.pow(1024, Math.floor(Math.log(v) / Math.log(1024)))
    const steps = [1, 1.25, 2, 2.5, 4, 5, 7.5, 10, 12.5, 20, 25, 40, 50, 75, 100, 125, 200, 250, 400, 500, 750, 1000, 1024]
    return p * steps.find((x) => x * p >= v)
  },
  buildSpark(samples, W = 600, H = 150) {
    const N = 180
    const list = samples.slice(-N)
    const peak = Math.max(0, ...list.map((x) => Math.max(x.up, x.down)))
    // nice y-scale with a 10 KB/s floor
    const max = TrafficUI.niceMax(peak * 1.05, 1024)
    const L = 58
    const plotW = W - L - 4
    const plotH = H - 18
    const step = plotW / (N - 1)
    const off = N - list.length
    const y = (v) => (4 + plotH - (v / max) * plotH).toFixed(1)
    const pts = (k) => list.map((x, i) => `${(L + (off + i) * step).toFixed(1)},${y(x[k])}`).join(' ')
    const last = list[list.length - 1] || { up: 0, down: 0 }
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: Number(y(max * f)), label: TrafficUI.speed(max * f) }))
    const first = list[0]
    const xlabels = first
      ? [
          { x: L + off * step, label: new Date(first.t).toLocaleTimeString() },
          { x: W - 4, label: new Date(last.t).toLocaleTimeString() }
        ]
      : []
    return {
      up: pts('up'),
      down: pts('down'),
      downArea: list.length > 1 ? `${(L + off * step).toFixed(1)},${4 + plotH} ${pts('down')} ${(L + (N - 1) * step).toFixed(1)},${4 + plotH}` : '',
      max,
      peak,
      last,
      W,
      H,
      L,
      ticks,
      xlabels,
      count: list.length,
      bottom: 4 + plotH
    }
  },
  buildKpi(t, monthData) {
    const s = t?.summary || {}
    const c = t?.conn || {}
    // conn.direct only covers v2-era traffic; legacy traffic is known per node, so take the larger and derive proxy from the total
    const nd = t?.details?.nodes?.DIRECT || {}
    const tot = (s.up || 0) + (s.down || 0)
    const direct = Math.min(tot, Math.max((c.direct?.up || 0) + (c.direct?.down || 0), (nd.up || 0) + (nd.down || 0)))
    const proxy = Math.max(0, tot - direct)
    return {
      total: (s.up || 0) + (s.down || 0),
      up: s.up || 0,
      down: s.down || 0,
      conns: c.count || 0,
      rejected: c.rejected || 0,
      closed: c.closed || 0,
      avgDur: c.closed ? c.durTotal / c.closed : 0,
      maxDur: c.durMax || 0,
      peakDown: t?.peak?.down || 0,
      peakUp: t?.peak?.up || 0,
      peakAt: t?.peak?.downAt || 0,
      directPct: direct + proxy ? (direct / (direct + proxy)) * 100 : 0,
      direct,
      proxy,
      memPeak: monthData?.memory?.peak || 0
    }
  },
  REMAINDER: '未细分（升级前/未记录）',
  // add a remainder entry so a dimension always sums to the summary total
  reconcile(map, summary) {
    const out = { ...(map || {}) }
    if (!summary) return out
    let up = 0
    let down = 0
    for (const k in out) {
      const v = out[k]
      if (v && typeof v === 'object') ((up += v.up || 0), (down += v.down || 0))
    }
    const ru = (summary.up || 0) - up
    const rd = (summary.down || 0) - down
    const tot = (summary.up || 0) + (summary.down || 0)
    if (tot && ru + rd > tot * 0.001) out[TrafficUI.REMAINDER] = { up: Math.max(0, ru), down: Math.max(0, rd), hits: 0 }
    return out
  },
  groupConns(list, skipZero) {
    const groups = {}
    for (const c of list || []) {
      const bytes = (c.up || 0) + (c.down || 0)
      if (skipZero && !bytes) continue
      const key = c.host + '\u0000' + c.node
      const g =
        groups[key] ||
        (groups[key] = { key, host: c.host, node: c.node, chain: c.chain, process: c.process, rule: c.rule, count: 0, up: 0, down: 0, duration: 0, items: [] })
      g.count++
      g.up += c.up || 0
      g.down += c.down || 0
      g.duration = Math.max(g.duration, c.duration || 0)
      g.items.push({ ...c })
    }
    return Object.values(groups)
  },
  getDrillMap(target, tab, drill) {
    if (!target || !drill) return {}
    const d = target.details
    const opt = (TrafficUI.DRILL[tab] || [])[drill.sub] || {}
    if (opt.client) return d.clients?.[drill.key]?.[opt.client] || {}
    return d[opt.field]?.[drill.key] || {}
  },
  // grouped connections -> flat rows for <Table>; children follow their (expanded) group
  flattenConns(listId, groups, expanded = {}) {
    const out = []
    for (const g of groups || []) {
      const key = listId + g.key
      const open = g.count > 1 && !!expanded[key]
      out.push({
        id: key,
        key,
        group: true,
        open,
        expandable: g.count > 1,
        host: g.host,
        sub: [g.process, g.rule].filter(Boolean).join(' · '),
        node: g.node,
        chain: g.chain || g.node,
        count: g.count,
        bytes: g.up + g.down,
        duration: g.duration
      })
      if (open)
        g.items.forEach((c, i) =>
          out.push({
            id: key + '#' + i,
            key,
            group: false,
            host: [TrafficUI.time(c.start), c.network, c.client].filter(Boolean).join(' · '),
            sub: '',
            node: c.process || '',
            chain: c.chain || c.node || '',
            count: '',
            bytes: (c.up || 0) + (c.down || 0),
            duration: c.duration
          })
        )
    }
    return out
  },
  SORTS: [
    { label: '按合计', value: 'total' },
    { label: '按下载', value: 'down' },
    { label: '按上传', value: 'up' },
    { label: '按连接数', value: 'hits' },
    { label: '按名称', value: 'name' }
  ],
  PAGE_SIZES: [
    { label: '15 条/页', value: '15' },
    { label: '30 条/页', value: '30' },
    { label: '100 条/页', value: '100' }
  ],
  RANK_COLUMNS: [
    { title: '#', key: 'rank', align: 'right' },
    { title: '名称', key: 'name' },
    { title: '上传', key: 'up', align: 'right' },
    { title: '下载', key: 'down', align: 'right' },
    { title: '合计', key: 'total', align: 'right' },
    { title: '连接', key: 'hits', align: 'right' },
    { title: '占比', key: 'percent' }
  ],
  // fixed cell widths (see the #slots) + a name width derived from the window, so columns never shift between refreshes
  // w = measured width of the content root (ResizeObserver), not the screen/window
  // tabsW = natural width of the tab row; below it the tabs become a Select
  tableLayout(w, sortKey, tabsW = 1100) {
    const narrow = w < 760
    // hide secondary columns when narrow, but never the one being sorted by
    const cols = TrafficUI.RANK_COLUMNS.map((c) => (narrow && c.key !== sortKey && ['up', 'down', 'hits'].includes(c.key) ? { ...c, hidden: true } : c))
    // rank 24 + total 72 + share 120 (+ up/down 72 each + hits 52) + 16px padding per cell + card padding/scrollbar ~32
    const extra = { up: 72, down: 72, hits: 52 }
    const fixed =
      24 + 72 + 120 + cols.reduce((sum, c) => sum + (!c.hidden && extra[c.key] ? extra[c.key] : 0), 0) + cols.filter((c) => !c.hidden).length * 16 + 32
    const ringCols = w >= 1000 ? 3 : w >= 600 ? 2 : 1
    return { narrow, compact: w < tabsW, ringCols, colsKey: cols.map((c) => (c.hidden ? 0 : 1)).join(''), cols, nameW: Math.max(60, Math.floor(w) - fixed) }
  },
  CONN_COLUMNS: [
    { title: '目标 / 进程', key: 'host' },
    { title: '节点', key: 'node' },
    { title: '次数', key: 'count', align: 'right' },
    { title: '流量', key: 'bytes', align: 'right' },
    { title: '时长', key: 'duration', align: 'right' }
  ],
  // whole view model, rebuilt from scratch on every refresh / user action (store data is mutated in place, so no reliance on Vue tracking it)
  buildView(st, pastData) {
    const isCurrent = st.month === store.currentMonth
    const md = isCurrent ? store.data : pastData
    const t = md ? (st.day ? md.daily?.[st.day] : md) : null
    const daily = TrafficUI.buildDaily(md, st.month)
    const d = t?.details || {}
    const c = t?.conn || {}
    const sum = t?.summary
    const RECON = [
      'domains',
      'roots',
      'nodes',
      'processes',
      'process_names',
      'rules',
      'rule_payloads',
      'groups',
      'chains',
      'ports',
      'networks',
      'conn_types',
      'inbounds',
      'dest_ips',
      'clients'
    ]
    const kpi = TrafficUI.buildKpi(t, md)
    const donut = (title, map, byHits) => {
      if (!byHits) map = TrafficUI.reconcile(map, sum)
      const r = TrafficUI.buildDonut(map, 6, byHits ? (v) => v.hits || 0 : undefined)
      return { title, ...r, centerLabel: byHits ? '连接' : '合计', centerValue: byHits ? TrafficUI.num(r.total) : TrafficUI.fmt(r.total) }
    }
    const drillOptions = TrafficUI.DRILL[st.tab] || []
    let map = st.drill ? TrafficUI.getDrillMap(t, st.tab, st.drill) : d[st.tab]
    if (!st.drill && RECON.includes(st.tab)) map = TrafficUI.reconcile(map, sum)
    const rows = TrafficUI.buildRows(map, { search: st.search, sort: st.sort, order: st.order })
    if (st.tab === 'nodes' && !st.drill) {
      const meta = md?.node_meta || {}
      rows.forEach((r) => (r.meta = meta[r.name] ? { ...meta[r.name] } : null))
    }
    const pages = Math.max(1, Math.ceil(rows.length / st.pageSize))
    if (st.page > pages) st.page = pages
    const offset = (st.page - 1) * st.pageSize
    const chips = (m, val = (v) => v) =>
      Object.entries(m || {})
        .map(([name, v]) => ({ name, value: val(v) }))
        .sort((a, b) => b.value - a.value)
    const rt = store.realtime
    const lastRt = rt[rt.length - 1]
    return {
      isCurrent,
      hasData: !!t,
      note: md?.v2Since ? `端口、协议、入站、策略组、代理链和小时分布从 ${TrafficUI.time(md.v2Since)} 开始统计，此前的流量记为“${LEGACY}”。` : '',
      kpi,
      chart: TrafficUI.buildChart(daily, st.day),
      days: daily.map((x) => x.day),
      heat: TrafficUI.buildHeatmap(md, daily, st.day),
      spark: TrafficUI.buildSpark(rt),
      live: !!lastRt && Date.now() - lastRt.t < 5000,
      active: Object.keys(store.lastConnections).length,
      residual: { up: md?.residual?.up || 0, down: md?.residual?.down || 0 },
      donuts: [
        donut('节点流量', d.nodes),
        donut('策略组', d.groups),
        donut('直连 / 代理', { 直连: { down: kpi.direct }, 代理: { down: kpi.proxy } }),
        donut('TCP / UDP', d.networks),
        donut('入站类型（连接数）', d.conn_types, true),
        donut('进程', d.process_names)
      ],
      drillOptions,
      canDrill: !st.drill && drillOptions.length > 0,
      table: { total: rows.length, pages, offset, list: rows.slice(offset, offset + st.pageSize).map((r, i) => ({ ...r, id: r.name, rank: offset + i + 1 })) },
      topLists: [
        {
          id: 'bytes',
          title: '单连接流量排行',
          durTitle: '时长',
          list: TrafficUI.groupConns(t?.top_conns, true).sort((a, b) => b.up + b.down - (a.up + a.down))
        },
        { id: 'dur', title: '长连接排行', durTitle: '最长', list: TrafficUI.groupConns(t?.long_conns, false).sort((a, b) => b.duration - a.duration) }
      ].map((tl) => ({ ...tl, rows: TrafficUI.flattenConns(tl.id, tl.list, st.expanded) })),
      dns: { types: chips(d.dns_types), kinds: chips(d.dns_ip_kinds), top: chips(d.dns_domains, (v) => v.hits || 0).slice(0, 24), logs: chips(d.log_levels) },
      updatedAt: new Date().toLocaleTimeString()
    }
  },
  createComponent() {
    const { reactive, shallowRef, defineComponent, onUnmounted, onMounted, h, resolveComponent } = Vue
    return defineComponent({
      template: /* html */ `
<div ref="root" class="text-12 pb-24 w-full" style="display:grid;grid-template-columns:minmax(0,1fr);row-gap:12px;min-width:0;max-width:100%;overflow-x:clip">
  <div v-if="v.note" class="text-12" style="opacity:.7">{{ v.note }}</div>

  <div class="grid grid-cols-3 gap-8">
    <Card title="总流量">
      <div class="text-20 font-bold">{{ fmt(v.kpi.total) }}</div>
      <div style="opacity:.7">{{ s.day ? s.month + '-' + s.day : s.month + ' 全月' }}</div>
    </Card>
    <Card title="上传">
      <div class="text-20 font-bold">{{ fmt(v.kpi.up) }}</div>
      <div style="opacity:.7">峰值 {{ speed(v.kpi.peakUp) }}</div>
    </Card>
    <Card title="下载">
      <div class="text-20 font-bold">{{ fmt(v.kpi.down) }}</div>
      <div style="opacity:.7">峰值 {{ speed(v.kpi.peakDown) }}，{{ time(v.kpi.peakAt) }}</div>
    </Card>
    <Card title="连接">
      <div class="text-20 font-bold">{{ num(v.kpi.conns) }}</div>
      <div style="opacity:.7">拦截 {{ num(v.kpi.rejected) }}，已关闭 {{ num(v.kpi.closed) }}</div>
      <div style="opacity:.7">平均 {{ dur(v.kpi.avgDur) }}，最长 {{ dur(v.kpi.maxDur) }}</div>
    </Card>
    <Card title="当前速率">
      <div class="text-20 font-bold">{{ speed(v.spark.last.down) }}</div>
      <div style="opacity:.7">上传 {{ speed(v.spark.last.up) }}，活动连接 {{ v.active }}</div>
    </Card>
    <Card title="直连占比">
      <div class="text-20 font-bold">{{ v.kpi.directPct.toFixed(1) }}%</div>
      <Progress :percent="v.kpi.directPct" class="my-4" />
      <div style="opacity:.7">直连 {{ fmt(v.kpi.direct) }}，代理 {{ fmt(v.kpi.proxy) }}</div>
    </Card>
  </div>

  <div class="grid gap-8" style="grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))">
    <Card title="每日流量" subtitle="点击某一天查看当天，再次点击回到全月">
      <svg :viewBox="'0 0 ' + v.chart.W + ' ' + v.chart.H" class="mt-8" style="width:100%;height:220px;display:block" preserveAspectRatio="none">
        <g v-for="t in v.chart.ticks" :key="'t' + t.y"><line :x1="v.chart.L" :x2="v.chart.W" :y1="t.y" :y2="t.y" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 3" /><text :x="v.chart.L - 6" :y="t.y + 4" font-size="11" text-anchor="end" fill="currentColor" fill-opacity=".7">{{ t.label }}</text></g>
        <g v-for="b in v.chart.bars" :key="b.day" style="cursor:pointer" @click="setDay(s.day === b.day ? '' : b.day)">
          <title>{{ b.tip }}</title>
          <rect :x="b.bx" :y="v.chart.T" :width="b.bw" :height="v.chart.plot" fill="currentColor" :fill-opacity="b.active ? .08 : 0" />
          <rect :x="b.x" :y="b.yDown" :width="b.w" :height="b.hDown" fill="var(--primary-color)" />
          <rect :x="b.x" :y="b.yUp" :width="b.w" :height="b.hUp" fill="var(--primary-color)" fill-opacity=".4" />
          <text :x="b.lx" :y="v.chart.H - 6" font-size="11" text-anchor="middle" fill="currentColor" :fill-opacity="b.active ? 1 : .6" :font-weight="b.active ? 700 : 400">{{ b.day }}</text>
        </g>
      </svg>
      <div class="flex items-center gap-16 mt-4" style="opacity:.8">
        <span class="flex items-center gap-4"><svg width="10" height="10"><rect width="10" height="10" fill="var(--primary-color)" fill-opacity=".4" /></svg>上传</span>
        <span class="flex items-center gap-4"><svg width="10" height="10"><rect width="10" height="10" fill="var(--primary-color)" /></svg>下载</span>
      </div>
    </Card>
    <Card title="实时速率" :subtitle="'最近 ' + v.spark.count + ' 秒，与所选月份无关'">
      <svg v-if="v.spark.count > 1" :viewBox="'0 0 ' + v.spark.W + ' ' + v.spark.H" class="mt-8" style="width:100%;height:220px;display:block" preserveAspectRatio="none">
        <g v-for="t in v.spark.ticks" :key="'s' + t.y"><line :x1="v.spark.L" :x2="v.spark.W" :y1="t.y" :y2="t.y" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 3" /><text :x="v.spark.L - 6" :y="t.y + 3" font-size="10" text-anchor="end" fill="currentColor" fill-opacity=".7">{{ t.label }}</text></g>
        <polyline :points="v.spark.down" fill="none" stroke="var(--primary-color)" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        <polyline :points="v.spark.up" fill="none" stroke="var(--primary-color)" stroke-opacity=".45" stroke-width="1.4" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        <text v-for="(x, i) in v.spark.xlabels" :key="'x' + i" :x="x.x" :y="v.spark.H - 2" font-size="10" :text-anchor="i ? 'end' : 'start'" fill="currentColor" fill-opacity=".7">{{ x.label }}</text>
      </svg>
      <Empty v-else description="暂无实时数据，需要插件已开始且内核在运行" style="height:220px" />
      <div class="flex items-center gap-16 mt-4" style="opacity:.8">
        <span class="flex items-center gap-4"><svg width="14" height="10"><line x1="0" x2="14" y1="5" y2="5" stroke="var(--primary-color)" stroke-opacity=".45" stroke-width="2" /></svg>上传 {{ speed(v.spark.last.up) }}</span>
        <span class="flex items-center gap-4"><svg width="14" height="10"><line x1="0" x2="14" y1="5" y2="5" stroke="var(--primary-color)" stroke-width="2" /></svg>下载 {{ speed(v.spark.last.down) }}</span>
        <span>区间峰值 {{ speed(v.spark.peak) }}，内存峰值 {{ fmt(v.kpi.memPeak) }}</span>
      </div>
    </Card>
  </div>

  <Card title="24 小时分布" :subtitle="v.heat.single ? s.day + ' 日各小时' : '每行一天'">
    <Empty v-if="!v.heat.rows.length" description="暂无小时数据（v2 之前的数据没有这一项）" />
    <template v-else>
      <div class="overflow-x-auto"><div class="grid gap-2 items-center" style="grid-template-columns:34px repeat(24,minmax(12px,1fr))">
        <template v-for="r in v.heat.rows" :key="'r' + r.day">
          <div class="text-10 text-right pr-6" style="opacity:.7">{{ r.day }} 日</div>
          <div v-for="c in r.cells" :key="r.day + '-' + c.h" :title="c.tip" class="rounded-2" :style="{ height: v.heat.single ? '32px' : '14px', background: c.lvl ? 'color-mix(in srgb, var(--primary-color) ' + c.alpha * 100 + '%, transparent)' : 'transparent', boxShadow: c.lvl ? 'none' : 'inset 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent)' }"></div>
        </template>
        <div></div>
        <div v-for="h in 24" :key="'h' + h" class="text-10 text-center" style="opacity:.7">{{ h - 1 }}</div>
      </div></div>
      <div class="flex items-center justify-end gap-4 mt-8 text-10" style="opacity:.8">
        少
        <div v-for="(l, i) in v.heat.legend" :key="'g' + i" class="rounded-2" :style="{ width: '16px', height: '10px', background: 'color-mix(in srgb, var(--primary-color) ' + l.alpha * 100 + '%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, currentColor 12%, transparent)' }"></div>
        多，最高 {{ fmt(v.heat.max) }}/小时
      </div>
    </template>
  </Card>

  <div class="grid gap-8" :style="{ gridTemplateColumns: 'repeat(' + s.ringCols + ', minmax(0, 1fr))' }">
    <Card v-for="d in v.donuts" :key="d.title" :title="d.title">
      <Empty v-if="!d.segs.length" />
      <div v-else class="flex items-center gap-16">
        <svg viewBox="0 0 110 110" class="flex-none" style="width:110px;height:110px">
          <circle cx="55" cy="55" :r="d.R" fill="none" stroke="currentColor" stroke-opacity=".08" stroke-width="12" />
          <circle v-for="g in d.segs" :key="g.name" cx="55" cy="55" :r="d.R" fill="none" :stroke="g.color" stroke-width="12" :stroke-dasharray="g.dash" :stroke-dashoffset="g.offset" transform="rotate(-90 55 55)"><title>{{ g.name }}  {{ g.percent.toFixed(1) }}%</title></circle>
          <text x="55" y="51" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity=".7">{{ d.centerLabel }}</text>
          <text x="55" y="66" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">{{ d.centerValue }}</text>
        </svg>
        <div class="flex-1 flex flex-col gap-4 overflow-hidden">
          <div v-for="g in d.segs" :key="g.name" class="flex items-center gap-8">
            <svg width="10" height="10" class="flex-none"><rect width="10" height="10" rx="2" :fill="g.color" /></svg>
            <span v-tips.fast="g.name" class="flex-1 line-clamp-1 break-all">{{ g.name }}</span>
            <span class="whitespace-nowrap" style="opacity:.8">{{ g.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </Card>
  </div>

  <div ref="rankCard"><Card title="排行">
    <template #extra>
       <div class="flex items-center gap-8" @pointerdown="hold">
        <div @focusin="s.typing = true" @focusout="s.typing = false"><Input :model-value="s.search" :delay="250" @update:model-value="onSearch" placeholder="搜索名称" clearable size="small" /></div>
        <Select :model-value="s.sort" :options="sorts" size="small" @change="setSort" />
        <Button size="small" type="text" @click="toggleOrder">{{ s.order === 'desc' ? '降序' : '升序' }}</Button>
      </div>
    </template>
    <div v-if="s.compact" @pointerdown="hold">
      <!-- project Select has no placement prop and flips upward when its 16 options don't fit below; same markup via Dropdown with a capped list so it always opens downward -->
      <Dropdown :trigger="['click']" placement="bottom">
        <template #default>
          <div class="cursor-pointer inline-flex items-center min-w-128 min-h-30 rounded-4 px-8" style="background:var(--select-bg);border:1px solid var(--primary-color)" role="combobox">
            <span class="line-clamp-1 break-all">{{ (tabs.find((t) => t.value === s.tab) || {}).label }}</span>
            <Button icon="arrowDown" type="text" size="small" class="ml-auto" style="margin-right:-6px" />
          </div>
        </template>
        <template #overlay="{ close }">
          <div class="flex flex-col gap-4 min-w-64 p-4 overflow-y-auto" style="max-height:min(220px,45vh)">
            <Button v-for="t in tabs" :key="t.value" :type="t.value === s.tab ? 'link' : 'text'" @click="setTab(t.value); close()">{{ t.label }}</Button>
          </div>
        </template>
      </Dropdown>
    </div>
    <div v-else class="overflow-x-auto pb-8" style="max-width:100%"><div ref="tabsRow" class="whitespace-nowrap" style="width:max-content"><Radio :model-value="s.tab" :options="tabs" @change="setTab" /></div></div>
    <div v-if="s.drill" class="flex items-center gap-8 mt-8">
      <Button size="small" icon="arrowLeft" @click="back">返回</Button>
      <span v-tips.fast="s.drill.label" class="font-bold line-clamp-1 break-all" style="max-width:min(420px,50vw)">{{ s.drill.label }}</span>
      <Radio :model-value="s.drill.sub" :options="v.drillOptions.map((o, i) => ({ label: o.label, value: i }))" size="small" @change="setSub" />
    </div>
    <div class="mt-8 mb-4" style="opacity:.7">共 {{ v.table.total }} 项</div>
    <Table v-if="v.table.list.length" class="w-full" :columns="s.cols" :data-source="v.table.list">
      <template #name="{ record }">
        <div class="flex items-center gap-4 overflow-hidden" :style="{ width: s.nameW + 'px' }">
          <Button v-if="v.canDrill && record.name !== '其他'" type="link" size="small" class="overflow-hidden" @click="openDrill(record)"><span v-tips.fast="record.name" class="line-clamp-1 break-all">{{ record.name }}</span></Button>
          <span v-else v-tips.fast="record.name" class="line-clamp-1 break-all">{{ record.name }}</span>
          <Tag v-if="record.meta && record.meta.type" size="small">{{ record.meta.type }}</Tag>
          <Tag v-if="record.meta && record.meta.delay" size="small" :color="record.meta.delay < 200 ? 'green' : record.meta.delay < 500 ? 'orange' : 'red'">{{ record.meta.delay }} ms</Tag>
        </div>
      </template>
      <template #rank="{ record }"><div style="width:24px">{{ record.rank }}</div></template>
      <template #up="{ record }"><div style="width:72px">{{ fmt(record.up) }}</div></template>
      <template #down="{ record }"><div style="width:72px">{{ fmt(record.down) }}</div></template>
      <template #total="{ record }"><div style="width:72px"><b>{{ fmt(record.total) }}</b></div></template>
      <template #hits="{ record }"><div style="width:52px">{{ num(record.hits) }}</div></template>
      <template #percent="{ record }">
        <div class="flex items-center gap-4" style="width:120px"><div class="flex-1"><Progress :percent="record.percent" /></div><span class="text-right flex-none" style="width:40px">{{ record.percent.toFixed(1) }}%</span></div>
      </template>
    </Table>
    <Empty v-else :description="s.search ? '没有匹配“' + s.search + '”的项' : '暂无数据'" />
    <div v-if="v.table.total > 15" class="flex items-center justify-end gap-8 mt-8">
      <Pagination :current="s.page" :total="v.table.total" :page-size="s.pageSize" size="small" @update:current="setPage" />
      <Select :model-value="String(s.pageSize)" :options="pageSizes" size="small" @change="setPageSize" />
    </div>
  </Card></div>

  <div class="grid gap-8" style="grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))">
    <Card v-for="tl in v.topLists" :key="tl.id" :title="tl.title" subtitle="已关闭连接前 20 条，按目标和节点合并">
      <Table v-if="tl.rows.length" class="w-full" :columns="connColumns(tl)" :data-source="tl.rows">
        <template #host="{ record }">
          <div v-if="record.group" :class="record.expandable ? 'cursor-pointer' : ''" @click="record.expandable && toggleGroup(record.key)">
            <div v-tips.fast="record.host" class="line-clamp-1 break-all" :style="{ maxWidth: s.compact ? '150px' : '360px' }">{{ record.expandable ? (record.open ? '▾ ' : '▸ ') : '' }}{{ record.host }}</div>
            <div class="text-10 line-clamp-1 break-all" :style="{ opacity: .7, maxWidth: s.compact ? '150px' : '360px' }">{{ record.sub }}</div>
          </div>
          <div v-else class="pl-16" style="opacity:.7">{{ record.host }}</div>
        </template>
        <template #node="{ record }"><span v-tips.fast="record.chain" class="line-clamp-1 break-all" :style="{ maxWidth: s.compact ? '90px' : '180px', opacity: record.group ? 1 : .7 }">{{ record.node }}</span></template>
        <template #bytes="{ record }">{{ fmt(record.bytes) }}</template>
        <template #duration="{ record }">{{ dur(record.duration) }}</template>
      </Table>
      <Empty v-else description="暂无记录，连接关闭后才会出现" />
    </Card>
  </div>

  <div class="grid gap-8" style="grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))">
    <Card title="DNS">
      <div v-for="row in dnsRows" :key="row.key" class="flex items-start gap-12 py-4">
        <span class="flex-none pt-2" style="width:64px;opacity:.7">{{ row.label }}</span>
        <div class="flex flex-wrap gap-4">
          <Tag v-for="c in v.dns[row.key]" :key="c.name" size="small">{{ c.name }} {{ num(c.value) }}</Tag>
          <span v-if="!v.dns[row.key].length" style="opacity:.7">暂无</span>
        </div>
      </div>
    </Card>
    <Card title="日志与未归属流量">
      <div class="flex items-start gap-12 py-4">
        <span class="flex-none pt-2" style="width:64px;opacity:.7">日志级别</span>
        <div class="flex flex-wrap gap-4">
          <Tag v-for="c in v.dns.logs" :key="c.name" size="small">{{ c.name }} {{ num(c.value) }}</Tag>
          <span v-if="!v.dns.logs.length" style="opacity:.7">暂无</span>
        </div>
      </div>
      <div class="flex items-start gap-12 py-4">
        <span class="flex-none" style="width:64px;opacity:.7">未归属</span>
        <div>
          <div>上传 {{ fmt(v.residual.up) }}，下载 {{ fmt(v.residual.down) }}</div>
          <div style="opacity:.7">连接在两次采样之间关闭，无法归到具体连接的字节</div>
        </div>
      </div>
    </Card>
  </div>
</div>
      `,
      setup(_props, ctx) {
        const m0 = TrafficUI.memo || {}
        const s = reactive({
          month: store.currentMonth,
          day: '',
          tab: 'nodes',
          auto: true,
          drill: null,
          search: '',
          sort: 'total',
          order: 'desc',
          page: 1,
          pageSize: 15,
          months: [store.currentMonth],
          typing: false,
          width: 0,
          holdUntil: 0,
          openedAt: Date.now(),
          cols: TrafficUI.RANK_COLUMNS,
          nameW: 200,
          sorts: {},
          expanded: {}
        })
        ;['day', 'tab', 'sort', 'order', 'pageSize', 'auto'].forEach((k) => m0[k] !== undefined && (s[k] = m0[k]))
        s.sorts = { ...(m0.sorts || {}) }
        let pastData = null
        const v = shallowRef(TrafficUI.buildView(s, pastData))
        // remembered for this app session (plugin memory only)
        const remember = () =>
          (TrafficUI.memo = {
            month: s.month,
            day: s.day,
            tab: s.tab,
            sort: s.sort,
            order: s.order,
            pageSize: s.pageSize,
            auto: s.auto,
            sorts: { ...s.sorts, [s.tab]: { sort: s.sort, order: s.order } }
          })
        const layout = () => {
          const L = TrafficUI.tableLayout(s.width || (typeof window !== 'undefined' ? window.innerWidth * 0.9 : 1100), s.sort, TrafficUI.tabsW || 1100)
          if (L.nameW !== s.nameW) s.nameW = L.nameW
          if (L.narrow !== s.narrow) s.narrow = L.narrow
          if (L.compact !== s.compact) s.compact = L.compact
          if (L.ringCols !== s.ringCols) s.ringCols = L.ringCols
          if (L.colsKey !== s.colsKey) ((s.colsKey = L.colsKey), (s.cols = L.cols))
        }
        const refresh = () => {
          layout()
          v.value = TrafficUI.buildView(s, pastData)
          remember()
        }
        layout()
        const loadMonths = async () => {
          const list = await Utils.listMonths()
          if (!list.includes(s.month)) list.unshift(s.month)
          s.months = list
        }
        const save = async () => {
          try {
            ;(await saveMonthlyData()) ? Plugins.message.success('已保存') : Plugins.message.warn('当前没有可保存的数据')
            await loadMonths()
          } catch (e) {
            Plugins.message.error('保存失败：' + (e.message || e))
          }
          refresh()
        }

        TrafficUI.stopTimer()
        let n = 0
        TrafficUI.timer = setInterval(() => {
          if (!s.auto || s.typing || Date.now() < s.holdUntil) return
          if (++n % 15 === 0) refreshNodeMeta()
          refresh() // realtime chart updates even for past months
        }, 2000)
        // measure the real content width (window size, zoom and modal size all included) and re-layout on resize
        const root = Vue.ref ? Vue.ref(null) : { value: null }
        const tabsRow = Vue.ref ? Vue.ref(null) : { value: null }
        let ro = null
        // measure the modal body (ScrollView), whose width is set by the modal, never by our content
        const bodyEl = () =>
          (root.value && root.value.closest && root.value.closest('.gui-scroll-view')) || (root.value && root.value.parentElement) || root.value
        const measure = () => {
          const el = bodyEl()
          if (!el) return
          const cs = typeof getComputedStyle !== 'undefined' ? getComputedStyle(el) : null
          const pad = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0
          const w = Math.floor(el.clientWidth - pad)
          if (tabsRow.value && tabsRow.value.scrollWidth) TrafficUI.tabsW = tabsRow.value.scrollWidth + 16
          if (w <= 0) return
          s.width = w
          layout()
        }
        onMounted &&
          onMounted(() => {
            TrafficUI.rootEl = root.value
            measure()
            if (typeof ResizeObserver !== 'undefined' && root.value) {
              ro = new ResizeObserver(() => measure())
              ro.observe(bodyEl())
            } else if (typeof window !== 'undefined') window.addEventListener('resize', measure)
          })
        onUnmounted &&
          onUnmounted(() => {
            TrafficUI.stopTimer()
            ro ? ro.disconnect() : typeof window !== 'undefined' && window.removeEventListener && window.removeEventListener('resize', measure)
            ro = null
          })
        loadMonths()
        let restoring = null

        const methods = {
          refresh,
          save,
          toggleAuto() {
            s.auto = !s.auto
          },
          async setMonth(m) {
            s.month = m
            s.day = ''
            s.drill = null
            s.page = 1
            pastData = m === store.currentMonth ? null : await readMonth(m)
            if (m !== store.currentMonth && !pastData) Plugins.message.error('读取失败：' + m)
            refresh()
          },
          setDay(d) {
            s.day = d
            s.page = 1
            refresh()
          },
          setTab(t) {
            if (t === s.tab) return
            s.sorts[s.tab] = { sort: s.sort, order: s.order }
            const remembered = s.sorts[t] || { sort: 'total', order: 'desc' }
            s.sort = remembered.sort
            s.order = remembered.order
            s.tab = t
            s.drill = null
            s.page = 1
            s.search = ''
            refresh()
          },
          setSub(i) {
            s.drill = { ...s.drill, sub: i }
            s.page = 1
            refresh()
          },
          back() {
            scrollToTable()
            const keep = s.sorts[s.tab + '#top']
            if (keep) ((s.sort = keep.sort), (s.order = keep.order))
            s.drill = null
            s.page = 1
            s.search = ''
            refresh()
          },
          onSearch(q) {
            s.search = q || ''
            s.page = 1
            refresh()
          },
          setPage(p) {
            s.page = Math.max(1, p)
            refresh()
          },
          setPageSize(n) {
            s.pageSize = Number(n) || 15
            s.page = 1
            refresh()
          },
          sortBy(k) {
            if (s.sort === k) s.order = s.order === 'desc' ? 'asc' : 'desc'
            else ((s.sort = k), (s.order = k === 'name' ? 'asc' : 'desc'))
            s.page = 1
            refresh()
          },
          setSort(k) {
            if (k === s.sort) return
            s.sort = k // keep the current order
            s.page = 1
            layout()
            refresh()
          },
          toggleOrder() {
            s.order = s.order === 'desc' ? 'asc' : 'desc'
            s.page = 1
            refresh()
          },
          toggleGroup(key) {
            s.expanded = { ...s.expanded, [key]: !s.expanded[key] }
            refresh()
          },
          hold() {
            // a Select/dropdown is being used: don't re-render under it
            s.holdUntil = Date.now() + 4000
          },
          openDrill(r) {
            const opts = TrafficUI.DRILL[s.tab] || []
            if (s.drill || !opts.length || r.name === '其他') return
            s.sorts[s.tab + '#top'] = { sort: s.sort, order: s.order }
            s.drill = { key: opts[0].keyOf ? opts[0].keyOf(r) : r.name, label: r.name, sub: 0 }
            s.page = 1
            s.search = ''
            refresh()
            scrollToTable()
          },
          connColumns(tl) {
            return TrafficUI.CONN_COLUMNS.map((c) => (c.key === 'duration' ? { ...c, title: tl.durTitle } : c))
          }
        }

        // header toolbar: period pickers + refresh controls; footer left: status + save
        if (m0.month && m0.month !== store.currentMonth) {
          const day = s.day
          restoring = methods.setMonth(m0.month).then(() => (s.day = day) && refresh())
        }
        TrafficUI.restoring = restoring
        const rankCard = Vue.ref ? Vue.ref(null) : { value: null }
        const C = (name) => resolveComponent(name)
        // keep the ranking card in view when its content height changes (drill in / back)
        const scrollToTable = () =>
          (Vue.nextTick || ((f) => f()))(() => rankCard.value && rankCard.value.scrollIntoView && rankCard.value.scrollIntoView({ block: 'start' }))
        const modalSlots = {
          toolbar: () =>
            h('div', { class: 'inline-flex items-center gap-8 mr-8 align-middle' }, [
              h(
                'span',
                { onPointerdown: () => (s.holdUntil = Date.now() + 4000) },
                h(C('Select'), { modelValue: s.month, options: s.months.map((m) => ({ label: m, value: m })), size: 'small', onChange: methods.setMonth })
              ),
              h(
                'span',
                { onPointerdown: () => (s.holdUntil = Date.now() + 4000) },
                h(C('Select'), {
                  modelValue: s.day,
                  options: [{ label: '全月', value: '' }, ...v.value.days.map((d) => ({ label: d + ' 日', value: d }))],
                  size: 'small',
                  onChange: methods.setDay
                })
              ),
              h(C('Switch'), { modelValue: s.auto, size: 'small', 'onUpdate:modelValue': (val) => (s.auto = val) }, () => '自动刷新'),
              h(C('Button'), { type: 'text', size: 'small', icon: 'refresh', onClick: refresh }, () => '刷新')
            ]),
          action: () => [
            h(
              'div',
              { class: 'mr-auto text-12', style: 'opacity:.7' },
              `${v.value.isCurrent ? '当前月' : '历史月份'} · ${v.value.isCurrent ? (v.value.live ? '正在接收内核数据 · ' : Date.now() - s.openedAt < 8000 ? '等待数据 · ' : '未收到内核数据 · ') : ''}更新于 ${v.value.updatedAt}`
            ),
            h(C('Button'), { onClick: save }, () => '保存')
          ]
        }
        ctx && ctx.expose && ctx.expose({ modalSlots })

        const tabs = TrafficUI.TABS
        return {
          s,
          v,
          tabs,
          sorts: TrafficUI.SORTS,
          pageSizes: TrafficUI.PAGE_SIZES,
          rankCard,
          root,
          tabsRow,
          dnsRows: [
            { key: 'types', label: '记录类型' },
            { key: 'kinds', label: '解析结果' },
            { key: 'top', label: '热门域名' }
          ],
          fmt: TrafficUI.fmt,
          speed: TrafficUI.speed,
          num: TrafficUI.num,
          dur: TrafficUI.dur,
          time: TrafficUI.time,
          ...methods
        }
      }
    })
  }
}
class Router {
  constructor() {
    this.routes = []
    this.middlewares = []
  }

  use(middleware) {
    this.middlewares.push(middleware)
  }

  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  register(method, path, metadata, handler) {
    const keys = []

    const [pathname] = path.split('?')

    const segments = pathname.split('/').map((segment) => {
      if (segment.startsWith(':')) {
        const key = segment.slice(1)
        keys.push(key)
        return '([^\\/]+)'
      }
      return this.escapeRegex(segment)
    })

    const regexPath = segments.join('/')
    const regex = new RegExp(`^${regexPath}$`)

    this.routes.push({
      method,
      regex,
      keys,
      metadata,
      handler,
      path: pathname
    })
  }

  get(path, metadata, handler) {
    this.register('GET', path, metadata, handler)
  }

  post(path, metadata, handler) {
    this.register('POST', path, metadata, handler)
  }

  put(path, metadata, handler) {
    this.register('PUT', path, metadata, handler)
  }

  delete(path, metadata, handler) {
    this.register('DELETE', path, metadata, handler)
  }

  async match(req, res) {
    res.json = (code, data) => res.end(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, JSON.stringify(data))

    for (const middleware of this.middlewares) {
      const next = await middleware(req, res)
      if (!next) return
    }

    const { method } = req
    const urlObj = new URL(req.url, 'http://localhost')
    const pathname = urlObj.pathname
    // @ts-ignore
    const query = Object.fromEntries(urlObj.searchParams)

    for (const route of this.routes) {
      if (route.method !== method) continue

      const match = pathname.match(route.regex)
      if (!match) continue

      const params = route.keys.reduce((acc, key, index) => {
        acc[key] = decodeURIComponent(match[index + 1])
        return acc
      }, {})

      req.params = params
      req.query = query

      try {
        await route.handler(req, res, params)
      } catch (error) {
        res.json(500, error.message || error)
      }
      return
    }

    res.json(404, 'Not Found')
  }
}
