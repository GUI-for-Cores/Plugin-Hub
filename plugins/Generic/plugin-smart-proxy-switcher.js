/*
 * 实现动态代理选择机制，包含故障转移、断路器、EWMA 延迟跟踪、基于分数调度与滞后控制。
 * TODO: 解决切换配置未自动接管新的代理组
 */

/*
调整参数可用大语言模型提示词：
你是一个代理服务器调度系统的参数专家。我想要不同风格的调度参数配置。系统包括 EWMA、优先级、断路器、惩罚分机制和滞后控制（hysteresis）等策略。请只输出**与默认值不同的参数和注释**，格式如下：

{
  "参数名": 新值,
  "_参数名": "简洁说明"
}

默认值如下（用于参考）：  
ewmaAlpha: 0.3
failureThreshold: 3
circuitBreakerTimeout: 360000
penaltyIncrement: 5
penaltyDecayRate: 0.1
priorityWeight: 1.0
latencyWeight: 100.0
penaltyWeight: 1.0
hysteresisMargin: 0.1

请根据以下风格返回配置（任选一种或多种）：

- 稳定型：减少切换，宽容波动
- 延迟优先型：频繁检测，追求最快响应
- 高可用型：容忍短暂失败，但快速恢复
- 掉线惩罚型：代理一旦失败，长时间惩罚不让用
- 最小波动型：非常保守切换策略

返回 JSON 格式，只输出修改过的参数及注释。
*/

const presetMap = {
  Stable: Plugin.StableMode,
  LatencyFirst: Plugin.LatencyFirstMode,
  Custom: Plugin.CustomMode
}

// 保存插件状态
window[Plugin.id] = window[Plugin.id] || {
  isRunning: false,
  managers: [],
  init() {
    console.log(`[${Plugin.name}]`, 'init')
    const kernelApi = Plugins.useKernelApiStore()
    if (!kernelApi.running) {
      console.log(`[${Plugin.name}]`, '核心未运行')
      return false
    }
    if (!presetMap[Plugin.Preset]) {
      console.log(`[${Plugin.name}]`, '预设使用场景不存在，请检查插件配置')
      return false
    }
    if (Plugin.IncludeGroup.every((v) => !kernelApi.proxies[v])) {
      console.log(`[${Plugin.name}]`, '未匹配到任何需要接管的策略组')
      return false
    }

    const options = {
      ...JSON.parse(presetMap[Plugin.Preset]),
      monitoringInterval: Number(Plugin.MonitoringInterval),
      requestTimeout: Number(Plugin.RequestTimeout)
    }

    console.log(`[${Plugin.name}]`, `当前智能切换场景为【${Plugin.Preset}】`)
    console.log(`[${Plugin.name}]`, `当前智能切换参数为`, options)

    this.managers = []

    Plugin.IncludeGroup.forEach((group) => {
      if (!kernelApi.proxies[group]) {
        return
      }
      const proxies = kernelApi.proxies[group].all.map((proxy) => {
        return {
          id: proxy,
          url: `/proxies/${encodeURIComponent(proxy)}/delay`,
          priority: 1, // 节点权重暂未使用，全设置为1
          group
        }
      })
      const manager = new ProxyManager(proxies, options)
      this.managers.push(manager)
      console.log(`[${Plugin.name}]`, `智能切换已接管策略组【${group}】`)
    })

    return true
  },
  start() {
    console.log(`[${Plugin.name}]`, 'start')
    if (this.isRunning) {
      console.log(`[${Plugin.name}]`, '已经在运行了')
      return true
    }
    if (!this.init()) {
      return false
    }
    this.managers.forEach((manager) => manager.startMonitoring())
    this.isRunning = true
    return true
  },
  stop() {
    console.log(`[${Plugin.name}]`, 'stop')
    if (!this.isRunning) {
      console.log(`[${Plugin.name}]`, '没有在运行')
      return true
    }
    this.managers.forEach((manager) => manager.stopMonitoring())
    this.isRunning = false
    return true
  }
}

