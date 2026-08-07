/* 批量下载测速：两阶段流程 —— 先对全部节点并发延迟预检（不切换节点），再仅对合格节点按延迟升序串行真实下载测速。 */

let batchRunPromise = null

/** 历史测速结果保存文件路径（仅保存纯数据 JSON）。 */
const historyFilePath = () => 'data/plugin-data/batch-download-speed/results.json'

/** 串行化历史结果写入队列，避免并发写盘导致文件内容顺序错乱。 */
let historySaveTask = Promise.resolve()

/** 将一轮测速结果持久化保存；写入失败静默忽略，不打断测速流程。 */
const saveHistory = (payload) => {
  historySaveTask = historySaveTask.then(async () => {
    try {
      await Plugins.MakeDir('data/plugin-data/batch-download-speed')
      await Plugins.WriteFile(historyFilePath(), JSON.stringify(payload, null, 2))
    } catch {
      /* 保存失败不影响测速流程 */
    }
  })
  return historySaveTask
}

/** 读取上一次保存的测速历史；文件不存在或解析失败时返回 null（不抛错）。
 * 兼容旧版本结果：缺少 delay/groupName/testUrl/testedAt 时补齐默认值。 */
const loadHistory = async () => {
  try {
    const raw = await Plugins.ReadFile(historyFilePath())
    if (!raw) return null
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || !Array.isArray(data.results)) return null
    data.results = data.results.map((row) => ({
      ...row,
      delay: Number.isFinite(Number(row.delay)) && Number(row.delay) > 0 ? Number(row.delay) : null,
      groupName: row.groupName || data.groupName || '',
      testUrl: row.testUrl || data.testUrl || '',
      testedAt: row.testedAt || data.savedAt || ''
    }))
    return data
  } catch {
    return null
  }
}

