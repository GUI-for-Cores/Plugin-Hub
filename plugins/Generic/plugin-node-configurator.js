const PATH = 'data/third/node-configurator'
const ProxyUtilsFile = PATH + '/proxy-utils.esm.mjs'
let produce

/** @type {EsmPlugin} */
export default async (Plugin) => {
  await loadModule().catch(() => {})

  const Update = async () => {
    const { body } = await Plugins.HttpGet('https://api.github.com/repos/sub-store-org/Sub-Store/releases/latest')
    const url = body.assets.find((v) => v.uploader.login === 'github-actions[bot]' && v.name === 'proxy-utils.esm.mjs')?.browser_download_url
    if (!url) {
      Plugins.message.error('未找到依赖: proxy-utils.esm.mjs')
      return
    }
    await Plugins.Download(url, ProxyUtilsFile)
    await loadModule()
    Plugins.message.success('更新成功')
  }

  const onInstall = async () => {
    await Update()
  }

  const onUninstall = async () => {
    await Plugins.RemoveFile(PATH)
  }

  const onRun = async () => {
    openProxyConfigurator(Plugin)
    return 0
  }

  return { onInstall, onUninstall, onRun, Update }
}

const loadModule = async () => {
  const source = await Plugins.ReadFile(ProxyUtilsFile)
  const blob = new Blob([source], { type: 'text/javascript' })
  const url = URL.createObjectURL(blob)
  try {
    ;({ produce } = await import(url))
  } finally {
    URL.revokeObjectURL(url)
  }
}

const PROTOCOL_OPTIONS = [
  { label: 'Shadowsocks', value: 'ss' },
  { label: 'VMess', value: 'vmess' },
  { label: 'VLESS', value: 'vless' },
  { label: 'Trojan', value: 'trojan' },
  { label: 'Hysteria2', value: 'hysteria2' },
  { label: 'TUIC', value: 'tuic' },
  { label: 'HTTP / HTTPS', value: 'http' },
  { label: 'SOCKS5', value: 'socks5' },
  { label: 'WireGuard', value: 'wireguard' }
]

const NETWORK_OPTIONS = [
  { label: 'TCP', value: 'tcp' },
  { label: 'WebSocket', value: 'ws' },
  { label: 'HTTP', value: 'http' },
  { label: 'HTTP/2', value: 'h2' },
  { label: 'gRPC', value: 'grpc' },
  { label: 'XHTTP', value: 'xhttp' }
]

const SECURITY_OPTIONS = [
  { label: '无', value: 'none' },
  { label: 'TLS', value: 'tls' },
  { label: 'Reality', value: 'reality' }
]

const JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Proxy Parse Input Schema',
  type: 'object',
  required: ['type', 'name', 'server', 'port'],
  properties: {
    type: {
      title: '代理协议',
      description: '切换协议后，表单会自动显示该协议相关字段。',
      type: 'string',
      enum: PROTOCOL_OPTIONS.map((item) => item.value),
      default: 'vless',
      'ui:component': 'Select',
      'ui:options': PROTOCOL_OPTIONS
    },
    name: { title: '节点名称', type: 'string', default: 'My_Proxy', 'ui:component': 'Input' },
    server: { title: '服务器地址', type: 'string', default: 'example.com', 'ui:component': 'Input' },
    port: { title: '端口', type: 'integer', default: 443, 'ui:component': 'Input' },
    uuid: { title: 'UUID', type: 'string', default: '', 'ui:component': 'Input' },
    password: { title: '密码', type: 'string', default: '', 'ui:component': 'Input' },
    cipher: {
      title: '加密方式',
      type: 'string',
      default: 'auto',
      'ui:component': 'Select',
      'ui:options': ['auto', 'none', 'aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305'].map((v) => ({ label: v, value: v }))
    },
    alterId: { title: 'Alter ID', type: 'integer', default: 0, 'ui:component': 'Input' },
    flow: {
      title: 'VLESS Flow',
      type: 'string',
      default: '',
      'ui:component': 'Select',
      'ui:options': [
        { label: '不启用', value: '' },
        { label: 'xtls-rprx-vision', value: 'xtls-rprx-vision' }
      ]
    },
    network: { title: '传输层', type: 'string', default: 'tcp', 'ui:component': 'Select', 'ui:options': NETWORK_OPTIONS },
    security: { title: '安全层', type: 'string', default: 'tls', 'ui:component': 'Select', 'ui:options': SECURITY_OPTIONS },
    sni: { title: 'SNI / Server Name', type: 'string', default: '', 'ui:component': 'Input' },
    skipCertVerify: { title: '跳过证书验证', type: 'boolean', default: false, 'ui:component': 'Switch' },
    clientFingerprint: {
      title: 'TLS 指纹',
      type: 'string',
      default: '',
      'ui:component': 'Select',
      'ui:options': ['', 'chrome', 'firefox', 'safari', 'ios', 'android', 'edge', 'random'].map((v) => ({ label: v || '不设置', value: v }))
    },
    alpn: { title: 'ALPN', description: '多个值用英文逗号分隔，例如 h2,http/1.1。', type: 'string', default: '', 'ui:component': 'Input' },
    realityPublicKey: { title: 'Reality Public Key', type: 'string', default: '', 'ui:component': 'Input' },
    realityShortId: { title: 'Reality Short ID', type: 'string', default: '', 'ui:component': 'Input' },
    transportPath: { title: '传输路径 / Service Name', type: 'string', default: '/', 'ui:component': 'Input' },
    transportHost: { title: '传输 Host / Authority', type: 'string', default: '', 'ui:component': 'Input' },
    xhttpMode: {
      title: 'XHTTP 模式',
      type: 'string',
      default: 'auto',
      'ui:component': 'Select',
      'ui:options': ['auto', 'packet-up', 'stream-up', 'stream-one'].map((v) => ({ label: v, value: v }))
    },
    ssPlugin: {
      title: 'SS 插件',
      type: 'string',
      default: '',
      'ui:component': 'Select',
      'ui:options': [
        { label: '不启用', value: '' },
        { label: 'obfs', value: 'obfs' },
        { label: 'v2ray-plugin', value: 'v2ray-plugin' }
      ]
    },
    ssPluginMode: {
      title: '插件模式',
      type: 'string',
      default: 'websocket',
      'ui:component': 'Select',
      'ui:options': ['http', 'tls', 'websocket'].map((v) => ({ label: v, value: v }))
    },
    obfs: {
      title: '混淆类型',
      type: 'string',
      default: '',
      'ui:component': 'Select',
      'ui:options': [
        { label: '不启用', value: '' },
        { label: 'salamander', value: 'salamander' }
      ]
    },
    obfsPassword: { title: '混淆密码', type: 'string', default: '', 'ui:component': 'Input' },
    ports: { title: '端口跳跃', description: '例如 20000-50000 或 1000,2000。', type: 'string', default: '', 'ui:component': 'Input' },
    hopInterval: { title: '端口跳跃间隔', description: '支持数字或 15-30 区间。', type: 'string', default: '', 'ui:component': 'Input' },
    congestionControl: {
      title: '拥塞控制',
      type: 'string',
      default: 'bbr',
      'ui:component': 'Select',
      'ui:options': ['bbr', 'cubic', 'new_reno'].map((v) => ({ label: v, value: v }))
    },
    udpRelayMode: {
      title: 'UDP Relay Mode',
      type: 'string',
      default: 'native',
      'ui:component': 'Select',
      'ui:options': ['native', 'quic'].map((v) => ({ label: v, value: v }))
    },
    username: { title: '用户名', type: 'string', default: '', 'ui:component': 'Input' },
    tls: { title: '启用 TLS', type: 'boolean', default: false, 'ui:component': 'Switch' },
    privateKey: { title: 'Private Key', type: 'string', default: '', 'ui:component': 'Input' },
    publicKey: { title: 'Peer Public Key', type: 'string', default: '', 'ui:component': 'Input' },
    presharedKey: { title: 'Preshared Key', type: 'string', default: '', 'ui:component': 'Input' },
    ip: { title: '本机 IP/CIDR', description: '多个地址用逗号分隔。', type: 'string', default: '', 'ui:component': 'Input' },
    dns: { title: 'DNS', description: '多个 DNS 用逗号分隔。', type: 'string', default: '', 'ui:component': 'Input' },
    mtu: { title: 'MTU', type: 'integer', default: '', 'ui:component': 'Input' },
    reserved: { title: 'Reserved', description: 'WireGuard reserved 数组，例如 1,2,3。', type: 'string', default: '', 'ui:component': 'Input' },
    udp: { title: 'UDP', type: 'boolean', default: true, 'ui:component': 'Switch' },
    tfo: { title: 'TCP Fast Open', type: 'boolean', default: false, 'ui:component': 'Switch' }
  },
  allOf: [
    { if: { properties: { type: { const: 'ss' } } }, then: { required: ['cipher', 'password'] } },
    { if: { properties: { type: { const: 'vmess' } } }, then: { required: ['uuid'] } },
    { if: { properties: { type: { const: 'vless' } } }, then: { required: ['uuid'] } },
    { if: { properties: { type: { const: 'trojan' } } }, then: { required: ['password'] } },
    { if: { properties: { type: { const: 'hysteria2' } } }, then: { required: ['password'] } },
    { if: { properties: { type: { const: 'tuic' } } }, then: { required: ['uuid', 'password'] } },
    { if: { properties: { type: { const: 'wireguard' } } }, then: { required: ['privateKey', 'publicKey', 'ip'] } }
  ]
}

