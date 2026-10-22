/**
 * eMudhra 中间证书信任检测
 *
 * 2026 年 10 月，eMudhra 在 emSign Root TLS CA - G3 下签发的 6 张中间证书（EM DV/OV/EV TLS CA - G3B/G3C）
 * 被确认存在风险，Go 在 go1.27.3 / go1.26.10 中把它们加入了内置黑名单（GO-2026-6809 / CVE-2026-111943）。
 * 本插件通过客户端的 Go 后端（Plugins.HttpGet）访问一组使用这些中间证书的测试站点，判断客户端是否仍然信任它们。
 */

const TEST_SITES = [
  { host: 'dv-g3b-emudhra.we-have-a-problem.com', type: 'DV', ca: 'EM DV TLS CA - G3B' },
  { host: 'dv-g3c-emudhra.we-have-a-problem.com', type: 'DV', ca: 'EM DV TLS CA - G3C' },
  { host: 'ov-g3b-emudhra.we-have-a-problem.com', type: 'OV', ca: 'EM OV TLS CA - G3B' },
  { host: 'ov-g3c-emudhra.we-have-a-problem.com', type: 'OV', ca: 'EM OV TLS CA - G3C' },
  { host: 'ev-g3b-emudhra.we-have-a-problem.com', type: 'EV', ca: 'EM EV TLS CA - G3B' },
  { host: 'ev-g3c-emudhra.we-have-a-problem.com', type: 'EV', ca: 'EM EV TLS CA - G3C' }
]

const ADVISORY_URL = 'https://pkg.go.dev/vuln/GO-2026-6809'
const TEST_SITE_URL = 'https://emudhra.we-have-a-problem.com/#check'
const FIXED_APP_VERSION = 'v1.28.1'

// 结果分类
const RESULT = {
  pending: { text: '检测中', color: 'default' },
  vulnerable: { text: '仍信任', color: 'red' },
  blocked: { text: '已拦截', color: 'green' },
  untrusted: { text: '证书不受信任', color: 'cyan' },
  unknown: { text: '无法判断', color: 'orange' }
}

