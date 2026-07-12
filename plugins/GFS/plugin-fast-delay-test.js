/**
 * @template T
 * @typedef {import('vue').Ref<T>} Ref
 */
/**
 * @typedef {{ id: string, name: string, path: string, proxies: Array<RawProxy & { id: string }> }} Subscription
 * @typedef {{ id: string, tag: string, type: string, delay: number, lastTestTime: number }} ProxyDelayData
 * @typedef {{ proxy: RawProxy, delay: number, lastTestTime: number }} SingleProxyTestResult
 * @typedef {{ total: number, success: number, failure: number, cancelled: boolean, results: SingleProxyTestResult[] }} TestAllProxiesResult
 * @typedef {{ silent?: boolean, onProxyStart?: (proxy: RawProxy) => void, onProxyTested?: (result: SingleProxyTestResult) => void }} TestAllProxiesOptions
 * @typedef {{ testUrl: keyof typeof TEST_URL_MAP, testTimeout: number, concurrencyLimit: number, cleanThreshold: number }} PluginSettings
 * @typedef {{ enabled: boolean, sort: boolean, clean: boolean, cleanThreshold: number }} SubscriptionAutomationConfig
 * @typedef {{ baseUrl: string, proxy: string, testUrl: string, timeout: string, secret: string }} ProxyDelayGetParams
 * @typedef {{ pid: number, baseUrl: string, secret: string, configPath: string, started: boolean }} RuntimeContext
 * @typedef {{ tag: string, type: string }} RawProxy
 * @typedef {{ uiSubId: string | null, automationSubIds: Set<string> }} RuntimeState
 */