const COMMON_FIELDS = ['type', 'name', 'server', 'port']
const TYPE_FIELDS = {
  ss: ['cipher', 'password', 'ssPlugin', 'udp', 'tfo'],
  vmess: ['uuid', 'cipher', 'alterId', 'network', 'security', 'udp', 'tfo'],
  vless: ['uuid', 'flow', 'network', 'security', 'udp', 'tfo'],
  trojan: ['password', 'network', 'security', 'udp', 'tfo'],
  hysteria2: ['password', 'obfs', 'ports', 'hopInterval', 'sni', 'skipCertVerify', 'alpn', 'udp'],
  tuic: ['uuid', 'password', 'congestionControl', 'udpRelayMode', 'sni', 'skipCertVerify', 'alpn'],
  http: ['username', 'password', 'tls', 'skipCertVerify'],
  socks5: ['username', 'password', 'tls', 'udp'],
  wireguard: ['privateKey', 'publicKey', 'presharedKey', 'ip', 'dns', 'mtu', 'reserved', 'udp']
}

const TRANSPORT_FIELDS = ['transportPath', 'transportHost']
const SECURITY_FIELDS = ['sni', 'skipCertVerify', 'clientFingerprint', 'alpn']
const REALITY_FIELDS = ['sni', 'clientFingerprint', 'realityPublicKey', 'realityShortId']

const DEFAULT_FORM = Object.fromEntries(Object.entries(JSON_SCHEMA.properties).map(([key, schema]) => [key, cloneDefault(schema.default)]))

const TYPE_DEFAULTS = {
  ss: { port: 8388, cipher: 'chacha20-ietf-poly1305', security: 'none', network: 'tcp' },
  vmess: { port: 443, cipher: 'auto', alterId: 0, network: 'ws', security: 'tls', transportPath: '/', udp: true },
  vless: { port: 443, network: 'ws', security: 'tls', transportPath: '/', udp: true },
  trojan: { port: 443, network: 'tcp', security: 'tls', udp: true },
  hysteria2: { port: 443, security: 'tls', udp: true },
  tuic: { port: 443, security: 'tls', congestionControl: 'bbr', udpRelayMode: 'native' },
  http: { port: 8080, tls: false, security: 'none', udp: false },
  socks5: { port: 1080, tls: false, security: 'none', udp: true },
  wireguard: { port: 51820, udp: true, security: 'none' }
}

const PRODUCE_TARGET_OPTIONS = [
  { label: 'Mihomo', value: 'mihomo' },
  { label: 'sing-box', value: 'sing-box' },
  { label: 'V2Ray Base64', value: 'v2ray' },
  { label: 'URI 分享链接', value: 'URI' },
  { label: 'Shadowrocket', value: 'Shadowrocket' },
  { label: 'Quantumult X', value: 'QX' },
  { label: 'Loon', value: 'Loon' },
  { label: 'Surge', value: 'Surge' },
  { label: 'JSON', value: 'JSON' }
]

