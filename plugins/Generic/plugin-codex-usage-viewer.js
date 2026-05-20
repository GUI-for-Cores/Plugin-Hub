const CODEX_USAGE_API = 'https://chatgpt.com/backend-api/wham/usage'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const onRun = async () => {
    openUsageUI(Plugin)
    return 0
  }

  const Refresh = async () => {
    const accounts = await loadAccountResults(Plugin)
    const ok = accounts.filter((item) => item.success).length
    Plugins.message.info(`已刷新 ${accounts.length} 个账号，成功 ${ok} 个`)
    return 0
  }

  return { onRun, Refresh }
}

function openUsageUI(Plugin) {
  const { h, defineComponent, ref, computed, onMounted, resolveComponent } = Vue
  const showEmail = ref(false)

  const component = defineComponent({
    template: /* html */ `
      <div class="flex flex-col gap-8 pr-8 pb-8">
        <Card>
          <div class="flex items-center justify-between gap-8">
            <div class="flex flex-col gap-4">
              <div class="text-20 font-bold">Codex 额度</div>
              <div class="text-12">5小时额度 / 周额度剩余与重置时间</div>
            </div>
            <div class="flex items-center gap-8">
              <Tag>{{ accounts.length }} 个账号</Tag>
              <Button icon="refresh" type="primary" :loading="loading" @click="refreshUsage">刷新</Button>
            </div>
          </div>
        </Card>

        <Empty v-if="!loading && accounts.length === 0" description="未找到可用账号" />
        <Button v-if="loading && accounts.length === 0" loading>加载中</Button>

        <Card v-for="account in accounts" :key="account.id" :title="account.name">
          <template #extra>
            <Tag :color="account.success ? 'green' : 'red'">{{ account.success ? '可用' : '失败' }}</Tag>
          </template>

          <div v-if="account.success" class="flex flex-col gap-8">
            <div class="flex items-center justify-between gap-8">
              <div class="text-12">
                {{ formatAccount(account) }}
              </div>
              <Tag :color="account.allowed ? 'green' : 'red'">{{ account.allowed ? 'Available' : 'Rate limited' }}</Tag>
            </div>

            <div class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <span class="font-bold">5小时额度</span>
                <span class="text-12">剩余 {{ account.primary.remaining }}%，已用 {{ account.primary.used }}%</span>
              </div>
              <Progress :percent="account.primary.remaining" />
              <div class="text-12">重置倒计时 {{ account.primary.left }}，本地时间 {{ account.primary.resetAt }}</div>
            </div>

            <div class="flex flex-col gap-4">
              <div class="flex items-center justify-between">
                <span class="font-bold">周额度</span>
                <span class="text-12">剩余 {{ account.secondary.remaining }}%，已用 {{ account.secondary.used }}%</span>
              </div>
              <Progress :percent="account.secondary.remaining" />
              <div class="text-12">重置倒计时 {{ account.secondary.left }}，本地时间 {{ account.secondary.resetAt }}</div>
            </div>
          </div>

          <div v-else class="flex flex-col gap-8">
            <div class="text-12">{{ account.source }}</div>
            <Tag color="red">{{ account.error }}</Tag>
          </div>
        </Card>

        <Card title="提示">
          <div class="text-12 leading-relaxed">
            账号列表为空时，会尝试读取用户目录下的 .codex/auth.json。配置多账号时，每行填写：名称|auth.json完整路径，或 名称|Bearer token/access_token，或 名称|Cookie字符串。
          </div>
        </Card>
      </div>
    `,
    setup() {
      const accounts = ref([])
      const loading = ref(false)

      async function refreshUsage() {
        loading.value = true
        try {
          accounts.value = await loadAccountResults(Plugin)
        } finally {
          loading.value = false
        }
      }

      onMounted(refreshUsage)

      return {
        accounts,
        loading,
        hasAnyError: computed(() => accounts.value.some((item) => !item.success)),
        refreshUsage,
        formatAccount(account) {
          const email = showEmail.value ? account.email || 'Unknown email' : '邮箱已隐藏'
          const plan = account.plan || 'Unknown plan'
          return `${email} - ${plan} - ${account.updatedAt}`
        }
      }
    }
  })

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      width: '90',
      height: '90',
      submit: false,
      maskClosable: true,
      cancelText: '关闭',
      afterClose: () => modal.destroy()
    },
    {
      toolbar: () =>
        h(
          resolveComponent('Button'),
          {
            type: 'text',
            onClick: () => {
              showEmail.value = !showEmail.value
            }
          },
          () => (showEmail.value ? '隐藏邮箱' : '显示邮箱')
        ),
      default: () => h(component)
    }
  )
  modal.open()
}

async function loadAccountResults(Plugin) {
  const accounts = await getConfiguredAccounts(Plugin)
  const results = await Promise.all(accounts.map((account) => loadAccountUsage(account)))
  return results
}

async function getConfiguredAccounts(Plugin) {
  const entries = Array.isArray(Plugin.Accounts) ? Plugin.Accounts.filter((item) => String(item || '').trim()) : []
  if (entries.length > 0) {
    return entries.map(parseAccountEntry)
  }

  const path = await getDefaultAuthPath()
  return [
    {
      id: 'default',
      name: '默认账号',
      authPath: path,
      source: path || '用户目录/.codex/auth.json'
    }
  ]
}

