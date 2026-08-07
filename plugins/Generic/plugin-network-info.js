/**
 * 当前节点网络信息与网站延迟仪表板。
 */

const NETWORK_SOURCES = [
  { key: 'domestic', title: '国内出口', source: 'speedtest.cn' },
  { key: 'overseas', title: '国外出口', source: 'cmliussss API' },
  { key: 'cloudflare', title: 'Cloudflare', source: '090227 API' },
  { key: 'twitter', title: 'X.com', source: 'Cloudflare trace' }
]

const SITES = [
  ['字节跳动', '国内', 'https://lf3-zlink-tos.ugurl.cn/obj/zebra-public/resource_lmmizj_1632398893.png'],
  ['Bilibili', '国内', 'https://i0.hdslb.com/bfs/face/member/noface.jpg@24w_24h_1c'],
  ['微信', '国内', 'https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico'],
  ['淘宝', '国内', 'https://img.alicdn.com/imgextra/i2/O1CN01qnQCrN1VkzAWiU4Hs_!!6000000002692-2-tps-33-33.png'],
  ['GitHub', '国际', 'https://github.github.io/janky/images/bg_hr.png'],
  ['jsDelivr', '国际', 'https://cdn.jsdelivr.net/npm/latency-test@1.0.1/smallest-possible-white.gif'],
  ['Cloudflare', '国际', 'https://www.cloudflare.com/favicon.ico'],
  ['YouTube', '国际', 'https://www.youtube.com/favicon.ico']
].map(([name, region, url]) => ({ name, region, url }))

/** 构造带认证和 IPv6 兼容的本地代理 URL。 */
const proxyUrlOf = (endpoint) => {
  if (!endpoint?.host || !endpoint?.port) throw new Error('没有可用的本地代理入站')
  const host = String(endpoint.host).includes(':') && !String(endpoint.host).startsWith('[') ? `[${endpoint.host}]` : endpoint.host
  const auth = endpoint.username ? `${encodeURIComponent(endpoint.username)}:${encodeURIComponent(endpoint.password || '')}@` : ''
  return `${endpoint.schema || endpoint.proxyType || 'http'}://${auth}${host}:${endpoint.port}`
}

/** 把第三方返回的 trace 文本解析成键值对象。 */
const parseTrace = (body) =>
  Object.fromEntries(
    String(body || '')
      .split(/\r?\n/)
      .map((line) => line.split('=').map((part) => part.trim()))
      .filter(([key, value]) => key && value)
  )

/** 追加时间戳，避免出口信息和延迟请求被缓存。 */
const cacheBust = (url) => `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`

/** 将异常转换成短中文错误信息。 */
const errorText = (error) =>
  String(error?.message || error || '请求失败')
    .replace(/^Error:\s*/, '')
    .slice(0, 120)

/** 按延迟返回界面颜色等级。 */
const latencyClass = (value) =>
  value < 0 ? 'text-red-500' : value <= 80 ? 'text-green-500' : value <= 180 ? 'text-cyan-500' : value <= 350 ? 'text-orange-500' : 'text-red-500'

/** 创建一次检测请求上下文。 */
const createRun = (proxy) => ({ proxy, generation: Date.now() + Math.random(), cancelled: false, ids: new Set() })

/** 取消检测上下文中的全部请求。 */
const cancelRun = (run) => {
  if (!run) return
  run.cancelled = true
  run.ids.forEach((id) => {
    try {
      Plugins.HttpCancel(id)
    } catch {}
  })
  run.ids.clear()
}

/** 通过 GFS 代理请求并返回响应与耗时。 */
const request = async (run, url, autoTransformBody = true) => {
  if (run.cancelled) throw new Error('检测已取消')
  const id = `network-info-${Plugins.sampleID()}`
  run.ids.add(id)
  const started = performance.now()
  try {
    const response = await Plugins.Requests({ method: 'GET', url: cacheBust(url), autoTransformBody, options: { Proxy: run.proxy, Timeout: 10, CancelId: id } })
    if (response.status < 200 || response.status >= 400) throw new Error(`HTTP ${response.status}`)
    return { ...response, elapsed: performance.now() - started }
  } finally {
    run.ids.delete(id)
  }
}