const onRun = async () => {
  if (batchRunPromise) {
    Plugins.message.warn('批量测速正在进行中，请先关闭当前面板或停止测试')
    return
  }
  const modal = Plugins.modal({
    title: Plugin.name || '批量真实下载测速',
    width: '80',
    height: '85',
    submit: false,
    cancelText: '关闭',
    onCancel: async () => {
      if (runBatchTest.active) {
        runBatchTest.stop?.()
        await runBatchTest.active
      }
      return true
    }
  })

  const content = {
    template: `
      <div class="p-8 text-12">
        <div class="grid grid-cols-2 gap-8">
          <div><div class="text-gray-500 mb-4">策略组</div><Select v-model="form.group" :options="groupOptions" :disabled="running" /></div>
          <div><div class="text-gray-500 mb-4">下载测试 URL</div><Input v-model="form.url" :disabled="running" /></div>
          <div><div class="text-gray-500 mb-4">延迟测试 URL</div><Input v-model="form.pingUrl" :disabled="running" /></div>
          <div><div class="text-gray-500 mb-4">最大延迟（毫秒）</div><Input v-model="form.maxDelay" type="number" :disabled="running" /></div>
          <div><div class="text-gray-500 mb-4">下载时长（秒）</div><Input v-model="form.seconds" type="number" :disabled="running" /></div>
          <div><div class="text-gray-500 mb-4">预检并发数</div><Input v-model="form.concurrency" type="number" :disabled="running" /></div>
          <div><div class="text-gray-500 mb-4">节点数量限制（0=全部）</div><Input v-model="form.limit" type="number" :disabled="running" /></div>
          <div><div class="text-gray-500 mb-4">下载数量限制（0=全部合格节点）</div><Input v-model="form.downloadLimit" type="number" :disabled="running" /></div>
        </div>
        <div class="mt-8 p-8 rounded bg-gray-50 dark:bg-gray-800">
          <div class="flex items-center justify-between"><span>{{ statusText }}</span><span>{{ progress }}/{{ total }}</span></div>
          <div class="mt-6 h-4 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden"><div class="h-full bg-primary transition-all" :style="{width: progressPercent + '%'}"></div></div>
          <div class="mt-6 text-gray-500">当前节点：<span class="text-current">{{ currentNode || '—' }}</span></div>
        </div>
        <div class="flex gap-8 mt-8">
          <Button type="primary" :loading="running" @click="start">{{ running ? '测试中…' : '开始测试' }}</Button>
          <Button v-if="running" @click="stop">停止</Button>
          <Button v-else @click="clear">清空结果</Button>
        </div>
        <div class="mt-8 overflow-auto" style="max-height: 42vh">
          <table class="w-full text-12"><thead><tr class="text-left text-gray-500"><th class="p-4">节点</th><th class="p-4">延迟</th><th class="p-4">状态</th><th class="p-4">MB/s</th><th class="p-4">Mbps</th><th class="p-4">下载量</th><th class="p-4">有效时间</th><th class="p-4">错误原因</th><th class="p-4">操作</th></tr></thead>
          <tbody><tr v-for="row in results" :key="row.key || row.name" class="border-t border-gray-200 dark:border-gray-700"><td class="p-4">{{ row.name }}</td><td class="p-4">{{ formatDelay(row.delay) }}</td><td class="p-4">{{ row.status }}</td><td class="p-4">{{ row.mb }}</td><td class="p-4">{{ row.mbps }}</td><td class="p-4">{{ row.bytesText }}</td><td class="p-4">{{ row.time }}</td><td class="p-4 text-red-500">{{ row.error || '—' }}</td><td class="p-4"><Button size="small" type="primary" :disabled="running || row.status !== '成功'" @click="useResult(row)">使用</Button></td></tr></tbody></table>
          <div v-if="!results.length" class="py-24 text-center text-gray-500">选择策略组后开始测试</div>
        </div>
        <div class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <span class="text-gray-500">历史结果<span v-if="history"> · 保存于 {{ formatTime(history.savedAt) }} · 策略组 {{ history.groupName || '—' }} · 测试 URL {{ history.testUrl || '—' }}</span></span>
            <Button v-if="history" size="small" @click="deleteHistory">删除历史</Button>
          </div>
          <div v-if="!history" class="py-12 text-center text-gray-500">暂无历史记录</div>
          <div v-else class="overflow-auto" style="max-height: 30vh">
            <table class="w-full text-12"><thead><tr class="text-left text-gray-500"><th class="p-4">节点</th><th class="p-4">延迟</th><th class="p-4">状态</th><th class="p-4">MB/s</th><th class="p-4">Mbps</th><th class="p-4">下载量</th><th class="p-4">有效时间</th><th class="p-4">错误原因</th><th class="p-4">操作</th></tr></thead>
            <tbody><tr v-for="row in history.results" :key="row.key || row.name" class="border-t border-gray-200 dark:border-gray-700"><td class="p-4">{{ row.name }}</td><td class="p-4">{{ formatDelay(row.delay) }}</td><td class="p-4">{{ row.status }}</td><td class="p-4">{{ row.mb }}</td><td class="p-4">{{ row.mbps }}</td><td class="p-4">{{ row.bytesText }}</td><td class="p-4">{{ row.time }}</td><td class="p-4 text-red-500">{{ row.error || '—' }}</td><td class="p-4"><Button size="small" type="primary" :disabled="running || row.status !== '成功'" @click="useResult(row)">使用</Button></td></tr></tbody></table>
          </div>
        </div>
      </div>`,
    setup() {
      const { ref, computed, onMounted } = Vue
      const api = Plugins.useKernelApiStore()
      /** 获取当前可供测试的 Selector 策略组。 */
      const selectors = () => Object.values(api.proxies || {}).filter((p) => p?.type === 'Selector' && Array.isArray(p.all) && p.all.length)
      const initial = selectors()
      const form = ref({
        group:
          Plugin.GroupName && initial.some((p) => p.name === Plugin.GroupName || p.tag === Plugin.GroupName)
            ? Plugin.GroupName
            : initial[0]?.name || initial[0]?.tag || '',
        url: Plugin.TestUrl || 'http://hkg.download.datapacket.com/100mb.bin',
        pingUrl: Plugin.PingUrl || 'https://www.gstatic.com/generate_204',
        maxDelay: Number(Plugin.MaxDelayMs) || 3000,
        seconds: Number(Plugin.TimeoutSeconds) || 5,
        concurrency: Number(Plugin.PrecheckConcurrency) || 10,
        limit: Number(Plugin.NodeCount) || 0,
        downloadLimit: Number(Plugin.DownloadLimit) || 0
      })
      const results = ref([])
      const running = ref(false)
      const progress = ref(0)
      const total = ref(0)
      const currentNode = ref('')
      const statusText = ref('准备就绪')
      const groupOptions = computed(() => selectors().map((p) => ({ label: p.name || p.tag, value: p.name || p.tag })))
      const progressPercent = computed(() => (total.value ? Math.round((progress.value * 100) / total.value) : 0))
      const history = ref(null)
      /** 将时间戳格式化为本地可读文本。 */
      const formatTime = (value) => (value ? new Date(value).toLocaleString() : '未知')
      /** 将有效延迟格式化为 "123 ms"，无效或缺失时显示占位符。 */
      const formatDelay = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? `${Math.round(Number(value))} ms` : '—')
      /** 将一条成功测速结果对应的节点，直接切换为当前 Selector 的选择；不做任何测速恢复。 */
      const useResult = async (row) => {
        if (running.value) return Plugins.message.warn('批量测速进行中，请先停止测试再使用节点')
        if (row.status !== '成功') return Plugins.message.warn('仅成功测速的节点可以被使用')
        if (!api.running) return Plugins.message.error('内核未运行，请先启动内核')
        const groupName = row.groupName || form.value.group
        if (groupName !== form.value.group) return Plugins.message.error('该结果所属策略组与当前选择的策略组不一致')
        const group = (api.proxies || {})[groupName]
        const proxy = (api.proxies || {})[row.name]
        if (!group || group.type !== 'Selector' || !Array.isArray(group.all) || !group.all.includes(row.name) || !proxy)
          return Plugins.message.error('节点可能因订阅更新已不存在，请重新测速')
        await Plugins.handleUseProxy(group, proxy)
        Plugins.message.success(`已切换到 ${row.name}`)
      }
      /** 用户确认后删除已保存的历史结果文件，并清空历史展示。 */
      const deleteHistory = async () => {
        if (!history.value) return
        const ok = await Plugins.confirm('删除历史记录', '确定删除已保存的测速历史结果吗？删除后不可恢复。').catch(() => false)
        if (!ok) return
        history.value = null
        await historySaveTask.catch(() => {})
        try {
          await Plugins.RemoveFile(historyFilePath())
        } catch {}
      }
      /** 打开面板时异步加载上一次保存的历史结果；失败时仅显示“暂无历史记录”。 */
      onMounted(async () => {
        history.value = await loadHistory()
      })

      /** 请求停止当前两阶段测试：取消预检请求或当前下载，之后不再启动新任务。 */
      const stop = () => {
        runBatchTest.stop?.()
      }
      /** 清除当前面板中的测速结果。 */
      const clear = () => {
        if (!running.value) results.value = []
      }
      /** 按稳定唯一键（优先 groupName+name）将一条结果写入 results：
       * 已有该节点的行则原地替换（不新增行、progress 不加一），首次插入才 progress += 1；
       * 写入时不做排序，仅在测速完成/停止时统一排序一次（见 start 的 finally），避免大表频繁重排。 */
      const upsertResult = (row) => {
        const key = resultKeyOf(row)
        const list = results.value
        const index = list.findIndex((r) => resultKeyOf(r) === key)
        if (index === -1) {
          results.value = [...list, { ...row, key }]
          progress.value += 1
        } else results.value = list.map((r, i) => (i === index ? { ...r, ...row, key } : r))
      }
      /** 校验表单并启动一轮两阶段批量测试。 */
      const start = async () => {
        if (running.value) return
        const values = { ...form.value }
        const seconds = Number(values.seconds)
        const maxDelay = Number(values.maxDelay)
        const concurrency = Number(values.concurrency)
        const limit = Number(values.limit)
        const downloadLimit = Number(values.downloadLimit)
        if (!values.group || !/^https?:\/\//i.test(String(values.url).trim()) || !/^https?:\/\//i.test(String(values.pingUrl).trim()))
          return Plugins.message.error('请填写有效的策略组和 HTTP/HTTPS 下载/延迟测试 URL')
        if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 60) return Plugins.message.error('下载时长必须是 1-60 之间的数字（秒）')
        if (!Number.isFinite(maxDelay) || maxDelay < 100 || maxDelay > 30000) return Plugins.message.error('最大延迟必须在 100-30000 毫秒之间')
        if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 30) return Plugins.message.error('预检并发数必须是 1-30 的整数')
        if (!Number.isInteger(limit) || limit < 0) return Plugins.message.error('节点数量限制必须是非负整数')
        if (!Number.isInteger(downloadLimit) || downloadLimit < 0) return Plugins.message.error('下载数量限制必须是非负整数')
        const group = (api.proxies || {})[values.group]
        if (!group || group.type !== 'Selector' || !Array.isArray(group.all)) return Plugins.message.error('策略组不存在或不是可用的 Selector')
        running.value = true
        results.value = []
        progress.value = 0
        statusText.value = '正在读取 Clash API 配置…'
        runBatchTest.active = runBatchTest({
          api,
          groupName: values.group,
          url: String(values.url).trim(),
          pingUrl: String(values.pingUrl).trim(),
          maxDelay,
          seconds,
          concurrency,
          limit,
          downloadLimit,
          onTotal: (v) => {
            total.value = v
          },
          onPrecheck: (done, count) => {
            statusText.value = `延迟预检 ${done}/${count}`
          },
          onNode: (v) => {
            currentNode.value = v
          },
          onDownload: (done, target) => {
            statusText.value = `下载测速 ${done}/${target}`
          },
          onResult: (v) => {
            upsertResult(v)
          }
        })
          .then((summary) => {
            if (summary?.stopped) statusText.value = '已停止'
            else if (!summary || summary.qualifiedCount === 0) statusText.value = '预检完成，无合格节点'
            else statusText.value = `测试完成：合格 ${summary.qualifiedCount} 个，已下载 ${summary.downloadedCount} 个`
          })
          .catch((error) => {
            Plugins.message.error(errorText(error))
            statusText.value = '无法开始测试'
          })
          .finally(() => {
            running.value = false
            currentNode.value = ''
            const rows = results.value
            if (rows.length) {
              rows.sort(compareResultRows)
              const payload = {
                schema: 'batch-download-speed',
                version: 2,
                savedAt: new Date().toISOString(),
                groupName: form.value.group,
                testUrl: String(form.value.url).trim(),
                results: rows
              }
              saveHistory(payload)
              history.value = payload
            }
            runBatchTest.active = null
            batchRunPromise = null
          })
        batchRunPromise = runBatchTest.active
        await batchRunPromise
      }
      return {
        form,
        results,
        history,
        running,
        progress,
        total,
        currentNode,
        statusText,
        groupOptions,
        progressPercent,
        formatTime,
        formatDelay,
        start,
        stop,
        clear,
        useResult,
        deleteHistory
      }
    }
  }
  modal.setContent(content)
  modal.open()
}

