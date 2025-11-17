const PAC_FILE = 'data/.cache/pac.txt'

window[Plugin.id] = window[Plugin.id] || {
  pacScript: Vue.ref(''),
  history: Vue.ref([]),
  saving: Vue.ref(false)
}

/* 触发器 手动触发 */
const onRun = async () => {
  const component = {
    template: `
    <div>
      <Card :title="running ? '服务运行中' : '服务已停止'">
        <template #extra>
          <div class="flex items-center gap-4">
            <Button @click="copyURL" icon="file" size="small" type="link">
              复制地址
            </Button>
            <Button v-if="running && needRestart" @click="handleToggleServer" type="primary" size="small">
              重启PAC服务器
            </Button>
          </div>
        </template>
        <div class="flex items-center justify-between">
          <!--
          <Button @click="handleToggleServer">
            {{ running ? (needRestart ? '重启PAC服务器' : '停止PAC服务器') : '启动PAC服务器' }}
          </Button>
          -->
        </div>
        <CodeViewer v-model="pacScript" @change="handlePacChange" editable lang="javascript" />
      </Card>
      <Card title="查询历史" class="mt-8">
        <template #extra>
          <Button @click="() => requestHistory.splice(0)" icon="clear" type="link" />
        </template>
        <Table :data-source="requestHistory" :columns="requestHistoryColumns" />
      </Card>
    </div>
    `,
    setup() {
      const { ref } = Vue
      const running = ref(false)
      const needRestart = ref(false)
      const pacScript = window[Plugin.id].pacScript
      const requestHistory = window[Plugin.id].history

      const url = `http://127.0.0.1:${Plugin.Address.split(':').pop()}/pac`

      isRunning().then((res) => (running.value = res))

      readPacFile().then((res) => (pacScript.value = res))

      return {
        url,
        running,
        needRestart,
        pacScript,
        requestHistory,
        requestHistoryColumns: [
          { key: 'count', title: '查询次数', align: 'center' },
          { key: 'ua', title: 'User-Agent' }
        ],
        async copyURL() {
          await Plugins.ClipboardSetText(url)
          Plugins.message.success('common.success')
        },
        async handleToggleServer() {
          if (running.value && needRestart.value) {
            await stopPacServer()
            await startPacServer()
            needRestart.value = false
            return
          }
          if (running.value) {
            await stopPacServer()
          } else {
            await startPacServer()
          }
          running.value = !running.value
        },
        async handlePacChange() {
          needRestart.value = true
          await writePacFile(pacScript.value)
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
      height: '80',
      afterClose() {
        modal.destroy()
      }
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
  await startPacServer().catch((error) => {
    console.log(`[${Plugin.name}]`, '启动服务失败', error)
  })
  return 1
}

/* 触发器 核心停止后 */
const onCoreStopped = async () => {
  await stopPacServer().catch((error) => {
    console.log(`[${Plugin.name}]`, '停止服务失败', error)
  })
  return 2
}

const Start = onCoreStarted
const Stop = onCoreStopped

const readPacFile = async () => {
  return await Plugins.ReadFile(PAC_FILE).catch(() => `function FindProxyForURL(url, host) {\n\treturn 'PROXY IP:PORT'\n}`)
}

const writePacFile = async (content) => {
  window[Plugin.id].saving.value = true
  await Plugins.WriteFile(PAC_FILE, content).catch((error) => {
    console.log(`[${Plugin.name}]`, '保存pac内容失败', error)
  })
  await Plugins.sleep(200)
  window[Plugin.id].saving.value = false
}

const isRunning = async () => {
  const list = await Plugins.ListServer()
  return list.includes(Plugin.id)
}

const stopPacServer = async () => {
  await Plugins.StopServer(Plugin.id)
  console.log(`[${Plugin.name}]`, '服务已停止')
}

const startPacServer = async () => {
  const record = (req) => {
    const key = req.headers['User-Agent']
    const item = window[Plugin.id].history.value.find((v) => v.ua === key)
    if (item) {
      item.count += 1
    } else {
      window[Plugin.id].history.value.push({ ua: key, count: 1 })
    }
  }

  if (!window[Plugin.id].pacScript.value) {
    const script = await readPacFile()
    window[Plugin.id].pacScript.value = script
  }

  await Plugins.StartServer(Plugin.Address, Plugin.id, async (req, res) => {
    if (req.url === '/pac') {
      record(req)
      return res.end(200, { 'Content-Type': 'text/plain; charset=utf-8' }, window[Plugin.id].pacScript.value)
    }
    res.end(200, { 'Content-Type': 'text/plain; charset=utf-8' }, 'PAC service is running.')
  })
  console.log(`[${Plugin.name}]`, '服务已启动')
}
