const STORE_PATH = 'data/third/xboard-client/accounts.json'

const normalizeBaseUrl = (input) => {
  let url = String(input || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  return url.replace(/\/+$/, '')
}

const bearerToken = (value) =>
  String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')

const panelOf = (account) => (account && account.panel === 'v2board' ? 'v2board' : 'xboard')

// Xboard 用 Sanctum，需要 Bearer 前缀；V2Board 直接把 Authorization 当 JWT 解码，带前缀会 403
const authHeader = (panel, token) => (panel === 'v2board' ? token : `Bearer ${token}`)

const nextId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const loadAccounts = async () => {
  try {
    const text = await Plugins.ReadFile(STORE_PATH)
    const list = JSON.parse(text || '[]')
    if (!Array.isArray(list)) return []
    return list.filter((item) => item && item.baseUrl && item.token).map((item) => ({ ...item, panel: panelOf(item) }))
  } catch {
    return []
  }
}

const saveAccounts = (list) => Plugins.WriteFile(STORE_PATH, JSON.stringify(list, null, 2))

const messageFrom = (res) => {
  const body = res && res.body
  if (body && typeof body === 'object') {
    if (typeof body.message === 'string' && body.message) return body.message
    if (body.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors)[0]
      if (Array.isArray(first) && first[0]) return String(first[0])
      if (typeof first === 'string') return first
    }
  }
  return `请求失败 (${res && res.status ? res.status : '网络错误'})`
}

const request = async (account, path, data) => {
  const url = `${account.baseUrl}/api/v1/user${path}`
  const headers = { Authorization: authHeader(panelOf(account), account.token) }
  let res
  try {
    res = data ? await Plugins.HttpPost(url, { ...headers, 'Content-Type': 'application/json' }, data) : await Plugins.HttpGet(url, headers)
  } catch (error) {
    throw new Error(error && error.message ? error.message : '网络请求失败')
  }
  if (!res || res.status < 200 || res.status >= 300 || !res.body || typeof res.body !== 'object') {
    const error = new Error(messageFrom(res))
    error.status = res && res.status
    throw error
  }
  return res.body
}

// 不知道面板类型时先按 Xboard 试，403 再按 V2Board 的鉴权方式重试
const probeSubscribe = async (baseUrl, token, panel) => {
  const panels = panel ? [panel] : ['xboard', 'v2board']
  let lastError
  for (const item of panels) {
    try {
      const body = await request({ baseUrl, token, panel: item }, '/getSubscribe')
      return { panel: item, info: body.data || {} }
    } catch (error) {
      lastError = error
      if (error.status !== 403) break
    }
  }
  throw lastError
}