/** 构造当前 GFS 内核代理入站 URL，兼容认证和 IPv6 地址。 */
const createProxyUrl = (endpoint) => {
  if (!endpoint || !endpoint.host || !endpoint.port) throw new Error('没有可用的本地代理入站')
  const host = String(endpoint.host).includes(':') && !String(endpoint.host).startsWith('[') ? `[${endpoint.host}]` : endpoint.host
  const auth = endpoint.username ? `${encodeURIComponent(endpoint.username)}:${encodeURIComponent(endpoint.password || '')}@` : ''
  return `${endpoint.schema || endpoint.proxyType || 'http'}://${auth}${host}:${endpoint.port}`
}

/** 将不同类型的异常转换成适合表格显示的中文文本。 */
const errorText = (error) =>
  String(error?.message || error || '未知错误')
    .replace(/^Error:\s*/, '')
    .slice(0, 240)

/** 计算测速结果行的稳定唯一键：优先 groupName+name；无 groupName（单组/历史数据）时退化为 name。
 * 两阶段共用同一 key，保证预检行与下载行按同一节点原地替换，不因阶段 id 不同产生重复行。 */
const resultKeyOf = (row) => (row.groupName ? `${row.groupName}::${row.name}` : row.name)

/** 测速结果行的固定排序规则：成功在前按速度降序 → 有效延迟升序 → 名称升序。
 * 仅在测速完成或停止后调用一次（start 的 finally），运行期间不排序，避免大表频繁重排。 */
