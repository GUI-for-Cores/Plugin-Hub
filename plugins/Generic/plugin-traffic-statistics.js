const PATH = 'data/third/traffic-statistics'
const TAGS_FILE = PATH + '/tags.json'
const DataVersion = '-v1'

window[Plugin.id] = window[Plugin.id] || {
  state: {
    currentMonth: '',
    data: null,
    tagsConfig: {},
    lastConnections: {},
    unregs: []
  }
}

const store = window[Plugin.id].state

const getRootDomain = (host) => {
  if (!host || host.includes(':') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host
  const parts = host.split('.')
  if (parts.length <= 2) return host
  return parts.slice(-2).join('.')
}

const createEmptyStats = () => ({
  summary: { up: 0, down: 0 },
  details: {
    domains: {},
    roots: {},
    nodes: {},
    processes: {},
    rules: {},
    tags: {},
    pivot_node_domain: {},
    pivot_tag_node: {},
    log_levels: {},
    dns_types: {},
    dns_domains: {},
    dns_ip_kinds: { 'fake-ip': 0, 'real-ip': 0 },
    clients: {}
  }
})

const initMonthlyData = async () => {
  const month = Plugins.formatDate(Date.now(), 'YYYY-MM')
  const content = await Plugins.ReadFile(`${PATH}/${month}${DataVersion}.json`).catch(() => JSON.stringify({ ...createEmptyStats(), daily: {} }))
  store.data = JSON.parse(content)
  store.currentMonth = month
}

const saveMonthlyData = async () => {
  const path = `${PATH}/${store.currentMonth}${DataVersion}.json`
  await Plugins.WriteFile(path, JSON.stringify(store.data))
}

const updateStats = (target, diffUp, diffDown, isNew, info) => {
  if (!target) return
  const { node, fqdn, root, process, rule, tags, clientIP } = info
  target.summary.up += diffUp
  target.summary.down += diffDown

  const d = target.details
  const maps = [
    [d.domains, fqdn, true],
    [d.roots, root, true],
    [d.nodes, node, false],
    [d.processes, process, false],
    [d.rules, rule, true]
  ]

  maps.forEach(([map, key, hasHits]) => {
    if (!map[key]) map[key] = { up: 0, down: 0, ...(hasHits ? { hits: 0 } : {}) }
    map[key].up += diffUp
    map[key].down += diffDown
    if (isNew && hasHits) map[key].hits++
  })

  // 客户端统计
  if (clientIP) {
    if (!d.clients[clientIP]) {
      d.clients[clientIP] = {
        up: 0,
        down: 0,
        hits: 0,
        domains: {},
        nodes: {},
        processes: {},
        rules: {},
        tags: {}
      }
    }
    const c = d.clients[clientIP]
    c.up += diffUp
    c.down += diffDown
    if (isNew) c.hits++

    // 定义需要同步在客户端下统计的子维度
    const subDimensions = [
      [c.domains, fqdn],
      [c.nodes, node],
      [c.processes, process],
      [c.rules, rule]
    ]

    subDimensions.forEach(([map, key]) => {
      if (!map[key]) map[key] = { up: 0, down: 0, hits: 0 }
      map[key].up += diffUp
      map[key].down += diffDown
      if (isNew) map[key].hits++
    })

    // 统计客户端下的标签分布
    tags.forEach((tag) => {
      if (!c.tags[tag]) c.tags[tag] = { up: 0, down: 0, hits: 0 }
      c.tags[tag].up += diffUp
      c.tags[tag].down += diffDown
      if (isNew) c.tags[tag].hits++
    })
  }

  tags.forEach((tag) => {
    if (!d.tags[tag]) d.tags[tag] = { up: 0, down: 0 }
    d.tags[tag].up += diffUp
    d.tags[tag].down += diffDown
    if (!d.pivot_tag_node[tag]) d.pivot_tag_node[tag] = {}
    if (!d.pivot_tag_node[tag][node]) d.pivot_tag_node[tag][node] = { up: 0, down: 0 }
    d.pivot_tag_node[tag][node].up += diffUp
    d.pivot_tag_node[tag][node].down += diffDown
  })

  if (!d.pivot_node_domain[node]) d.pivot_node_domain[node] = {}
  if (!d.pivot_node_domain[node][fqdn]) d.pivot_node_domain[node][fqdn] = { up: 0, down: 0 }
  d.pivot_node_domain[node][fqdn].up += diffUp
  d.pivot_node_domain[node][fqdn].down += diffDown
}

const handleConnections = async (data) => {
  const { connections = [] } = data
  const now = new Date()
  const month = Plugins.formatDate(now.getTime(), 'YYYY-MM')

  // 跨月检查
  if (month !== store.currentMonth) {
    await saveMonthlyData()
    await initMonthlyData()
  }

  const day = now.getDate().toString()
  const currentIDs = new Set()

  if (!store.data.daily[day]) store.data.daily[day] = createEmptyStats()
  const dayData = store.data.daily[day]

  for (const conn of connections) {
    const { id, download, upload, chains, metadata, rule } = conn
    currentIDs.add(id)
    const prev = store.lastConnections[id] || { download: 0, upload: 0 }
    const diffDown = download - prev.download
    const diffUp = upload - prev.upload

    if (diffDown > 0 || diffUp > 0) {
      let clientIP = metadata.sourceIP || 'unknown'
      if (clientIP.startsWith('fdfe') || clientIP.startsWith('172.18.')) {
        clientIP = '127.0.0.1'
      }

      const info = {
        node: chains[0] || 'DIRECT',
        fqdn: metadata.host || metadata.destinationIP || 'unknown',
        root: getRootDomain(metadata.host || metadata.destinationIP || 'unknown'),
        process: metadata.processPath || 'system',
        rule: rule || 'Match',
        tags: store.tagsConfig[getRootDomain(metadata.host || metadata.destinationIP || 'unknown')] || store.tagsConfig[metadata.host] || [],
        clientIP: clientIP
      }
      const isNew = prev.download === 0
      updateStats(store.data, diffUp, diffDown, isNew, info)
      updateStats(dayData, diffUp, diffDown, isNew, info)
    }
    store.lastConnections[id] = { download, upload }
  }
  for (const id in store.lastConnections) {
    if (!currentIDs.has(id)) delete store.lastConnections[id]
  }
}

const handleLogs = async (data) => {
  if (!store.data) return
  const now = new Date()
  const day = now.getDate().toString()
  if (!store.data.daily[day]) store.data.daily[day] = createEmptyStats()
  const dayData = store.data.daily[day]

  // 统计日志级别
  const type = data.type || 'unknown'
  const updateLogType = (target) => {
    if (!target.details.log_levels) target.details.log_levels = {}
    target.details.log_levels[type] = (target.details.log_levels[type] || 0) + 1
  }
  updateLogType(store.data)
  updateLogType(dayData)

  // 详细 DNS 统计
  if (data.payload && data.payload.includes('dns: exchanged')) {
    const dnsMatch = data.payload.match(/dns: exchanged\s+([A-Z0-9]+)\s+([^\s]+)\s+\d+\s+IN\s+[A-Z0-9]+\s+([^\s]+)/i)

    if (dnsMatch) {
      const dnsType = dnsMatch[1].toUpperCase()
      const domain = dnsMatch[2].replace(/\.$/, '')
      const result = dnsMatch[3] // IP 或 别名

      const updateDnsStats = (target) => {
        const d = target.details
        if (!d.dns_types) d.dns_types = {}
        if (!d.dns_domains) d.dns_domains = {}
        if (!d.dns_ip_kinds) d.dns_ip_kinds = { 'fake-ip': 0, 'real-ip': 0 }

        // 统计类型和域名
        d.dns_types[dnsType] = (d.dns_types[dnsType] || 0) + 1
        if (!d.dns_domains[domain]) d.dns_domains[domain] = { hits: 0, types: {} }
        d.dns_domains[domain].hits++
        d.dns_domains[domain].types[dnsType] = (d.dns_domains[domain].types[dnsType] || 0) + 1

        // Fake-IP 判定 (仅针对 A 和 AAAA 记录)
        if (dnsType === 'A' || dnsType === 'AAAA') {
          const isFake = result.startsWith('198.18.') || result.toLowerCase().startsWith('fc00')
          const kind = isFake ? 'fake-ip' : 'real-ip'
          d.dns_ip_kinds[kind] = (d.dns_ip_kinds[kind] || 0) + 1
        }
      }
      updateDnsStats(store.data)
      updateDnsStats(dayData)
    }
  }
}

const Start = async (params = Plugin) => {
  console.log(`[${Plugin.name}] Start()`)
  const router = new Router()
  registerStatsApi(router)
  registerTagsApi(router)
  router.get('/v1/docs/json', {}, (req, res) =>
    res.json(
      200,
      router.routes.map((r) => ({ method: r.method, path: r.path, metadata: r.metadata }))
    )
  )
  await Plugins.StartServer(params.ApiAddress, Plugin.id, async (req, res) => router.match(req, res))
  registerHandler()
  return 1
}

const Stop = async () => {
  console.log(`[${Plugin.name}] Stop()`)
  await saveMonthlyData()
  await Plugins.StopServer(Plugin.id)
  unRegisterHandler()
  return 2
}

const registerHandler = () => {
  const kernel = Plugins.useKernelApiStore()
  store.unregs.push(kernel.onConnections(handleConnections))
  store.unregs.push(kernel.onLogs(handleLogs))
  store.unregs.push(kernel.onTraffic((data) => {}))
  store.unregs.push(kernel.onMemory((data) => {}))
}

const unRegisterHandler = () => {
  store.unregs.forEach((u) => u?.())
  store.unregs = []
}

const onBeforeCoreStart = async (config, profile) => {
  // 改成debug以便收集更多信息
  if (Plugins.APP_TITLE.includes('SingBox')) {
    config.log.level = 'debug'
  }
  return config
}

const onReady = async () => {
  await initMonthlyData()
  await Stop().catch((err) => {
    console.log(`[${Plugin.name}] onReady: Stop()`, err)
  })
  await Start().catch((err) => {
    console.log(`[${Plugin.name}] onReady: Start()`, err)
  })
  return 1
}

const onShutdown = async () => {
  await Stop().catch((err) => {
    console.log(`[${Plugin.name}] onShutdown: Stop()`, err)
  })
  return 2
}

const onReload = async () => {
  await saveMonthlyData()
}

const onRun = async () => {
  Plugins.message.info('UI开发中...')
}

const Utils = {
  paginate(data, pageNum, pageSize) {
    if (!Array.isArray(data)) {
      throw new Error('data must be an array')
    }

    pageNum = Math.max(1, Number(pageNum))
    pageSize = Math.max(1, Number(pageSize))

    const total = data.length
    const startIndex = (pageNum - 1) * pageSize
    const endIndex = startIndex + pageSize

    return {
      pageNum,
      pageSize,
      total,
      list: data.slice(startIndex, endIndex)
    }
  },
  sortByField(arr, field, order = 'desc') {
    return arr.sort((a, b) => {
      const valA = a[field]
      const valB = b[field]

      if (valA == null && valB == null) return 0
      if (valA == null) return 1
      if (valB == null) return -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'desc' ? valB - valA : valA - valB
      }

      return order === 'desc' ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB))
    })
  },
  paginateAndSort(list, query) {
    const { sort, pageNum = 1, pageSize = 10, order } = query
    sort && Utils.sortByField(list, sort, order)
    return Utils.paginate(list, pageNum, pageSize)
  },
  empty(query) {
    return {
      pageNum: Number(query.pageNum || 1),
      pageSize: Number(query.pageSize || 10),
      total: 0,
      list: []
    }
  },
  async getTargetData(query) {
    const { month, day } = query
    let targetMonthData = store.data
    if (month && month !== store.currentMonth) {
      try {
        targetMonthData = JSON.parse(await Plugins.ReadFile(`${PATH}/${month}${DataVersion}.json`))
      } catch (e) {
        return null
      }
    }
    const target = day ? targetMonthData.daily[day] : targetMonthData
    return target
  }
}