/** 获取国内出口信息，按三个公开接口依次回退。 */
const domesticInfo = async (run) => {
  const sources = [
    [
      'speedtest.cn',
      'https://api-v3.speedtest.cn/ip',
      (body) => {
        if (body?.code !== 0 || !body.data) throw new Error('返回格式异常')
        return { ip: body.data.ip, place: `${body.data.country || ''} ${body.data.city || ''}` }
      }
    ],
    ['ipipv.com', 'https://myip.ipipv.com/', (body) => ({ ip: body.Ip, place: `${body.Country || ''} ${body.City || ''}` })],
    [
      'ipip.net',
      'https://myip.ipip.net/json',
      (body) => {
        if (body?.ret !== 'ok' || !body.data) throw new Error('返回格式异常')
        return { ip: body.data.ip, place: `${body.data.location?.[0] || ''} ${body.data.location?.[2] || ''}` }
      }
    ]
  ]
  let last
  for (const [source, url, parse] of sources) {
    if (run.cancelled) throw new Error('检测已取消')
    try {
      const response = await request(run, url)
      const result = parse(response.body)
      return { ...result, source, elapsed: response.elapsed }
    } catch (error) {
      last = error
    }
  }
  throw last || new Error('国内出口检测失败')
}

/** 获取国外出口信息，按三个公开接口依次回退，全部失败时抛出最后一个错误。 */
const overseasInfo = async (run) => {
  const sources = [
    [
      'cmliussss API',
      'https://api.cmliussss.net/api/ipinfo',
      (body) => {
        if (!body?.ip) throw new Error('返回格式异常')
        return { ip: body.ip, place: `${body.country_code || ''} AS${body.asn || ''} ${body.as_name || ''}` }
      }
    ],
    [
      'ipinfo.io',
      'https://ipinfo.io/json',
      (body) => {
        if (!body?.ip) throw new Error('返回格式异常')
        return { ip: body.ip, place: `${body.country || ''} ${body.org || ''}` }
      }
    ],
    [
      'ipapi.co',
      'https://ipapi.co/json/',
      (body) => {
        if (!body?.ip) throw new Error('返回格式异常')
        return { ip: body.ip, place: `${body.country_code || body.country_name || ''} ${body.org || (body.asn ? `AS${body.asn}` : '')}` }
      }
    ]
  ]
  let last
  for (const [source, url, parse] of sources) {
    if (run.cancelled) throw new Error('检测已取消')
    try {
      const response = await request(run, url)
      const result = parse(response.body)
      return { ...result, source, elapsed: response.elapsed }
    } catch (error) {
      last = error
    }
  }
  throw last || new Error('国外出口检测失败')
}

/** 获取四类出口信息。 */
const networkInfo = async (run) => {
  const jobs = [
    domesticInfo(run),
    overseasInfo(run),
    request(run, 'https://cf.090227.xyz/ip.json').then((r) => ({
      ip: r.body.ip,
      place: `${r.body.country || ''} ${r.body.org || ''}`,
      source: 'cf.090227.xyz',
      elapsed: r.elapsed
    })),
    request(run, 'https://help.x.com/cdn-cgi/trace', false).then((r) => {
      const data = parseTrace(r.body)
      return { ip: data.ip, place: `${data.loc || ''} ${data.colo || ''}`, source: 'X.com trace', elapsed: r.elapsed }
    })
  ]
  return Promise.allSettled(jobs)
}

/** 测量一个网站的请求耗时。 */
const siteLatency = async (run, site) => {
  const response = await request(run, site.url)
  return { ...site, latency: Math.round(response.elapsed), status: '成功', error: '' }
}