function openProxyConfigurator(Plugin) {
  const { h, ref, reactive, computed, watch, defineComponent } = Vue

  const state = reactive({ ...DEFAULT_FORM })
  applyTypeDefaults(state.type, state)

  const defaultTarget = getDefaultProduceTarget()
  const produceTarget = ref(defaultTarget)
  const outputFormat = ref(getDefaultOutputFormat(produceTarget.value))
  const rawJson = ref(JSON.stringify(buildProxy(state), null, 2))
  const syncRawWithForm = ref(true)
  const generatedJson = computed(() => JSON.stringify(buildProxy(state), null, 2))
  const validation = computed(() => validateState(state))
  const activeKeys = computed(() => getActiveKeys(state))
  const activeFields = computed(() => activeKeys.value.map((key) => ({ key, schema: JSON_SCHEMA.properties[key] })).filter((item) => item.schema))
  const producePreview = computed(() => buildProducePreview(rawJson.value, produceTarget.value, outputFormat.value))

  watch(
    () => state.type,
    (type) => applyTypeDefaults(type, state)
  )

  watch(generatedJson, (value) => {
    if (syncRawWithForm.value) rawJson.value = value
  })

  const component = defineComponent({
    template: /* html */ `
      <div class="proxy-configurator pr-8">
        <div class="hero-card">
          <div>
            <div class="eyebrow">JSON Schema Driven</div>
            <div class="hero-title">节点配置器</div>
            <div class="hero-desc">根据协议生成 ProxyUtils 可识别的 JSON 节点，并实时 produce 到目标客户端。</div>
          </div>
        </div>

        <div class="layout-grid mt-12">
          <Card title="协议表单">
            <template #title-suffix>
              <Tag color="primary" size="small">{{ state.type }}</Tag>
            </template>

            <div class="form-grid">
              <div v-for="field in activeFields" :key="field.key" class="field-card">
                <div class="field-label">
                  <span>{{ field.schema.title }}</span>
                  <Tag v-if="isRequired(field.key)" color="red" size="small">必填</Tag>
                </div>
                <div v-if="field.schema.description" class="field-desc">{{ field.schema.description }}</div>

                <Select v-if="field.schema['ui:component'] === 'Select'" v-model="state[field.key]" :options="field.schema['ui:options']" />
                <Switch v-else-if="field.schema['ui:component'] === 'Switch'" v-model="state[field.key]" />
                <Input v-else v-model="state[field.key]" :placeholder="String(field.schema.default ?? '')" />
              </div>
            </div>

            <div v-if="validation.errors.length" class="notice error mt-12">
              <div class="notice-title">需要补齐</div>
              <div v-for="item in validation.errors" :key="item">{{ item }}</div>
            </div>
            <div v-else class="notice ok mt-12">
              当前表单已满足 schema 必填规则，当前 json 可直接作为 Sub-Store 输入。
            </div>
          </Card>

          <div class="flex flex-col gap-12">
            <Card title="ProxyUtils.parse() 输入 JSON">
              <template #extra>
                <Button v-if="!syncRawWithForm" type="link" @click="useFormJson">重新跟随表单</Button>
              </template>
              <CodeViewer v-model="rawJson" @change="markRawEdited" lang="json" editable style="min-height: 260px; border-radius: 8px; overflow: hidden" />
              <div class="tip-box mt-12">
                支持单个节点对象、节点数组，或 <code>{ "proxies": [...] }</code>。手动编辑后会立刻驱动下方 produce 预览。
              </div>
            </Card>

            <Card title="ProxyUtils.produce() 输出">
              <template #extra>
                <div class="flex items-center gap-8">
                  <Select v-model="produceTarget" :options="produceTargetOptions" />
                  <Radio v-model="outputFormat" :options="outputFormatOptions" />
                  <Button type="primary" @click="copyProduceOutput">复制输出</Button>
                </div>
              </template>

              <CodeViewer :model-value="producePreview" :lang="produceLang" style="min-height: 320px; border-radius: 8px; overflow: hidden" />
            </Card>
          </div>
        </div>
      </div>
    `,
    setup() {
      const produceTargetOptions = PRODUCE_TARGET_OPTIONS
      const outputFormatOptions = [
        { label: 'YAML', value: 'yaml' },
        { label: 'JSON', value: 'json' }
      ]
      const produceLang = computed(() => outputFormat.value)
      const isRequired = (key) => getRequiredKeys(state).includes(key)

      const markRawEdited = () => {
        syncRawWithForm.value = rawJson.value === generatedJson.value
      }

      const useFormJson = () => {
        syncRawWithForm.value = true
        rawJson.value = generatedJson.value
        Plugins.message.info('parse 输入已重新跟随表单')
      }

      const copyProduceOutput = async () => {
        await Plugins.ClipboardSetText(producePreview.value)
        Plugins.message.success('已复制 produce 输出')
      }

      return {
        state,
        activeFields,
        validation,
        rawJson,
        produceTarget,
        produceTargetOptions,
        outputFormat,
        outputFormatOptions,
        producePreview,
        produceLang,
        syncRawWithForm,
        isRequired,
        markRawEdited,
        useFormJson,
        copyProduceOutput
      }
    }
  })

  const modal = Plugins.modal(
    {
      title: Plugin?.name || '节点配置器',
      width: '92',
      height: '88',
      submit: false,
      cancelText: '关闭',
      afterClose: () => modal.destroy()
    },
    {
      default: () => h(component)
    }
  )

  injectStyle()
  modal.open()
}