const compareResultRows = (a, b) => {
  const aOk = a.status === '成功' ? 1 : 0
  const bOk = b.status === '成功' ? 1 : 0
  if (aOk !== bOk) return bOk - aOk
  const aSpeed = Number.isFinite(Number(a.speed)) ? Number(a.speed) : -1
  const bSpeed = Number.isFinite(Number(b.speed)) ? Number(b.speed) : -1
  if (aSpeed !== bSpeed) return bSpeed - aSpeed
  const aDelay = Number.isFinite(Number(a.delay)) && Number(a.delay) > 0 ? Number(a.delay) : Number.MAX_SAFE_INTEGER
  const bDelay = Number.isFinite(Number(b.delay)) && Number(b.delay) > 0 ? Number(b.delay) : Number.MAX_SAFE_INTEGER
  if (aDelay !== bDelay) return aDelay - bDelay
  return String(a.name).localeCompare(String(b.name))
}

/** 读取当前 profile 的 Clash API 监听地址与 secret，返回可直接请求的 baseUrl。
 * controller 为空时默认 127.0.0.1:20123；兼容带 http:// 前缀、普通 host:port 与 IPv6 括号写法。 */
const getClashApiConfig = () => {
  const profilesStore = Plugins.useProfilesStore?.()
  const appSettingsStore = Plugins.useAppSettingsStore?.()
  const profileId = appSettingsStore?.app?.kernel?.profile
  const profile = profileId && profilesStore?.getProfileById ? profilesStore.getProfileById(profileId) : null
  if (!profile) throw new Error('未找到当前 profile，无法读取 Clash API 配置')
  let controller = ''
  let secret = ''
  if (String(Plugins.APP_TITLE || '').includes('SingBox')) {
    controller = profile?.experimental?.clash_api?.external_controller || '127.0.0.1:20123'
    secret = profile?.experimental?.clash_api?.secret || ''
  } else {
    controller = profile?.advancedConfig?.['external-controller'] || '127.0.0.1:20113'
    secret = profile?.advancedConfig?.secret || ''
  }
  const hostPort = String(controller || '127.0.0.1:20123')
    .trim()
    .replace(/^https?:\/\//i, '')
  const bracket = hostPort.match(/^\[([^\]]+)\](?::(\d+))?$/)
  let host
  let port
  if (bracket) {
    host = bracket[1]
    port = bracket[2] || '20123'
  } else {
    const sep = hostPort.lastIndexOf(':')
    if (sep === -1) {
      host = hostPort
      port = '20123'
    } else {
      host = hostPort.slice(0, sep)
      port = hostPort.slice(sep + 1)
    }
  }
  if (!host || !/^\d{1,5}$/.test(port)) throw new Error(`Clash API 监听地址无效：${controller}`)
  const hostPart = String(host).includes(':') ? `[${host}]` : host
  return { baseUrl: `http://${hostPart}:${port}`, secret }
}