function registerStatsApi(router) {
  router.get(
    '/v1/stats/overview',
    {
      description: {
        zh: '实时统计概览'
      }
    },
    (req, res) => {
      res.json(200, {
        month_summary: store.data ? store.data.summary : null,
        current_month: store.currentMonth
      })
    }
  )

  router.get(
    '/v1/stats/rank/:dimension',
    {
      description: {
        zh: '按维度统计: domains,roots,nodes,processes,rules,tags,log_levels,dns_types,dns_domains,dns_ip_kinds,clients'
      },
      examples: {
        域名访问量排行: '/v1/stats/rank/domains?sort=hits',
        根域名访问量排行: '/v1/stats/rank/roots?sort=hits',
        节点下行流量排行: '/v1/stats/rank/nodes?sort=down',
        进程上行流量排行: '/v1/stats/rank/processes?sort=up',
        规则匹配次数排行: '/v1/stats/rank/rules?sort=hits',
        DNS解析域名排行: '/v1/stats/rank/dns_domains?sort=hits',
        日志级别分布: '/v1/stats/rank/log_levels',
        DNS类型统计: '/v1/stats/rank/dns_types',
        FakeIP和RealIP: '/v1/stats/rank/dns_ip_kinds',
        客户端排行: '/v1/stats/rank/clients'
      }
    },
    async (req, res, { dimension }) => {
      const target = await Utils.getTargetData(req.query)
      if (!target || !target.details[dimension]) {
        return res.json(200, Utils.empty(req.query))
      }
      const list = Object.entries(target.details[dimension]).map(([name, val]) => {
        if (typeof val === 'number') return { name, count: val }
        return { name, ...val }
      })
      res.json(200, Utils.paginateAndSort(list, req.query))
    }
  )

  router.get(
    '/v1/stats/clients/:ip',
    {
      description: {
        zh: '按客户端查询: ip'
      }
    },
    async (req, res, { ip }) => {
      const target = await Utils.getTargetData(req.query)
      if (!target || !target.details.clients[ip]) {
        return res.end(404, {}, `Client not found: ${ip}`)
      }
      res.json(200, target)
    }
  )

  router.get(
    '/v1/stats/clients/:ip/:dimension',
    {
      description: {
        zh: '按客户端和维度查询: ip dimension'
      }
    },
    async (req, res, { ip, dimension }) => {
      const target = await Utils.getTargetData(req.query)
      if (!target || !target.details.clients[ip]?.[dimension]) {
        return res.json(200, Utils.empty(req.query))
      }
      const list = Object.entries(target.details.clients[ip][dimension]).map(([name, val]) => {
        if (typeof val === 'number') return { name, count: val }
        return { name, ...val }
      })
      res.json(200, Utils.paginateAndSort(list, req.query))
    }
  )

  router.get(
    '/v1/stats/pivot/:type/:key',
    {
      description: {
        zh: '按节点统计: node'
      }
    },
    async (req, res, { type, key }) => {
      const target = await Utils.getTargetData(req.query)
      if (!target) {
        return res.json(200, Utils.empty(req.query))
      }
      const pivotField = type === 'node' ? 'pivot_node_domain' : 'pivot_tag_node'
      const detailData = target.details[pivotField][key]
      if (!detailData) return res.json(404, 'No Data')
      const list = Object.entries(detailData).map(([name, val]) => ({ name, ...val }))
      res.json(200, Utils.paginateAndSort(list, req.query))
    }
  )

  router.get('/v1/stats/history/months', {}, async (req, res) => {
    try {
      const files = await Plugins.ReadDir(PATH)
      res.json(
        200,
        files.filter((f) => f.name.endsWith('.json') && f.name !== 'tags.json').map((f) => f.name.replace('.json', ''))
      )
    } catch (e) {
      res.json(200, [])
    }
  })
}

function registerTagsApi(router) {
  router.get('/v1/tags', {}, (req, res) => res.json(200, store.tagsConfig))
  router.post('/v1/tags', {}, async (req, res) => {
    store.tagsConfig = Plugins.deepAssign(store.tagsConfig, req.body)
    await Plugins.WriteFile(TAGS_FILE, JSON.stringify(store.tagsConfig))
    res.json(200, 'OK')
  })
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
