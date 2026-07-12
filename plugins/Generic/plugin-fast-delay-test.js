const IPV6_TEST_URL = 'https://ipv6.google.com/generate_204'
const DEFAULT_SCRIPT_CONTENT = `
// 此脚本将在所有节点测试完成后执行（订阅更新时/手动测试全部）

/**
 * 脚本入口函数，接收测试完成的节点列表，返回处理后的节点列表
 *
 * proxies 数组中的单个对象结构：
 * - _delay_ : 测试延迟 (number)
 * - _ipv6_  : IPv6 支持 (boolean)
 * - ...     : 原始节点数据
 */
const operate = async (proxies) => {
  // 示例：过滤掉超时节点，并只保留支持 IPv6 的节点
  // return proxies.filter((p) => p._delay_ > 0).filter((p) => p._ipv6_)
  return proxies
}`
const DEFAULT_PLUGIN_SETTINGS = Object.freeze({
  testUrl: 'Google',
  customTestUrl: '',
  ipv6Test: true,
  testTimeout: 5000,
  concurrencyLimit: 20
})
const DEFAULT_SUBSCRIPTION_CONFIG = Object.freeze({
  automation: {
    enabled: false,
    sort: false,
    clean: false,
    cleanThreshold: 0
  },
  script: DEFAULT_SCRIPT_CONTENT.trim()
})
const TEST_URL_MAP = Object.freeze({
  Google: 'https://www.gstatic.com/generate_204',
  Cloudflare: 'https://cp.cloudflare.com/generate_204',
  Qualcomm: 'https://www.qualcomm.cn/generate_204',
  Apple: 'https://www.apple.com/library/test/success.html',
  Microsoft: 'https://www.msftconnecttest.com/connecttest.txt',
  Custom: ''
})
const CORE_STOP_OUTPUT_KEYWORD = Object.freeze({
  GFS: 'sing-box started',
  GFC: 'Start initial compatible provider default'
})
const BASE_CONFIG = {
  GFS: Object.freeze({
    log: {
      level: 'info',
      timestamp: true
    },
    dns: {
      servers: [
        {
          tag: 'dns-ali',
          type: 'https',
          server: 'dns.alidns.com',
          domain_resolver: 'dns-hosts'
        },
        {
          tag: 'dns-hosts',
          type: 'hosts',
          predefined: {
            'dns.alidns.com': ['223.5.5.5', '223.6.6.6']
          }
        }
      ]
    },
    ntp: {
      enabled: true,
      server: 'ntp.aliyun.com',
      server_port: 123
    },
    outbounds: [],
    route: {
      auto_detect_interface: true,
      default_domain_resolver: 'dns-ali'
    },
    experimental: {
      clash_api: {
        external_controller: '',
        secret: ''
      }
    }
  }),
  GFC: Object.freeze({
    'log-level': 'info',
    ipv6: true,
    'unified-delay': true,
    'external-controller': '',
    secret: '',
    profile: {
      'store-selected': false,
      'store-fake-ip': false
    },
    dns: {
      enable: true,
      ipv6: true,
      'default-nameserver': ['223.5.5.5'],
      'proxy-server-nameserver': ['https://dns.alidns.com/dns-query']
    },
    proxies: []
  })
}
/** @type {EsmPlugin} */
export default (plugin) => {
  const cachePath = `data/.cache/${plugin.id}`
  const settingsPath = `${cachePath}/settings.json`
  const envStore = Plugins.useEnvStore()
  const appSettingsStore = Plugins.useAppSettingsStore()
  const kernelApiStore = Plugins.useKernelApiStore()
  const subscribesStore = Plugins.useSubscribesStore()
  const runtimeContextMap = new Map()
  const runtimeState = {
    uiSubId: null,
    automationSubIds: new Set()
  }
  const getParentDir = (filePath) => {
    const lastSlashIndex = filePath.lastIndexOf('/')
    return lastSlashIndex === -1 ? '' : filePath.slice(0, lastSlashIndex)
  }
  const getProxyKey = (proxy) => `${proxy.tag}_${proxy.type}`
  const saveJson = async (filePath, data, ensureDirExist = true) => {
    if (ensureDirExist) {
      const parentDir = getParentDir(filePath)
      if (parentDir) {
        await Plugins.MakeDir(parentDir).catch(() => {})
      }
    }
    await Plugins.WriteFile(filePath, JSON.stringify(data))
  }
  const loadJson = async (filePath, defaultValue) => {
    if (!(await Plugins.FileExists(filePath))) {
      return Plugins.deepClone(defaultValue)
    }
    const content = await Plugins.ReadFile(filePath)
    return Array.isArray(defaultValue)
      ? JSON.parse(content)
      : {
          ...defaultValue,
          ...JSON.parse(content)
        }
  }
  const normalizeProxy = (p) => ({
    tag: p.tag ?? p.name,
    type: p.type,
    raw: p
  })
  const restoreProxies = (proxies) => proxies.map((p) => p.raw)
  const createGFSAdapter = () => {
    return {
      kind: 'GFS',
      data: {
        normalizeProxies: (proxies) => proxies.map(normalizeProxy),
        readRawProxies: async (subscription) => {
          const rawProxies = await loadJson(subscription.path, [])
          return rawProxies.map(normalizeProxy)
        },
        writeRawProxies: async (subscription, proxies) => {
          await saveJson(subscription.path, restoreProxies(proxies), false)
        },
        writeSubscriptionMeta: (subscription, proxies) => {
          const existSubMap = new Map(subscription.proxies.map((sp) => [`${sp.tag}_${sp.type}`, sp]))
          subscription.proxies = proxies.map((p) => ({
            id: existSubMap.get(getProxyKey(p))?.id ?? Plugins.sampleID(),
            tag: p.tag,
            type: p.type
          }))
        }
      },
      runtime: {
        configExt: 'json',
        coreDir: 'data/sing-box',
        stopOutputKeyword: CORE_STOP_OUTPUT_KEYWORD.GFS,
        createRuntimeConfig: (proxies, controller, secret) => ({
          ...BASE_CONFIG.GFS,
          outbounds: restoreProxies(proxies),
          experimental: {
            ...BASE_CONFIG.GFS.experimental,
            clash_api: {
              external_controller: controller,
              secret
            }
          }
        }),
        serializeRuntimeConfig: (config) => JSON.stringify(config),
        launchArgs: (workingDir, configPath) => ['run', '--disable-color', '-c', configPath, '-D', workingDir]
      }
    }
  }
  const createGFCAdapter = () => {
    return {
      kind: 'GFC',
      data: {
        normalizeProxies: (proxies) => proxies.map(normalizeProxy),
        readRawProxies: async (subscription) => {
          const content = await Plugins.ReadFile(subscription.path)
          const parsed = Plugins.YAML.parse(content)
          return parsed.proxies.map(normalizeProxy)
        },
        writeRawProxies: async (subscription, proxies) => {
          await Plugins.WriteFile(
            subscription.path,
            Plugins.YAML.stringify({
              proxies: restoreProxies(proxies)
            })
          )
        },
        writeSubscriptionMeta: (subscription, proxies) => {
          const existSubMap = new Map(subscription.proxies.map((sp) => [`${sp.name}_${sp.type}`, sp]))
          subscription.proxies = proxies.map((p) => ({
            id: existSubMap.get(getProxyKey(p))?.id ?? Plugins.sampleID(),
            name: p.tag,
            type: p.type
          }))
        }
      },
      runtime: {
        configExt: 'yaml',
        coreDir: 'data/mihomo',
        stopOutputKeyword: CORE_STOP_OUTPUT_KEYWORD.GFC,
        createRuntimeConfig: (proxies, controller, secret) => ({
          ...BASE_CONFIG.GFC,
          'external-controller': controller,
          secret,
          proxies: restoreProxies(proxies)
        }),
        serializeRuntimeConfig: (config) => Plugins.YAML.stringify(config),
        launchArgs: (workingDir) => ['-d', workingDir]
      }
    }
  }
  const createClientAdapter = (appName) => (appName.includes('Clash') ? createGFCAdapter() : createGFSAdapter())
  const getDelayDataPath = (subId) => `${cachePath}/${subId}/delay-data.json`
  const getSubConfigPath = (subId) => `${cachePath}/${subId}/subConfig.json`
  const createStorage = (pathGenerator, defaultVal) => {
    return {
      load: (id = '') => loadJson(pathGenerator(id), defaultVal),
      save: async (data, id = '') => {
        await saveJson(pathGenerator(id), data)
      }
    }
  }
  const SettingsStore = createStorage(() => settingsPath, DEFAULT_PLUGIN_SETTINGS)
  const DelayDataStore = createStorage(getDelayDataPath, [])
  const SubConfigStore = createStorage(getSubConfigPath, DEFAULT_SUBSCRIPTION_CONFIG)
  const adapter = createClientAdapter(Plugins.APP_TITLE)
  const sortProxiesByDelayData = (proxies, delayDataList) => {
    const delayMap = new Map(delayDataList.map((d) => [getProxyKey(d), d.delay]))
    return [...proxies].sort((a, b) => {
      const delayA = delayMap.get(getProxyKey(a)) ?? 0
      const delayB = delayMap.get(getProxyKey(b)) ?? 0
      const valA = delayA <= 0 ? Infinity : delayA
      const valB = delayB <= 0 ? Infinity : delayB
      return valA - valB
    })
  }
  const getProxyDelay = async (opts) => {
    const { baseUrl, proxy, testUrl, timeout, secret } = opts
    const url = new URL(`${baseUrl}/proxies/${encodeURIComponent(proxy)}/delay`)
    url.searchParams.append('url', testUrl)
    url.searchParams.append('timeout', timeout)
    try {
      const { body } = await Plugins.Requests({
        method: 'GET',
        url: url.toString(),
        autoTransformBody: false,
        headers: {
          Authorization: `Bearer ${secret}`
        },
        options: {
          Proxy: '',
          Timeout: Number(timeout)
        }
      })
      return JSON.parse(body).delay ?? -1
    } catch (err) {
      console.error(`[${plugin.name}] `, err)
      return -1
    }
  }
  const testSingleProxy = async (ctx, proxy, settings) => {
    const { baseUrl, secret } = ctx
    const { tag, type } = proxy
    const testUrl = settings.testUrl === 'Custom' ? settings.customTestUrl || TEST_URL_MAP.Google : TEST_URL_MAP[settings.testUrl]
    const createDelayGetParams = (targetUrl) => ({
      baseUrl,
      proxy: tag,
      testUrl: targetUrl,
      timeout: String(settings.testTimeout),
      secret
    })
    const delayPromise = getProxyDelay(createDelayGetParams(testUrl))
    const ipv6DelayPromise = settings.ipv6Test ? getProxyDelay(createDelayGetParams(IPV6_TEST_URL)) : Promise.resolve(-1)
    const [delay, ipv6Delay] = await Promise.all([delayPromise, ipv6DelayPromise])
    return {
      tag,
      type,
      delay,
      ipv6: ipv6Delay > 0
    }
  }
  const testAllProxies = async (ctx, proxies, settings, options) => {
    let index = 0
    let success = 0
    let failure = 0
    let cancelled = false
    const totalCount = proxies.length
    const { silent = false, onProxyStart, onProxyTested } = options
    const results = []
    const updateMsgText = (prefix) => `${prefix} ${index} / ${totalCount}, 成功：${success} 失败：${failure}`
    const { run, controller } = Plugins.createAsyncPool(settings.concurrencyLimit, proxies, async (p) => {
      if (cancelled) return
      onProxyStart?.(p)
      const result = await testSingleProxy(ctx, p, settings)
      if (result.delay > 0) {
        success += 1
      } else {
        failure += 1
      }
      results.push(result)
      onProxyTested?.(result)
      index += 1
      if (!silent) updateUI?.(updateMsgText('测试中...'))
    })
    let updateUI, destroyUI, successUI
    if (!silent) {
      const cancelPendingTests = () => {
        if (cancelled) return
        cancelled = true
        controller.cancel()
      }
      const msg = Plugins.message.info(updateMsgText('测试中...'), 999999, cancelPendingTests)
      updateUI = msg.update
      destroyUI = msg.destroy
      successUI = msg.success
    }
    try {
      await run()
      if (!silent) {
        if (cancelled) {
          Plugins.message.warn(updateMsgText('已取消'))
        } else {
          successUI?.(updateMsgText('测试完成'))
          await Plugins.sleep(3_000)
        }
      }
    } finally {
      destroyUI?.()
    }
    return {
      total: totalCount,
      success,
      failure,
      cancelled,
      results
    }
  }
  const runCore = async (targetConfigPath, subDir) => {
    const isAlpha = appSettingsStore.app.kernel.branch === 'alpha'
    const core = await Plugins.getKernelFileName(isAlpha)
    const [corePath, configPath, workingDir] = await Promise.all([
      Plugins.AbsolutePath(`${adapter.runtime.coreDir}/${core}`),
      Plugins.AbsolutePath(targetConfigPath),
      Plugins.AbsolutePath(subDir)
    ])
    return new Promise((resolve, reject) => {
      let output = ''
      const pid = Plugins.ExecBackground(
        corePath,
        adapter.runtime.launchArgs(workingDir, configPath),
        (out) => {
          output = out
          if (out.includes(adapter.runtime.stopOutputKeyword)) {
            resolve(pid)
          }
        },
        () => {
          reject(output)
        },
        {
          StopOutputKeyword: adapter.runtime.stopOutputKeyword
        }
      ).catch((e) => {
        reject(e)
      })
    })
  }
  const getDelayColor = (delay) => {
    if (delay === 0) return 'var(--level-0-color)'
    if (delay === -1) return 'var(--level-4-color)'
    if (delay < 500) return 'var(--level-1-color)'
    if (delay < 1000) return 'var(--level-2-color)'
    if (delay < 1500) return 'var(--level-3-color)'
    return 'var(--level-4-color)'
  }
  const getAvailablePorts = async (count) => {
    const isWindows = envStore.env.os === 'windows'
    let out = ''
    if (isWindows) {
      out = await Plugins.Exec('netstat', ['-an'], {
        Convert: true
      })
    } else {
      try {
        out = await Plugins.Exec('ss', ['-tuln'])
      } catch {
        out = await Plugins.Exec('netstat', ['-tuln'])
      }
    }
    const portRegex = /(?:\[[a-fA-F0-9:]+\]|[\d.]+)(?::|\.)(\d+)/g
    const occupiedPorts = new Set()
    let match
    while ((match = portRegex.exec(out)) !== null) {
      occupiedPorts.add(parseInt(match[1], 10))
    }
    const availablePorts = []
    const min = 1024
    const max = 65535
    while (availablePorts.length < count) {
      const randomPort = Math.floor(Math.random() * (max - min + 1)) + min
      if (!occupiedPorts.has(randomPort) && !availablePorts.includes(randomPort)) {
        availablePorts.push(randomPort)
      }
    }
    return availablePorts
  }
  const isValidNode = (delay, threshold) => {
    if (delay === -1) return false
    return threshold <= 0 || delay <= threshold
  }
  const isSubUIActive = (subId) => runtimeState.uiSubId === subId
  const isAutomationActive = (subId) => runtimeState.automationSubIds.has(subId)
  const startRuntimeContext = async (subscription, proxies) => {
    const existing = runtimeContextMap.get(subscription.id)
    if (existing?.started) return existing
    const unifiedProxies = proxies ?? (await adapter.data.readRawProxies(subscription))
    if (unifiedProxies.length === 0) {
      throw '此订阅内无节点可供测试'
    }
    const secret = Plugins.generateSecureKey()
    const [port] = await getAvailablePorts(1)
    const controller = `127.0.0.1:${port}`
    const baseUrl = `http://${controller}`
    const subDir = `${cachePath}/${subscription.id}`
    await Plugins.MakeDir(subDir).catch(() => {})
    const configPath = `${subDir}/config.${adapter.runtime.configExt}`
    const runtimeConfig = adapter.runtime.createRuntimeConfig(unifiedProxies, controller, secret)
    await Plugins.WriteFile(configPath, adapter.runtime.serializeRuntimeConfig(runtimeConfig))
    try {
      const pid = await runCore(configPath, subDir)
      const ctx = {
        pid,
        baseUrl,
        secret,
        configPath,
        started: true
      }
      runtimeContextMap.set(subscription.id, ctx)
      return ctx
    } catch (err) {
      await Plugins.RemoveFile(configPath).catch(() => {})
      throw `测试核心启动失败: ${String(err)}`
    }
  }
  const stopRuntimeContext = async (subId) => {
    const ctx = runtimeContextMap.get(subId)
    if (!ctx) return
    if (ctx.pid) await Plugins.KillProcess(ctx.pid).catch(() => {})
    if (ctx.configPath) await Plugins.RemoveFile(ctx.configPath).catch(() => {})
    runtimeContextMap.delete(subId)
  }
  const executeScript = (code, proxies) => {
    const fn = new window.AsyncFunction('proxies', `${code}; return operate(proxies)`)
    return fn(proxies)
  }
  const persistUIStateOnClose = async (subscription, uiProxies) => {
    const sorted = [...uiProxies].sort((a, b) => {
      const valA = a.delay <= 0 ? Infinity : a.delay
      const valB = b.delay <= 0 ? Infinity : b.delay
      return valA - valB
    })
    const delayDataList = sorted.map((p) => ({
      tag: p.tag,
      type: p.type,
      delay: p.delay,
      ipv6: p.ipv6
    }))
    const rawProxies = sorted.map((p) => ({
      tag: p.tag,
      type: p.type,
      raw: p.raw
    }))
    await DelayDataStore.save(delayDataList, subscription.id)
    await adapter.data.writeRawProxies(subscription, rawProxies)
    adapter.data.writeSubscriptionMeta(subscription, rawProxies)
    await subscribesStore.editSubscribe(subscription.id, subscription)
  }
  const openUI = (subscription, ctx) => {
    const { ref, computed, onMounted, defineComponent, h, resolveComponent } = Vue
    const settings = ref({
      ...DEFAULT_PLUGIN_SETTINGS
    })
    const subConfig = ref({
      ...DEFAULT_SUBSCRIPTION_CONFIG
    })
    const uiProxiesList = ref([])
    const allTesting = ref(false)
    const loadData = async () => {
      settings.value = await SettingsStore.load()
      subConfig.value = await SubConfigStore.load(subscription.id)
      const unifiedProxies = await adapter.data.readRawProxies(subscription)
      const persistedDelayData = await DelayDataStore.load(subscription.id)
      const persistedMap = new Map(persistedDelayData.map((d) => [getProxyKey(d), d]))
      uiProxiesList.value = unifiedProxies.map((p) => {
        const key = getProxyKey(p)
        const cache = persistedMap.get(key)
        return {
          ...p,
          delay: cache?.delay ?? 0,
          ipv6: cache?.ipv6 ?? false,
          testing: false
        }
      })
    }
    const sortedProxies = computed(() => {
      return [...uiProxiesList.value].sort((a, b) => {
        const valA = a.delay <= 0 ? Infinity : a.delay
        const valB = b.delay <= 0 ? Infinity : b.delay
        return valA - valB
      })
    })
    const updateUIProxy = (result) => {
      const proxy = uiProxiesList.value.find((p) => getProxyKey(p) === getProxyKey(result))
      if (proxy) {
        proxy.delay = result.delay
        proxy.ipv6 = result.ipv6
        proxy.testing = false
      }
    }
    const deleteNode = async (proxy) => {
      if (!(await Plugins.confirm('提示', `确定要删除 [${proxy.tag}] 吗？`).catch(() => false))) return
      uiProxiesList.value = uiProxiesList.value.filter((p) => getProxyKey(p) !== getProxyKey(proxy))
      Plugins.message.success('已删除')
    }
    const cleanNodes = async (threshold) => {
      const text = threshold > 0 ? `延迟大于 ${threshold}ms 与测试失败` : '测试失败'
      if (!(await Plugins.confirm('清理节点', `确定要删除所有${text}的节点吗？`).catch(() => false))) return false
      const toKeep = uiProxiesList.value.filter((p) => isValidNode(p.delay, threshold))
      const deleteCount = uiProxiesList.value.length - toKeep.length
      if (deleteCount === 0) {
        Plugins.message.info('未找到需要清理的节点')
        return false
      }
      uiProxiesList.value = toKeep
      Plugins.message.success(`已清理 ${deleteCount} 个节点`)
      return true
    }
    const testSingleNode = async (proxy) => {
      if (proxy.testing) return
      if (!ctx.started) {
        Plugins.message.error('测试核心未就绪')
        return
      }
      proxy.testing = true
      try {
        const result = await testSingleProxy(ctx, proxy, settings.value)
        updateUIProxy(result)
      } catch {
        proxy.testing = false
      }
    }
    const testAllNodes = async () => {
      if (allTesting.value) return
      allTesting.value = true
      await testAllProxies(ctx, uiProxiesList.value, settings.value, {
        onProxyStart: (proxy) => {
          proxy.testing = true
        },
        onProxyTested: (result) => {
          updateUIProxy(result)
        }
      })
    }
    const openSettingsUI = () => {
      const draft = ref({
        ...settings.value
      })
      const component = defineComponent({
        template: `
        <div class="w-full h-full p-8">
          <div class="form-item">
            <div class="mr-8">测试地址</div>
            <Select v-model="draft.testUrl" :options="urlOptions" />
          </div>
          <div v-if="draft.testUrl === 'Custom'" class="form-item">
            <div class="mr-8">自定义测试地址</div>
            <Input v-model="draft.customTestUrl" />
          </div>
          <div class="form-item">
            <div class="mr-8">测试 IPv6</div>
            <Switch v-model="draft.ipv6Test" />
          </div>
          <div class="form-item">
            <div class="mr-8">测试超时(ms)</div>
            <div class="max-w-[75%]">
              <Input v-model="draft.testTimeout" :min="1" :max="10000" class="w-full" type="number" editable />
            </div>
          </div>
          <div class="form-item">
            <div class="mr-8">并发限制</div>
            <div class="max-w-[75%]">
              <Input v-model="draft.concurrencyLimit" :min="1" :max="100" class="w-full" type="number" editable />
            </div>
          </div>
        </div>
        `,
        setup() {
          const urlOptions = Object.keys(TEST_URL_MAP).map((k) => ({
            label: k,
            value: k
          }))
          return {
            draft,
            urlOptions
          }
        }
      })
      const modal = Plugins.modal({
        title: '插件配置',
        width: '35',
        submitText: '保存',
        cancelText: '取消',
        onOk: async () => {
          if (draft.value.testUrl === 'Custom' && draft.value.customTestUrl.length === 0) {
            Plugins.message.error('请填写一个有效的地址')
            return false
          }
          settings.value = {
            ...draft.value
          }
          await SettingsStore.save(settings.value)
          Plugins.message.success('已保存')
          return true
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const openScriptUI = () => {
      const code = ref(subConfig.value.script)
      const component = defineComponent({
        template: `
        <div>
          <CodeEditor v-model="code" lang="javascript" editable />
        </div>
        `,
        setup() {
          return {
            code
          }
        }
      })
      const modal = Plugins.modal({
        title: '脚本编辑',
        width: '90',
        height: '90',
        submitText: '保存',
        cancelText: '取消',
        onOk: async () => {
          subConfig.value.script = code.value
          await SubConfigStore.save(subConfig.value, subscription.id)
          Plugins.message.success('已保存')
          return true
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const openAutomationUI = () => {
      const draft = ref({
        ...subConfig.value.automation
      })
      const component = defineComponent({
        template: `
        <div class="w-full h-full p-8">
          <div class="text-12 text-gray-500 mb-16">为当前订阅配置更新时的自动化处理</div>
          <div class="form-item">
            <div class="mr-8">测试</div>
            <Switch v-model="draft.enabled" />
          </div>
          <div class="form-item" >
            <div class="mr-8">排序</div>
            <Switch v-model="draft.sort" :disabled="!draft.enabled" />
          </div>
          <div class="form-item">
            <div class="mr-8">清理</div>
            <Switch v-model="draft.clean" :disabled="!draft.enabled" />
          </div>
          <div class="form-item">
            <div class="mr-8">清理阈值(ms)</div>
            <div class="max-w-[75%]">
              <Input type="number" v-model="draft.cleanThreshold" :min="0" :disabled="!draft.enabled || !draft.clean" class="w-full" editable  />
            </div>
          </div>
        </div>
        `,
        setup() {
          return {
            draft
          }
        }
      })
      const modal = Plugins.modal({
        title: '订阅自动化处理',
        width: '35',
        submitText: '保存',
        cancelText: '取消',
        onOk: async () => {
          subConfig.value.automation = {
            ...draft.value
          }
          await SubConfigStore.save(subConfig.value, subscription.id)
          Plugins.message.success('已保存')
          return true
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const openCleanUI = () => {
      const component = defineComponent({
        template: `
        <div class="w-full h-full p-8">
          <div class="form-item">
            <div class="mr-8">清理阈值(ms)</div>
            <div class="max-w-[75%]">
              <Input type="number" v-model="subConfig.automation.cleanThreshold" :min="0" class="w-full" editable />
            </div>
          </div>
        </div>
        `,
        setup(_, { expose }) {
          expose({
            modalSlots: {
              action: () =>
                h(
                  'div',
                  {
                    class: 'mr-auto text-12'
                  },
                  '输入 0 仅清理测试失败的节点'
                )
            }
          })
          return {
            subConfig
          }
        }
      })
      const modal = Plugins.modal({
        title: '清理节点',
        width: '35',
        submitText: '清理',
        cancelText: '取消',
        onOk: async () => {
          await SubConfigStore.save(subConfig.value, subscription.id)
          return cleanNodes(subConfig.value.automation.cleanThreshold)
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const component = defineComponent({
      template: `
      <div class="h-full flex flex-col p-8">
        <div v-if="sortedProxies.length === 0" class="flex items-center justify-center">
          <Empty />
        </div>
        <div v-else class="grid grid-cols-4 gap-8 overflow-y-auto">
          <Card v-for="proxy in sortedProxies" :key="proxy.tag" :title="proxy.tag" @contextmenu="testSingleNode(proxy)" class="w-full">
            <template #extra>
              <Button size="small" type="text" icon="delete" @click.stop="deleteNode(proxy)" />
            </template>

            <div class="flex items-center justify-between min-h-[50px] pt-4">
              <div class="text-12 leading-none">
                {{ proxy.type }}{{ proxy.ipv6 ? ' / IPv6' : '' }}
              </div>

              <Button
                class="font-bold text-12 leading-none -mr-8"
                :style="{ color: getDelayColor(proxy.delay) }"
                :loading="proxy.testing"
                size="small"
                type="text"
                @click.stop="testSingleNode(proxy)"
              >
                {{ proxy.delay === 0 ? '测试' : proxy.delay + ' ms' }}
              </Button>
            </div>
          </Card>
        </div>
      </div>
      `,
      setup(_, { expose }) {
        onMounted(loadData)
        expose({
          modalSlots: {
            toolbar: () => [
              h(
                resolveComponent('Button'),
                {
                  type: 'text',
                  onClick: openSettingsUI
                },
                () => '插件配置'
              ),
              h(
                resolveComponent('Button'),
                {
                  type: 'text',
                  onClick: openScriptUI
                },
                () => '脚本操作'
              ),
              h(
                resolveComponent('Button'),
                {
                  type: 'text',
                  onClick: openAutomationUI
                },
                () => '自动处理'
              ),
              h(
                resolveComponent('Button'),
                {
                  type: 'text',
                  onClick: openCleanUI
                },
                () => '清理节点'
              ),
              h(
                resolveComponent('Button'),
                {
                  type: 'text',
                  icon: 'speedTest',
                  loading: allTesting.value,
                  onClick: async () => {
                    if (allTesting.value) return
                    try {
                      await testAllNodes()
                      const pendingProxies = uiProxiesList.value.map((p) => ({
                        ...p.raw,
                        _delay_: p.delay,
                        _ipv6_: p.ipv6
                      }))
                      const results = await executeScript(subConfig.value.script, pendingProxies)
                      uiProxiesList.value = results.map((r) => {
                        const { _delay_, _ipv6_, ...rest } = r
                        return {
                          ...normalizeProxy(rest),
                          delay: _delay_,
                          ipv6: _ipv6_,
                          testing: false
                        }
                      })
                      Plugins.message.success('脚本执行完成')
                    } catch (err) {
                      Plugins.message.error(`脚本执行失败: ${String(err)}`)
                    } finally {
                      allTesting.value = false
                    }
                  }
                },
                () => '测试全部'
              )
            ],
            cancel: () =>
              h(
                resolveComponent('Button'),
                {
                  type: 'text',
                  onClick: async () => {
                    try {
                      await persistUIStateOnClose(subscription, uiProxiesList.value)
                    } finally {
                      await stopRuntimeContext(subscription.id)
                      runtimeState.uiSubId = null
                      modal.destroy()
                    }
                  }
                },
                () => '关闭'
              )
          }
        })
        return {
          sortedProxies,
          getDelayColor,
          testSingleNode,
          deleteNode
        }
      }
    })
    const modal = Plugins.modal({
      title: `快速测试与清理 [${subscription.name}]`,
      submit: false,
      width: '90',
      height: '90'
    })
    modal.setContent(component)
    modal.open()
  }
  const testDelay = async (subscription) => {
    if (isAutomationActive(subscription.id)) {
      Plugins.message.warn('当前订阅自动处理中，插件界面暂不可用')
      return
    }
    if (kernelApiStore.running) {
      Plugins.message.warn('代理核心运行中，可能影响测试结果')
    }
    runtimeState.uiSubId = subscription.id
    try {
      const ctx = await startRuntimeContext(subscription)
      openUI(subscription, ctx)
    } catch (err) {
      runtimeState.uiSubId = null
      throw err
    }
  }
  const onRun = async () => {
    const selectedSub = await Plugins.picker.single(
      '请选择要测试的订阅',
      subscribesStore.subscribes.map((v) => ({
        label: v.name,
        value: v
      })),
      [subscribesStore.subscribes[0]]
    )
    if (!selectedSub) {
      throw '未选择订阅，无法运行插件'
    }
    await testDelay(selectedSub)
  }
  const onSubscribe = async (rawProxies, subscription) => {
    if (isSubUIActive(subscription.id)) {
      console.warn(`[${plugin.name}] 当前订阅界面已开启，跳过更新时的自动处理`)
      return rawProxies
    }
    const subConfig = await SubConfigStore.load(subscription.id)
    const { automation, script } = subConfig
    if (!automation.enabled) return rawProxies
    runtimeState.automationSubIds.add(subscription.id)
    try {
      const settings = await SettingsStore.load()
      const normalizedProxies = adapter.data.normalizeProxies(rawProxies)
      const ctx = await startRuntimeContext(subscription, normalizedProxies)
      const { results } = await testAllProxies(ctx, normalizedProxies, settings, {
        silent: true
      })
      const resultMap = new Map(results.map((r) => [getProxyKey(r), r]))
      const pendingProxies = normalizedProxies.map((p) => {
        const res = resultMap.get(getProxyKey(p))
        return {
          ...p.raw,
          _delay_: res?.delay ?? 0,
          _ipv6_: res?.ipv6 ?? false
        }
      })
      let scriptProcessedProxies = pendingProxies
      try {
        scriptProcessedProxies = await executeScript(script, pendingProxies)
      } catch (err) {
        console.error(`[${plugin.name}] 脚本执行失败，跳过脚本处理`, err)
      }
      const nextNormalizedProxies = []
      const nextDelayData = []
      scriptProcessedProxies.forEach((p) => {
        const { _delay_, _ipv6_, ...rest } = p
        const normalized = normalizeProxy(rest)
        nextNormalizedProxies.push(normalized)
        nextDelayData.push({
          tag: normalized.tag,
          type: p.type,
          delay: _delay_,
          ipv6: _ipv6_
        })
      })
      let processed = nextNormalizedProxies
      if (automation.clean) {
        processed = processed.filter((p) => {
          const res = resultMap.get(getProxyKey(p))
          return isValidNode(res?.delay ?? 0, automation.cleanThreshold)
        })
      }
      if (automation.sort) {
        processed = sortProxiesByDelayData(processed, nextDelayData)
      }
      const activeKeys = new Set(processed.map(getProxyKey))
      const cleanedDelayData = nextDelayData.filter((d) => activeKeys.has(getProxyKey(d)))
      await DelayDataStore.save(cleanedDelayData, subscription.id)
      return restoreProxies(processed)
    } catch (err) {
      console.error(`[${plugin.name}] 订阅自动处理时发生错误`, err)
      return rawProxies
    } finally {
      await stopRuntimeContext(subscription.id)
      runtimeState.automationSubIds.delete(subscription.id)
    }
  }
  const onShutdown = async () => {
    for (const id of runtimeContextMap.keys()) {
      await stopRuntimeContext(id)
    }
  }
  const onInstall = async () => {
    await saveJson(settingsPath, DEFAULT_PLUGIN_SETTINGS)
  }
  const onUninstall = async () => {
    await Plugins.RemoveFile(cachePath)
  }
  return {
    testDelay,
    onRun,
    onSubscribe,
    onShutdown,
    onInstall,
    onUninstall
  }
}
