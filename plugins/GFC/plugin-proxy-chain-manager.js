const PATH = 'data/third/proxy-chain-manager'

/* 触发器 生成配置时 */
const onGenerate = async (config, profile) => {
  const subscribesStore = Plugins.useSubscribesStore()

  // 1. 收集proxy-providers节点到proxies，并建立id name双向映射
  const IdNameMapping = {}
  const proxies = []

  for (const subId in config['proxy-providers']) {
    const sub = subscribesStore.getSubscribeById(subId)
    if (sub) {
      sub.proxies.forEach((proxy) => {
        IdNameMapping[proxy.name] = proxy.id
        IdNameMapping[proxy.id] = proxy.name
      })
      const { proxies: _proxies } = Plugins.YAML.parse(await Plugins.ReadFile(sub.path).catch(() => '{"proxies": []}'))
      proxies.push(..._proxies)
    }
  }

  // 2. 读取链式代理配置
  const filePath = `${PATH}/${profile.id}.json`
  // prettier-ignore
  const DialerProxyMapping = await Plugins.ReadFile(filePath).then((res) => JSON.parse(res)).catch(() => ({}))

  // 3. 应用代理链规则
  const proxiesMap = new Map()
  ;[...config['proxies'], ...proxies].forEach((proxy) => {
    const proxyId = IdNameMapping[proxy.name]
    const dialerProxyId = DialerProxyMapping[proxyId]
    proxy['dialer-proxy'] = IdNameMapping[dialerProxyId]
    proxiesMap.set(proxy.name, proxy)
  })

  config['proxies'] = [...proxiesMap.values()]

  delete config['proxy-providers']

  return config
}

/* 触发器 手动触发 */
const onRun = async () => {
  const profilesStore = Plugins.useProfilesStore()
  const profile = await Plugins.picker.single(
    '请选择一个配置',
    profilesStore.profiles.map((v) => ({
      label: v.name,
      value: v
    })),
    [profilesStore.profiles[0]]
  )
  await showUI(profile)
}

