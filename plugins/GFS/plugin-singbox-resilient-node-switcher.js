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
    realProbeMinSuccesses: 2,
    realProbeTimeoutMs: 8000,
    // 盯梢期（切换后快速检测）真实探测用更短超时，尽快发现「切到的节点其实慢/不通」
    realStalkTimeoutMs: 3000,
    realSlowThreshold: 2,
    // 真实探测单飞间隔：正常期每 realProbeIntervalMs 发起一次真实 GET，独立于 HEAD 快探周期
    realProbeIntervalMs: 15000,
    // 盯梢期退出阈值：真实 GET 连续 realStalkSuccessThreshold 次达标（延迟 ≤ realDelayMs）才退出盯梢
    realStalkSuccessThreshold: 2,
    // 事件时间线环形队列上限：详细事件仅保留在内存最近 N 条，state.json 只存聚合计数
    eventLogLimit: 50,
    scanIntervalMs: 10000,
    scanMainPoolSize: 20,
    scanExplorePoolSize: 5,
    scanScoreMax: 100,
    scanScoreInitial: 80,
    scanScoreHighThreshold: 90,
    scanScoreMediumThreshold: 80,
    scanScoreLowThreshold: 70,
    scanBackoffRounds: 6,
    scanSuccessStep: 5,
    scanFailureStep: 15,
    scanHttp503Step: 10,
    scanHttp504Step: 15,
    scanTimeoutStep: 20,
    scanRealFailureStep: 25,
    scanSlowStep: 5,
    foregroundReserved: 2,
    backgroundConcurrency: 3,
    backgroundBatchSize: 3,
    backgroundRoundDeadlineMs: 300000,
    backgroundBackoffMs: 30000,
    stabilityMode: 'stable-first',
    stabilityWindowMs: 600000,
    stabilityMaxSamples: 20,
    stabilityHeadMinSamples: 5,
    stabilityRealMinSamples: 3,
    stabilityRealLatencyMinSamples: 5,
    realStabilityProbeBudget: 3,
    stableSwitchRounds: 3,
    stabilitySwitchMargin: 8,
    latencySwitchMargin: 0.35,
    optimizeDwellMs: 300000,
    optimizeCooldownMs: 600000
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
    'realProbeTimeoutMs',
    'realStalkTimeoutMs',
    'realProbeIntervalMs',
    'scanIntervalMs',
    'backgroundRoundDeadlineMs',
    'backgroundBackoffMs',
    'stabilityWindowMs',
    'stabilitySwitchMargin',
    'latencySwitchMargin',
    'optimizeDwellMs',
    'optimizeCooldownMs'
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
    'realSlowThreshold',
    'realProbeMinSuccesses',
    'realStalkSuccessThreshold',
    'eventLogLimit',
    'scanIntervalMs',
    'foregroundReserved',
    'backgroundConcurrency',
    'backgroundBatchSize',
    'scanMainPoolSize',
    'scanExplorePoolSize',
    'scanScoreMax',
    'scanScoreInitial',
    'scanScoreHighThreshold',
    'scanScoreMediumThreshold',
    'scanScoreLowThreshold',
    'scanBackoffRounds',
    'scanSuccessStep',
    'scanFailureStep',
    'scanHttp503Step',
    'scanHttp504Step',
    'scanTimeoutStep',
    'scanRealFailureStep',
    'scanSlowStep',
    'stabilityMaxSamples',
    'stabilityHeadMinSamples',
    'stabilityRealMinSamples',
    'stabilityRealLatencyMinSamples',
    'realStabilityProbeBudget',
    'stableSwitchRounds'
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
    config.realProbeMinSuccesses = Math.min(config.realProbeMinSuccesses, config.realProbeUrls.length)
    config.realProbeEnabled = typeof source.realProbeEnabled === 'boolean' ? source.realProbeEnabled : DEFAULT_CONFIG.realProbeEnabled
    config.stabilityMode =
      source.stabilityMode === 'latency-first' || source.stabilityMode === 'stable-first' ? source.stabilityMode : DEFAULT_CONFIG.stabilityMode
    config.poolFailureRateThreshold = normalizePoolFailureRateThreshold(source.poolFailureRateThreshold, DEFAULT_CONFIG.poolFailureRateThreshold)

    const scoreOrderValid =
      config.scanScoreMax >= config.scanScoreHighThreshold &&
      config.scanScoreHighThreshold >= config.scanScoreMediumThreshold &&
      config.scanScoreMediumThreshold >= config.scanScoreLowThreshold &&
      config.scanScoreInitial <= config.scanScoreMax
    if (!scoreOrderValid) {
      config.scanScoreMax = DEFAULT_CONFIG.scanScoreMax
      config.scanScoreInitial = DEFAULT_CONFIG.scanScoreInitial
      config.scanScoreHighThreshold = DEFAULT_CONFIG.scanScoreHighThreshold
      config.scanScoreMediumThreshold = DEFAULT_CONFIG.scanScoreMediumThreshold
      config.scanScoreLowThreshold = DEFAULT_CONFIG.scanScoreLowThreshold
    }

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

  // ---- src/runtime-model.js ----
  function assertFiniteTimestamp(value, field) {
    if (!Number.isFinite(value)) throw new TypeError(`${field} must be a finite number`)
  }

  function stableIdentity(tag) {
    if (typeof tag !== 'string') return tag
    const match = tag.match(/^(.*?)\s*\|\s*\d+(?:\.\d+)?ms\b/)
    return match ? match[1].trim() : tag
  }

  function topologyFingerprint(members, memberTypes) {
    const identities = members
      .map((tag) => [stableIdentity(tag), memberTypes[tag] ?? null])
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
    return JSON.stringify(identities)
  }

  function createTopologySnapshot(members, memberTypes, now, checkedAt) {
    if (!Array.isArray(members)) throw new TypeError('members must be an array')
    if (!memberTypes || typeof memberTypes !== 'object') throw new TypeError('memberTypes must be an object')
    assertFiniteTimestamp(checkedAt, 'checkedAt')
    return {
      members: [...members],
      memberTypes: { ...memberTypes },
      now,
      checkedAt,
      topologyFingerprint: topologyFingerprint(members, memberTypes)
    }
  }

  function cloneCandidate(candidate) {
    if (!candidate || typeof candidate !== 'object') throw new TypeError('candidate must be an object')
    if (typeof candidate.tag !== 'string' || typeof candidate.stableKey !== 'string') {
      throw new TypeError('candidate tag and stableKey are required')
    }
    if (!Number.isFinite(candidate.delay) || candidate.delay < 0) throw new TypeError('candidate delay must be finite and non-negative')
    assertFiniteTimestamp(candidate.checkedAt, 'candidate.checkedAt')
    return {
      tag: candidate.tag,
      stableKey: candidate.stableKey,
      delay: candidate.delay,
      checkedAt: candidate.checkedAt
    }
  }

  function createCandidateSnapshot({ generation, createdAt, expiresAt, topologyFingerprint: fingerprint, candidates }) {
    if (!Number.isInteger(generation) || generation < 0) throw new TypeError('generation must be a non-negative integer')
    assertFiniteTimestamp(createdAt, 'createdAt')
    assertFiniteTimestamp(expiresAt, 'expiresAt')
    if (expiresAt <= createdAt) throw new RangeError('expiresAt must be greater than createdAt')
    if (typeof fingerprint !== 'string' || !fingerprint) throw new TypeError('topologyFingerprint is required')
    if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array')
    return {
      generation,
      createdAt,
      expiresAt,
      topologyFingerprint: fingerprint,
      candidates: candidates.map(cloneCandidate)
    }
  }

  function isCandidateSnapshotFresh(snapshot, now) {
    return Boolean(
      snapshot &&
      Number.isFinite(now) &&
      Number.isFinite(snapshot.createdAt) &&
      Number.isFinite(snapshot.expiresAt) &&
      now >= snapshot.createdAt &&
      now < snapshot.expiresAt
    )
  }

  function isTopologyMatch(snapshot, fingerprint) {
    return Boolean(snapshot && typeof fingerprint === 'string' && snapshot.topologyFingerprint === fingerprint)
  }

  function createCorrelationId(prefix, counter) {
    if (typeof prefix !== 'string' || !prefix) throw new TypeError('prefix is required')
    if (!Number.isInteger(counter) || counter < 0) throw new TypeError('counter must be a non-negative integer')
    return `${prefix}-${counter}`
  }

  // ---- src/candidate-store.js ----

  function createCandidateStore({ clock = Date } = {}) {
    const time = clock && typeof clock.now === 'function' ? clock : Date
    let topologyFingerprint = null
    let snapshot = null

    return {
      setTopology(fingerprint) {
        topologyFingerprint = fingerprint
      },

      getSnapshot() {
        return snapshot
      },

      publish(next) {
        if (!next || !isTopologyMatch(next, topologyFingerprint)) return false
        if (snapshot && next.generation <= snapshot.generation) return false
        snapshot = next
        return true
      },

      getUsableCandidates({ now = time.now(), topologyFingerprint: expected, allowExpired = false } = {}) {
        if (!snapshot) return { candidates: [], requiresRecheck: false, rejectionReason: 'missing' }
        if (!isTopologyMatch(snapshot, expected)) return { candidates: [], requiresRecheck: false, rejectionReason: 'requested-topology-mismatch' }
        if (!isTopologyMatch(snapshot, topologyFingerprint)) return { candidates: [], requiresRecheck: false, rejectionReason: 'store-topology-mismatch' }
        const fresh = isCandidateSnapshotFresh(snapshot, now)
        if (!fresh && !allowExpired) return { candidates: [], requiresRecheck: false, rejectionReason: 'expired' }
        return {
          candidates: snapshot.candidates.map((candidate) => ({ ...candidate })),
          requiresRecheck: !fresh,
          generation: snapshot.generation,
          snapshot,
          rejectionReason: null
        }
      }
    }
  }

  // ---- src/runtime-state.js ----
  function cloneRuntimeState(value) {
    if (value === undefined) return undefined
    return JSON.parse(JSON.stringify(value))
  }

  function createRuntimeState(initial = {}) {
    return {
      revision: Number.isInteger(initial.revision) && initial.revision >= 0 ? initial.revision : 0,
      currentNow: initial.currentNow ?? null,
      lastSwitch: cloneRuntimeState(initial.lastSwitch) ?? null,
      lastError: cloneRuntimeState(initial.lastError) ?? null,
      candidateSnapshot: cloneRuntimeState(initial.candidateSnapshot) ?? null,
      nodeStates: cloneRuntimeState(initial.nodeStates) ?? {},
      stalking: Boolean(initial.stalking),
      diagnostics: cloneRuntimeState(initial.diagnostics) ?? {}
    }
  }

  function applyRuntimeEvent(state, event) {
    if (!state || !event || typeof event.type !== 'string') return state
    const next = createRuntimeState(state)
    next.revision = state.revision + 1
    if (event.type === 'switch.succeeded') {
      next.currentNow = event.to ?? next.currentNow
      next.lastSwitch = {
        at: event.at,
        from: event.from ?? null,
        to: event.to ?? null,
        switchId: event.switchId ?? null,
        requestId: event.requestId ?? null,
        reason: event.reason ?? 'unknown',
        priority: event.priority ?? null,
        candidateGeneration: event.candidateGeneration ?? null,
        candidateDelay: event.candidateDelay ?? null,
        candidateRecheck: event.candidateRecheck ?? false
      }
      next.lastError = null
    } else if (event.type === 'switch.failed') {
      next.lastError = { at: event.at, reason: event.reason ?? 'switch failed', switchId: event.switchId ?? null, requestId: event.requestId ?? null }
    } else if (event.type === 'scan.completed') {
      next.diagnostics.lastScan = {
        scanId: event.scanId ?? null,
        at: event.at,
        durationMs: event.durationMs,
        published: Boolean(event.published)
      }
    } else if (event.type === 'candidate.published') {
      next.candidateSnapshot = cloneRuntimeState(event.snapshot) ?? null
    } else if (event.type === 'node.state') {
      if (typeof event.tag === 'string') next.nodeStates[event.tag] = cloneRuntimeState(event.nodeState)
    } else if (event.type === 'stalking.changed') {
      next.stalking = Boolean(event.stalking)
    }
    return next
  }

  // ---- src/scan-policy.js ----
  const DEFAULT_SCORE = 80

  function positiveInteger(value, fallback) {
    return Number.isInteger(value) && value >= 0 ? value : fallback
  }

  function stateFor(states, tag, config) {
    if (!states.has(tag)) {
      states.set(tag, {
        tag,
        score: config.scanScoreInitial,
        consecutiveFailures: 0,
        lastProbeAt: null,
        lastSuccessAt: null,
        nextProbeAt: 0,
        round: 0
      })
    }
    return states.get(tag)
  }

  function intervalFor(score, config) {
    if (score >= config.scanScoreHighThreshold) return 1
    if (score >= config.scanScoreMediumThreshold) return 2
    if (score >= config.scanScoreLowThreshold) return 3
    return config.scanBackoffRounds
  }

  function failurePenalty(reason, config) {
    const text = String(reason || '').toLowerCase()
    if (text.includes('503')) return config.scanHttp503Step
    if (text.includes('504')) return config.scanHttp504Step
    if (text.includes('timeout')) return config.scanTimeoutStep
    return config.scanFailureStep
  }

  function createScanPolicy({ config, clock = Date } = {}) {
    if (!config) throw new TypeError('config is required')
    const time = clock && typeof clock.now === 'function' ? clock : Date
    const states = new Map()
    let round = 0
    let cursor = 0

    function recordProbe({ tag, ok, delay, real = false, slow = false, reason, now = time.now() }) {
      const state = stateFor(states, tag, config)
      state.lastProbeAt = now
      state.round = round
      if (ok) {
        state.consecutiveFailures = 0
        state.lastSuccessAt = now
        state.score = Math.min(config.scanScoreMax, state.score + (slow ? config.scanSlowStep : config.scanSuccessStep))
      } else {
        state.consecutiveFailures += 1
        const penalty = real ? config.scanRealFailureStep : failurePenalty(reason, config)
        state.score = Math.max(0, state.score - penalty)
      }
      state.nextProbeAt = now + intervalFor(state.score, config) * config.scanIntervalMs
      return { ...state }
    }

    function getState(tag) {
      const state = states.get(tag)
      return state ? { ...state } : null
    }

    function snapshot() {
      return { round, cursor, states: [...states].map(([tag, state]) => [tag, { ...state }]) }
    }

    function restore(snapshotState) {
      if (!snapshotState || !Array.isArray(snapshotState.states)) return
      round = snapshotState.round
      cursor = snapshotState.cursor
      states.clear()
      for (const [tag, state] of snapshotState.states) states.set(tag, { ...state })
    }

    function selectTargets({ tags = [], currentNow = null, candidateTags = [], now = time.now() } = {}) {
      round += 1
      const uniqueTags = [...new Set(tags)]
      const forced = []
      const addForced = (tag) => {
        if (tag && uniqueTags.includes(tag) && !forced.includes(tag)) forced.push(tag)
      }
      addForced(currentNow)
      for (const tag of candidateTags) addForced(tag)

      const eligible = uniqueTags
        .filter((tag) => !forced.includes(tag))
        .map((tag) => stateFor(states, tag, config))
        .filter((state) => state.nextProbeAt <= now && (state.lastProbeAt === null || round - state.round >= intervalFor(state.score, config)))
        .sort((left, right) => right.score - left.score || (left.lastProbeAt ?? -Infinity) - (right.lastProbeAt ?? -Infinity))

      const main = eligible.slice(0, config.scanMainPoolSize).map((state) => state.tag)
      const remaining = eligible.filter((state) => !main.includes(state.tag))
      const exploreSize = Math.min(config.scanExplorePoolSize, remaining.length)
      const explore = []
      for (let index = 0; index < exploreSize; index += 1) {
        explore.push(remaining[(cursor + index) % remaining.length].tag)
      }
      if (remaining.length > 0) cursor = (cursor + exploreSize) % remaining.length
      return [...forced, ...main, ...explore]
    }

    return { recordProbe, getState, snapshot, restore, selectTargets }
  }

  // ---- src/stability-score.js ----
  function finite(value) {
    return Number.isFinite(value)
  }

  function cloneStabilityScore(value) {
    if (value === undefined) return undefined
    return JSON.parse(JSON.stringify(value))
  }

  function percentile(values, rank) {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1))
    return sorted[index]
  }

  function median(values) {
    if (!values.length) return null
    const sorted = [...values].sort((a, b) => a - b)
    const middle = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  }

  function normalizeStabilityConfig(config = {}) {
    return {
      stabilityWindowMs: Number.isFinite(config.stabilityWindowMs) && config.stabilityWindowMs > 0 ? config.stabilityWindowMs : 600000,
      stabilityMaxSamples: Number.isInteger(config.stabilityMaxSamples) && config.stabilityMaxSamples > 0 ? config.stabilityMaxSamples : 20,
      headMinSamples: Number.isInteger(config.headMinSamples) && config.headMinSamples > 0 ? config.headMinSamples : 5,
      realMinSamples: Number.isInteger(config.realMinSamples) && config.realMinSamples > 0 ? config.realMinSamples : 3,
      realLatencyMinSamples: Number.isInteger(config.realLatencyMinSamples) && config.realLatencyMinSamples > 0 ? config.realLatencyMinSamples : 5
    }
  }

  function createStabilityScore({ config = {}, clock = Date } = {}) {
    const cfg = normalizeStabilityConfig(config)
    const nodes = new Map()

    function ensure(stableKey) {
      if (typeof stableKey !== 'string' || !stableKey) throw new TypeError('stableKey is required')
      if (!nodes.has(stableKey)) nodes.set(stableKey, { stableKey, head: [], real: [], consecutiveFailures: 0 })
      return nodes.get(stableKey)
    }

    function prune(node, at) {
      const cutoff = at - cfg.stabilityWindowMs
      node.head = node.head.filter((sample) => sample.at >= cutoff).slice(-cfg.stabilityMaxSamples)
      node.real = node.real.filter((sample) => sample.at >= cutoff).slice(-cfg.stabilityMaxSamples)
    }

    function record(kind, sample = {}) {
      const { stableKey, tag, delay, ok, at = clock.now(), error = null } = sample
      if (typeof tag !== 'string' || typeof stableKey !== 'string' || !finite(at)) throw new TypeError('tag, stableKey and at are required')
      const node = ensure(stableKey)
      const entry = { tag, stableKey, delay: finite(delay) && delay >= 0 ? delay : null, ok: ok === true, at, error: error ?? null }
      node[kind].push(entry)
      node[kind] = node[kind].slice(-cfg.stabilityMaxSamples)
      if (entry.ok) node.consecutiveFailures = 0
      else node.consecutiveFailures += 1
      prune(node, at)
      return getSummary(stableKey, at)
    }

    function getSummary(stableKey, now = clock.now()) {
      const node = nodes.get(stableKey)
      if (!node) return null
      prune(node, now)
      const headSuccesses = node.head.filter((sample) => sample.ok).length
      const realSuccesses = node.real.filter((sample) => sample.ok).length
      const successfulLatencies = node.real.filter((sample) => sample.ok && finite(sample.delay)).map((sample) => sample.delay)
      const p50 = median(successfulLatencies)
      const p95 = percentile(successfulLatencies, 0.95)
      const eligible =
        node.head.length >= cfg.headMinSamples && node.real.length >= cfg.realMinSamples && successfulLatencies.length >= cfg.realLatencyMinSamples
      const headRate = node.head.length ? headSuccesses / node.head.length : 0
      const realRate = node.real.length ? realSuccesses / node.real.length : 0
      const volatility = p50 && p95 !== null ? Math.max(0, Math.min(1, 1 - (p95 / p50 - 1))) : 0
      const failurePenalty = Math.min(1, node.consecutiveFailures / 5)
      const score = Math.round(Math.max(0, Math.min(100, headRate * 40 + realRate * 30 + volatility * 20 + (1 - failurePenalty) * 10)))
      return {
        stableKey,
        score,
        headSamples: node.head.length,
        realSamples: node.real.length,
        realSuccesses,
        successfulLatencies: [...successfulLatencies],
        median: p50,
        p95,
        eligibility: eligible ? 'eligible' : 'insufficient-real-samples',
        consecutiveFailures: node.consecutiveFailures
      }
    }

    function getAllSummaries(now = clock.now()) {
      return [...nodes.keys()].map((stableKey) => getSummary(stableKey, now))
    }

    return {
      recordHead: (sample) => record('head', sample),
      recordReal: (sample) => record('real', sample),
      getSummary,
      getAllSummaries,
      isEligible: (stableKey, now = clock.now()) => getSummary(stableKey, now)?.eligibility === 'eligible',
      compare: (left, right) => (left?.score ?? -1) - (right?.score ?? -1),
      snapshot: () => cloneStabilityScore([...nodes.values()]),
      restore: (snapshot) => {
        if (
          !Array.isArray(snapshot) ||
          snapshot.some((node) => !node || typeof node.stableKey !== 'string' || !Array.isArray(node.head) || !Array.isArray(node.real))
        ) {
          nodes.clear()
          return false
        }
        nodes.clear()
        for (const node of snapshot) nodes.set(node.stableKey, cloneStabilityScore(node))
        return true
      }
    }
  }

  // ---- src/optimization-policy.js ----
  function cloneOptimizationPolicy(value) {
    if (value === undefined) return undefined
    return JSON.parse(JSON.stringify(value))
  }

  function positive(value, fallback) {
    return Number.isFinite(value) && value >= 0 ? value : fallback
  }

  function createOptimizationPolicy({ config = {}, clock = Date } = {}) {
    const cfg = {
      stabilityMode: config.stabilityMode === 'latency-first' ? 'latency-first' : 'stable-first',
      stableSwitchRounds: Number.isInteger(config.stableSwitchRounds) && config.stableSwitchRounds > 0 ? config.stableSwitchRounds : 3,
      stabilitySwitchMargin: positive(config.stabilitySwitchMargin, 8),
      latencySwitchMargin: positive(config.latencySwitchMargin, 0.35),
      optimizeDwellMs: positive(config.optimizeDwellMs, 300000),
      optimizeCooldownMs: positive(config.optimizeCooldownMs, 600000)
    }
    let streak = null
    let dwellUntil = 0
    const cooldowns = new Map()

    function nowValue(value) {
      return Number.isFinite(value) ? value : clock.now()
    }

    function resetStreak() {
      streak = null
    }

    function evaluate({
      current,
      candidates = [],
      generation,
      topologyFingerprint,
      now,
      mode = cfg.stabilityMode,
      reason = 'optimize',
      failureProtectionUntil = 0
    } = {}) {
      const at = nowValue(now)
      if (reason === 'failure' || reason === 'fault') return { kind: 'none', reason: 'fault-priority', candidate: null }
      if (Number.isFinite(failureProtectionUntil) && at < failureProtectionUntil) {
        resetStreak()
        return { kind: 'none', reason: 'failure-protection', candidate: null }
      }
      if (at < dwellUntil) return { kind: 'none', reason: 'optimize-dwell', candidate: null }

      const candidate = [...candidates]
        .filter((item) => item && item.eligibility === 'eligible' && Number.isFinite(item.score) && Number.isFinite(item.delay))
        .filter((item) => (cooldowns.get(item.stableKey || item.tag) || 0) <= at)
        .sort((left, right) => left.delay - right.delay || right.score - left.score)[0]
      if (!candidate) {
        resetStreak()
        return { kind: 'none', reason: 'insufficient-stability-samples', candidate: null }
      }
      const currentScore = Number.isFinite(current?.score) ? current.score : null
      const currentDelay = Number.isFinite(current?.delay) ? current.delay : null
      if (currentScore === null || currentDelay === null) {
        resetStreak()
        return { kind: 'none', reason: 'insufficient-current-samples', candidate: null }
      }

      const scoreImproved = candidate.score - currentScore >= cfg.stabilitySwitchMargin
      const latencyImproved = currentDelay > 0 && candidate.delay <= currentDelay * (1 - cfg.latencySwitchMargin)
      const eligible = mode === 'latency-first' ? latencyImproved || scoreImproved : scoreImproved || (candidate.score >= currentScore && latencyImproved)
      const key = `${candidate.stableKey || candidate.tag}|${generation}|${topologyFingerprint}`
      if (!eligible) {
        resetStreak()
        return { kind: 'none', reason: 'stability-margin-not-met', candidate: null }
      }
      if (!streak || streak.key !== key) streak = { key, stableKey: candidate.stableKey || candidate.tag, generation, topologyFingerprint, rounds: 0 }
      streak.rounds += 1
      if (streak.rounds < cfg.stableSwitchRounds) {
        return { kind: 'none', reason: 'stable-rounds-pending', candidate: null }
      }
      return { kind: 'optimize', reason: 'stable-threshold-met', candidate: cloneOptimizationPolicy(candidate) }
    }

    function recordResult({ kind, candidate, ok, at } = {}) {
      const now = nowValue(at)
      if (kind !== 'optimize' || !candidate) return
      const key = candidate.stableKey || candidate.tag
      if (ok) {
        dwellUntil = now + cfg.optimizeDwellMs
        resetStreak()
      } else {
        cooldowns.set(key, now + cfg.optimizeCooldownMs)
        resetStreak()
      }
    }

    return {
      evaluate,
      recordResult,
      snapshot: () => cloneOptimizationPolicy({ streak, dwellUntil, cooldowns: [...cooldowns.entries()] }),
      restore: (snapshot) => {
        if (!snapshot || !Array.isArray(snapshot.cooldowns)) {
          streak = null
          dwellUntil = 0
          cooldowns.clear()
          return false
        }
        streak = snapshot.streak ? cloneOptimizationPolicy(snapshot.streak) : null
        dwellUntil = Number.isFinite(snapshot.dwellUntil) ? snapshot.dwellUntil : 0
        cooldowns.clear()
        for (const [key, until] of snapshot.cooldowns) if (typeof key === 'string' && Number.isFinite(until)) cooldowns.set(key, until)
        return true
      }
    }
  }

  // ---- src/scheduler-model.js ----
  const DEFAULTS = Object.freeze({
    totalConcurrency: 5,
    foregroundReserved: 2,
    backgroundConcurrency: 3,
    backgroundBatchSize: 3,
    backgroundRoundDeadlineMs: 300000,
    backgroundBackoffMs: 30000
  })

  function positive(value, fallback) {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
  }

  function copy(state) {
    return { ...state, backgroundTargets: [...state.backgroundTargets] }
  }

  function createSchedulerState(config = {}) {
    const cfg = { ...DEFAULTS, ...(config || {}) }
    const foregroundReserved = positive(cfg.foregroundReserved, DEFAULTS.foregroundReserved)
    const totalConcurrency = positive(cfg.totalConcurrency, DEFAULTS.totalConcurrency)
    const backgroundConcurrency = Math.min(
      positive(cfg.backgroundConcurrency, DEFAULTS.backgroundConcurrency),
      Math.max(1, totalConcurrency - foregroundReserved)
    )
    return {
      totalConcurrency,
      foregroundReserved,
      backgroundConcurrency,
      backgroundBatchSize: positive(cfg.backgroundBatchSize, DEFAULTS.backgroundBatchSize),
      backgroundRoundDeadlineMs: positive(cfg.backgroundRoundDeadlineMs, DEFAULTS.backgroundRoundDeadlineMs),
      backgroundBackoffMs: positive(cfg.backgroundBackoffMs, DEFAULTS.backgroundBackoffMs),
      foregroundInFlight: 0,
      backgroundInProgress: false,
      backgroundRound: 0,
      backgroundCursor: 0,
      backgroundTargets: [],
      backgroundTopologyFingerprint: null,
      backgroundStartedAt: null,
      backgroundTimeouts: 0,
      backgroundNextStartAt: 0
    }
  }

  function reserveForeground(state, amount = 1) {
    const next = copy(state)
    const requested = positive(amount, 1)
    if (next.foregroundInFlight + requested > next.foregroundReserved) {
      return { accepted: false, reason: 'foreground-budget-exhausted', state: next }
    }
    next.foregroundInFlight += requested
    return { accepted: true, state: next }
  }

  function releaseForeground(state, amount = 1) {
    const next = copy(state)
    next.foregroundInFlight = Math.max(0, next.foregroundInFlight - positive(amount, 1))
    return next
  }

  function beginBackgroundRound(state, { topologyFingerprint = null, now = Date.now() } = {}) {
    const next = copy(state)
    if (next.backgroundInProgress) return { accepted: false, reason: 'in-progress', state: next }
    if (now < next.backgroundNextStartAt) return { accepted: false, reason: 'backoff', state: next }
    next.backgroundInProgress = true
    next.backgroundTargets = []
    next.backgroundTopologyFingerprint = topologyFingerprint
    next.backgroundStartedAt = now
    return { accepted: true, state: next }
  }

  function setBackgroundTargets(state, { targets = [], topologyFingerprint = null } = {}) {
    const next = copy(state)
    if (!next.backgroundInProgress) return { accepted: false, reason: 'not-in-progress', state: next }
    next.backgroundTargets = [...targets]
    next.backgroundTopologyFingerprint = topologyFingerprint
    return { accepted: true, state: next }
  }

  function startBackgroundBatch(state, { targets = [], topologyFingerprint = null, now = Date.now() } = {}) {
    const started = beginBackgroundRound(state, { topologyFingerprint, now })
    if (!started.accepted) return started
    const updated = setBackgroundTargets(started.state, { targets, topologyFingerprint })
    const next = updated.state
    const startIndex = Math.min(next.backgroundCursor, targets.length)
    const batch = targets.slice(startIndex, startIndex + next.backgroundBatchSize)
    return { accepted: true, state: next, batch: { targets: batch, topologyFingerprint, startedAt: now } }
  }

  function finishBackgroundBatch(state, { now = Date.now(), completed = false, topologyFingerprint = null } = {}) {
    const next = copy(state)
    if (!next.backgroundInProgress) return { published: false, reason: 'not-in-progress', state: next }
    const valid = completed && topologyFingerprint === next.backgroundTopologyFingerprint
    next.backgroundInProgress = false
    next.backgroundTargets = []
    next.backgroundStartedAt = null
    if (!valid) return { published: false, reason: 'incomplete-or-stale', state: next }
    next.backgroundRound += 1
    next.backgroundCursor = 0
    next.backgroundNextStartAt = now
    return { published: true, state: next }
  }

  function expireBackgroundRound(state, { now = Date.now(), cursor = state.backgroundCursor } = {}) {
    const next = copy(state)
    if (!next.backgroundInProgress) return { published: false, reason: 'not-in-progress', state: next }
    next.backgroundInProgress = false
    next.backgroundCursor = Math.max(0, cursor)
    next.backgroundTargets = []
    next.backgroundStartedAt = null
    next.backgroundTimeouts += 1
    next.backgroundNextStartAt = now + next.backgroundBackoffMs
    return { published: false, reason: 'deadline', state: next }
  }

  // ---- src/switch-coordinator.js ----

  function stableKey(tag) {
    if (typeof tag !== 'string') return tag
    const match = tag.match(/^(.*?)\s*\|\s*\d+(?:\.\d+)?ms\b/)
    return match ? match[1].trim() : tag
  }

  function createSwitchCoordinator({
    api,
    config,
    clock = Date,
    logger = {},
    candidateStore,
    observeCurrent,
    realProbe,
    probeCandidate = null,
    fallback = null,
    onNowConfirmed = null,
    onConfirmed = null,
    onDiagnostic = null
  }) {
    if (!api || typeof api.select !== 'function' || typeof api.getProxies !== 'function') throw new TypeError('api select/getProxies are required')
    if (!candidateStore || typeof candidateStore.getSnapshot !== 'function') throw new TypeError('candidateStore is required')
    if (typeof observeCurrent !== 'function') throw new TypeError('observeCurrent is required')
    if (typeof realProbe !== 'function') throw new TypeError('realProbe is required')
    const time = clock && typeof clock.now === 'function' ? clock : Date
    let stopped = false
    let serial = 0
    let active = null
    let pending = null
    let waitingKey = null
    let waitingGeneration = null

    function result(ok, fields = {}) {
      return { ok, ...fields }
    }

    async function selectNode(tag) {
      return api.select(config.selectorName, tag)
    }

    async function execute(request) {
      const requestId = createCorrelationId('request', ++serial)
      const switchId = createCorrelationId('switch', serial)
      const before = observeCurrent()
      if (!before?.now) return result(false, { reason: 'current node unavailable', requestId, switchId })
      const priority = Number.isFinite(request?.priority) ? request.priority : request?.reason === 'failure' ? 10 : 1
      const snapshot = candidateStore.getSnapshot()
      const currentKey = stableKey(before.now)
      if (waitingKey === currentKey && waitingGeneration === (snapshot?.generation ?? null)) {
        return result(false, { reason: 'no-available-node', requestId, switchId })
      }
      const allowExpired = request?.reason === 'failure' || priority >= 10
      const selection = candidateStore.getUsableCandidates({
        now: time.now(),
        topologyFingerprint: snapshot?.topologyFingerprint,
        allowExpired
      })
      if (!selection.candidates.length) {
        if (typeof fallback === 'function' && priority >= 10) {
          const fallbackTag = await fallback({ current: before.now, request, requestId, switchId })
          if (stableKey(fallbackTag) === stableKey(before.now)) {
            waitingKey = currentKey
            waitingGeneration = snapshot?.generation ?? null
            return result(false, { reason: 'no-available-node', requestId, switchId })
          }
          if (typeof fallbackTag === 'string') {
            await selectNode(fallbackTag)
            const confirmed = await api.getProxies()
            const now = confirmed?.proxies?.[config.selectorName]?.now
            if (stableKey(now) === stableKey(fallbackTag)) {
              waitingKey = null
              waitingGeneration = null
              await onNowConfirmed?.(now)
              await onConfirmed?.({
                from: before.now,
                to: fallbackTag,
                requestId,
                switchId,
                reason: request?.reason ?? 'unknown',
                priority,
                candidateGeneration: null,
                candidateDelay: null,
                candidateRecheck: false,
                at: time.now(),
                fallback: true
              })
              return result(true, {
                node: fallbackTag,
                requestId,
                switchId,
                fallback: true,
                priority,
                candidateGeneration: null,
                candidateDelay: null,
                candidateRecheck: false
              })
            }
          }
        }
        return result(false, { reason: 'candidate snapshot unavailable', requestId, switchId })
      }
      const candidates = selection.candidates
        .filter((candidate) => stableKey(candidate.tag) !== stableKey(before.now))
        .slice(0, Number(config?.preSwitchMaxProbe) || selection.candidates.length)
      const candidateGeneration = snapshot?.generation ?? null
      let recheckedCount = 0
      let successfulCount = 0
      let failedCount = 0
      let fallbackAttempted = false
      const emitDiagnostic = async (outcome) => {
        await onDiagnostic?.({
          type: 'switch-diagnostic',
          requestId,
          switchId,
          reason: request?.reason ?? 'unknown',
          priority,
          candidateGeneration,
          allowExpired,
          requiresRecheck: Boolean(selection.requiresRecheck),
          candidateCount: candidates.length,
          recheckedCount,
          successfulCount,
          failedCount,
          fallbackAttempted,
          result: outcome
        })
      }
      const priorityValue = priority
      let allowedCurrent = before.now
      let confirmationFailed = false
      const failedCandidateKeys = new Set()
      for (const candidate of candidates) {
        const candidateKey = stableKey(candidate.tag)
        if (failedCandidateKeys.has(candidateKey)) continue
        const observed = observeCurrent()
        if (stableKey(observed?.now) !== stableKey(allowedCurrent)) {
          return result(false, { reason: 'current node changed', requestId, switchId })
        }
        try {
          if (typeof probeCandidate === 'function') {
            recheckedCount += 1
            const probe = await probeCandidate(candidate.tag, request)
            if (!probe?.ok) {
              failedCount += 1
              failedCandidateKeys.add(candidateKey)
              continue
            }
          }
          // 唯一的 Selector PUT 调用点：切换后立即确认 now，再用真实 GET 验证目标。
          await selectNode(candidate.tag)
          const confirmed = await api.getProxies()
          const now = confirmed?.proxies?.[config.selectorName]?.now
          if (stableKey(now) !== stableKey(candidate.tag)) {
            confirmationFailed = true
            logger.warn?.(`switch confirmation mismatch: expected ${candidate.tag}, got ${now}`)
            continue
          }
          await onNowConfirmed?.(now)
          allowedCurrent = now
          successfulCount += 1
          if (config.realProbeEnabled !== false) {
            const checked = await realProbe(candidate.tag, { timeoutMs: config.realStalkTimeoutMs ?? config.realProbeTimeoutMs })
            if (!checked?.ok) {
              failedCandidateKeys.add(candidateKey)
              logger.warn?.(`candidate real probe failed: ${candidate.tag}: ${checked?.reason || 'unknown'}`)
              continue
            }
          }
          const afterProbe = observeCurrent()
          if (stableKey(afterProbe?.now) !== stableKey(before.now) && stableKey(afterProbe?.now) !== stableKey(allowedCurrent)) {
            return result(false, { reason: 'current node changed', requestId, switchId })
          }
          await onConfirmed?.({
            from: before.now,
            to: candidate.tag,
            requestId,
            switchId,
            reason: request?.reason ?? 'unknown',
            priority: priorityValue,
            candidateGeneration,
            candidateDelay: candidate.delay ?? null,
            candidateRecheck: true,
            at: time.now(),
            fallback: false
          })
          return result(true, {
            node: candidate.tag,
            requestId,
            switchId,
            requiresRecheck: Boolean(selection.requiresRecheck),
            priority: priorityValue,
            candidateGeneration,
            candidateDelay: candidate.delay ?? null,
            candidateRecheck: true
          })
        } catch (error) {
          logger.warn?.(`switch candidate failed: ${candidate.tag}: ${error?.message || error}`)
        }
      }
      if (typeof fallback === 'function' && priority >= 10) {
        fallbackAttempted = true
        const fallbackTag = await fallback({ current: before.now, request, requestId, switchId })
        if (stableKey(fallbackTag) === stableKey(before.now)) {
          waitingKey = currentKey
          waitingGeneration = snapshot?.generation ?? null
          return result(false, { reason: 'no-available-node', requestId, switchId })
        }
        if (typeof fallbackTag === 'string') {
          try {
            await selectNode(fallbackTag)
            const confirmed = await api.getProxies()
            const now = confirmed?.proxies?.[config.selectorName]?.now
            if (stableKey(now) === stableKey(fallbackTag)) {
              waitingKey = null
              waitingGeneration = null
              await onNowConfirmed?.(now)
              await onConfirmed?.({
                from: before.now,
                to: fallbackTag,
                requestId,
                switchId,
                reason: request?.reason ?? 'unknown',
                priority,
                candidateGeneration: null,
                candidateDelay: null,
                candidateRecheck: false,
                at: time.now(),
                fallback: true
              })
              return result(true, {
                node: fallbackTag,
                requestId,
                switchId,
                fallback: true,
                priority,
                candidateGeneration: null,
                candidateDelay: null,
                candidateRecheck: false
              })
            }
          } catch (error) {
            logger.warn?.(`fallback switch failed: ${fallbackTag}: ${error?.message || error}`)
          }
        }
      }
      await emitDiagnostic(confirmationFailed ? 'confirmation-failed' : 'all-candidates-failed')
      return result(false, { reason: confirmationFailed ? 'switch confirmation failed' : 'all candidates failed', requestId, switchId })
    }

    function startEntry(entry) {
      entry.promise = execute(entry.request)
        .then(
          (value) => {
            entry.resolve?.(value)
            return value
          },
          (error) => {
            entry.reject?.(error)
            throw error
          }
        )
        .finally(() => {
          if (active?.promise === entry.promise) {
            active = null
            if (pending) {
              const next = pending
              pending = null
              startEntry(next)
            }
          }
        })
      active = entry
      return entry.promise
    }

    function requestSwitch(request = {}) {
      if (stopped) return Promise.resolve(result(false, { reason: 'stopped' }))
      const observed = observeCurrent()
      const key = `${stableKey(observed?.now)}:${request.reason || 'unknown'}`
      if (active && active.key === key) return active.promise
      if (active) {
        if ((request.priority ?? 0) <= active.priority) return active.promise
        if (pending) {
          if ((request.priority ?? 0) <= pending.priority) return pending.promise
          pending.resolve?.(result(false, { reason: 'superseded' }))
        }
        let resolve
        let reject
        const promise = new Promise((res, rej) => {
          resolve = res
          reject = rej
        })
        pending = { request, key, priority: request.priority ?? 0, promise, resolve, reject }
        return promise
      }
      return startEntry({ request, key, priority: request.priority ?? 0 })
    }

    function stop() {
      stopped = true
      pending = null
      return { stopped: true }
    }

    return { requestSwitch, stop }
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
    let currentUrlTestGroup = null
    let currentNow = null
    let lastObservedNow = null
    let currentStartAt = null
    let lastError = null
    let lastSwitch = null
    let candidates = []
    const candidateStore = createCandidateStore({ clock: time })
    const scanPolicy = createScanPolicy({ config: cfg, clock: time })
    const stabilityScore = createStabilityScore({
      config: {
        stabilityWindowMs: cfg.stabilityWindowMs,
        stabilityMaxSamples: cfg.stabilityMaxSamples,
        headMinSamples: cfg.stabilityHeadMinSamples,
        realMinSamples: cfg.stabilityRealMinSamples,
        realLatencyMinSamples: cfg.stabilityRealLatencyMinSamples
      },
      clock: time
    })
    const optimizationPolicy = createOptimizationPolicy({ config: cfg, clock: time })
    let stabilityCandidateProbeCount = 0
    let candidateGeneration = 0
    let topologyFingerprint = null
    let running = false
    let watchInProgress = false
    let watchRerunRequested = false
    let watchStopped = false
    let poolInProgress = false
    let watchTimer = null
    let poolTimer = null
    let watchController = null
    let poolController = null
    let backgroundDeadlineTimer = null
    let switchCoordinator = null
    let schedulerState = createSchedulerState({
      totalConcurrency: cfg.foregroundReserved + cfg.backgroundConcurrency,
      foregroundReserved: cfg.foregroundReserved,
      backgroundConcurrency: cfg.backgroundConcurrency,
      backgroundBatchSize: cfg.backgroundBatchSize,
      backgroundRoundDeadlineMs: cfg.backgroundRoundDeadlineMs,
      backgroundBackoffMs: cfg.backgroundBackoffMs
    })

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
    let lastScanStartedAt = null
    let lastScanDurationMs = null
    let lastScanTargetCount = 0
    let lastScanRound = 0
    let lastBatchDiagnostics = null
    let lastTimeoutReason = 'none'
    // 盯梢期：切换后短窗口内快速失败快速切换，待新节点稳定后退出
    let stalking = false
    let stalkingSuccessCount = 0
    let stalkTimer = null
    // 真实探测单飞：真实 GET 独立于 HEAD 快探周期，单飞避免并发堆积；
    // generation 用于丢弃「节点已变化/已切换」后的过期结果
    let realProbeInFlight = false
    let realProbeGeneration = 0
    let realProbeLastAt = 0
    let realProbeTimer = null
    let nativeHttpGetTail = Promise.resolve()
    function serializedHttpGet(url) {
      const request = nativeHttpGetTail.then(() => httpGetImpl(url))
      nativeHttpGetTail = request.catch(() => {})
      return request
    }
    // 真实 GET 失败/超慢后请求一次立即快探；消费后清除，避免失败时反复重入。
    let realSwitchRequested = false
    // 故障切换成功后的保护窗口：避免择优逻辑立即打断恢复过程。
    let failureProtectionUntil = 0
    // 事件时间线：内存环形队列，仅保留最近 eventLogLimit 条
    let eventLog = []
    let runtimeState = createRuntimeState()
    let correlationCounter = 0

    function applyEvent(type, fields = {}) {
      runtimeState = applyRuntimeEvent(runtimeState, { type, at: time.now(), ...fields })
    }

    function reserveForegroundSlot() {
      const result = reserveForeground(schedulerState, 1)
      if (result.accepted) schedulerState = result.state
      return result.accepted
    }

    async function getProxiesWithTimeout(signal, timeoutMs, label) {
      const controller = new AbortController()
      const forwardAbort = () => controller.abort(signal?.reason)
      if (signal?.aborted) forwardAbort()
      else signal?.addEventListener('abort', forwardAbort, { once: true })
      let timer = null
      try {
        return await Promise.race([
          api.getProxies(controller.signal),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              controller.abort(new DOMException(`${label} timeout`, 'TimeoutError'))
              reject(new Error(`${label} timeout`))
            }, timeoutMs)
          })
        ])
      } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', forwardAbort)
      }
    }

    function releaseForegroundSlot() {
      schedulerState = releaseForeground(schedulerState, 1)
    }

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

    // 多 URL 探测：真实 GET 串行执行，避免 GFS 原生请求桥并发占满；任一 URL 成功即返回 ok。
    // 全部失败则返回最后一个 URL 的失败结果，交由调用方判定。
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

    async function probeAnyWithTimeout(node, urls, timeoutMs, signal) {
      const controller = new AbortController()
      const forwardAbort = () => controller.abort(signal?.reason)
      if (signal?.aborted) forwardAbort()
      else signal?.addEventListener('abort', forwardAbort, { once: true })
      let timer = null
      try {
        return await Promise.race([
          probeAny(node, urls, timeoutMs, controller.signal),
          new Promise((resolve) => {
            timer = setTimeout(() => {
              controller.abort(new DOMException('watch probe timeout', 'TimeoutError'))
              resolve({ ok: false, result: { ok: false, reason: 'watch probe timeout' } })
            }, timeoutMs)
          })
        ])
      } finally {
        if (timer) clearTimeout(timer)
        signal?.removeEventListener('abort', forwardAbort)
      }
    }

    // 真实延迟多 URL 探测：并行用 httpGetImpl（native 层，走系统代理）发起真实 GET 并读 body。
    // 至少一个 URL 真实访问成功即返回「最慢延迟」（用户感知的是最慢的站点）；
    // 全部失败才返回失败（视为「HEAD 通但 GET 不通」的盲区）。
    async function realProbeAny(urls, timeoutMs, serializeNative = false) {
      if (!Array.isArray(urls) || urls.length === 0) {
        return { ok: false, result: null }
      }
      const results = []
      for (const url of urls) {
        try {
          // 外层软超时不能取消 GFS 原生请求；先等前一个原生请求真正结束，
          // 再启动下一个 URL，避免“上一个仍挂起、下一个已超时”的隐性并发。
          if (serializeNative) await nativeHttpGetTail
          results.push(await realProbe(url, timeoutMs, serializeNative ? serializedHttpGet : httpGetImpl))
        } catch (error) {
          results.push({ ok: false, reason: error?.message || String(error) })
        }
      }
      const successful = results.filter((result) => result && result.ok)
      let slowest = null
      for (const result of successful) {
        if (slowest === null || result.delay > slowest.delay) {
          slowest = result
        }
      }
      const minSuccesses = Math.min(Math.max(1, Number.isInteger(cfg.realProbeMinSuccesses) ? cfg.realProbeMinSuccesses : 1), urls.length)
      return {
        ok: successful.length >= minSuccesses,
        result: slowest,
        successCount: successful.length,
        requiredSuccesses: minSuccesses
      }
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

    function stabilitySnapshot() {
      const now = time.now()
      const currentSummary = currentNow ? stabilityScore.getSummary(stableKey(currentNow), now) : null
      return {
        current: currentSummary,
        candidates: stabilityScore.getAllSummaries(now),
        candidateProbes: stabilityCandidateProbeCount
      }
    }

    function optimizationInput(now) {
      const currentState = currentNow ? nodeStates.get(currentNow) : null
      const currentStability = currentNow ? stabilityScore.getSummary(stableKey(currentNow), now) : null
      const current = currentStability && currentState ? { ...currentStability, delay: currentState.lastDelay } : null
      const candidateInputs = candidates
        .map((tag) => {
          const state = nodeStates.get(tag)
          const summary = stabilityScore.getSummary(stableKey(tag), now)
          return summary && state ? { ...summary, tag, delay: state.lastDelay } : null
        })
        .filter(Boolean)
      return { current, candidates: candidateInputs }
    }

    function recordEvent(type, fields = {}) {
      eventLog.push({ type, at: time.now(), ...fields })
      if (eventLog.length > cfg.eventLogLimit) {
        eventLog = eventLog.slice(-cfg.eventLogLimit)
      }
    }

    function resetAfterConfirmedSwitch(from, to, now, fallback = false, metadata = {}) {
      const oldState = ensureNodeState(from)
      nodeStates.set(from, markCooldown(oldState, now, cfg))
      lastSwitch = {
        from,
        to,
        at: now,
        reason: metadata.reason ?? 'unknown',
        requestId: metadata.requestId ?? null,
        switchId: metadata.switchId ?? null,
        priority: metadata.priority ?? null,
        candidateGeneration: metadata.candidateGeneration ?? null,
        candidateDelay: metadata.candidateDelay ?? null,
        candidateRecheck: metadata.candidateRecheck ?? false
      }
      currentNow = to
      lastObservedNow = to
      currentStartAt = now
      watchBaseline = []
      watchFailureCount = 0
      watchDegradationCount = 0
      watchOptimizeCount = 0
      watchSlowCount = 0
      realSlowCount = 0
      realSwitchRequested = false
      realDelay = null
      failureProtectionUntil = metadata.reason === 'failure' ? now + cfg.optimizeDwellMs : 0
      stalking = true
      stalkingSuccessCount = 0
      realProbeGeneration += 1
      const switchId = createCorrelationId('switch', ++correlationCounter)
      applyEvent('switch.succeeded', {
        from,
        to,
        switchId: metadata.switchId ?? switchId,
        requestId: metadata.requestId ?? switchId,
        reason: metadata.reason ?? 'unknown',
        priority: metadata.priority ?? null,
        candidateGeneration: metadata.candidateGeneration ?? null,
        candidateDelay: metadata.candidateDelay ?? null,
        candidateRecheck: metadata.candidateRecheck ?? false
      })
      recordEvent('switch-confirmed', {
        from,
        to,
        fallback,
        switchId: metadata.switchId ?? switchId,
        requestId: metadata.requestId ?? switchId,
        reason: metadata.reason ?? 'unknown',
        priority: metadata.priority ?? null,
        candidateGeneration: metadata.candidateGeneration ?? null,
        candidateDelay: metadata.candidateDelay ?? null,
        candidateRecheck: metadata.candidateRecheck ?? false
      })
      scheduleStalkProbe()
    }

    switchCoordinator = createSwitchCoordinator({
      api,
      config: cfg,
      clock: time,
      logger: log,
      candidateStore,
      observeCurrent: () => ({ now: currentNow }),
      probeCandidate: async (tag, request = {}) => {
        const check = await probeAny(tag, probeUrlSequence(watchCycleCount + (request.attempt || 0)), cfg.watchTimeoutMs, watchController?.signal)
        return check
      },
      realProbe: async (_tag, options = {}) => {
        const check = await realProbeAny(cfg.realProbeUrls, options.timeoutMs || cfg.realStalkTimeoutMs)
        if (!check.ok || !check.result) return { ok: false, reason: '真实探测失败' }
        if (check.result.delay > cfg.realDelayMs) return { ok: false, delay: check.result.delay, reason: '真实延迟超过阈值' }
        return check.result
      },
      fallback: async ({ current }) => {
        if (currentUrlTestGroup && stableKey(currentUrlTestGroup) !== stableKey(current)) return current
        return (
          members.find((tag) => memberTypes[tag] === 'URLTest' && stableKey(tag) !== stableKey(current)) ||
          (memberTypes[current] === 'URLTest' ? current : null)
        )
      },
      onNowConfirmed: async (now) => {
        currentNow = now
      },
      onConfirmed: async ({ from, to, at, fallback, reason, requestId, switchId, priority, candidateGeneration, candidateDelay, candidateRecheck }) =>
        resetAfterConfirmedSwitch(from, to, at, fallback, {
          reason,
          requestId,
          switchId,
          priority,
          candidateGeneration,
          candidateDelay,
          candidateRecheck
        }),
      onDiagnostic: async (diagnostic) => recordEvent(diagnostic.type || 'switch-diagnostic', diagnostic)
    })

    // 单飞真实探测：真实 GET 走系统代理读 body 测真实延迟，覆盖 sing-box HEAD 探测盲区。
    // 独立于 HEAD 快探周期、不阻塞 watchCycle；结果绑定 stableKey + generation，
    // 节点已变化/切换后返回的过期结果直接丢弃。
    async function runRealProbe() {
      if (!cfg.realProbeEnabled || realProbeInFlight || currentNow == null) {
        return { skipped: true, stale: false }
      }
      if (!reserveForegroundSlot()) {
        recordEvent('foreground-budget-exhausted', { kind: 'real' })
        return { skipped: true, stale: false, reason: 'foreground-budget-exhausted' }
      }
      realProbeInFlight = true
      const generation = ++realProbeGeneration
      const targetKey = stableKey(currentNow)
      const isStalking = stalking
      const timeoutMs = isStalking ? cfg.realStalkTimeoutMs : cfg.realProbeTimeoutMs
      recordEvent('real-probe-start', { key: targetKey, generation, stalking: isStalking })
      try {
        const realResult = await realProbeAny(cfg.realProbeUrls, timeoutMs, true)
        // 过期丢弃：节点身份已变（外部切换/自动切换）或期间已启动新探测
        if (stableKey(currentNow) !== targetKey || generation !== realProbeGeneration) {
          recordEvent('real-probe-stale', { key: targetKey, generation })
          return { skipped: false, stale: true }
        }
        if (realResult.ok && realResult.result) {
          realDelay = realResult.result.delay
          stabilityScore.recordReal({
            tag: currentNow,
            stableKey: targetKey,
            delay: realDelay,
            ok: true,
            at: time.now()
          })
          if (realResult.result.delay > cfg.realDelayMs) {
            realSlowCount += 1
            if (realSlowCount >= cfg.realSlowThreshold) realSwitchRequested = true
          } else {
            realSlowCount = 0
            realSwitchRequested = false
            // 盯梢期：真实 GET 达标才累计，达到 realStalkSuccessThreshold 次退出盯梢
            if (stalking) {
              stalkingSuccessCount += 1
              if (stalkingSuccessCount >= cfg.realStalkSuccessThreshold) {
                stalking = false
                stalkingSuccessCount = 0
                recordEvent('stalk-exit', { key: targetKey })
                log.info('盯梢期结束，新节点真实可用')
              }
            }
          }
        } else {
          realDelay = null
          stabilityScore.recordReal({
            tag: currentNow,
            stableKey: targetKey,
            delay: null,
            ok: false,
            error: 'real probe failed',
            at: time.now()
          })
          realSlowCount += 1
          if (realSlowCount >= cfg.realSlowThreshold) realSwitchRequested = true
        }
        if (realSwitchRequested) {
          recordEvent('real-probe-switch-requested', { key: targetKey, realSlowCount })
          if (running) {
            scheduleStalkProbe()
          }
        }
        recordEvent('real-probe-result', { key: targetKey, generation, ok: realResult.ok, delay: realDelay, realSlowCount, stalking })
        return { skipped: false, stale: false, ok: realResult.ok }
      } finally {
        realProbeInFlight = false
        realProbeLastAt = time.now()
        releaseForegroundSlot()
      }
    }

    // 真实探测调度：setTimeout 链式，按是否盯梢动态调整间隔
    function scheduleRealProbe() {
      if (!running || !cfg.realProbeEnabled) return
      if (realProbeTimer) clearTimeout(realProbeTimer)
      const interval = stalking ? cfg.stalkProbeDelayMs : cfg.realProbeIntervalMs
      realProbeTimer = setTimeout(() => {
        realProbeTimer = null
        runRealProbe()
          .then(() => scheduleRealProbe())
          .catch((error) => {
            log.error('真实探测异常', error?.message || String(error))
            scheduleRealProbe()
          })
      }, interval)
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
        scanPolicy.recordProbe({ tag, ok: true, delay: result.delay, now })
        return { tag, probed: true, ok: true }
      }
      const reason = result?.reason || 'probe failed'
      nodeStates.set(tag, recordProbeFailure(nodeStates.get(tag), now, reason, cfg))
      scanPolicy.recordProbe({ tag, ok: false, reason, now })
      return { tag, probed: true, ok: false }
    }

    async function poolCycle() {
      if (poolInProgress) {
        return { skipped: true, error: null }
      }
      poolInProgress = true
      lastScanStartedAt = time.now()
      const cycleController = new AbortController()
      poolController = cycleController
      const startedBackground = beginBackgroundRound(schedulerState, { now: time.now() })
      if (!startedBackground.accepted) {
        poolInProgress = false
        poolController = null
        return { skipped: true, error: startedBackground.reason }
      }
      schedulerState = startedBackground.state
      const snapshotStates = new Map([...nodeStates].map(([k, v]) => [k, { ...v }]))
      const snapshotCandidates = [...candidates]
      const snapshotScanPolicy = scanPolicy.snapshot()
      const snapshotMembers = [...members]
      const snapshotMemberTypes = { ...memberTypes }
      const snapshotCurrentNow = currentNow
      const snapshotTopologyFingerprint = topologyFingerprint
      const snapshotCurrentUrlTestGroup = currentUrlTestGroup
      const restorePoolSnapshot = () => {
        nodeStates.clear()
        for (const [k, v] of snapshotStates) nodeStates.set(k, v)
        candidates = snapshotCandidates
        scanPolicy.restore(snapshotScanPolicy)
        members = snapshotMembers
        memberTypes = snapshotMemberTypes
        currentNow = snapshotCurrentNow
        topologyFingerprint = snapshotTopologyFingerprint
        currentUrlTestGroup = snapshotCurrentUrlTestGroup
      }
      let deadlineReached = false
      let rejectDeadline
      const deadlinePromise = new Promise((_, reject) => {
        rejectDeadline = reject
      })
      backgroundDeadlineTimer = setTimeout(() => {
        deadlineReached = true
        lastTimeoutReason = 'round-deadline'
        cycleController.abort()
        rejectDeadline(new DOMException('后台扫描轮次已到期', 'AbortError'))
      }, cfg.backgroundRoundDeadlineMs)

      try {
        let data
        try {
          data = await Promise.race([getProxiesWithTimeout(cycleController.signal, cfg.backgroundRoundDeadlineMs, '后台 Selector 读取'), deadlinePromise])
        } catch (error) {
          if (deadlineReached) {
            restorePoolSnapshot()
            return { skipped: true, error: null }
          }
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

        // 探测目标：评分策略控制后台预算；当前节点和候选始终强制保留，URLTest 不参与叶子探测。
        const policyTargets = scanPolicy.selectTargets({
          tags: members.filter((tag) => memberTypes[tag] !== 'URLTest'),
          currentNow,
          candidateTags: candidates,
          now: time.now()
        })
        const probeTargets = policyTargets.filter((tag) => tag !== currentNow && memberTypes[tag] !== 'URLTest')
        lastScanTargetCount = probeTargets.length
        lastScanRound = scanPolicy.snapshot().round
        const topology = createTopologySnapshot(members, memberTypes, currentNow, time.now())
        const scanTopologyFingerprint = topology.topologyFingerprint
        const targetState = setBackgroundTargets(schedulerState, {
          targets: probeTargets,
          topologyFingerprint: scanTopologyFingerprint
        })
        if (!targetState.accepted) {
          return { skipped: true, error: targetState.reason }
        }
        schedulerState = targetState.state
        const urls = probeUrlSequence(poolCycleCount)
        const results = []
        const batchSize = Math.min(schedulerState.backgroundBatchSize, schedulerState.backgroundConcurrency)
        for (let i = schedulerState.backgroundCursor; i < probeTargets.length; i += batchSize) {
          const batchStartedAt = time.now()
          let foregroundWaitMs = 0
          if (cycleController.signal.aborted) {
            schedulerState = expireBackgroundRound(schedulerState, { now: time.now(), cursor: i }).state
            restorePoolSnapshot()
            return { skipped: true, error: null }
          }
          if (schedulerState.foregroundInFlight > 0) {
            const waitStartedAt = time.now()
            await new Promise((resolve) => setTimeout(resolve, 10))
            foregroundWaitMs += Math.max(0, time.now() - waitStartedAt)
            if (cycleController.signal.aborted) {
              lastTimeoutReason = 'foreground-wait'
              lastBatchDiagnostics = {
                startedAt: batchStartedAt,
                durationMs: Math.max(0, time.now() - batchStartedAt),
                cursor: i,
                foregroundWaitMs,
                targetCount: 0,
                timeoutReason: lastTimeoutReason
              }
              schedulerState = expireBackgroundRound(schedulerState, { now: time.now(), cursor: i }).state
              restorePoolSnapshot()
              return { skipped: true, error: null }
            }
            i -= batchSize
            continue
          }
          schedulerState = { ...schedulerState, backgroundCursor: i }
          const batch = probeTargets.slice(i, i + batchSize)
          try {
            const batchResults = await Promise.all(batch.map((tag) => runPoolProbe(tag, cycleController.signal, urls)))
            if (cycleController.signal.aborted) {
              throw new DOMException('后台扫描轮次已到期', 'AbortError')
            }
            results.push(...batchResults)
            lastBatchDiagnostics = {
              startedAt: batchStartedAt,
              durationMs: Math.max(0, time.now() - batchStartedAt),
              cursor: i,
              foregroundWaitMs,
              targetCount: batch.length,
              timeoutReason: 'none'
            }
            lastTimeoutReason = 'none'
          } catch (error) {
            if (cycleController.signal.aborted) {
              lastTimeoutReason = foregroundWaitMs > 0 ? 'foreground-wait' : 'probe-batch'
              lastBatchDiagnostics = {
                startedAt: batchStartedAt,
                durationMs: Math.max(0, time.now() - batchStartedAt),
                cursor: i,
                foregroundWaitMs,
                targetCount: batch.length,
                timeoutReason: lastTimeoutReason
              }
              schedulerState = expireBackgroundRound(schedulerState, { now: time.now(), cursor: i }).state
              restorePoolSnapshot()
              return { skipped: true, error: null }
            }
            restorePoolSnapshot()
            throw error
          }
        }
        schedulerState = finishBackgroundBatch(schedulerState, {
          now: time.now(),
          completed: true,
          topologyFingerprint: topology.topologyFingerprint
        }).state

        // 全池失败熔断：实际探测节点失败率超过阈值则本轮作废
        const probed = results.filter((r) => r.probed)
        if (probed.length > 0) {
          const failures = probed.filter((r) => !r.ok).length
          const failureRate = failures / probed.length
          if (failureRate > cfg.poolFailureRateThreshold) {
            restorePoolSnapshot()
            schedulerState = finishBackgroundBatch(schedulerState, {
              now: time.now(),
              completed: false,
              topologyFingerprint: topology.topologyFingerprint
            }).state
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

        candidateStore.setTopology(scanTopologyFingerprint)
        const candidateSnapshot = createCandidateSnapshot({
          generation: candidateGeneration + 1,
          createdAt: time.now(),
          // 后台整轮可能超过刷新间隔；快照至少覆盖一轮截止时间，避免扫描期间误判过期。
          expiresAt: time.now() + Math.max(cfg.poolRefreshIntervalMs, cfg.backgroundRoundDeadlineMs),
          topologyFingerprint: topology.topologyFingerprint,
          candidates: candidates.map((tag) => {
            const state = nodeStates.get(tag)
            return { tag, stableKey: stableKey(tag), delay: state.lastDelay, checkedAt: state.lastProbeAt ?? time.now() }
          })
        })
        if (candidateStore.publish(candidateSnapshot)) {
          topologyFingerprint = scanTopologyFingerprint
          candidateGeneration = candidateSnapshot.generation
          const scanId = createCorrelationId('scan', ++correlationCounter)
          lastScanDurationMs = Math.max(0, time.now() - lastScanStartedAt)
          applyEvent('candidate.published', { snapshot: candidateSnapshot })
          applyEvent('scan.completed', {
            scanId,
            durationMs: lastScanDurationMs,
            targetCount: lastScanTargetCount,
            round: lastScanRound,
            published: true
          })
          recordEvent('scan-completed', {
            scanId,
            generation: candidateSnapshot.generation,
            candidateCount: candidates.length,
            targetCount: lastScanTargetCount,
            durationMs: lastScanDurationMs
          })
        }

        return { skipped: false, error: null }
      } finally {
        if (backgroundDeadlineTimer) {
          clearTimeout(backgroundDeadlineTimer)
          backgroundDeadlineTimer = null
        }
        if (schedulerState.backgroundInProgress) {
          schedulerState = expireBackgroundRound(schedulerState, {
            now: time.now(),
            cursor: schedulerState.backgroundCursor
          }).state
        }
        poolInProgress = false
        poolController = null
        poolCycleCount += 1
      }
    }

    async function watchCycle() {
      if (watchInProgress) {
        watchRerunRequested = true
        return { skipped: true, switchedTo: null, error: null }
      }
      if (!reserveForegroundSlot()) {
        recordEvent('foreground-budget-exhausted', { kind: 'watch' })
        return { skipped: true, switchedTo: null, error: 'foreground-budget-exhausted' }
      }
      watchInProgress = true
      const cycleController = new AbortController()
      watchController = cycleController

      try {
        let data
        try {
          data = await getProxiesWithTimeout(cycleController.signal, cfg.watchTimeoutMs, '前台 Selector 读取')
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
        currentUrlTestGroup =
          Object.entries(proxies).find(
            ([tag, proxy]) => proxy?.type === 'URLTest' && Array.isArray(proxy.all) && proxy.all.some((member) => stableKey(member) === stableKey(observedNow))
          )?.[0] || null

        // 外部变化检测：接受新选择，不切回旧节点；手动选择的新节点立即进入盯梢期
        // stableKey 忽略 GFS 实时测速追加的延迟/速度后缀，避免同一节点被反复重置。
        if (lastObservedNow !== null && stableKey(lastObservedNow) !== stableKey(observedNow)) {
          watchBaseline = []
          watchFailureCount = 0
          watchDegradationCount = 0
          watchOptimizeCount = 0
          watchSlowCount = 0
          realSlowCount = 0
          realSwitchRequested = false
          realDelay = null
          realProbeGeneration += 1 // 使在途真实探测结果过期
          stalking = true
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
        const probeResult = await probeAnyWithTimeout(observedNow, probeUrlSequence(watchCycleCount), cfg.watchTimeoutMs, cycleController.signal)
        const result = probeResult.ok ? probeResult.result : { ok: false, reason: probeResult.result?.reason || 'probe failed' }
        stabilityScore.recordHead({
          tag: observedNow,
          stableKey: stableKey(observedNow),
          delay: result?.delay ?? null,
          ok: result?.ok === true,
          error: result?.ok === true ? null : result?.reason || 'probe failed',
          at: now
        })

        if (result && result.ok) {
          watchBaseline.push(result.delay)
          if (watchBaseline.length > cfg.baselineWindow) {
            watchBaseline = watchBaseline.slice(-cfg.baselineWindow)
          }
          watchFailureCount = 0
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

        // 盯梢期内：失败 1 次即切、HEAD 高延迟 1 次即切、免驻留，尽快摆脱故障节点
        const effectiveFailureThreshold = stalking ? 1 : cfg.failureThreshold
        const effectiveSlowThreshold = stalking ? 1 : cfg.slowThreshold
        const effectiveMinDwellMs = stalking || realSwitchRequested ? 0 : cfg.minDwellMs
        const failureTriggered =
          watchFailureCount >= effectiveFailureThreshold ||
          watchDegradationCount >= cfg.degradationThreshold ||
          watchSlowCount >= effectiveSlowThreshold ||
          realSlowCount >= cfg.realSlowThreshold
        const optimization = optimizationPolicy.evaluate({
          ...optimizationInput(now),
          generation: candidateGeneration,
          topologyFingerprint: candidateStore.getSnapshot()?.topologyFingerprint || null,
          now,
          reason: failureTriggered ? 'failure' : 'optimize',
          failureProtectionUntil
        })
        // 在稳定性样本尚未满足资格时保留旧择优路径，避免把缺失真实样本伪装成稳定结论；
        // 具备资格后由新策略接管择优请求。故障条件始终独立计算，不受择优策略阻塞。
        const legacyOptimizeFallback =
          !failureTriggered &&
          optimization.kind === 'none' &&
          typeof optimization.reason === 'string' &&
          optimization.reason.startsWith('insufficient-') &&
          watchOptimizeCount >= cfg.optimizeThreshold
        const optimizeTriggered = !failureTriggered && (optimization.kind === 'optimize' || legacyOptimizeFallback)
        const shouldSwitch = failureTriggered || optimizeTriggered
        const dwellSatisfied = now >= (currentStartAt ?? now) + effectiveMinDwellMs

        if (shouldSwitch && dwellSatisfied) {
          const coordinated = await switchCoordinator.requestSwitch({
            reason: optimizeTriggered ? 'optimize' : 'failure',
            priority: optimizeTriggered ? 1 : 10,
            attempt: watchCycleCount
          })
          if (coordinated.ok) {
            if (optimizeTriggered && !failureTriggered && optimization.candidate) {
              optimizationPolicy.recordResult({ kind: 'optimize', candidate: optimization.candidate, ok: true, at: now })
            }
            return { skipped: false, switchedTo: coordinated.node, error: null }
          }
          if (coordinated.reason === 'candidate snapshot unavailable') {
            lastError = '候选池为空，等待通道 B 刷新'
          } else if (coordinated.reason === 'all candidates failed') {
            lastError = 'switch failed: all candidates failed'
          } else if (coordinated.reason === 'switch confirmation failed') {
            lastError = 'switch confirm failed'
          } else {
            lastError = coordinated.reason || 'switch failed'
          }
          if (coordinated.reason !== 'candidate snapshot unavailable') {
            watchFailureCount = 0
            watchDegradationCount = 0
            watchOptimizeCount = 0
            watchSlowCount = 0
            realSlowCount = 0
            realDelay = null
          }
          return { skipped: false, switchedTo: null, error: lastError }
        }

        return { skipped: false, switchedTo: null, error: lastError }
      } finally {
        watchInProgress = false
        watchController = null
        releaseForegroundSlot()
        watchCycleCount += 1
        if (watchRerunRequested) {
          watchRerunRequested = false
          queueMicrotask(() => {
            if (!watchStopped) watchCycle().catch((error) => log.error('补充快探轮次异常', error?.message || String(error)))
          })
        }
      }
    }

    function start() {
      if (running) return
      watchStopped = false
      running = true
      poolCycle().catch((error) => log.error('候选池预热异常', error?.message || String(error)))
      watchTimer = setInterval(() => {
        watchCycle().catch((error) => log.error('快探轮次异常', error?.message || String(error)))
      }, cfg.watchIntervalMs)
      poolTimer = setInterval(() => {
        poolCycle().catch((error) => log.error('候选池轮次异常', error?.message || String(error)))
      }, cfg.scanIntervalMs)
      scheduleRealProbe()
    }

    function stop() {
      watchStopped = true
      running = false
      if (watchTimer) {
        clearInterval(watchTimer)
        watchTimer = null
      }
      if (poolTimer) {
        clearInterval(poolTimer)
        poolTimer = null
      }
      if (backgroundDeadlineTimer) {
        clearTimeout(backgroundDeadlineTimer)
        backgroundDeadlineTimer = null
      }
      if (stalkTimer) {
        clearTimeout(stalkTimer)
        stalkTimer = null
      }
      if (realProbeTimer) {
        clearTimeout(realProbeTimer)
        realProbeTimer = null
      }
      stalking = false
      stalkingSuccessCount = 0
      realProbeGeneration += 1 // 使在途真实探测结果过期
      watchController?.abort()
      watchController = null
      poolController?.abort()
      poolController = null
      switchCoordinator?.stop()
    }

    function getSnapshot() {
      const states = {}
      const storedCandidateSnapshot = candidateStore.getSnapshot()
      const usableCandidates = candidateStore.getUsableCandidates({
        now: time.now(),
        topologyFingerprint,
        allowExpired: false
      })
      for (const [tag, state] of nodeStates) {
        states[tag] = { ...state }
      }
      return {
        selectorName: cfg.selectorName,
        revision: runtimeState.revision,
        diagnostics: {
          ...runtimeState.diagnostics,
          candidateGeneration,
          candidateCount: candidates.length,
          lastSwitchId: runtimeState.lastSwitch?.switchId ?? null,
          candidateSnapshot: {
            generation: storedCandidateSnapshot?.generation ?? null,
            expiresAt: storedCandidateSnapshot?.expiresAt ?? null,
            topologyFingerprint: storedCandidateSnapshot?.topologyFingerprint ?? topologyFingerprint,
            usableCandidateCount: usableCandidates.candidates.length,
            requiresRecheck: usableCandidates.requiresRecheck,
            rejectionReason: usableCandidates.rejectionReason ?? null
          },
          scan: {
            round: lastScanRound,
            targetCount: lastScanTargetCount,
            startedAt: lastScanStartedAt,
            durationMs: lastScanDurationMs,
            policy: scanPolicy.snapshot()
          },
          stability: stabilitySnapshot(),
          scheduler: {
            foregroundReserved: schedulerState.foregroundReserved,
            foregroundInFlight: schedulerState.foregroundInFlight,
            backgroundConcurrency: schedulerState.backgroundConcurrency,
            backgroundBatchSize: schedulerState.backgroundBatchSize,
            backgroundInProgress: schedulerState.backgroundInProgress,
            backgroundRound: schedulerState.backgroundRound,
            backgroundCursor: schedulerState.backgroundCursor,
            backgroundTargetCount: schedulerState.backgroundTargets.length,
            backgroundStartedAt: schedulerState.backgroundStartedAt,
            backgroundTimeouts: schedulerState.backgroundTimeouts,
            backgroundNextStartAt: schedulerState.backgroundNextStartAt,
            lastBatch: lastBatchDiagnostics ? { ...lastBatchDiagnostics } : null,
            lastTimeoutReason
          }
        },
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
        candidates: [...candidates],
        events: [...eventLog]
      }
    }

    return { start, stop, getSnapshot, watchCycle, poolCycle, runRealProbe }
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
      realProbeMinSuccesses: Number(Plugin.RealProbeMinSuccesses),
      realProbeTimeoutMs: Number(Plugin.RealProbeTimeoutMs),
      realStalkTimeoutMs: Number(Plugin.RealStalkTimeoutMs),
      realSlowThreshold: Number(Plugin.RealSlowThreshold),
      realProbeIntervalMs: Number(Plugin.RealProbeIntervalMs),
      realStalkSuccessThreshold: Number(Plugin.RealStalkSuccessThreshold),
      eventLogLimit: Number(Plugin.EventLogLimit),
      scanIntervalMs: Number(Plugin.ScanIntervalMs),
      scanMainPoolSize: Number(Plugin.ScanMainPoolSize),
      scanExplorePoolSize: Number(Plugin.ScanExplorePoolSize),
      scanScoreMax: Number(Plugin.ScanScoreMax),
      scanScoreInitial: Number(Plugin.ScanScoreInitial),
      scanScoreHighThreshold: Number(Plugin.ScanScoreHighThreshold),
      scanScoreMediumThreshold: Number(Plugin.ScanScoreMediumThreshold),
      scanScoreLowThreshold: Number(Plugin.ScanScoreLowThreshold),
      scanBackoffRounds: Number(Plugin.ScanBackoffRounds),
      scanSuccessStep: Number(Plugin.ScanSuccessStep),
      scanFailureStep: Number(Plugin.ScanFailureStep),
      scanHttp503Step: Number(Plugin.ScanHttp503Step),
      scanHttp504Step: Number(Plugin.ScanHttp504Step),
      scanTimeoutStep: Number(Plugin.ScanTimeoutStep),
      scanRealFailureStep: Number(Plugin.ScanRealFailureStep),
      scanSlowStep: Number(Plugin.ScanSlowStep),
      foregroundReserved: Number(Plugin.ForegroundReserved),
      backgroundConcurrency: Number(Plugin.BackgroundConcurrency),
      backgroundBatchSize: Number(Plugin.BackgroundBatchSize),
      backgroundRoundDeadlineMs: Number(Plugin.BackgroundRoundDeadlineMs),
      backgroundBackoffMs: Number(Plugin.BackgroundBackoffMs),
      stabilityMode: Plugin.StabilityMode,
      stabilityWindowMs: Number(Plugin.StabilityWindowMs),
      stabilityMaxSamples: Number(Plugin.StabilityMaxSamples),
      stabilityHeadMinSamples: Number(Plugin.StabilityHeadMinSamples),
      stabilityRealMinSamples: Number(Plugin.StabilityRealMinSamples),
      stabilityRealLatencyMinSamples: Number(Plugin.StabilityRealLatencyMinSamples),
      realStabilityProbeBudget: Number(Plugin.RealStabilityProbeBudget),
      stableSwitchRounds: Number(Plugin.StableSwitchRounds),
      stabilitySwitchMargin: Number(Plugin.StabilitySwitchMargin),
      latencySwitchMargin: Number(Plugin.LatencySwitchMargin),
      optimizeDwellMs: Number(Plugin.OptimizeDwellMs),
      optimizeCooldownMs: Number(Plugin.OptimizeCooldownMs)
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
        return {
          isRunning,
          currentNow,
          lastError,
          candidates,
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
    onStartup() {
      return start()
    },
    onReady() {
      return start()
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