/* 触发器 手动触发 */
const onRun = async () => {
  console.log(`[${Plugin.name}]`, 'onRun')
  const kernelApi = Plugins.useKernelApiStore()
  if (!kernelApi.running) {
    throw '请先启动核心'
  }
  const res = window[Plugin.id].start()
  return res ? 1 : 2
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  console.log(`[${Plugin.name}]`, 'onReady')
  // window[Plugin.id].stop()
  // const res = window[Plugin.id].start()
  // return res ? 1 : 2

  // 暂时的解决方案
  function setPluginStatus(status) {
    const pluginStore = Plugins.usePluginsStore()
    const plugin = pluginStore.getPluginById(Plugin.id)
    plugin.status = status
    pluginStore.editPlugin(plugin.id, plugin)
  }

  setTimeout(() => {
    const res = window[Plugin.id].start()
    setPluginStatus(res ? 1 : 2)
  }, 3_000)
}

/* 触发器 核心启动后 */
const onCoreStarted = async () => {
  console.log(`[${Plugin.name}]`, 'onCoreStarted')
  window[Plugin.id].stop()
  const res = window[Plugin.id].start()
  return res ? 1 : 2
}

/* 触发器 核心停止后 */
const onCoreStopped = async () => {
  console.log(`[${Plugin.name}]`, 'onCoreStopped')
  const res = window[Plugin.id].stop()
  return res ? 2 : 1
}

/*
 * 插件右键 - 启动
 */

const Start = () => {
  const kernelApi = Plugins.useKernelApiStore()
  if (!kernelApi.running) {
    throw '请先启动核心'
  }
  const res = window[Plugin.id].start()
  return res ? 1 : 2
}

/*
 * 右键菜单 - 停止
 */
const Stop = () => {
  const res = window[Plugin.id].stop()
  return res ? 2 : 1
}

/*
 * 右键菜单 - 查看节点状态
 */
const ViewStat = async () => {
  function renderState(state) {
    switch (state) {
      case 'CLOSED':
        return '🟢 正常'
      case 'OPEN':
        return '🔴 故障'
      case 'HALF_OPEN':
        return '🟡 检测中'
      default:
        return '❓未知'
    }
  }

  const groups = window[Plugin.id].managers.map((manager) => {
    const group = manager.proxies[0].group
    const rows = manager.proxies
      .map((proxy) => {
        const { id, lastDelay, ewmaLatency, failureCount, penalty, state, lastPenaltyUpdate, nextAttempt } = proxy
        const name = id.replaceAll('|', '\\|')
        return {
          name: manager.current?.id === id ? `\`${name}\`` : name,
          state: renderState(state),
          lastDelay: lastDelay ? lastDelay + 'ms' : '-',
          ewmaLatency: ewmaLatency ? ewmaLatency.toFixed(2) + 'ms' : '-',
          score: proxy.getScore().toFixed(2),
          failureCount,
          penalty: penalty ? penalty.toFixed(2) : penalty,
          isAvailable: lastDelay !== '' ? '✅' : '❌',
          lastPenaltyUpdate,
          nextAttempt
        }
      })
      .sort((a, b) => b.score - a.score)
    return { group, rows, options: manager.options }
  })

  const groups_markdown = groups.map((group) =>
    [
      `## 策略组【${group.group}】`,
      `> 代理数量：${group.rows.length} 监控间隔：${group.options.monitoringInterval}ms\n`,
      '|节点名|分数|当前延迟|EWMA平滑延迟|失败次数|惩罚值|更新时间|下次检测时间|断路器|可用性|',
      '|--|--|--|--|--|--|--|--|--|--|',
      group.rows
        .map(
          (v) =>
            `|${v.name}|${v.score}|${v.lastDelay}|${v.ewmaLatency}|${v.failureCount}|${v.penalty}|${Plugins.formatRelativeTime(v.lastPenaltyUpdate)}|${v.nextAttempt === 0 ? '-' : Plugins.formatRelativeTime(v.nextAttempt)}|${v.state}|${v.isAvailable}|`
        )
        .join('\n')
    ].join('\n')
  )

  const ok = await Plugins.confirm(Plugin.name, groups_markdown.join('\n'), { type: 'markdown', okText: '刷新' }).catch(() => false)
  if (ok) {
    return await ViewStat()
  }
}

