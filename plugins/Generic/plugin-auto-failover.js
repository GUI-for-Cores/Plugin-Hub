/* 节点自动切换：监听内核日志，策略组的当前节点连接失败达到阈值后切换到下一个节点 */

const BUILTIN_NAMES = ['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE', 'direct', 'block', 'dns-out']
const BUILTIN_TYPES = ['direct', 'reject', 'rejectdrop', 'pass', 'compatible', 'block', 'dns']
const SELECTOR_TYPE = 'selector'
const HISTORY_LIMIT = 100
const FAILURE_LIMIT = 50
const DEDUPE_MS = 3000
const PROXIES_TTL_MS = 3000
const PROBE_LIMIT = 20
const SETTLE_MS = 5000

// mihomo: [TCP] dial 🐟 Fallback (match Match/) 127.0.0.1:52264 --> www.google.com:443 error: ...
const MIHOMO_DIAL_RE = /^\[(TCP|UDP)\] dial (.+?) (?:\(match [^)]*\) )?(\S+) --> (\S+) error: (.+)$/
// sing-box: [3246033587 2ms] connection: open connection to www.google.com:443 using outbound/selector[🚀 Select]: dial tcp ...
const SINGBOX_PREFIX_RE = /^\[(\d+) [^\]]*\] (.*)$/
const SINGBOX_USING_RE = /open (?:packet )?connection to (\S+) using outbound\/(\w+)\[(.+?)\]: (.+)$/
const SINGBOX_OUTBOUND_RE = /outbound\/(\w+)\[(.+?)\]: (.+)$/
const SINGBOX_LEAF_RE = /^outbound\/(\w+)\[(.+?)\]: outbound (?:packet )?connection to (\S+)/

const FAILURE_RE =
  /connection refused|connection reset|reset by peer|i\/o timeout|timed? ?out|deadline exceeded|\bEOF\b|handshake|no route to host|network is unreachable|host is unreachable|connect error|dial .*failed|connect to .* failed|failed to connect|authentication failed|unexpected response|bad status|tls: /i
const IGNORE_RE = /context canceled|operation was canceled|use of closed network connection|connection (?:upload|download) closed/i

