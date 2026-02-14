/* 触发器 手动触发 */
const onRun = async () => {
  showUI()
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  const appStore = Plugins.useAppStore()
  appStore.addCustomActions('profiles_header', {
    id: Plugin.id,
    component: 'Button',
    componentProps: {
      type: 'link',
      onClick: showUI
    },
    componentSlots: {
      default: '快速配置向导'
    }
  })
}

const showUI = () => {
  const { h, ref, watch, computed, resolveComponent } = Vue

  const currentStep = ref(0)
  const isDirectIPv6Enabled = ref(false)
  const isProxyIPv6Enabled = ref(false)
  const isAllowLanEnabled = ref(false)
  const lanPort = ref()
  const isTUNEnabled = ref(false)
  const isFakeIPEnabled = ref(false)
  const isBanQUICEnabled = ref(true)
  const isDohEnabled = ref(true)

  const name = ref(Plugins.sampleID())
  const subsMap = ref({})
  const subsRef = ref([])

  const isSupportIPv6 = ref()
  watch(currentStep, async (step) => {
    if (step === 1) {
      isSupportIPv6.value = undefined
      isSupportIPv6.value = await checkIPv6Support()
    }
  })

  const component = {
    template: `
    <div>
      <Progress :percent="(currentStep / 7) * 100" />
      <div v-if="currentStep === 0">
        <div class="text-32 py-8 font-bold">欢迎使用快速配置向导</div>
        <p>此向导可帮你生成一份不会出错的配置。开始前请：</p>
        <ul>
          <li class="my-16">关闭所有代理软件（避免影响IPv6判断）</li>
          <li class="my-16">开启路由器及本机的IPv6协议栈（避免影响IPv6判断）</li>
          <li class="my-16">如果你禁用过Windows的智能多宿主DNS解析，请还原（避免影响TUN模式）</li>
        </ul>
      </div>
      <div v-if="currentStep === 1" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">直连网站是否需要IPv6？</div>
        <Tag v-if="isSupportIPv6 === undefined">正在检测你的网络环境...</Tag>
        <Tag v-else-if="isSupportIPv6" color="green">提示：你的网络环境已支持IPv6，推荐开启！访问国内网站能获得更好的效果！</Tag>
        <Tag v-else color="red">提示：你的网络环境不支持IPv6，建议关闭！强行开启会导致部分网站无法访问！</Tag>
        <div class="flex gap-8">
          <Card @click="isDirectIPv6Enabled = true" :selected="isDirectIPv6Enabled" title="需要" class="flex-1" subtitle="优先通过 IPv6 访问直连网站" />
          <Card @click="isDirectIPv6Enabled = false" :selected="!isDirectIPv6Enabled" title="不需要" class="flex-1" subtitle="仅使用 IPv4 访问直连网站" />
        </div>
      </div>

      <div v-if="currentStep === 2" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">代理网站是否需要IPv6？</div>
        <Tag>如果你是自建用户，且节点支持IPv6，请选择需要；如果你是机场用户，节点通常不支持IPv6，请选择不需要。</Tag>
        <div class="flex gap-8">
          <Card @click="isProxyIPv6Enabled = true" :selected="isProxyIPv6Enabled" title="需要" class="flex-1" selected subtitle="优先通过 IPv6 访问被代理的网站" />
          <Card @click="isProxyIPv6Enabled = false" :selected="!isProxyIPv6Enabled" title="不需要" class="flex-1" subtitle="代理访问时仅使用 IPv4" />
        </div>
      </div>

      <div v-if="currentStep === 3" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">是否需要代理局域网设备？</div>
        <Tag>通常情况下你无需开启此项</Tag>
        <div class="flex gap-8">
          <Card @click="isAllowLanEnabled = true" :selected="isAllowLanEnabled" title="需要" class="flex-1" selected subtitle="入站代理将监听所有局域网地址" />
          <Card @click="isAllowLanEnabled = false" :selected="!isAllowLanEnabled" title="不需要" class="flex-1" subtitle="入站代理仅监听本机地址" />
        </div>
        <template v-if="isAllowLanEnabled">
          <h4>如果你想自定义开放的端口，请填写：</h4>
          <Input v-model="lanPort" placeholder="请输入端口号" />
        </template>
      </div>

      <div v-if="currentStep === 4" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">是否需要开启TUN模式？</div>
        <Tag>开启后，会新建一张虚拟网卡，所有软件的流量将通过核心进行转发</Tag>
        <div class="flex gap-8">
          <Card @click="isTUNEnabled = true" :selected="isTUNEnabled" title="需要" class="flex-1" selected subtitle="所有流量将通过虚拟网卡并由核心转发" />
          <Card @click="isTUNEnabled = false" :selected="!isTUNEnabled" title="不需要" class="flex-1" subtitle="无法代理不遵循系统代理规则的软件" />
        </div>
        <div v-if="isTUNEnabled">
          <p>注意事项</p>
          <ul class="text-14">
            <li class="my-16">Windows下启用TUN模式需要管理员权限，Linux/MacOS下需要到设置-内核页进行手动授权（每次更新核心后均需要重新手动授权）。</li>
            <li class="my-16">MacOS下需要前往系统网络设置，将系统DNS修改为公网IP，例如8.8.8.8，以便核心劫持DNS请求。</li>
            <li class="my-16">如果遇到网络不通，请尝试更换不同的TUN堆栈模式。</li>
          </ul>
        </div>
      </div>

      <div v-if="currentStep === 5" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">是否需要对本地DNS查询请求进行加密？</div>
        <Tag>防止DNS查询请求被监听、篡改。部分地区无法正常使用Doh服务，请更换服务器或关闭。</Tag>
        <div class="flex gap-8">
          <Card @click="isDohEnabled = true" :selected="isDohEnabled" title="需要" class="flex-1" selected subtitle="使用加密DNS查询" />
          <Card @click="isDohEnabled = false" :selected="!isDohEnabled" title="不需要" class="flex-1" subtitle="使用明文DNS查询" />
        </div>
      </div>

      <div v-if="currentStep === 6" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">是否需要开启Fake-IP模式？</div>
        <Tag>开启后，部分网站的DNS查询将返回虚假的IP。（通常对需要代理的网站返回fake-ip）</Tag>
        <div class="flex gap-8">
          <Card @click="isFakeIPEnabled = true" :selected="isFakeIPEnabled" title="需要" class="flex-1" selected subtitle="被代理的网站返回 fake-ip" />
          <Card @click="isFakeIPEnabled = false" :selected="!isFakeIPEnabled" title="不需要" class="flex-1" subtitle="所有网站均返回真实 IP" />
        </div>
      </div>

      <div v-if="currentStep === 7" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">是否需要禁用QUIC？</div>
        <Tag>部分网站会使用QUIC协议，这通常会影响访问代理网站的速度</Tag>
        <div class="flex gap-8">
          <Card @click="isBanQUICEnabled = true" :selected="isBanQUICEnabled" title="需要" class="flex-1" selected subtitle="阻止网站使用 QUIC，避免影响代理速度" />
          <Card @click="isBanQUICEnabled = false" :selected="!isBanQUICEnabled" title="不需要" class="flex-1" subtitle="允许网站使用 QUIC 协议" />
        </div>
      </div>

      <div v-if="currentStep === 8" class="flex flex-col gap-8">
        <div class="text-32 py-8 font-bold">现在，为此配置引用一个或多个订阅？</div>
        <p>点击下方+号，左侧填写订阅名称，右侧填写订阅链接。或者，稍后再说~</p>
        <KeyValueEditor v-model="subsMap" :placeholder="['订阅名', '远程订阅链接']" />
        <template v-if="subs.length > 0">
          <p>哇哦！你已经添加了一些订阅，勾选它们直接引用！</p>
          <div class="grid grid-cols-3 gap-8">
            <Card v-for="sub in subs" :key="sub.id" :title="sub.name" @click="toggleSubRef(sub)" :selected="subsRef.includes(sub)" />
          </div>
        </template>
        <p v-if="Object.keys(subsMap).length + subsRef.length > 1">如果你打算引用多个订阅，这些订阅中可能包含相同名称的节点，造成核心启动失败。但你可以在插件中心找到解决方案。</p>
      </div>
    </div>
    `,
    setup() {
      const subscribeStore = Plugins.useSubscribesStore()

      const subs = computed(() => subscribeStore.subscribes.map((v) => ({ name: v.name, id: v.id })))

      return {
        currentStep,
        isSupportIPv6,
        isDirectIPv6Enabled,
        isProxyIPv6Enabled,
        isAllowLanEnabled,
        lanPort,
        isTUNEnabled,
        isDohEnabled,
        isFakeIPEnabled,
        isBanQUICEnabled,
        subsMap,
        subsRef,
        subs,
        name,
        toggleSubRef(sub) {
          const idx = subsRef.value.indexOf(sub)
          if (idx === -1) {
            subsRef.value.push(sub)
          } else {
            subsRef.value.splice(idx, 1)
          }
        }
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      width: '90',
      height: '90',
      maskClosable: true,
      submitText: '完成',
      afterClose() {
        modal.destroy()
      },
      async onOk() {
        const profilesStore = Plugins.useProfilesStore()
        const subscribeStore = Plugins.useSubscribesStore()

        // 1、导入订阅
        const subIds = []
        for (const [name, url] of Object.entries(subsMap.value)) {
          const sub = subscribeStore.getSubscribeTemplate(name, { url })
          await subscribeStore.addSubscribe(sub)
          await Plugins.sleep(1000)
          subIds.push({ name, id: sub.id })
        }

        // 2、导入配置
        const profile = profilesStore.getProfileTemplate(name.value)
        ;[...subIds, ...subsRef.value].forEach(({ name, id }) => {
          if (Plugins.APP_TITLE.includes('SingBox')) {
            profile.outbounds[0].outbounds.push({ id: id, tag: name, type: 'Subscription' })
            profile.outbounds[1].outbounds.push({ id: id, tag: name, type: 'Subscription' })
          } else if (Plugins.APP_TITLE.includes('Clash')) {
            profile.proxyGroupsConfig[0].use.push(id)
            profile.proxyGroupsConfig[1].use.push(id)
          }
        })

        // 3、个性化配置
        personalizeProfile(profile, {
          isDirectIPv6Enabled: isDirectIPv6Enabled.value,
          isProxyIPv6Enabled: isProxyIPv6Enabled.value,
          isAllowLanEnabled: isAllowLanEnabled.value,
          lanPort: lanPort.value,
          isTUNEnabled: isTUNEnabled.value,
          isDohEnabled: isDohEnabled.value,
          isFakeIPEnabled: isFakeIPEnabled.value,
          isBanQUICEnabled: isBanQUICEnabled.value
        })

        await profilesStore.addProfile(profile)
        Plugins.message.success('完事~')
      }
    },
    {
      default: () => h(component),
      action: () =>
        h('div', { class: 'mr-auto' }, [
          h(
            resolveComponent('Button'),
            {
              type: 'text',
              disabled: currentStep.value < 1,
              onClick: () => (currentStep.value -= 1)
            },
            () => '上一步'
          ),
          h(
            resolveComponent('Button'),
            {
              type: 'text',
              disabled: currentStep.value >= 8,
              onClick: () => (currentStep.value += 1)
            },
            () => '下一步'
          )
        ])
    }
  )

  modal.open()
}

const getRandomUA = () => {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
    'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/534.16 (KHTML, like Gecko) Chrome/10.0.648.133 Safari/534.16',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:34.0) Gecko/20100101 Firefox/34.0',
    'Mozilla/5.0 (X11; U; Linux x86_64; zh-CN; rv:1.9.2.10) Gecko/20100922 Ubuntu/10.10 (maverick) Firefox/3.6.10'
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

const checkIPv6Support = async () => {
  try {
    const { status } = await Plugins.HttpGet('https://ipv6.lookup.test-ipv6.com/ip/', {
      'User-Agent': getRandomUA()
    })
    return status === 200
  } catch (error) {
    console.log(`[${Plugin.name}]`, '检测IPv6失败', error)
    return false
  }
}

const personalizeProfile = async (profile, options) => {
  if (Plugins.APP_TITLE.includes('SingBox')) {
    if (options.isDirectIPv6Enabled) {
      profile.dns.rules[0].strategy = 'prefer_ipv6'
      profile.dns.rules[3].strategy = 'prefer_ipv6'
    } else {
      profile.dns.rules[0].strategy = 'ipv4_only'
      profile.dns.rules[3].strategy = 'ipv4_only'
      profile.inbounds[1].tun.address.pop()
    }

    if (options.isProxyIPv6Enabled) {
      profile.dns.strategy = 'prefer_ipv6'
      profile.dns.rules[1].strategy = 'prefer_ipv6'
      profile.dns.rules[4].strategy = 'prefer_ipv6'
      profile.dns.rules[5].strategy = 'prefer_ipv6'
    } else {
      profile.dns.strategy = 'ipv4_only'
      profile.dns.rules[1].strategy = 'ipv4_only'
      profile.dns.rules[4].strategy = 'ipv4_only'
      profile.dns.rules[5].strategy = 'ipv4_only'
    }

    profile.inbounds[0].mixed.listen.listen = options.isAllowLanEnabled ? '0.0.0.0' : '127.0.0.1'
    if (options.lanPort) {
      profile.inbounds[0].mixed.listen.listen_port = Number(options.lanPort)
    }
    if (!options.isDohEnabled) {
      profile.dns.servers[1].type = 'udp'
      profile.dns.servers[1].server_port = '53'
      profile.dns.servers[1].path = ''
    }
    profile.inbounds[1].enable = options.isTUNEnabled
    profile.dns.rules[4].enable = options.isFakeIPEnabled
    profile.route.rules[6].enable = options.isBanQUICEnabled
  } else if (Plugins.APP_TITLE.includes('Clash')) {
    profile.generalConfig.ipv6 = options.isDirectIPv6Enabled || options.isProxyIPv6Enabled
    profile.dnsConfig.ipv6 = options.isDirectIPv6Enabled || options.isProxyIPv6Enabled

    if (!options.isDirectIPv6Enabled) {
      profile.dnsConfig['nameserver-policy']['rule-set:GEOSITE-CN'] += '&disable-ipv6=true'
    }
    if (!options.isProxyIPv6Enabled) {
      profile.dnsConfig['nameserver-policy']['rule-set:geolocation-!cn'] += '&disable-ipv6=true'
    }

    if (!options.isDohEnabled) {
      profile.dnsConfig['nameserver-policy']['rule-set:GEOSITE-CN'] = profile.dnsConfig['nameserver-policy']['rule-set:GEOSITE-CN'].replace(
        'https://223.5.5.5/dns-query',
        'udp://223.5.5.5'
      )
    }
    profile.generalConfig['allow-lan'] = options.isAllowLanEnabled
    if (options.lanPort) {
      profile.generalConfig['mixed-port'] = Number(options.lanPort)
    }
    profile.tunConfig.enable = options.isTUNEnabled
    if (options.isFakeIPEnabled) {
      profile.dnsConfig['enhanced-mode'] = 'fake-ip'
      profile.dnsConfig.nameserver = ['https://223.5.5.5/dns-query#' + profile.proxyGroupsConfig[2].name]
      profile.dnsConfig['fake-ip-filter'].push('rule-set:GEOSITE-CN')
    }
    profile.rulesConfig[1].enable = options.isBanQUICEnabled
  }
}