const setupRequestApi = () => {
  let base = Plugins.APP_TITLE.includes('SingBox') ? 'http://127.0.0.1:20123' : 'http://127.0.0.1:20113'
  let bearer = ''

  const appSettingsStore = Plugins.useAppSettingsStore()
  const profilesStore = Plugins.useProfilesStore()

  const profile = profilesStore.getProfileById(appSettingsStore.app.kernel.profile)

  if (profile) {
    if (Plugins.APP_TITLE.includes('SingBox')) {
      const controller = profile.experimental.clash_api.external_controller || '127.0.0.1:20123'
      const [, port = 20123] = controller.split(':')
      base = `http://127.0.0.1:${port}`
      bearer = profile.experimental.clash_api.secret
    } else {
      const controller = profile.advancedConfig['external-controller'] || '127.0.0.1:20113'
      const [, port = 20113] = controller.split(':')
      base = `http://127.0.0.1:${port}`
      bearer = profile.advancedConfig.secret
    }
  }
  request.base = base
  request.bearer = bearer
}

const request = new Plugins.Request({
  beforeRequest: setupRequestApi,
  timeout: 60 * 1000
})

class ProxyServer {
  constructor(id, url, priority, group, options) {
    this.id = id // 代理唯一标识符
    this.url = url // 用于健康检查的代理地址
    this.priority = priority // 优先级（值越高优先级越高）
    this.group = group // 所属策略组
    this.options = options // 配置项

    // 指标信息
    this.ewmaLatency = null // 延迟的 EWMA 平均值
    this.failureCount = 0 // 连续失败次数
    this.lastDelay = '' // 最后一次延迟
    this.penalty = 0 // 故障惩罚值
    this.lastPenaltyUpdate = Date.now() // 上次惩罚更新时间

    // 断路器状态
    this.state = 'CLOSED' // 可选状态：CLOSED、OPEN、HALF_OPEN
    this.nextAttempt = 0 // OPEN 状态下下次尝试的时间戳
  }

  // 成功响应时更新延迟与状态
  recordSuccess(latency) {
    const now = Date.now()
    const alpha = this.options.ewmaAlpha
    if (this.ewmaLatency === null) {
      this.ewmaLatency = latency
    } else {
      this.ewmaLatency = alpha * latency + (1 - alpha) * this.ewmaLatency
    }
    this.failureCount = 0
    this.lastDelay = latency
    if (this.state === 'HALF_OPEN' || this.state === 'OPEN') {
      this.state = 'CLOSED'
    }
    const dt = (now - this.lastPenaltyUpdate) / 1000
    this.penalty *= Math.exp(-this.options.penaltyDecayRate * dt)
    this.lastPenaltyUpdate = now
  }

  // 失败时更新指标和断路器状态
  recordFailure() {
    const now = Date.now()
    this.failureCount += 1
    this.lastDelay = ''
    this.penalty += this.options.penaltyIncrement
    this.lastPenaltyUpdate = now
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN'
      this.nextAttempt = now + this.options.circuitBreakerTimeout
    }
  }

  // 判断代理是否可用（断路器逻辑）
  isAvailable() {
    const now = Date.now()
    if (this.state === 'OPEN') {
      if (now >= this.nextAttempt) {
        this.state = 'HALF_OPEN'
        return true
      }
      return false
    }
    return true
  }

  // 根据优先级、延迟与惩罚计算综合得分
  getScore() {
    if (!this.isAvailable() || this.ewmaLatency === null) {
      return -Infinity
    }
    const now = Date.now()
    const dt = (now - this.lastPenaltyUpdate) / 1000
    const decayedPenalty = this.penalty * Math.exp(-this.options.penaltyDecayRate * dt)

    const pScore = this.options.priorityWeight * this.priority
    const lScore = this.options.latencyWeight * (1 / this.ewmaLatency)
    const penScore = this.options.penaltyWeight * decayedPenalty
    return pScore + lScore - penScore
  }
}