const showUI = async (profile) => {
  const { h, ref, toRaw, shallowRef } = Vue

  const subscribesStore = Plugins.useSubscribesStore()
  const subIds = profile.proxyGroupsConfig.flatMap((group) => group.use)
  // 此配置引用的所有订阅，TODO: 引用的节点暂时不管了
  const subs = ref([])
  subs.value = [...new Set(subIds)].flatMap((id) => {
    const sub = subscribesStore.getSubscribeById(id)
    if (!sub) return []
    return { name: sub.name, type: 'sub', proxies: Plugins.deepClone(toRaw(sub.proxies)) }
  })
  // 策略组
  subs.value.unshift({
    name: '策略组',
    type: 'group',
    proxies: profile.proxyGroupsConfig.map((group) => ({ id: group.id, name: group.name }))
  })

  const filePath = `${PATH}/${profile.id}.json`
  const proxies = subs.value.flatMap((sub) => sub.proxies)

  const component = {
    template: `
    <div class="flex flex-col gap-8 pb-8 pr-8">
      <div v-for="sub in subs" :key="sub.id">
        <div class="font-bold text-16 m-8">{{ sub.name }}</div>
        <div class="gap-8" :class="{group: 'grid grid-cols-4', sub: 'flex flex-col'}[sub.type]">
          <Card
            v-for="proxy in sub.proxies"
            @click="onAddOrRemove(proxy)"
            :selected="proxy !== currentProxy && isInChain(proxy, currentProxy)"
            :title="proxy.name"
            :key="proxy.id"
          >
            <template #title-suffix>
              <div class="text-12 ml-16">
                {{ proxy.next?.name ? \`dialer-proxy: \${proxy.next?.name}\` : '' }}
              </div>
            </template>
            <template #extra>
              <Button v-if="sub.type === 'sub'" @click.stop="explainChain(proxy)" type="link" size="small">解释</Button>
              <template v-if="!currentProxy">
                <Button v-if="sub.type === 'sub'" @click.stop="startConf(proxy)" type="link" size="small">配置</Button>
              </template>
              <Button v-else-if="currentProxy === proxy" @click.stop="stopConf(proxy)" type="link" size="small">完成</Button>
              <Button v-else type="link" size="small">点击可添加或删除</Button>
            </template>
            <div class="text-14">
              {{ renderChain(proxy) }}
            </div>
          </Card>
        </div>
      </div>
    </div>`,
    setup() {
      const currentProxy = shallowRef()

      function startConf(proxy) {
        currentProxy.value = proxy
      }

      function stopConf() {
        currentProxy.value = null
      }

      function onAddOrRemove(proxy) {
        const current = currentProxy.value

        if (current === proxy) {
          Plugins.message.info('不能添加自己')
          return
        }

        if (isInChain(current, proxy)) {
          Plugins.message.info('试图循环引用')
          return
        }

        if (isInChain(proxy, current)) {
          // 断开链
          cutChain(proxy, current)
          return
        }

        const last = getLast(current)
        last.next = proxy
      }

      const getLast = (proxy) => {
        let last = proxy
        while (last.next) {
          last = last.next
        }
        return last
      }

      const isInChain = (proxy, chain) => {
        if (!proxy || !chain) return false
        if (proxy === chain) {
          return true
        }
        let last = chain
        while (last.next) {
          last = last.next
          if (last === proxy) {
            return true
          }
        }
        return false
      }

      function cutChain(proxy, chain) {
        let prev = null
        let curr = chain
        while (curr) {
          if (curr === proxy) {
            prev.next = curr.next
            delete curr.next
            break
          }
          prev = curr
          curr = curr.next
        }
      }

      function renderChain(proxy) {
        const proxies = []
        let curr = proxy

        while (curr) {
          proxies.push(curr.name)
          curr = curr.next
        }

        if (proxies.length === 1) {
          // 避免界面杂乱，不显示空链
          return ''
        }

        const parts = []

        // 最后一个代理：嵌套所有前置代理
        let nested = '请求'
        for (let i = 0; i < proxies.length - 1; i++) {
          nested = `${proxies[i]}(${nested})`
        }
        parts.push(`${proxies[proxies.length - 1]}(${nested})`)

        // 前面的代理各自包一层 请求
        for (let i = proxies.length - 2; i >= 0; i--) {
          parts.push(`${proxies[i]}(请求)`)
        }

        return `核心(请求) -> ${parts.join(' -> ')} -> 请求 -> 目标网站`
      }

      function explainChain(proxy) {
        const proxies = []
        let curr = proxy

        while (curr) {
          proxies.push(curr.name)
          curr = curr.next
        }

        if (proxies.length === 1) {
          Plugins.message.info('未配置代理链，无需解释')
          return
        }

        const lines = []

        // 0. 代理链预览
        lines.push('> ' + renderChain(proxy))

        // 1. 本地封装阶段
        lines.push('## 1. 本地封装阶段')
        lines.push('')
        lines.push('核心首先在本地构造对目标网站的原始请求。')
        lines.push('随后，核心按照代理链顺序对请求进行多层封装，形成类似“洋葱结构”的数据包：')
        lines.push('')
        lines.push(`- 目标网站请求作为最内层数据；`)
        lines.push(`- 由 \`${proxies[0]}\` 客户端对请求进行第一层封装；`)

        for (let i = 1; i < proxies.length; i++) {
          lines.push(`- 再由 \`${proxies[i]}\` 客户端在前一层基础上继续封装；`)
        }

        lines.push('')
        lines.push(`封装完成后，请求被发送至最外层的 \`${proxies[proxies.length - 1]}\` 服务端。`)
        lines.push('')

        // 2. 服务端转发阶段
        lines.push('## 2. 服务端转发阶段')
        lines.push('')
        lines.push(`最外层的 \`${proxies[proxies.length - 1]}\` 服务端接收到请求后，解开最外层封装，获取下一跳地址。`)

        for (let i = proxies.length - 1; i > 0; i--) {
          lines.push(`随后，\`${proxies[i]}\` 服务端将解封后的请求转发给 \`${proxies[i - 1]}\` 服务端，后者继续解封并转发。`)
        }

        lines.push('')

        // 3. 最终请求阶段
        lines.push('## 3. 最终请求阶段')
        lines.push('')
        lines.push(`当请求到达 \`${proxies[0]}\` 服务端时，最后一层封装被移除。`)
        lines.push('此时，服务端获得原始的目标请求，并将其发送至目标网站，完成整个请求链路。')

        Plugins.alert('此链解释如下', lines.join('\n'), { type: 'markdown' })
      }

      function restoreProxies(proxies, nextMap) {
        const proxyMap = {}

        // 1. 建立 id -> proxy 的索引
        for (const proxy of proxies) {
          proxy.next = null // 先清空，防止脏引用
          proxyMap[proxy.id] = proxy
        }

        // 2. 根据 nextMap 恢复 next 引用
        for (const [id, nextId] of Object.entries(nextMap)) {
          if (!proxyMap[id]) continue
          proxyMap[id].next = nextId ? proxyMap[nextId] || null : null
        }

        return proxies
      }

      Plugins.ReadFile(filePath).then((res) => {
        const mapping = JSON.parse(res)
        restoreProxies(proxies, mapping)
      })

      return {
        subs,
        currentProxy,
        startConf,
        stopConf,
        onAddOrRemove,
        renderChain,
        explainChain,
        isInChain
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      width: '90',
      height: '90',
      async onOk() {
        const result = {}
        for (const proxy of proxies) {
          result[proxy.id] = proxy.next ? proxy.next.id : null
        }
        await Plugins.WriteFile(filePath, JSON.stringify(result, null, 2))
        Plugins.message.success('common.success')
      },
      afterClose() {
        modal.destroy()
      }
    },
    {
      default: () => h(component)
    }
  )
  modal.open()
}
