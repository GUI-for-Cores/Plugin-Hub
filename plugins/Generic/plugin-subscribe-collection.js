const isSingBox = Plugins.APP_TITLE.includes('SingBox')

const onRun = async () => {
  showUI()
}

const onReady = async () => {
  const appStore = Plugins.useAppStore()
  appStore.addCustomActions('subscriptions_header', {
    id: Plugin.id,
    component: 'Button',
    componentProps: {
      type: 'link',
      onClick: showUI
    },
    componentSlots: {
      default: '添加组合订阅'
    }
  })
}

const showUI = () => {
  const { h, reactive, computed, defineComponent } = Vue
  const subscribesStore = Plugins.useSubscribesStore()
  const state = reactive({
    name: '',
    selectedSubs: [],
    externalSubs: {},
    operates: {
      addSequence: false,
      deduplicate: false
    }
  })
  const existingSubs = computed(() => subscribesStore.subscribes.map((sub) => sub.name))
  const component = defineComponent({
    template: `
    <div class="flex flex-col gap-8 p-4 select-none">
      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">1. 名称</div>
        <Input v-model="state.name" placeholder="请输入组合订阅的名称" class="w-full" />
      </div>

      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">2. 选择订阅</div>
        <div class="flex flex-col gap-4">
           <div v-if="!existingSubs.length" class="p-8 text-center text-gray-400 border border-dashed rounded">未添加任何订阅</div>
           <div v-else class="grid grid-cols-3 gap-8 p-1 overflow-y-auto max-h-64">
              <Card
                v-for="name in existingSubs"
                :key="name"
                :title="name"
                :selected="state.selectedSubs.includes(name)"
                @click="toggleSelection(name)"
                class="transition-all cursor-pointer hover:shadow-md"
              />
           </div>
        </div>

        <div class="flex flex-col gap-4 pt-4 border-t border-dashed">
           <div class="font-bold text-14">添加外部订阅</div>
           <KeyValueEditor v-model="state.externalSubs" :placeholder="['名称', '链接']" />
        </div>
      </div>

      <div class="flex flex-col gap-6 p-6 border rounded">
        <div class="font-bold text-16">3. 可选操作</div>

        <div class="flex items-center justify-between py-2">
          <span class="font-bold text-14">名称添加序号</span>
          <Switch v-model="state.operates.addSequence" />
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="font-bold text-14">地址+端口去重</span>
          <Switch v-model="state.operates.deduplicate" />
        </div>
      </div>

    </div>
    `,
    setup() {
      const toggleSelection = (name) => {
        const idx = state.selectedSubs.indexOf(name)
        if (idx === -1) state.selectedSubs.push(name)
        else state.selectedSubs.splice(idx, 1)
      }
      return { state, existingSubs, toggleSelection }
    }
  })
  const modal = Plugins.modal(
    {
      title: '聚合订阅',
      width: '720px',
      maskClosable: true,
      cancel: true,
      submitText: '添加',
      afterClose: () => {
        modal.destroy()
      },
      onOk: async () => {
        if (!state.name.trim()) {
          Plugins.message.error('请输入订阅的名称')
          return false
        }
        if (!state.selectedSubs.length && !Object.keys(state.externalSubs).length) {
          Plugins.message.error('请至少选择一个订阅')
          return false
        }
        try {
          await addCollectionSubs(state)
          return true
        } catch (err) {
          Plugins.message.error(err.message ?? String(err))
          return false
        }
      }
    },
    {
      default: () => h(component)
    }
  )
  modal.open()
}

const addCollectionSubs = async (state) => {
  const { name, selectedSubs, externalSubs, operates } = state
  const subscribesStore = Plugins.useSubscribesStore()
  for (const [name, url] of Object.entries(externalSubs)) {
    const subscription = subscribesStore.getSubscribeTemplate(name, { url })
    await subscribesStore.addSubscribe(subscription)
    selectedSubs.push(name)
  }
  const script = generateScript({ names: selectedSubs, operates })
  const collectionSubscription = subscribesStore.getSubscribeTemplate(name, { url: '' })
  collectionSubscription.type = 'Manual'
  collectionSubscription.script = script
  await subscribesStore.addSubscribe(collectionSubscription)
  await Plugins.WriteFile(collectionSubscription.path, '[]')
  await Plugins.alert('提示', `已添加组合订阅「${state.name}」\n\n之后如需修改订阅配置，请手动编辑订阅脚本`)
}

const generateScript = (params) => {
  const { names, operates } = params
  return `
const onSubscribe = async (proxies, subscription) => {
  const members = ${JSON.stringify(names)};  //如需添加或移除订阅请修改此处
  const operates = ${JSON.stringify(operates, null, 2)};  //如需启用或禁用操作请修改此处

  const subscribesStore = Plugins.useSubscribesStore();
  const promises = subscribesStore.subscribes.map(async (sub) => {
    if (members.includes(sub.name)) {
      try {
        await subscribesStore.updateSubscribe(sub.id);
        const proxies = (await Plugins.ReadFile(sub.path, { Mode: 'Text' })) || '[]';
        return Plugins.YAML.parse(proxies);
      } catch (err) {
        Plugins.message.warn(\`\${subscription.name} 的成员 \${sub.name} 更新失败，已忽略，\${err}\`);
        return [];
      }
    }
    return [];
  });

  let collectionProxies = (await Promise.all(promises)).flat();

  if (operates.deduplicate) {
    const uniqueMap = new Map();
    collectionProxies = collectionProxies.filter((p) => {
      const key = \`\${p.server}:${isSingBox ? 'p.server_port' : 'p.port'}\`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, p);
        return true;
      }
      return false;
    });
  }

  if (operates.addSequence) {
    const seqWidth = String(collectionProxies.length).length;
    collectionProxies = collectionProxies.map((p, i) => {
      const seq = String(i + 1).padStart(seqWidth, '0');
      ${
        isSingBox
          ? `
return {
  ...p,
  tag: \`\${p.tag} - \${seq}\`,
};
        `
          : `
return {
  ...p,
  name: \`\${p.name} - \${seq}\`,
};
        `
      }
    });
  }

  return { proxies: collectionProxies, subscription };
};
`.trim()
}
