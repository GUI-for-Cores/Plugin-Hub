/**
 * MCP Server for GUI.for.Cores（GFC/GFS）v1.0.0
 * 把 RESTful-Api v1 的业务能力映射为 MCP tools。
 * 传输：Plugins.StartServer，JSON-only Streamable HTTP，/mcp，协议 2025-06-18，无 session。
 * 扩展：业务工具写在 tools；共享辅助方法写在 Utils 并用 Utils.xxx 调用。
 */

/** @type {EsmPlugin} */
export default (Plugin) => {
  const PROTOCOL = '2025-06-18'
  const JSON_HEADERS = { 'Content-Type': 'application/json' }
  const MMDB_DIR = 'data/.cache/mmdbs'
  const MMDB_CONFIG = 'data/.cache/mmdbs_config.json'
  const MMDB_TYPES = ['ASN', 'AnonymousIP', 'City', 'ConnectionType', 'Country', 'Domain', 'Enterprise']
  const SECRET_KEY = /pass|secret|token|auth|uuid|psk|private|cert|^key$|authorization|cookie|script|^header$/i
  const CORE_MODES = ['direct', 'global', 'rule']
  const METHOD_NAME = /^[A-Za-z_]\w*$/
  const ro = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  const wr = { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  const dest = { readOnlyHint: false, destructiveHint: true, openWorldHint: false }

  let runtimeToken = ''
  let mmdbs = []

  /**
   * 通用辅助方法。新增共享逻辑放这里；业务工具写在 tools，协议分发与生命周期保持在下方。
   * 方法互调用一律写 Utils.xxx，不要依赖 this，以便解构后也能安全调用。
   */
  const Utils = {
    /**
     * 把返回值包成 MCP text content 数组。
     * @param {*} value 字符串原样放入，其它值 JSON 格式化
     * @returns {{type:'text', text:string}[]}
     */
    text(value) {
      return [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
    },
    /**
     * 构造成功的 tools/call 结果。
     * @param {*} value 放入 content
     * @returns {{content: object[], isError: false}}
     */
    okText(value) {
      return { content: Utils.text(value), isError: false }
    },
    /**
     * 构造失败的 tools/call 结果（isError: true）。
     * @param {Error|string} error
     * @returns {{content: object[], isError: true}}
     */
    failText(error) {
      return { content: Utils.text(error?.message || error), isError: true }
    },
    /**
     * 构造 JSON-RPC 成功响应对象。
     * @param {string|number} id
     * @param {*} result
     */
    ok(id, result) {
      return { jsonrpc: '2.0', id, result }
    },
    /**
     * 构造 JSON-RPC 错误响应对象。
     * @param {string|number|null} id
     * @param {number} code
     * @param {string} message
     */
    fail(id, code, message) {
      return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
    },
    /**
     * 是否为普通对象（非数组、非 null）。
     * @param {*} value
     * @returns {boolean}
     */
    isPlainObject(value) {
      return !!value && typeof value === 'object' && !Array.isArray(value)
    },
    /**
     * 当前宿主是否为 GUI.for.Clash。
     * @returns {boolean}
     */
    isClash() {
      return String(Plugins.APP_TITLE || '').includes('Clash')
    },
    /**
     * 读取配置中的监听地址，缺省为 127.0.0.1:8765。原样返回，不改写。
     * @returns {string}
     */
    address() {
      return String(Plugin.Address || '127.0.0.1:8765').trim() || '127.0.0.1:8765'
    },
    /**
     * 由 Address 构造 http 基址。IPv6 需写成 [host]:port，例如 [::1]:8765。
     * @returns {string}
     */
    httpBase() {
      return 'http://' + Utils.address()
    },
    /**
     * MCP Streamable HTTP 完整 URL（不含令牌）。
     * @returns {string}
     */
    endpoint() {
      return Utils.httpBase() + '/mcp'
    },
    /**
     * 该插件的 HTTP 服务是否已在运行。
     * @returns {Promise<boolean>}
     */
    async isRunning() {
      return (await Plugins.ListServer()).includes(Plugin.id)
    },
    /**
     * 读取插件开关（兼容布尔值与字符串 'true'）。
     * @param {string} key 配置键
     * @returns {boolean}
     */
    flagOn(key) {
      return Plugin[key] === true || Plugin[key] === 'true'
    },
    /**
     * 开关未开启则抛出中文提示，供写操作/核心/代理等门控使用。
     * @param {string} key 配置键
     * @param {string} label 错误信息里的开关名
     */
    assertFlag(key, label) {
      if (!Utils.flagOn(key)) throw '已禁用：' + label + '。在插件配置中打开后再试。'
    },
    /**
     * 从 Address 解析监听主机名；非法则回退 127.0.0.1。
     * @returns {string}
     */
    listenHostname() {
      try {
        return new URL(Utils.httpBase()).hostname
      } catch {
        return '127.0.0.1'
      }
    },
    /**
     * 是否为回环主机名。
     * @param {string} hostname
     * @returns {boolean}
     */
    isLoopbackHost(hostname) {
      return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '0:0:0:0:0:0:0:1'
    },
    /**
     * 从 URL 或 host:port 中取出 hostname；失败返回空字符串。
     * @param {string} value
     * @returns {string}
     */
    parseHostname(value) {
      if (!value) return ''
      try {
        return new URL(value.includes('://') ? value : 'http://' + value).hostname
      } catch {
        return ''
      }
    },
    /**
     * 按大小写不敏感方式读取第一个请求头值。
     * @param {Record<string, string>} headers
     * @param {string} name
     * @returns {string}
     */
    header(headers, name) {
      const hit = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name.toLowerCase())
      return hit
        ? String(hit[1] || '')
            .split(',')[0]
            .trim()
        : ''
    },
    /**
     * 从 Authorization Bearer 或 X-Api-Token / X-Auth-Token 取出令牌。
     * @param {{headers?: object}} req
     * @returns {string}
     */
    requestToken(req) {
      const auth = Utils.header(req.headers, 'Authorization')
      if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, '').trim()
      return Utils.header(req.headers, 'X-Api-Token') || Utils.header(req.headers, 'X-Auth-Token')
    },
    /**
     * 生成临时鉴权密钥。优先使用宿主 generateSecureKey。
     * @returns {string}
     */
    makeToken() {
      if (Plugins.generateSecureKey) return String(Plugins.generateSecureKey(256) || '').trim()
      const bytes = new Uint8Array(32)
      globalThis.crypto.getRandomValues(bytes)
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    },
    /**
     * 确定本次运行时令牌：已配置 AuthToken 则用之，否则生成临时密钥。
     * @returns {{configured: boolean, token: string}}
     */
    resolveToken() {
      const configured = String(Plugin.AuthToken || '').trim()
      runtimeToken = configured || Utils.makeToken()
      return { configured: Boolean(configured), token: runtimeToken }
    },
    /**
     * Origin 是否允许。回环始终允许；绑定回环时拒绝非回环；绑定 0.0.0.0 或 :: 时允许带主机名的 Origin；绑定具体地址时需主机名一致。
     * @param {string} origin
     * @returns {boolean}
     */
    allowedOrigin(origin) {
      const host = Utils.parseHostname(origin)
      if (Utils.isLoopbackHost(host)) return true
      const listen = Utils.listenHostname()
      if (Utils.isLoopbackHost(listen)) return false
      if (listen === '0.0.0.0' || listen === '::') return Boolean(host)
      return Boolean(host) && host === listen
    },
    /**
     * Host 头是否允许。空 Host 放行（真实 GFC 往往拿不到 Host）。规则与 allowedOrigin 类似。
     * @param {string} hostHeader
     * @returns {boolean}
     */
    allowedHost(hostHeader) {
      const host = Utils.parseHostname(hostHeader)
      if (!host) return true
      if (Utils.isLoopbackHost(host)) return true
      const listen = Utils.listenHostname()
      if (Utils.isLoopbackHost(listen)) return false
      if (listen === '0.0.0.0' || listen === '::') return true
      return host === listen
    },
    /**
     * 结束 HTTP 响应；非字符串体会被 JSON.stringify。
     * @param {{end: Function}} res
     * @param {number} status
     * @param {object} headers
     * @param {*|string} body
     */
    end(res, status, headers, body) {
      const payload = body == null || body === '' ? '' : typeof body === 'string' ? body : JSON.stringify(body)
      res.end(status, headers, payload)
    },
    /**
     * 读取请求体；非 JSON 文本则尝试按宿主约定做 base64 解码。
     * @param {{body?: string}} req
     * @returns {string}
     */
    readBody(req) {
      const raw = typeof req.body === 'string' ? req.body : req.body == null ? '' : String(req.body)
      if (!raw) return ''
      const trimmed = raw.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed
      return Plugins.base64Decode ? Plugins.base64Decode(raw) : raw
    },
    /**
     * 递归脱敏敏感字段与疑似密钥字符串。
     * @param {*} value
     * @param {string} [key] 当前字段名，用于判断是否敏感
     * @returns {*}
     */
    sanitize(value, key = '') {
      if (typeof key === 'string' && SECRET_KEY.test(key)) return '<redacted>'
      if (typeof value === 'string') {
        if (SECRET_KEY.test(key) || /token=|access_token=|auth=/i.test(value)) return '<redacted>'
        return value
      }
      if (Array.isArray(value)) return value.map((item) => Utils.sanitize(item, key))
      if (Utils.isPlainObject(value)) {
        const out = {}
        const namedSecret = typeof value.key === 'string' && SECRET_KEY.test(value.key)
        for (const [k, v] of Object.entries(value)) {
          if (namedSecret && (k === 'value' || k === 'data')) out[k] = '<redacted>'
          else out[k] = Utils.sanitize(v, k)
        }
        return out
      }
      return value
    },
    /**
     * 按 id 或 name 查找列表项，可选用 store getter。
     * @param {object[]} list
     * @param {Function} [getter]
     * @param {string} id
     * @returns {object|undefined}
     */
    findItem(list, getter, id) {
      if (!id) return
      if (typeof getter === 'function') {
        const hit = getter(id)
        if (hit) return hit
      }
      return (list || []).find((item) => item && (item.id === id || item.name === id))
    },
    /**
     * 从缓存文件加载 MMDB 登记列表到内存。
     * @returns {Promise<void>}
     */
    async loadMmdbs() {
      const raw = await Plugins.ignoredError?.(Plugins.ReadFile, MMDB_CONFIG)
      if (!raw) {
        mmdbs = []
        return
      }
      try {
        const parsed = JSON.parse(raw)
        mmdbs = Array.isArray(parsed) ? parsed : []
      } catch {
        mmdbs = []
      }
    },
    /**
     * 把内存中的 MMDB 列表写回缓存文件。
     * @returns {Promise<void>}
     */
    async saveMmdbs() {
      await Plugins.WriteFile(MMDB_CONFIG, JSON.stringify(mmdbs))
    },
    /**
     * 按 id 查找已登记的 MMDB。
     * @param {string} id
     * @returns {object|undefined}
     */
    findMmdb(id) {
      return mmdbs.find((item) => item.id === id)
    },
    /**
     * 按宿主类型调用对应的 TUN 更新接口（GFC / GFS 签名不同）。
     * @param {boolean} enable
     * @returns {Promise<void>}
     */
    async setTun(enable) {
      const store = Plugins.useKernelApiStore()
      if (Utils.isClash()) await store.updateConfig({ tun: { enable } })
      else await store.updateConfig('tun', { enable })
    },
    /**
     * 对工具 arguments 做有限校验（必填、额外字段、部分 enum），不是完整 JSON Schema 校验。
     * @param {object} schema
     * @param {*} args
     * @returns {string} 错误原因；通过时为空字符串
     */
    invalidArgs(schema, args) {
      if (args === undefined) args = {}
      if (!Utils.isPlainObject(args)) return 'arguments must be an object'
      const properties = schema?.properties || {}
      if (schema?.additionalProperties === false) {
        for (const key of Object.keys(args)) {
          if (!Object.hasOwn(properties, key)) return 'Unexpected param: ' + key
        }
      }
      for (const key of schema?.required || []) {
        if (!Object.hasOwn(args, key)) return 'Missing param: ' + key
      }
      if (properties.mode?.enum && args.mode !== undefined && !properties.mode.enum.includes(args.mode)) {
        return 'Invalid param: mode'
      }
      if (properties.type?.enum && args.type !== undefined && !properties.type.enum.includes(args.type)) {
        return 'Invalid param: type'
      }
      return ''
    },
    /**
     * 生成 tools/list 所需的工具清单。
     * @returns {object[]}
     */
    toolList() {
      return Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || { type: 'object', properties: {} },
        annotations: tool.annotations
      }))
    }
  }

  // 在此追加工具。协议方法不必写在这里。
  const tools = {
    /** 健康检查，返回 pong。 */
    ping: {
      description: 'Health check',
      annotations: ro,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        return Utils.okText('pong')
      }
    },
    /** 读取应用与 MCP 服务信息（不含密钥）。 */
    get_app_info: {
      description: '读取应用与 MCP 服务信息（不含密钥）',
      annotations: ro,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        return Utils.okText({
          appName: Plugins.APP_TITLE,
          appVersion: Plugins.APP_VERSION,
          plugin: Plugin.name || 'MCP Server',
          pluginVersion: Plugin.version || 'v1.0.0',
          protocol: PROTOCOL,
          endpoint: Utils.endpoint(),
          address: Utils.address(),
          autoStart: Utils.flagOn('AutoStart'),
          allowWrites: Utils.flagOn('AllowWrites'),
          allowCoreControl: Utils.flagOn('AllowCoreControl'),
          allowSystemProxy: Utils.flagOn('AllowSystemProxy'),
          allowPluginRun: Utils.flagOn('AllowPluginRun'),
          authConfigured: Boolean(String(Plugin.AuthToken || '').trim())
        })
      }
    },
    /** 读取核心运行状态、模式、TUN 和系统代理。 */
    get_runtime_status: {
      description: '读取核心运行状态、模式、TUN 和系统代理（只读，不改状态）',
      annotations: ro,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        const kernel = Plugins.useKernelApiStore()
        const env = Plugins.useEnvStore()
        return Utils.okText({
          running: !!kernel.running,
          starting: !!kernel.starting,
          stopping: !!kernel.stopping,
          restarting: !!kernel.restarting,
          mode: kernel.config?.mode || '',
          tun: !!kernel.config?.tun?.enable,
          systemProxy: !!env.systemProxy,
          os: env.env?.os,
          arch: env.env?.arch
        })
      }
    },
    /** 读取 APP 与插件设置，密钥已脱敏。 */
    get_settings: {
      description: '读取 APP 与插件设置；密钥类字段已脱敏',
      annotations: ro,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        return Utils.okText(Utils.sanitize(Plugins.useAppSettingsStore().app))
      }
    },
    /** 浅合并修改 APP/插件设置，需 AllowWrites。 */
    update_settings: {
      description: '按对象浅合并修改 APP/插件设置。需要开启 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { data: { type: 'object', description: '要合并进 app 设置的字段' } },
        required: ['data'],
        additionalProperties: false
      },
      async run({ data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        const store = Plugins.useAppSettingsStore()
        store.app = Plugins.deepAssign(store.app, data)
        return Utils.okText(Utils.sanitize(store.app))
      }
    },
    /** 列出配置，或按 id/name 获取单个配置。 */
    get_profiles: {
      description: '列出配置，或用 id/name 获取单个配置（敏感字段脱敏）',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: '配置 id 或名称；省略则返回列表' } },
        additionalProperties: false
      },
      async run({ id } = {}) {
        const store = Plugins.useProfilesStore()
        if (!id) return Utils.okText(Utils.sanitize(store.profiles || []))
        const profile = Utils.findItem(store.profiles, store.getProfileById, id)
        if (!profile) throw '配置不存在'
        return Utils.okText(Utils.sanitize(profile))
      }
    },
    /** 由配置生成核心配置（脱敏，不写入、不启动核心）。 */
    generate_profile_config: {
      description: '由配置生成核心配置（脱敏后返回，不写入、不启动核心）',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: '配置 id 或名称' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        const store = Plugins.useProfilesStore()
        const profile = Utils.findItem(store.profiles, store.getProfileById, id)
        if (!profile) throw '配置不存在'
        const config = await Plugins.generateConfig(profile)
        const safe = Utils.sanitize(config)
        if (Utils.isClash() && Plugins.YAML?.stringify) return Utils.okText(Plugins.YAML.stringify(safe))
        return Utils.okText(safe)
      }
    },
    /** 新建配置，需 AllowWrites。 */
    create_profile: {
      description: '新建配置。可只给 name，或用 data 覆盖模板字段。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          data: { type: 'object', description: '与模板合并的字段' }
        },
        additionalProperties: false
      },
      async run({ name, data } = {}) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useProfilesStore()
        const base = store.getProfileTemplate?.(name || data?.name || '') || { id: Plugins.sampleID?.(), name: name || '' }
        const profile = Plugins.deepAssign(base, Utils.isPlainObject(data) ? data : {})
        if (name) profile.name = name
        await store.addProfile(profile)
        return Utils.okText({ ok: true, id: profile.id, name: profile.name })
      }
    },
    /** 修改配置，需 AllowWrites。 */
    update_profile: {
      description: '修改配置。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, data: { type: 'object' } },
        required: ['id', 'data'],
        additionalProperties: false
      },
      async run({ id, data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        const store = Plugins.useProfilesStore()
        const profile = Utils.findItem(store.profiles, store.getProfileById, id)
        if (!profile) throw '配置不存在'
        const next = Plugins.deepAssign(Plugins.deepClone ? Plugins.deepClone(profile) : { ...profile }, data)
        await store.editProfile(profile.id, next)
        return Utils.okText(Utils.sanitize(next))
      }
    },
    /** 删除配置，需 AllowWrites。 */
    delete_profile: {
      description: '删除配置。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useProfilesStore()
        const profile = Utils.findItem(store.profiles, store.getProfileById, id)
        if (!profile) throw '配置不存在'
        await store.deleteProfile(profile.id)
        return Utils.okText({ ok: true, id: profile.id })
      }
    },
    /** 列出或按 id/name 获取订阅。 */
    get_subscriptions: {
      description: '列出订阅，或用 id/name 获取单个订阅。url、请求头等已脱敏。',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: '订阅 id 或名称；省略则返回列表' } },
        additionalProperties: false
      },
      async run({ id } = {}) {
        const store = Plugins.useSubscribesStore()
        if (!id) return Utils.okText(Utils.sanitize(store.subscribes || []))
        const item = Utils.findItem(store.subscribes, store.getSubscribeById, id)
        if (!item) throw '订阅不存在'
        return Utils.okText(Utils.sanitize(item))
      }
    },
    /** 读取订阅节点列表（脱敏）。 */
    get_subscription_proxies: {
      description: '读取订阅节点列表（脱敏，不返回密码/uuid/token）',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        const store = Plugins.useSubscribesStore()
        const item = Utils.findItem(store.subscribes, store.getSubscribeById, id)
        if (!item) throw '订阅不存在'
        if (!item.path) throw '订阅没有本地节点文件'
        let proxies = await Plugins.ReadFile(item.path)
        if (Utils.isClash()) proxies = Plugins.YAML.parse(proxies).proxies
        else proxies = JSON.parse(proxies)
        return Utils.okText(Utils.sanitize(proxies))
      }
    },
    /** 新建订阅，需 AllowWrites。 */
    create_subscription: {
      description: '新建订阅。可只给 name/url，或用 data 覆盖模板。需要 AllowWrites。不会更新现有订阅。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          url: { type: 'string' },
          data: { type: 'object', description: '与模板合并的字段' }
        },
        additionalProperties: false
      },
      async run({ name, url, data } = {}) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useSubscribesStore()
        const base = store.getSubscribeTemplate?.(name || data?.name || '', { url: url || data?.url || '' }) || {
          id: Plugins.sampleID?.(),
          name: name || '',
          url: url || ''
        }
        const item = Plugins.deepAssign(base, Utils.isPlainObject(data) ? data : {})
        if (name) item.name = name
        if (url) item.url = url
        await store.addSubscribe(item)
        return Utils.okText({ ok: true, id: item.id, name: item.name })
      }
    },
    /** 修改订阅元数据，不会拉取节点，需 AllowWrites。 */
    update_subscription: {
      description: '修改订阅元数据，不会拉取节点。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, data: { type: 'object' } },
        required: ['id', 'data'],
        additionalProperties: false
      },
      async run({ id, data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        const store = Plugins.useSubscribesStore()
        const item = Utils.findItem(store.subscribes, store.getSubscribeById, id)
        if (!item) throw '订阅不存在'
        const next = Plugins.deepAssign(Plugins.deepClone ? Plugins.deepClone(item) : { ...item }, data)
        await store.editSubscribe(item.id, next)
        return Utils.okText(Utils.sanitize(next))
      }
    },
    /** 删除订阅，需 AllowWrites。 */
    delete_subscription: {
      description: '删除订阅。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useSubscribesStore()
        const item = Utils.findItem(store.subscribes, store.getSubscribeById, id)
        if (!item) throw '订阅不存在'
        await store.deleteSubscribe(item.id)
        return Utils.okText({ ok: true, id: item.id })
      }
    },
    /** 从远端更新订阅节点，需 AllowWrites。 */
    refresh_subscription: {
      description: '从远端更新某个订阅的节点。需要 AllowWrites。会改动该订阅已有节点文件。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useSubscribesStore()
        const item = Utils.findItem(store.subscribes, store.getSubscribeById, id)
        if (!item) throw '订阅不存在'
        await store.updateSubscribe(item.id)
        return Utils.okText(Utils.sanitize(store.getSubscribeById(item.id) || item))
      }
    },
    /** 列出或按 id/name 获取规则集。 */
    get_rulesets: {
      description: '列出规则集，或用 id/name 获取单个规则集（url 已脱敏）',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        additionalProperties: false
      },
      async run({ id } = {}) {
        const store = Plugins.useRulesetsStore()
        if (!id) return Utils.okText(Utils.sanitize(store.rulesets || []))
        const item = Utils.findItem(store.rulesets, store.getRulesetById, id)
        if (!item) throw '规则集不存在'
        return Utils.okText(Utils.sanitize(item))
      }
    },
    /** 添加规则集，需 AllowWrites。 */
    create_ruleset: {
      description: '添加规则集。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { data: { type: 'object' } },
        required: ['data'],
        additionalProperties: false
      },
      async run({ data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        await Plugins.useRulesetsStore().addRuleset(data)
        return Utils.okText({ ok: true, id: data.id, name: data.name })
      }
    },
    /** 修改规则集元数据，需 AllowWrites。 */
    update_ruleset: {
      description: '修改规则集元数据。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, data: { type: 'object' } },
        required: ['id', 'data'],
        additionalProperties: false
      },
      async run({ id, data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        const store = Plugins.useRulesetsStore()
        const item = Utils.findItem(store.rulesets, store.getRulesetById, id)
        if (!item) throw '规则集不存在'
        const next = Plugins.deepAssign(Plugins.deepClone ? Plugins.deepClone(item) : { ...item }, data)
        await store.editRuleset(item.id, next)
        return Utils.okText(Utils.sanitize(next))
      }
    },
    /** 删除规则集，需 AllowWrites。 */
    delete_ruleset: {
      description: '删除规则集。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useRulesetsStore()
        const item = Utils.findItem(store.rulesets, store.getRulesetById, id)
        if (!item) throw '规则集不存在'
        await store.deleteRuleset(item.id)
        return Utils.okText({ ok: true, id: item.id })
      }
    },
    /** 从远端更新规则集，需 AllowWrites。 */
    refresh_ruleset: {
      description: '从远端更新规则集。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useRulesetsStore()
        const item = Utils.findItem(store.rulesets, store.getRulesetById, id)
        if (!item) throw '规则集不存在'
        await store.updateRuleset(item.id)
        return Utils.okText(Utils.sanitize(store.getRulesetById(item.id) || item))
      }
    },
    /** 列出或获取插件摘要（配置脱敏，不含源码）。 */
    get_plugins: {
      description: '列出插件，或用 id/name 获取单个插件。配置中的密钥已脱敏，不含源码。',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        additionalProperties: false
      },
      async run({ id } = {}) {
        const store = Plugins.usePluginsStore()
        const summarize = (plugin) =>
          Utils.sanitize({
            id: plugin.id,
            name: plugin.name,
            version: plugin.version,
            disabled: plugin.disabled,
            installed: plugin.installed,
            type: plugin.type,
            triggers: plugin.triggers,
            hasUI: plugin.hasUI,
            configuration: plugin.configuration
          })
        if (!id) return Utils.okText((store.plugins || []).map(summarize))
        const item = Utils.findItem(store.plugins, store.getPluginById, id)
        if (!item) throw '插件不存在'
        return Utils.okText(summarize(item))
      }
    },
    /** 添加插件记录，需 AllowWrites。 */
    create_plugin: {
      description: '添加插件记录。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { data: { type: 'object' } },
        required: ['data'],
        additionalProperties: false
      },
      async run({ data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        await Plugins.usePluginsStore().addPlugin(data)
        return Utils.okText({ ok: true, id: data.id, name: data.name })
      }
    },
    /** 修改插件元数据或配置，需 AllowWrites。 */
    update_plugin: {
      description: '修改插件元数据或配置。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, data: { type: 'object' } },
        required: ['id', 'data'],
        additionalProperties: false
      },
      async run({ id, data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        const store = Plugins.usePluginsStore()
        const item = Utils.findItem(store.plugins, store.getPluginById, id)
        if (!item) throw '插件不存在'
        const next = Plugins.deepAssign(Plugins.deepClone ? Plugins.deepClone(item) : { ...item }, data)
        await store.editPlugin(item.id, next)
        return Utils.okText(Utils.sanitize({ id: next.id, name: next.name, version: next.version, disabled: next.disabled }))
      }
    },
    /** 删除插件，需 AllowWrites。 */
    delete_plugin: {
      description: '删除插件。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.usePluginsStore()
        const item = Utils.findItem(store.plugins, store.getPluginById, id)
        if (!item) throw '插件不存在'
        await store.deletePlugin(item.id)
        return Utils.okText({ ok: true, id: item.id })
      }
    },
    /** 从远端更新插件源码，需 AllowWrites。 */
    refresh_plugin: {
      description: '从远端更新插件源码。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.usePluginsStore()
        const item = Utils.findItem(store.plugins, store.getPluginById, id)
        if (!item) throw '插件不存在'
        await store.updatePlugin(item.id)
        return Utils.okText({ ok: true, id: item.id })
      }
    },
    /** 调用插件已声明的方法，需 AllowPluginRun。 */
    run_plugin: {
      description: '调用插件已声明的方法（默认 onRun）。需要 AllowPluginRun。不能执行任意 JS。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          method: { type: 'string', description: '插件方法名，默认 onRun' },
          args: { type: 'array', description: '传给方法的参数列表', items: {} }
        },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id, method, args } = {}) {
        Utils.assertFlag('AllowPluginRun', 'AllowPluginRun')
        const event = method || 'onRun'
        if (typeof event !== 'string' || !METHOD_NAME.test(event)) throw '非法方法名'
        if (args !== undefined && !Array.isArray(args)) throw 'args 必须是数组'
        const store = Plugins.usePluginsStore()
        const item = Utils.findItem(store.plugins, store.getPluginById, id)
        if (!item) throw '插件不存在'
        const result = await store.manualTrigger(item.id, event, ...(args || []))
        return Utils.okText(result ?? '插件执行完毕，无返回值')
      }
    },
    /** 列出或获取计划任务（脚本内容已脱敏）。 */
    get_tasks: {
      description: '列出计划任务，或用 id/name 获取单个任务。脚本内容已脱敏。',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        additionalProperties: false
      },
      async run({ id } = {}) {
        const store = Plugins.useScheduledTasksStore()
        if (!id) return Utils.okText(Utils.sanitize(store.scheduledtasks || []))
        const item = Utils.findItem(store.scheduledtasks, store.getScheduledTaskById, id)
        if (!item) throw '计划任务不存在'
        return Utils.okText(Utils.sanitize(item))
      }
    },
    /** 添加计划任务，需 AllowWrites。 */
    create_task: {
      description: '添加计划任务。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { data: { type: 'object' } },
        required: ['data'],
        additionalProperties: false
      },
      async run({ data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        await Plugins.useScheduledTasksStore().addScheduledTask(data)
        return Utils.okText({ ok: true, id: data.id, name: data.name })
      }
    },
    /** 修改计划任务，需 AllowWrites。 */
    update_task: {
      description: '修改计划任务。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, data: { type: 'object' } },
        required: ['id', 'data'],
        additionalProperties: false
      },
      async run({ id, data }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        if (!Utils.isPlainObject(data)) throw 'data 必须是对象'
        const store = Plugins.useScheduledTasksStore()
        const item = Utils.findItem(store.scheduledtasks, store.getScheduledTaskById, id)
        if (!item) throw '计划任务不存在'
        const next = Plugins.deepAssign(Plugins.deepClone ? Plugins.deepClone(item) : { ...item }, data)
        await store.editScheduledTask(item.id, next)
        return Utils.okText(Utils.sanitize(next))
      }
    },
    /** 删除计划任务，需 AllowWrites。 */
    delete_task: {
      description: '删除计划任务。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useScheduledTasksStore()
        const item = Utils.findItem(store.scheduledtasks, store.getScheduledTaskById, id)
        if (!item) throw '计划任务不存在'
        await store.deleteScheduledTask(item.id)
        return Utils.okText({ ok: true, id: item.id })
      }
    },
    /** 立即执行一个计划任务，需 AllowWrites。 */
    run_task: {
      description: '立即执行一个计划任务。需要 AllowWrites（任务可能更新订阅/规则/插件）。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        const store = Plugins.useScheduledTasksStore()
        const item = Utils.findItem(store.scheduledtasks, store.getScheduledTaskById, id)
        if (!item) throw '计划任务不存在'
        const result = await store.runScheduledTask(item.id)
        return Utils.okText(Utils.sanitize(result))
      }
    },
    /** 启动核心，需 AllowCoreControl。 */
    start_core: {
      description: '启动核心。需要 AllowCoreControl。GFS 可传 id 指定配置；GFC 使用当前配置。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: '可选，仅 GFS 使用的配置 id' } },
        additionalProperties: false
      },
      async run({ id } = {}) {
        Utils.assertFlag('AllowCoreControl', 'AllowCoreControl')
        const kernel = Plugins.useKernelApiStore()
        if (id && !Utils.isClash()) {
          const profile = Utils.findItem(Plugins.useProfilesStore().profiles, Plugins.useProfilesStore().getProfileById, id)
          if (!profile) throw '配置不存在'
          await kernel.startCore(profile)
        } else {
          await kernel.startCore()
        }
        return Utils.okText('已启动')
      }
    },
    /** 停止核心，需 AllowCoreControl。 */
    stop_core: {
      description: '停止核心。需要 AllowCoreControl。',
      annotations: dest,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        Utils.assertFlag('AllowCoreControl', 'AllowCoreControl')
        await Plugins.useKernelApiStore().stopCore()
        return Utils.okText('已停止')
      }
    },
    /** 重启核心，需 AllowCoreControl。 */
    restart_core: {
      description: '重启核心。需要 AllowCoreControl。',
      annotations: dest,
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async run() {
        Utils.assertFlag('AllowCoreControl', 'AllowCoreControl')
        await Plugins.useKernelApiStore().restartCore()
        return Utils.okText('已重新启动')
      }
    },
    /** 切换核心工作模式，需 AllowCoreControl。 */
    set_core_mode: {
      description: '切换核心工作模式：direct / global / rule。需要 AllowCoreControl。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: CORE_MODES } },
        required: ['mode'],
        additionalProperties: false
      },
      async run({ mode }) {
        Utils.assertFlag('AllowCoreControl', 'AllowCoreControl')
        if (!CORE_MODES.includes(mode)) throw 'mode 必须是 direct、global 或 rule'
        await Plugins.handleChangeMode(mode)
        return Utils.okText('已切换')
      }
    },
    /** 开启或关闭 TUN，需 AllowCoreControl。 */
    set_tun: {
      description: '开启或关闭 TUN。需要 AllowCoreControl。GFC/GFS 会使用各自的 updateConfig 签名。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['on', 'off'], description: 'on 或 off' } },
        required: ['mode'],
        additionalProperties: false
      },
      async run({ mode }) {
        Utils.assertFlag('AllowCoreControl', 'AllowCoreControl')
        if (mode !== 'on' && mode !== 'off') throw 'mode 必须是 on 或 off'
        await Utils.setTun(mode === 'on')
        return Utils.okText('已完成')
      }
    },
    /** 显示或隐藏 GUI 窗口。 */
    set_window: {
      description: '显示或隐藏 GUI 窗口。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['show', 'hide'] } },
        required: ['mode'],
        additionalProperties: false
      },
      async run({ mode }) {
        if (mode === 'hide') await Plugins.WindowHide()
        else if (mode === 'show') {
          await Plugins.WindowShow()
          setTimeout(() => {
            Plugins.WindowSetAlwaysOnTop(true)
            setTimeout(() => Plugins.WindowSetAlwaysOnTop(false), 100)
          }, 100)
        } else throw 'mode 必须是 show 或 hide'
        return Utils.okText('已切换')
      }
    },
    /** 设置或清除系统代理，需 AllowSystemProxy。 */
    set_system_proxy: {
      description: '设置或清除系统代理。需要 AllowSystemProxy。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['set', 'clear'] } },
        required: ['mode'],
        additionalProperties: false
      },
      async run({ mode }) {
        Utils.assertFlag('AllowSystemProxy', 'AllowSystemProxy')
        const env = Plugins.useEnvStore()
        if (mode === 'set') await env.setSystemProxy()
        else if (mode === 'clear') await env.clearSystemProxy()
        else throw 'mode 必须是 set 或 clear'
        return Utils.okText('已完成')
      }
    },
    /** 列出或按 id 获取已登记的 MMDB。 */
    get_mmdbs: {
      description: '列出已登记的 MMDB，或用 id 获取单个信息',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        additionalProperties: false
      },
      async run({ id } = {}) {
        await Utils.loadMmdbs()
        if (!id) return Utils.okText(mmdbs)
        const item = Utils.findMmdb(id)
        if (!item) throw '数据库不存在'
        return Utils.okText(item)
      }
    },
    /** 下载并登记一个 MMDB，需 AllowWrites。 */
    add_mmdb: {
      description: '下载并登记一个 MMDB。需要 AllowWrites。仅写入插件自己的 data/.cache/mmdbs。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: MMDB_TYPES },
          url: { type: 'string' }
        },
        required: ['id', 'type', 'url'],
        additionalProperties: false
      },
      async run({ id, type, url }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        await Utils.loadMmdbs()
        if (!id || !String(id).trim()) throw '缺少必要的参数：id'
        if (Utils.findMmdb(id)) throw '数据库已存在'
        if (!MMDB_TYPES.includes(type)) throw '数据库的类型错误'
        if (!url || !String(url).trim()) throw '缺少必要的参数：url'
        if (!(await Plugins.FileExists(MMDB_DIR))) await Plugins.MakeDir(MMDB_DIR)
        const savedPath = MMDB_DIR + '/' + id + '.mmdb'
        await Plugins.Download(url, savedPath)
        const item = { id, type, url, path: savedPath }
        mmdbs.push(item)
        await Utils.saveMmdbs()
        return Utils.okText({ ok: true, id, type, path: savedPath })
      }
    },
    /** 删除已登记的 MMDB 文件，需 AllowWrites。 */
    delete_mmdb: {
      description: '删除已登记的 MMDB 文件。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        await Utils.loadMmdbs()
        const item = Utils.findMmdb(id)
        if (!item) throw '数据库不存在'
        await Plugins.RemoveFile(item.path)
        mmdbs = mmdbs.filter((db) => db.id !== id)
        await Utils.saveMmdbs()
        return Utils.okText({ ok: true, id })
      }
    },
    /** 按已登记 URL 重新下载 MMDB，需 AllowWrites。 */
    refresh_mmdb: {
      description: '按已登记 URL 重新下载 MMDB。需要 AllowWrites。',
      annotations: dest,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        await Utils.loadMmdbs()
        const item = Utils.findMmdb(id)
        if (!item) throw '数据库不存在'
        await Plugins.Download(item.url, item.path)
        return Utils.okText({ ok: true, id })
      }
    },
    /** 打开 MMDB 以供查询，需 AllowWrites。 */
    open_mmdb: {
      description: '打开 MMDB 以供查询。需要 AllowWrites（会占用宿主 MMDB 句柄）。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        await Utils.loadMmdbs()
        const item = Utils.findMmdb(id)
        if (!item) throw '数据库不存在'
        await Plugins.OpenMMDB(item.path, Plugin.id)
        return Utils.okText('打开数据库成功')
      }
    },
    /** 关闭已打开的 MMDB，需 AllowWrites。 */
    close_mmdb: {
      description: '关闭已打开的 MMDB。需要 AllowWrites。',
      annotations: wr,
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      },
      async run({ id }) {
        Utils.assertFlag('AllowWrites', 'AllowWrites')
        await Utils.loadMmdbs()
        const item = Utils.findMmdb(id)
        if (!item) throw '数据库不存在'
        await Plugins.CloseMMDB(item.path, Plugin.id)
        return Utils.okText('关闭数据库成功')
      }
    },
    /** 查询 MMDB；尚未打开时会先打开再查。 */
    query_mmdb: {
      description: '查询 MMDB。只读；若尚未打开会自动打开后再查。',
      annotations: ro,
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ip: { type: 'string' },
          type: { type: 'string', enum: MMDB_TYPES, description: '默认 Country' }
        },
        required: ['id', 'ip'],
        additionalProperties: false
      },
      async run({ id, ip, type }) {
        if (!ip) throw '缺少必要的参数：ip'
        const queryType = type || 'Country'
        if (!MMDB_TYPES.includes(queryType)) throw '查询的类型错误'
        await Utils.loadMmdbs()
        const item = Utils.findMmdb(id)
        if (!item) throw '数据库不存在'
        try {
          return Utils.okText(await Plugins.QueryMMDB(item.path, ip, queryType))
        } catch (error) {
          const msg = error?.message || String(error)
          if (String(msg).includes('Database not open')) {
            await Plugins.OpenMMDB(item.path, Plugin.id)
            return Utils.okText(await Plugins.QueryMMDB(item.path, ip, queryType))
          }
          throw error
        }
      }
    }
  }

  /**
   * 分发单条 JSON-RPC 消息到 initialize、tools/list、tools/call。
   * @param {*} message 已解析的请求体
   * @returns {Promise<{status: number, body: object|string}>}
   */
  const dispatch = async (message) => {
    if (!Utils.isPlainObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
      return { status: 400, body: Utils.fail(message?.id, -32600, 'Invalid Request') }
    }
    if (!Object.hasOwn(message, 'id')) {
      return message.method === 'notifications/initialized'
        ? { status: 202, body: '' }
        : { status: 400, body: Utils.fail(null, -32601, 'Method not found: ' + message.method) }
    }
    if (message.method === 'initialize') {
      return {
        status: 200,
        body: Utils.ok(message.id, {
          protocolVersion: PROTOCOL,
          capabilities: { tools: {} },
          serverInfo: { name: Plugin.name || 'mcp-server', version: Plugin.version || 'v1.0.0' },
          instructions:
            'GUI.for.Cores MCP. Read-only tools are safe by default; writes/core/proxy/plugin-run require explicit plugin flags. Secrets are redacted.'
        })
      }
    }
    if (message.method === 'tools/list') return { status: 200, body: Utils.ok(message.id, { tools: Utils.toolList() }) }
    if (message.method === 'tools/call') {
      const params = message.params
      if (!Utils.isPlainObject(params) || typeof params.name !== 'string' || !params.name) {
        return { status: 200, body: Utils.fail(message.id, -32602, 'Invalid params') }
      }
      if (!Object.hasOwn(tools, params.name)) return { status: 200, body: Utils.fail(message.id, -32602, 'Unknown tool: ' + params.name) }
      const tool = tools[params.name]
      const reason = Utils.invalidArgs(tool.inputSchema, params.arguments)
      if (reason) return { status: 200, body: Utils.fail(message.id, -32602, reason) }
      try {
        const result = (await tool.run(params.arguments || {})) || {}
        return { status: 200, body: Utils.ok(message.id, { content: result.content || Utils.text(''), isError: !!result.isError }) }
      } catch (error) {
        return { status: 200, body: Utils.ok(message.id, { content: Utils.text(error?.message || error), isError: true }) }
      }
    }
    return { status: 200, body: Utils.fail(message.id, -32601, 'Method not found: ' + message.method) }
  }

  /**
   * HTTP 入口：校验 Origin/Host、Bearer、协议版本，解析后交给 dispatch。
   * 真实 GFC 通常拿不到 Host，Host 校验在实机上无效。
   * @param {{method: string, url: string, headers: object, body?: string}} req
   * @param {{end: Function}} res
   */
  const onRequest = async (req, res) => {
    const origin = Utils.header(req.headers, 'Origin')
    if (origin && !Utils.allowedOrigin(origin)) return Utils.end(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden origin')
    const hostHeader = Utils.header(req.headers, 'Host')
    if (hostHeader && !Utils.allowedHost(hostHeader)) return Utils.end(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Forbidden host')

    const pathname = new URL(req.url, 'http://127.0.0.1').pathname
    if (pathname !== '/mcp') return Utils.end(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found')
    if (req.method !== 'POST') {
      return Utils.end(
        res,
        405,
        { Allow: 'POST', 'Content-Type': 'text/plain; charset=utf-8' },
        req.method === 'GET' ? 'SSE is not supported' : 'Method Not Allowed'
      )
    }

    if (!runtimeToken || Utils.requestToken(req) !== runtimeToken) {
      return Utils.end(res, 401, { 'Content-Type': 'text/plain; charset=utf-8', 'WWW-Authenticate': 'Bearer' }, 'Unauthorized')
    }

    const protocolHeader = Utils.header(req.headers, 'MCP-Protocol-Version')
    if (protocolHeader && protocolHeader !== PROTOCOL) {
      return Utils.end(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Unsupported MCP-Protocol-Version')
    }

    let message
    try {
      message = JSON.parse(Utils.readBody(req))
    } catch {
      return Utils.end(res, 400, JSON_HEADERS, Utils.fail(null, -32700, 'Parse error'))
    }
    if (Array.isArray(message)) return Utils.end(res, 400, JSON_HEADERS, Utils.fail(null, -32600, 'JSON-RPC batches are not supported'))

    try {
      const result = await dispatch(message)
      return Utils.end(res, result.status, result.body ? JSON_HEADERS : {}, result.body)
    } catch (error) {
      return Utils.end(res, 500, JSON_HEADERS, Utils.fail(message?.id, -32603, error?.message || String(error)))
    }
  }

  /**
   * 启动 MCP HTTP 服务。绑定地址完全由 Address 决定，不会改写。
   * @returns {Promise<1>}
   */
  const Start = async () => {
    if (await Utils.isRunning()) throw '该服务已经在运行了'
    const auth = Utils.resolveToken()
    await Utils.loadMmdbs()
    await Plugins.StartServer(Utils.address(), Plugin.id, onRequest)
    const url = Utils.endpoint()
    Plugins.message?.success?.('MCP 已监听 ' + url)
    if (auth.configured) {
      await Plugins.alert?.('MCP Server', '服务已启动：' + url + '\n请在请求头携带 Authorization: Bearer <你配置的 AuthToken>\n密钥不会在此显示。')
    } else {
      await Plugins.alert?.(
        'MCP Server',
        '服务已启动：' + url + '\n本次临时密钥（重启或写入 AuthToken 前有效）：\n' + auth.token + '\n建议在插件配置中设置 AuthToken 以免每次变化。'
      )
    }
    return 1
  }

  /**
   * 停止服务并清空本次运行时令牌。
   * @returns {Promise<2>}
   */
  const Stop = async () => {
    runtimeToken = ''
    if (Plugins.ignoredError) await Plugins.ignoredError(Plugins.StopServer, Plugin.id)
    else await Plugins.StopServer(Plugin.id).catch(() => {})
    Plugins.message?.success?.('MCP 已停止')
    return 2
  }

  /**
   * 把服务地址复制到剪贴板，不含密钥。
   * @returns {Promise<void>}
   */
  const CopyURL = async () => {
    await Plugins.ClipboardSetText(Utils.endpoint())
    Plugins.message?.success?.('已复制地址（不含密钥）：' + Utils.endpoint())
  }

  /**
   * 手动运行：已启动则返回状态，否则启动服务。
   * @returns {Promise<1|2>}
   */
  const onRun = async () => ((await Utils.isRunning()) ? 1 : Start())

  /**
   * 宿主就绪：按 AutoStart 启动；若服务仍在跑则先停再拉起以套用当前配置。
   * @returns {Promise<1|2>}
   */
  const onReady = async () => {
    if (Utils.flagOn('AutoStart') && !(await Utils.isRunning())) return Start()
    if (await Utils.isRunning()) {
      await Stop()
      return Start()
    }
    return 2
  }

  /**
   * 关键配置变更且服务在运行时，重启以套用新地址或令牌。
   * @param {object} config 新配置
   * @param {object} old 旧配置
   */
  const onConfigure = async (config, old) => {
    const keys = ['Address', 'AuthToken', 'AutoStart']
    if (keys.some((key) => config?.[key] !== old?.[key]) && (await Utils.isRunning())) {
      await Stop()
      return Start()
    }
  }

  return { onRun, onReady, onConfigure, onShutdown: Stop, onDispose: Stop, onDisabled: Stop, Start, Stop, CopyURL }
}
