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

const buildInfo = (conn, now) => {
  const m = conn.metadata || {}
  const chains = Array.isArray(conn.chains) && conn.chains.length ? conn.chains : ['DIRECT']
  const host = m.host || m.sniffHost || m.destinationIP || 'unknown'
  const root = getRootDomain(host)
  let clientIP = m.sourceIP || 'unknown'
  if (clientIP.startsWith('fdfe') || clientIP.startsWith('172.18.') || clientIP === '::1') clientIP = '127.0.0.1'
  const node = chains[0]
  const processPath = m.processPath || m.process || 'system'
  const rule = conn.rule || 'Match'
  const type = m.type || 'unknown'
  return {
    node,
    group: chains[chains.length - 1],
    chain: chains.slice().reverse().join(' → '),
    fqdn: host,
    root,
    process: processPath,
    processName: m.process || processPath.split(/[\\/]/).pop() || 'system',
    rule,
    rulePayload: conn.rulePayload ? `${rule}(${conn.rulePayload})` : rule,
    tags: store.tagsConfig[root] || store.tagsConfig[host] || [],
    clientIP,
    port: m.destinationPort ? String(m.destinationPort) : '',
    network: (m.network || 'unknown').toUpperCase(),
    type: m.inboundName ? `${type}` : type,
    inbound: m.inboundName || m.inboundUser || (m.inboundPort ? `${type}:${m.inboundPort}` : type),
    destIP: m.remoteDestination || m.destinationIP || '',
    portKind: m.dnsMode ? `dns:${m.dnsMode}` : '',
    isDirect: node === 'DIRECT' || /^direct$/i.test(node),
    isReject: chains.some((c) => /^REJECT/i.test(c)),
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
const onRun = async () => {
  await ensureData()
  refreshNodeMeta()
  TrafficUI.injectStyle()
  const modal = Plugins.modal({
    title: '流量统计',
    width: '92',
    height: '92',
    submit: false,
    cancelText: '关闭',
    maskClosable: true,
    afterClose: () => {
      TrafficUI.stopTimer()
      modal.destroy()
    }
  })
  modal.setContent(TrafficUI.createComponent(), null, null, false)
  modal.open()
}

const TrafficUI = {
  timer: null,
  PALETTE: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#84cc16', '#94a3b8'],
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
        tip: `${d.day}日  合计 ${TrafficUI.fmt(d.up + d.down)}\n↑ ${TrafficUI.fmt(d.up)}   ↓ ${TrafficUI.fmt(d.down)}\n连接 ${d.conns}`
      }
    })
    return { bars, ticks, W, H, plot, L, T, base, max }
  },
  HEAT: ['transparent', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#3730a3'],
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
          color: TrafficUI.HEAT[lvl],
          tip: `${r.day}日 ${pad2(h)}:00-${pad2(h + 1)}:00\n流量 ${TrafficUI.fmt(t)}  连接 ${v.hits || 0}${v.peakDown ? '\n峰值 ↓' + TrafficUI.speed(v.peakDown) : ''}`
        }
      })
    }))
    const legend = TrafficUI.HEAT.map((c, i) => ({ color: c, label: i === 0 ? '无' : i === 5 ? TrafficUI.fmt(max) : '' }))
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
  injectStyle() {
    if (typeof document === 'undefined') return
    const id = 'traffic-stats-vibe-style'
    let el = document.getElementById(id)
    if (!el) {
      el = document.createElement('style')
      el.id = id
      document.head.appendChild(el)
    }
    el.textContent = TrafficUI.CSS
  },
  CSS: `
.tsx { --ts-accent: var(--primary-color, #0059d6); --ts-text: var(--color, #1f2328); --ts-card: var(--card-bg, #fff); --ts-bg: var(--modal-bg, #f6f6f6); --ts-line: var(--divider-color, #e5e7eb); --ts-input: var(--input-bg, #fff); --ts-up: #7c3aed; --ts-down: #10b981;
  display: flex; flex-direction: column; gap: 14px; padding: 0 4px 12px; font-size: 13px; line-height: 1.5; color: var(--ts-text); }
.tsx * { box-sizing: border-box; }
.tsx .bar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border-radius: 12px; background: var(--ts-card); border: 1px solid var(--ts-line); }
.tsx .title { font-size: 15px; font-weight: 700; margin-right: 4px; }
.tsx select, .tsx input.ts-in { height: 30px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--ts-line); background: var(--ts-input); color: var(--ts-text); font-size: 13px; outline: none; }
.tsx select option { background: var(--ts-bg); color: var(--ts-text); }
.tsx input.ts-in:focus, .tsx select:focus { border-color: var(--ts-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ts-accent) 18%, transparent); }
.tsx .btn { height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--ts-line); background: var(--ts-input); color: var(--ts-text); cursor: pointer; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; transition: all .15s; }
.tsx .btn:hover { border-color: var(--ts-accent); color: var(--ts-accent); }
.tsx .btn.primary { background: var(--ts-accent); border-color: var(--ts-accent); color: #fff; }
.tsx .btn.primary:hover { filter: brightness(1.1); color: #fff; }
.tsx .btn.on { color: var(--ts-accent); border-color: var(--ts-accent); background: color-mix(in srgb, var(--ts-accent) 8%, var(--ts-input)); }
.tsx .btn.sm { height: 26px; padding: 0 10px; font-size: 12px; }
.tsx .btn:disabled { opacity: .45; cursor: not-allowed; }
.tsx .dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; display: inline-block; }
.tsx .dot.live { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.2); }
.tsx .muted { color: var(--ts-text); opacity: .68; font-size: 12px; }
.tsx .spacer { margin-left: auto; }
.tsx .note { font-size: 12px; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, #f59e0b 12%, var(--ts-card)); border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent); }
.tsx .grid { display: grid; gap: 12px; }
.tsx { position: relative; z-index: 0; }
.tsx .kpis { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); }
.tsx .rings { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 980px) { .tsx .rings { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .tsx .rings { grid-template-columns: 1fr; } }
.tsx .kvrow { display: flex; gap: 12px; align-items: flex-start; padding: 6px 0; border-top: 1px dashed var(--ts-line); }
.tsx .kvrow:first-of-type { border-top: 0; }
.tsx .kvrow .k { flex: none; width: 64px; font-size: 12px; opacity: .75; padding-top: 3px; }
.tsx tr.child td { background: color-mix(in srgb, var(--ts-accent) 3%, transparent); padding-top: 4px; padding-bottom: 4px; }
.tsx .tip { position: relative; }
.tsx .tip:hover::after { content: attr(data-tip); position: absolute; left: 0; top: calc(100% + 4px); z-index: 5; max-width: 420px; width: max-content; white-space: normal; word-break: break-all; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 400; line-height: 1.4; background: rgba(30,30,30,.92); color: #fff; pointer-events: none; }
.tsx td .tip { display: inline; }
.tsx td { overflow: visible; }
.tsx td > .tip, .tsx td > .sub2 { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tsx td > .tip:hover { overflow: visible; }
.tsx .two { grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); }
.tsx .three { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.tsx .card { background: var(--ts-card); border: 1px solid var(--ts-line); border-radius: 12px; padding: 14px 16px; min-width: 0; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
.tsx .card h4 { margin: 0 0 12px; font-size: 14px; font-weight: 600; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.tsx .card h4 .muted { font-weight: 400; }
.tsx .kpi { border-top: 3px solid var(--kc, #6366f1); }
.tsx .kpi .lbl { font-size: 12px; opacity: .75; display: flex; align-items: center; gap: 6px; }
.tsx .kpi .val { font-size: 24px; font-weight: 700; margin-top: 4px; letter-spacing: -.3px; font-variant-numeric: tabular-nums; }
.tsx .kpi .sub { font-size: 12px; opacity: .72; margin-top: 2px; line-height: 1.45; }
.tsx .ico { width: 20px; height: 20px; border-radius: 6px; display: inline-grid; place-items: center; font-size: 11px; color: #fff; background: var(--kc, #6366f1); }
.tsx .ratio { height: 6px; border-radius: 3px; background: var(--ts-line); overflow: hidden; margin-top: 8px; display: flex; }
.tsx svg text { fill: currentColor; }
.tsx .legend { display: flex; gap: 16px; font-size: 12px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.tsx .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.tsx .donut-wrap { display: flex; align-items: center; gap: 16px; }
.tsx .donut-legend { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
.tsx .donut-legend div { display: flex; align-items: flex-start; gap: 8px; }
.tsx .donut-legend i { width: 10px; height: 10px; border-radius: 3px; flex: none; margin-top: 4px; }
.tsx .donut-legend span.n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.4; }
.tsx .donut-legend span.n:hover { overflow: visible; }
.tsx .donut-legend span.p { font-variant-numeric: tabular-nums; opacity: .8; white-space: nowrap; }
.tsx .heat { display: grid; grid-template-columns: 34px repeat(24, minmax(0, 1fr)); gap: 3px; align-items: center; }
.tsx .heat .hl { font-size: 11px; opacity: .7; text-align: right; padding-right: 6px; line-height: 1; }
.tsx .heat .hc { height: 14px; border-radius: 3px; }
.tsx .heat .hc.e { box-shadow: inset 0 0 0 1px var(--ts-line); }
.tsx .heat.single .hc { height: 34px; }
.tsx .heat .hh { font-size: 10px; opacity: .75; text-align: center; }
.tsx .heat-legend { display: flex; align-items: center; gap: 4px; font-size: 11px; margin-top: 10px; justify-content: flex-end; }
.tsx .heat-legend span.c { width: 16px; height: 10px; border-radius: 2px; border: 1px solid var(--ts-line); }
.tsx .tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.tsx .tab { padding: 4px 12px; border-radius: 999px; cursor: pointer; font-size: 12px; border: 1px solid var(--ts-line); background: var(--ts-input); }
.tsx .tab:hover { border-color: var(--ts-accent); color: var(--ts-accent); }
.tsx .tab.act { background: var(--ts-accent); border-color: var(--ts-accent); color: #fff; }
.tsx table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.tsx th { text-align: left; font-weight: 600; font-size: 12px; opacity: .75; padding: 8px; cursor: pointer; user-select: none; white-space: nowrap; border-bottom: 1px solid var(--ts-line); }
.tsx th.r, .tsx td.r { text-align: right; }
.tsx th:hover { opacity: 1; color: var(--ts-accent); }
.tsx td { padding: 8px; border-bottom: 1px solid var(--ts-line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.tsx tbody tr:hover td { background: color-mix(in srgb, var(--ts-accent) 6%, transparent); }
.tsx tr.click { cursor: pointer; }
.tsx .sub2 { display: block; font-size: 11px; opacity: .7; overflow: hidden; text-overflow: ellipsis; }
.tsx .rank { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; font-size: 11px; font-weight: 600; background: var(--ts-line); }
.tsx .rank.t1 { background: #f59e0b; color: #fff; } .tsx .rank.t2 { background: #64748b; color: #fff; } .tsx .rank.t3 { background: #b45309; color: #fff; }
.tsx .pbar { display: flex; align-items: center; gap: 8px; }
.tsx .pbar .trk { flex: 1; height: 6px; border-radius: 3px; background: var(--ts-line); overflow: hidden; }
.tsx .pbar .fill { height: 100%; border-radius: 3px; background: var(--ts-accent); }
.tsx .pbar .pv { width: 46px; text-align: right; font-size: 12px; }
.tsx .pill { display: inline-block; padding: 0 7px; line-height: 18px; border-radius: 999px; font-size: 11px; font-weight: 500; background: color-mix(in srgb, var(--ts-accent) 12%, transparent); color: var(--ts-accent); margin-left: 6px; }
.tsx .pill.g { background: rgba(16,185,129,.14); color: #047857; } .tsx .pill.o { background: rgba(245,158,11,.16); color: #b45309; } .tsx .pill.r { background: rgba(239,68,68,.14); color: #b91c1c; }
body[theme-mode='dark'] .tsx .pill.g { color: #6ee7b7; } body[theme-mode='dark'] .tsx .pill.o { color: #fcd34d; } body[theme-mode='dark'] .tsx .pill.r { color: #fca5a5; }
.tsx .crumb { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; padding: 8px 10px; border-radius: 10px; background: color-mix(in srgb, var(--ts-accent) 8%, transparent); }
.tsx .pager { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; font-size: 12px; }
.tsx .empty { text-align: center; padding: 28px 0; opacity: .7; font-size: 12px; }
.tsx .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tsx .chip { padding: 2px 10px; border-radius: 999px; background: var(--ts-input); border: 1px solid var(--ts-line); font-size: 12px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tsx .chip b { font-weight: 600; margin-left: 6px; color: var(--ts-accent); }
.tsx .kv { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 12px; }
`,
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
      note: md?.v2Since
        ? `端口、协议、入站、策略组、代理链、小时分布等新维度自 ${TrafficUI.time(md.v2Since)} 起统计；之前的流量在这些维度中计入「${LEGACY}」。`
        : '',
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
      table: { total: rows.length, pages, offset, list: rows.slice(offset, offset + st.pageSize) },
      topLists: [
        { id: 'bytes', title: '单连接流量排行', list: TrafficUI.groupConns(t?.top_conns, true).sort((a, b) => b.up + b.down - (a.up + a.down)) },
        { id: 'dur', title: '长连接排行', list: TrafficUI.groupConns(t?.long_conns, false).sort((a, b) => b.duration - a.duration) }
      ],
      dns: { types: chips(d.dns_types), kinds: chips(d.dns_ip_kinds), top: chips(d.dns_domains, (v) => v.hits || 0).slice(0, 24), logs: chips(d.log_levels) },
      updatedAt: new Date().toLocaleTimeString()
    }
  },
  createComponent() {
    const { reactive, shallowRef, defineComponent, onUnmounted } = Vue
    return defineComponent({
      template: /* html */ `
<div class="tsx">
  <div class="bar">
    <span :class="['dot', v.live ? 'live' : '']" :title="v.live ? '正在接收内核实时数据' : '未收到实时数据（插件未启动或内核未运行）'"></span>
    <span class="title">流量统计</span>
    <select :value="s.month" @change="setMonth($event.target.value)"><option v-for="m in s.months" :key="m" :value="m">{{ m }}</option></select>
    <select :value="s.day" @change="setDay($event.target.value)"><option value="">全月</option><option v-for="d in v.days" :key="d" :value="d">{{ d }} 日</option></select>
    <button class="btn" @click="refresh">⟳ 刷新</button>
    <button :class="['btn', s.auto ? 'on' : '']" @click="toggleAuto">{{ s.auto ? '● 自动刷新 2s' : '○ 自动刷新' }}</button>
    <button class="btn primary" @click="save">保存</button>
    <span class="muted spacer">{{ v.isCurrent ? '实时' : '历史' }} · 更新于 {{ v.updatedAt }}</span>
  </div>

  <div v-if="v.note" class="note">ⓘ {{ v.note }}</div>

  <div class="grid kpis">
    <div class="card kpi" style="--kc:#6366f1"><div class="lbl"><span class="ico">Σ</span>总流量</div><div class="val">{{ fmt(v.kpi.total) }}</div><div class="sub">{{ s.day ? s.month + '-' + s.day : s.month + ' 全月' }}</div></div>
    <div class="card kpi" style="--kc:#7c3aed"><div class="lbl"><span class="ico">↑</span>上传</div><div class="val">{{ fmt(v.kpi.up) }}</div><div class="sub">峰值 {{ speed(v.kpi.peakUp) }}</div></div>
    <div class="card kpi" style="--kc:#10b981"><div class="lbl"><span class="ico">↓</span>下载</div><div class="val">{{ fmt(v.kpi.down) }}</div><div class="sub">峰值 {{ speed(v.kpi.peakDown) }}<br />{{ time(v.kpi.peakAt) }}</div></div>
    <div class="card kpi" style="--kc:#0891b2"><div class="lbl"><span class="ico">⇄</span>连接数</div><div class="val">{{ num(v.kpi.conns) }}</div><div class="sub">拦截 {{ num(v.kpi.rejected) }} · 已关闭 {{ num(v.kpi.closed) }}<br />平均 {{ dur(v.kpi.avgDur) }} · 最长 {{ dur(v.kpi.maxDur) }}</div></div>
    <div class="card kpi" style="--kc:#f59e0b"><div class="lbl"><span class="ico">⚡</span>实时速率</div><div class="val" style="font-size:20px">↓ {{ speed(v.spark.last.down) }}</div><div class="sub">↑ {{ speed(v.spark.last.up) }}<br />活动连接 {{ v.active }}</div></div>
    <div class="card kpi" style="--kc:#db2777"><div class="lbl"><span class="ico">%</span>直连占比</div><div class="val">{{ v.kpi.directPct.toFixed(1) }}%</div>
      <div class="ratio"><div :style="{ width: v.kpi.directPct + '%', background: '#10b981' }"></div><div :style="{ flex: 1, background: '#6366f1' }"></div></div>
      <div class="sub">直连 {{ fmt(v.kpi.direct) }} · 代理 {{ fmt(v.kpi.proxy) }}</div></div>
  </div>

  <div class="grid two">
    <div class="card">
      <h4>每日流量 <span class="muted">点击柱子查看当天，再次点击返回全月</span></h4>
      <svg :viewBox="'0 0 ' + v.chart.W + ' ' + v.chart.H" style="width:100%;height:220px;display:block" preserveAspectRatio="none">
        <g v-for="t in v.chart.ticks" :key="'t' + t.y"><line :x1="v.chart.L" :x2="v.chart.W" :y1="t.y" :y2="t.y" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 3" /><text :x="v.chart.L - 6" :y="t.y + 4" font-size="11" text-anchor="end" fill-opacity=".8">{{ t.label }}</text></g>
        <g v-for="b in v.chart.bars" :key="b.day" style="cursor:pointer" @click="setDay(s.day === b.day ? '' : b.day)">
          <title>{{ b.tip }}</title>
          <rect :x="b.bx" :y="v.chart.T" :width="b.bw" :height="v.chart.plot" :fill="b.active ? 'rgba(99,102,241,.14)' : 'transparent'" />
          <rect :x="b.x" :y="b.yDown" :width="b.w" :height="b.hDown" fill="#10b981" rx="2" />
          <rect :x="b.x" :y="b.yUp" :width="b.w" :height="b.hUp" fill="#7c3aed" rx="2" />
          <text :x="b.lx" :y="v.chart.H - 6" font-size="11" text-anchor="middle" :fill-opacity="b.active ? 1 : .7" :font-weight="b.active ? 700 : 400">{{ b.day }}</text>
        </g>
      </svg>
      <div class="legend"><span><i style="background:#7c3aed"></i>上传</span><span><i style="background:#10b981"></i>下载</span></div>
    </div>
    <div class="card">
      <h4>实时速率 <span class="muted">最近 {{ v.spark.count }} 个采样（每秒一次，与所选月份无关）</span></h4>
      <svg v-if="v.spark.count > 1" :viewBox="'0 0 ' + v.spark.W + ' ' + v.spark.H" style="width:100%;height:220px;display:block" preserveAspectRatio="none">
        <g v-for="t in v.spark.ticks" :key="'s' + t.y"><line :x1="v.spark.L" :x2="v.spark.W" :y1="t.y" :y2="t.y" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="3 3" /><text :x="v.spark.L - 6" :y="t.y + 3" font-size="10" text-anchor="end" fill-opacity=".7">{{ t.label }}</text></g>
        <polygon :points="v.spark.downArea" fill="#10b981" fill-opacity=".15" />
        <polyline :points="v.spark.down" fill="none" stroke="#10b981" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        <polyline :points="v.spark.up" fill="none" stroke="#7c3aed" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
        <text v-for="(x, i) in v.spark.xlabels" :key="'x' + i" :x="x.x" :y="v.spark.H - 2" font-size="10" :text-anchor="i ? 'end' : 'start'" fill-opacity=".7">{{ x.label }}</text>
      </svg>
      <div v-else class="empty" style="height:220px;display:grid;place-items:center">等待内核推送实时速率…（请确认插件已「开始」且内核在运行）</div>
      <div class="legend"><span><i style="background:#7c3aed"></i>上传 {{ speed(v.spark.last.up) }}</span><span><i style="background:#10b981"></i>下载 {{ speed(v.spark.last.down) }}</span><span class="muted">区间峰值 {{ speed(v.spark.peak) }} · 内存峰值 {{ fmt(v.kpi.memPeak) }}</span></div>
    </div>
  </div>

  <div class="card">
    <h4>24 小时分布 <span class="muted">{{ v.heat.single ? s.day + ' 日各小时' : '每行一天，悬停查看详情' }}</span></h4>
    <div v-if="!v.heat.rows.length" class="empty">暂无小时数据（升级到 v2 之前的数据没有小时维度）</div>
    <template v-else>
      <div :class="['heat', v.heat.single ? 'single' : '']">
        <template v-for="r in v.heat.rows" :key="'r' + r.day">
          <div class="hl">{{ r.day }}日</div>
          <div v-for="c in r.cells" :key="r.day + '-' + c.h" :class="['hc', c.lvl ? '' : 'e']" :style="{ background: c.color }" :title="c.tip"></div>
        </template>
        <div></div>
        <div v-for="h in 24" :key="'h' + h" class="hh">{{ h - 1 }}</div>
      </div>
      <div class="heat-legend"><span class="muted">少</span><span v-for="(l, i) in v.heat.legend" :key="'g' + i" class="c" :style="{ background: l.color }"></span><span class="muted">多（最高 {{ fmt(v.heat.max) }}/小时）</span></div>
    </template>
  </div>

  <div class="grid rings">
    <div class="card" v-for="d in v.donuts" :key="d.title">
      <h4>{{ d.title }}</h4>
      <div v-if="!d.segs.length" class="empty">暂无数据</div>
      <div v-else class="donut-wrap">
        <svg viewBox="0 0 110 110" style="width:118px;height:118px;flex:none">
          <circle cx="55" cy="55" :r="d.R" fill="none" stroke="currentColor" stroke-opacity=".08" stroke-width="13" />
          <circle v-for="g in d.segs" :key="g.name" cx="55" cy="55" :r="d.R" fill="none" :stroke="g.color" stroke-width="13" :stroke-dasharray="g.dash" :stroke-dashoffset="g.offset" transform="rotate(-90 55 55)"><title>{{ g.name }}  {{ g.percent.toFixed(1) }}%</title></circle>
          <text x="55" y="51" text-anchor="middle" font-size="11" fill-opacity=".8">{{ d.centerLabel }}</text>
          <text x="55" y="66" text-anchor="middle" font-size="12" font-weight="700">{{ d.centerValue }}</text>
        </svg>
        <div class="donut-legend">
          <div v-for="g in d.segs" :key="g.name"><i :style="{ background: g.color }"></i><span class="n tip" :data-tip="g.name">{{ g.name }}</span><span class="p">{{ g.percent.toFixed(1) }}%</span></div>
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="tabs"><span v-for="t in tabs" :key="t.value" :class="['tab', s.tab === t.value ? 'act' : '']" @click="setTab(t.value)">{{ t.label }}</span></div>
    <div v-if="s.drill" class="crumb">
      <button class="btn sm" @click.stop="back">← 返回</button>
      <b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:420px">{{ s.drill.key }}</b>
      <span class="muted">明细：</span>
      <span v-for="(o, i) in v.drillOptions" :key="o.label" :class="['tab', s.drill.sub === i ? 'act' : '']" @click.stop="setSub(i)">{{ o.label }}</span>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
      <input class="ts-in" :value="s.search" @input="onSearch($event.target.value)" @focus="s.typing = true" @blur="s.typing = false" placeholder="搜索名称…" style="width:260px" />
      <span class="muted">共 {{ v.table.total }} 项{{ v.canDrill ? ' · 点击行查看明细' : '' }}</span>
    </div>
    <table>
      <colgroup><col style="width:46px" /><col /><col style="width:100px" /><col style="width:100px" /><col style="width:104px" /><col style="width:80px" /><col style="width:180px" /></colgroup>
      <thead><tr>
        <th>#</th>
        <th @click="sortBy('name')">名称 {{ arrow('name') }}</th>
        <th class="r" @click="sortBy('up')">上传 {{ arrow('up') }}</th>
        <th class="r" @click="sortBy('down')">下载 {{ arrow('down') }}</th>
        <th class="r" @click="sortBy('total')">合计 {{ arrow('total') }}</th>
        <th class="r" @click="sortBy('hits')">{{ s.tab === 'failed_hosts' && !s.drill ? '失败' : '连接' }} {{ arrow('hits') }}</th>
        <th>占比</th>
      </tr></thead>
      <tbody>
        <tr v-for="(r, i) in v.table.list" :key="r.name" :class="v.canDrill && r.name !== '其他' ? 'click' : ''" @click="openDrill(r)">
          <td><span :class="['rank', 't' + (v.table.offset + i + 1)]">{{ v.table.offset + i + 1 }}</span></td>
          <td><span class="tip" :data-tip="r.name">{{ r.name }}</span><span v-if="r.meta && r.meta.type" class="pill">{{ r.meta.type }}</span><span v-if="r.meta && r.meta.delay" :class="['pill', r.meta.delay < 200 ? 'g' : r.meta.delay < 500 ? 'o' : 'r']">{{ r.meta.delay }} ms</span></td>
          <td class="r">{{ fmt(r.up) }}</td>
          <td class="r">{{ fmt(r.down) }}</td>
          <td class="r"><b>{{ fmt(r.total) }}</b></td>
          <td class="r">{{ num(r.hits) }}</td>
          <td><div class="pbar"><div class="trk"><div class="fill" :style="{ width: r.percent > 0 ? 'max(2px, ' + Math.min(100, r.percent).toFixed(2) + '%)' : '0' }"></div></div><span class="pv">{{ r.percent.toFixed(1) }}%</span></div></td>
        </tr>
        <tr v-if="!v.table.list.length"><td colspan="7" class="empty">{{ s.search ? '没有匹配“' + s.search + '”的项' : '暂无数据' }}</td></tr>
      </tbody>
    </table>
    <div class="pager" v-if="v.table.total > 15">
      <button class="btn sm" :disabled="s.page <= 1" @click="setPage(s.page - 1)">上一页</button>
      <span>第 {{ s.page }} / {{ v.table.pages }} 页</span>
      <button class="btn sm" :disabled="s.page >= v.table.pages" @click="setPage(s.page + 1)">下一页</button>
      <select :value="s.pageSize" @change="setPageSize($event.target.value)"><option value="15">15 条/页</option><option value="30">30 条/页</option><option value="100">100 条/页</option></select>
    </div>
  </div>

  <div class="grid two">
    <div class="card" v-for="tl in v.topLists" :key="tl.id">
      <h4>{{ tl.title }} <span class="muted">已关闭连接 Top 20，按 目标+节点 合并</span></h4>
      <table v-if="tl.list.length">
        <colgroup><col /><col style="width:180px" /><col style="width:56px" /><col style="width:90px" /><col style="width:84px" /></colgroup>
        <thead><tr><th>目标 / 进程</th><th>节点</th><th class="r">次数</th><th class="r">流量</th><th class="r">{{ tl.id === 'dur' ? '最长' : '时长' }}</th></tr></thead>
        <tbody>
          <template v-for="g in tl.list" :key="tl.id + g.key">
            <tr :class="g.count > 1 ? 'click' : ''" @click="g.count > 1 && toggleGroup(tl.id + g.key)">
              <td><span class="tip" :data-tip="g.host">{{ g.count > 1 ? (s.expanded[tl.id + g.key] ? '▾ ' : '▸ ') : '' }}{{ g.host }}</span><span class="sub2">{{ g.process }}{{ g.rule ? ' · ' + g.rule : '' }}</span></td>
              <td><span class="tip" :data-tip="g.chain || g.node">{{ g.node }}</span></td>
              <td class="r">{{ g.count }}</td>
              <td class="r">{{ fmt(g.up + g.down) }}</td>
              <td class="r">{{ dur(g.duration) }}</td>
            </tr>
            <template v-if="g.count > 1 && s.expanded[tl.id + g.key]">
              <tr v-for="(c, i) in g.items" :key="tl.id + g.key + i" class="child">
                <td><span class="sub2">{{ time(c.start) }} · {{ c.network || '' }} · {{ c.client || '' }}</span></td>
                <td><span class="sub2">{{ c.process }}</span></td>
                <td></td>
                <td class="r">{{ fmt(c.up + c.down) }}</td>
                <td class="r">{{ dur(c.duration) }}</td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>
      <div v-else class="empty">暂无记录（连接关闭后才会出现在这里）</div>
    </div>
  </div>

  <div class="grid two">
    <div class="card">
      <h4>DNS</h4>
      <div class="kvrow"><span class="k">记录类型</span><div class="chips"><span v-for="c in v.dns.types" :key="c.name" class="chip">{{ c.name }}<b>{{ num(c.value) }}</b></span><span v-if="!v.dns.types.length" class="muted">暂无</span></div></div>
      <div class="kvrow"><span class="k">解析结果</span><div class="chips"><span v-for="c in v.dns.kinds" :key="c.name" class="chip">{{ c.name }}<b>{{ num(c.value) }}</b></span></div></div>
      <div class="kvrow"><span class="k">热门域名</span><div class="chips"><span v-for="c in v.dns.top" :key="c.name" class="chip">{{ c.name }}<b>{{ num(c.value) }}</b></span><span v-if="!v.dns.top.length" class="muted">暂无</span></div></div>
    </div>
    <div class="card">
      <h4>日志与未归属流量</h4>
      <div class="kvrow"><span class="k">日志级别</span><div class="chips"><span v-for="c in v.dns.logs" :key="c.name" class="chip">{{ c.name }}<b>{{ num(c.value) }}</b></span><span v-if="!v.dns.logs.length" class="muted">暂无</span></div></div>
      <div class="kvrow"><span class="k">未归属</span><div>↑ <b>{{ fmt(v.residual.up) }}</b> · ↓ <b>{{ fmt(v.residual.down) }}</b><div class="muted">连接在两次采样之间关闭、无法定位到具体连接的字节</div></div></div>
    </div>
  </div>
</div>
      `,
      setup() {
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
          sorts: {},
          expanded: {}
        })
        let pastData = null
        const v = shallowRef(TrafficUI.buildView(s, pastData))
        const refresh = () => {
          v.value = TrafficUI.buildView(s, pastData)
        }
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
          if (!s.auto || s.typing) return
          if (++n % 15 === 0) refreshNodeMeta()
          refresh() // realtime chart updates even for past months
        }, 2000)
        onUnmounted && onUnmounted(() => TrafficUI.stopTimer())
        loadMonths()

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
            s.drill = null
            s.page = 1
            s.search = ''
            refresh()
          },
          onSearch(q) {
            s.search = q
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
          arrow(k) {
            return s.sort === k ? (s.order === 'desc' ? '↓' : '↑') : ''
          },
          toggleGroup(key) {
            s.expanded = { ...s.expanded, [key]: !s.expanded[key] }
          },
          openDrill(r) {
            const opts = TrafficUI.DRILL[s.tab] || []
            if (s.drill || !opts.length || r.name === '其他') return
            s.drill = { key: opts[0].keyOf ? opts[0].keyOf(r) : r.name, sub: 0 }
            s.page = 1
            s.search = ''
            refresh()
          }
        }
        return {
          s,
          v,
          tabs: TrafficUI.TABS,
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