class ProxyManager {
  constructor(proxyConfigs, options) {
    this.options = Object.assign(
      {
        ewmaAlpha: 0.3, // 延迟 EWMA 平滑因子
        failureThreshold: 3, // 最大允许连续失败次数
        circuitBreakerTimeout: 360 * 1000, // 断路器开启后的超时时间（ms）
        penaltyIncrement: 5, // 每次失败增加的惩罚值
        penaltyDecayRate: 0.1, // 惩罚值衰减速率（每秒）
        priorityWeight: 1.0, // 优先级权重
        latencyWeight: 100.0, // 延迟得分权重
        penaltyWeight: 1.0, // 惩罚惩权重
        hysteresisMargin: 0.1, // 滞后阈值（防止频繁切换）
        monitoringInterval: 60 * 1000, // 监控间隔（ms）
        requestTimeout: 5000 // 代理请求超时（ms）
      },
      options
    )

    this.proxies = proxyConfigs.map((cfg) => new ProxyServer(cfg.id, cfg.url, cfg.priority, cfg.group, this.options))

    this.current = null // 当前所用代理
  }

  // 启动监控循环
  startMonitoring() {
    this.monitoringTimer = Plugins.setIntervalImmediately(() => {
      this.checkAll().then(() => {
        this.evaluateSwitch()
      })
    }, this.options.monitoringInterval)
  }

  // 停止监控
  stopMonitoring() {
    clearInterval(this.monitoringTimer)
  }

  // 检查所有代理状态
  async checkAll() {
    const checkProxy = async (proxy) => {
      // 如果是 OPEN 且还不能尝试，不要浪费请求
      if (!proxy.isAvailable()) {
        return
      }
      try {
        const { delay } = await request.get(proxy.url, {
          url: Plugin.TestUrl || 'https://www.gstatic.com/generate_204',
          timeout: Number(Plugin.RequestTimeout)
        })
        proxy.recordSuccess(delay)
      } catch (err) {
        proxy.recordFailure()
      }
    }
    await Plugins.asyncPool(Number(Plugin.ConcurrencyLimit), this.proxies, checkProxy)
  }

  // 判断是否应切换代理
  evaluateSwitch() {
    const now = Date.now()
    let best = null
    let bestScore = -Infinity
    for (const p of this.proxies) {
      const score = p.getScore()
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }
    if (!best) return

    if (!this.current) {
      this.switchTo(best)
      return
    }

    // 更新current，用户可能手动改变了当前的代理，造成数据不一致的情况
    const kernelApi = Plugins.useKernelApiStore()
    const proxyName = kernelApi.proxies[this.current.group].now
    const proxy = this.proxies.find((v) => v.id === proxyName)
    if (proxy) {
      this.current = proxy
    }

    const currentScore = this.current.getScore()
    if (best.id !== this.current.id && bestScore >= currentScore + this.options.hysteresisMargin) {
      this.switchTo(best)
    }
  }

  // 执行代理切换逻辑
  switchTo(proxy) {
    console.log(`[${Plugin.name}]`, proxy)
    console.log(`[${Plugin.name}]`, `策略组【${proxy.group}】切换代理: ${this.current?.id || '无'} -> ${proxy.id}`)
    this.current = proxy

    const kernelApi = Plugins.useKernelApiStore()

    Plugins.handleUseProxy(kernelApi.proxies[proxy.group], kernelApi.proxies[proxy.id])
  }
}