/** @type {EsmPlugin} */
export default (plugin) => {
  const configBool = (key, fallback) => {
    const raw = plugin[key]
    if (typeof raw === 'boolean') return raw
    if (typeof raw === 'string' && raw.trim()) return raw.trim() === 'true'
    return fallback
  }

  const configNumber = (key, fallback, min, max) => {
    const n = Number(plugin[key])
    if (!Number.isFinite(n) || n <= 0) return fallback
    return Math.min(max, Math.max(min, Math.round(n)))
  }

  const errorText = (err) => {
    const text = typeof err === 'string' ? err : err?.message || String(err)
    // 去掉 Go 错误里的 `Get "https://...": ` 前缀
    return text
      .replace(/^[A-Za-z]+ "[^"]*": /, '')
      .replace(/^tls: failed to verify certificate: /, '')
      .trim()
  }

  // 按 Go 的错误文本分类：
  // - x509: no valid chains built → Go 内置黑名单生效（go1.27.3+ / go1.26.10+）
  // - 其它证书错误（unknown authority / not trusted 等）→ 系统本身就不信任这条链
  const classifyError = (text) => {
    if (/no valid chains built/i.test(text)) return 'blocked'
    if (/x509:|certificate|tls: failed to verify/i.test(text)) return 'untrusted'
    return 'unknown'
  }

  const getProxy = async () => {
    if (!configBool('UseKernelProxy', false)) return ''
    if (typeof Plugins.GetRequestProxy === 'function') {
      return (await Plugins.GetRequestProxy('kernel')) || ''
    }
    const endpoint = Plugins.useKernelApiStore().getProxyEndpoint?.()
    return endpoint ? `http://${endpoint.host}:${endpoint.port}` : ''
  }

  const testSite = async (site, proxy, timeout) => {
    try {
      const { status, body } = await Plugins.HttpGet(
        `https://${site.host}/`,
        { Connection: 'close' },
        { Proxy: proxy, Insecure: false, Redirect: false, Timeout: timeout }
      )
      const matched = typeof body === 'string' && body.includes('successfully connected')
      return { result: 'vulnerable', detail: `已连接（HTTP ${status}${matched ? '，测试页确认' : ''}）` }
    } catch (err) {
      const detail = errorText(err)
      return { result: classifyError(detail), detail }
    }
  }

  const getAppInfo = () => {
    let env = {}
    try {
      env = Plugins.useEnvStore().env || {}
    } catch {}
    return {
      title: Plugins.APP_TITLE || env.appName || '客户端',
      version: Plugins.APP_VERSION || env.appVersion || '',
      platform: [env.os, env.arch].filter(Boolean).join('/')
    }
  }

  const compareVersion = (a, b) => {
    const pa = String(a)
      .replace(/^v/, '')
      .split(/[.-]/)
      .map((n) => parseInt(n) || 0)
    const pb = String(b)
      .replace(/^v/, '')
      .split(/[.-]/)
      .map((n) => parseInt(n) || 0)
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
    }
    return 0
  }

  const openPanel = () => {
    const { defineComponent, reactive, computed, h, resolveComponent } = Vue

    const component = defineComponent({
      template: /* html */ `
      <div class="flex flex-col gap-8">
        <div class="px-12 py-8 text-12 rounded-4" style="border: 1px solid rgba(34, 197, 94, 0.5); background: rgba(34, 197, 94, 0.08); line-height: 1.7">
          提示：GUI.for.Clash / GUI.for.SingBox ${FIXED_APP_VERSION} 及以上版本已使用 go1.27.3 构建，包含 Go 对该问题的修复，升级客户端即可。
        </div>
        <Card title="检测结论">
          <div class="flex flex-col gap-8 px-8 py-8">
            <div class="flex items-center gap-8" style="flex-wrap: wrap">
              <Tag :color="verdict.color">{{ verdict.tag }}</Tag>
              <span class="font-bold">{{ verdict.title }}</span>
            </div>
            <div class="text-12">{{ verdict.desc }}</div>
            <div class="text-12" style="opacity: 0.8">
              {{ app.title }} {{ app.version || '未知版本' }}<template v-if="app.platform"> · {{ app.platform }}</template>
              · {{ state.proxy ? '经内核代理 ' + state.proxy : '直连' }}
              <template v-if="state.finishedAt"> · 检测于 {{ state.finishedAt }}</template>
            </div>
          </div>
        </Card>
        <Card title="测试站点">
          <div style="overflow-x: auto">
            <Table :columns="columns" :data-source="state.rows" />
          </div>
        </Card>
        <Card title="说明">
          <div class="flex flex-col gap-4 px-8 py-8 text-12" style="line-height: 1.7">
            <div>eMudhra（印度 CA）在 emSign Root TLS CA - G3 下签发的 6 张中间证书（EM DV/OV/EV TLS CA - G3B/G3C）已被吊销并确认不可信。Go 在 go1.27.3 / go1.26.10 中内置了这几张证书的黑名单（GO-2026-6809 / CVE-2026-111943），Linux 上 Go 不检查吊销列表，只能依靠这份黑名单。</div>
            <div>本插件通过客户端自身的 Go 后端访问上面的测试站点：能连上说明后端仍信任这些证书；出现 “x509: no valid chains built” 说明 Go 的黑名单已生效；“unknown authority” 等证书错误说明当前系统本就不信任 emSign 根证书，暂不受影响，但无法据此确认客户端是否已修复。</div>
            <div>修复方式：将 GUI.for.Clash / GUI.for.SingBox 升级到 ${FIXED_APP_VERSION} 或更高版本（使用 go1.27.3 构建）。</div>
            <div>注意：本检测只覆盖 GUI 客户端本身（订阅更新、下载内核与插件等请求）。代理内核 mihomo / sing-box 是独立的程序，其 TLS 校验不在本检测范围内，需等待内核上游使用修复后的 Go 发版。</div>
          </div>
        </Card>
      </div>`,
      setup(_, { expose }) {
        const app = getAppInfo()
        const state = reactive({
          running: false,
          proxy: '',
          finishedAt: '',
          rows: TEST_SITES.map((site) => ({ id: site.host, ...site, result: 'pending', detail: '' }))
        })

        const columns = [
          { title: '站点', key: 'host', minWidth: '220px' },
          { title: '类型', key: 'type', align: 'center', customRender: ({ record }) => `${record.type} · ${record.ca.slice(-3)}` },
          {
            title: '结果',
            key: 'result',
            align: 'center',
            customRender: ({ value }) => h(resolveComponent('Tag'), { color: RESULT[value].color, size: 'small' }, () => RESULT[value].text)
          },
          { title: '详情', key: 'detail', customRender: ({ value }) => value || '-' }
        ]

        const verdict = computed(() => {
          const results = state.rows.map((r) => r.result)
          const count = (k) => results.filter((r) => r === k).length
          const upgradeHint =
            app.version && compareVersion(app.version, FIXED_APP_VERSION) < 0 ? `当前版本 ${app.version} 低于 ${FIXED_APP_VERSION}，建议升级。` : ''
          if (state.running || count('pending')) {
            return {
              color: 'default',
              tag: '检测中',
              title: '正在通过客户端后端访问测试站点…',
              desc: '每个站点最多等待 ' + configNumber('Timeout', 10, 3, 60) + ' 秒。'
            }
          }
          if (count('vulnerable')) {
            return {
              color: 'red',
              tag: '存在风险',
              title: `客户端仍信任被吊销的 eMudhra 中间证书（${count('vulnerable')}/${results.length} 个站点可连接）`,
              desc: `客户端后端使用的 Go 版本未包含 GO-2026-6809 修复。请升级到 ${FIXED_APP_VERSION} 或更高版本。${upgradeHint}`
            }
          }
          if (count('blocked') === results.length) {
            return { color: 'green', tag: '已修复', title: '客户端已拒绝全部问题证书', desc: 'Go 内置黑名单已生效（x509: no valid chains built）。' }
          }
          if (count('blocked') + count('untrusted') === results.length) {
            return {
              color: 'cyan',
              tag: '未受影响',
              title: '当前系统不信任这些证书链，客户端无法连接测试站点',
              desc: `系统证书库未信任 emSign 根证书或已吊销相关证书，因此暂不受影响；但这不代表客户端已包含 Go 的修复。${upgradeHint}`
            }
          }
          return {
            color: 'orange',
            tag: '无法判断',
            title: `${count('unknown')} 个站点因网络问题未能完成检测`,
            desc: '请检查网络，或在插件配置中开启“经内核代理检测”后重新检测。'
          }
        })

        const run = async () => {
          if (state.running) return
          state.running = true
          state.finishedAt = ''
          state.rows.forEach((r) => {
            r.result = 'pending'
            r.detail = ''
          })
          try {
            state.proxy = await getProxy()
            if (configBool('UseKernelProxy', false) && !state.proxy) {
              Plugins.message.warn('内核未运行，已改为直连检测')
            }
            const timeout = configNumber('Timeout', 10, 3, 60)
            await Promise.all(
              state.rows.map(async (row) => {
                Object.assign(row, await testSite(row, state.proxy, timeout))
              })
            )
          } catch (err) {
            Plugins.message.error(`检测失败：${errorText(err)}`)
          } finally {
            state.rows.forEach((r) => r.result === 'pending' && (r.result = 'unknown'))
            state.finishedAt = new Date().toLocaleTimeString()
            state.running = false
          }
        }

        expose({
          modalSlots: {
            toolbar: () => [
              h(resolveComponent('Button'), { type: 'text', onClick: () => Plugins.BrowserOpenURL(ADVISORY_URL) }, () => '查看公告'),
              h(resolveComponent('Button'), { type: 'text', onClick: () => Plugins.BrowserOpenURL(TEST_SITE_URL) }, () => '检测网站'),
              h(resolveComponent('Button'), { type: 'text', loading: state.running, onClick: run }, () => '重新检测')
            ]
          }
        })

        run()

        return { app, state, columns, verdict }
      }
    })

    const modal = Plugins.modal({ title: plugin.name, width: '80', height: '80', submit: false, cancelText: '关闭', maskClosable: true })
    modal.setContent(component).open()
  }

  /* 触发器 手动触发 */
  const onRun = async () => {
    openPanel()
    return 0
  }

  return { onRun }
}