/** 从策略组中收集可测速节点：去重、排除 DIRECT/REJECT 与嵌套策略组，limit 作用于过滤后列表。 */
const collectTestNodes = (api, group, limit) => {
  const GROUP_TYPES = ['SELECTOR', 'URLTEST', 'FALLBACK', 'LOADBALANCE', 'DIRECT', 'REJECT']
  const seen = new Set()
  const nodes = []
  for (const name of group.all || []) {
    if (seen.has(name)) continue
    seen.add(name)
    const upper = String(name).toUpperCase()
    if (upper === 'DIRECT' || upper === 'REJECT') continue
    const proxy = (api.proxies || {})[name]
    if (!proxy) continue
    if (Array.isArray(proxy.all) && proxy.all.length) continue
    if (GROUP_TYPES.includes(String(proxy.type || '').toUpperCase())) continue
    nodes.push(name)
  }
  return limit > 0 ? nodes.slice(0, limit) : nodes
}

/** 校验 Clash API 可达性；不可达时抛出明确错误，避免降级为无预检直接下载。 */
const checkClashApi = async ({ baseUrl, secret, cancelIds }) => {
  const cancelId = `clash-version-${Plugins.sampleID()}`
  cancelIds.add(cancelId)
  try {
    const response = await Plugins.Requests({
      method: 'GET',
      url: `${baseUrl}/version`,
      autoTransformBody: true,
      headers: { Authorization: `Bearer ${secret}` },
      options: { Proxy: '', Timeout: 3, CancelId: cancelId }
    })
    if (response.status < 200 || response.status >= 300) throw new Error(`HTTP ${response.status}`)
  } finally {
    cancelIds.delete(cancelId)
  }
}

