const DEFAULT_PLUGIN_SETTINGS = Object.freeze({
  testUrl: 'Google',
  testTimeout: 5000,
  concurrencyLimit: 20,
  cleanThreshold: 0
})
const DEFAULT_AUTOMATION_CONFIG = Object.freeze({
  enabled: false,
  sort: false,
  clean: false,
  cleanThreshold: 0
})
const TEST_URL_MAP = Object.freeze({
  Google: 'http://www.gstatic.com/generate_204',
  Cloudflare: 'http://cp.cloudflare.com/generate_204',
  Qualcomm: 'http://www.qualcomm.cn/generate_204',
  Apple: 'http://www.apple.com/library/test/success.html',
  Microsoft: 'http://www.msftconnecttest.com/connecttest.txt'
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
    await Plugins.WriteFile(filePath, JSON.stringify(data, null, 2))
  }
  const loadJson = async (filePath, defaultValue) => {
    if (!(await Plugins.FileExists(filePath))) {
      return Plugins.deepClone(defaultValue)
    }
    const content = await Plugins.ReadFile(filePath)
    return JSON.parse(content)
  }
  const createStorage = (pathGenerator, defaultVal) => {
    return {
      load: (id = '') => loadJson(pathGenerator(id), defaultVal),
      save: async (data, id = '') => {
        await saveJson(pathGenerator(id), data)
      }
    }
  }
  const normalizeProxy = (p) => ({ tag: p.tag ?? p.name, type: p.type, raw: p })
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
        toRuntimeConfig: (proxies, controller, secret) => ({
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
          await Plugins.WriteFile(subscription.path, Plugins.YAML.stringify({ proxies: restoreProxies(proxies) }))
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
        toRuntimeConfig: (proxies, controller, secret) => ({
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
  const getAutomationConfigPath = (subId) => `${cachePath}/${subId}/automation.json`
  const SettingsStore = createStorage(() => settingsPath, DEFAULT_PLUGIN_SETTINGS)
  const DelayDataStore = createStorage(getDelayDataPath, [])
  const AutomationStore = createStorage(getAutomationConfigPath, DEFAULT_AUTOMATION_CONFIG)
  const adapter = createClientAdapter(envStore.env.appName)
  const sortProxiesByDelay = (proxies, delayDataList) => {
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
      const { body } = await Plugins.HttpGet(
        url.toString(),
        {
          Authorization: `Bearer ${secret}`
        },
        {
          Timeout: Number(timeout)
        }
      )
      return body.delay ?? -1
    } catch {
      return -1
    }
  }
  const testSingleProxy = async (ctx, proxy, settings) => {
    const delay = await getProxyDelay({
      baseUrl: ctx.baseUrl,
      proxy: proxy.tag,
      testUrl: TEST_URL_MAP[settings.testUrl],
      timeout: String(settings.testTimeout),
      secret: ctx.secret
    })
    return { proxy, delay, lastTestTime: Date.now() }
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
    let updateUI
    let destroyUI
    let successUI
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
          Plugins.message.warn(updateMsgText('已取消测试'))
        } else {
          successUI?.(updateMsgText('测试完成'))
          await Plugins.sleep(3_000)
        }
      }
    } finally {
      destroyUI?.()
    }
    return { total: totalCount, success, failure, cancelled, results }
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
      out = await Plugins.Exec('netstat', ['-an'], { Convert: true })
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
    const runtimeConfig = adapter.runtime.toRuntimeConfig(unifiedProxies, controller, secret)
    await Plugins.WriteFile(configPath, adapter.runtime.serializeRuntimeConfig(runtimeConfig))
    try {
      const pid = await runCore(configPath, subDir)
      const ctx = { pid, baseUrl, secret, configPath, started: true }
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
  const persistUIStateOnClose = async (subscription, proxies, delayDataList) => {
    const sorted = sortProxiesByDelay(proxies, delayDataList)
    const activeProxyKeys = new Set(sorted.map(getProxyKey))
    const cleanedDelayData = delayDataList.filter((d) => activeProxyKeys.has(getProxyKey(d)))
    await DelayDataStore.save(cleanedDelayData, subscription.id)
    await adapter.data.writeRawProxies(subscription, sorted)
    adapter.data.writeSubscriptionMeta(subscription, sorted)
    await subscribesStore.editSubscribe(subscription.id, subscription)
  }
  const openUI = (subscription, ctx) => {
    const { ref, computed, onMounted, defineComponent, h, resolveComponent } = Vue
    const settings = ref({ ...DEFAULT_PLUGIN_SETTINGS })
    const automationConfig = ref({ ...DEFAULT_AUTOMATION_CONFIG })
    const delayDataMap = ref({})
    const proxiesList = ref([])
    const testingMap = ref({})
    const allTesting = ref(false)
    const loadData = async () => {
      settings.value = await SettingsStore.load()
      automationConfig.value = await AutomationStore.load(subscription.id)
      const unifiedProxies = await adapter.data.readRawProxies(subscription)
      proxiesList.value = unifiedProxies
      const persistedDelayData = await DelayDataStore.load(subscription.id)
      const persistedMap = new Map(persistedDelayData.map((d) => [getProxyKey(d), d]))
      const initMap = {}
      unifiedProxies.forEach((p) => {
        const key = getProxyKey(p)
        initMap[key] = persistedMap.get(key) ?? {
          id: Plugins.sampleID(),
          tag: p.tag,
          type: p.type,
          delay: 0,
          lastTestTime: 0
        }
      })
      delayDataMap.value = initMap
    }
    const sortedProxies = computed(() => sortProxiesByDelay(proxiesList.value, Object.values(delayDataMap.value)))
    const getDelay = (proxy) => delayDataMap.value[getProxyKey(proxy)]?.delay ?? 0
    const updateDelayRecord = (proxy, delay, lastTestTime = Date.now()) => {
      const key = getProxyKey(proxy)
      if (delayDataMap.value[key]) {
        delayDataMap.value[key].delay = delay
        delayDataMap.value[key].lastTestTime = lastTestTime
      } else {
        delayDataMap.value[key] = {
          id: Plugins.sampleID(),
          tag: proxy.tag,
          type: proxy.type,
          delay,
          lastTestTime
        }
      }
    }
    const deleteNode = async (proxy) => {
      if (!(await Plugins.confirm('提示', `确定要从订阅中删除节点 [${proxy.tag}] 吗？`).catch(() => false))) return
      const key = getProxyKey(proxy)
      proxiesList.value = proxiesList.value.filter((p) => getProxyKey(p) !== key)
      delete delayDataMap.value[key]
      Plugins.message.success('节点删除成功')
    }
    const cleanNodes = async (threshold) => {
      const text = threshold > 0 ? `延迟大于 ${threshold}ms 与测试失败` : '测试失败'
      if (!(await Plugins.confirm('清理节点', `确定要删除所有${text}的节点吗？`).catch(() => false))) return false
      settings.value.cleanThreshold = threshold
      const toKeep = proxiesList.value.filter((p) => isValidNode(getDelay(p), threshold))
      const deleteCount = proxiesList.value.length - toKeep.length
      if (deleteCount === 0) {
        Plugins.message.info('未找到需要清理的节点')
        return false
      }
      proxiesList.value = toKeep
      const keepKeys = new Set(toKeep.map(getProxyKey))
      for (const key of Object.keys(delayDataMap.value)) {
        if (!keepKeys.has(key)) {
          delete delayDataMap.value[key]
        }
      }
      Plugins.message.success(`成功清理了 ${deleteCount} 个节点`)
      return true
    }
    const testSingleNode = async (proxy) => {
      const key = getProxyKey(proxy)
      if (testingMap.value[key]) return
      if (!ctx.started) {
        Plugins.message.error('测试核心未就绪')
        return
      }
      testingMap.value[key] = true
      try {
        const result = await testSingleProxy(ctx, proxy, settings.value)
        updateDelayRecord(result.proxy, result.delay, result.lastTestTime)
      } finally {
        testingMap.value[key] = false
      }
    }
    const testAllNodes = async () => {
      if (allTesting.value) return
      const queue = [...sortedProxies.value]
      const queueKeys = new Set(queue.map(getProxyKey))
      allTesting.value = true
      try {
        await testAllProxies(ctx, queue, settings.value, {
          onProxyStart: (proxy) => {
            testingMap.value[getProxyKey(proxy)] = true
          },
          onProxyTested: (result) => {
            const key = getProxyKey(result.proxy)
            updateDelayRecord(result.proxy, result.delay, result.lastTestTime)
            testingMap.value[key] = false
          }
        })
      } catch (err) {
        Plugins.message.error(String(err))
      } finally {
        queueKeys.forEach((key) => {
          testingMap.value[key] = false
        })
        allTesting.value = false
      }
    }
    const openSettingsUI = () => {
      const draft = ref({ ...settings.value })
      const component = defineComponent({
        template: `
        <div class="w-full h-full p-8">
          <div class="form-item">
            <div class="mr-8">测试地址</div>
            <Select v-model="draft.testUrl" :options="urlOptions" />
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
          const urlOptions = Object.keys(TEST_URL_MAP).map((k) => ({ label: k, value: k }))
          return { draft, urlOptions }
        }
      })
      const modal = Plugins.modal({
        title: '插件配置',
        width: '35',
        submitText: '保存',
        cancelText: '取消',
        onOk: async () => {
          settings.value = { ...draft.value }
          await SettingsStore.save(settings.value)
          Plugins.message.success('插件配置保存成功')
          return true
        },
        afterClose: () => {
          modal.destroy()
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const openAutomationUI = () => {
      const draft = ref({ ...automationConfig.value })
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
          return { draft }
        }
      })
      const modal = Plugins.modal({
        title: '订阅自动化处理',
        width: '35',
        submitText: '保存',
        cancelText: '取消',
        onOk: async () => {
          automationConfig.value = { ...draft.value }
          await AutomationStore.save(automationConfig.value, subscription.id)
          Plugins.message.success('自动化配置保存成功')
          return true
        },
        afterClose: () => {
          modal.destroy()
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const openCleanUI = () => {
      const threshold = ref(settings.value.cleanThreshold)
      const component = defineComponent({
        template: `
        <div class="w-full h-full p-8">
          <div class="form-item">
            <div class="mr-8">清理阈值(ms)</div>
            <div class="max-w-[75%]">
              <Input type="number" v-model="threshold" :min="0" class="w-full" editable />
            </div>
          </div>
          <div class="text-12 text-gray-500 mt-8 ml-auto w-[60%] max-w-[360px]">输入 0 仅清理测试失败的节点</div>
        </div>
        `,
        setup() {
          return { threshold }
        }
      })
      const modal = Plugins.modal({
        title: '清理节点',
        width: '35',
        submitText: '清理',
        cancelText: '取消',
        onOk: () => cleanNodes(threshold.value),
        afterClose: () => {
          modal.destroy()
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
          <Card v-for="proxy in sortedProxies" :key="proxy.tag" :title="proxy.tag" class="w-full">
            <template #extra>
              <Button class="text-red-500 hover:text-red-700" size="small" type="text" icon="delete" @click.stop="deleteNode(proxy)" />
            </template>

            <div class="flex items-center justify-between min-h-[50px] pt-4">
              <div class="text-12 leading-none">
                {{ proxy.type }}
              </div>

              <Button
                class="font-bold text-12 leading-none -mr-8"
                :style="{ color: getDelayColor(getDelay(proxy)) }"
                :loading="testingMap[proxy.tag + '_' + proxy.type]"
                size="small"
                type="text"
                @click.stop="testSingleNode(proxy)"
              >
                {{ getDelay(proxy) === 0 ? '测试' : getDelay(proxy) + ' ms' }}
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
                  onClick: openAutomationUI
                },
                () => '自动处理'
              ),
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
                  onClick: () => {
                    if (allTesting.value) return
                    void testAllNodes()
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
                    if (allTesting.value) {
                      Plugins.message.warn('请等待测试完成...')
                      return
                    }
                    try {
                      await persistUIStateOnClose(subscription, proxiesList.value, Object.values(delayDataMap.value))
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
          testingMap,
          allTesting,
          getDelay,
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
      Plugins.message.warn('主核心运行中，可能影响测试结果')
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
    const automation = await AutomationStore.load(subscription.id)
    if (!automation.enabled) return rawProxies
    if (isSubUIActive(subscription.id)) {
      Plugins.message.warn('当前订阅界面已开启，跳过更新时的自动处理')
      return rawProxies
    }
    runtimeState.automationSubIds.add(subscription.id)
    try {
      const settings = await SettingsStore.load()
      const normalizedProxies = adapter.data.normalizeProxies(rawProxies)
      const ctx = await startRuntimeContext(subscription, normalizedProxies)
      const { results } = await testAllProxies(ctx, normalizedProxies, settings, { silent: true })
      const delayMap = new Map(results.map((r) => [getProxyKey(r.proxy), r.delay]))
      const nextDelayData = normalizedProxies.map((p) => ({
        id: Plugins.sampleID(),
        tag: p.tag,
        type: p.type,
        delay: delayMap.get(getProxyKey(p)) ?? 0,
        lastTestTime: Date.now()
      }))
      let processed = normalizedProxies
      if (automation.clean) {
        processed = processed.filter((p) => isValidNode(delayMap.get(getProxyKey(p)) ?? 0, automation.cleanThreshold))
      }
      if (automation.sort) {
        processed = sortProxiesByDelay(processed, nextDelayData)
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
  return { testDelay, onRun, onSubscribe, onShutdown, onInstall, onUninstall }
}
