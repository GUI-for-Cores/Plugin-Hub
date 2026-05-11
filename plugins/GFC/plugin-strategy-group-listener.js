const PATH = 'data/third/strategy-group-listener'
const CONFIG_FILE = `${PATH}/settings.json`
const LISTENER_PREFIX = 'strategy-group-listener-'
const DEFAULT_PORT = 7898
const DEFAULT_LISTEN = '127.0.0.1'
const TEST_URL = 'https://ipinfo.io/json'
const LISTENER_TYPES = ['http', 'socks', 'mixed']
const OUTBOUND_MODES = ['proxy', 'rule', 'global']
const AUTH_MODES = ['global', 'custom', 'none']
const HEADER_ACTION_ID = `${Plugin.id}_profiles_header`

const onReady = async () => {
  addProfilesHeaderAction()
}

const onDispose = () => {
  removeProfilesHeaderAction()
}

/* 触发器 手动触发 */
const onRun = async () => {
  const profilesStore = Plugins.useProfilesStore()
  if (profilesStore.profiles.length === 0) throw '请先创建一个配置'

  const profile =
    profilesStore.profiles.length === 1
      ? profilesStore.profiles[0]
      : await Plugins.picker.single(
          '请选择要配置的 Clash 配置',
          profilesStore.profiles.map((v) => ({
            label: v.name,
            value: v
          })),
          [profilesStore.profiles[0]]
        )

  if (!profile) return
  await showUI(profile)
}

const openCurrentProfile = async () => {
  const profilesStore = Plugins.useProfilesStore()
  const profile = profilesStore.currentProfile || (profilesStore.profiles.length === 1 ? profilesStore.profiles[0] : null)
  if (profile) return await showUI(profile)
  return await onRun()
}