/** 通过 Clash API 延迟接口测试单个节点；失败只重试一次，返回延迟或失败原因。
 * 每次请求使用唯一 CancelId，停止时由调用方统一 HttpCancel。 */
const testProxyDelay = async ({ baseUrl, secret, node, url, maxDelay, cancelIds, isStopped }) => {
  const attempt = async (timeoutMs) => {
    const cancelId = `precheck-${Plugins.sampleID()}`
    cancelIds.add(cancelId)
    try {
      const target = `${baseUrl}/proxies/${encodeURIComponent(node)}/delay?url=${encodeURIComponent(url)}&timeout=${maxDelay}`
      const response = await Plugins.Requests({
        method: 'GET',
        url: target,
        autoTransformBody: true,
        headers: { Authorization: `Bearer ${secret}` },
        options: { Proxy: '', Timeout: Math.ceil(timeoutMs / 1000) + 2, CancelId: cancelId }
      })
      if (response.status < 200 || response.status >= 300) return { delay: 0, error: `HTTP ${response.status}` }
      const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body || {}
      const delay = Number(body.delay)
      return { delay: Number.isFinite(delay) && delay > 0 ? delay : 0, error: Number.isFinite(delay) ? '' : '响应缺少有效 delay 字段' }
    } catch (error) {
      return { delay: 0, error: errorText(error) }
    } finally {
      cancelIds.delete(cancelId)
    }
  }
  let result = await attempt(maxDelay)
  if (result.delay <= 0 && !isStopped()) result = await attempt(maxDelay)
  return result
}

/** 小型并发 worker pool：达到最大并发后不再启动新任务，支持外部停止信号。 */
const runConcurrent = async ({ items, concurrency, isStopped, task }) => {
  let index = 0
  const workerCount = Math.max(1, Math.min(concurrency, items.length || 1))
  const workers = []
  for (let w = 0; w < workerCount; w++) {
    workers.push(
      (async () => {
        while (!isStopped()) {
          const i = index
          index += 1
          if (i >= items.length) return
          await task(items[i], i)
        }
      })()
    )
  }
  await Promise.all(workers)
}

/** 通过内核代理入站下载测速文件，到时长即取消；返回实际字节数与纯下载耗时。
 * Timeout 单位为秒，故取 seconds + 5；用返回的 elapsed 计算速度，不把节点切换时间算进去。 */
