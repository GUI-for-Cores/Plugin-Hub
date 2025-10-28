/**
 * 本插件使用开源项目：https://github.com/GUI-for-Cores/Hotkey-API-Bridge
 */

const PATH = 'data/third/hotkey-api-bridge'
const HOTKEY_FILE = PATH + '/hotkey.json'
const BIN_FILE = PATH + '/hotkey-api-bridge.exe'
const PID_FILE = PATH + '/pid.txt'

/* 触发器 启动APP时 */
const onStartup = async () => {
  return await Start().catch((err) => {
    console.log(`[${Plugin.name}]`, '启动进程失败', err)
    return 2
  })
}

/* 触发器 关闭APP时 */
const onShutdown = async () => {
  return await Stop().catch((err) => {
    console.log(`[${Plugin.name}]`, '停止进程失败', err)
    return 1
  })
}

/* 触发器 安装 */
const onInstall = async () => {
  const envStore = Plugins.useEnvStore()
  const { os, arch } = envStore.env
  if (os !== 'windows') {
    throw '此插件不支持非Windows系统'
  }

  const url = `https://github.com/GUI-for-Cores/Hotkey-API-Bridge/releases/download/v1.0.0/Hotkey-API-Bridge-windows-${arch}.exe`

  const { update, destroy } = Plugins.message.info('正在下载...', 99999)

  try {
    await Plugins.Download(url, BIN_FILE, {}, (c, t) => {
      update('正在下载...' + ((c / t) * 100).toFixed(2) + '%')
    })
  } finally {
    destroy()
  }

  Plugins.message.success('安装成功')
  return 0
}

/* 触发器 卸载 */
const onUninstall = async () => {
  if (await isServiceRunning()) {
    throw '请先停止插件'
  }
  await Plugins.RemoveFile(PATH)
  return 0
}

const Start = async () => {
  if (!Plugin.HOTKEY_API_ADDRESS || !Plugin.HOTKEY_API_TOKEN) {
    throw '请先配置全局热键后端服务'
  }

  const { promise, resolve, reject } = Promise.withResolvers()

  const pid = await Plugins.ExecBackground(
    BIN_FILE,
    ['--address', Plugin.HOTKEY_API_ADDRESS],
    async (out) => {
      console.log(`[${Plugin.name}]`, out)
      if (out.includes('Hotkey manager is ready. Add hotkeys via the API.')) {
        resolve()
      }
    },
    async () => {
      console.log(`[${Plugin.name}]`, '插件停止了')
      reject()
    },
    {
      Env: {
        HOTKEY_API_TOKEN: Plugin.HOTKEY_API_TOKEN
      }
    }
  )

  await promise

  await Plugins.WriteFile(PID_FILE, String(pid))
  const localHotkeys = await loadLocalHotKeys()

  const activeItems = localHotkeys.filter((item) => item.enabled).map((item) => ({ hotkey: item.hotkey, request: item.request }))
  if (activeItems.length != 0) {
    try {
      const res = await addHotkeys(activeItems)
      console.log(`[${Plugin.name}]`, '启动时恢复热键结果', res)
    } catch (error) {
      Plugins.message.error(error.message || error)
    }
  }

  return 1
}

const Stop = async () => {
  const pid = await Plugins.ReadFile(PID_FILE).catch(() => '')
  if (!pid) {
    throw '插件并未在运行'
  }
  await Plugins.KillProcess(Number(pid))
  await Plugins.RemoveFile(PID_FILE)
  return 2
}