/** @type {EsmPlugin} */
export default (plugin) => {
  const reactive = globalThis.Vue ? globalThis.Vue.reactive : (v) => v

  const state = reactive({
    running: false,
    startedAt: 0,
    core: '',
    matched: 0,
    history: [],
    failures: []
  })

  let unregisterLogs = null
  let proxiesAt = 0
  const pending = new Map() // group -> [{ at, member }]
  const lastSwitchAt = new Map() // group -> ms
  const switching = new Set()
  const seen = new Map() // dedupe signature -> ms
  const singboxLeaf = new Map() // connection id -> leaf outbound tag

  /* 配置 */
  const configText = (key, fallback = '') => {
    const raw = plugin[key]
    if (typeof raw === 'string') return raw.trim() || fallback
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw).trim() || fallback
    return fallback
  }
  const configNumber = (key, fallback, min = 0) => {
    const n = Number(configText(key, String(fallback)))
    return Number.isFinite(n) && n >= min ? n : fallback
  }
  const configBool = (key, fallback) => (typeof plugin[key] === 'boolean' ? plugin[key] : fallback)
  const configList = (key) => (Array.isArray(plugin[key]) ? plugin[key].map((v) => String(v).trim()).filter(Boolean) : [])

  const settings = () => ({
    targets: configList('TargetGroups'),
    threshold: configNumber('Threshold', 3, 1),
    windowMs: configNumber('WindowSeconds', 60, 1) * 1000,
    cooldownMs: configNumber('CooldownSeconds', 30, 0) * 1000,
    skipFailed: configBool('SkipFailed', true),
    testBefore: configBool('TestBeforeSwitch', true),
    testUrl: configText('TestUrl', 'https://www.gstatic.com/generate_204'),
    testTimeout: configNumber('TestTimeout', 3000, 100),
    excludeBuiltin: configBool('ExcludeBuiltin', true),
    wrapAround: configBool('WrapAround', true),
    notify: configBool('NotifyOnSwitch', true)
  })

  /* 内核数据 */
  const kernel = () => Plugins.useKernelApiStore()

  const loadProxies = async (force = false) => {
    if (force || Date.now() - proxiesAt > PROXIES_TTL_MS) {
      await kernel().refreshProviderProxies()
      proxiesAt = Date.now()
    }
    return kernel().proxies || {}
  }

  const isGroup = (p) => !!p && Array.isArray(p.all)
  const isSelector = (p) => isGroup(p) && String(p.type).toLowerCase() === SELECTOR_TYPE
  const isBuiltin = (name, proxies) => BUILTIN_NAMES.includes(name) || BUILTIN_TYPES.includes(String(proxies[name]?.type || '').toLowerCase())

  const resolveChain = (start, proxies) => {
    const path = []
    let name = start
    while (isGroup(proxies[name]) && proxies[name].now && !path.includes(name) && path.length < 16) {
      path.push(name)
      name = proxies[name].now
    }
    return { path, leaf: name }
  }

  // 在链路中找到要切换的选择器组，以及它当前选中的成员
  const pickTarget = (start, proxies, targets) => {
    const { path, leaf } = resolveChain(start, proxies)
    const selectors = path.filter((g) => isSelector(proxies[g]) && (g !== 'GLOBAL' || path[0] === 'GLOBAL'))
    const allowed = targets.length ? selectors.filter((g) => targets.includes(g)) : selectors
    const group = allowed[allowed.length - 1]
    if (!group) return null
    return { group, member: proxies[group].now, leaf, path }
  }

  // sing-box 只报出叶子节点时，反查当前选中它的选择器组
  const groupsSelecting = (leaf, proxies, targets) =>
    Object.keys(proxies).filter((g) => isSelector(proxies[g]) && proxies[g].now === leaf && g !== 'GLOBAL' && (!targets.length || targets.includes(g)))

  /* 日志解析 */
  const parseLog = (payload) => {
    if (typeof payload !== 'string' || !payload) return null

    const m = payload.match(MIHOMO_DIAL_RE)
    if (m) {
      const [, network, start, source, destination, error] = m
      return { core: 'mihomo', start, leaf: '', destination, error, sig: `${network}|${start}|${source}|${destination}` }
    }

    const p = payload.match(SINGBOX_PREFIX_RE)
    if (!p) return null
    const [, id, body] = p
    const leafLine = body.match(SINGBOX_LEAF_RE)
    if (leafLine) {
      if (singboxLeaf.size > 2000) singboxLeaf.delete(singboxLeaf.keys().next().value)
      singboxLeaf.set(id, leafLine[2])
      return { core: 'sing-box', info: true }
    }
    const using = body.match(SINGBOX_USING_RE)
    if (using) {
      const [, destination, , start, error] = using
      return { core: 'sing-box', start, leaf: singboxLeaf.get(id) || '', destination, error, sig: `sb|${id}` }
    }
    const outbound = body.match(SINGBOX_OUTBOUND_RE)
    if (outbound && !/^outbound connection to/.test(outbound[3])) {
      const [, , start, error] = outbound
      return { core: 'sing-box', start, leaf: singboxLeaf.get(id) || start, destination: '', error, sig: `sb|${id}` }
    }
    return null
  }

  const isFailure = (error) => FAILURE_RE.test(error) && !IGNORE_RE.test(error)

  const isDuplicate = (sig, now) => {
    for (const [k, t] of seen) if (now - t > DEDUPE_MS) seen.delete(k)
    if (seen.has(sig)) return true
    seen.set(sig, now)
    return false
  }

  const pushLimited = (list, item, limit) => {
    list.unshift(item)
    if (list.length > limit) list.length = limit
  }

  /* 候选节点 */
  const lastDelayFailed = (name, proxies) => {
    const history = proxies[name]?.history
    if (!Array.isArray(history) || history.length === 0) return false
    return !(history[history.length - 1].delay > 0)
  }

  const controller = () => {
    const profile = Plugins.useProfilesStore().currentProfile
    const fromClash = profile?.advancedConfig
    const fromBox = profile?.experimental?.clash_api
    const address = (fromClash ? fromClash['external-controller'] : fromBox?.external_controller) || ''
    const secret = (fromClash ? fromClash.secret : fromBox?.secret) || ''
    const fallback = fromClash ? '127.0.0.1:20113' : '127.0.0.1:20123'
    const host = (address || fallback).replace(/^0\.0\.0\.0(?=:)/, '127.0.0.1').replace(/^:/, '127.0.0.1:')
    return { base: `http://${host}`, secret }
  }

  const testDelay = async (name, proxies, s) => {
    const { base, secret } = controller()
    const provider = proxies[name]?.provider
    const path = provider
      ? `/providers/proxies/${encodeURIComponent(provider)}/${encodeURIComponent(name)}/healthcheck`
      : `/proxies/${encodeURIComponent(name)}/delay`
    const url = `${base}${path}?url=${encodeURIComponent(s.testUrl)}&timeout=${s.testTimeout}`
    const headers = secret ? { Authorization: `Bearer ${secret}` } : {}
    try {
      const { status, body } = await Plugins.HttpGet(url, headers, { Proxy: '', Timeout: Math.ceil(s.testTimeout / 1000) + 2 })
      return status === 200 && body?.delay > 0 ? body.delay : 0
    } catch {
      return 0
    }
  }

  const findNext = async (group, failed, proxies, s) => {
    const members = proxies[group].all
    const start = members.indexOf(failed)
    const ordered = []
    for (let i = 1; i < members.length; i++) {
      const index = start + i
      if (!s.wrapAround && index >= members.length) break
      ordered.push(members[index % members.length])
    }
    let probes = 0
    for (const name of ordered) {
      if (name === failed) continue
      if (s.excludeBuiltin && isBuiltin(name, proxies)) continue
      if (s.skipFailed && lastDelayFailed(name, proxies)) continue
      if (!s.testBefore) return { name, delay: null }
      if (probes++ >= PROBE_LIMIT) break
      const delay = await testDelay(name, proxies, s)
      if (delay > 0) return { name, delay }
    }
    return null
  }

  /* 切换 */
  const switchGroup = async (group, failed, reason, count, s) => {
    switching.add(group)
    try {
      const proxies = await loadProxies(true)
      const current = proxies[group]
      if (!isSelector(current) || current.now !== failed) return // 已被手动或其它途径切换
      const next = await findNext(group, failed, proxies, s)
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        time: new Date().toLocaleString(),
        group,
        from: failed,
        to: next ? next.name : '',
        delay: next?.delay ?? '',
        count,
        reason
      }
      if (next) {
        await Plugins.handleUseProxy(current, { name: next.name })
        proxiesAt = 0
      }
      lastSwitchAt.set(group, Date.now())
      pending.delete(group)
      pushLimited(state.history, record, HISTORY_LIMIT)
      if (s.notify) {
        const body = next ? `${group}：${failed} → ${next.name}` : `${group}：${failed} 连接失败，没有可用的候选节点`
        Plugins.Notify(plugin.name, body).catch(() => {})
      }
    } catch (err) {
      console.log(`[${plugin.name}] switch`, err)
    } finally {
      switching.delete(group)
    }
  }

  const handleLog = async (log) => {
    if (!state.running || !log) return
    const parsed = parseLog(log.payload)
    if (!parsed) return
    state.core = parsed.core
    if (parsed.info || !isFailure(parsed.error)) return

    const now = Date.now()
    if (isDuplicate(parsed.sig, now)) return

    const s = settings()
    const proxies = await loadProxies()

    let target = null
    if (isGroup(proxies[parsed.start])) {
      target = pickTarget(parsed.start, proxies, s.targets)
      // sing-box 给出了实际出站节点：与当前链路不一致说明是切换前的旧连接
      if (target && parsed.leaf && parsed.leaf !== target.leaf) return
    } else {
      const group = groupsSelecting(parsed.start, proxies, s.targets).pop()
      if (group) target = { group, member: parsed.start, leaf: parsed.start }
    }
    if (!target || isBuiltin(target.leaf, proxies) || isBuiltin(target.member, proxies)) return
    // 冷却期内不计数：mihomo 日志不带实际节点，切换前发起的连接可能稍后才报错
    if (now - (lastSwitchAt.get(target.group) || 0) < Math.max(s.cooldownMs, SETTLE_MS)) return

    state.matched++
    pushLimited(
      state.failures,
      {
        id: `${now}-${state.matched}`,
        time: new Date(now).toLocaleTimeString(),
        group: target.group,
        node: target.leaf,
        destination: parsed.destination,
        error: parsed.error
      },
      FAILURE_LIMIT
    )

    const list = (pending.get(target.group) || []).filter((f) => now - f.at <= s.windowMs && f.member === target.member)
    list.push({ at: now, member: target.member })
    pending.set(target.group, list)

    if (list.length < s.threshold) return
    if (switching.has(target.group)) return
    await switchGroup(target.group, target.member, parsed.error, list.length, s)
  }

  /* 启停 */
  const Start = async () => {
    if (unregisterLogs) return 1
    unregisterLogs = kernel().onLogs((log) => {
      handleLog(log).catch((err) => console.log(`[${plugin.name}] log`, err))
    })
    state.running = true
    state.startedAt = Date.now()
    plugin.status = 1
    return 1
  }

  const Stop = async () => {
    if (unregisterLogs) {
      unregisterLogs()
      unregisterLogs = null
    }
    state.running = false
    pending.clear()
    seen.clear()
    singboxLeaf.clear()
    switching.clear()
    plugin.status = 2
    return 2
  }

  /* 状态面板 */
  const openPanel = () => {
    const { defineComponent, computed, h, resolveComponent } = Vue

    const component = defineComponent({
      template: /* html */ `
      <div class="flex flex-col gap-8">
        <Card title="状态">
          <div class="flex items-center gap-8 px-8 py-8 text-12">
            <Tag :color="state.running ? 'green' : 'default'">{{ state.running ? '运行中' : '已停止' }}</Tag>
            <span>内核：{{ state.core || '未识别' }}</span>
            <span>目标组：{{ targetText }}</span>
            <span>阈值：{{ ruleText }}</span>
          </div>
        </Card>
        <Card title="切换记录">
          <Table v-if="state.history.length" :columns="historyColumns" :data-source="state.history" />
          <Empty v-else description="还没有发生切换" />
        </Card>
        <Card title="最近的连接失败">
          <Table v-if="state.failures.length" :columns="failureColumns" :data-source="state.failures" />
          <Empty v-else description="没有匹配到连接失败日志" />
        </Card>
      </div>`,
      setup(_, { expose }) {
        const s = settings()
        const targetText = s.targets.length ? s.targets.join('、') : '自动（链路中最内层的选择器）'
        const ruleText = `${s.windowMs / 1000} 秒内失败 ${s.threshold} 次，冷却 ${s.cooldownMs / 1000} 秒`
        const historyColumns = [
          { title: '时间', key: 'time', minWidth: '140px' },
          { title: '策略组', key: 'group' },
          { title: '原节点', key: 'from' },
          { title: '新节点', key: 'to', customRender: ({ value }) => value || '无可用节点' },
          { title: '延迟', key: 'delay', align: 'center', customRender: ({ value }) => (value ? `${value}ms` : '-') },
          { title: '原因', key: 'reason' }
        ]
        const failureColumns = [
          { title: '时间', key: 'time' },
          { title: '策略组', key: 'group' },
          { title: '节点', key: 'node' },
          { title: '目标', key: 'destination' },
          { title: '错误', key: 'error' }
        ]
        const toggle = async () => {
          plugin.status = state.running ? await Stop() : await Start()
        }
        const clear = () => {
          state.history.splice(0)
          state.failures.splice(0)
        }
        const running = computed(() => state.running)
        expose({
          modalSlots: {
            toolbar: () => [
              h(resolveComponent('Button'), { type: 'text', onClick: clear }, () => '清空记录'),
              h(resolveComponent('Button'), { type: 'text', onClick: toggle }, () => (running.value ? '停止监听' : '开始监听'))
            ]
          }
        })
        return { state, targetText, ruleText, historyColumns, failureColumns }
      }
    })

    const modal = Plugins.modal({ title: plugin.name, width: '80', height: '80', submit: false, cancelText: '关闭', maskClosable: true })
    modal.setContent(component).open()
  }

  /* 触发器 手动触发 */
  const onRun = async () => {
    if (!state.running) await Start()
    openPanel()
    return 1
  }

  /* 触发器 应用就绪后 */
  const onReady = async () => {
    if (configBool('AutoStart', true)) return Start()
  }

  /* 触发器 核心启动后 */
  const onCoreStarted = async () => {
    proxiesAt = 0
    pending.clear()
    singboxLeaf.clear()
  }

  /* 触发器 关闭应用时 */
  const onShutdown = async () => Stop()

  /* 触发器 插件销毁时 */
  const onDispose = async () => {
    await Stop()
  }

  /* 触发器 安装插件时 */
  const onInstall = async () => 0

  /* 触发器 卸载插件时 */
  const onUninstall = async () => 0

  // 仅供测试工具使用
  const __test = { state, parseLog, handleLog, settings }

  return { onRun, onReady, onCoreStarted, onShutdown, onDispose, onInstall, onUninstall, Start, Stop, __test }
}
