const PAC_FILE = 'data/.cache/pac.txt'
const DEFAULT_PAC_SCRIPT = `function FindProxyForURL(url, host) {
  // 示例：return 'PROXY 127.0.0.1:7890; DIRECT'
  return 'DIRECT'
}`
const MAX_HISTORY_ITEMS = 100

window[Plugin.id] = window[Plugin.id] || {
  pacScript: Vue.ref(''),
  history: Vue.ref([]),
  saving: Vue.ref(false),
  saveTimer: null
}

/* 触发器 手动触发 */
const onRun = async () => {
  const component = {
    template: `
      <div>
        <Card :title="running ? '服务运行中' : '服务已停止'">
          <template #extra>
            <div class="flex items-center gap-4">
              <Button @click="copyURL" icon="file" size="small" type="link">复制地址</Button>
              <Button @click="handleToggleServer" :loading="switching" :type="running ? 'default' : 'primary'" size="small">
                {{ running ? '停止 PAC 服务器' : '启动 PAC 服务器' }}
              </Button>
            </div>
          </template>
          <div class="mb-4">PAC 地址：{{ url }}</div>
          <CodeEditor v-model="pacScript" @change="handlePacChange" editable lang="javascript" />
        </Card>
        <Card title="请求历史" class="mt-8">
          <template #extra>
            <Button @click="clearHistory" icon="clear" type="link">清空</Button>
          </template>
          <Table :data-source="requestHistory" :columns="requestHistoryColumns" />
        </Card>
      </div>
    `,
    setup() {
      const { ref } = Vue
      const running = ref(false)
      const switching = ref(false)
      const pacScript = window[Plugin.id].pacScript
      const requestHistory = window[Plugin.id].history
      const url = getPacURL()

      const refreshStatus = async () => {
        running.value = await isRunning().catch(() => false)
      }

      refreshStatus()
      readPacFile().then((content) => (pacScript.value = content))

      return {
        url,
        running,
        switching,
        pacScript,
        requestHistory,
        requestHistoryColumns: [
          { key: 'count', title: '次数', align: 'center', width: 80 },
          { key: 'lastAccess', title: '最后请求时间', width: 180 },
          { key: 'ua', title: 'User-Agent' }
        ],
        async copyURL() {
          await Plugins.ClipboardSetText(url)
          Plugins.message.success('PAC 地址已复制')
        },
        async handleToggleServer() {
          if (switching.value) return
          switching.value = true
          try {
            if (running.value) {
              await stopPacServer()
              Plugins.message.success('PAC 服务已停止')
            } else {
              await flushPacFile()
              await startPacServer()
              Plugins.message.success('PAC 服务已启动')
            }
          } catch (error) {
            console.log(`[${Plugin.name}]`, '切换服务状态失败', error)
            Plugins.message.error(`操作失败：${getErrorMessage(error)}`)
          } finally {
            await refreshStatus()
            switching.value = false
          }
        },
        handlePacChange() {
          schedulePacSave()
        },
        clearHistory() {
          requestHistory.value.splice(0)
        }
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      submit: false,
      cancelText: 'common.close',
      maskClosable: true,
      width: '80',
      height: '80'
    },
    {
      default: () => Vue.h(component),
      action: () => (window[Plugin.id].saving.value ? Vue.h(Vue.resolveComponent('Icon'), { icon: 'loading', class: 'rotation mr-auto' }) : null)
    }
  )

  modal.open()
}

/* 触发器 核心启动后 */
const onCoreStarted = async () => {
  try {
    await startPacServer()
    return 1
  } catch (error) {
    console.log(`[${Plugin.name}]`, '启动服务失败', error)
    return 0
  }
}

/* 触发器 核心停止后 */
const onCoreStopped = async () => {
  try {
    await stopPacServer()
    return 2
  } catch (error) {
    console.log(`[${Plugin.name}]`, '停止服务失败', error)
    return 0
  }
}

const Start = onCoreStarted
const Stop = onCoreStopped

const getErrorMessage = (error) => error?.message || String(error)

const getPacURL = () => {
  const address = String(Plugin.Address || '127.0.0.1:4532').trim()
  const match = address.match(/^(?:\[.*\]|[^:]+):(\d+)$/)
  const port = match?.[1] || '4532'
  return `http://127.0.0.1:${port}/pac`
}

const readPacFile = async () => {
  try {
    const content = await Plugins.ReadFile(PAC_FILE)
    return content.trim() ? content : DEFAULT_PAC_SCRIPT
  } catch {
    return DEFAULT_PAC_SCRIPT
  }
}

const writePacFile = async () => {
  window[Plugin.id].saving.value = true
  try {
    await Plugins.WriteFile(PAC_FILE, window[Plugin.id].pacScript.value)
  } finally {
    window[Plugin.id].saving.value = false
  }
}

const schedulePacSave = () => {
  const state = window[Plugin.id]
  state.saving.value = true
  clearTimeout(state.saveTimer)
  state.saveTimer = setTimeout(async () => {
    state.saveTimer = null
    try {
      await writePacFile()
    } catch (error) {
      console.log(`[${Plugin.name}]`, '保存 PAC 内容失败', error)
      Plugins.message.error(`保存 PAC 内容失败：${getErrorMessage(error)}`)
    }
  }, 500)
}

const flushPacFile = async () => {
  const state = window[Plugin.id]
  if (!state.saveTimer) return
  clearTimeout(state.saveTimer)
  state.saveTimer = null
  await writePacFile()
}

const isRunning = async () => (await Plugins.ListServer()).includes(Plugin.id)

const stopPacServer = async () => {
  if (!(await isRunning())) return
  await Plugins.StopServer(Plugin.id)
  console.log(`[${Plugin.name}]`, '服务已停止')
}

const recordRequest = (req) => {
  const uaEntry = Object.entries(req.headers || {}).find(([key]) => key.toLowerCase() === 'user-agent')
  const ua = uaEntry?.[1] || '未知客户端'
  const history = window[Plugin.id].history.value
  const item = history.find((entry) => entry.ua === ua)
  const lastAccess = new Date().toLocaleString()

  if (item) {
    item.count += 1
    item.lastAccess = lastAccess
    const index = history.indexOf(item)
    if (index > 0) history.splice(0, 0, ...history.splice(index, 1))
  } else {
    history.unshift({ ua, count: 1, lastAccess })
    if (history.length > MAX_HISTORY_ITEMS) history.splice(MAX_HISTORY_ITEMS)
  }
}

const startPacServer = async () => {
  if (await isRunning()) return

  if (!window[Plugin.id].pacScript.value) {
    window[Plugin.id].pacScript.value = await readPacFile()
  }

  await Plugins.StartServer(Plugin.Address, Plugin.id, async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost')
    if (pathname === '/pac' || pathname === '/proxy.pac') {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.end(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }, 'Method Not Allowed')
      }
      recordRequest(req)
      const body = req.method === 'HEAD' ? '' : window[Plugin.id].pacScript.value
      return res.end(
        200,
        {
          'Content-Type': 'application/x-ns-proxy-autoconfig; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          Pragma: 'no-cache',
          'Access-Control-Allow-Origin': '*'
        },
        body
      )
    }
    if (pathname === '/') {
      return res.end(200, { 'Content-Type': 'text/plain; charset=utf-8' }, `PAC service is running.\n${getPacURL()}`)
    }
    return res.end(404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found')
  })
  console.log(`[${Plugin.name}]`, `服务已启动：${getPacURL()}`)
}