/* 触发器 手动触发 */
const onRun = async () => {
  if (!(await isServiceRunning())) {
    await Start()
  }

  // 运行前移除所有热键，避免配置插件时受影响
  await removeHotkeys()

  const { ref, onMounted, onUnmounted } = Vue

  const localHotkeys = await loadLocalHotKeys()

  const backup = Plugins.deepClone(localHotkeys)

  const hotkeyList = ref(localHotkeys)

  const component = {
    template: /* html */ `
    <div class="flex flex-col gap-4">
      <Card v-for="(item, index) in hotkeyList" :key="item.id">
        <div class="flex justify-between py-4">
          <div class="flex items-center gap-8">
            <Switch v-model="item.enabled" border="square">
              {{ item.enabled ? '已启用' : '已禁用' }}
            </Switch>
            <div class="font-bold">{{ item.title || '无备注' }}</div>
            <Button @click.stop="handleEnter(item)" type="text" icon="edit">
              <div class="font-bold">
                {{ item.entering ? '录入中...' : '' }}
                {{ (!item.hotkey && !item.entering) ? '点击录入热键' : '' }}
                {{ item.hotkey || '' }}
              </div>
            </Button>
          </div>
          <div>
            <Button @click="item.hidden = !item.hidden" type="text">
              {{ item.hidden ? '展开' : '收起' }}
            </Button>
            <Button @click="del(item, index)" icon="delete" type="text" />
          </div>
        </div>
        
        <div v-show="!item.hidden" class="flex flex-col gap-4 py-8">
          <div class="flex items-center justify-between">
            <Input v-model="item.title" placeholder="请输入备注" />
            <Select v-model="item.request.method" :options="['GET', 'POST', 'HEAD', 'DELETE', 'PUT', 'Patch'].map(v => ({label: v, value: v}))" />
          </div>
          <Input v-model="item.request.url" placeholder="http(s)://" />
          <KeyValueEditor v-model="item.request.headers" />
          <CodeViewer v-model="item.request.body" editable placeholder="请输入请求体" />
        </div>
      </Card>

      <div class="flex items-center gap-8 mt-4">
        <Dropdown placement="top">
          <Button icon="add">预设值</Button>
          <template #overlay="{ close }">
            <div class="flex flex-col gap-4 min-w-64 p-4">
              <Button 
                v-for="item in PresetList" 
                :key="item.title" 
                @click="() => {
                  handleAdd(item)
                  close()
                }" 
                type="text" 
                size="small"
              >
                {{ item.title }}
              </Button>
            </div>
          </template>
        </Dropdown>
        <Button @click="add" icon="add" class="flex-1">新增热键</Button>
      </div>
    </div>
    `,
    setup() {
      const PresetList = [
        {
          title: '显示窗口',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/gui/window`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'show'
              },
              null,
              2
            )
          }
        },
        {
          title: '隐藏窗口',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/gui/window`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'hide'
              },
              null,
              2
            )
          }
        },
        {
          title: '启动核心',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/start`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: ''
          }
        },
        {
          title: '停止核心',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/stop`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: ''
          }
        },
        {
          title: '重启核心',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/restart`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: ''
          }
        },
        {
          title: '直连模式',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/mode`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'direct'
              },
              null,
              2
            )
          }
        },
        {
          title: '规则模式',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/mode`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'rule'
              },
              null,
              2
            )
          }
        },
        {
          title: '全局模式',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/mode`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'global'
              },
              null,
              2
            )
          }
        },
        {
          title: '设置系统代理',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/gui/systemproxy`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'set'
              },
              null,
              2
            )
          }
        },
        {
          title: '清除系统代理',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/gui/systemproxy`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'clear'
              },
              null,
              2
            )
          }
        },
        {
          title: '开启TUN模式',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/tun`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'on'
              },
              null,
              2
            )
          }
        },
        {
          title: '关闭TUN模式',
          request: {
            method: 'POST',
            url: `${Plugin.ApiAddress}/v1/cores/tun`,
            headers: {
              Authorization: `Bearer ${Plugin.ApiSecret}`
            },
            body: JSON.stringify(
              {
                mode: 'off'
              },
              null,
              2
            )
          }
        }
      ]

      let tmpItem

      const onKeyDown = async (e) => {
        const parts = []
        if (e.ctrlKey) parts.push('Ctrl')
        if (e.shiftKey) parts.push('Shift')
        if (e.altKey) parts.push('Alt')
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
          tmpItem.hotkey = parts.join('+')
          return
        }
        if (/^[a-z]$/.test(e.key)) {
          parts.push(String(e.key).toUpperCase())
        } else {
          parts.push(String(e.key))
        }

        tmpItem.hotkey = parts.join('+')
      }

      const onClick = async () => {
        tmpItem.entering = false
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('click', onClick)
      }

      onUnmounted(() => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('click', onClick)
      })

      return {
        PresetList,
        hotkeyList,
        async add() {
          hotkeyList.value.push({
            id: Plugins.sampleID(),
            title: '',
            enabled: true,
            hidden: false,
            entering: false,
            hotkey: '',
            request: {
              method: 'GET',
              url: '',
              headers: {},
              body: ''
            }
          })
        },
        async del(item, index) {
          hotkeyList.value.splice(index, 1)
        },
        handleAdd(item) {
          if (!Plugin.ApiAddress || !Plugin.ApiSecret) {
            Plugins.message.error('请先配置插件ApiAddress/ApiSecret')
            return
          }
          hotkeyList.value.push({
            id: Plugins.sampleID(),
            title: item.title,
            enabled: true,
            hidden: true,
            entering: false,
            hotkey: '',
            request: Plugins.deepClone(item.request)
          })
        },
        handleEnter(item) {
          if (tmpItem) {
            tmpItem.entering = false
          }
          tmpItem = item
          item.entering = true
          window.addEventListener('keydown', onKeyDown)
          window.addEventListener('click', onClick)
        }
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      minWidth: '80',
      onCancel: async () => {
        const activeItems = backup.filter((item) => item.enabled).map((item) => ({ hotkey: item.hotkey, request: item.request }))
        if (activeItems.length != 0) {
          try {
            const res = await addHotkeys(activeItems)
            console.log(`[${Plugin.name}]`, '恢复热键结果', res)
          } catch (error) {
            Plugins.message.error(error.message || error)
            return
          }
        }
      },
      onOk: async () => {
        if (hotkeyList.value.some((item) => item.enabled && (!item.hotkey || !item.request.url))) {
          Plugins.message.error('部分已激活项缺少热键或请求URL，请检查')
          return false
        }

        const activeItems = hotkeyList.value.filter((item) => item.enabled).map((item) => ({ hotkey: item.hotkey, request: item.request }))
        if (activeItems.length != 0) {
          try {
            const res = await addHotkeys(activeItems)
            console.log(`[${Plugin.name}]`, '更新热键结果', res)
          } catch (error) {
            Plugins.message.error(error.message || error)
            return
          }
        }
        await Plugins.WriteFile(HOTKEY_FILE, JSON.stringify(hotkeyList.value, null, 4))
      },
      beforeClose() {
        modal.destroy()
      }
    },
    {
      default: () => Vue.h(component)
    }
  )

  modal.open()

  return 1
}

const isServiceRunning = async () => {
  const pid = await Plugins.ReadFile(PID_FILE).catch(() => '')
  if (pid) {
    const name = await Plugins.ProcessInfo(Number(pid)).catch(() => '')
    return name.startsWith('hotkey-api-bridge')
  }
  return false
}

// 加载本地热键配置
const loadLocalHotKeys = async () => {
  const res = await Plugins.ReadFile(HOTKEY_FILE).catch(() => '[]')
  return JSON.parse(res)
}

// 获取所有已注册的热键
const getHotkeys = async () => {
  const res = await Plugins.HttpGet(`http://127.0.0.1:32325/hotkeys`, {
    Authorization: `Bearer ${Plugin.HOTKEY_API_TOKEN}`
  })
  console.log(`[${Plugin.name}]`, 'getHotkeys', res)
  return res.body
}

// 移除所有热键
const removeHotkeys = async () => {
  const res = await Plugins.HttpDelete('http://127.0.0.1:32325/hotkeys', {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${Plugin.HOTKEY_API_TOKEN}`
  })
  console.log(`[${Plugin.name}]`, 'removeHotkeys', res)
  if (res.status !== 200) {
    throw res.body
  }
  return res.body
}

// 批量添加热键
const addHotkeys = async (body) => {
  const res = await Plugins.HttpPost(
    'http://127.0.0.1:32325/hotkeys',
    {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Plugin.HOTKEY_API_TOKEN}`
    },
    body
  )
  console.log(`[${Plugin.name}]`, 'addHotkeys', res)
  if (res.status !== 207) {
    throw res.body
  }
  return res.body
}