function getActiveKeys(state) {
  const keys = [...COMMON_FIELDS, ...(TYPE_FIELDS[state.type] || [])]

  if (['vmess', 'vless', 'trojan'].includes(state.type) && state.network && state.network !== 'tcp') {
    keys.push(...TRANSPORT_FIELDS)
  }
  if (state.network === 'xhttp') {
    keys.push('xhttpMode')
  }
  if (['vmess', 'vless', 'trojan'].includes(state.type)) {
    if (state.security === 'tls') keys.push(...SECURITY_FIELDS)
    if (state.security === 'reality') keys.push(...REALITY_FIELDS)
  }
  if (state.type === 'ss' && state.ssPlugin) {
    keys.push('ssPluginMode', 'transportHost', 'transportPath')
  }
  if (state.type === 'hysteria2' && state.obfs) {
    keys.push('obfsPassword')
  }

  return [...new Set(keys)]
}

function getRequiredKeys(state) {
  const required = [...JSON_SCHEMA.required]
  const matched = JSON_SCHEMA.allOf.find((rule) => rule.if?.properties?.type?.const === state.type)
  if (matched?.then?.required) required.push(...matched.then.required)
  if (state.type === 'ss' && state.ssPlugin) required.push('transportHost')
  if (state.type === 'hysteria2' && state.obfs) required.push('obfsPassword')
  if (state.security === 'reality') required.push('realityPublicKey')
  return [...new Set(required)].filter((key) => getActiveKeys(state).includes(key))
}

function validateState(state) {
  const errors = []
  for (const key of getRequiredKeys(state)) {
    const value = state[key]
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      errors.push(`${JSON_SCHEMA.properties[key]?.title || key} 不能为空`)
    }
  }
  const port = Number(state.port)
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('端口必须是 1-65535 的整数')
  return { valid: errors.length === 0, errors }
}