/* 可从配置右键菜单调用 */
const showUI = async (profile) => {
  const groups = getProfileGroups(profile)
  if (groups.length === 0) throw '当前配置没有可选择的策略组'

  const settings = await readSettings()
  const profileSetting = normalizeProfileSetting(settings[profile.id])
  const generatedConfig = await getGeneratedConfig(profile)
  const subRuleOptions = Object.keys(generatedConfig['sub-rules'] || {}).map((name) => ({ label: name, value: name }))
  const reservedPorts = getUsedPorts(generatedConfig)
  const rows = Vue.ref(profileSetting.listeners.map((listener) => normalizeListener(listener, groups, subRuleOptions)))

  const typeOptions = [
    { label: 'HTTP', value: 'http' },
    { label: 'SOCKS', value: 'socks' },
    { label: 'Mixed', value: 'mixed' }
  ]
  const outboundOptions = [
    { label: '绑定策略组', value: 'proxy' },
    { label: '使用子规则', value: 'rule' },
    { label: '使用全局规则', value: 'global' }
  ]
  const authOptions = [
    { label: '继承全局', value: 'global' },
    { label: '独立认证', value: 'custom' },
    { label: '不启用认证', value: 'none' }
  ]
  const ruleInputModeOptions = [
    { label: '选择', value: 'select' },
    { label: '手填', value: 'manual' }
  ]
  const groupOptions = groups.map((group) => ({ label: group.name, value: group.id }))

  const component = {
    template: `
    <div class="flex flex-col gap-8 pb-8 pr-8">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-16 font-bold">{{ profile.name }}</div>
          <div class="text-12 text-gray-500">为此配置添加独立 HTTP / SOCKS / Mixed 入站端口</div>
        </div>
        <div class="flex items-center gap-8">
          <Button icon="search" @click="checkLocalPorts">检查本机端口占用</Button>
          <Button type="primary" icon="add" @click="addListener">新增</Button>
        </div>
      </div>

      <div v-if="rows.length === 0" class="flex items-center justify-center min-h-[260px] border border-dashed rounded-4">
        <Button type="primary" icon="add" @click="addListener">添加入站</Button>
      </div>

      <div v-else class="flex flex-col gap-8">
        <Card v-for="(row, index) in rows" :key="row.id" :title="row.name || '入站 ' + (index + 1)">
          <template #extra>
            <div class="flex items-center gap-8">
              <Switch v-model="row.enabled">启用</Switch>
              <Button icon="code" type="text" @click.stop="copyTestCommand(row)">复制测试命令</Button>
              <Button icon="delete" type="text" @click.stop="removeListener(index)" />
            </div>
          </template>

          <div class="grid gap-12" style="grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));">
            <div style="grid-column: 1 / -1;">
              <div class="text-12 text-gray-500">{{ getListenerSummary(row) }}</div>
              <Tag v-if="isDuplicatePort(rows, row, index)" color="red" class="mt-4">监听端口重复</Tag>
              <Tag v-else-if="isReservedPort(row)" color="red" class="mt-4">端口已被当前配置占用</Tag>
            </div>

            <div class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">名称</div>
              <div class="min-w-0">
                <Input v-model="row.name" placeholder="AI HTTP" />
              </div>
            </div>
            <div class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">类型</div>
              <div class="min-w-0">
                <Select v-model="row.type" :options="typeOptions" />
              </div>
            </div>
            <div class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">监听地址</div>
              <div class="min-w-0">
                <Input v-model="row.listen" placeholder="127.0.0.1" />
              </div>
            </div>
            <div class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">监听端口</div>
              <div class="min-w-0">
                <Input v-model="row.port" placeholder="7898" />
              </div>
            </div>

            <div class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">出站方式</div>
              <div class="min-w-0">
                <Select v-model="row.outboundMode" :options="outboundOptions" />
              </div>
            </div>
            <div v-if="row.outboundMode === 'proxy'" class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">绑定策略组</div>
              <div class="min-w-0">
                <Select v-model="row.groupId" :options="groupOptions" />
              </div>
            </div>
            <div v-if="row.outboundMode === 'rule'" class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">子规则名称</div>
              <div class="grid gap-8 min-w-0" :style="{ gridTemplateColumns: subRuleOptions.length > 0 ? '112px minmax(0, 1fr)' : 'minmax(0, 1fr)' }">
                <Select v-if="subRuleOptions.length > 0" v-model="row.ruleInputMode" :options="ruleInputModeOptions" />
                <Select v-if="subRuleOptions.length > 0 && row.ruleInputMode !== 'manual'" v-model="row.rule" :options="subRuleOptions" />
                <Input v-else v-model="row.rule" placeholder="sub-rule-name" />
              </div>
            </div>
            <div v-if="row.type !== 'http'" class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">UDP</div>
              <div class="min-w-0">
                <Switch v-model="row.udp">开启</Switch>
              </div>
            </div>

            <div class="grid items-center gap-8" style="grid-template-columns: 96px minmax(0, 1fr);">
              <div class="text-12 text-gray-500">认证模式</div>
              <div class="min-w-0">
                <Select v-model="row.authMode" :options="authOptions" />
              </div>
            </div>
            <div v-if="row.authMode === 'custom'" class="grid items-start gap-8" style="grid-template-columns: 96px minmax(0, 1fr); grid-column: 1 / -1;">
              <div class="text-12 text-gray-500 pt-8">用户名 / 密码</div>
              <div class="min-w-0">
                <KeyValueEditor v-model="row.users" :placeholder="['用户名', '密码']" />
              </div>
            </div>
            <Tag v-if="row.authMode === 'none' && isUnsafeNoAuth(row)" color="red" style="grid-column: 1 / -1;">
              当前监听地址会暴露到局域网，请谨慎使用无认证模式
            </Tag>

          </div>
        </Card>
      </div>
    </div>
    `,
    setup() {
      const addListener = () => {
        rows.value.push(createListener(groups, rows.value, reservedPorts))
      }

      const removeListener = (index) => {
        rows.value.splice(index, 1)
      }

      const checkLocalPorts = async () => {
        const ports = [
          ...new Set(
            rows.value
              .filter((row) => row.enabled !== false)
              .map((row) => Number(row.port))
              .filter(Boolean)
          )
        ]
        if (ports.length === 0) {
          Plugins.message.info('没有需要检查的端口')
          return
        }

        const results = await checkTcpPorts(ports)
        await Plugins.alert('本机 TCP 端口检查', renderPortCheckResults(results), { type: 'markdown' })
      }

      const copyTestCommand = async (row) => {
        try {
          await Plugins.ClipboardSetText(buildCurlCommand(row))
          Plugins.message.success('测试命令已复制')
        } catch (error) {
          Plugins.message.error(error.message || error)
        }
      }

      return {
        profile,
        rows,
        typeOptions,
        outboundOptions,
        authOptions,
        ruleInputModeOptions,
        groupOptions,
        subRuleOptions,
        addListener,
        removeListener,
        checkLocalPorts,
        copyTestCommand,
        getListenerSummary,
        isDuplicatePort,
        isReservedPort: (row) => row.enabled !== false && reservedPorts.has(Number(row.port)),
        isUnsafeNoAuth
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      width: '86',
      height: '86',
      async onOk() {
        const listeners = validateListeners(rows.value, groups)
        const occupied = listeners.find((listener) => listener.enabled !== false && reservedPorts.has(listener.port))
        if (occupied) throw `监听端口 ${occupied.port} 已被当前配置占用`
        if (listeners.some(isUnsafeNoAuth)) {
          const ok = await Plugins.confirm('安全提示', '存在监听地址为 0.0.0.0 / :: 且不启用认证的入站，可能会将代理暴露到局域网。确定要保存吗？').catch(
            () => false
          )
          if (!ok) return false
        }
        settings[profile.id] = { listeners }
        await writeSettings(settings)
        Plugins.message.success('保存成功，重启核心后生效')
      },
      afterClose() {
        modal.destroy()
      }
    },
    {
      default: () => Vue.h(component)
    }
  )

  modal.open()
}

/* 触发器 生成配置时 */
const onGenerate = async (config, profile) => {
  const settings = await readSettings()
  const profileSetting = normalizeProfileSetting(settings[profile.id])
  const listeners = profileSetting.listeners.filter((listener) => listener.enabled !== false)
  if (listeners.length === 0) return config

  config.listeners = (config.listeners || []).filter((listener) => !String(listener.name || '').startsWith(LISTENER_PREFIX))

  const usedPorts = getUsedPorts(config)
  for (const listener of listeners) {
    const port = parsePort(listener.port)
    assertPortAvailable(port, usedPorts)
    usedPorts.add(port)

    const item = {
      name: makeListenerName(listener),
      type: normalizeType(listener.type),
      port,
      listen: normalizeListen(listener.listen)
    }

    if (item.type !== 'http') {
      item.udp = listener.udp !== false
    }

    applyOutbound(item, listener, config, profile)
    applyAuth(item, listener)

    config.listeners.push(item)
  }

  return config
}

/* 触发器 卸载时 */
const onUninstall = async () => {
  await Plugins.ignoredError(Plugins.RemoveFile, PATH)
}

const addProfilesHeaderAction = () => {
  const appStore = Plugins.useAppStore()
  appStore.removeCustomActions('profiles_header', HEADER_ACTION_ID)
  appStore.addCustomActions('profiles_header', {
    id: HEADER_ACTION_ID,
    component: 'Button',
    componentProps: {
      type: 'link',
      onClick: openCurrentProfile
    },
    componentSlots: {
      default: '入站设置'
    }
  })
}

const removeProfilesHeaderAction = () => {
  Plugins.useAppStore().removeCustomActions('profiles_header', HEADER_ACTION_ID)
}

const getProfileGroups = (profile) => {
  return (profile.proxyGroupsConfig || []).map((group) => ({
    id: group.id,
    name: group.name
  }))
}

const getGeneratedConfig = async (profile) => {
  try {
    return await Plugins.generateConfig(profile)
  } catch (error) {
    console.warn(`[${Plugin.name}] 生成配置预览失败`, error)
    return {}
  }
}

const normalizeProfileSetting = (setting) => {
  if (!setting) return { listeners: [] }
  if (Array.isArray(setting.listeners)) return { listeners: setting.listeners }

  // 兼容早期单监听配置。
  if (setting.groupId || setting.groupName || setting.port) {
    return {
      listeners: [
        {
          id: createId(),
          enabled: true,
          name: setting.name,
          type: setting.type || 'mixed',
          outboundMode: 'proxy',
          groupId: setting.groupId,
          groupName: setting.groupName,
          port: setting.port,
          listen: setting.listen,
          udp: setting.udp,
          authMode: 'global',
          users: {},
          ruleInputMode: 'select'
        }
      ]
    }
  }

  return { listeners: [] }
}

const normalizeListener = (listener, groups, subRuleOptions = []) => {
  const type = normalizeType(listener.type)
  const port = String(listener.port || nextAvailablePort([]))
  const group = groups.find((item) => item.id === listener.groupId || item.name === listener.groupName) || groups[0]
  const outboundMode = OUTBOUND_MODES.includes(listener.outboundMode) ? listener.outboundMode : listener.groupId || listener.groupName ? 'proxy' : 'global'
  const users = normalizeUsersInput(listener.users)
  const authMode = AUTH_MODES.includes(listener.authMode)
    ? listener.authMode
    : Array.isArray(listener.users) && listener.users.length === 0
      ? 'none'
      : Object.keys(users).length > 0
        ? 'custom'
        : 'global'
  const rule = String(listener.rule || '')
  const hasRuleOption = subRuleOptions.some((item) => item.value === rule)

  return {
    id: listener.id || createId(),
    enabled: listener.enabled !== false,
    name: String(listener.name || `${type.toUpperCase()} ${port}`),
    type,
    listen: normalizeListen(listener.listen),
    port,
    outboundMode,
    groupId: group.id,
    groupName: group.name,
    rule,
    ruleInputMode: listener.ruleInputMode === 'manual' || (rule && !hasRuleOption) ? 'manual' : 'select',
    udp: listener.udp !== false,
    authMode,
    users
  }
}

const createListener = (groups, listeners, reservedPorts = new Set()) => {
  const port = nextAvailablePort(listeners, reservedPorts)
  const group = groups[0]

  return {
    id: createId(),
    enabled: true,
    name: `Mixed ${port}`,
    type: 'mixed',
    listen: DEFAULT_LISTEN,
    port: String(port),
    outboundMode: 'proxy',
    groupId: group.id,
    groupName: group.name,
    rule: '',
    ruleInputMode: 'select',
    udp: true,
    authMode: 'global',
    users: {}
  }
}

const validateListeners = (listeners, groups) => {
  const usedPorts = new Set()

  return listeners.map((listener, index) => {
    const enabled = listener.enabled !== false
    const type = normalizeType(listener.type)
    const port = parsePort(listener.port)
    const outboundMode = OUTBOUND_MODES.includes(listener.outboundMode) ? listener.outboundMode : 'proxy'
    const authMode = AUTH_MODES.includes(listener.authMode) ? listener.authMode : 'global'
    const name = String(listener.name || `入站 ${index + 1}`).trim()

    if (enabled) {
      if (usedPorts.has(port)) throw `监听端口 ${port} 重复，请修改后再保存`
      usedPorts.add(port)
    }

    if (outboundMode === 'proxy' && !groups.find((item) => item.id === listener.groupId)) {
      throw '请选择有效的策略组'
    }

    if (outboundMode === 'rule' && !String(listener.rule || '').trim()) {
      throw '请填写子规则名称'
    }

    if (authMode === 'custom' && buildUsers(listener).length === 0) {
      throw '独立认证至少需要填写一组用户名和密码'
    }

    const group = groups.find((item) => item.id === listener.groupId) || groups[0]

    return {
      id: listener.id || createId(),
      enabled,
      name,
      type,
      listen: normalizeListen(listener.listen),
      port,
      outboundMode,
      groupId: group.id,
      groupName: group.name,
      rule: String(listener.rule || '').trim(),
      ruleInputMode: listener.ruleInputMode === 'manual' ? 'manual' : 'select',
      udp: listener.udp !== false,
      authMode,
      users: normalizeUsersInput(listener.users)
    }
  })
}

const normalizeType = (type) => {
  return LISTENER_TYPES.includes(type) ? type : 'mixed'
}

const applyOutbound = (item, listener, config, profile) => {
  const outboundMode = OUTBOUND_MODES.includes(listener.outboundMode) ? listener.outboundMode : 'proxy'

  if (outboundMode === 'proxy') {
    const groupName = getCurrentGroupName(profile, listener)
    if (!groupName || !hasProxyOrGroup(config, groupName)) {
      throw `[${Plugin.name}] 策略组不存在：${listener.groupName || listener.groupId}`
    }
    item.proxy = groupName
    return
  }

  if (outboundMode === 'rule') {
    const rule = String(listener.rule || '').trim()
    if (!rule) throw `[${Plugin.name}] 子规则名称不能为空`
    item.rule = rule
  }
}

const applyAuth = (item, listener) => {
  const authMode = AUTH_MODES.includes(listener.authMode) ? listener.authMode : 'global'

  if (authMode === 'none') {
    item.users = []
    return
  }

  if (authMode === 'custom') {
    const users = buildUsers(listener)
    if (users.length === 0) throw `[${Plugin.name}] 独立认证至少需要填写一组用户名和密码`
    item.users = users
  }
}

const getCurrentGroupName = (profile, listener) => {
  const group = getProfileGroups(profile).find((item) => item.id === listener.groupId || item.name === listener.groupName)
  return group?.name || listener.groupName
}

const hasProxyOrGroup = (config, name) => {
  const names = new Set(['DIRECT', 'REJECT', 'REJECT-DROP', 'PASS', 'COMPATIBLE'])
  for (const proxy of config.proxies || []) names.add(proxy.name)
  for (const group of config['proxy-groups'] || []) names.add(group.name)
  return names.has(name)
}

const buildUsers = (listener) => {
  return Object.entries(normalizeUsersInput(listener.users))
    .map(([username, password]) => ({
      username: String(username).trim(),
      password: String(password).trim()
    }))
    .filter((user) => user.username && user.password)
}

const normalizeUsersInput = (users) => {
  if (Array.isArray(users)) {
    return Object.fromEntries(users.map((user) => [user.username, user.password]).filter(([username]) => username))
  }

  if (!users || typeof users !== 'object') return {}

  return Object.fromEntries(
    Object.entries(users)
      .map(([username, password]) => [String(username).trim(), String(password)])
      .filter(([username]) => username)
  )
}

const parsePort = (value) => {
  const port = Number.parseInt(String(value).trim(), 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw '监听端口必须是 1-65535 之间的数字'
  return port
}

const normalizeListen = (value) => {
  const listen = String(value || DEFAULT_LISTEN).trim()
  return listen || DEFAULT_LISTEN
}

const nextAvailablePort = (listeners, reservedPorts = new Set()) => {
  const ports = new Set([...reservedPorts, ...listeners.map((listener) => Number(listener.port)).filter(Boolean)])
  let port = DEFAULT_PORT
  while (ports.has(port)) port += 1
  return port
}

const getUsedPorts = (config) => {
  const usedPorts = new Set()
  for (const key of ['port', 'socks-port', 'redir-port', 'tproxy-port', 'mixed-port']) {
    if (Number(config[key])) usedPorts.add(Number(config[key]))
  }
  for (const listener of config.listeners || []) {
    if (Number(listener.port) && !String(listener.name || '').startsWith(LISTENER_PREFIX)) {
      usedPorts.add(Number(listener.port))
    }
  }
  return usedPorts
}

const assertPortAvailable = (port, usedPorts) => {
  if (usedPorts.has(port)) {
    throw `[${Plugin.name}] 端口 ${port} 已被其他入站占用，请重新配置监听端口`
  }
}

const getListenerSummary = (listener) => {
  const type = normalizeType(listener.type).toUpperCase()
  const target =
    listener.outboundMode === 'proxy' ? listener.groupName || listener.groupId : listener.outboundMode === 'rule' ? listener.rule || '子规则' : '全局规则'
  const auth = { global: '继承全局认证', custom: '独立认证', none: '无认证' }[listener.authMode] || '继承全局认证'
  const udp = listener.type !== 'http' ? ` · UDP ${listener.udp === false ? '关闭' : '开启'}` : ''
  const status = listener.enabled === false ? '已禁用 · ' : ''
  return `${status}${type} ${normalizeListen(listener.listen)}:${listener.port || ''} -> ${target || '未设置'} · ${auth}${udp}`
}

const isDuplicatePort = (listeners, listener, index) => {
  const port = Number(listener.port)
  if (!port || listener.enabled === false) return false
  return listeners.some((item, itemIndex) => itemIndex !== index && item.enabled !== false && Number(item.port) === port)
}

const isUnsafeNoAuth = (listener) => {
  return listener.authMode === 'none' && ['0.0.0.0', '::', '[::]'].includes(normalizeListen(listener.listen))
}

const checkTcpPorts = async (ports) => {
  const os = Plugins.useEnvStore().env.os
  try {
    const output = await getTcpListenOutput(os)
    const occupied = parseTcpListenPorts(output, os)

    return ports.map((port) => ({
      port,
      occupied: occupied.has(port),
      detail: renderPortDetails(occupied.get(port))
    }))
  } catch (error) {
    return ports.map((port) => ({
      port,
      occupied: undefined,
      detail: error instanceof Error ? error.message : String(error)
    }))
  }
}

const getTcpListenOutput = async (os) => {
  if (os === 'windows') {
    return await Plugins.Exec(
      'powershell',
      ['-NoProfile', '-Command', 'Get-NetTCPConnection -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Csv -NoTypeInformation'],
      { Convert: true }
    )
  }

  const lsof = await Plugins.ignoredError(Plugins.Exec, 'lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'])
  if (lsof) return lsof

  return await Plugins.Exec('ss', ['-H', '-ltnp'])
}

const parseTcpListenPorts = (output, os) => {
  return os === 'windows' ? parseWindowsTcpListenPorts(output) : parseUnixTcpListenPorts(output)
}

const parseWindowsTcpListenPorts = (output) => {
  const ports = new Map()

  for (const line of String(output || '').split('\n')) {
    const columns = parseCsvLine(line.trim())
    if (columns.length < 3 || columns[1] === 'LocalPort') continue

    const port = Number(columns[1])
    if (!port) continue
    pushPortDetail(ports, port, `${columns[0]}:${columns[1]} PID ${columns[2]}`)
  }

  return ports
}

const parseUnixTcpListenPorts = (output) => {
  const ports = new Map()

  for (const line of String(output || '').split('\n')) {
    const text = line.trim()
    if (!text || text.startsWith('COMMAND')) continue

    const port = extractPortFromListenLine(text)
    if (!port) continue
    pushPortDetail(ports, port, text)
  }

  return ports
}

const parseCsvLine = (line) => {
  return line
    .split(',')
    .map((value) => value.trim().replace(/^"|"$/g, ''))
    .filter((value) => value.length > 0)
}

const extractPortFromListenLine = (line) => {
  const matches = [...line.matchAll(/(?:^|\s)(?:TCP\s+)?(?:\*|\[[^\]]+\]|[0-9a-fA-F:.%]+):(\d{1,5})(?=\s|$|\))/g)].map((match) => Number(match[1]))
  return matches.find((port) => port > 0 && port <= 65535)
}

