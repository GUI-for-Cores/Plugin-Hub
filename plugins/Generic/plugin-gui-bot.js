const WORK_MODE = {
  POLLING: 'polling',
  WEBHOOK: 'webhook'
}

const TELEGRAM_API = 'https://api.telegram.org'
const TEXT_MIME_TYPE = 'text/plain; charset=utf-8'
const WEBHOOK_PATH = '/webhook'
const MAX_MESSAGE_LENGTH = 4096
const CHUNK_LENGTH = 3900
const CALLBACK_LIMIT = 64
const PAGE_SIZE = 8
const LOG_LIMIT = 1000
const BOT_TOKEN_PATTERN = /^\d{6,}:[A-Za-z0-9_-]{30,}$/
const SECRET_PATTERN = /^[A-Za-z0-9_-]{1,256}$/
const ALLOWED_UPDATES = ['message', 'callback_query']
const GROUP_TYPES = ['Selector', 'Fallback', 'URLTest']
const MODES = [
  { key: 'rule', label: '规则' },
  { key: 'global', label: '全局' },
  { key: 'direct', label: '直连' }
]

const BOT_COMMANDS = [
  { command: 'menu', description: '状态总览' },
  { command: 'help', description: '命令列表' },
  { command: 'id', description: '查看我的 ID' },
  { command: 'core', description: '内核 start/stop/restart' },
  { command: 'mode', description: '模式 rule/global/direct' },
  { command: 'profile', description: '查看或切换配置' },
  { command: 'proxy', description: '查看或切换代理组' },
  { command: 'sub', description: '订阅查看与更新' },
  { command: 'rule', description: '规则集查看与更新' },
  { command: 'plugin', description: '插件查看、运行与更新' },
  { command: 'task', description: '计划任务查看与运行' },
  { command: 'sysproxy', description: '系统代理 on/off' },
  { command: 'tun', description: 'TUN 模式 on/off' },
  { command: 'logs', description: '查看或下载内核日志' }
]

const HELP_TEXT = `可用命令：

/start、/menu — 状态总览
/help — 命令列表
/id — 查看我的 ID
/core start|stop|restart — 内核控制
/mode rule|global|direct — 切换模式
/profile [序号|ID] — 查看或切换配置
/proxy [组序号] — 查看或切换代理组
/sub [update <序号>|updateall] — 订阅
/rule [update <序号>|updateall] — 规则集
/plugin [run <序号>|update <序号>|updateall] — 插件
/task [run <序号>] — 计划任务
/sysproxy [on|off] — 系统代理
/tun [on|off] — TUN 模式
/logs [file|text] — 内核日志`

const PANEL_COMMANDS = BOT_COMMANDS.filter((item) => ['menu', 'core', 'mode', 'proxy', 'logs'].includes(item.command))

const getErrorMessage = (error) => {
  if (error instanceof TelegramError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error)
  }
  return '未知错误'
}

const friendlyError = (error) => {
  const text = getErrorMessage(error)
  if (text === 'home.overview.needPort') {
    return '请先在配置中设置 Mixed / HTTP / SOCKS 端口'
  }
  if (text === 'home.overview.needTun') {
    return '当前配置未启用 TUN 入站'
  }
  return text
}

const redactToken = (text, token) => {
  if (!token) {
    return text
  }
  return text.split(token).join('***')
}

const toText = (value) => {
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

const truncate = (text, limit) => {
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 1))}…`
}

const chunkText = (text, limit) => {
  if (!text) {
    return ['']
  }
  const chunks = []
  let rest = text
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit)
    if (cut < limit * 0.5) {
      cut = limit
    }
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^\n+/, '')
  }
  chunks.push(rest)
  return chunks
}

const clampNumber = (value, min, max, fallback) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

const normalizeAllowedUserIds = (value) => {
  let source = []
  if (Array.isArray(value)) {
    source = value
  } else if (typeof value === 'string') {
    source = value.split(/[\s,，;；]+/)
  }
  const ids = new Set()
  for (const item of source) {
    const id = Number(toText(item).trim())
    if (Number.isInteger(id) && id > 0) {
      ids.add(id)
    }
  }
  return [...ids]
}

const isSingBox = () => Plugins.APP_TITLE.includes('SingBox')

const isSelectableType = (type) => {
  if (isSingBox()) {
    return type === 'Selector'
  }
  return GROUP_TYPES.includes(type)
}

const formatTime = (timestamp) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '未知'
  }
  return Plugins.formatDate(timestamp, 'YYYY-MM-DD HH:mm:ss')
}

const formatDelay = (proxy) => {
  const delay = proxy?.history?.[0]?.delay
  if (typeof delay !== 'number' || delay <= 0) {
    return ''
  }
  return ` · ${delay} ms`
}

const safeFileName = (name, fallback) => {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || fallback).slice(0, 80)
}

const fileExtension = (path, fallback) => {
  const match = /\.([a-z0-9]{1,8})$/i.exec(path ?? '')
  return match ? `.${match[1]}` : fallback
}

const countItems = (value) => (Array.isArray(value) ? value.length : 0)

const formatBytes = (bytes) => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }
  return Plugins.formatBytes(bytes)
}

const formatLogs = (logs) =>
  logs.map((entry, index) => `${index + 1}  ${Plugins.formatDate(entry.timestamp, 'HH:mm:ss')}  ${entry.type.toUpperCase()}  ${entry.payload}`).join('\n')

const makeButton = (text, data) => ({
  text: truncate(text, 60),
  callback_data: data.length > CALLBACK_LIMIT ? data.slice(0, CALLBACK_LIMIT) : data
})

const makeKeyboard = (rows) => ({
  inline_keyboard: rows
})

const paginationRow = (prefix, page, total) => {
  const row = []
  if (page > 0) {
    row.push(makeButton('« 上一页', `${prefix}:${page - 1}`))
  }
  if ((page + 1) * PAGE_SIZE < total) {
    row.push(makeButton('下一页 »', `${prefix}:${page + 1}`))
  }
  return row
}

const totalPages = (count) => Math.max(1, Math.ceil(count / PAGE_SIZE))

const safePage = (page, count) => Math.min(Math.max(page, 0), totalPages(count) - 1)

class TelegramError extends Error {
  constructor(description, token, code, retryAfter) {
    super(redactToken(description, token))
    this.name = 'TelegramError'
    this.code = code
    this.retryAfter = retryAfter
  }
}

const createLogCollector = (limit) => {
  let buffer = []
  let unregister = undefined

  const clear = () => {
    buffer = []
  }

  const detach = (clearLogs = false) => {
    unregister?.()
    unregister = undefined
    if (clearLogs) {
      clear()
    }
  }

  const attach = () => {
    detach()
    if (!Plugins.useKernelApiStore().running) {
      return
    }
    clear()
    unregister = Plugins.useKernelApiStore().onLogs((data) => {
      buffer.push({
        timestamp: Date.now(),
        type: toText(data.type) || 'unknown',
        payload: toText(data.payload)
      })
      if (buffer.length > limit) {
        buffer.splice(0, buffer.length - limit)
      }
    })
  }

  return {
    attach,
    detach,
    getLogs: () => [...buffer]
  }
}

const createTelegramApi = (token, fileDir) => {
  const base = `${TELEGRAM_API}/bot${token}`

  const parse = (status, rawBody, method) => {
    const parseBody = () => {
      try {
        return JSON.parse(rawBody)
      } catch {
        throw new TelegramError(`${method} 返回了无法解析的响应 (HTTP ${status})`, token)
      }
    }
    const payload = parseBody()
    if (!payload.ok) {
      throw new TelegramError(payload.description || `${method} 调用失败 (HTTP ${status})`, token, payload.error_code, payload.parameters?.retry_after)
    }
    return payload.result
  }

  const request = async (method, params, options) => {
    const send = async () => {
      try {
        const result = await Plugins.Requests({
          url: `${base}/${method}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: params ?? {},
          autoTransformBody: false,
          ...(options ? { options } : {})
        })
        return {
          status: result.status,
          body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body) || ''
        }
      } catch (error) {
        throw new TelegramError(getErrorMessage(error), token)
      }
    }
    const response = await send()
    return parse(response.status, response.body, method)
  }

  const sendDocument = async (chatId, content, fileName, caption) => {
    const filePath = `${fileDir}/${fileName}`
    await Plugins.MakeDir(fileDir)
    const captionQuery = caption && caption.trim() ? `&caption=${encodeURIComponent(truncate(caption.trim(), 1000))}` : ''
    try {
      await Plugins.WriteFile(filePath, content)
      const response = await Plugins.Upload(`${base}/sendDocument?chat_id=${chatId}${captionQuery}`, filePath, {}, undefined, { FileField: 'document' })
      const body = response.body
      if (!body) {
        throw new TelegramError('sendDocument 返回了空响应', token)
      }
      if (!body.ok) {
        throw new TelegramError(body.description || 'sendDocument 调用失败', token, body.error_code, body.parameters?.retry_after)
      }
      return body.result
    } catch (error) {
      if (error instanceof TelegramError) {
        throw error
      }
      throw new TelegramError(getErrorMessage(error), token)
    } finally {
      await Plugins.ignoredError(Plugins.RemoveFile, filePath)
    }
  }

  return {
    getMe: () => request('getMe'),
    getUpdates: (params, options) => request('getUpdates', params, options),
    setMyCommands: (commands, chatId) => request('setMyCommands', chatId ? { commands, scope: { type: 'chat', chat_id: chatId } } : { commands }),
    deleteWebhook: (dropPendingUpdates) =>
      request('deleteWebhook', {
        drop_pending_updates: dropPendingUpdates
      }),
    setWebhook: (url, secret, dropPendingUpdates) =>
      request('setWebhook', {
        url,
        secret_token: secret,
        drop_pending_updates: dropPendingUpdates,
        allowed_updates: ALLOWED_UPDATES
      }),
    sendMessage: (chatId, text, options) =>
      request('sendMessage', {
        chat_id: chatId,
        text,
        ...options
      }),
    editMessageText: (chatId, messageId, text, options) =>
      request('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        ...options
      }),
    answerCallbackQuery: (id, text) =>
      request('answerCallbackQuery', {
        callback_query_id: id,
        ...(text ? { text } : {})
      }),
    sendDocument
  }
}

