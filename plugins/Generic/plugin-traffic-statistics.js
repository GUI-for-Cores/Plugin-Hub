const PATH = 'data/third/traffic-statistics'
const TAGS_FILE = PATH + '/tags.json'

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
  summary: { up: 0, down: 0, errors: 0 },
  details: {
    domains: {},
    roots: {},
    nodes: {},
    processes: {},
    rules: {},
    tags: {},
    pivot_node_domain: {},
    pivot_tag_node: {}
  }
})

const initMonthlyData = async () => {
  const month = Plugins.formatDate(Date.now(), 'YYYY-MM')
  const content = await Plugins.ReadFile(`${PATH}/${month}.json`).catch(() => JSON.stringify({ ...createEmptyStats(), daily: {} }))
  store.data = JSON.parse(content)
  store.currentMonth = month
}

const saveMonthlyData = async () => {
  const path = `${PATH}/${store.currentMonth}.json`
  await Plugins.WriteFile(path, JSON.stringify(store.data))
}

const updateStats = (target, diffUp, diffDown, isNew, info) => {
  if (!target) return
  const { node, fqdn, root, process, rule, tags } = info
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
      const info = {
        node: chains[0] || 'DIRECT',
        fqdn: metadata.host || metadata.destinationIP || 'unknown',
        root: getRootDomain(metadata.host || metadata.destinationIP || 'unknown'),
        process: metadata.processPath || 'system',
        rule: rule || 'Match',
        tags: store.tagsConfig[getRootDomain(metadata.host || metadata.destinationIP || 'unknown')] || store.tagsConfig[metadata.host] || []
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

const handleLogs = (data) => {}

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
        targetMonthData = JSON.parse(await Plugins.ReadFile(`${PATH}/${month}.json`))
      } catch (e) {
        return null
      }
    }
    const target = day ? targetMonthData.daily[day] : targetMonthData
    return target
  }
}

function registerStatsApi(router) {
  router.get('/v1/stats/overview', {}, (req, res) => {
    res.json(200, {
      month_summary: store.data ? store.data.summary : null,
      current_month: store.currentMonth
    })
  })

  router.get(
    '/v1/stats/rank/:dimension',
    {
      zh: '按维度统计: domains,roots,nodes,processes,rules,tags,pivot_node_domain,pivot_tag_node'
    },
    async (req, res, { dimension }) => {
      const target = await Utils.getTargetData(req.query)
      if (!target || !target.details[dimension]) {
        return res.json(200, Utils.empty(req.query))
      }
      const list = Object.entries(target.details[dimension]).map(([name, val]) => ({ name, ...val }))
      res.json(200, Utils.paginateAndSort(list, req.query))
    }
  )

  router.get(
    '/v1/stats/pivot/:type/:key',
    {
      zh: '按节点统计: node'
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
