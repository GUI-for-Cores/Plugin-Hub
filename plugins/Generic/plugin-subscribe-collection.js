window[Plugin.id] = window[Plugin.id] ?? {
  collections: Vue.ref([])
}
const BASE_PATH = `data/third/${Plugin.id}`
const CACHE_PATH = `data/.cache/${Plugin.id}`
const MANAGER_CONFIG_PATH = `${BASE_PATH}/${Plugin.id}.json`
const CORE = Plugins.APP_TITLE.includes('SingBox') ? 'sing-box' : 'mihomo'
/* 触发器 手动触发 */
const onRun = async () => {
  const manager = new SubscribeCollectionManager()
  await manager.init()
  openMainUI(manager)
}
/* 触发器: 更新订阅时 */
const onSubscribe = async (proxies, subscription) => {
  const collections = window[Plugin.id]?.collections.value ?? []
  const col = collections.find((c) => c.subscriptionId === subscription.id)
  if (!col) return proxies
  return (await updateCollection(col)) ?? proxies
}
/* 触发器 APP就绪后 */
const onReady = async () => {
  window[Plugin.id].collections.value = await Plugins.ReadFile(MANAGER_CONFIG_PATH)
    .then((content) => JSON.parse(content))
    .catch(() => [])
  addSubscriptionsHeaderAction()
}
const addSubscriptionsHeaderAction = () => {
  const appStore = Plugins.useAppStore()
  appStore.addCustomActions('subscriptions_header', {
    id: Plugin.id,
    component: 'Button',
    componentProps: {
      type: 'link',
      onClick: onRun
    },
    componentSlots: {
      default: '管理聚合订阅'
    }
  })
}
const openMainUI = (manager) => {
  const { h, resolveComponent, defineComponent } = Vue
  const component = defineComponent({
    template: `
    <div class="h-full w-full">
      <div v-if="manager.collections.value.length === 0"
        class="flex items-center justify-center h-full min-h-[200px] cursor-pointer" @click="create">
        <span class="text-16 font-bold text-gray-400 hover:text-gray-600 transition-colors">
          尚未添加任何组合，点击添加
        </span>
      </div>
      <div v-else class="grid grid-cols-3 gap-8 p-8 overflow-y-auto max-h-[500px]">
        <Card v-for="col in manager.collections.value" :key="col.id" :title="getSubscribeName(col.subscriptionId)">
          <template #extra>
            <Dropdown>
              <Button type="link" size="small" icon="more" />
              <template #overlay>
                <div class="flex flex-col gap-4 min-w-64 p-4">
                  <Button type="text" @click.stop="edit(col)">编辑</Button>
                  <Button type="text" @click.stop="del(col)">删除</Button>
                </div>
              </template>
            </Dropdown>
          </template>
          <div class="flex flex-col min-h-[70px]">
            <div class="mt-2 flex gap-2 flex-wrap">
              <Tag v-if="col.operates.showOrdinal" color="blue" size="small">序号</Tag>
              <Tag v-if="col.operates.deduplicate" color="green" size="small">去重</Tag>
            </div>
          </div>
        </Card>
        <Button class="col-span-3 mt-4" type="dashed" @click="create">
          添加新组合
        </Button>
      </div>
    </div>
    `,
    setup(_, { expose }) {
      expose({
        modalSlots: {
          toolbar: () => [
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: async () => {
                  await Plugins.OpenDir(BASE_PATH)
                }
              },
              () => '打开插件目录'
            ),
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: async () => {
                  await Plugins.OpenDir(CACHE_PATH)
                }
              },
              () => '打开缓存目录'
            )
          ]
        }
      })
      return {
        manager,
        getSubscribeName,
        create: () => {
          openCreateUI(manager)
        },
        edit: (item) => {
          openEditUI(manager, item)
        },
        del: async (item) => {
          await manager.deleteCollection(item)
        }
      }
    }
  })
  const modal = Plugins.modal({
    title: '聚合订阅管理',
    submit: false,
    cancelText: '关闭',
    width: '80',
    height: '80',
    afterClose: () => {
      modal.destroy()
    }
  })
  modal.setContent(component)
  modal.open()
}
const openCreateUI = (manager) => {
  const { reactive, computed, defineComponent } = Vue
  const subscribesStore = Plugins.useSubscribesStore()
  const state = reactive({
    name: '',
    selectedSubs: [],
    external: {},
    operates: { showOrdinal: false, deduplicate: false }
  })
  const existingSubs = computed(() =>
    subscribesStore.subscribes.filter((s) => !manager.collections.value?.some((c) => c.subscriptionId === s.id)).map((s) => ({ id: s.id, name: s.name }))
  )
  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-8 p-8">
      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">1、名称</div>
        <Input v-model="state.name" placeholder="请输入组合名称" class="w-full mt-2" />
      </div>

      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">2、选择已有订阅</div>
        <div class="flex flex-col gap-4 mt-2">
          <div v-if="!existingSubs.length" class="p-8 text-center text-gray-400 border border-dashed rounded">未找到可用订阅</div>
          <div v-else class="grid grid-cols-3 gap-8 p-1 overflow-y-auto max-h-64">
            <Card
              v-for="sub in existingSubs"
              :key="sub.id"
              :title="sub.name"
              :selected="state.selectedSubs.includes(sub.id)"
              @click="toggle(sub.id)"
              class="transition-all cursor-pointer hover:shadow-md"
            />
          </div>
        </div>

        <div class="flex flex-col gap-4 pt-4 border-t border-dashed">
          <div class="font-bold text-14">·添加新订阅</div>
          <KeyValueEditor v-model="state.external" :placeholder="['名称', '链接']" class="mt-2" />
        </div>
      </div>

      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">4、额外操作</div>
        <div class="flex items-center justify-between py-2 mt-2">
          <span class="font-bold text-14">名称添加序号</span>
          <span class="flex-1"></span>
          <Switch v-model="state.operates.showOrdinal" />
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="font-bold text-14">节点去重（地址+端口）</span>
          <span class="flex-1"></span>
          <Switch v-model="state.operates.deduplicate" />
        </div>
      </div>
    </div>
    `,
    setup() {
      return {
        state,
        existingSubs,
        toggle: (id) => {
          const idx = state.selectedSubs.indexOf(id)
          if (idx === -1) state.selectedSubs.push(id)
          else state.selectedSubs.splice(idx, 1)
        }
      }
    }
  })
  const modal = Plugins.modal({
    title: '新建',
    width: '60',
    submitText: '确认',
    cancelText: '取消',
    onOk: async () => {
      if (!state.name.trim()) {
        Plugins.message.error('请输入组合名称')
        return false
      }
      if (!state.selectedSubs.length && !Object.keys(state.external).length) {
        Plugins.message.error('请至少选择/添加一个订阅')
        return false
      }
      try {
        await manager.addCollection(state)
        Plugins.message.success('创建成功')
        return true
      } catch (error) {
        Plugins.message.error(`创建失败：${error instanceof Error ? error.message : String(error)}`)
        return false
      }
    },
    afterClose: () => {
      modal.destroy()
    }
  })
  modal.setContent(component)
  modal.open()
}
const openEditUI = (manager, col) => {
  const { reactive, computed, defineComponent } = Vue
  const subscribesStore = Plugins.useSubscribesStore()
  const state = reactive({
    members: [...col.members],
    operates: { ...col.operates }
  })
  const existingSubs = computed(() =>
    subscribesStore.subscribes.filter((s) => !manager.collections.value?.some((c) => c.subscriptionId === s.id)).map((s) => ({ id: s.id, name: s.name }))
  )
  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-8 p-8">
      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">成员订阅</div>
        <div class="grid grid-cols-3 gap-8 p-1 overflow-y-auto max-h-64 mt-2">
          <Card
            v-for="sub in existingSubs"
            :key="sub.id"
            :title="sub.name"
            :selected="state.members.includes(sub.id)"
            @click="toggle(sub.id)"
            class="transition-all cursor-pointer hover:shadow-md"
          />
        </div>
      </div>

      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">额外操作</div>
        <div class="flex items-center justify-between py-2 mt-2">
          <span class="font-bold text-14">序号</span>
          <span class="flex-1"></span>
          <Switch v-model="state.operates.showOrdinal" />
        </div>
        <div class="flex items-center justify-between py-2">
          <span class="font-bold text-14">去重</span>
          <span class="flex-1"></span>
          <Switch v-model="state.operates.deduplicate" />
        </div>
      </div>
    </div>
    `,
    setup() {
      return {
        state,
        existingSubs,
        toggle: (id) => {
          const idx = state.members.indexOf(id)
          if (idx === -1) state.members.push(id)
          else state.members.splice(idx, 1)
        }
      }
    }
  })
  const modal = Plugins.modal({
    title: '编辑',
    width: '60',
    submitText: '保存',
    cancelText: '取消',
    onOk: async () => {
      if (!state.members.length) {
        Plugins.message.error('请至少选择一个订阅')
        return false
      }
      col.members = [...state.members]
      col.operates = { ...state.operates }
      try {
        await manager.saveCollections()
        Plugins.message.success('保存成功')
        return true
      } catch (error) {
        Plugins.message.error(`保存失败：${error instanceof Error ? error.message : String(error)}`)
        return false
      }
    },
    afterClose: () => {
      modal.destroy()
    }
  })
  modal.setContent(component)
  modal.open()
}
class SubscribeCollectionManager {
  collections = window[Plugin.id].collections
  async init() {
    if (!(await Plugins.FileExists(CACHE_PATH))) {
      await Plugins.MakeDir(CACHE_PATH)
    }
    if (!(await Plugins.FileExists(BASE_PATH))) {
      await Plugins.MakeDir(BASE_PATH)
      await Plugins.WriteFile(MANAGER_CONFIG_PATH, '[]')
      this.collections.value = []
      return
    }
    this.collections.value = await Plugins.ReadFile(MANAGER_CONFIG_PATH)
      .then((content) => JSON.parse(content))
      .catch((error) => {
        console.error(`[${Plugin.name}]`, '管理配置读取失败', error)
        return []
      })
  }
  async addCollection(payload) {
    const subscribesStore = Plugins.useSubscribesStore()
    const col = {
      id: Plugins.sampleID(),
      members: [...payload.selectedSubs],
      operates: { ...payload.operates },
      subscriptionId: ''
    }
    for (const [name, url] of Object.entries(payload.external)) {
      if (!name.trim() || !url.trim()) continue
      const newSub = subscribesStore.getSubscribeTemplate(name.trim(), { url: url.trim() })
      newSub.header.request = {
        'User-Agent': 'Clash.Meta'
      }
      await subscribesStore.addSubscribe(newSub)
      col.members.push(newSub.id)
    }
    const colSub = subscribesStore.getSubscribeTemplate(payload.name, { url: getProxiesCachePath(col) })
    colSub.type = 'File'
    await subscribesStore.addSubscribe(colSub)
    col.subscriptionId = colSub.id
    await writeCache(col, [])
    this.collections.value?.push(col)
    await this.saveCollections()
    await subscribesStore.updateSubscribe(colSub.id)
  }
  /**
   * 删除集合（可选删除承载订阅）
   */
  async deleteCollection(col) {
    const sure = await Plugins.confirm('删除', `确定要删除「${getSubscribeName(col.subscriptionId)}」吗？`).catch(() => false)
    if (!sure) return
    const subscribesStore = Plugins.useSubscribesStore()
    const idx = this.collections.value.findIndex((c) => c.id === col.id)
    if (idx >= 0) this.collections.value.splice(idx, 1)
    await Plugins.RemoveFile(subscribesStore.getSubscribeById(col.subscriptionId).path)
    await subscribesStore.deleteSubscribe(col.subscriptionId)
    await Plugins.RemoveFile(getProxiesCachePath(col))
    await this.saveCollections()
    Plugins.message.success('已删除')
  }
  async saveCollections() {
    await Plugins.WriteFile(MANAGER_CONFIG_PATH, JSON.stringify(this.collections.value, null, 2))
  }
}
const updateCollection = async (col) => {
  const subscribesStore = Plugins.useSubscribesStore()
  const memberIds = new Set(col.members)
  const members = subscribesStore.subscribes.filter((s) => memberIds.has(s.id))
  if (members.length === 0) {
    Plugins.message.warn(`组合「${getSubscribeName(col.subscriptionId)}」没有可用成员，已跳过`)
    return
  }
  const allProxies = []
  for (const sub of members) {
    try {
      await subscribesStore.updateSubscribe(sub.id)
      const content = await Plugins.ReadFile(sub.path, { Mode: 'Text' })
      const proxies = CORE === 'sing-box' ? JSON.parse(content) : Plugins.YAML.parse(content).proxies
      allProxies.push(...proxies)
    } catch (err) {
      Plugins.message.warn(`成员订阅 ${sub.name} 更新失败，已忽略，${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (allProxies.length === 0) return
  let collectionProxies = allProxies
  // 去重：server + port
  if (col.operates.deduplicate) {
    const unique = new Set()
    collectionProxies = collectionProxies.filter((p) => {
      const server = p.server
      const port = CORE === 'sing-box' ? p.server_port : p.port
      const key = `${server}:${port}`
      if (!unique.has(key)) {
        unique.add(key)
        return true
      }
      return false
    })
  }
  // 名称添加序号
  if (col.operates.showOrdinal) {
    const width = String(collectionProxies.length).length
    collectionProxies = collectionProxies.map((p, i) => {
      const seq = String(i + 1).padStart(width, '0')
      if (CORE === 'sing-box') {
        const tag = p.tag
        return { ...p, tag: `${tag} - ${seq}` }
      }
      const name = p.name
      return { ...p, name: `${name} - ${seq}` }
    })
  }
  await writeCache(col, collectionProxies)
  return collectionProxies
}
const writeCache = async (col, proxies) => {
  const cachePath = getProxiesCachePath(col)
  const contentToWrite = CORE === 'sing-box' ? JSON.stringify({ outbounds: proxies }, null, 2) : Plugins.YAML.stringify({ proxies })
  await Plugins.WriteFile(cachePath, contentToWrite)
}
const getProxiesCachePath = (col) => {
  return `${CACHE_PATH}/${col.id}${CORE === 'sing-box' ? '.json' : '.yaml'}`
}
const getSubscribeName = (id) => {
  return Plugins.useSubscribesStore().getSubscribeById(id)?.name ?? 'Not Found'
}