const loginAccount = async (baseUrl, email, password, panel) => {
  let res
  try {
    res = await Plugins.HttpPost(`${baseUrl}/api/v1/passport/auth/login`, { 'Content-Type': 'application/json' }, { email, password })
  } catch (error) {
    throw new Error(error && error.message ? error.message : '网络请求失败')
  }
  if (!res || res.status < 200 || res.status >= 300 || !res.body || typeof res.body !== 'object') {
    throw new Error(messageFrom(res))
  }
  const data = res.body.data || {}
  const candidates =
    panel === 'v2board'
      ? [String(data.auth_data || '').trim()].filter(Boolean)
      : [...new Set([bearerToken(data.auth_data), bearerToken(data.token)].filter(Boolean))]
  if (!candidates.length) throw new Error('登录成功，但没有返回 Token')
  let lastError
  for (const candidate of candidates) {
    try {
      return { token: candidate, ...(await probeSubscribe(baseUrl, candidate, panel)) }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

const headerValue = (headers, key) => {
  if (!headers || typeof headers !== 'object') return ''
  const matched = Object.keys(headers).find((name) => name.toLowerCase() === String(key).toLowerCase())
  if (!matched) return ''
  const value = headers[matched]
  if (Array.isArray(value)) return value.join('; ')
  return value == null ? '' : String(value)
}

const bodyText = (body) => {
  if (body == null) return ''
  if (typeof body === 'string') return body
  if (typeof body === 'object') {
    try {
      return JSON.stringify(body)
    } catch {
      return ''
    }
  }
  return String(body)
}

const parseJsonBody = (body) => {
  if (body && typeof body === 'object') return body
  if (typeof body !== 'string') return null
  const text = body.trim()
  if (!text || (text[0] !== '{' && text[0] !== '[')) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// Cloudflare 人机：403/503 + cf-mitigated，或 server=cloudflare 且页面带挑战特征
const isCloudflareChallenge = (res) => {
  if (!res) return false
  const status = res.status
  const headers = res.headers || {}
  const mitigated = headerValue(headers, 'cf-mitigated').toLowerCase()
  if ((status === 403 || status === 503) && mitigated.includes('challenge')) return true
  const server = headerValue(headers, 'server').toLowerCase()
  const text = bodyText(res.body).slice(0, 8000).toLowerCase()
  const challenge =
    text.includes('just a moment') ||
    text.includes('cf-chl') ||
    text.includes('challenge-platform') ||
    text.includes('cf-browser-verification') ||
    text.includes('__cf_chl')
  if (server.includes('cloudflare') && challenge) return true
  if ((status === 403 || status === 503) && challenge) return true
  return false
}

const classifyGuestConfig = (body) => {
  const data = body && typeof body === 'object' && body.data && typeof body.data === 'object' ? body.data : null
  if (data && body.status === 'success') return 'xboard'
  if (data && !('status' in body) && 'is_email_verify' in data) return 'v2board'
  return ''
}

// 把主题配置里的 API 地址收成可请求的 origin（去掉 /api、/api/v1、/aaa 等尾巴）
const normalizeApiBase = (input) => {
  let url = String(input || '').trim()
  if (!url) return ''
  if (url.startsWith('//')) url = `https:${url}`
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const parsed = new URL(url)
    url = `${parsed.protocol}//${parsed.host}${parsed.pathname || ''}`
  } catch {
    return ''
  }
  url = url.replace(/\/+$/, '')
  url = url.replace(/\/api(?:\/v1)?$/i, '')
  url = url.replace(/\/aaa$/i, '')
  return url.replace(/\/+$/, '')
}

const decodeBase64Json = (raw) => {
  try {
    const lic = String(raw || '').split('@')[0]
    const pad = lic + '='.repeat((4 - (lic.length % 4)) % 4)
    return JSON.parse(atob(pad))
  } catch {
    return null
  }
}

const pushApiCandidate = (list, value) => {
  const base = normalizeApiBase(value)
  if (base) list.push(base)
}

const extractApiCandidatesFromText = (text) => {
  const found = []
  const src = String(text || '')
  if (!src) return found

  const apiArray = src.match(/api\s*:\s*\[([^\]]*)\]/i)
  if (apiArray) {
    for (const item of apiArray[1].match(/https?:\/\/[^"'\s,]+|\/\/[^"'\s,]+|["'][^"']+["']/g) || []) {
      pushApiCandidate(found, item.replace(/^["']|["']$/g, ''))
    }
  }

  const hostFieldRe =
    /(?:["']?(?:host|api|apiUrl|baseUrl|baseURL|API_URL)["']?)\s*:\s*["']([^"']+)["']/g
  for (const re of [
    /(?:window\.)?settings\s*=\s*\{[\s\S]{0,8000}?\}/i,
    /(?:window\.)?config\s*=\s*\{[\s\S]{0,8000}?\}/i
  ]) {
    const block = src.match(re)
    if (!block) continue
    for (const m of block[0].matchAll(hostFieldRe)) {
      pushApiCandidate(found, m[1])
    }
  }

  for (const m of src.matchAll(hostFieldRe)) {
    pushApiCandidate(found, m[1])
  }

  for (const m of src.matchAll(/["']license["']\s*:\s*["']([^"']+)["']/g)) {
    const decoded = decodeBase64Json(m[1])
    if (decoded && decoded.api) pushApiCandidate(found, decoded.api)
  }

  try {
    const json = JSON.parse(src)
    if (json && typeof json === 'object') {
      if (json.license) {
        const decoded = decodeBase64Json(json.license)
        if (decoded && decoded.api) pushApiCandidate(found, decoded.api)
      }
      for (const key of ['host', 'api', 'apiUrl', 'baseUrl', 'baseURL', 'API_URL']) {
        const value = json[key]
        if (typeof value === 'string') pushApiCandidate(found, value)
        if (Array.isArray(value)) value.forEach((item) => typeof item === 'string' && pushApiCandidate(found, item))
      }
    }
  } catch {
    // not json
  }

  return [...new Set(found)]
}

const collectConfigScriptUrls = (html, pageUrl) => {
  const urls = []
  for (const m of String(html || '').matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const src = m[1]
    if (!/(?:^|\/)(?:config|env|settings|site-config)[^/?#]*$/i.test(src) && !/(?:config|env|settings|site-config)/i.test(src)) {
      continue
    }
    try {
      urls.push(new URL(src, pageUrl.endsWith('/') ? pageUrl : `${pageUrl}/`).href)
    } catch {
      // ignore bad src
    }
  }
  return urls
}

const httpGetText = async (url) => {
  try {
    return await Plugins.HttpGet(url, { Accept: 'text/html,application/json,*/*' }, { Timeout: 10 })
  } catch (error) {
    return { status: 0, headers: {}, body: '', error }
  }
}

// Xboard 的 /api/v1/guest/comm/config 用 ApiResponse 包了一层 { status: 'success', message, data, error }；
// V2Board 及其分支只返回 { data: { is_email_verify, ... } }
const probeGuestConfig = async (baseUrl) => {
  let res
  try {
    res = await Plugins.HttpGet(`${baseUrl}/api/v1/guest/comm/config`, { Accept: 'application/json' }, { Timeout: 10 })
  } catch (error) {
    return { kind: 'error', text: (typeof error === 'string' ? error : error?.message) || '网络请求失败' }
  }
  if (isCloudflareChallenge(res)) {
    return { kind: 'blocked', text: '被 Cloudflare 人机验证拦截，请直接填写面板 API 地址' }
  }
  const body = parseJsonBody(res && res.body)
  const kind = classifyGuestConfig(body)
  if (kind) return { kind }
  return {
    kind: 'other',
    text: res && (res.status < 200 || res.status >= 300) ? `HTTP ${res.status}` : ''
  }
}

const discoverApiBases = async (siteUrl) => {
  const bases = []
  const seen = new Set()
  const add = (value) => {
    const base = normalizeApiBase(value)
    if (!base || base === siteUrl || seen.has(base)) return
    seen.add(base)
    bases.push(base)
  }

  const homepage = await httpGetText(`${siteUrl}/`)
  const homepageText = bodyText(homepage && homepage.body)
  extractApiCandidatesFromText(homepageText).forEach(add)

  const extraUrls = [
    `${siteUrl}/config.js`,
    `${siteUrl}/config.json`,
    `${siteUrl}/site-config.js`,
    ...collectConfigScriptUrls(homepageText, siteUrl).slice(0, 4)
  ]
  const fetched = new Set([`${siteUrl}/`, `${siteUrl}`])
  for (const url of extraUrls) {
    if (fetched.has(url)) continue
    fetched.add(url)
    const res = await httpGetText(url)
    if (!res || res.status !== 200) continue
    extractApiCandidatesFromText(bodyText(res.body)).forEach(add)
  }
  return bases.slice(0, 5)
}

const detectPanel = async (baseUrl) => {
  const site = normalizeBaseUrl(baseUrl)
  if (!site) return { kind: 'other', text: '' }

  const primary = await probeGuestConfig(site)
  if (primary.kind === 'xboard' || primary.kind === 'v2board') return primary
  if (primary.kind === 'blocked') return primary

  let sawBlocked = false
  try {
    const candidates = await discoverApiBases(site)
    for (const apiBase of candidates) {
      const result = await probeGuestConfig(apiBase)
      if (result.kind === 'xboard' || result.kind === 'v2board') {
        return { kind: result.kind, apiUrl: apiBase }
      }
      if (result.kind === 'blocked') sawBlocked = true
    }
  } catch {
    // 发现失败时退回主探测结果
  }

  if (sawBlocked) {
    return { kind: 'blocked', text: '被 Cloudflare 人机验证拦截，请直接填写面板 API 地址' }
  }
  return primary
}

const withId = (list, prefix) =>
  (Array.isArray(list) ? list : []).map((item, index) => ({
    ...item,
    id: item && item.id != null ? item.id : `${prefix}-${index}`
  }))

const formatTs = (ts, withTime = true) => {
  if (ts == null || ts === '') return ''
  const pattern = withTime ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD'
  const n = Number(ts)
  if (Number.isFinite(n) && String(ts).trim() !== '' && n > 1e8) {
    return Plugins.formatDate(n < 1e12 ? n * 1000 : n, pattern)
  }
  return Plugins.formatDate(ts, pattern)
}

const sanitize = (html) =>
  String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')

const groupKnowledge = (data) => {
  if (!data) return {}
  if (!Array.isArray(data)) return data
  return data.reduce((groups, item) => {
    const key = item.category || '未分类'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
    return groups
  }, {})
}

const levelLabel = (level) => ({ 0: '低', 1: '中', 2: '高' })[level] || ''

const openUI = async (plugin) => {
  const accounts = Vue.ref(await loadAccounts())
  const current = Vue.ref(accounts.value[0] || null)

  const labelOf = (account) => {
    if (!account) return '未添加账号'
    const host = account.baseUrl.replace(/^https?:\/\//, '')
    const sameEmail = account.email && accounts.value.filter((item) => item.email === account.email).length > 1
    if (sameEmail) return `${account.email} · ${host}`
    return account.email || host
  }

  const persist = () => saveAccounts(accounts.value)

  const openAddAccount = () => {
    const mode = Vue.ref('password')
    const baseUrl = Vue.ref('')
    const email = Vue.ref('')
    const password = Vue.ref('')
    const token = Vue.ref('')
    const saving = Vue.ref(false)
    const check = Vue.ref({ kind: '' })
    let checkedUrl = ''
    let checkSeq = 0
    const modeOptions = [
      { label: '账号密码', value: 'password' },
      { label: 'Token', value: 'token' }
    ]
    const Form = {
      template: `
      <div class="flex flex-col gap-16">
        <div>
          <div class="mb-8">面板地址</div>
          <Input v-model="baseUrl" class="w-full" placeholder="优先填写 API 地址，不知道的话填写机场官网地址" @submit="checkBackend" />
          <div v-if="check.kind" class="mt-4 flex items-center gap-4">
            <Icon v-if="check.kind === 'checking'" icon="loading" class="rotation" />
            <Tag :color="checkColor" size="small">{{ checkText }}</Tag>
          </div>
        </div>
        <div>
          <div class="mb-8">登录方式</div>
          <Radio v-model="mode" :options="modeOptions" />
        </div>
        <template v-if="mode === 'password'">
          <div>
            <div class="mb-8">账号</div>
            <Input v-model="email" class="w-full" placeholder="面板登录邮箱" />
          </div>
          <div>
            <div class="mb-8">密码</div>
            <Input v-model="password" class="w-full" placeholder="面板密码" />
          </div>
        </template>
        <div v-else>
          <div class="mb-8">Token</div>
          <Input v-model="token" class="w-full" placeholder="登录 Token" />
        </div>
      </div>`,
      setup(_, { expose }) {
        const checkBackend = async (value) => {
          const base = normalizeBaseUrl(value)
          if (base === checkedUrl) return
          checkedUrl = base
          const seq = ++checkSeq
          if (!base) {
            check.value = { kind: '' }
            return
          }
          check.value = { kind: 'checking' }
          const result = await detectPanel(base)
          if (seq === checkSeq) check.value = result
        }
        Vue.watch(baseUrl, (value) => {
          if (normalizeBaseUrl(value) === checkedUrl) return
          checkedUrl = ''
          checkSeq += 1
          check.value = { kind: '' }
        })
        const panelLabelHost = (url) => String(url || '').replace(/^https?:\/\//i, '')
        const checkColor = Vue.computed(
          () => ({ xboard: 'green', v2board: 'green', blocked: 'orange', other: 'orange', error: 'red' })[check.value.kind] || 'default'
        )
        const checkText = Vue.computed(() => {
          const { kind, text, apiUrl } = check.value
          const apiHint = apiUrl && apiUrl !== checkedUrl ? `（API：${panelLabelHost(apiUrl)}）` : ''
          if (kind === 'checking') return '正在检测面板后端…'
          if (kind === 'xboard') return `是 Xboard 面板${apiHint}`
          if (kind === 'v2board') return `是 V2Board 面板${apiHint}`
          if (kind === 'blocked') return text || '被 Cloudflare 人机验证拦截，请直接填写面板 API 地址'
          if (kind === 'other') return `不是 Xboard 或 V2Board 面板${text ? `（${text}）` : ''}，请确认填的是面板 API 地址`
          if (kind === 'error') return `无法连接：${text}`
          return ''
        })
        const submit = async () => {
          const base = normalizeBaseUrl(baseUrl.value)
          if (!base) {
            Plugins.message.warn('请填写网站地址')
            return
          }
          const accountEmail = email.value.trim()
          const pasted = bearerToken(token.value)
          if (mode.value === 'password') {
            if (!accountEmail || !password.value) {
              Plugins.message.warn('请填写邮箱和密码')
              return
            }
          } else if (!pasted) {
            Plugins.message.warn('请填写 Token')
            return
          }
          let detected = checkedUrl === base && ['xboard', 'v2board'].includes(check.value.kind) ? check.value.kind : ''
          let apiBase = detected && check.value.apiUrl ? normalizeBaseUrl(check.value.apiUrl) : base
          saving.value = true
          try {
            if (!detected) {
              const result = await detectPanel(base)
              if (['xboard', 'v2board'].includes(result.kind)) {
                detected = result.kind
                if (result.apiUrl) apiBase = normalizeBaseUrl(result.apiUrl)
                check.value = result
                checkedUrl = base
              } else if (result.kind === 'blocked') {
                check.value = result
                checkedUrl = base
                Plugins.message.warn(result.text || '被 Cloudflare 人机验证拦截，请直接填写面板 API 地址')
                return
              }
            }
            const logged =
              mode.value === 'password'
                ? await loginAccount(apiBase, accountEmail, password.value, detected)
                : { token: pasted, ...(await probeSubscribe(apiBase, pasted, detected)) }
            const account = {
              id: nextId(),
              baseUrl: apiBase,
              panel: logged.panel,
              token: logged.token,
              email: (logged.info && logged.info.email) || accountEmail
            }
            const previous = accounts.value.slice()
            const previousCurrent = current.value
            const index = accounts.value.findIndex((item) => item.baseUrl === account.baseUrl && item.email === account.email)
            const replaced = index >= 0
            if (replaced) {
              account.id = accounts.value[index].id
              accounts.value.splice(index, 1, account)
            } else {
              accounts.value.push(account)
            }
            current.value = account
            try {
              await persist()
            } catch (error) {
              accounts.value = previous
              current.value = previousCurrent
              throw error
            }
            Plugins.message.success(replaced ? '账号已更新' : '账号已添加')
            formModal.close()
          } catch (error) {
            Plugins.message.error(error.message)
          } finally {
            saving.value = false
          }
        }
        expose({
          modalSlots: {
            submit: () =>
              Vue.h(Vue.resolveComponent('Button'), { type: 'primary', loading: saving.value, onClick: submit }, () =>
                mode.value === 'password' ? '登录' : '保存'
              )
          }
        })
        return { mode, baseUrl, email, password, token, modeOptions, check, checkColor, checkText, checkBackend }
      }
    }
    const formModal = Plugins.modal({
      title: '添加账号',
      width: '60',
      submit: false,
      cancelText: 'common.cancel'
    })
    formModal.setContent(Form)
    formModal.open()
  }

  const openAccounts = () => {
    const Manager = {
      template: `
      <div class="flex flex-col gap-8">
        <Empty v-if="!accounts.length" description="还没有账号" />
        <Card v-for="item in accounts" :key="item.id" :title="labelOf(item)" :subtitle="item.baseUrl">
          <template #extra>
            <Button type="text" icon="delete" @click="remove(item)" />
          </template>
        </Card>
        <Button type="primary" icon="add" @click="openAddAccount">添加账号</Button>
      </div>`,
      setup() {
        const remove = async (item) => {
          const ok = await Plugins.confirm('删除账号', `删除 ${labelOf(item)} 吗？保存在本地的 Token 会一起清掉。`)
          if (!ok) return
          const previous = accounts.value
          const previousCurrent = current.value
          accounts.value = accounts.value.filter((account) => account.id !== item.id)
          if (current.value && current.value.id === item.id) current.value = accounts.value[0] || null
          try {
            await persist()
          } catch (error) {
            accounts.value = previous
            current.value = previousCurrent
            Plugins.message.error(error.message || '保存失败')
          }
        }
        return { accounts, labelOf, remove, openAddAccount }
      }
    }
    const manager = Plugins.modal({
      title: '账号',
      width: '60',
      submit: false,
      cancelText: 'common.close'
    })
    manager.setContent(Manager)
    manager.open()
  }

  const component = {
    template: `
    <div class="h-full">
      <div v-if="!current" class="flex flex-col items-center gap-12 py-32">
        <Empty description="还没有账号，先添加一个面板" />
        <Button type="primary" icon="add" @click="openAccounts">添加账号</Button>
      </div>
      <Tabs v-else v-model:active-key="activeKey" :items="tabs" tabPosition="left" tabWidth="15%" contentWidth="85%" class="h-full">
        <template #subscribe>
          <div class="flex flex-col gap-8">
            <Tag v-if="subError" color="red">{{ subError }}</Tag>
            <template v-else>
              <Card>
                <div class="px-8 py-8 flex flex-col gap-8">
                  <div class="flex items-start justify-between gap-12">
                    <div>
                      <div class="flex items-center gap-8">
                        <div class="text-18 font-bold">{{ subInfo.plan_name || '加载中' }}</div>
                        <Tag v-if="subInfo.plan_name" :color="expired ? 'red' : 'green'" size="small">{{ expired ? '已过期' : '使用中' }}</Tag>
                      </div>
                      <div v-if="subInfo.email" class="text-12 mt-4">{{ subInfo.email }}</div>
                    </div>
                    <Button type="text" icon="refresh" :loading="subInfoLoading" @click="refreshSubInfo()" />
                  </div>
                  <div class="flex items-center justify-between text-12">
                    <span>已用 {{ usedText }} / {{ totalText }}</span>
                    <span v-if="totalBytes">{{ percent }}%</span>
                  </div>
                  <Progress :percent="percent" :status="progressStatus" />
                  <div v-if="subInfo.device_limit || subInfo.speed_limit" class="flex gap-8">
                    <Tag v-if="subInfo.device_limit" size="small">{{ subInfo.device_limit }} 台设备</Tag>
                    <Tag v-if="subInfo.speed_limit" size="small">{{ subInfo.speed_limit }} Mbps</Tag>
                  </div>
                  <div class="grid grid-cols-4 gap-12 pt-8" style="border-top: 1px solid var(--divider-color)">
                    <div v-for="item in stats" :key="item.label">
                      <div class="text-12">{{ item.label }}</div>
                      <div class="text-18 font-bold mt-4">{{ item.value }}</div>
                      <div class="text-12 mt-4 whitespace-nowrap">{{ item.hint }}</div>
                    </div>
                  </div>
                  <div class="flex justify-end gap-8">
                    <Button icon="copy" :disabled="!subInfo.subscribe_url" @click="copySubscribe">复制订阅</Button>
                    <Button type="primary" icon="link" :disabled="!subInfo.subscribe_url" @click="importSub">导入订阅</Button>
                  </div>
                </div>
              </Card>
            </template>
          </div>
        </template>

        <template #nodes>
          <Card title="节点">
            <template #title-suffix>
              <Tag v-if="nodes.length" size="small">{{ nodes.length }}</Tag>
            </template>
            <template #extra>
              <Button type="text" icon="refresh" :loading="nodesLoading" @click="refreshNodes()" />
            </template>
            <Tag v-if="nodesError" color="red">{{ nodesError }}</Tag>
            <Empty v-else-if="!nodesLoading && !nodes.length" description="没有可用节点" />
            <template v-else>
              <div class="flex gap-8 mb-12">
                <Tag color="green" size="small">在线 {{ onlineCount }}</Tag>
                <Tag color="red" size="small">离线 {{ offlineCount }}</Tag>
              </div>
              <Table :columns="columns" :data-source="nodes" />
            </template>
          </Card>
        </template>

        <template #knowledge>
          <div v-if="article" class="flex flex-col gap-8">
            <div>
              <Button type="text" icon="arrowLeft" @click="article = null">返回</Button>
            </div>
            <Icon v-if="articleLoading" icon="loading" class="rotation" />
            <template v-else>
              <div class="text-18 font-bold">{{ article.title }}</div>
              <div class="text-12">{{ formatTs(article.updated_at) }}</div>
              <MarkdownViewer :content="sanitize(article.body)" />
            </template>
          </div>
          <Card v-else title="教程">
            <template #extra>
              <Button type="text" icon="refresh" :loading="articlesLoading" @click="openKnowledge()" />
            </template>
            <div class="px-8 py-8">
              <Tag v-if="articlesError" color="red">{{ articlesError }}</Tag>
              <Empty v-else-if="!articlesLoading && !articleGroups.length" description="这个面板没有教程" />
              <div v-for="(group, index) in articleGroups" :key="group.category" :class="index ? 'mt-16' : ''">
                <div class="text-12 mb-8">{{ group.category }}</div>
                <div class="grid grid-cols-2 gap-8">
                  <Card v-for="item in group.items" :key="item.id">
                    <div class="flex items-center justify-between gap-8 px-8 py-12">
                      <div>
                        <div class="font-bold">{{ item.title }}</div>
                        <div class="text-12 mt-4">{{ formatTs(item.updated_at, false) }}</div>
                      </div>
                      <Button type="text" icon="preview" @click="openArticle(item)" />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </Card>
        </template>

        <template #tickets>
          <div v-if="ticket || ticketLoading" class="flex flex-col gap-8">
            <div class="flex items-center justify-between">
              <Button type="text" icon="arrowLeft" @click="ticket = null">返回</Button>
              <Button v-if="ticket && ticket.status == 0" type="text" :loading="ticketSaving" @click="closeTicket">关闭工单</Button>
            </div>
            <Tag v-if="ticketError" color="red">{{ ticketError }}</Tag>
            <Icon v-if="ticketLoading" icon="loading" class="rotation" />
            <template v-else-if="ticket">
              <div class="flex items-center gap-8">
                <div class="text-18 font-bold">{{ ticket.subject }}</div>
                <Tag :color="ticket.status == 0 ? 'green' : 'default'" size="small">{{ ticket.status == 0 ? '进行中' : '已关闭' }}</Tag>
                <Tag v-if="levelLabel(ticket.level)" size="small">{{ levelLabel(ticket.level) }}</Tag>
              </div>
              <div class="text-12">{{ formatTs(ticket.updated_at || ticket.created_at) }}</div>
              <Card v-for="msg in ticketMessages" :key="msg.id" :title="msg.is_me ? '我' : '客服'" :subtitle="formatTs(msg.created_at)">
                <div class="whitespace-pre-wrap px-4 py-8">{{ msg.message }}</div>
              </Card>
              <template v-if="ticket.status == 0">
                <Input
                  v-model="replyMessage"
                  placeholder="回复内容"
                  class="w-full"
                />
                <div class="flex justify-end">
                  <Button type="primary" :loading="ticketSaving" @click="replyTicket">回复</Button>
                </div>
              </template>
            </template>
          </div>
          <Card v-else title="工单">
            <template #extra>
              <div class="flex items-center gap-8">
                <Button type="text" icon="refresh" :loading="ticketsLoading" @click="openTickets()" />
                <Button type="primary" icon="add" @click="openNewTicket">新建</Button>
              </div>
            </template>
            <div class="px-8 py-8">
              <Tag v-if="ticketsError" color="red">{{ ticketsError }}</Tag>
              <Empty v-else-if="!ticketsLoading && !tickets.length" description="还没有工单" />
              <div v-else class="flex flex-col gap-8">
                <Card v-for="item in tickets" :key="item.id" :title="item.subject" :subtitle="formatTs(item.updated_at || item.created_at)">
                  <template #title-suffix>
                    <Tag :color="item.status == 0 ? 'green' : 'default'" size="small">{{ item.status == 0 ? '进行中' : '已关闭' }}</Tag>
                    <Tag :color="item.reply_status == 1 ? 'cyan' : 'orange'" size="small">{{ item.reply_status == 1 ? '已回复' : '待回复' }}</Tag>
                  </template>
                  <template #extra>
                    <Button type="text" @click="openTicket(item)">查看</Button>
                  </template>
                </Card>
              </div>
            </div>
          </Card>
        </template>

        <template #notices>
          <Empty v-if="!notices.length" description="没有公告" />
          <div v-else class="flex flex-col gap-8">
            <Card v-for="item in notices" :key="item.id" :title="item.title" :subtitle="formatTs(item.created_at)">
              <MarkdownViewer :content="sanitize(item.content)" />
            </Card>
          </div>
        </template>

        <template #traffic>
          <Card title="本月流量" :subtitle="trafficLogs.length ? monthUsedText : ''">
            <Empty v-if="!trafficLogs.length" description="本月还没有流量记录" />
            <Table v-else :columns="trafficColumns" :data-source="trafficLogs" />
          </Card>
        </template>
      </Tabs>
    </div>`,
    setup() {
      const { ref, computed, watch } = Vue

      const tabs = [
        { key: 'subscribe', tab: '订阅' },
        { key: 'nodes', tab: '节点' },
        { key: 'knowledge', tab: '教程' },
        { key: 'tickets', tab: '工单' },
        { key: 'notices', tab: '公告' },
        { key: 'traffic', tab: '流量' }
      ]
      const activeKey = ref('subscribe')
      let generation = 0

      const subInfo = ref({})
      const subInfoLoading = ref(false)
      const subError = ref('')
      const nodes = ref([])
      const nodesLoading = ref(false)
      const nodesError = ref('')
      const notices = ref([])
      const trafficLogs = ref([])

      const articles = ref({})
      const articlesLoading = ref(false)
      const articlesError = ref('')
      const article = ref(null)
      const articleLoading = ref(false)

      const tickets = ref([])
      const ticketsLoading = ref(false)
      const ticketsError = ref('')
      const ticket = ref(null)
      const ticketLoading = ref(false)
      const ticketError = ref('')
      const ticketSaving = ref(false)
      const replyMessage = ref('')

      const usedBytes = computed(() => (Number(subInfo.value.u) || 0) + (Number(subInfo.value.d) || 0))
      const totalBytes = computed(() => Number(subInfo.value.transfer_enable) || 0)
      const percent = computed(() => (totalBytes.value ? Math.min(100, Math.round((usedBytes.value / totalBytes.value) * 100)) : 0))
      const progressStatus = computed(() => (percent.value >= 90 ? 'danger' : percent.value >= 80 ? 'warning' : 'primary'))
      const expired = computed(() => {
        const ts = Number(subInfo.value.expired_at)
        return ts > 0 && ts * 1000 < Date.now()
      })
      const usedText = computed(() => Plugins.formatBytes(usedBytes.value))
      const uploadText = computed(() => Plugins.formatBytes(Number(subInfo.value.u) || 0))
      const downloadText = computed(() => Plugins.formatBytes(Number(subInfo.value.d) || 0))
      const totalText = computed(() => (totalBytes.value ? Plugins.formatBytes(totalBytes.value) : '不限'))
      const remainText = computed(() => (totalBytes.value ? Plugins.formatBytes(Math.max(0, totalBytes.value - usedBytes.value)) : '不限'))
      const daysLeft = (ts) => {
        if (!ts) return null
        return Math.ceil((Number(ts) * 1000 - Date.now()) / 86400000)
      }
      const dayLabel = (days, future, past) => {
        if (days == null) return ''
        if (days > 0) return `${future} ${days} 天`
        if (days === 0) return '今天'
        return `${past} ${-days} 天`
      }
      const expireHeadline = computed(() => {
        if (!subInfo.value.expired_at) return '长期有效'
        return dayLabel(daysLeft(subInfo.value.expired_at), '还剩', '已过')
      })
      const expireDate = computed(() => (subInfo.value.expired_at ? formatTs(subInfo.value.expired_at, false) : ''))
      const resetDays = computed(() => {
        if (subInfo.value.next_reset_at) return daysLeft(subInfo.value.next_reset_at)
        if (subInfo.value.reset_day) return Number(subInfo.value.reset_day)
        return null
      })
      const resetHeadline = computed(() => (resetDays.value == null ? '不重置' : dayLabel(resetDays.value, '还剩', '已过')))
      const resetDate = computed(() => (subInfo.value.next_reset_at ? formatTs(subInfo.value.next_reset_at, false) : ''))
      const monthBytes = computed(() => trafficLogs.value.reduce((sum, item) => sum + (Number(item.u) || 0) + (Number(item.d) || 0), 0))
      const monthUsedText = computed(() => Plugins.formatBytes(monthBytes.value))
      const stats = computed(() => [
        { label: '剩余流量', value: remainText.value, hint: `↑ ${uploadText.value}  ↓ ${downloadText.value}` },
        { label: '到期', value: expireHeadline.value, hint: expireDate.value || '无固定期限' },
        { label: '流量重置', value: resetHeadline.value, hint: resetDate.value || '无重置日期' },
        { label: '本月已用', value: monthUsedText.value, hint: '本月记录' }
      ])
      const onlineCount = computed(() => nodes.value.filter((item) => item.is_online != 0).length)
      const offlineCount = computed(() => nodes.value.length - onlineCount.value)
      const articleGroups = computed(() => Object.keys(articles.value).map((category) => ({ category, items: articles.value[category] || [] })))
      const ticketMessages = computed(() => {
        const list = ticket.value && (ticket.value.message || ticket.value.messages)
        return withId(list, 'msg')
      })

      const alive = (gen) => gen === generation

      const refreshSubInfo = async (gen = generation) => {
        const account = current.value
        if (!account) return
        subInfoLoading.value = true
        subError.value = ''
        try {
          const body = await request(account, '/getSubscribe')
          if (!alive(gen)) return
          const data = body.data || {}
          subInfo.value = {
            expired_at: data.expired_at || 0,
            next_reset_at: data.next_reset_at || 0,
            reset_day: data.reset_day || 0,
            subscribe_url: data.subscribe_url || '',
            plan_name: (data.plan && data.plan.name) || '未开通套餐',
            email: data.email || '',
            u: data.u || 0,
            d: data.d || 0,
            transfer_enable: data.transfer_enable || 0,
            device_limit: data.device_limit || 0,
            speed_limit: data.speed_limit || 0
          }
        } catch (error) {
          if (!alive(gen)) return
          subInfo.value = {}
          subError.value = error.message
        } finally {
          if (alive(gen)) subInfoLoading.value = false
        }
      }

      const refreshNodes = async (gen = generation) => {
        const account = current.value
        if (!account) return
        nodesLoading.value = true
        nodesError.value = ''
        try {
          const body = await request(account, '/server/fetch')
          if (!alive(gen)) return
          nodes.value = withId(body.data, 'node')
        } catch (error) {
          if (!alive(gen)) return
          nodes.value = []
          nodesError.value = error.message
        } finally {
          if (alive(gen)) nodesLoading.value = false
        }
      }

      const refreshNotices = async (gen = generation) => {
        const account = current.value
        if (!account) return
        try {
          const first = await request(account, '/notice/fetch?current=1')
          if (!alive(gen)) return
          const list = Array.isArray(first.data) ? [...first.data] : []
          const total = Number(first.total) || list.length
          let currentPage = 1
          while (list.length < total && currentPage < 10) {
            currentPage += 1
            const next = await request(account, `/notice/fetch?current=${currentPage}`)
            if (!alive(gen)) return
            if (!Array.isArray(next.data) || !next.data.length) break
            list.push(...next.data)
          }
          notices.value = withId(list, 'notice')
        } catch {
          if (alive(gen)) notices.value = []
        }
      }

      const refreshTraffic = async (gen = generation) => {
        const account = current.value
        if (!account) return
        try {
          const body = await request(account, '/stat/getTrafficLog')
          if (!alive(gen)) return
          trafficLogs.value = withId(body.data, 'traffic')
        } catch {
          if (alive(gen)) trafficLogs.value = []
        }
      }

      const copySubscribe = async () => {
        const url = subInfo.value.subscribe_url
        if (!url) return
        await Plugins.ClipboardSetText(url)
        Plugins.message.success('订阅链接已复制')
      }

      const importSub = async () => {
        const url = subInfo.value.subscribe_url
        if (!url) return
        const accountName = labelOf(current.value)
        const planName = subInfo.value.plan_name
        const name = planName && planName !== '未开通套餐' ? `${accountName} - ${planName}` : accountName
        const store = Plugins.useSubscribesStore()
        const duplicated = (store.subscribes || []).some((item) => item.url === url)
        if (duplicated) {
          const ok = await Plugins.confirm('订阅已存在', '订阅列表里已经有相同的链接，仍然再导入一份吗？')
          if (!ok) return
        }
        try {
          await store.importSubscribe(name, url)
          Plugins.message.success('已导入到订阅列表')
        } catch (error) {
          Plugins.message.error(error.message || '导入失败')
        }
      }

      const openKnowledge = async () => {
        const account = current.value
        if (!account) return
        articlesLoading.value = true
        articlesError.value = ''
        try {
          let body
          try {
            body = await request(account, '/knowledge/fetch?language=zh-CN')
          } catch {
            body = await request(account, '/knowledge/fetch')
          }
          articles.value = groupKnowledge(body.data)
        } catch (error) {
          articles.value = {}
          articlesError.value = error.message
        } finally {
          articlesLoading.value = false
        }
      }

      const openArticle = async (item) => {
        article.value = { title: item.title }
        articleLoading.value = true
        try {
          const body = await request(current.value, `/knowledge/fetch?id=${encodeURIComponent(item.id)}`)
          article.value = body.data || item
        } catch (error) {
          article.value = item.body ? item : null
          if (!article.value) Plugins.message.error(error.message)
        } finally {
          articleLoading.value = false
        }
      }

      const openTickets = async () => {
        const account = current.value
        if (!account) return
        ticket.value = null
        ticketsLoading.value = true
        ticketsError.value = ''
        try {
          const body = await request(account, '/ticket/fetch')
          tickets.value = withId(body.data, 'ticket')
        } catch (error) {
          tickets.value = []
          ticketsError.value = error.message
        } finally {
          ticketsLoading.value = false
        }
      }

      const openTicket = async (item) => {
        replyMessage.value = ''
        ticketError.value = ''
        ticket.value = null
        ticketLoading.value = true
        try {
          const body = await request(current.value, `/ticket/fetch?id=${encodeURIComponent(item.id)}`)
          ticket.value = body.data || null
        } catch (error) {
          ticketError.value = error.message
        } finally {
          ticketLoading.value = false
        }
      }

      const openNewTicket = () => {
        const subject = ref('')
        const level = ref('1')
        const message = ref('')
        const saving = ref(false)
        const levelOptions = [
          { label: '低', value: '0' },
          { label: '中', value: '1' },
          { label: '高', value: '2' }
        ]
        const Form = {
          template: `
          <div class="flex flex-col gap-16">
            <div>
              <div class="mb-8">标题</div>
              <Input v-model="subject" class="w-full" placeholder="简要描述问题" />
            </div>
            <div>
              <div class="mb-8">优先级</div>
              <Radio v-model="level" :options="levelOptions" />
            </div>
            <div>
              <div class="mb-8">内容</div>
              <Input v-model="message" placeholder="请描述遇到的问题" class="w-full" />
            </div>
          </div>`,
          setup(_, { expose }) {
            const submit = async () => {
              const title = subject.value.trim()
              const content = message.value.trim()
              if (!title || !content) {
                Plugins.message.warn('请填写标题和内容')
                return
              }
              saving.value = true
              try {
                await request(current.value, '/ticket/save', { subject: title, level: Number(level.value), message: content })
                Plugins.message.success('工单已提交')
                formModal.close()
                await openTickets()
              } catch (error) {
                Plugins.message.error(error.message)
              } finally {
                saving.value = false
              }
            }
            expose({
              modalSlots: {
                submit: () => Vue.h(Vue.resolveComponent('Button'), { type: 'primary', loading: saving.value, onClick: submit }, () => '提交')
              }
            })
            return { subject, level, message, levelOptions }
          }
        }
        const formModal = Plugins.modal({
          title: '新建工单',
          width: '60',
          submit: false,
          cancelText: 'common.cancel'
        })
        formModal.setContent(Form)
        formModal.open()
      }

      const replyTicket = async () => {
        const message = replyMessage.value.trim()
        if (!message || !ticket.value) return
        ticketSaving.value = true
        try {
          await request(current.value, '/ticket/reply', { id: ticket.value.id, message })
          replyMessage.value = ''
          Plugins.message.success('已回复')
          await openTicket(ticket.value)
        } catch (error) {
          Plugins.message.error(error.message)
        } finally {
          ticketSaving.value = false
        }
      }

      const closeTicket = async () => {
        if (!ticket.value) return
        const ok = await Plugins.confirm('关闭工单', '关闭后将不能继续回复，确定关闭吗？')
        if (!ok) return
        ticketSaving.value = true
        try {
          await request(current.value, '/ticket/close', { id: ticket.value.id })
          Plugins.message.success('工单已关闭')
          await openTicket(ticket.value)
        } catch (error) {
          Plugins.message.error(error.message)
        } finally {
          ticketSaving.value = false
        }
      }

      const columns = [
        { title: '名称', key: 'name', minWidth: 160 },
        { title: '类型', key: 'type' },
        {
          title: '状态',
          key: 'is_online',
          customRender({ value }) {
            return value == 0 ? '离线' : '在线'
          }
        },
        { title: '倍率', key: 'rate' },
        {
          title: '标签',
          key: 'tags',
          customRender({ value }) {
            return Array.isArray(value) ? value.join('、') : value || ''
          }
        }
      ]

      const formatRecord = (value) => {
        if (value == null || value === '') return ''
        const n = Number(value)
        if (Number.isFinite(n) && String(value).trim() !== '' && n > 1e8) return formatTs(n, false)
        return String(value)
      }

      const trafficColumns = [
        {
          title: '日期',
          key: 'record_at',
          customRender({ value }) {
            return formatRecord(value)
          }
        },
        {
          title: '上行',
          key: 'u',
          customRender({ value }) {
            return Plugins.formatBytes(Number(value) || 0)
          }
        },
        {
          title: '下行',
          key: 'd',
          customRender({ value }) {
            return Plugins.formatBytes(Number(value) || 0)
          }
        },
        { title: '倍率', key: 'server_rate' }
      ]

      watch(
        current,
        () => {
          const gen = ++generation
          article.value = null
          ticket.value = null
          articles.value = {}
          tickets.value = []
          subInfo.value = {}
          nodes.value = []
          notices.value = []
          trafficLogs.value = []
          if (!current.value) return
          refreshSubInfo(gen)
          refreshNodes(gen)
          refreshNotices(gen)
          refreshTraffic(gen)
          if (activeKey.value === 'knowledge') openKnowledge()
          if (activeKey.value === 'tickets') openTickets()
        },
        { immediate: true }
      )

      watch(activeKey, (key) => {
        if (!current.value) return
        if (key === 'knowledge' && !Object.keys(articles.value).length && !articlesLoading.value) openKnowledge()
        if (key === 'tickets' && !tickets.value.length && !ticketsLoading.value && !ticketsError.value) openTickets()
      })

      return {
        current,
        tabs,
        activeKey,
        subInfo,
        subInfoLoading,
        subError,
        refreshSubInfo,
        usedText,
        uploadText,
        downloadText,
        totalText,
        remainText,
        stats,
        openAccounts,
        expireHeadline,
        expireDate,
        resetHeadline,
        resetDate,
        monthUsedText,
        onlineCount,
        offlineCount,
        percent,
        progressStatus,
        expired,
        totalBytes,
        nodes,
        nodesLoading,
        nodesError,
        refreshNodes,
        columns,
        notices,
        trafficLogs,
        trafficColumns,
        articlesLoading,
        articlesError,
        articleGroups,
        openKnowledge,
        article,
        articleLoading,
        openArticle,
        tickets,
        ticketsLoading,
        ticketsError,
        openTickets,
        ticket,
        ticketLoading,
        ticketError,
        ticketMessages,
        ticketSaving,
        replyMessage,
        openNewTicket,
        openTicket,
        replyTicket,
        closeTicket,
        copySubscribe,
        importSub,
        levelLabel,
        formatTs,
        sanitize
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: plugin.name,
      width: '90',
      height: '90',
      submit: false,
      cancelText: 'common.close'
    },
    {
      default: () => Vue.h(component),
      toolbar: () => [
        Vue.h(
          Vue.resolveComponent('Dropdown'),
          {},
          {
            default: () => Vue.h(Vue.resolveComponent('Button'), { type: 'text' }, () => labelOf(current.value)),
            overlay: () =>
              Vue.h(
                'div',
                { class: 'flex flex-col gap-4 min-w-64 p-4' },
                accounts.value.map((item) =>
                  Vue.h(
                    Vue.resolveComponent('Button'),
                    {
                      type: current.value && current.value.id === item.id ? 'link' : 'text',
                      onClick() {
                        current.value = item
                      }
                    },
                    () => labelOf(item)
                  )
                )
              )
          }
        ),
        Vue.h(Vue.resolveComponent('Button'), { type: 'text', onClick: openAccounts }, () => '账号管理'),
      ]
    }
  )
  modal.open()
  return modal
}

/** @type { EsmPlugin } */
export default (plugin) => {
  let modal
  const onRun = async () => {
    modal = await openUI(plugin)
  }
  const onDispose = () => {
    if (modal) modal.destroy()
  }
  return { onRun, onDispose }
}