function buildProxy(state) {
  const proxy = pickBase(state)

  if (state.type === 'ss') {
    proxy.cipher = text(state.cipher)
    proxy.password = text(state.password)
    if (state.ssPlugin) {
      proxy.plugin = state.ssPlugin
      proxy['plugin-opts'] = compactObject({
        mode: state.ssPluginMode,
        host: text(state.transportHost),
        path: normalizePath(state.transportPath),
        tls: state.ssPlugin === 'v2ray-plugin' && ['tls', 'websocket'].includes(state.ssPluginMode) ? true : undefined
      })
    }
  }

  if (state.type === 'vmess') {
    proxy.uuid = text(state.uuid)
    proxy.cipher = text(state.cipher) || 'auto'
    proxy.alterId = toNumber(state.alterId, 0)
    applyTransport(proxy, state)
    applySecurity(proxy, state)
  }

  if (state.type === 'vless') {
    proxy.uuid = text(state.uuid)
    if (state.flow) proxy.flow = text(state.flow)
    applyTransport(proxy, state)
    applySecurity(proxy, state)
  }

  if (state.type === 'trojan') {
    proxy.password = text(state.password)
    applyTransport(proxy, state)
    applySecurity(proxy, state)
  }

  if (state.type === 'hysteria2') {
    proxy.password = text(state.password)
    proxy.sni = text(state.sni) || undefined
    proxy['skip-cert-verify'] = boolOrUndefined(state.skipCertVerify)
    proxy.alpn = splitCsv(state.alpn)
    proxy.obfs = text(state.obfs) || undefined
    proxy['obfs-password'] = state.obfs ? text(state.obfsPassword) : undefined
    proxy.ports = text(state.ports) || undefined
    proxy['hop-interval'] = text(state.hopInterval) || undefined
  }

  if (state.type === 'tuic') {
    proxy.uuid = text(state.uuid)
    proxy.password = text(state.password)
    proxy.sni = text(state.sni) || undefined
    proxy['skip-cert-verify'] = boolOrUndefined(state.skipCertVerify)
    proxy.alpn = splitCsv(state.alpn)
    proxy['congestion-controller'] = text(state.congestionControl) || undefined
    proxy['udp-relay-mode'] = text(state.udpRelayMode) || undefined
  }

  if (['http', 'socks5'].includes(state.type)) {
    proxy.username = text(state.username) || undefined
    proxy.password = text(state.password) || undefined
    proxy.tls = !!state.tls || undefined
    proxy['skip-cert-verify'] = state.tls ? boolOrUndefined(state.skipCertVerify) : undefined
  }

  if (state.type === 'wireguard') {
    proxy['private-key'] = text(state.privateKey)
    proxy['public-key'] = text(state.publicKey)
    proxy['preshared-key'] = text(state.presharedKey) || undefined
    proxy.ip = splitCsv(state.ip)
    proxy.dns = splitCsv(state.dns)
    proxy.mtu = toNumber(state.mtu)
    proxy.reserved = splitCsv(state.reserved)
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v))
    if (!proxy.reserved.length) delete proxy.reserved
  }

  proxy.udp = state.udp === false ? false : state.udp === true ? true : undefined
  proxy.tfo = boolOrUndefined(state.tfo)

  return compactObject(proxy)
}

function pickBase(state) {
  return compactObject({
    name: text(state.name),
    type: state.type,
    server: text(state.server),
    port: toNumber(state.port)
  })
}

function applyTransport(proxy, state) {
  proxy.network = state.network || 'tcp'
  if (!proxy.network || proxy.network === 'tcp') return

  const host = text(state.transportHost)
  const path = normalizePath(state.transportPath)
  if (proxy.network === 'ws') {
    proxy['ws-opts'] = compactObject({ path, headers: host ? { Host: host } : undefined })
  } else if (proxy.network === 'grpc') {
    proxy['grpc-opts'] = compactObject({ 'grpc-service-name': text(state.transportPath), 'grpc-service-name-separator': undefined })
  } else if (proxy.network === 'http') {
    proxy['http-opts'] = compactObject({ path: path ? [path] : undefined, headers: host ? { Host: [host] } : undefined })
  } else if (proxy.network === 'h2') {
    proxy['h2-opts'] = compactObject({ path, host: host ? [host] : undefined })
  } else if (proxy.network === 'xhttp') {
    proxy['xhttp-opts'] = compactObject({ path, host, mode: state.xhttpMode || undefined })
  }
}

function applySecurity(proxy, state) {
  if (state.security === 'tls' || state.security === 'reality') {
    proxy.tls = true
    proxy.sni = text(state.sni) || undefined
    proxy['skip-cert-verify'] = boolOrUndefined(state.skipCertVerify)
    proxy['client-fingerprint'] = text(state.clientFingerprint) || undefined
    proxy.alpn = splitCsv(state.alpn)
  }
  if (state.security === 'reality') {
    proxy['reality-opts'] = compactObject({
      'public-key': text(state.realityPublicKey),
      'short-id': text(state.realityShortId) || undefined
    })
  }
}

function applyTypeDefaults(type, state) {
  const defaults = TYPE_DEFAULTS[type] || {}
  for (const [key, value] of Object.entries(defaults)) {
    if (state[key] == null || state[key] === '' || key === 'port' || key === 'security' || key === 'network') {
      state[key] = cloneDefault(value)
    }
  }
}

function compactObject(obj) {
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete obj[key]
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      compactObject(value)
      if (Object.keys(value).length === 0) delete obj[key]
    }
  }
  return obj
}

function normalizePath(value) {
  const path = text(value)
  if (!path) return undefined
  if (path === '/') return '/'
  return path.startsWith('/') ? path : `/${path}`
}