const downloadForDuration = async ({ url, path, proxy, seconds, cancelId }) => {
  let bytes = 0
  let cancelled = false
  const started = Date.now()
  const timer = setTimeout(() => {
    cancelled = true
    try {
      Plugins.HttpCancel(cancelId)
    } catch {}
  }, seconds * 1000)
  try {
    await Plugins.Download(
      url,
      path,
      {},
      (progress) => {
        if (Number.isFinite(Number(progress))) bytes = Math.max(bytes, Number(progress))
      },
      { Proxy: proxy, CancelId: cancelId, Timeout: seconds + 5 }
    )
  } catch (error) {
    if (!(cancelled && bytes > 0)) throw error
  } finally {
    clearTimeout(timer)
  }
  return { bytes, elapsed: Math.max(0.001, (Date.now() - started) / 1000) }
}

/** 批量测速主流程：阶段一并发延迟预检（不切换节点），阶段二对合格节点按延迟升序串行下载测速。
 * 全部节点最终都有一行结果；停止/完成/异常均尽力恢复原 Selector 节点。 */
const runBatchTest = async ({
  api,
  groupName,
  url,
  pingUrl,
  maxDelay,
  seconds,
  concurrency,
  limit,
  downloadLimit,
  onTotal,
  onPrecheck,
  onNode,
  onDownload,
  onResult
}) => {
  if (!api.running) throw new Error('内核未运行，请先启动内核')
  const clashApi = getClashApiConfig()
  const endpoint = createProxyUrl(api.getProxyEndpoint())
  const group = (api.proxies || {})[groupName]
  if (!group || group.type !== 'Selector' || !Array.isArray(group.all)) throw new Error('策略组不存在或不是 Selector')
  const nodes = collectTestNodes(api, group, limit)
  if (!nodes.length) throw new Error('策略组中没有有效可测速节点')
  onTotal(nodes.length)
  const original = group.now
  let stopped = false
  let downloaded = 0
  const cancelIds = new Set()
  let currentCancelId = null
  const isStopped = () => stopped
  const cancelAll = () => {
    for (const id of cancelIds) {
      try {
        Plugins.HttpCancel(id)
      } catch {}
    }
    cancelIds.clear()
    if (currentCancelId) {
      try {
        Plugins.HttpCancel(currentCancelId)
      } catch {}
    }
  }
  runBatchTest.stop = () => {
    stopped = true
    cancelAll()
  }
  const qualified = []
  try {
    /* 阶段一：并发延迟预检，不切换任何节点 */
    await checkClashApi({ baseUrl: clashApi.baseUrl, secret: clashApi.secret, cancelIds })
    if (stopped) return { stopped, qualifiedCount: 0, downloadedCount: 0 }
    let done = 0
    await runConcurrent({
      items: nodes,
      concurrency,
      isStopped,
      task: async (node) => {
        const result = await testProxyDelay({ baseUrl: clashApi.baseUrl, secret: clashApi.secret, node, url: pingUrl, maxDelay, cancelIds, isStopped })
        if (stopped) return
        done += 1
        onPrecheck(done, nodes.length)
        const base = {
          key: resultKeyOf({ name: node, groupName }),
          name: node,
          groupName,
          testUrl: url,
          testedAt: new Date().toISOString(),
          mb: '—',
          mbps: '—',
          bytesText: '—',
          time: '—'
        }
        if (result.delay <= 0) {
          onResult({ ...base, status: '延迟失败', delay: null, speed: null, error: result.error || '延迟测试失败' })
          return
        }
        if (result.delay > maxDelay) {
          onResult({ ...base, status: '延迟过高', delay: result.delay, speed: null, error: `超过阈值 ${maxDelay}ms` })
          return
        }
        onResult({ ...base, status: '预检通过', delay: result.delay, speed: null, error: '' })
        qualified.push({ name: node, delay: result.delay })
      }
    })
    if (stopped) return { stopped, qualifiedCount: qualified.length, downloadedCount: 0 }

    /* 阶段二：合格节点按延迟升序，仅下载前 N 个，其余生成“未下载（数量限制）”结果 */
    qualified.sort((a, b) => a.delay - b.delay)
    const selected = downloadLimit > 0 ? qualified.slice(0, downloadLimit) : qualified
    for (const item of qualified.slice(selected.length)) {
      onResult({
        key: resultKeyOf({ name: item.name, groupName }),
        name: item.name,
        status: '未下载（数量限制）',
        delay: item.delay,
        speed: null,
        mb: '—',
        mbps: '—',
        bytesText: '—',
        time: '—',
        error: '',
        groupName,
        testUrl: url,
        testedAt: new Date().toISOString()
      })
    }
    const downloadTarget = selected.length
    let downloadIndex = 0
    for (; downloadIndex < downloadTarget; downloadIndex++) {
      if (stopped) break
      const { name, delay } = selected[downloadIndex]
      const rowKey = resultKeyOf({ name, groupName })
      onNode(name)
      const path = `data/.cache/batch-download-${Plugins.sampleID()}.bin`
      const cancelId = `batch-speed-${Plugins.sampleID()}`
      currentCancelId = cancelId
      let row
      try {
        const proxy = (api.proxies || {})[name]
        if (!proxy) throw new Error('找不到节点代理对象')
        await Plugins.handleUseProxy((api.proxies || {})[groupName] || group, proxy)
        const data = await downloadForDuration({ url, path, proxy: endpoint, seconds, cancelId })
        const mb = data.bytes / 1000000 / data.elapsed
        row = stopped
          ? {
              key: rowKey,
              name,
              status: '已停止',
              delay,
              speed: null,
              mb: '—',
              mbps: '—',
              bytesText: '—',
              time: '—',
              error: '',
              groupName,
              testUrl: url,
              testedAt: new Date().toISOString()
            }
          : {
              key: rowKey,
              name,
              status: '成功',
              delay,
              speed: mb,
              mb: mb.toFixed(2),
              mbps: (mb * 8).toFixed(2),
              bytesText: `${(data.bytes / 1000000).toFixed(2)} MB`,
              time: `${data.elapsed.toFixed(2)} s`,
              error: '',
              groupName,
              testUrl: url,
              testedAt: new Date().toISOString()
            }
      } catch (error) {
        row = {
          key: rowKey,
          name,
          status: stopped ? '已停止' : '下载失败',
          delay,
          speed: null,
          mb: '—',
          mbps: '—',
          bytesText: '—',
          time: '—',
          error: stopped ? '' : errorText(error),
          groupName,
          testUrl: url,
          testedAt: new Date().toISOString()
        }
      } finally {
        try {
          Plugins.RemoveFile(path)
        } catch {}
      }
      currentCancelId = null
      downloaded += 1
      onResult(row)
      onDownload(downloaded, downloadTarget)
    }
    /* 停止下载时，剩余尚未下载的合格节点原地更新为“已停止”，避免停留在“预检通过”造成误解 */
    if (stopped) {
      for (let j = downloadIndex; j < downloadTarget; j++) {
        const rest = selected[j]
        onResult({
          key: resultKeyOf({ name: rest.name, groupName }),
          name: rest.name,
          status: '已停止',
          delay: rest.delay,
          speed: null,
          mb: '—',
          mbps: '—',
          bytesText: '—',
          time: '—',
          error: '',
          groupName,
          testUrl: url,
          testedAt: new Date().toISOString()
        })
      }
    }
    return { stopped, qualifiedCount: qualified.length, downloadedCount: downloaded }
  } finally {
    runBatchTest.stop = null
    try {
      const freshGroup = (api.proxies || {})[groupName] || group
      const fresh = original && (api.proxies || {})[original]
      if (fresh) await Plugins.handleUseProxy(freshGroup, fresh)
    } catch {}
  }
}