/** 打开网络信息仪表板。 */
const onRun = async () => {
  const api = Plugins.useKernelApiStore()
  if (!api.running) return Plugins.message.error('内核未运行，请先启动内核')
  let activeRun = null
  const modal = Plugins.modal({
    title: Plugin.name || '当前网络信息',
    width: '88',
    height: '88',
    submit: false,
    cancelText: '关闭',
    onCancel: () => {
      cancelRun(activeRun)
      return true
    }
  })
  const content = {
    template: `<div class="p-8 text-12"><div class="mt-8 flex items-center gap-8"><div class="text-gray-500">{{summary}}</div><Button v-if="noEndpoint" size="small" @click="retry">重试</Button></div><div class="mt-8 text-gray-500">{{envDesc}}</div><div class="grid grid-cols-4 gap-8 mt-8"><Card v-for="card in cards" :key="card.key" :title="card.title" class="transition-colors" :class="initialLoading ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'" @click="refreshNetworkCard(card)"><div class="text-18 font-bold" :class="card.loading ? 'text-gray-500' : (card.ok ? 'text-green-500' : 'text-red-500')">{{card.loading ? '检测中…' : (card.ok ? card.ip : '失败')}}</div><div class="mt-4">{{card.place || card.error || '尚未检测'}}</div><div class="mt-4 text-gray-500">{{card.source}} · {{card.elapsed ? card.elapsed.toFixed(0) + ' ms' : '—'}}</div></Card></div><div class="flex items-center justify-between mt-12"><div class="font-bold text-16">网站延迟</div><div>可用 {{available}}/8 · 平均 {{average}} ms · {{summarySite}}</div></div><div class="font-bold text-14 mt-8 mb-4">国外检测</div><div class="grid grid-cols-4 gap-8"><Card v-for="site in foreignSites" :key="site.name" :title="site.name" class="transition-colors" :class="initialLoading ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'" @click="refreshSiteCard(site)"><div class="text-gray-500">{{site.region}}</div><div class="text-18 font-bold mt-4" :class="site.loading ? 'text-gray-500' : (site.latency >= 0 ? site.color : 'text-red-500')">{{site.loading ? '检测中…' : (site.latency >= 0 ? site.latency + ' ms' : 'TIMEOUT')}}</div><div class="text-red-500 mt-4">{{site.error}}</div></Card></div><div class="font-bold text-14 mt-8 mb-4">国内检测</div><div class="grid grid-cols-4 gap-8"><Card v-for="site in domesticSites" :key="site.name" :title="site.name" class="transition-colors" :class="initialLoading ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'" @click="refreshSiteCard(site)"><div class="text-gray-500">{{site.region}}</div><div class="text-18 font-bold mt-4" :class="site.loading ? 'text-gray-500' : (site.latency >= 0 ? site.color : 'text-red-500')">{{site.loading ? '检测中…' : (site.latency >= 0 ? site.latency + ' ms' : 'TIMEOUT')}}</div><div class="text-red-500 mt-4">{{site.error}}</div></Card></div><div class="mt-12 text-gray-500">检测请求会通过 GFS 当前配置的本地代理入站，并请求第三方服务；对方可能看到你的出口 IP。仅手动检测，不会自动轮询。</div></div>`,
    setup() {
      const { ref, computed } = Vue
      const cards = ref(NETWORK_SOURCES.map((item) => ({ ...item, ok: false, ip: '', place: '', elapsed: 0, error: '', loading: false })))
      const sites = ref(SITES.map((site) => ({ ...site, latency: -1, color: 'text-red-500', error: '', loading: false })))
      const initialLoading = ref(true)
      const summary = ref('准备就绪')
      let endpoint = null
      try {
        endpoint = api.getProxyEndpoint()
      } catch {}
      const envDesc =
        endpoint?.host && endpoint?.port
          ? `当前网络环境：检测请求会通过 GFS 当前配置的本地代理入站（${endpoint.host}:${endpoint.port}）发送`
          : '当前网络环境：未配置本地代理入站，无法检测'
      const available = computed(() => sites.value.filter((s) => s.latency >= 0).length)
      const average = computed(() => {
        const v = sites.value.filter((s) => s.latency >= 0).map((s) => s.latency)
        return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : '—'
      })
      const summarySite = computed(() => {
        const v = sites.value.filter((s) => s.latency >= 0)
        return v.length ? `最快 ${v.sort((a, b) => a.latency - b.latency)[0].name}` : '无可用站点'
      })
      const foreignSites = computed(() => sites.value.filter((site) => site.region === '国际'))
      const domesticSites = computed(() => sites.value.filter((site) => site.region === '国内'))
      const noEndpoint = ref(false)
      try {
        activeRun = createRun(proxyUrlOf(api.getProxyEndpoint()))
      } catch (error) {
        noEndpoint.value = true
        summary.value = errorText(error)
        initialLoading.value = false
      }
      /** 点击出口卡片时仅重新检测该出口，检测期间忽略重复点击。 */
      const refreshNetworkCard = async (card) => {
        if (initialLoading.value || card.loading || !activeRun) return
        card.loading = true
        try {
          const result =
            card.key === 'domestic'
              ? await domesticInfo(activeRun)
              : card.key === 'overseas'
                ? await overseasInfo(activeRun)
                : card.key === 'cloudflare'
                  ? await request(activeRun, 'https://cf.090227.xyz/ip.json').then((r) => ({
                      ip: r.body.ip,
                      place: `${r.body.country || ''} ${r.body.org || ''}`,
                      source: 'cf.090227.xyz',
                      elapsed: r.elapsed
                    }))
                  : await request(activeRun, 'https://help.x.com/cdn-cgi/trace', false).then((r) => {
                      const data = parseTrace(r.body)
                      return { ip: data.ip, place: `${data.loc || ''} ${data.colo || ''}`, source: 'X.com trace', elapsed: r.elapsed }
                    })
          Object.assign(card, { ok: true, ip: result.ip, place: result.place, source: result.source, elapsed: result.elapsed, error: '' })
        } catch (error) {
          Object.assign(card, { ok: false, error: errorText(error) })
        } finally {
          card.loading = false
        }
      }
      /** 点击网站卡片时仅重新测量该网站，检测期间忽略重复点击。 */
      const refreshSiteCard = async (site) => {
        if (initialLoading.value || site.loading || !activeRun) return
        site.loading = true
        try {
          const result = await siteLatency(activeRun, site)
          Object.assign(site, { latency: result.latency, status: result.status, error: '', color: latencyClass(result.latency) })
        } catch (error) {
          Object.assign(site, { latency: -1, error: errorText(error), color: 'text-red-500' })
        } finally {
          site.loading = false
        }
      }
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
      const detect = async () => {
        initialLoading.value = true
        cards.value.forEach((card) => {
          card.loading = true
        })
        sites.value.forEach((site) => {
          site.loading = true
        })
        try {
          // 出口信息 4 个请求并发发出；网站延迟分批检测（每批 2 个、批间间隔 250ms），避免 12 个请求一次性发出
          const infoPromise = networkInfo(activeRun)
          const latency = []
          for (let i = 0; i < SITES.length; i += 2) {
            if (activeRun.cancelled) return
            const batch = SITES.slice(i, i + 2).map((site) => siteLatency(activeRun, site))
            latency.push(...(await Promise.allSettled(batch)))
            if (!activeRun.cancelled && i + 2 < SITES.length) await sleep(250)
          }
          const info = await infoPromise
          if (activeRun.cancelled) return
          cards.value = NETWORK_SOURCES.map((item, index) => {
            const result = info[index]
            return result?.status === 'fulfilled'
              ? { ...item, ...result.value, ok: true, loading: false }
              : { ...item, ok: false, error: errorText(result?.reason), loading: false }
          })
          sites.value = SITES.map((site, index) => {
            const result = latency[index]
            return result?.status === 'fulfilled'
              ? { ...result.value, color: latencyClass(result.value.latency), loading: false }
              : { ...site, latency: -1, error: errorText(result?.reason), loading: false }
          })
          summary.value = '检测完成 · 点击卡片可单独刷新'
        } catch (error) {
          summary.value = errorText(error)
        } finally {
          initialLoading.value = false
        }
      }
      /** 重新读取本地代理入站并重试检测；失败时保持可重试状态。 */
      const retry = async () => {
        try {
          activeRun = createRun(proxyUrlOf(api.getProxyEndpoint()))
          noEndpoint.value = false
          summary.value = '准备就绪'
          await detect()
        } catch (error) {
          noEndpoint.value = true
          summary.value = errorText(error)
        }
      }
      if (activeRun) detect()
      return {
        cards,
        sites,
        foreignSites,
        domesticSites,
        summary,
        envDesc,
        available,
        average,
        summarySite,
        initialLoading,
        noEndpoint,
        refreshNetworkCard,
        refreshSiteCard,
        retry
      }
    }
  }
  modal.setContent(content)
  modal.open()
}