function parseAccountEntry(entry, index) {
  const text = String(entry || '').trim()
  if (!text) {
    return { id: `account-${index}`, name: `账号 ${index + 1}`, source: '' }
  }

  if (text.startsWith('{')) {
    const account = JSON.parse(text)
    return {
      id: `account-${index}`,
      name: account.name || `账号 ${index + 1}`,
      authPath: account.authPath || account.path || '',
      authorization: account.authorization || account.Authorization || account.token || '',
      cookie: account.cookie || account.Cookie || '',
      source: account.authPath || account.path || 'JSON 配置'
    }
  }

  const parts = splitAccountEntry(text)
  const name = parts.length > 1 ? parts[0].trim() : `账号 ${index + 1}`
  const credential = (parts.length > 1 ? parts.slice(1).join('|') : parts[0]).trim()
  const account = {
    id: `account-${index}`,
    name,
    source: credential
  }

  if (/^cookie\s*=/i.test(credential)) {
    account.cookie = credential.replace(/^cookie\s*=\s*/i, '')
  } else if (/^authorization\s*=/i.test(credential)) {
    account.authorization = credential.replace(/^authorization\s*=\s*/i, '')
  } else if (credential.includes('__Secure-next-auth.session-token=')) {
    account.cookie = credential
  } else if (looksLikeAuthPath(credential)) {
    account.authPath = credential
  } else {
    account.authorization = credential
  }

  return account
}

function splitAccountEntry(text) {
  if (text.includes('|')) return text.split('|')
  if (text.includes(',')) return text.split(',')
  return [text]
}

async function loadAccountUsage(account) {
  try {
    const usage = await fetchCodexUsage(account)
    const rateLimit = usage.rate_limit || {}
    return {
      ...account,
      success: true,
      email: usage.email,
      plan: usage.plan_type,
      allowed: !!rateLimit.allowed && !rateLimit.limit_reached,
      primary: getWindowSummary(rateLimit.primary_window),
      secondary: getWindowSummary(rateLimit.secondary_window),
      updatedAt: new Date().toLocaleString()
    }
  } catch (e) {
    return {
      ...account,
      success: false,
      error: formatError(e),
      primary: getWindowSummary(),
      secondary: getWindowSummary(),
      updatedAt: new Date().toLocaleString()
    }
  }
}

async function fetchCodexUsage(account) {
  const headers = await getAuthHeaders(account)
  const { status, body } = await Plugins.HttpGet(CODEX_USAGE_API, headers)
  const data = typeof body === 'string' ? JSON.parse(body) : body

  if (status && (status < 200 || status >= 300)) {
    throw new Error(`HTTP ${status}`)
  }
  if (!data?.rate_limit) {
    throw new Error('返回数据缺少 rate_limit 字段')
  }
  return data
}

async function getAuthHeaders(account) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'PluginHubCodexUsage/1.0'
  }

  if (account.authorization) {
    headers.Authorization = normalizeAuthorization(account.authorization)
  }
  if (account.cookie) {
    headers.Cookie = account.cookie
  }
  if (!headers.Authorization && account.authPath) {
    const accessToken = await readCodexAccessToken(account.authPath)
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  }
  if (!headers.Authorization && !headers.Cookie) {
    throw new Error('未找到授权信息')
  }
  return headers
}

async function readCodexAccessToken(path) {
  const raw = await Plugins.ReadFile(path)
  if (!raw || !raw.trim()) return ''

  const auth = JSON.parse(raw)
  if (auth?.access_token) return String(auth.access_token)
  if (auth?.tokens?.access_token) return String(auth.tokens.access_token)
  return ''
}

async function getDefaultAuthPath() {
  const home = normalizePath((await Plugins.GetEnv('USERPROFILE').catch(() => '')) || (await Plugins.GetEnv('HOME').catch(() => '')))
  return home ? `${home}/.codex/auth.json` : ''
}

function normalizePath(path) {
  return String(path || '').replaceAll('\\', '/')
}

function looksLikeAuthPath(value) {
  return /\.json$/i.test(value) || value.includes('/.codex/') || value.includes('\\.codex\\')
}

function normalizeAuthorization(value) {
  const text = String(value).trim()
  if (!text) return ''
  return /^Bearer\s+/i.test(text) ? text : `Bearer ${text}`
}

function getWindowSummary(window) {
  const used = clampPercent(Number(window?.used_percent || 0))
  return {
    used,
    remaining: clampPercent(100 - used),
    left: formatTimeLeft(window?.reset_after_seconds),
    resetAt: formatResetAt(window?.reset_at)
  }
}

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function formatTimeLeft(seconds) {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0) return '--'
  const total = Number(seconds)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.ceil((total % 3600) / 60)
  if (days >= 1) return `${days}d ${hours}h`
  if (hours >= 1) return `${hours}h ${Math.max(0, minutes)}m`
  return `${Math.max(0, minutes)}m`
}

function formatResetAt(unixSeconds) {
  if (!unixSeconds) return '--'
  const date = new Date(Number(unixSeconds) * 1000)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString()
}

function formatError(error) {
  const message = error?.message || String(error || '未知错误')
  return message.length > 180 ? message.slice(0, 180) + '...' : message
}
