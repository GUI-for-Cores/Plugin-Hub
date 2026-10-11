/**
 * GUI.for.SingBox 插件：弹性节点切换（可恢复冷却 + 谨慎故障切换）。
 * 本文件由 scripts/build-plugin.js 自动生成，勿手改；来源 src/*.js + scripts/plugin-adapter.js。
 * 自包含单文件：不通过相对路径或运行时 import 引用项目 src/。
 */

const __core = (() => {
  // ---- src/config.js ----
  const DEFAULT_CONFIG = Object.freeze({
    selectorName: '🚀 节点选择',
    probeUrls: Object.freeze(['https://www.gstatic.com/generate_204', 'https://www.google.com/generate_204', 'https://github.com']),
    watchIntervalMs: 10000,
    watchTimeoutMs: 4000,
    maxDelayMs: 2000,
    poolRefreshIntervalMs: 180000,
    poolTimeoutMs: 2000,
    poolConcurrency: 20,
    poolFailureRateThreshold: 0.9,
    failureThreshold: 3,
    recoveryThreshold: 2,
    initialCooldownMs: 120000,
    maxCooldownMs: 1800000,
    minDwellMs: 60000,
    degradationRatio: 3,
    degradationThreshold: 2,
    slowThreshold: 2,
    baselineWindow: 5,
    optimizeRatio: 2,
    optimizeThreshold: 3,
    stalkProbeDelayMs: 2000,
    stalkSuccessThreshold: 2,
    preSwitchMaxProbe: 3,
    // 真实延迟探测：sing-box 的 /delay 用 HEAD 且不读 body，系统性低估真实 GET 访问延迟
    // （实测低 3~6 倍），导致 maxDelayMs 慢判定失效。真实延迟探测走系统代理（fetch 默认走
    // 系统代理，指向 sing-box 混合入站）发起真实 GET 并读 body，测到的就是用户实际感知延迟。
    realProbeEnabled: true,
    realProbeUrls: Object.freeze(['https://github.com', 'https://www.google.com']),
    realDelayMs: 3000,
    realProbeTimeoutMs: 8000,
    realSlowThreshold: 1
  })

  const POSITIVE_KEYS = [
    'watchIntervalMs',
    'watchTimeoutMs',
    'maxDelayMs',
    'poolRefreshIntervalMs',
    'poolTimeoutMs',
    'initialCooldownMs',
    'minDwellMs',
    'degradationRatio',
    'optimizeRatio',
    'stalkProbeDelayMs',
    'realDelayMs',
    'realProbeTimeoutMs'
  ]

  const POSITIVE_INTEGER_KEYS = [
    'poolConcurrency',
    'failureThreshold',
    'recoveryThreshold',
    'degradationThreshold',
    'slowThreshold',
    'baselineWindow',
    'optimizeThreshold',
    'stalkSuccessThreshold',
    'preSwitchMaxProbe',
    'realSlowThreshold'
  ]

  function positiveNumber(value, fallback) {
    return Number.isFinite(value) && value > 0 ? value : fallback
  }

  function positiveInteger(value, fallback) {
    return Number.isInteger(value) && value > 0 ? value : fallback
  }

  function normalizeProbeUrls(value, fallback = DEFAULT_CONFIG.probeUrls) {
    if (!Array.isArray(value)) return fallback
    const filtered = value.filter((url) => typeof url === 'string' && url.trim())
    return filtered.length > 0 ? filtered : fallback
  }

  function normalizePoolFailureRateThreshold(value, fallback) {
    return Number.isFinite(value) && value > 0 && value <= 1 ? value : fallback
  }

  function normalizeConfig(input = {}) {
    const source = input && typeof input === 'object' ? input : {}
    const config = { ...DEFAULT_CONFIG }

    for (const key of POSITIVE_KEYS) {
      config[key] = positiveNumber(source[key], DEFAULT_CONFIG[key])
    }

    for (const key of POSITIVE_INTEGER_KEYS) {
      config[key] = positiveInteger(source[key], DEFAULT_CONFIG[key])
    }

    config.maxCooldownMs = positiveNumber(source.maxCooldownMs, DEFAULT_CONFIG.maxCooldownMs)
    config.maxCooldownMs = Math.max(config.maxCooldownMs, config.initialCooldownMs)
    config.selectorName = typeof source.selectorName === 'string' && source.selectorName.trim() ? source.selectorName : DEFAULT_CONFIG.selectorName

    config.probeUrls = normalizeProbeUrls(source.probeUrls)
    config.realProbeUrls = normalizeProbeUrls(source.realProbeUrls, DEFAULT_CONFIG.realProbeUrls)
    config.realProbeEnabled = typeof source.realProbeEnabled === 'boolean' ? source.realProbeEnabled : DEFAULT_CONFIG.realProbeEnabled
    config.poolFailureRateThreshold = normalizePoolFailureRateThreshold(source.poolFailureRateThreshold, DEFAULT_CONFIG.poolFailureRateThreshold)

    return config
  }

  // ---- src/model.js ----
  function createNodeState(tag) {
    if (typeof tag !== 'string' || !tag) {
      throw new TypeError('节点标签必须是非空字符串')
    }

    return {
      tag,
      status: 'healthy',
      failureCount: 0,
      recoverySuccessCount: 0,
      cooldownMs: 0,
      cooldownUntil: null,
      lastDelay: null,
      lastError: null,
      lastProbeAt: null
    }
  }

  function serializeNodeState(state) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('节点状态必须是对象')
    }

    return { ...state }
  }

  // ---- src/response.js ----
  function failure(reason, status) {
    return status === undefined ? { ok: false, reason } : { ok: false, status, reason }
  }

  function parseDelayResponse(status, body) {
    if (!Number.isInteger(status) || status < 200 || status >= 300) {
      return failure(`delay request failed with HTTP ${status}`, status)
    }

    let value = body
    if (typeof body === 'string') {
      try {
        value = JSON.parse(body)
      } catch {
        return failure('delay response is not valid JSON')
      }
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return failure('delay response must be a JSON object')
    }
    if (typeof value.delay !== 'number' || !Number.isFinite(value.delay) || value.delay <= 0) {
      return failure('delay response must contain a positive delay')
    }

    return { ok: true, delay: value.delay }
  }

  // ---- src/health-state.js ----
  const STATUS = Object.freeze({
    HEALTHY: 'healthy',
    SUSPECT: 'suspect',
    COOLDOWN: 'cooldown',
    HALF_OPEN: 'half-open'
  })

  function nextCooldownMs(currentCooldownMs, initialCooldownMs, maxCooldownMs) {
    const base = Number.isFinite(currentCooldownMs) && currentCooldownMs > 0 ? currentCooldownMs : initialCooldownMs
    return Math.min(base * 2, maxCooldownMs)
  }

  function recordProbeFailure(state, now, reason, config) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('节点状态必须是对象')
    }
    if (!Number.isFinite(now)) {
      throw new TypeError('now 必须是有限数字')
    }

    const next = { ...state, lastError: reason, lastProbeAt: now }

    switch (state.status) {
      case STATUS.HEALTHY:
        next.status = STATUS.SUSPECT
        next.failureCount = 1
        break

      case STATUS.SUSPECT: {
        const failures = state.failureCount + 1
        next.failureCount = failures
        if (failures >= config.failureThreshold) {
          next.status = STATUS.COOLDOWN
          next.cooldownMs = config.initialCooldownMs
          next.cooldownUntil = now + config.initialCooldownMs
          next.recoverySuccessCount = 0
        }
        break
      }

      case STATUS.HALF_OPEN: {
        const cooldownMs = nextCooldownMs(state.cooldownMs, config.initialCooldownMs, config.maxCooldownMs)
        next.status = STATUS.COOLDOWN
        next.cooldownMs = cooldownMs
        next.cooldownUntil = now + cooldownMs
        next.recoverySuccessCount = 0
        break
      }

      case STATUS.COOLDOWN:
        // 冷却期间不应探测；即使收到失败也不重复计时，保持原冷却。
        break

      default:
        next.status = STATUS.SUSPECT
        next.failureCount = 1
    }

    return next
  }

  function recordProbeSuccess(state, now, delay, config) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('节点状态必须是对象')
    }
    if (!Number.isFinite(now)) {
      throw new TypeError('now 必须是有限数字')
    }

    const next = { ...state, lastDelay: delay, lastError: null, lastProbeAt: now }

    switch (state.status) {
      case STATUS.SUSPECT:
        next.status = STATUS.HEALTHY
        next.failureCount = 0
        next.recoverySuccessCount = 0
        break

      case STATUS.HALF_OPEN: {
        const successes = state.recoverySuccessCount + 1
        if (successes >= config.recoveryThreshold) {
          next.status = STATUS.HEALTHY
          next.failureCount = 0
          next.recoverySuccessCount = 0
          next.cooldownMs = 0
          next.cooldownUntil = null
        } else {
          next.recoverySuccessCount = successes
        }
        break
      }

      case STATUS.HEALTHY:
      case STATUS.COOLDOWN:
      default:
        // healthy 保持；cooldown 期间的意外成功不改变状态。
        break
    }

    return next
  }

  function getProbePlan(state, now, config) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('节点状态必须是对象')
    }
    if (!Number.isFinite(now)) {
      throw new TypeError('now 必须是有限数字')
    }

    if (state.status === STATUS.COOLDOWN) {
      const until = state.cooldownUntil
      if (Number.isFinite(until) && now >= until) {
        return { shouldProbe: true, state: { ...state, status: STATUS.HALF_OPEN } }
      }
      return { shouldProbe: false, state: { ...state }, reason: 'in cooldown until ' + String(until) }
    }

    return { shouldProbe: true, state: { ...state } }
  }

  function isEligibleCandidate(state, now) {
    if (!state || typeof state !== 'object') {
      return false
    }
    return state.status === STATUS.HEALTHY || state.status === STATUS.SUSPECT
  }

  function markCooldown(state, now, config) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('节点状态必须是对象')
    }
    if (!Number.isFinite(now)) {
      throw new TypeError('now 必须是有限数字')
    }

    return {
      ...state,
      status: STATUS.COOLDOWN,
      cooldownMs: config.initialCooldownMs,
      cooldownUntil: now + config.initialCooldownMs,
      recoverySuccessCount: 0
    }
  }

  // ---- src/api.js ----

  function joinUrl(baseUrl, path) {
    return `${String(baseUrl).replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
  }

  function headers(secret, contentType = false) {
    const result = {}
    if (secret) result.Authorization = `Bearer ${secret}`
    if (contentType) result['Content-Type'] = 'application/json'
    return result
  }

  function combineSignal(signal, timeoutMs) {
    const controller = new AbortController()
    let timeout
    let timedOut = false
    const abort = () => controller.abort(signal?.reason)
    if (signal) {
      if (signal.aborted) abort()
      else signal.addEventListener('abort', abort, { once: true })
    }
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true
        controller.abort(new DOMException('The operation timed out', 'TimeoutError'))
      }, timeoutMs)
    }
    return {
      signal: controller.signal,
      get timedOut() {
        return timedOut
      },
      cleanup() {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', abort)
      }
    }
  }

  async function readBody(response) {
    const contentType = response.headers?.get?.('content-type') ?? ''
    if (contentType.includes('json') && typeof response.json === 'function') {
      try {
        return await response.json()
      } catch {
        throw new Error('response body is not valid JSON')
      }
    }
    if (typeof response.text === 'function') {
      const text = await response.text()
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }
    return undefined
  }

  function errorResult(error, timedOut = false) {
    const reason =
      timedOut || error?.name === 'TimeoutError' || error?.code === 'UND_ERR_CONNECT_TIMEOUT'
        ? 'request timeout'
        : error?.name === 'AbortError' || error?.name === 'CanceledError'
          ? 'request aborted'
          : error?.message || String(error)
    return { ok: false, status: error?.status, reason }
  }

  function createClashApi({ baseUrl, secret, timeoutMs = 5000, fetchImpl = globalThis.fetch }) {
    if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')
    const request = async (path, options = {}, signal, requestTimeoutMs = timeoutMs) => {
      const combined = combineSignal(signal, requestTimeoutMs)
      try {
        const response = await fetchImpl(joinUrl(baseUrl, path), { ...options, signal: combined.signal, headers: { ...headers(secret), ...options.headers } })
        let body
        try {
          body = await readBody(response)
        } catch (error) {
          return { ok: false, status: response.status, reason: error.message }
        }
        if (!response.ok && (response.status < 200 || response.status >= 300)) {
          return { ok: false, status: response.status, reason: `request failed with HTTP ${response.status}`, body }
        }
        return { ok: true, status: response.status, body }
      } catch (error) {
        return errorResult(error, combined.timedOut)
      } finally {
        combined.cleanup()
      }
    }

    return {
      async getProxies(signal) {
        const result = await request('/proxies', {}, signal)
        if (!result.ok) throw Object.assign(new Error(result.reason), result)
        return result.body
      },

      async probe(node, url, timeoutMs, signal) {
        const encodedNode = encodeURIComponent(node)
        const query = new URLSearchParams({ url, timeout: String(timeoutMs) })
        // 探测超时交给 sing-box 的 timeout 参数（超时返回 504）；fetch 端仅保留兜底超时，
        // 避免 WebView 连接池排队期间被短超时误 abort（timeoutMs 只作 sing-box 端超时，不作 fetch abort）
        const result = await request(`/proxies/${encodedNode}/delay?${query}`, {}, signal, timeoutMs * 10)
        if (!result.ok) return result
        return parseDelayResponse(result.status, result.body)
      },

      async select(group, node, signal) {
        const combined = combineSignal(signal)
        try {
          const result = await request(
            `/proxies/${encodeURIComponent(group)}`,
            {
              method: 'PUT',
              headers: headers(secret, true),
              body: JSON.stringify({ name: node })
            },
            combined.signal
          )
          if (!result.ok) throw Object.assign(new Error(result.reason), result)
          return { ok: true, status: result.status, body: result.body }
        } finally {
          combined.cleanup()
        }
      }
    }
  }

  // 软超时包装：给一个 Promise 加上超时上限，超时后返回 TimeoutError。
  // 底层 promise 在超时后仍会继续（无法取消 native 请求），但其结果会被忽略，
  // 避免 unhandledRejection。用于 HttpGet 等无显式超时参数的 native 请求。
  function withTimeout(promise, timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise
    return new Promise((resolve, reject) => {
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          reject(new DOMException('The operation timed out', 'TimeoutError'))
        }
      }, timeoutMs)
      promise.then(
        (v) => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            resolve(v)
          }
        },
        (e) => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            reject(e)
          }
        }
      )
    })
  }

  function isTimeoutError(error) {
    if (!error) return false
    return error?.name === 'TimeoutError' || error?.name === 'AbortError' || /timed?\s*out|timeout/i.test(error?.message || '')
  }

  // 真实延迟探测：通过注入的 httpGetImpl（GFS 插件传 Plugins.HttpGet，native 层无 CORS，
  // 默认走系统代理指向 sing-box 混合入站 127.0.0.1:20122）发起真实 GET 并完整下载响应体，
  // 测到的是「用户实际访问延迟」。与 sing-box 的 /delay（HEAD + 不读 body，系统性低估 3~6 倍）
  // 互补，用于慢判定。
  // httpGetImpl 签名：async (url) => ({ body })，body 为解析后的 JSON 对象或文本字符串；
  // 失败时抛异常（网络错误/超时/非 2xx），或返回 { body: { message, ... } }（GitHub API 风格错误）。
  // 返回 { ok, delay, reason }；ok=false 表示真实访问失败或超时。
  async function realProbe(url, timeoutMs, httpGetImpl) {
    if (typeof httpGetImpl !== 'function') throw new TypeError('httpGetImpl must be a function')
    const start = Date.now()
    try {
      const result = await withTimeout(httpGetImpl(url), timeoutMs)
      const delay = Date.now() - start
      const body = result && result.body
      // GitHub API 风格错误：body 是对象且含 message（如 rate limit/404）
      if (body && typeof body === 'object' && !Array.isArray(body) && body.message) {
        return { ok: false, reason: String(body.message) }
      }
      return { ok: true, delay }
    } catch (error) {
      const reason = isTimeoutError(error) ? 'request timeout' : error?.message || String(error)
      return { ok: false, reason }
    }
  }

  // ---- src/monitor.js ----

  function silentLogger() {
    return {
      info() {},
      warn() {},
      error() {}
    }
  }

  function median(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 1) return sorted[mid]
    return (sorted[mid - 1] + sorted[mid]) / 2
  }

  // GFS 实时测速会改写节点名（追加「 | IP | 延迟ms | 速度mb/s [...]_序号_序号」后缀），
  // 同一节点的 tag 在不同时刻后缀不同，导致精确匹配失效（切换确认失败、剔除旧节点失效）。
  // stableKey 截断「| 延迟ms」及之后的可变后缀，保留到 IP，得到稳定身份用于比较。
  function stableKey(tag) {
    if (typeof tag !== 'string') return tag
    const m = tag.match(/^(.*?)\s*\|\s*\d+(?:\.\d+)?ms\b/)
    return m ? m[1].trim() : tag
  }

  function createMonitor({ api, config, clock, logger, httpGetImpl = null }) {
    const cfg = normalizeConfig(config)
    const time = clock && typeof clock.now === 'function' ? clock : Date
    const log = logger && typeof logger.info === 'function' ? logger : silentLogger()

    const nodeStates = new Map()
    let members = []
    let memberTypes = {}
    let currentNow = null
    let lastObservedNow = null
    let currentStartAt = null
    let lastError = null
    let lastSwitch = null
    let candidates = []
    let running = false
    let watchInProgress = false
    let poolInProgress = false
    let watchTimer = null
    let poolTimer = null
    let watchController = null
    let poolController = null

    // 通道 A 专用状态
    let watchBaseline = []
    let watchFailureCount = 0
    let watchDegradationCount = 0
    let watchOptimizeCount = 0
    let watchSlowCount = 0
    let realSlowCount = 0
    let realDelay = null
    let watchCycleCount = 0
    let poolCycleCount = 0
    // 盯梢期：切换后短窗口内快速失败快速切换，待新节点稳定后退出
    let stalking = false
    let stalkingSuccessCount = 0
    let stalkTimer = null

    function ensureNodeState(tag) {
      if (!nodeStates.has(tag)) {
        nodeStates.set(tag, createNodeState(tag))
      }
      return nodeStates.get(tag)
    }

    // 返回本轮探测 URL 序列：从 cycleCount 对应的起始位开始轮换，
    // 使各 URL 轮流充当首个探测目标，避免固定顺序下对首个 URL 不可达的节点
    // 每次都要先耗尽超时才能轮到可达的 URL。
    function probeUrlSequence(cycleCount) {
      const urls = cfg.probeUrls
      if (!Array.isArray(urls) || urls.length === 0) return []
      const start = cycleCount % urls.length
      const sequence = []
      for (let i = 0; i < urls.length; i += 1) {
        sequence.push(urls[(start + i) % urls.length])
      }
      return sequence
    }

    // 并行短路多 URL 探测：同时探测所有 URL，任一 URL 成功即返回 ok（取最快成功）；
    // 全部失败则返回最后一个 URL 的失败结果，交由调用方判定。
    // 相比串行依次探测，死节点（所有 URL 都超时）只需等单个 URL 超时而非逐个累加，
    // 3 个 URL 时死节点探测耗时从 3×timeout 降为 1×timeout，大幅缩短冷启动全池扫描时间。
    async function probeAny(node, urls, timeoutMs, signal) {
      if (!Array.isArray(urls) || urls.length === 0) {
        return { ok: false, result: null }
      }
      const probeOne = async (url) => {
        let result
        try {
          result = await api.probe(node, url, timeoutMs, signal)
        } catch (error) {
          result = { ok: false, reason: error?.message || String(error) }
        }
        if (result && result.ok) return result
        throw result || new Error('probe failed')
      }
      try {
        const result = await Promise.any(urls.map(probeOne))
        return { ok: true, result }
      } catch (aggregate) {
        const errors = Array.isArray(aggregate?.errors) ? aggregate.errors : []
        return { ok: false, result: errors[errors.length - 1] || { ok: false, reason: 'probe failed' } }
      }
    }

    // 真实延迟多 URL 探测：依次用 httpGetImpl（native 层，走系统代理）发起真实 GET 并读 body。
    // 至少一个 URL 真实访问成功即返回「最慢延迟」（用户感知的是最慢的站点）；
    // 全部失败才返回失败（视为「HEAD 通但 GET 不通」的盲区）。
    async function realProbeAny(urls, timeoutMs) {
      if (!Array.isArray(urls) || urls.length === 0) {
        return { ok: false, result: null }
      }
      let slowest = null
      for (const url of urls) {
        let result
        try {
          result = await realProbe(url, timeoutMs, httpGetImpl)
        } catch (error) {
          result = { ok: false, reason: error?.message || String(error) }
        }
        if (result && result.ok && (slowest === null || result.delay > slowest.delay)) {
          slowest = result
        }
      }
      return slowest ? { ok: true, result: slowest } : { ok: false, result: null }
    }

    // 返回候选池中延迟最小的节点 {tag, delay}；候选池为空或全无延迟时返回 null
    function bestCandidate() {
      let best = null
      for (const tag of candidates) {
        const st = nodeStates.get(tag)
        if (st && st.lastDelay != null && (best === null || st.lastDelay < best.delay)) {
          best = { tag, delay: st.lastDelay }
        }
      }
      return best
    }

    // 切换后安排一次立即快探：不等下一轮轮询，尽快确认新节点是否可用。
    // 仅在真实运行（running）时排定时器，测试手动驱动 watchCycle 时不排，避免定时器泄漏。
    function scheduleStalkProbe() {
      if (!running) return
      if (stalkTimer) clearTimeout(stalkTimer)
      stalkTimer = setTimeout(() => {
        stalkTimer = null
        watchCycle().catch((error) => log.error('盯梢快探异常', error?.message || String(error)))
      }, cfg.stalkProbeDelayMs)
    }

    async function runPoolProbe(tag, signal, urls) {
      const now = time.now()
      const state = ensureNodeState(tag)
      const plan = getProbePlan(state, now, cfg)
      nodeStates.set(tag, plan.state)
      if (!plan.shouldProbe) {
        return { tag, probed: false }
      }
      const { ok, result } = await probeAny(tag, urls, cfg.poolTimeoutMs, signal)
      if (ok) {
        nodeStates.set(tag, recordProbeSuccess(nodeStates.get(tag), now, result.delay, cfg))
        return { tag, probed: true, ok: true }
      }
      const reason = result?.reason || 'probe failed'
      nodeStates.set(tag, recordProbeFailure(nodeStates.get(tag), now, reason, cfg))
      return { tag, probed: true, ok: false }
    }

    async function poolCycle() {
      if (poolInProgress) {
        return { skipped: true, error: null }
      }
      poolInProgress = true
      const cycleController = new AbortController()
      poolController = cycleController
      const snapshotStates = new Map([...nodeStates].map(([k, v]) => [k, { ...v }]))
      const snapshotCandidates = [...candidates]

      try {
        let data
        try {
          data = await api.getProxies(cycleController.signal)
        } catch (error) {
          lastError = error?.message || String(error)
          log.error('无法读取主 Selector 状态', lastError)
          return { skipped: false, error: lastError }
        }

        const proxies = data?.proxies
        if (!proxies || typeof proxies !== 'object') {
          lastError = 'proxies 响应缺失'
          log.error(lastError)
          return { skipped: false, error: lastError }
        }

        const selector = proxies[cfg.selectorName]
        if (!selector) {
          lastError = `主 Selector「${cfg.selectorName}」不存在`
          log.error(lastError)
          return { skipped: false, error: lastError }
        }
        if (selector.type !== 'Selector') {
          lastError = `主 Selector「${cfg.selectorName}」类型为 ${selector.type}，非 Selector`
          log.error(lastError)
          return { skipped: false, error: lastError }
        }
        const all = Array.isArray(selector.all) ? selector.all : []
        if (all.length === 0) {
          lastError = `主 Selector「${cfg.selectorName}」无成员`
          log.error(lastError)
          return { skipped: false, error: lastError }
        }

        lastError = null
        members = [...all]
        memberTypes = {}
        for (const tag of members) {
          memberTypes[tag] = proxies[tag]?.type ?? 'unknown'
          ensureNodeState(tag)
        }
        for (const tag of [...nodeStates.keys()]) {
          if (!members.includes(tag)) nodeStates.delete(tag)
        }

        currentNow = selector.now

        // 探测目标：跳过当前 now 与 URLTest，本轮按轮换起始顺序探测多 URL
        const probeTargets = members.filter((tag) => tag !== currentNow && memberTypes[tag] !== 'URLTest')
        const urls = probeUrlSequence(poolCycleCount)

        const results = []
        for (let i = 0; i < probeTargets.length; i += cfg.poolConcurrency) {
          const batch = probeTargets.slice(i, i + cfg.poolConcurrency)
          const batchResults = await Promise.all(batch.map((tag) => runPoolProbe(tag, cycleController.signal, urls)))
          results.push(...batchResults)
        }

        // 全池失败熔断：实际探测节点失败率超过阈值则本轮作废
        const probed = results.filter((r) => r.probed)
        if (probed.length > 0) {
          const failures = probed.filter((r) => !r.ok).length
          const failureRate = failures / probed.length
          if (failureRate > cfg.poolFailureRateThreshold) {
            nodeStates.clear()
            for (const [k, v] of snapshotStates) nodeStates.set(k, v)
            candidates = snapshotCandidates
            lastError = '全池探测失败率超过阈值，判定为探测目标/API 故障，本轮作废'
            log.warn(lastError)
            return { skipped: false, error: lastError }
          }
        }

        // 候选池按 lastDelay 升序排序，candidates[0] 恒为当前最快节点，
        // 使故障切换与择优切换统一切「最快」，复核也按「最快优先」探测
        candidates = probeTargets
          .filter((tag) => {
            const st = nodeStates.get(tag)
            return st && st.status === 'healthy' && st.lastDelay != null && st.lastError == null
          })
          .sort((a, b) => (nodeStates.get(a)?.lastDelay ?? Infinity) - (nodeStates.get(b)?.lastDelay ?? Infinity))

        return { skipped: false, error: null }
      } finally {
        poolInProgress = false
        poolController = null
        poolCycleCount += 1
      }
    }

    async function watchCycle() {
      if (watchInProgress) {
        return { skipped: true, switchedTo: null, error: null }
      }
      watchInProgress = true
      const cycleController = new AbortController()
      watchController = cycleController

      try {
        let data
        try {
          data = await api.getProxies(cycleController.signal)
        } catch (error) {
          lastError = error?.message || String(error)
          log.error('无法读取主 Selector 状态', lastError)
          return { skipped: false, switchedTo: null, error: lastError }
        }

        const proxies = data?.proxies
        if (!proxies || typeof proxies !== 'object') {
          lastError = 'proxies 响应缺失'
          log.error(lastError)
          return { skipped: false, switchedTo: null, error: lastError }
        }

        const selector = proxies[cfg.selectorName]
        if (!selector) {
          lastError = `主 Selector「${cfg.selectorName}」不存在`
          log.error(lastError)
          return { skipped: false, switchedTo: null, error: lastError }
        }
        if (selector.type !== 'Selector') {
          lastError = `主 Selector「${cfg.selectorName}」类型为 ${selector.type}，非 Selector`
          log.error(lastError)
          return { skipped: false, switchedTo: null, error: lastError }
        }

        const now = time.now()
        const observedNow = selector.now

        // 外部变化检测：接受新选择、重置快探窗口，不切回旧节点
        if (lastObservedNow !== null && lastObservedNow !== observedNow) {
          watchBaseline = []
          watchFailureCount = 0
          watchDegradationCount = 0
          watchOptimizeCount = 0
          watchSlowCount = 0
          realSlowCount = 0
          realDelay = null
          stalking = false
          stalkingSuccessCount = 0
          currentStartAt = now
        }
        if (currentStartAt === null) {
          currentStartAt = now
        }
        lastObservedNow = observedNow
        currentNow = observedNow

        // GFS 实时测速会改写节点名（追加 IP/延迟/速度/序号后缀），
        // 若 members 仅在 poolCycle 更新而 currentNow 在 watchCycle 更新，
        // 两次响应间节点名漂移会导致精确匹配失效、UI 无法标识当前节点。
        // 因此此处让 members 与 currentNow 取自同一次响应。
        const all = Array.isArray(selector.all) ? selector.all : []
        if (all.length > 0) {
          members = [...all]
          memberTypes = {}
          for (const tag of members) {
            memberTypes[tag] = proxies[tag]?.type ?? 'unknown'
            ensureNodeState(tag)
          }
          for (const tag of [...nodeStates.keys()]) {
            if (!members.includes(tag)) nodeStates.delete(tag)
          }
        }

        lastError = null

        // 只探测当前 now，多 URL 短路探测（任一成功即健康）
        const probeResult = await probeAny(observedNow, probeUrlSequence(watchCycleCount), cfg.watchTimeoutMs, cycleController.signal)
        const result = probeResult.ok ? probeResult.result : { ok: false, reason: probeResult.result?.reason || 'probe failed' }

        if (result && result.ok) {
          watchBaseline.push(result.delay)
          if (watchBaseline.length > cfg.baselineWindow) {
            watchBaseline = watchBaseline.slice(-cfg.baselineWindow)
          }
          watchFailureCount = 0
          if (stalking) {
            stalkingSuccessCount += 1
            if (stalkingSuccessCount >= cfg.stalkSuccessThreshold) {
              stalking = false
              stalkingSuccessCount = 0
              log.info('盯梢期结束，新节点稳定')
            }
          }
          if (watchBaseline.length >= cfg.baselineWindow && result.delay > median(watchBaseline) * cfg.degradationRatio) {
            watchDegradationCount += 1
          } else {
            watchDegradationCount = 0
          }
          // 绝对慢判定：探测成功但延迟超过 maxDelayMs 即计「慢」，连续达标触发切换
          if (result.delay > cfg.maxDelayMs) {
            watchSlowCount += 1
          } else {
            watchSlowCount = 0
          }

          // 真实延迟探测：sing-box 的 /delay 用 HEAD 不读 body，系统性低估真实 GET 延迟，
          // 用 httpGetImpl（native 层 HttpGet，走系统代理）测真实延迟作为可靠的慢判定（覆盖「探测快但真实慢」的盲区）。
          if (cfg.realProbeEnabled) {
            const realResult = await realProbeAny(cfg.realProbeUrls, cfg.realProbeTimeoutMs)
            if (realResult.ok && realResult.result) {
              realDelay = realResult.result.delay
              realSlowCount = realResult.result.delay > cfg.realDelayMs ? realSlowCount + 1 : 0
            } else {
              // 真实访问全部失败：sing-box 探测通但真实 GET 不通，视为慢/故障盲区
              realDelay = null
              realSlowCount += 1
            }
          }

          // 性能择优：当前节点延迟明显高于候选池最优时累积计数，连续达标后切到最优节点
          const best = bestCandidate()
          if (best && result.delay > best.delay * cfg.optimizeRatio) {
            watchOptimizeCount += 1
          } else {
            watchOptimizeCount = 0
          }
        } else {
          watchFailureCount += 1
          watchDegradationCount = 0
          watchOptimizeCount = 0
          watchSlowCount = 0
          realSlowCount = 0
          realDelay = null
        }

        const optimizeTriggered = watchOptimizeCount >= cfg.optimizeThreshold
        // 盯梢期内：失败 1 次即切、免驻留，尽快摆脱故障节点
        const effectiveFailureThreshold = stalking ? 1 : cfg.failureThreshold
        const effectiveMinDwellMs = stalking ? 0 : cfg.minDwellMs
        const shouldSwitch =
          watchFailureCount >= effectiveFailureThreshold ||
          watchDegradationCount >= cfg.degradationThreshold ||
          watchSlowCount >= cfg.slowThreshold ||
          realSlowCount >= cfg.realSlowThreshold ||
          optimizeTriggered
        const dwellSatisfied = now >= (currentStartAt ?? now) + effectiveMinDwellMs

        if (shouldSwitch && dwellSatisfied) {
          if (candidates.length === 0) {
            lastError = '候选池为空，等待通道 B 刷新'
            log.info(lastError)
            return { skipped: false, switchedTo: null, error: lastError }
          }

          // tag 漂移下，候选池可能残留「当前节点」的旧/新后缀快照，切换前按稳定身份排除
          candidates = candidates.filter((t) => stableKey(t) !== stableKey(observedNow))

          // 循环切换：切到候选后立即真实验证，真实失效则排除该候选继续切下一个，
          // 最多尝试 preSwitchMaxProbe 个候选，避免「切到失效节点」陷入长判定等待
          let attempts = 0
          while (candidates.length > 0 && attempts < cfg.preSwitchMaxProbe) {
            attempts += 1

            // 并行复核前 preSwitchMaxProbe 个候选（已按延迟升序），取最快可达者
            const probePool = candidates.slice(0, cfg.preSwitchMaxProbe)
            const checks = await Promise.all(
              probePool.map(async (candidate) => {
                const check = await probeAny(candidate, probeUrlSequence(watchCycleCount + attempts - 1), cfg.watchTimeoutMs, cycleController.signal)
                return { candidate, ok: check.ok }
              })
            )
            const unreachable = new Set(checks.filter((c) => !c.ok).map((c) => c.candidate))
            const reachable = checks.filter((c) => c.ok).map((c) => c.candidate)
            if (unreachable.size > 0) {
              candidates = candidates.filter((t) => !unreachable.has(t))
              for (const c of unreachable) log.warn(`候选 ${c} 复核不可达，跳过`)
            }
            if (reachable.length === 0) {
              lastError = '候选池内候选复核均不可达，等待通道 B 刷新'
              log.warn(lastError)
              return { skipped: false, switchedTo: null, error: lastError }
            }
            const target = reachable[0] // probePool 已按延迟升序，第一个即最快可达

            // 切换
            try {
              await api.select(cfg.selectorName, target, cycleController.signal)
            } catch (error) {
              log.warn(`切换到 ${target} 失败`, error?.message || String(error))
              lastError = `switch failed: ${error?.message}`
              currentStartAt = now
              // 切换失败可能由节点或控制面瞬时问题引起，重置计数避免 failureCount 累积卡死
              watchFailureCount = 0
              watchDegradationCount = 0
              watchOptimizeCount = 0
              watchSlowCount = 0
              realSlowCount = 0
              realDelay = null
              return { skipped: false, switchedTo: null, error: lastError }
            }

            // 刷新确认 now
            let confirmNow = null
            try {
              const refreshed = await api.getProxies(cycleController.signal)
              confirmNow = refreshed?.proxies?.[cfg.selectorName]?.now ?? null
            } catch (error) {
              confirmNow = null
            }

            if (confirmNow !== null && stableKey(confirmNow) === stableKey(target)) {
              // 切换后立即真实验证：真实 GET 读 body，识别「探测通但真实失效/超慢」的节点
              let realOk = true
              if (cfg.realProbeEnabled) {
                const realCheck = await realProbeAny(cfg.realProbeUrls, cfg.realProbeTimeoutMs)
                realOk = realCheck.ok && realCheck.result && realCheck.result.delay <= cfg.realDelayMs
                if (!realOk) {
                  const realMs = realCheck.ok && realCheck.result ? realCheck.result.delay : null
                  log.warn(`切换到 ${target} 后真实验证失败（真实延迟 ${realMs}ms），立即回退`)
                }
              }
              if (!realOk) {
                // 真实失效/超慢：标记 cooldown 排除该候选，继续循环切下一个
                const targetState = ensureNodeState(target)
                nodeStates.set(target, markCooldown(targetState, now, cfg))
                candidates = candidates.filter((t) => stableKey(t) !== stableKey(target))
                continue
              }

              // 真实可用，正常进入盯梢期
              const oldState = ensureNodeState(observedNow)
              nodeStates.set(observedNow, markCooldown(oldState, now, cfg))
              lastSwitch = { from: observedNow, to: target, at: now }
              currentNow = target
              lastObservedNow = target
              currentStartAt = now
              candidates = candidates.filter((t) => stableKey(t) !== stableKey(target) && stableKey(t) !== stableKey(observedNow))
              watchBaseline = []
              watchFailureCount = 0
              watchDegradationCount = 0
              watchOptimizeCount = 0
              watchSlowCount = 0
              realSlowCount = 0
              realDelay = null
              stalking = true
              stalkingSuccessCount = 0
              scheduleStalkProbe()
              log.info(`已切换到 ${target}`)
              return { skipped: false, switchedTo: target, error: null }
            }

            log.warn(`切换确认失败：期望 now=${target} 实际 now=${confirmNow}`)
            lastError = 'switch confirm failed'
            currentStartAt = now
            watchFailureCount = 0
            watchDegradationCount = 0
            watchOptimizeCount = 0
            watchSlowCount = 0
            realSlowCount = 0
            realDelay = null
            return { skipped: false, switchedTo: null, error: lastError }
          }

          // 循环耗尽：候选池内候选均真实失效或切换失败
          lastError = '候选池内候选均切换失败，等待通道 B 刷新'
          log.warn(lastError)
          return { skipped: false, switchedTo: null, error: lastError }
        }

        return { skipped: false, switchedTo: null, error: lastError }
      } finally {
        watchInProgress = false
        watchController = null
        watchCycleCount += 1
      }
    }

    function start() {
      if (running) return
      running = true
      poolCycle().catch((error) => log.error('候选池预热异常', error?.message || String(error)))
      watchTimer = setInterval(() => {
        watchCycle().catch((error) => log.error('快探轮次异常', error?.message || String(error)))
      }, cfg.watchIntervalMs)
      poolTimer = setInterval(() => {
        poolCycle().catch((error) => log.error('候选池轮次异常', error?.message || String(error)))
      }, cfg.poolRefreshIntervalMs)
    }

    function stop() {
      running = false
      if (watchTimer) {
        clearInterval(watchTimer)
        watchTimer = null
      }
      if (poolTimer) {
        clearInterval(poolTimer)
        poolTimer = null
      }
      if (stalkTimer) {
        clearTimeout(stalkTimer)
        stalkTimer = null
      }
      stalking = false
      stalkingSuccessCount = 0
      watchController?.abort()
      watchController = null
      poolController?.abort()
      poolController = null
    }

    function getSnapshot() {
      const states = {}
      for (const [tag, state] of nodeStates) {
        states[tag] = { ...state }
      }
      return {
        selectorName: cfg.selectorName,
        running,
        watchInProgress,
        poolInProgress,
        currentNow,
        members: [...members],
        memberTypes: { ...memberTypes },
        nodeStates: states,
        lastError,
        lastSwitch: lastSwitch ? { ...lastSwitch } : null,
        channelA: {
          baseline: [...watchBaseline],
          lastDelay: watchBaseline.length > 0 ? watchBaseline[watchBaseline.length - 1] : null,
          failureCount: watchFailureCount,
          degradationCount: watchDegradationCount,
          optimizeCount: watchOptimizeCount,
          slowCount: watchSlowCount,
          realSlowCount,
          realDelay,
          stalking,
          stalkingSuccessCount
        },
        candidates: [...candidates]
      }
    }

    return { start, stop, getSnapshot, watchCycle, poolCycle }
  }

  return {
    DEFAULT_CONFIG,
    normalizeConfig,
    createNodeState,
    serializeNodeState,
    parseDelayResponse,
    createClashApi,
    recordProbeFailure,
    recordProbeSuccess,
    getProbePlan,
    isEligibleCandidate,
    markCooldown,
    createMonitor
  }
})()

/**
 * GUI.for.SingBox 插件适配层：把内联核心（__core）接入 GFS 插件生命周期。
 * 本文件由 scripts/build-plugin.js 与内联核心拼接为自包含插件单文件；
 * 运行时不通过相对路径或运行时 import 引用项目 src/。
 * 仅面向 GUI.for.SingBox，不包含 GUI.for.Clash 分支。
 */

export default (Plugin) => {
  const { ref, computed, h, resolveComponent } = Vue

  const isRunning = ref(false)
  const snapshot = ref(null)

  let monitor = null
  let apiClient = null
  let refreshTimer = null
  let persistTimer = null
  let disposed = false

  const stateFile = 'data/plugins/singbox-resilient-node-switcher/state.json'

  // 从当前 profile 解析 sing-box Clash API 控制面地址与密钥（仅 GFS）
  function resolveEndpoint() {
    const { currentProfile: profile } = Plugins.useProfilesStore()
    const clash = profile && profile.experimental && profile.experimental.clash_api
    if (!clash) return null
    const controller = clash.external_controller || '127.0.0.1:20123'
    const secret = clash.secret || ''
    const idx = controller.lastIndexOf(':')
    const host = idx >= 0 ? controller.slice(0, idx) : '127.0.0.1'
    const port = idx >= 0 ? controller.slice(idx + 1) : '20123'
    return { baseUrl: `http://${host}:${port}`, secret }
  }

  // 从 Plugin 配置项构建 monitor 配置（数值项转数字，交给 normalizeConfig 归一化）
  function buildConfig() {
    return {
      selectorName: Plugin.SelectorName,
      probeUrls:
        typeof Plugin.ProbeUrls === 'string'
          ? Plugin.ProbeUrls.split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      watchIntervalMs: Number(Plugin.WatchIntervalMs),
      watchTimeoutMs: Number(Plugin.WatchTimeoutMs),
      maxDelayMs: Number(Plugin.MaxDelayMs),
      poolRefreshIntervalMs: Number(Plugin.PoolRefreshIntervalMs),
      poolTimeoutMs: Number(Plugin.PoolTimeoutMs),
      poolConcurrency: Number(Plugin.PoolConcurrency),
      poolFailureRateThreshold: Number(Plugin.PoolFailureRateThreshold),
      failureThreshold: Number(Plugin.FailureThreshold),
      recoveryThreshold: Number(Plugin.RecoveryThreshold),
      initialCooldownMs: Number(Plugin.InitialCooldownMs),
      maxCooldownMs: Number(Plugin.MaxCooldownMs),
      minDwellMs: Number(Plugin.MinDwellMs),
      degradationRatio: Number(Plugin.DegradationRatio),
      degradationThreshold: Number(Plugin.DegradationThreshold),
      slowThreshold: Number(Plugin.SlowThreshold),
      baselineWindow: Number(Plugin.BaselineWindow),
      optimizeRatio: Number(Plugin.OptimizeRatio),
      optimizeThreshold: Number(Plugin.OptimizeThreshold),
      stalkProbeDelayMs: Number(Plugin.StalkProbeDelayMs),
      stalkSuccessThreshold: Number(Plugin.StalkSuccessThreshold),
      preSwitchMaxProbe: Number(Plugin.PreSwitchMaxProbe),
      realProbeEnabled: Plugin.RealProbeEnabled,
      realProbeUrls:
        typeof Plugin.RealProbeUrls === 'string'
          ? Plugin.RealProbeUrls.split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      realDelayMs: Number(Plugin.RealDelayMs),
      realProbeTimeoutMs: Number(Plugin.RealProbeTimeoutMs),
      realSlowThreshold: Number(Plugin.RealSlowThreshold)
    }
  }

  function refreshSnapshot() {
    if (monitor) snapshot.value = monitor.getSnapshot()
  }

  function persistSnapshot() {
    if (!monitor || disposed) return
    try {
      Plugins.WriteFile(stateFile, JSON.stringify(monitor.getSnapshot(), null, 2))
    } catch (error) {
      console.warn(`[${Plugin.name}]`, '状态写入失败', error)
    }
  }

  function stop() {
    if (monitor) {
      monitor.stop()
      monitor = null
    }
    apiClient = null
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    if (persistTimer) {
      clearInterval(persistTimer)
      persistTimer = null
    }
    isRunning.value = false
    Plugin.status = 0
    return 2
  }

  function start() {
    if (isRunning.value) return 1
    const endpoint = resolveEndpoint()
    if (!endpoint) {
      throw new Error('未找到当前 profile 的 experimental.clash_api 配置')
    }
    const kernelApi = Plugins.useKernelApiStore()
    if (!kernelApi.running) {
      throw new Error('核心未运行，无法开始监控')
    }
    const config = buildConfig()
    apiClient = __core.createClashApi({
      baseUrl: endpoint.baseUrl,
      secret: endpoint.secret,
      timeoutMs: config.poolTimeoutMs
    })
    monitor = __core.createMonitor({
      api: apiClient,
      config,
      clock: Date,
      // 真实延迟探测用 native 层 HttpGet（无 CORS，默认走系统代理 20122 测真实代理延迟）。
      // 传 Connection: close 强制每次新建连接（含 TLS 握手），避免 Go http.Client 复用连接
      // 跳过 TLS 握手导致延迟系统性低估（实测复用连接 ~0.7s vs 新建连接 1.7~4.6s）。
      httpGetImpl: (url) => Plugins.HttpGet(url, { Connection: 'close' }),
      logger: {
        info: (...args) => console.log(`[${Plugin.name}]`, ...args),
        warn: (...args) => console.warn(`[${Plugin.name}]`, ...args),
        error: (...args) => console.error(`[${Plugin.name}]`, ...args)
      }
    })
    monitor.start()
    refreshSnapshot()
    refreshTimer = setInterval(refreshSnapshot, 2000)
    persistTimer = setInterval(persistSnapshot, 30000)
    isRunning.value = true
    Plugin.status = 1
    return 1
  }

  function statusText(status) {
    switch (status) {
      case 'healthy':
        return '🟢 正常'
      case 'suspect':
        return '🟡 疑似故障'
      case 'cooldown':
        return '🔴 冷却中'
      case 'half-open':
        return '🔵 半开检测'
      default:
        return '❓ 未知'
    }
  }

  function createUI() {
    const component = {
      template: `
    <Card>
      <template #title-suffix>
        <div class="font-bold">
          {{ isRunning ? '监控中' : '已停止' }} · 当前节点：{{ currentNow || '-' }}
          <span v-if="lastSwitchText" style="margin-left: 8px; font-weight: normal">
            · 上次切换 {{ lastSwitchText }}
          </span>
        </div>
      </template>
      <template #extra>
        <Button v-if="isRunning" type="primary" icon="pause" @click="handleStop()">停止</Button>
        <Button v-else type="primary" icon="play" @click="handleStart()">启动</Button>
      </template>
      <Alert v-if="lastError" type="warning" :message="'最近错误：' + lastError" style="margin-bottom: 8px" />
      <Table :data-source="rows" :columns="columns" size="small" />
      <div v-if="candidates.length" style="margin-top: 8px">
        <div class="font-bold" style="margin-bottom: 4px">候选池</div>
        <div>
          <Tag v-for="tag in candidates" :key="tag" style="margin-right: 4px">{{ tag }}</Tag>
        </div>
      </div>
    </Card>`,
      setup() {
        const columns = [
          {
            title: '节点名',
            key: 'tag',
            align: 'left',
            customRender({ value, record }) {
              if (!(record && record.isCurrent)) return value
              return h(resolveComponent('Tag'), { color: 'green' }, () => `${value}（当前）`)
            }
          },
          {
            title: '状态',
            key: 'status',
            align: 'center',
            customRender({ value }) {
              return statusText(value)
            }
          },
          {
            title: '最近延迟',
            key: 'lastDelay',
            align: 'center',
            customRender({ value }) {
              return value == null ? '-' : value.toFixed(2) + 'ms'
            }
          },
          { title: '连续失败', key: 'failureCount', align: 'center' },
          { title: '连续成功', key: 'recoverySuccessCount', align: 'center' },
          {
            title: '冷却截止',
            key: 'cooldownUntil',
            align: 'center',
            customRender({ value }) {
              return value == null ? '-' : Plugins.formatRelativeTime(value)
            }
          }
        ]
        const rows = computed(() => {
          const snap = snapshot.value
          if (!snap) return []
          return snap.members
            .map((tag) => {
              const st = snap.nodeStates[tag] || {}
              return {
                tag,
                isCurrent: tag === snap.currentNow,
                status: st.status,
                lastDelay: st.lastDelay,
                failureCount: st.failureCount,
                recoverySuccessCount: st.recoverySuccessCount,
                cooldownUntil: st.cooldownUntil
              }
            })
            .sort((a, b) => (a.isCurrent === b.isCurrent ? 0 : a.isCurrent ? -1 : 1))
        })
        const currentNow = computed(() => (snapshot.value ? snapshot.value.currentNow : null))
        const lastError = computed(() => (snapshot.value ? snapshot.value.lastError : null))
        const candidates = computed(() => (snapshot.value ? snapshot.value.candidates : []))
        const lastSwitchText = computed(() => {
          const ls = snapshot.value ? snapshot.value.lastSwitch : null
          return ls ? `${ls.from} → ${ls.to}` : ''
        })
        return {
          isRunning,
          currentNow,
          lastError,
          candidates,
          lastSwitchText,
          rows,
          columns,
          handleStart() {
            try {
              start()
            } catch (error) {
              Plugins.message.error(error.message || String(error))
            }
          },
          handleStop() {
            stop()
          }
        }
      }
    }
    const modal = Plugins.modal(
      {
        title: Plugin.name,
        maskClosable: true,
        submit: false,
        width: '85',
        height: '85',
        cancelText: 'common.close'
      },
      { default: () => h(component) }
    )
    return modal
  }

  return {
    onRun() {
      createUI().open()
    },
    onCoreStarted() {
      try {
        start()
      } catch (error) {
        console.warn(`[${Plugin.name}]`, '核心启动后开始监控失败', error)
      }
    },
    onCoreStopped() {
      stop()
    },
    onShutdown() {
      disposed = true
      stop()
    },
    onDispose() {
      disposed = true
      stop()
    },
    onUninstall() {
      disposed = true
      stop()
      try {
        Plugins.RemoveFile(stateFile)
      } catch (error) {
        console.warn(`[${Plugin.name}]`, '清理状态文件失败', error)
      }
    },
    onConfigure() {
      stop()
      try {
        start()
      } catch (error) {
        console.warn(`[${Plugin.name}]`, '配置变更后重启失败', error)
      }
    },
    Start() {
      return start()
    },
    Stop() {
      return stop()
    }
  }
}