const decodeWebhookBody = (body) => {
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

const parseCommand = (text, entities) => {
  if (!text.startsWith('/')) {
    return undefined
  }
  if (!entities.some((entity) => entity.type === 'bot_command')) {
    return undefined
  }
  const [rawCommand, ...args] = text.trim().split(/\s+/)
  if (!rawCommand) {
    return undefined
  }
  const name = rawCommand.slice(1).split('@')[0]?.toLowerCase()
  if (!name) {
    return undefined
  }
  return { name, args }
}

const createUpdateContext = (update, api) => {
  const callbackQuery = update.callback_query
  const message = callbackQuery?.message ?? update.message
  if (!message) {
    return undefined
  }
  const user = callbackQuery?.from ?? message.from
  if (!user) {
    return undefined
  }
  const text = message.text ?? message.caption ?? ''
  const entities = message.entities ?? message.caption_entities ?? []
  const command = parseCommand(text, entities)

  const reply = async (content, options) => {
    const chunks = chunkText(content, CHUNK_LENGTH)
    for (let index = 0; index < chunks.length; index += 1) {
      const suffix = chunks.length > 1 ? `\n\n(${index + 1}/${chunks.length})` : ''
      await api.sendMessage(message.chat.id, `${chunks[index]}${suffix}`, index === 0 ? options : undefined)
    }
  }

  const edit = async (content, options) => {
    try {
      await api.editMessageText(message.chat.id, message.message_id, truncate(content, MAX_MESSAGE_LENGTH - 8), options)
    } catch (error) {
      if (getErrorMessage(error).includes('message is not modified')) {
        return
      }
      await reply(content, options)
    }
  }

  return {
    chat: message.chat,
    user,
    text,
    command,
    callbackData: callbackQuery?.data ?? '',
    isCallback: Boolean(callbackQuery),
    reply,
    edit,
    answer: async (content) => {
      if (!callbackQuery) {
        return
      }
      await api.answerCallbackQuery(callbackQuery.id, content)
    },
    replyDocument: async (content, fileName) => {
      await api.sendDocument(message.chat.id, content, fileName)
    }
  }
}

const createTelegramBot = (options) => {
  const { api } = options
  const allowed = new Set(options.allowedUserIds)
  let polling = false
  let stopped = false
  let offset = 0
  let conflicts = 0

  const handleUpdate = async (update) => {
    const ctx = createUpdateContext(update, api)
    if (!ctx) {
      return
    }
    if (ctx.chat.type !== 'private') {
      return
    }
    if (!allowed.has(ctx.user.id) && ctx.command?.name !== 'id') {
      return
    }
    try {
      if (ctx.isCallback) {
        await options.onCallback(ctx)
      } else {
        await options.onMessage(ctx)
      }
    } catch (error) {
      await ctx.reply(`操作失败：${friendlyError(error)}`).catch(() => undefined)
      options.onError(error)
    }
  }

  const poll = async (timeout) => {
    while (!stopped) {
      try {
        const updates = await api.getUpdates(
          {
            offset,
            timeout,
            allowed_updates: ALLOWED_UPDATES
          },
          { Timeout: timeout + 15 }
        )
        conflicts = 0
        for (const update of updates) {
          offset = update.update_id + 1
          await handleUpdate(update)
        }
      } catch (error) {
        if (stopped) {
          break
        }
        if (error instanceof TelegramError) {
          if (error.code === 401) {
            stopped = true
            options.onFatal(new TelegramError('Bot Token 无效或已失效', ''))
            break
          }
          if (error.code === 409) {
            conflicts += 1
            if (conflicts >= 3) {
              stopped = true
              options.onFatal(new TelegramError('长轮询冲突：请确认没有其他实例正在使用该 Bot Token', ''))
              break
            }
            await Plugins.sleep(3000)
            continue
          }
          if (error.code === 429) {
            await Plugins.sleep((error.retryAfter ?? 3) * 1000)
            continue
          }
          if (error.code === 400) {
            stopped = true
            options.onFatal(error)
            break
          }
        }
        options.onError(error)
        await Plugins.sleep(3000)
      }
    }
    polling = false
  }

  return {
    handleUpdate,
    startPolling: (timeout) => {
      if (polling) {
        return
      }
      polling = true
      stopped = false
      void poll(timeout)
    },
    stopPolling: () => {
      stopped = true
      polling = false
    }
  }
}

export default (plugin) => {
  const state = Vue.reactive({
    running: false,
    starting: false,
    botUsername: '',
    lastError: ''
  })

  let bot = undefined
  let lifecycle = 0
  let lastConfig = undefined
  let appliedKey = ''
  let webhookSecret = ''

  const logCollector = createLogCollector(LOG_LIMIT)
  const cacheDir = `data/.cache/${plugin.id}`

  const readConfig = (source) => {
    const values = source ?? plugin
    const workMode = values.WorkMode === WORK_MODE.WEBHOOK ? WORK_MODE.WEBHOOK : WORK_MODE.POLLING
    return {
      WorkMode: workMode,
      BotToken: toText(values.BotToken).trim(),
      AllowedUserIds: normalizeAllowedUserIds(values.AllowedUserIds),
      PollingTimeout: clampNumber(toText(values.PollingTimeout), 5, 60, 30),
      WebhookUrl: toText(values.WebhookUrl).trim(),
      WebhookListen: toText(values.WebhookListen).trim() || '0.0.0.0',
      WebhookPort: clampNumber(toText(values.WebhookPort), 0, 65535, 0),
      WebhookSecret: toText(values.WebhookSecret).trim(),
      DropPendingUpdates: values.DropPendingUpdates !== false,
      AutoStart: values.AutoStart === true
    }
  }

  const validateConfig = (config) => {
    if (!config.BotToken) {
      return '请先配置 Telegram 机器人 Token'
    }
    if (!BOT_TOKEN_PATTERN.test(config.BotToken)) {
      return 'Bot Token 格式不正确，请检查是否完整复制'
    }
    if (config.WorkMode === WORK_MODE.WEBHOOK) {
      if (!/^https:\/\//i.test(config.WebhookUrl)) {
        return 'Webhook URL 必须以 https:// 开头'
      }
      if (config.WebhookPort < 1 || config.WebhookPort > 65535) {
        return 'Webhook 监听端口无效'
      }
      if (!SECRET_PATTERN.test(config.WebhookSecret)) {
        return 'Webhook Secret 仅支持字母、数字、下划线和短横线'
      }
    }
    return undefined
  }

  const serviceKey = (config) =>
    JSON.stringify([
      config.BotToken,
      config.WorkMode,
      config.AllowedUserIds,
      config.PollingTimeout,
      config.WebhookUrl,
      config.WebhookListen,
      config.WebhookPort,
      config.WebhookSecret
    ])

  const setError = (message) => {
    state.lastError = message
  }

  const startWebhookServer = async (config, target) => {
    await Plugins.ignoredError(Plugins.StopServer, plugin.id)
    webhookSecret = config.WebhookSecret
    await Plugins.StartServer(`${config.WebhookListen}:${config.WebhookPort}`, plugin.id, async (req, res) => {
      const reply = (status, body) => {
        res.end(status, { 'Content-Type': TEXT_MIME_TYPE }, body, {
          mode: 'Text'
        })
      }
      const headerMap = {}
      for (const [key, value] of Object.entries(req.headers)) {
        headerMap[key.toLowerCase()] = Array.isArray(value) ? String(value[0] ?? '') : String(value)
      }
      if (req.method !== 'POST' || req.url.split('?')[0] !== WEBHOOK_PATH) {
        reply(404, 'Not Found')
        return
      }
      if (!webhookSecret || headerMap['x-telegram-bot-api-secret-token'] !== webhookSecret) {
        reply(403, 'Forbidden')
        return
      }
      const decodeUpdate = () => {
        try {
          return decodeWebhookBody(req.body)
        } catch (error) {
          console.warn(`[${plugin.name}] Invalid webhook body:`, error)
          return undefined
        }
      }
      const update = decodeUpdate()
      if (!update) {
        reply(400, 'Bad Request')
        return
      }
      reply(200, 'OK')
      await target.handleUpdate(update).catch((error) => {
        console.warn(`[${plugin.name}]`, getErrorMessage(error))
      })
    })
  }

  const start = async (options) => {
    if (state.starting) {
      return 2
    }
    const config = options?.config ?? readConfig()
    const invalid = validateConfig(config)
    if (invalid) {
      setError(invalid)
      if (!options?.silent) {
        Plugins.message.warn(invalid)
      }
      return 2
    }

    const token = ++lifecycle
    state.starting = true
    setError('')
    try {
      await stop(true)

      const api = createTelegramApi(config.BotToken, cacheDir)
      const me = await api.getMe()
      if (token !== lifecycle) {
        return 2
      }

      state.botUsername = typeof me.username === 'string' ? me.username : String(me.id)

      await api.deleteWebhook(config.DropPendingUpdates).catch(() => undefined)

      const nextBot = createTelegramBot({
        api,
        allowedUserIds: config.AllowedUserIds,
        onMessage: (ctx) => handleMessage(ctx),
        onCallback: (ctx) => handleCallback(ctx),
        onError: (error) => {
          console.warn(`[${plugin.name}]`, getErrorMessage(error))
        },
        onFatal: (error) => {
          state.running = false
          setError(getErrorMessage(error))
          Plugins.message.error(`${plugin.name} 已停止：${getErrorMessage(error)}`)
        }
      })

      const discard = async () => {
        nextBot.stopPolling()
        await Plugins.ignoredError(Plugins.StopServer, plugin.id)
      }

      if (config.WorkMode === WORK_MODE.WEBHOOK) {
        await startWebhookServer(config, nextBot)
        if (token !== lifecycle) {
          await discard()
          return 2
        }
        await api.setWebhook(`${config.WebhookUrl.replace(/\/+$/, '')}${WEBHOOK_PATH}`, config.WebhookSecret, config.DropPendingUpdates)
      } else {
        nextBot.startPolling(config.PollingTimeout)
      }

      await registerCommands(api, config.AllowedUserIds)

      if (token !== lifecycle) {
        await discard()
        return 2
      }

      bot = nextBot
      lastConfig = config
      appliedKey = serviceKey(config)
      state.running = true
      logCollector.attach()

      if (!options?.silent) {
        const modeLabel = config.WorkMode === WORK_MODE.WEBHOOK ? 'Webhook' : '长轮询'
        Plugins.message.success(`${plugin.name} 已启动（${modeLabel}）`)
      }
      return 1
    } catch (error) {
      setError(redactToken(getErrorMessage(error), config.BotToken))
      await stop(true)
      if (!options?.silent) {
        Plugins.message.error(`${plugin.name} 启动失败：${state.lastError}`)
      }
      return 2
    } finally {
      state.starting = false
    }
  }

  const stop = async (silent = true) => {
    const current = bot
    bot = undefined
    state.running = false
    current?.stopPolling()
    webhookSecret = ''
    await Plugins.ignoredError(Plugins.StopServer, plugin.id)
    logCollector.detach()
    appliedKey = ''

    const config = lastConfig
    if (config && config.BotToken && config.WorkMode === WORK_MODE.WEBHOOK) {
      await createTelegramApi(config.BotToken, cacheDir)
        .deleteWebhook(true)
        .catch(() => undefined)
    }

    if (!silent) {
      Plugins.message.success(`${plugin.name} 已停止`)
    }
    return 2
  }

  const shutdown = async (silent = true) => {
    lifecycle += 1
    return stop(silent)
  }

  const registerCommands = async (api, allowedUserIds) => {
    const commands = BOT_COMMANDS.map(({ command, description }) => ({
      command,
      description
    }))
    for (const chatId of allowedUserIds) {
      await api.setMyCommands(commands, chatId).catch(() => undefined)
    }
  }

  const getProxyMap = () => {
    const proxies = Plugins.useKernelApiStore().proxies
    return proxies && typeof proxies === 'object' ? proxies : {}
  }

  const getProxyGroups = () =>
    Object.values(getProxyMap()).filter((item) => {
      if (!item || typeof item.name !== 'string') {
        return false
      }
      if (item.name === 'GLOBAL') {
        return false
      }
      return isSelectableType(toText(item.type))
    })

  const getKernelConfig = () => Plugins.useKernelApiStore().config

  const getAppKernelSettings = () => {
    const settings = Plugins.useAppSettingsStore().app
    return settings.kernel ?? {}
  }

  const updateKernelConfig = async (...args) => {
    const store = Plugins.useKernelApiStore()
    await store.updateConfig(...args)
  }

  const resolveByTarget = (items, target) => {
    if (!target) {
      return undefined
    }
    const index = Number(target)
    if (Number.isInteger(index) && index >= 1 && index <= items.length) {
      return items[index - 1]
    }
    const lower = target.toLowerCase()
    return items.find((item) => item.id === target || item.name === target || item.name.toLowerCase() === lower)
  }

  const respond = async (ctx, text, keyboard) => {
    const options = keyboard ? { reply_markup: keyboard } : undefined
    if (ctx.isCallback) {
      await ctx.edit(text, options)
      return
    }
    await ctx.reply(text, options)
  }

  const showOverview = async (ctx) => {
    const env = Plugins.useEnvStore()
    const kernel = Plugins.useKernelApiStore()
    const config = readConfig()
    const appKernel = getAppKernelSettings()
    const profiles = Plugins.useProfilesStore().profiles
    const currentProfile = profiles.find((item) => item.id === appKernel.profile)
    const systemProxy = await Plugins.GetSystemProxy().catch(() => '')
    const tunEnabled = Boolean(getKernelConfig().tun?.enable)
    const groups = getProxyGroups()
    const groupLines = groups.slice(0, 8).map((group) => `· ${group.name} → ${group.now || '未选择'}`)
    if (groups.length > 8) {
      groupLines.push(`· 其余 ${groups.length - 8} 个组`)
    }

    const lines = [
      plugin.name,
      '',
      `· 客户端：${Plugins.APP_TITLE} ${Plugins.APP_VERSION}`,
      `· 运行环境：${env.env.os} (${env.env.arch})`,
      `· 内核状态：${kernel.running ? '运行中' : '已停止'}`,
      `· 工作模式：${getKernelConfig().mode || '未知'}`,
      `· 当前配置：${currentProfile?.name ?? '未选择'}`,
      `· 系统代理：${systemProxy ? '已开启' : '已关闭'}`,
      `· TUN：${tunEnabled ? '已开启' : '已关闭'}`,
      `· Bot：${state.running ? `@${state.botUsername}` : '未运行'}`,
      '',
      '代理组：',
      ...(groupLines.length > 0 ? groupLines : ['· 暂无可用代理组'])
    ]
    if (config.AllowedUserIds.length > 1) {
      lines.push('', `管理员：${config.AllowedUserIds.length} 人`)
    }
    await respond(
      ctx,
      lines.join('\n'),
      makeKeyboard([
        [makeButton('刷新', 'menu'), makeButton('工作模式', 'mode'), makeButton('日志', 'log')],
        [makeButton('启动内核', 'core:s'), makeButton('停止内核', 'core:x'), makeButton('重启内核', 'core:r')],
        [makeButton('代理组', 'px:0'), makeButton('配置', 'pf')],
        [makeButton('订阅', 'sub:0'), makeButton('规则集', 'rs:0'), makeButton('插件', 'pl:0'), makeButton('任务', 'tk:0')]
      ])
    )
  }

  const showModes = async (ctx) => {
    const current = getKernelConfig().mode
    const rows = MODES.map((mode) => [makeButton(`${mode.key === current ? '✅ ' : ''}${mode.label} (${mode.key})`, `mode:${mode.key}`)])
    rows.push([makeButton('返回', 'menu')])
    await respond(ctx, `当前模式：${current || '未知'}\n请选择要切换的工作模式：`, makeKeyboard(rows))
  }

  const switchMode = async (ctx, value) => {
    const mode = MODES.find((item) => item.key === value)
    if (!mode) {
      await showModes(ctx)
      return
    }
    await Plugins.handleChangeMode(mode.key)
    await respond(ctx, `已切换到${mode.label}模式 (${mode.key})`, makeKeyboard([[makeButton('返回', 'menu')]]))
  }

  const coreAction = (value) => {
    if (value === 'start' || value === 's') {
      return 's'
    }
    if (value === 'stop' || value === 'x') {
      return 'x'
    }
    if (value === 'restart' || value === 'r') {
      return 'r'
    }
    return undefined
  }

  const handleCore = async (ctx, value) => {
    const action = coreAction(value)
    if (!action) {
      const { running } = Plugins.useKernelApiStore()
      await respond(
        ctx,
        `内核当前${running ? '运行中' : '已停止'}`,
        makeKeyboard([[makeButton('启动', 'core:s'), makeButton('停止', 'core:x'), makeButton('重启', 'core:r')], [makeButton('返回', 'menu')]])
      )
      return
    }
    const kernel = Plugins.useKernelApiStore()
    if (action === 's') {
      if (!kernel.running) {
        await kernel.startCore()
      }
    } else if (action === 'x') {
      if (kernel.running) {
        await kernel.stopCore()
      }
    } else {
      await kernel.restartCore()
    }
    let verb = '重启'
    if (action === 's') {
      verb = '启动'
    } else if (action === 'x') {
      verb = '停止'
    }
    await respond(ctx, `内核已${verb}`, makeKeyboard([[makeButton('返回', 'menu')]]))
  }

  const showProfiles = async (ctx) => {
    const profiles = Plugins.useProfilesStore().profiles
    if (profiles.length === 0) {
      await respond(ctx, '暂无可用配置')
      return
    }
    const current = getAppKernelSettings().profile
    const rows = profiles.map((profile, index) => [makeButton(`${profile.id === current ? '✅ ' : ''}${profile.name}`, `pf:${index}`)])
    rows.push([makeButton('返回', 'menu')])
    await respond(ctx, `配置列表（共 ${profiles.length} 个，点击切换）：`, makeKeyboard(rows))
  }

  const switchProfile = async (ctx, index) => {
    const profiles = Plugins.useProfilesStore().profiles
    const profile = profiles[index]
    if (!profile) {
      await respond(ctx, '该配置已不存在，请重新打开列表')
      return
    }
    const settings = Plugins.useAppSettingsStore().app
    const kernel = Plugins.useKernelApiStore()
    if (settings.kernel.profile === profile.id) {
      await respond(ctx, `当前已是该配置：${profile.name}`)
      return
    }
    const wasRunning = kernel.running
    settings.kernel.profile = profile.id
    if (wasRunning) {
      await kernel.restartCore()
    }
    await respond(ctx, `已切换到配置：${profile.name}${wasRunning ? '（内核已重启）' : ''}`, makeKeyboard([[makeButton('返回', 'menu')]]))
  }

  const getSendConfig = () => {
    const config = state.running && lastConfig ? lastConfig : readConfig()
    if (!config.BotToken) {
      Plugins.message.warn('请先配置 Telegram 机器人 Token')
      return undefined
    }
    if (!BOT_TOKEN_PATTERN.test(config.BotToken)) {
      Plugins.message.warn('Bot Token 格式不正确，请检查配置')
      return undefined
    }
    if (config.AllowedUserIds.length === 0) {
      Plugins.message.warn('请先配置至少一个管理员用户 ID')
      return undefined
    }
    return config
  }

  const sendTextToAdmins = async (text, label) => {
    const config = getSendConfig()
    if (!config) {
      return
    }
    const api = createTelegramApi(config.BotToken, cacheDir)
    let failed = 0
    let lastError = ''
    for (const chatId of config.AllowedUserIds) {
      try {
        await api.sendMessage(chatId, text)
      } catch (error) {
        failed += 1
        lastError = friendlyError(error)
      }
    }
    const delivered = config.AllowedUserIds.length - failed
    if (failed === 0) {
      Plugins.message.success(`${label}已发送给 ${delivered} 位管理员`)
      return
    }
    if (delivered > 0) {
      Plugins.message.warn(`${label}部分发送失败：成功 ${delivered} 位，失败 ${failed} 位（${lastError}）`)
      return
    }
    Plugins.message.error(`${label}发送失败：${lastError}`)
  }

  const sendDocumentToAdmins = async (content, fileName, caption, label) => {
    const config = getSendConfig()
    if (!config) {
      return
    }
    const api = createTelegramApi(config.BotToken, cacheDir)
    let failed = 0
    let lastError = ''
    for (const chatId of config.AllowedUserIds) {
      try {
        await api.sendDocument(chatId, content, fileName, caption)
      } catch (error) {
        failed += 1
        lastError = friendlyError(error)
      }
    }
    const delivered = config.AllowedUserIds.length - failed
    if (failed === 0) {
      Plugins.message.success(`${label}已发送给 ${delivered} 位管理员`)
      return
    }
    if (delivered > 0) {
      Plugins.message.warn(`${label}部分发送失败：成功 ${delivered} 位，失败 ${failed} 位（${lastError}）`)
      return
    }
    Plugins.message.error(`${label}发送失败：${lastError}`)
  }

  const contextCaption = (label, name) =>
    truncate(`${label}：${name}\n客户端：${Plugins.APP_TITLE}\n时间：${Plugins.formatDate(Date.now(), 'YYYY-MM-DD HH:mm:ss')}`, 1000)

  const generateProfileConfig = async (profile) => {
    const generate = Plugins.generateConfig
    const config = await generate(profile)
    return config && typeof config === 'object' ? config : {}
  }

  const buildProfileConfig = async (profile) => {
    const config = await generateProfileConfig(profile)
    const baseName = safeFileName(profile.name, profile.id || 'profile')
    if (isSingBox()) {
      const header = `DO NOT EDIT - Generated by ${Plugins.APP_TITLE}`
      return {
        content: JSON.stringify({ $schema: header, ...config }, null, 2),
        fileName: `${baseName}.json`
      }
    }
    const header = `# DO NOT EDIT - Generated by ${Plugins.APP_TITLE}\n`
    return {
      content: header + Plugins.stringifyNoFolding(config),
      fileName: `${baseName}.yaml`
    }
  }

  const buildProfileSummary = async (profile) => {
    const config = await generateProfileConfig(profile)
    const lines = [`配置：${profile.name}`, `客户端：${Plugins.APP_TITLE}`, '']
    if (isSingBox()) {
      const outbounds = Array.isArray(config['outbounds']) ? config['outbounds'] : []
      const groups = outbounds.filter((item) => isSelectableType(toText(item['type'])))
      const route = config['route']
      lines.push(
        `出站：${outbounds.length}`,
        `代理组：${groups.length}`,
        `入站：${countItems(config['inbounds'])}`,
        `路由规则：${countItems(route?.['rules'])}`,
        `DNS 服务器：${countItems(config['dns']?.['servers'])}`
      )
    } else {
      lines.push(
        `代理：${countItems(config['proxies'])}`,
        `代理组：${countItems(config['proxy-groups'])}`,
        `规则：${countItems(config['rules'])}`,
        `监听端口：${toText(config['mixed-port']) || '未设置'}`
      )
    }
    lines.push(`配置 ID：${profile.id}`)
    return lines.join('\n')
  }

  const readSubscriptionNodes = async (subscription) => {
    const path = toText(subscription.path).trim()
    if (!path) {
      throw new Error('该订阅没有可用的节点文件路径，请先更新订阅')
    }
    const content = await Plugins.ReadFile(path)
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('节点文件为空，请先更新订阅')
    }
    const extension = fileExtension(path, isSingBox() ? '.json' : '.yaml')
    const baseName = safeFileName(subscription.name, subscription.id || 'subscription')
    return { content, fileName: `${baseName}-nodes${extension}` }
  }

  const SendProfileConfig = async (profile) => {
    if (!profile?.name) {
      Plugins.message.warn('配置信息无效')
      return
    }
    try {
      const { content, fileName } = await buildProfileConfig(profile)
      await sendDocumentToAdmins(content, fileName, contextCaption('配置文件', profile.name), '配置文件')
    } catch (error) {
      Plugins.message.error(`生成配置文件失败：${friendlyError(error)}`)
    }
  }

  const SendProfileSummary = async (profile) => {
    if (!profile?.name) {
      Plugins.message.warn('配置信息无效')
      return
    }
    try {
      const summary = await buildProfileSummary(profile)
      await sendTextToAdmins(summary, '配置摘要')
    } catch (error) {
      Plugins.message.error(`生成配置摘要失败：${friendlyError(error)}`)
    }
  }

  const SendSubscriptionNodes = async (subscription) => {
    if (!subscription?.name) {
      Plugins.message.warn('订阅信息无效')
      return
    }
    try {
      const { content, fileName } = await readSubscriptionNodes(subscription)
      await sendDocumentToAdmins(content, fileName, contextCaption('订阅节点', subscription.name), '节点文件')
    } catch (error) {
      Plugins.message.error(`发送节点文件失败：${friendlyError(error)}`)
    }
  }

  const SendSubscriptionInfo = async (subscription) => {
    if (!subscription?.name) {
      Plugins.message.warn('订阅信息无效')
      return
    }
    const used = (typeof subscription.upload === 'number' ? subscription.upload : 0) + (typeof subscription.download === 'number' ? subscription.download : 0)
    const lines = [
      `订阅：${subscription.name}`,
      `类型：${toText(subscription.type) || '未知'}`,
      `节点数：${Array.isArray(subscription.proxies) ? subscription.proxies.length : '未知'}`,
      `流量：${formatBytes(used)} / ${subscription.total ? formatBytes(subscription.total) : '不限'}`,
      `到期：${subscription.expire ? formatTime(subscription.expire) : '长期或未知'}`,
      `更新时间：${formatTime(subscription.updateTime ?? 0)}`,
      `订阅 ID：${subscription.id}`
    ]
    await sendTextToAdmins(lines.join('\n'), '订阅信息')
  }

  const showProxyGroups = async (ctx, page = 0) => {
    const groups = getProxyGroups()
    if (groups.length === 0) {
      await respond(ctx, '暂无可用代理组')
      return
    }
    const current = safePage(page, groups.length)
    const startIndex = current * PAGE_SIZE
    const slice = groups.slice(startIndex, startIndex + PAGE_SIZE)
    const rows = slice.map((group, index) => [makeButton(`${group.name} → ${group.now || '未选择'}`, `pxg:${startIndex + index}:0`)])
    const pager = paginationRow('px', current, groups.length)
    if (pager.length > 0) {
      rows.push(pager)
    }
    rows.push([makeButton('返回', 'menu')])
    await respond(ctx, `代理组（${current + 1}/${totalPages(groups.length)}）：`, makeKeyboard(rows))
  }

  const showGroupProxies = async (ctx, groupIndex, page = 0) => {
    const groups = getProxyGroups()
    const group = groups[groupIndex]
    if (!group?.all?.length) {
      await respond(ctx, '该代理组已不存在或没有可选节点')
      return
    }
    const nodes = group.all
    const current = safePage(page, nodes.length)
    const startIndex = current * PAGE_SIZE
    const slice = nodes.slice(startIndex, startIndex + PAGE_SIZE)
    const proxies = getProxyMap()
    const rows = slice.map((name, index) => [
      makeButton(`${name === group.now ? '✅ ' : ''}${name}${formatDelay(proxies[name])}`, `pxp:${groupIndex}:${startIndex + index}`)
    ])
    const pager = paginationRow(`pxg:${groupIndex}`, current, nodes.length)
    if (pager.length > 0) {
      rows.push(pager)
    }
    rows.push([makeButton('返回代理组', `px:${Math.floor(groupIndex / PAGE_SIZE)}`)])
    await respond(ctx, `代理组：${group.name}\n当前：${group.now || '未选择'}\n节点（${current + 1}/${totalPages(nodes.length)}）：`, makeKeyboard(rows))
  }

  const selectProxy = async (ctx, groupIndex, nodeIndex) => {
    const groups = getProxyGroups()
    const group = groups[groupIndex]
    const name = group?.all?.[nodeIndex]
    if (!group || !name) {
      await respond(ctx, '该节点已不存在，请重新打开代理组')
      return
    }
    const target = getProxyMap()[name]
    if (!target) {
      await respond(ctx, '该节点已不存在，请重新打开代理组')
      return
    }
    await Plugins.handleUseProxy(group, target)
    await showGroupProxies(ctx, groupIndex, 0)
  }

  const getResourceItems = (type) => {
    if (type === 'sub') {
      return Plugins.useSubscribesStore().subscribes
    }
    return Plugins.useRulesetsStore().rulesets
  }

  const resourceTitle = (type) => (type === 'sub' ? '订阅' : '规则集')

  const showResourceList = async (ctx, type, page = 0) => {
    const items = getResourceItems(type)
    const title = resourceTitle(type)
    if (items.length === 0) {
      await respond(ctx, `暂无${title}`)
      return
    }
    const current = safePage(page, items.length)
    const startIndex = current * PAGE_SIZE
    const slice = items.slice(startIndex, startIndex + PAGE_SIZE)
    const rows = slice.flatMap((item, index) => {
      const number = startIndex + index
      const detail = [item.disabled ? '已禁用' : '', item.updateTime ? `更新于 ${formatTime(item.updateTime)}` : ''].filter(Boolean).join(' · ')
      return [[makeButton(`${item.name}${detail ? `（${detail}）` : ''}`, `${type}:u:${number}`)]]
    })
    const pager = paginationRow(type, current, items.length)
    if (pager.length > 0) {
      rows.push(pager)
    }
    rows.push([makeButton(`全部更新`, `${type}:ua`), makeButton('返回', 'menu')])
    await respond(ctx, `${title}（${current + 1}/${totalPages(items.length)}，点击条目立即更新）：`, makeKeyboard(rows))
  }

  const updateResource = async (ctx, type, index) => {
    const items = getResourceItems(type)
    const item = items[index]
    if (!item) {
      await respond(ctx, '该条目已不存在，请重新打开列表')
      return
    }
    await respond(ctx, `正在更新${resourceTitle(type)}：${item.name} ...`)
    if (type === 'sub') {
      await Plugins.useSubscribesStore().updateSubscribe(item.id)
    } else {
      await Plugins.useRulesetsStore().updateRuleset(item.id)
    }
    await respond(ctx, `${resourceTitle(type)} ${item.name} 更新完成`)
  }

  const updateAllResources = async (ctx, type) => {
    await respond(ctx, `正在更新全部${resourceTitle(type)} ...`)
    if (type === 'sub') {
      await Plugins.useSubscribesStore().updateSubscribes()
    } else {
      await Plugins.useRulesetsStore().updateRulesets()
    }
    await respond(ctx, `全部${resourceTitle(type)}更新完成`)
  }

  const getPluginItems = () => Plugins.usePluginsStore().plugins

  const showPluginList = async (ctx, page = 0) => {
    const items = getPluginItems()
    if (items.length === 0) {
      await respond(ctx, '暂无插件')
      return
    }
    const current = safePage(page, items.length)
    const startIndex = current * PAGE_SIZE
    const slice = items.slice(startIndex, startIndex + PAGE_SIZE)
    const rows = slice.map((item, index) => {
      const number = startIndex + index
      const row = [makeButton(`运行 ${item.name}`, `pl:r:${number}`)]
      if (item.id !== plugin.id) {
        row.push(makeButton('更新', `pl:u:${number}`))
      }
      return row
    })
    const pager = paginationRow('pl', current, items.length)
    if (pager.length > 0) {
      rows.push(pager)
    }
    rows.push([makeButton('全部更新', 'pl:ua'), makeButton('返回', 'menu')])
    await respond(ctx, `插件（${current + 1}/${totalPages(items.length)}）：\n运行按钮会触发插件的 onRun，更新会重新下载插件源。`, makeKeyboard(rows))
  }

  const runPlugin = async (ctx, index) => {
    const item = getPluginItems()[index]
    if (!item) {
      await respond(ctx, '该插件已不存在，请重新打开列表')
      return
    }
    if (item.id === plugin.id) {
      await respond(ctx, '不能通过机器人运行当前插件自身')
      return
    }
    const pluginsStore = Plugins.usePluginsStore()
    await pluginsStore.manualTrigger(item.id, 'onRun')
    await respond(ctx, `插件 ${item.name} 已执行`)
  }

  const updatePlugin = async (ctx, index) => {
    const item = getPluginItems()[index]
    if (!item) {
      await respond(ctx, '该插件已不存在，请重新打开列表')
      return
    }
    if (item.id === plugin.id) {
      await respond(ctx, '不能通过机器人更新当前插件自身')
      return
    }
    await respond(ctx, `正在更新插件：${item.name} ...`)
    await Plugins.usePluginsStore().updatePlugin(item.id)
    await respond(ctx, `插件 ${item.name} 更新完成`)
  }

  const updateAllPlugins = async (ctx) => {
    const items = getPluginItems().filter((item) => item.id !== plugin.id)
    if (items.length === 0) {
      await respond(ctx, '没有需要更新的插件')
      return
    }
    await respond(ctx, `正在更新 ${items.length} 个插件 ...`)
    const results = await Promise.allSettled(items.map((item) => Plugins.usePluginsStore().updatePlugin(item.id)))
    const failed = results.filter((item) => item.status === 'rejected').length
    await respond(ctx, `插件更新完成：成功 ${items.length - failed} 个，失败 ${failed} 个`)
  }

  const showTaskList = async (ctx, page = 0) => {
    const items = Plugins.useScheduledTasksStore().scheduledtasks
    if (items.length === 0) {
      await respond(ctx, '暂无计划任务')
      return
    }
    const current = safePage(page, items.length)
    const startIndex = current * PAGE_SIZE
    const slice = items.slice(startIndex, startIndex + PAGE_SIZE)
    const rows = slice.map((item, index) => {
      const number = startIndex + index
      return [makeButton(`运行 ${item.name}`, `tk:r:${number}`)]
    })
    const pager = paginationRow('tk', current, items.length)
    if (pager.length > 0) {
      rows.push(pager)
    }
    rows.push([makeButton('返回', 'menu')])
    await respond(ctx, `计划任务（${current + 1}/${totalPages(items.length)}）：`, makeKeyboard(rows))
  }

  const runTask = async (ctx, index) => {
    const items = Plugins.useScheduledTasksStore().scheduledtasks
    const item = items[index]
    if (!item) {
      await respond(ctx, '该计划任务已不存在，请重新打开列表')
      return
    }
    await respond(ctx, `正在运行计划任务：${item.name} ...`)
    await Plugins.useScheduledTasksStore().runScheduledTask(item.id)
    await respond(ctx, `计划任务 ${item.name} 已执行`)
  }

  const showSystemProxy = async (ctx, action) => {
    if (action !== 'on' && action !== 'off') {
      const server = await Plugins.GetSystemProxy().catch(() => '')
      await respond(
        ctx,
        `系统代理当前${server ? `已开启（${server}）` : '已关闭'}`,
        makeKeyboard([[makeButton('开启', 'sp:on'), makeButton('关闭', 'sp:off')], [makeButton('返回', 'menu')]])
      )
      return
    }
    const enable = action === 'on'
    try {
      await Plugins.useEnvStore().switchSystemProxy(enable)
      await respond(ctx, `系统代理已${enable ? '开启' : '关闭'}`)
    } catch (error) {
      await respond(ctx, `系统代理设置失败：${friendlyError(error)}`)
    }
  }

  const showTun = async (ctx, action) => {
    const config = getKernelConfig()
    const enabled = Boolean(config.tun?.enable)
    if (action !== 'on' && action !== 'off') {
      await respond(
        ctx,
        `TUN 当前${enabled ? '已开启' : '已关闭'}`,
        makeKeyboard([[makeButton('开启', 'tun:on'), makeButton('关闭', 'tun:off')], [makeButton('返回', 'menu')]])
      )
      return
    }
    const enable = action === 'on'
    try {
      const tun = { ...config.tun, enable }
      if (isSingBox()) {
        await updateKernelConfig('tun', tun)
      } else {
        await updateKernelConfig({ tun })
      }
      await respond(ctx, `TUN 已${enable ? '开启' : '关闭'}（内核可能已重启）`)
    } catch (error) {
      await respond(ctx, `TUN 设置失败：${friendlyError(error)}`)
    }
  }

  const showLogs = async (ctx) => {
    const count = logCollector.getLogs().length
    await respond(
      ctx,
      `已收集 ${count} 条内核日志：`,
      makeKeyboard([[makeButton('下载日志文件', 'log:file'), makeButton('查看最近日志', 'log:text')], [makeButton('返回', 'menu')]])
    )
  }

  const sendLogFile = async (ctx) => {
    const logs = logCollector.getLogs()
    if (logs.length === 0) {
      await respond(ctx, '暂无日志')
      return
    }
    const fileName = `${isSingBox() ? 'sing-box' : 'mihomo'}_${Plugins.formatDate(Date.now(), 'YYYY-MM-DD_HH-mm-ss')}.log`
    try {
      await ctx.replyDocument(formatLogs(logs), fileName)
    } catch (error) {
      await ctx.reply(`日志上传失败：${getErrorMessage(error)}\n\n${formatLogs(logs.slice(-30))}`)
    }
  }

  const sendLogText = async (ctx) => {
    const logs = logCollector.getLogs()
    if (logs.length === 0) {
      await respond(ctx, '暂无日志')
      return
    }
    await ctx.reply(`最近 ${Math.min(logs.length, 40)} 条日志：\n\n${formatLogs(logs.slice(-40))}`)
  }

  const showId = async (ctx) => {
    await ctx.reply(
      [
        `用户 ID：${ctx.user.id}`,
        `Chat ID：${ctx.chat.id}`,
        `Bot：${state.botUsername ? `@${state.botUsername}` : '未知'}`,
        '',
        '把用户 ID 填入插件配置的「管理员用户 ID」即可获得控制权限。'
      ].join('\n')
    )
  }

  const handleMessage = async (ctx) => {
    const { command } = ctx
    if (!command) {
      if (ctx.text.trim()) {
        await ctx.reply('发送 /help 查看可用命令')
      }
      return
    }
    const [rawAction, ...rest] = command.args
    const action = rawAction?.toLowerCase()
    const target = rest.join(' ').trim() || undefined
    switch (command.name) {
      case 'start':
      case 'menu': {
        await showOverview(ctx)
        break
      }
      case 'help': {
        await ctx.reply(HELP_TEXT)
        break
      }
      case 'id': {
        await showId(ctx)
        break
      }
      case 'core': {
        await handleCore(ctx, action)
        break
      }
      case 'mode': {
        if (action) {
          await switchMode(ctx, action)
        } else {
          await showModes(ctx)
        }
        break
      }
      case 'profile': {
        const profileTarget = command.args.join(' ').trim() || undefined
        if (profileTarget) {
          const profiles = Plugins.useProfilesStore().profiles
          const profile = resolveByTarget(profiles, profileTarget)
          if (!profile) {
            await respond(ctx, '未找到该配置，请发送 /profile 查看列表')
            break
          }
          await switchProfile(ctx, profiles.indexOf(profile))
        } else {
          await showProfiles(ctx)
        }
        break
      }
      case 'proxy': {
        if (!action) {
          await showProxyGroups(ctx, 0)
          break
        }
        const groups = getProxyGroups()
        const index = Number(action)
        const found = Number.isInteger(index) && index >= 1 ? index - 1 : groups.findIndex((group) => group.name.toLowerCase() === action.toLowerCase())
        if (found >= 0 && found < groups.length) {
          await showGroupProxies(ctx, found, 0)
        } else {
          await showProxyGroups(ctx, 0)
        }
        break
      }
      case 'sub':
      case 'rule': {
        const type = command.name === 'sub' ? 'sub' : 'rs'
        if (action === 'update' || action === 'u') {
          const items = getResourceItems(type)
          const item = resolveByTarget(items, target)
          if (!item) {
            await respond(ctx, '未找到该条目，请先发送列表命令')
            break
          }
          await updateResource(ctx, type, items.indexOf(item))
        } else if (action === 'updateall' || action === 'ua') {
          await updateAllResources(ctx, type)
        } else {
          await showResourceList(ctx, type, 0)
        }
        break
      }
      case 'plugin': {
        if (action === 'run' || action === 'r') {
          const items = getPluginItems()
          const item = resolveByTarget(
            items.map((entry) => ({ ...entry, name: entry.name })),
            target
          )
          if (!item) {
            await respond(ctx, '未找到该插件，请先发送 /plugin')
            break
          }
          await runPlugin(ctx, items.indexOf(item))
        } else if (action === 'update' || action === 'u') {
          const items = getPluginItems()
          const item = resolveByTarget(
            items.map((entry) => ({ ...entry, name: entry.name })),
            target
          )
          if (!item) {
            await respond(ctx, '未找到该插件，请先发送 /plugin')
            break
          }
          await updatePlugin(ctx, items.indexOf(item))
        } else if (action === 'updateall' || action === 'ua') {
          await updateAllPlugins(ctx)
        } else {
          await showPluginList(ctx, 0)
        }
        break
      }
      case 'task': {
        if (action === 'run' || action === 'r') {
          const items = Plugins.useScheduledTasksStore().scheduledtasks
          const item = resolveByTarget(items, target)
          if (!item) {
            await respond(ctx, '未找到该计划任务，请先发送 /task')
            break
          }
          await runTask(ctx, items.indexOf(item))
        } else {
          await showTaskList(ctx, 0)
        }
        break
      }
      case 'sysproxy': {
        await showSystemProxy(ctx, action)
        break
      }
      case 'tun': {
        await showTun(ctx, action)
        break
      }
      case 'logs': {
        if (action === 'file') {
          await sendLogFile(ctx)
        } else if (action === 'text') {
          await sendLogText(ctx)
        } else {
          await showLogs(ctx)
        }
        break
      }
      default: {
        await ctx.reply('未知命令，发送 /help 查看可用命令')
      }
    }
  }

  const handleCallback = async (ctx) => {
    await ctx.answer().catch(() => undefined)
    const data = ctx.callbackData
    if (!data) {
      return
    }
    const [root = '', first, second] = data.split(':')
    switch (root) {
      case 'menu': {
        await showOverview(ctx)
        break
      }
      case 'mode': {
        if (first) {
          await switchMode(ctx, first)
        } else {
          await showModes(ctx)
        }
        break
      }
      case 'core': {
        await handleCore(ctx, first)
        break
      }
      case 'pf': {
        if (first === undefined || first === '') {
          await showProfiles(ctx)
        } else {
          await switchProfile(ctx, Number(first))
        }
        break
      }
      case 'px': {
        await showProxyGroups(ctx, Number(first ?? '0'))
        break
      }
      case 'pxg': {
        await showGroupProxies(ctx, Number(first), Number(second ?? '0'))
        break
      }
      case 'pxp': {
        await selectProxy(ctx, Number(first), Number(second))
        break
      }
      case 'sub':
      case 'rs': {
        const type = root === 'sub' ? 'sub' : 'rs'
        if (first === 'u') {
          await updateResource(ctx, type, Number(second))
        } else if (first === 'ua') {
          await updateAllResources(ctx, type)
        } else {
          await showResourceList(ctx, type, Number(first ?? '0'))
        }
        break
      }
      case 'pl': {
        if (first === 'r') {
          await runPlugin(ctx, Number(second))
        } else if (first === 'u') {
          await updatePlugin(ctx, Number(second))
        } else if (first === 'ua') {
          await updateAllPlugins(ctx)
        } else {
          await showPluginList(ctx, Number(first ?? '0'))
        }
        break
      }
      case 'tk': {
        if (first === 'r') {
          await runTask(ctx, Number(second))
        } else {
          await showTaskList(ctx, Number(first ?? '0'))
        }
        break
      }
      case 'sp': {
        await showSystemProxy(ctx, first)
        break
      }
      case 'tun': {
        await showTun(ctx, first)
        break
      }
      case 'log': {
        if (first === 'file') {
          await sendLogFile(ctx)
        } else if (first === 'text') {
          await sendLogText(ctx)
        } else {
          await showLogs(ctx)
        }
        break
      }
      case 'noop': {
        break
      }
      default: {
        await ctx.edit('未知操作，请发送 /menu 重新开始')
      }
    }
  }

  const openPanel = () => {
    const { defineComponent, ref, computed, onMounted } = Vue
    const config = readConfig()
    const invalid = validateConfig(config)
    const hint = invalid ?? (config.AllowedUserIds.length === 0 ? '尚未配置管理员：启动后向机器人发送 /id 获取用户 ID，再填入插件配置。' : '')

    const Panel = defineComponent({
      template: `
        <div class="flex flex-col gap-8">
          <Card title="运行状态">
            <template #extra>
              <Tag :color="state.running ? 'green' : 'default'">
                {{ state.running ? '运行中' : '已停止' }}
              </Tag>
            </template>
            <div class="px-8 py-12 flex items-center justify-between">
              <div class="text-16 font-bold">
                Telegram 机器人
                <span class="font-normal text-12">
                  {{ state.botUsername ? '@' + state.botUsername : '未连接' }}
                </span>
              </div>
              <div class="flex items-center gap-8">
                <Button
                  type="primary"
                  :loading="state.starting"
                  :disabled="state.running"
                  @click="startService"
                >
                  启动
                </Button>
                <Button :disabled="!state.running" @click="stopService">
                  停止
                </Button>
                <Button type="text" icon="refresh" @click="refresh">
                  刷新
                </Button>
              </div>
            </div>
            <div class="px-8 py-12 flex items-center justify-between">
              <div class="text-16 font-bold">工作模式</div>
              <div>{{ workModeLabel }}</div>
            </div>
            <div class="px-8 py-12 flex items-center justify-between">
              <div class="text-16 font-bold">管理员</div>
              <div>{{ config.AllowedUserIds.join(', ') || '未配置' }}</div>
            </div>
            <div class="px-8 py-12 flex items-center justify-between">
              <div class="text-16 font-bold">内核</div>
              <div>{{ kernel.running ? '运行中' : '已停止' }}</div>
            </div>
            <div class="px-8 py-12 flex items-center justify-between">
              <div class="text-16 font-bold">系统代理</div>
              <div>{{ systemProxyOn ? '已开启' : '已关闭' }}</div>
            </div>
            <div class="px-8 py-12 flex items-center justify-between">
              <div class="text-16 font-bold">TUN</div>
              <div>{{ tunEnabled ? '已开启' : '已关闭' }}</div>
            </div>
            <div v-if="state.botUsername" class="px-8 py-12 flex justify-end">
              <Button type="link" @click="openChat">打开 Telegram 对话</Button>
            </div>
          </Card>

          <Card v-if="state.lastError || hint" title="配置提示">
            <div class="px-8 py-12" style="color: var(--level-4-color)">
              {{ state.lastError || hint }}
            </div>
          </Card>

          <Card title="常用命令">
            <div
              v-for="item in commands"
              :key="item.command"
              class="px-8 py-12 flex items-center justify-between"
            >
              <div class="text-16 font-bold">/{{ item.command }}</div>
              <span class="font-normal text-12">{{ item.description }}</span>
            </div>
          </Card>
        </div>`,

      setup() {
        const kernel = Plugins.useKernelApiStore()
        const env = Plugins.useEnvStore()
        const systemProxyOn = ref(env.systemProxy)
        const tunEnabled = ref(Boolean(getKernelConfig().tun?.enable))
        const workModeLabel = computed(() => (readConfig().WorkMode === WORK_MODE.WEBHOOK ? 'Webhook' : '长轮询'))

        const refresh = async () => {
          const server = await Plugins.GetSystemProxy().catch(() => '')
          systemProxyOn.value = Boolean(server)
          tunEnabled.value = Boolean(getKernelConfig().tun?.enable)
        }

        const startService = async () => {
          const status = await start({ config: readConfig(), silent: false })
          if (status === 1) {
            await refresh()
          }
        }

        const stopService = async () => {
          await shutdown(false)
        }

        const openChat = () => {
          if (!state.botUsername) {
            return
          }
          void Plugins.OpenURI(`https://t.me/${state.botUsername}`)
        }

        onMounted(refresh)

        return {
          state,
          config,
          hint,
          kernel,
          commands: PANEL_COMMANDS,
          systemProxyOn,
          tunEnabled,
          workModeLabel,
          refresh,
          startService,
          stopService,
          openChat
        }
      }
    })

    const modal = Plugins.modal(
      {
        title: plugin.name,
        width: '70',
        height: '70',
        submit: false,
        cancel: true,
        cancelText: 'common.close'
      },
      {}
    )
    modal.setContent(Panel)
    modal.open()
  }

  /* 触发器 手动触发 */
  const onRun = async () => {
    const config = readConfig()
    const invalid = validateConfig(config)
    if (invalid) {
      setError(invalid)
      Plugins.message.warn(invalid)
      openPanel()
      return 2
    }
    const status = await start({ config })
    openPanel()
    return status
  }

  /* 触发器 APP就绪后 */
  const onReady = async () => {
    const config = readConfig()
    if (!config.AutoStart) {
      return
    }
    return start({ config, silent: true })
  }

  /* 触发器 插件任务 */
  const onTask = async () => {
    const config = readConfig()
    if (state.running) {
      return 1
    }
    return start({ config, silent: true })
  }

  /* 触发器 核心启动后 */
  const onCoreStarted = () => {
    if (!state.running) {
      return
    }
    logCollector.attach()
  }

  /* 触发器 核心停止后 */
  const onCoreStopped = () => {
    logCollector.detach()
  }

  /* 触发器 配置更新时 */
  const onConfigure = async (config, _old) => {
    const next = readConfig(config)
    const nextKey = serviceKey(next)
    if (bot && nextKey !== appliedKey) {
      await stop(true)
      const status = await start({ config: next, silent: true })
      if (status !== 1) {
        Plugins.message.error(`${plugin.name} 重启失败：${state.lastError || '未知错误'}`)
      }
    }
    return 0
  }

  /* 触发器 插件销毁时 */
  const onDispose = async () => shutdown(true)

  /* 触发器 卸载插件时 */
  const onUninstall = async () => {
    const token = lastConfig?.BotToken || readConfig().BotToken
    await shutdown(true)
    await Plugins.ignoredError(Plugins.StopServer, plugin.id)
    if (token) {
      await createTelegramApi(token, cacheDir)
        .deleteWebhook(true)
        .catch(() => undefined)
    }
    await Plugins.ignoredError(Plugins.RemoveFile, cacheDir)
    return 0
  }

  const Start = async () => start({ config: readConfig() })

  const Stop = async () => shutdown(false)

  const OpenPanel = () => {
    openPanel()
    return 0
  }

  return {
    onRun,
    onReady,
    onTask,
    onCoreStarted,
    onCoreStopped,
    onConfigure,
    onDispose,
    onUninstall,
    Start,
    Stop,
    OpenPanel,
    SendProfileConfig,
    SendProfileSummary,
    SendSubscriptionNodes,
    SendSubscriptionInfo
  }
}
