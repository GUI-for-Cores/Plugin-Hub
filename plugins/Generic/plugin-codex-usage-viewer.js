const CODEX_USAGE_API = 'https://chatgpt.com/backend-api/wham/usage'
const CODEX_RESET_CREDITS_API = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits'
const REFRESH_INTERVAL = 5 * 60 * 1000

/** @type {EsmPlugin} */
export default (Plugin) => {
  const onRun = async () => {
    openUsageUI(Plugin)
    return 0
  }

  const onReady = async () => {
    addCoreStateUI(Plugin)
    startAutoRefresh(Plugin)
    return 0
  }

  const onEnabled = onReady
  const onInstall = onReady

  const onDispose = () => {
    stopAutoRefresh(Plugin)
    removeCoreStateUI(Plugin)
    return 0
  }

  const onTrayUpdate = async (tray, menus) => {
    return {
      tray: {
        ...tray,
        tooltip: getTrayTooltip(getPluginState(Plugin).accounts.value)
      },
      menus
    }
  }

  return { onRun, onReady, onEnabled, onInstall, onDispose, onTrayUpdate }
}

function openUsageUI(Plugin) {
  const { h, defineComponent, ref, computed, onMounted, resolveComponent } = Vue
  const state = getPluginState(Plugin)
  const showEmail = ref(false)
  injectUsageStyle()

  const component = defineComponent({
    template: /* html */ `
      <div class="codex-usage-viewer">
        <section class="summary-grid">
          <div class="summary-item">
            <span class="summary-icon blue">◎</span>
            <div><div class="summary-value">{{ accounts.length }}</div><div class="summary-label">账号总数</div></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon green">✓</span>
            <div><div class="summary-value">{{ availableCount }}</div><div class="summary-label">当前可用</div></div>
          </div>
          <div class="summary-item">
            <span class="summary-icon violet">↻</span>
            <div><div class="summary-value">{{ totalResetCredits }}</div><div class="summary-label">重置额度</div></div>
          </div>
        </section>

        <div v-if="loading && accounts.length === 0" class="state-panel">
          <Button loading type="text">正在读取额度数据…</Button>
        </div>
        <div v-else-if="accounts.length === 0" class="state-panel">
          <div class="state-symbol">⌁</div>
          <div class="state-title">尚未找到可用账号</div>
          <div class="state-description">请检查账号配置或默认的 .codex/auth.json</div>
        </div>

        <section v-else class="account-list">
          <article v-for="account in accounts" :key="account.id" class="account-card" :class="{ failed: !account.success }">
            <header class="account-header">
              <div class="account-identity">
                <div class="account-avatar">{{ account.name.slice(0, 1).toUpperCase() }}</div>
                <div>
                  <div class="account-name">{{ account.name }}</div>
                  <div class="account-meta">{{ formatAccount(account) }}</div>
                </div>
              </div>
              <Tag :color="account.success && account.allowed ? 'green' : 'red'">
                {{ !account.success ? '读取失败' : account.allowed ? '使用正常' : '额度受限' }}
              </Tag>
            </header>

            <div v-if="account.success" class="account-content">
              <div class="quota-grid">
                <div class="quota-panel">
                  <div class="quota-heading">
                    <div><span class="quota-dot primary"></span><span class="quota-name">5 小时额度</span></div>
                    <span class="quota-percent">{{ account.primary.remaining }}<small>%</small></span>
                  </div>
                  <Progress :percent="account.primary.remaining" :show-text="false" :stroke-width="10" />
                  <div class="quota-footer">
                    <span>已使用 {{ account.primary.used }}%</span><span>⏱ {{ account.primary.left }} 后重置</span>
                  </div>
                  <div class="reset-time">{{ account.primary.resetAt }}</div>
                </div>

                <div class="quota-panel">
                  <div class="quota-heading">
                    <div><span class="quota-dot secondary"></span><span class="quota-name">每周额度</span></div>
                    <span class="quota-percent">{{ account.secondary.remaining }}<small>%</small></span>
                  </div>
                  <Progress :percent="account.secondary.remaining" :show-text="false" :stroke-width="10" />
                  <div class="quota-footer">
                    <span>已使用 {{ account.secondary.used }}%</span><span>⏱ {{ account.secondary.left }} 后重置</span>
                  </div>
                  <div class="reset-time">{{ account.secondary.resetAt }}</div>
                </div>
              </div>

              <div class="credit-strip">
                <div class="credit-count"><span>↻</span><strong>{{ account.resetCreditCount || 0 }}</strong><small>次重置额度</small></div>
                <div v-if="account.resetCreditDetails && account.resetCreditDetails.length" class="credit-details">
                  <div v-for="credit in account.resetCreditDetails" :key="credit.key">
                    第 {{ credit.index }} 次 · {{ credit.expiresAt }} 过期
                  </div>
                </div>
                <div v-else class="credit-details">暂无额度过期记录</div>
                <Tag v-if="account.resetCreditError" color="red">{{ account.resetCreditError }}</Tag>
              </div>
            </div>

            <div v-else class="error-panel"><strong>无法读取此账号</strong><span>{{ account.error }}</span><small>{{ account.source }}</small></div>
          </article>
        </section>

        <footer class="usage-tip">
          <span class="tip-icon">i</span>
          <span>未配置账号时会读取 <code>.codex/auth.json</code>。多账号可按“名称 | auth.json 路径、Bearer token 或 Cookie”逐行填写。</span>
        </footer>
      </div>
    `,
    setup() {
      async function refreshUsage() {
        await refreshAndUpdateTray(Plugin)
      }

      onMounted(() => {
        if (state.accounts.value.length === 0 && !state.loading.value) {
          refreshUsage()
        }
      })

      return {
        accounts: state.accounts,
        loading: state.loading,
        availableCount: computed(() => state.accounts.value.filter((item) => item.success && item.allowed).length),
        totalResetCredits: computed(() => state.accounts.value.reduce((total, item) => total + (item.success ? item.resetCreditCount || 0 : 0), 0)),
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
      cancelText: '关闭'
    },
    {
      toolbar: () => [
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
        h(
          resolveComponent('Button'),
          {
            icon: 'refresh',
            type: 'text',
            loading: state.loading.value,
            onClick: () => refreshAndUpdateTray(Plugin)
          },
          () => '刷新'
        )
      ],
      default: () => h(component)
    }
  )
  modal.open()
}

function injectUsageStyle() {
  if (document.getElementById('codex-usage-viewer-style')) return
  const style = document.createElement('style')
  style.id = 'codex-usage-viewer-style'
  style.textContent = `
.codex-usage-viewer { display: flex; flex-direction: column; gap: 14px; padding: 0 10px 16px 0; color: var(--color-text-1, #172033); }
.codex-usage-viewer .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.codex-usage-viewer .summary-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--color-border-2, #e5e7eb); border-radius: 14px; background: var(--color-bg-2, #fff); }
.codex-usage-viewer .summary-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 36px; border-radius: 11px; font-size: 18px; font-weight: 800; }
.codex-usage-viewer .summary-icon.blue { color: #4f46e5; background: #eef2ff; } .codex-usage-viewer .summary-icon.green { color: #059669; background: #ecfdf5; } .codex-usage-viewer .summary-icon.violet { color: #9333ea; background: #faf5ff; }
.codex-usage-viewer .summary-value { font-size: 20px; line-height: 1.1; font-weight: 800; } .codex-usage-viewer .summary-label { margin-top: 3px; color: var(--color-text-3, #64748b); font-size: 11px; }
.codex-usage-viewer .account-list { display: flex; flex-direction: column; gap: 12px; }
.codex-usage-viewer .account-card { overflow: hidden; border: 1px solid var(--color-border-2, #e2e8f0); border-radius: 17px; background: var(--color-bg-2, #fff); box-shadow: 0 8px 24px rgba(15, 23, 42, 0.045); }
.codex-usage-viewer .account-card.failed { border-color: rgba(239, 68, 68, 0.28); }
.codex-usage-viewer .account-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 15px 18px; border-bottom: 1px solid var(--color-border-1, #f1f5f9); }
.codex-usage-viewer .account-identity { display: flex; align-items: center; min-width: 0; gap: 11px; }
.codex-usage-viewer .account-avatar { display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 38px; border-radius: 12px; color: #4338ca; background: linear-gradient(145deg, #e0e7ff, #ccfbf1); font-size: 16px; font-weight: 800; }
.codex-usage-viewer .account-name { font-size: 15px; font-weight: 750; } .codex-usage-viewer .account-meta { overflow: hidden; max-width: 68vw; margin-top: 3px; color: var(--color-text-3, #64748b); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.codex-usage-viewer .account-content { padding: 14px 18px 16px; }
.codex-usage-viewer .quota-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.codex-usage-viewer .quota-panel { padding: 14px; border: 1px solid var(--color-border-1, #edf0f4); border-radius: 13px; background: var(--color-fill-1, #f8fafc); }
.codex-usage-viewer .quota-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 11px; }
.codex-usage-viewer .quota-dot { display: inline-block; width: 7px; height: 7px; margin-right: 7px; border-radius: 50%; } .codex-usage-viewer .quota-dot.primary { background: #6366f1; } .codex-usage-viewer .quota-dot.secondary { background: #14b8a6; }
.codex-usage-viewer .quota-name { font-size: 12px; font-weight: 700; } .codex-usage-viewer .quota-percent { font-size: 21px; font-weight: 850; letter-spacing: -0.04em; } .codex-usage-viewer .quota-percent small { margin-left: 1px; font-size: 11px; font-weight: 600; color: var(--color-text-3, #64748b); }
.codex-usage-viewer .quota-footer { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; color: var(--color-text-3, #64748b); font-size: 10px; }
.codex-usage-viewer .reset-time { margin-top: 5px; color: var(--color-text-4, #94a3b8); font-size: 10px; }
.codex-usage-viewer .credit-strip { display: flex; align-items: center; gap: 16px; margin-top: 12px; padding: 11px 14px; border-radius: 12px; color: var(--color-text-2, #334155); background: linear-gradient(100deg, rgba(245, 243, 255, 0.9), rgba(239, 246, 255, 0.72)); }
.codex-usage-viewer .credit-count { display: flex; align-items: baseline; gap: 5px; white-space: nowrap; } .codex-usage-viewer .credit-count > span { color: #7c3aed; font-size: 16px; } .codex-usage-viewer .credit-count strong { font-size: 18px; } .codex-usage-viewer .credit-count small { color: var(--color-text-3, #64748b); }
.codex-usage-viewer .credit-details { flex: 1; color: var(--color-text-3, #64748b); font-size: 10px; line-height: 1.55; }
.codex-usage-viewer .error-panel { display: flex; flex-direction: column; gap: 6px; margin: 14px 18px 16px; padding: 14px; border-radius: 12px; color: #b42318; background: #fff4f2; } .codex-usage-viewer .error-panel small { color: #9f6c66; word-break: break-all; }
.codex-usage-viewer .state-panel { display: flex; min-height: 180px; flex-direction: column; align-items: center; justify-content: center; padding: 24px; border: 1px dashed var(--color-border-3, #cbd5e1); border-radius: 16px; background: var(--color-fill-1, #f8fafc); text-align: center; }
.codex-usage-viewer .state-symbol { color: #818cf8; font-size: 34px; } .codex-usage-viewer .state-title { margin-top: 7px; font-weight: 750; } .codex-usage-viewer .state-description { margin-top: 5px; color: var(--color-text-3, #64748b); font-size: 12px; }
.codex-usage-viewer .usage-tip { display: flex; align-items: flex-start; gap: 9px; padding: 11px 14px; border: 1px dashed var(--color-border-3, #cbd5e1); border-radius: 12px; color: var(--color-text-3, #64748b); font-size: 11px; line-height: 1.65; }
.codex-usage-viewer .tip-icon { display: grid; place-items: center; width: 17px; height: 17px; flex: 0 0 17px; margin-top: 1px; border-radius: 50%; color: #fff; background: #94a3b8; font-size: 10px; font-weight: 800; } .codex-usage-viewer code { padding: 1px 4px; border-radius: 4px; background: var(--color-fill-2, rgba(148, 163, 184, 0.15)); }
@media (prefers-color-scheme: dark) { .codex-usage-viewer .summary-icon.blue, .codex-usage-viewer .summary-icon.green, .codex-usage-viewer .summary-icon.violet { background: rgba(99, 102, 241, 0.13); } .codex-usage-viewer .credit-strip { background: linear-gradient(100deg, rgba(76, 29, 149, 0.18), rgba(30, 64, 175, 0.14)); } .codex-usage-viewer .error-panel { background: rgba(127, 29, 29, 0.22); } }
@media (max-width: 720px) { .codex-usage-viewer .summary-grid { grid-template-columns: 1fr; } .codex-usage-viewer .quota-grid { grid-template-columns: 1fr; } .codex-usage-viewer .credit-strip { align-items: flex-start; flex-direction: column; gap: 7px; } }
`
  document.head.appendChild(style)
}

async function loadAccountResults(Plugin) {
  const accounts = await getConfiguredAccounts(Plugin)
  const results = await Promise.all(accounts.map((account) => loadAccountUsage(account)))
  return results
}

async function refreshAndUpdateTray(Plugin) {
  const state = getPluginState(Plugin)
  state.loading.value = true
  try {
    const accounts = await loadAccountResults(Plugin)
    state.accounts.value = accounts
    await updateTrayTooltip(accounts)
    return accounts
  } finally {
    state.loading.value = false
  }
}

function startAutoRefresh(Plugin) {
  const state = getPluginState(Plugin)
  stopAutoRefresh(Plugin)
  state.timer = setInterval(() => {
    refreshAndUpdateTray(Plugin).catch((e) => {
      console.log(`[${Plugin.name}]`, '自动刷新 Codex 用量失败', e)
    })
  }, REFRESH_INTERVAL)
  refreshAndUpdateTray(Plugin).catch((e) => {
    console.log(`[${Plugin.name}]`, '刷新 Codex 用量失败', e)
  })
}

function stopAutoRefresh(Plugin) {
  const state = getPluginState(Plugin)
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
}

function getPluginState(Plugin) {
  window[Plugin.id] = window[Plugin.id] || {
    timer: null,
    accounts: Vue.ref([]),
    loading: Vue.ref(false)
  }
  return window[Plugin.id]
}

function addCoreStateUI(Plugin) {
  const uiId = Plugin.id + '_core_state'
  const appStore = Plugins.useAppStore()
  appStore.removeCustomActions('core_state', [uiId])
  appStore.addCustomActions('core_state', {
    id: uiId,
    component: 'Button',
    componentProps: {
      type: 'link',
      size: 'small',
      onClick: () => openUsageUI(Plugin)
    },
    componentSlots: {
      default: ({ h }) => h('span', getCoreStateText(Plugin))
    }
  })
}

function removeCoreStateUI(Plugin) {
  Plugins.useAppStore().removeCustomActions('core_state', [Plugin.id + '_core_state'])
}

function getCoreStateText(Plugin) {
  const state = getPluginState(Plugin)
  return getAccountStateText(state.accounts.value, state.loading.value)
}

function getAccountStateText(accounts, loading = false) {
  if (loading) return 'Codex 刷新中'
  const okAccounts = (Array.isArray(accounts) ? accounts : []).filter((item) => item.success)
  if (okAccounts.length === 0) return 'Codex --'
  return `Codex ${okAccounts[0].primary.remaining}% R${okAccounts[0].resetCreditCount || 0}`
}

async function updateTrayTooltip(accounts) {
  await Plugins.UpdateTray({
    tooltip: getTrayTooltip(accounts)
  })
}

function getTrayTooltip(accounts) {
  return Plugins.APP_TITLE + ' ' + Plugins.APP_VERSION + '\n' + getAccountStateText(accounts)
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
    const [usageResult, resetCreditsResult] = await Promise.allSettled([fetchCodexUsage(account), fetchCodexResetCredits(account)])
    const resetCreditsData = resetCreditsResult.status === 'fulfilled' ? resetCreditsResult.value : null
    const usage = usageResult.status === 'fulfilled' ? usageResult.value : resetCreditsData

    if (!usage?.rate_limit) {
      throw usageResult.status === 'rejected' ? usageResult.reason : new Error('返回数据缺少 rate_limit 字段')
    }

    const rateLimit = usage.rate_limit || {}
    const resetCreditCount = getResetCreditCount(resetCreditsData || usage)
    const resetCreditDetails = getResetCreditDetails(resetCreditsData || usage)
    const resetCreditError = resetCreditsResult.status === 'rejected' ? formatError(resetCreditsResult.reason) : ''

    return {
      ...account,
      success: true,
      email: usage.email,
      plan: usage.plan_type,
      allowed: !!rateLimit.allowed && !rateLimit.limit_reached,
      primary: getWindowSummary(rateLimit.primary_window),
      secondary: getWindowSummary(rateLimit.secondary_window),
      resetCreditCount,
      resetCreditDetails,
      resetCreditError,
      updatedAt: new Date().toLocaleString()
    }
  } catch (e) {
    return {
      ...account,
      success: false,
      error: formatError(e),
      primary: getWindowSummary(),
      secondary: getWindowSummary(),
      resetCreditCount: 0,
      resetCreditDetails: [],
      resetCreditError: '',
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

async function fetchCodexResetCredits(account) {
  const headers = await getAuthHeaders(account)
  const { status, body } = await Plugins.HttpGet(CODEX_RESET_CREDITS_API, headers)
  const data = typeof body === 'string' ? JSON.parse(body) : body

  if (status && (status < 200 || status >= 300)) {
    throw new Error(`HTTP ${status}`)
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
  return formatDateWithRelative(date)
}

function getResetCreditCount(data) {
  const count = Number(
    data?.resetCreditCount ?? data?.rate_limit_reset_credits?.available_count ?? data?.rateLimitResetCredits?.availableCount ?? data?.available_count ?? 0
  )
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
}

function getResetCreditDetails(data) {
  const payload = data?.rate_limit_reset_credits || data?.rateLimitResetCredits || data
  const credits = Array.isArray(payload?.credits) ? payload.credits : Array.isArray(payload?.items) ? payload.items : []
  return credits
    .map((credit, index) => {
      const expiresAt = formatCreditExpiresAt(credit?.expires_at || credit?.expiresAt || credit?.expires)
      return expiresAt === '--' ? null : { key: `${index}-${expiresAt}`, index: index + 1, expiresAt }
    })
    .filter(Boolean)
}

function formatCreditExpiresAt(value) {
  if (!value) return '--'
  const text = String(value)
  const numeric = Number(text)
  const date = Number.isFinite(numeric) && /^\d+(\.\d+)?$/.test(text) ? new Date(numeric > 1000000000000 ? numeric : numeric * 1000) : new Date(text)
  if (Number.isNaN(date.getTime())) return '--'
  return formatDateWithRelative(date)
}

function formatDateWithRelative(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}:${second} ${Plugins.formatRelativeTime(date)}`
}

function formatError(error) {
  const message = error?.message || String(error || '未知错误')
  return message.length > 180 ? message.slice(0, 180) + '...' : message
}