const pushPortDetail = (ports, port, detail) => {
  if (!ports.has(port)) ports.set(port, [])
  ports.get(port).push(detail)
}

const renderPortDetails = (details = []) => {
  return details
    .slice(0, 3)
    .map((line) => line.replace(/\s+/g, ' '))
    .join('<br>')
}

const renderPortCheckResults = (results) => {
  const lines = ['|端口|结果|详情|', '|-|-|-|']

  for (const result of results) {
    if (result.occupied === undefined) {
      lines.push(`|${result.port}|无法检查|${escapeTableCell(result.detail || '')}|`)
    } else if (result.occupied) {
      lines.push(`|${result.port}|可能已占用|${escapeTableCell(result.detail || '')}|`)
    } else {
      lines.push(`|${result.port}|未发现占用||`)
    }
  }

  lines.push('')
  lines.push('仅检查本机 TCP 监听端口；结果用于辅助判断，最终仍以核心启动结果为准。')
  return lines.join('\n')
}

const escapeTableCell = (value) => {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
}

const buildCurlCommand = (listener) => {
  const scheme = listener.type === 'socks' ? 'socks5h' : 'http'
  const auth = buildCurlAuth(listener)
  return `curl -x ${scheme}://${auth}${formatCurlHost(listener.listen)}:${parsePort(listener.port)} ${TEST_URL}`
}