function splitCsv(value) {
  return text(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toNumber(value, fallback) {
  if (value === '' || value == null) return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function text(value) {
  return `${value ?? ''}`.trim()
}

function boolOrUndefined(value) {
  return value ? true : undefined
}

function cloneDefault(value) {
  if (Array.isArray(value)) return [...value]
  if (value && typeof value === 'object') return { ...value }
  return value
}

function getDefaultProduceTarget() {
  return Plugins.APP_TITLE?.includes('SingBox') ? 'sing-box' : 'mihomo'
}

function getDefaultOutputFormat(target) {
  return ['mihomo', 'Clash', 'Surge', 'Loon'].includes(target) ? 'yaml' : 'json'
}

function normalizeInputProxies(rawJson) {
  const parsed = JSON.parse(rawJson)
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed?.proxies)) return parsed.proxies
  if (Array.isArray(parsed?.outbounds)) return parsed.outbounds
  return [parsed]
}

function buildProducePreview(rawJson, target, format) {
  if (!produce) return '请右键更新依赖，下载 proxy-utils.esm.mjs 后即可实时 produce。'
  try {
    const proxies = normalizeInputProxies(rawJson)
    const result = produce(JSON.parse(JSON.stringify(proxies)), target, 'internal', { prettyYaml: true })
    return formatProduceResult(result, target, format)
  } catch (e) {
    return `输入 JSON 或 produce 失败：${e?.message || e}`
  }
}

function formatProduceResult(result, target, format) {
  if (typeof result === 'string') return format === 'json' ? JSON.stringify(result, null, 2) : result
  if (format === 'yaml') return Plugins.YAML.stringify(wrapYamlOutput(result, target))
  return JSON.stringify(result, null, 2)
}

function wrapYamlOutput(result, target) {
  if (!Array.isArray(result)) return result
  if (['mihomo', 'Clash', 'Surge', 'Loon'].includes(target)) return { proxies: result }
  return result
}

function injectStyle() {
  if (document.getElementById('proxy-protocol-configurator-style')) return
  const style = document.createElement('style')
  style.id = 'proxy-protocol-configurator-style'
  style.textContent = `
.proxy-configurator { color: var(--color-text-1, #1f2937); }
.proxy-configurator .hero-card { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 18px; border-radius: 18px; background: linear-gradient(135deg, #f7efe2 0%, #e7f4ee 54%, #e6eef8 100%); border: 1px solid rgba(70, 94, 82, 0.18); box-shadow: 0 12px 28px rgba(49, 68, 58, 0.08); }
.proxy-configurator .eyebrow { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #5f7f6c; font-weight: 700; }
.proxy-configurator .hero-title { font-size: 24px; line-height: 1.2; font-weight: 800; color: #23352b; margin-top: 4px; }
.proxy-configurator .hero-desc { margin-top: 6px; color: #526158; line-height: 1.6; }
.proxy-configurator .layout-grid { display: grid; grid-template-columns: minmax(360px, 0.95fr) minmax(420px, 1.05fr); gap: 12px; align-items: start; }
.proxy-configurator .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.proxy-configurator .field-card { padding: 10px; border-radius: 12px; background: rgba(255, 255, 255, 0.66); border: 1px solid rgba(100, 116, 139, 0.18); }
.proxy-configurator .field-label { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; margin-bottom: 6px; }
.proxy-configurator .field-desc { color: #6b7280; font-size: 12px; line-height: 1.5; margin-bottom: 6px; }
.proxy-configurator .notice { border-radius: 12px; padding: 10px 12px; line-height: 1.6; }
.proxy-configurator .notice.error { background: #fff1f0; color: #9f2a24; border: 1px solid #ffd2ce; }
.proxy-configurator .notice.ok { background: #edf9f1; color: #236b3d; border: 1px solid #cdeed7; }
.proxy-configurator .notice-title { font-weight: 800; margin-bottom: 2px; }
.proxy-configurator .tip-box { padding: 10px 12px; border-radius: 12px; background: #f8fafc; border: 1px dashed #cbd5e1; color: #475569; line-height: 1.7; }
.proxy-configurator code { padding: 1px 5px; border-radius: 5px; background: rgba(15, 23, 42, 0.08); }
@media (max-width: 980px) { .proxy-configurator .layout-grid { grid-template-columns: 1fr; } .proxy-configurator .form-grid { grid-template-columns: 1fr; } .proxy-configurator .hero-card { align-items: flex-start; flex-direction: column; } }
`
  document.head.appendChild(style)
}