/** @type {EsmPlugin} */
export default (plugin) => {
  const cachePath = `data/.cache/${plugin.id}`
  const settingsPath = `${cachePath}/settings.json`
  const appSettingsStore = Plugins.useAppSettingsStore()
  const kernelApiStore = Plugins.useKernelApiStore()
  const subscribesStore = Plugins.useSubscribesStore()
  /** @type {Map<string, RuntimeContext>} */
  const runtimeContextMap = new Map()
  /** @type {RuntimeState} */
  const runtimeState = {
    uiSubId: null,
    automationSubIds: new Set()
  }
  /**
   * 触发器：手动运行时
   */
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
    testDelay(selectedSub)
  }
  /**
   * 触发器：订阅更新时
   * @param {RawProxy[]} proxies
   * @param {Subscription} subscription
   * @returns {Promise<RawProxy[]>}
   */
  const onSubscribe = async (proxies, subscription) => {
    const automation = await AutomationStore.load(subscription.id)
    if (!automation.enabled) return proxies
    if (isSubUIActive(subscription.id)) {
      Plugins.message.warn('当前订阅界面已开启，跳过更新时的自动处理')
      return proxies
    }
    runtimeState.automationSubIds.add(subscription.id)
    let ctx = null
    try {
      const settings = await SettingsStore.load()
      ctx = await startRuntimeContext(subscription, proxies)
      const { results } = await testAllProxies(ctx, proxies, settings, { silent: true })
      const delayMap = new Map(results.map((r) => [getProxyKey(r.proxy), r.delay]))
      const nextDelayData = proxies.map((p) => ({
        id: Plugins.sampleID(),
        tag: p.tag,
        type: p.type,
        delay: delayMap.get(getProxyKey(p)) ?? 0,
        lastTestTime: Date.now()
      }))
      let processed = proxies
      if (automation.clean) {
        processed = processed.filter((p) => isValidNode(delayMap.get(getProxyKey(p)) ?? 0, automation.cleanThreshold))
      }
      if (automation.sort) {
        processed = sortProxiesByDelay(processed, nextDelayData)
      }
      const activeKeys = new Set(processed.map(getProxyKey))
      const cleanedDelayData = nextDelayData.filter((d) => activeKeys.has(getProxyKey(d)))
      await DelayDataStore.save(cleanedDelayData, subscription.id)
      return processed
    } catch (err) {
      console.error(`[${plugin.name}] 订阅自动处理时发生错误`, err)
      return proxies
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
  /**
   * @param {Subscription} subscription
   */
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
      await openUI(subscription, ctx)
    } catch (err) {
      runtimeState.uiSubId = null
      throw err
    }
  }
  /**
   * @param {Subscription} subscription
   * @param {RuntimeContext} ctx
   */
  const openUI = async (subscription, ctx) => {
    const { ref, computed, onMounted, defineComponent, h, resolveComponent } = Vue
    /** @type {Ref<PluginSettings>} */
    const settings = ref({ ...DEFAULT_PLUGIN_SETTINGS })
    /** @type {Ref<SubscriptionAutomationConfig>} */
    const automationConfig = ref({ ...DEFAULT_AUTOMATION_CONFIG })
    /** @type {Ref<Record<string, ProxyDelayData>>} */
    const delayDataMap = ref({})
    /** @type {Ref<RawProxy[]>} */
    const proxiesList = ref([])
    /** @type {Ref<Record<string, boolean>>} */
    const testingMap = ref({})
    /** @type {Ref<boolean>} */
    const allTesting = ref(false)
    const loadData = async () => {
      settings.value = await SettingsStore.load()
      automationConfig.value = await AutomationStore.load(subscription.id)
      /** @type {RawProxy[]} */
      const rawProxies = await loadJson(subscription.path, [])
      proxiesList.value = rawProxies
      /** @type {ProxyDelayData[]} */
      const persistedDelayData = await DelayDataStore.load(subscription.id)
      /** @type {Map<string, ProxyDelayData>} */
      const persistedMap = new Map(persistedDelayData.map((d) => [getProxyKey(d), d]))
      /** @type {Record<string, ProxyDelayData>} */
      const initMap = {}
      rawProxies.forEach((p) => {
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
    /**
     * @param {RawProxy} proxy
     */
    const getDelay = (proxy) => delayDataMap.value[getProxyKey(proxy)]?.delay ?? 0
    /**
     * @param {RawProxy} proxy
     * @param {number} delay
     * @param {number} [lastTestTime]
     */
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
    /**
     * @param {RawProxy} proxy
     */
    const deleteNode = async (proxy) => {
      if (!(await Plugins.confirm('提示', `确定要从订阅中删除节点 [${proxy.tag}] 吗？`).catch(() => false))) return
      const key = getProxyKey(proxy)
      proxiesList.value = proxiesList.value.filter((p) => getProxyKey(p) !== key)
      delete delayDataMap.value[key]
      Plugins.message.success('节点删除成功')
    }
    /**
     * @param {number} threshold
     */
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
    /**
     * @param {RawProxy} proxy
     */
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
      /** @type {Ref<PluginSettings>} */
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
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const openAutomationUI = () => {
      /** @type {Ref<SubscriptionAutomationConfig>} */
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
        }
      })
      modal.setContent(component)
      modal.open()
    }
    const openCleanUI = () => {
      /** @type {Ref<number>} */
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
        onOk: () => {
          return cleanNodes(threshold.value)
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
                    testAllNodes()
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
  /**
   * @param {Subscription} subscription
   * @param {RawProxy[]} [outbounds]
   * @returns {Promise<RuntimeContext>}
   */
  const startRuntimeContext = async (subscription, outbounds) => {
    const existing = runtimeContextMap.get(subscription.id)
    if (existing?.started) return existing
    const rawProxies = outbounds ?? (await loadJson(subscription.path, []))
    if (rawProxies.length === 0) {
      throw '此订阅内无节点可供测试'
    }
    const secret = Plugins.generateSecureKey()
    const randomPort = Math.floor(Math.random() * 30000) + 30000
    const controller = `127.0.0.1:${randomPort}`
    const baseUrl = `http://${controller}`
    const subDir = `${cachePath}/${subscription.id}`
    await Plugins.MakeDir(subDir).catch(() => {})
    const configPath = `${subDir}/config.json`
    /** @type {Omit<typeof BASE_CONFIG, 'outbounds'> & { outbounds: RawProxy[] }} */
    const runtimeConfig = {
      ...BASE_CONFIG,
      outbounds: rawProxies,
      experimental: {
        ...BASE_CONFIG.experimental,
        clash_api: {
          external_controller: controller,
          secret
        }
      }
    }
    await Plugins.WriteFile(configPath, JSON.stringify(runtimeConfig))
    try {
      const pid = await runCore(configPath, subDir)
      const ctx = { pid, baseUrl, secret, configPath, started: true }
      runtimeContextMap.set(subscription.id, ctx)
      return ctx
    } catch (err) {
      await Plugins.RemoveFile(configPath).catch(() => {})
      throw `测试核心启动失败: ${err}`
    }
  }
  /**
   * @param {string} subId
   */
  const stopRuntimeContext = async (subId) => {
    const ctx = runtimeContextMap.get(subId)
    if (!ctx) return
    if (ctx.pid) await Plugins.KillProcess(ctx.pid).catch(() => {})
    if (ctx.configPath) await Plugins.RemoveFile(ctx.configPath).catch(() => {})
    runtimeContextMap.delete(subId)
  }
  /**
   * @param {Subscription} subscription
   * @param {RawProxy[]} proxies
   * @param {ProxyDelayData[]} delayDataList
   */
  const persistUIStateOnClose = async (subscription, proxies, delayDataList) => {
    const sorted = sortProxiesByDelay(proxies, delayDataList)
    const activeProxyKeys = new Set(sorted.map(getProxyKey))
    const cleanedDelayData = delayDataList.filter((d) => activeProxyKeys.has(getProxyKey(d)))
    await DelayDataStore.save(cleanedDelayData, subscription.id)
    await saveJson(subscription.path, sorted, false)
    const existSubMap = new Map(subscription.proxies.map((sp) => [getProxyKey(sp), sp]))
    subscription.proxies = sorted.map((p) => ({
      id: existSubMap.get(getProxyKey(p))?.id ?? Plugins.sampleID(),
      tag: p.tag,
      type: p.type ?? ''
    }))
    await subscribesStore.editSubscribe(subscription.id, subscription)
  }
  /**
   * @template {RawProxy} T
   * @param {T[]} proxies
   * @param {ProxyDelayData[]} delayDataList
   * @returns {T[]}
   */
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
  /**
   * @param {RuntimeContext} ctx
   * @param {RawProxy[]} proxies
   * @param {PluginSettings} settings
   * @param {TestAllProxiesOptions} options
   * @returns {Promise<TestAllProxiesResult>}
   */
  const testAllProxies = async (ctx, proxies, settings, options) => {
    let index = 0
    let success = 0
    let failure = 0
    let cancelled = false
    const totalCount = proxies.length
    const { silent = false, onProxyStart, onProxyTested } = options
    /** @type {SingleProxyTestResult[]} */
    const results = []
    /**
     * @param {string} prefix
     */
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
    /** @type {((msg: string) => void) | undefined }*/
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
  /**
   * @param {RuntimeContext} ctx
   * @param {RawProxy} proxy
   * @param {PluginSettings} settings
   * @returns {Promise<SingleProxyTestResult>}
   */
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
  /**
   * @param {ProxyDelayGetParams} opts
   * @returns {Promise<number>}
   */
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
  /**
   * @param {string} targetConfigPath
   * @param {string} subDir
   * @returns {Promise<number>}
   */
  const runCore = async (targetConfigPath, subDir) => {
    const isAlpha = appSettingsStore.app.kernel.branch === 'alpha'
    const core = await Plugins.getKernelFileName(isAlpha)
    const [corePath, configPath, workingDir] = await Promise.all([
      Plugins.AbsolutePath(`data/sing-box/${core}`),
      Plugins.AbsolutePath(targetConfigPath),
      Plugins.AbsolutePath(subDir)
    ])
    return new Promise((resolve, reject) => {
      let output = ''
      const pid = Plugins.ExecBackground(
        corePath,
        ['run', '--disable-color', '-c', configPath, '-D', workingDir],
        (out) => {
          output = out
          if (out.includes(CORE_STOP_OUTPUT_KEYWORD)) {
            resolve(pid)
          }
        },
        () => {
          reject(output)
        },
        {
          StopOutputKeyword: CORE_STOP_OUTPUT_KEYWORD
        }
      ).catch((e) => {
        reject(e)
      })
    })
  }
  /**
   * @param {number} delay
   */
  const getDelayColor = (delay) => {
    if (delay === 0) return 'var(--level-0-color)'
    if (delay === -1) return 'var(--level-4-color)'
    if (delay < 500) return 'var(--level-1-color)'
    if (delay < 1000) return 'var(--level-2-color)'
    if (delay < 1500) return 'var(--level-3-color)'
    return 'var(--level-4-color)'
  }
  /**
   * @param {RawProxy} proxy
   */
  const getProxyKey = (proxy) => `${proxy.tag}_${proxy.type}`
  /**
   * @param {string} subId
   */
  const getDelayDataPath = (subId) => `${cachePath}/${subId}/delay-data.json`
  /**
   * @param {string} subId
   */
  const getAutomationConfigPath = (subId) => `${cachePath}/${subId}/automation.json`
  /**
   * @template T
   * @param {(id: string) => string} pathGenerator
   * @param {T} defaultVal
   * @returns {{ load: (id?: string) => Promise<T>, save: (data: T, id?: string) => Promise<void> }}
   */
  const createStorage = (pathGenerator, defaultVal) => ({
    load: (id = '') => loadJson(pathGenerator(id), defaultVal),
    save: (data, id = '') => saveJson(pathGenerator(id), data)
  })
  const SettingsStore = createStorage(() => settingsPath, DEFAULT_PLUGIN_SETTINGS)
  const DelayDataStore = createStorage(getDelayDataPath, [])
  const AutomationStore = createStorage(getAutomationConfigPath, DEFAULT_AUTOMATION_CONFIG)
  /**
   * @param {string} filePath
   */
  const getParentDir = (filePath) => {
    const lastSlashIndex = filePath.lastIndexOf('/')
    return lastSlashIndex === -1 ? '' : filePath.slice(0, lastSlashIndex)
  }
  /**
   * @template T
   * @param {string} filePath
   * @param {T} defaultValue
   * @returns {Promise<T>}
   */
  const loadJson = async (filePath, defaultValue) => {
    if (!(await Plugins.FileExists(filePath))) {
      return Plugins.deepClone(defaultValue)
    }
    const content = await Plugins.ReadFile(filePath)
    return JSON.parse(content)
  }
  /**
   * @param {string} filePath
   * @param {unknown} data -
   * @param {boolean} [ensureDirExist=true]
   */
  const saveJson = async (filePath, data, ensureDirExist = true) => {
    if (ensureDirExist) {
      const parentDir = getParentDir(filePath)
      if (parentDir) {
        await Plugins.MakeDir(parentDir).catch(() => {})
      }
    }
    await Plugins.WriteFile(filePath, JSON.stringify(data, null, 2))
  }
  /**
   * @param {number} delay
   * @param {number} threshold
   */
  const isValidNode = (delay, threshold) => {
    if (delay === -1) return false
    return threshold <= 0 || delay <= threshold
  }
  /**
   * @param {string} subId
   */
  const isSubUIActive = (subId) => runtimeState.uiSubId === subId
  /**
   * @param {string} subId
   */
  const isAutomationActive = (subId) => runtimeState.automationSubIds.has(subId)
  return { testDelay, onRun, onSubscribe, onShutdown, onInstall, onUninstall }
}
/** @type {Readonly<PluginSettings>} */
const DEFAULT_PLUGIN_SETTINGS = Object.freeze({
  testUrl: 'Google',
  testTimeout: 5000,
  concurrencyLimit: 20,
  cleanThreshold: 0
})
/** @type {Readonly<SubscriptionAutomationConfig>} */
const DEFAULT_AUTOMATION_CONFIG = Object.freeze({
  enabled: false,
  sort: false,
  clean: false,
  cleanThreshold: 0
})
const CORE_STOP_OUTPUT_KEYWORD = 'sing-box started'
const TEST_URL_MAP = Object.freeze({
  Google: 'http://www.gstatic.com/generate_204',
  Cloudflare: 'http://cp.cloudflare.com/generate_204',
  Qualcomm: 'http://www.qualcomm.cn/generate_204',
  Apple: 'http://www.apple.com/library/test/success.html',
  Microsoft: 'http://www.msftconnecttest.com/connecttest.txt'
})
const BASE_CONFIG = Object.freeze({
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
})