const buildCurlAuth = (listener) => {
  if (listener.authMode !== 'custom') return ''

  const user = buildUsers(listener)[0]
  if (!user) return ''

  return `${encodeURIComponent(user.username)}:${encodeURIComponent(user.password)}@`
}

const formatCurlHost = (listen) => {
  const host = normalizeListen(listen)
  if (host === '0.0.0.0') return '127.0.0.1'
  if (host === '::' || host === '[::]') return '[::1]'
  if (host.includes(':') && !host.startsWith('[')) return `[${host}]`
  return host
}

const makeListenerName = (listener) => {
  const slug = String(listener.name || listener.type || 'listener')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  const id = String(listener.id || createId()).replace(/[^\w-]+/g, '')

  return `${LISTENER_PREFIX}${slug || 'listener'}-${id}`
}

const createId = () => {
  return (Plugins.sampleID ? Plugins.sampleID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^\w-]/g, '')
}

const readSettings = async () => {
  try {
    const content = await Plugins.ReadFile(CONFIG_FILE)
    return JSON.parse(content || '{}')
  } catch {
    return {}
  }
}

const writeSettings = async (settings) => {
  if (!(await Plugins.FileExists('data/third'))) await Plugins.MakeDir('data/third')
  if (!(await Plugins.FileExists(PATH))) await Plugins.MakeDir(PATH)
  await Plugins.WriteFile(CONFIG_FILE, JSON.stringify(settings, null, 2))
}
