/*
 * 实现动态代理选择机制，包含故障转移、断路器、EWMA 延迟跟踪、基于分数调度与滞后控制，防止频繁切换。
 * TODO: 解决切换配置未自动接管新的代理组
 */

/*
调整参数可以大语言模型提示词：
你是一个代理服务器调度系统的参数专家。我想要不同风格的调度参数配置。系统包括 EWMA、优先级、断路器、惩罚分机制和滞后控制（hysteresis）等策略。请只输出**与默认值不同的参数和注释**，格式如下：

{
  "参数名": 新值,
  "_参数名": "简洁说明"
}

默认值如下（用于参考）：  
ewmaAlpha: 0.3
failureThreshold: 3
circuitBreakerTimeout: 60000
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

// 保存插件状态
window[Plugin.id] = window[Plugin.id] || {
  managers: [],
  stop() {
    this.managers.forEach((manager) => manager.stopMonitoring())
    this.managers.splice(0)
  }
}

/* 触发器 手动触发 */
const onRun = async () => {
  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.kernel.running) {
    throw '请先启动内核'
  }

  const presetMap = {
    Stable: Plugin.StableMode,
    LatencyFirst: Plugin.LatencyFirstMode,
    CustomMode: Plugin.CustomMode
  }
  if (!presetMap[Plugin.Preset]) {
    throw '预设使用场景不存在，请检查插件配置'
  }

  const kernelApi = Plugins.useKernelApiStore()
  if (Plugin.IncludeGroup.every((v) => !kernelApi.proxies[v])) {
    throw '未匹配到任何需要接管的策略组'
  }

  // 停止之前的检测
  Stop()

  const options = {
    ...JSON.parse(presetMap[Plugin.Preset]),
    monitoringInterval: Number(Plugin.MonitoringInterval),
    requestTimeout: Number(Plugin.RequestTimeout)
  }
  console.log(`[${Plugin.name}]`, `当前智能切换场景为【${Plugin.Preset}】`)
  console.log(`[${Plugin.name}]`, `当前智能切换参数为`, options)

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
    manager.startMonitoring()
    window[Plugin.id].managers.push(manager)
    console.log(`[${Plugin.name}]`, `智能切换已接管策略组【${group}】`)
  })

  Plugins.message.success('智能切换启动成功')

  return 1
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  // 返回2，将插件状态始终置为已停止
  return 2
}

/*
 * 右键菜单 - 停止
 */
const Stop = () => {
  window[Plugin.id].stop()
  return 2
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
        circuitBreakerTimeout: 30 * 1000, // 断路器开启后的超时时间（ms）
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
