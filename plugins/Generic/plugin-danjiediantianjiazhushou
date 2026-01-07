// 单节点添加助手
window[Plugin.id] = window[Plugin.id] || {}
window[Plugin.id].selectedProfileId = null
window[Plugin.id].outbounds = []

const onRun = async () => {
  try {
    window[Plugin.id].outbounds = await selectProfile()
    home().open()
    return 0
  } catch (e) {
    console.error(e)
    return 1
  }
}

const selectProfile = async () => {
  const profilesStore = Plugins.useProfilesStore()
  if (!profilesStore) throw 'Profiles store not available'
  let profile = null
  if (profilesStore.profiles.length === 1) {
    profile = profilesStore.profiles[0]
  } else {
    profile = await Plugins.picker.single(
      '请选择要添加代理节点的配置',
      profilesStore.profiles.map((v) => ({ label: v.name, value: v })),
      [profilesStore.profiles[0]]
    )
  }
  window[Plugin.id].selectedProfileId = profile.id
  const outTags = await getOutTags(profile)
  return outTags
}

const getOutTags = async (profile) => {
  const config = await Plugins.generateConfig(profile)
  return config.outbounds
    .map((out) => {
      if (!['direct', 'block'].includes(out.type) && out.tag !== 'GLOBAL') return out.tag
      return null
    })
    .filter(Boolean)
}

const PROTOCOLS = [
  { value: 'socks5', label: 'Socks5' },
  { value: 'http', label: 'HTTP' },
  { value: 'vless', label: 'VLESS' },
  { value: 'vmess', label: 'VMess' },
  { value: 'shadowsocks', label: 'Shadowsocks' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'tuic', label: 'Tuic' }
]

const FIELD_SETS = {
  common: ['tag', 'server', 'server_port'],
  auth: ['username', 'password'],
  uuid: ['uuid'],
  ss: ['method', 'password'],
  network: ['network'],
  tls: ['tls_enable', 'tls_servername'],
  v2_extra: ['alterId', 'flow']
}

const home = () => {
  const { ref, h, computed } = Vue
  const component = {
    template: `
    <div style="padding:12px; width:100%">
      <div style="display:flex; gap:8px; align-items:flex-start; margin-bottom:10px;">
        <div style="flex:1">
          <div style="display:flex; gap:8px; margin:6px 0; align-items:center;">
            <select v-model="protocol">
              <option v-for="p in protocols" :value="p.value" :key="p.value">{{ p.label }}</option>
            </select>
            <input v-model="form.tag" placeholder="标签（可选）"/>
            <input v-model="form.server" placeholder="地址，例如 1.2.3.4 或 example.com"/>
          </div>

          <div style="display:flex; gap:8px; margin:6px 0;">
            <input v-model.number="form.server_port" placeholder="端口 1-65535" type="number"/>
            <input v-model="form.username" placeholder="用户名（部分协议）" v-if="showField('auth')"/>
            <input v-model="form.password" placeholder="密码/密钥（部分协议）" v-if="showField('auth') || showField('ss')"/>
          </div>

          <div style="display:flex; gap:8px; margin:6px 0;">
            <input v-model="form.uuid" placeholder="UUID（VLESS/VMess/TUIC）" v-if="showField('uuid')"/>
            <input v-model="form.method" placeholder="Method（Shadowsocks，例如 aes-256-gcm）" v-if="showField('ss')"/>
            <input v-model.number="form.alterId" placeholder="alterId（VMess，可选）" v-if="protocol==='vmess'"/>
            <input v-model="form.flow" placeholder="flow（VLESS 可选，例如 xtls-rprx-vision）" v-if="protocol==='vless'"/>
            <select v-model="form.network" v-if="showField('network')">
              <option value="tcp">tcp</option>
              <option value="ws">ws</option>
              <option value="grpc">grpc</option>
            </select>
          </div>

          <div style="display:flex; gap:8px; margin:6px 0;" v-if="showField('tls')">
            <label style="display:flex;align-items:center;gap:6px;">
              <input type="checkbox" v-model="form.tls_enable"/> TLS
            </label>
            <input v-model="form.tls_servername" placeholder="TLS ServerName（SNI，可选）" />
          </div>

          <div style="font-size:12px;color:#666;margin-top:8px;">
            根据协议显示对应字段。填写完后点击“生成并写入”将节点追加到当前配置的 outbounds，或点击“复制 JSON”手动导入。
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <Button type="primary" @click="onGenerate">生成并写入</Button>
          <Button @click="onCopy">复制 JSON</Button>
        </div>
      </div>

      <div style="margin-top:12px;">
        <div style="font-weight:600; margin-bottom:6px;">可用出站标签（来自当前配置）：</div>
        <div v-if="outList.length===0" style="font-size:12px;color:#666;">当前配置没有可用出站标签</div>
        <div v-else style="display:flex; gap:6px; flex-wrap:wrap;">
          <Button v-for="o in outList" :key="o" type="text" @click="insertTag(o)">{{ o }}</Button>
        </div>
      </div>

      <div style="margin-top:12px;">
        <div style="font-weight:600; margin-bottom:6px;">生成的节点 JSON：</div>
        <pre style="background:#f6f6f6;padding:10px;border-radius:6px;white-space:pre-wrap;">{{ output }}</pre>
      </div>
    </div>
    `,
    setup() {
      const protocols = PROTOCOLS
      const protocol = ref('socks5')
      const outList = window[Plugin.id].outbounds || []
      const output = ref('')

      const form = ref({
        tag: '',
        server: '',
        server_port: 1080,
        username: '',
        password: '',
        uuid: '',
        method: 'aes-256-gcm',
        network: 'tcp',
        tls_enable: false,
        tls_servername: '',
        alterId: 0,
        flow: ''
      })

      const showField = (name) => {
        // 根据当前协议决定是否显示某类字段
        const p = protocol.value
        if (name === 'auth') return ['socks5', 'http'].includes(p)
        if (name === 'uuid') return ['vless', 'vmess', 'tuic'].includes(p)
        if (name === 'ss') return p === 'shadowsocks'
        if (name === 'network') return ['vless', 'vmess', 'tuic', 'shadowsocks', 'http'].includes(p)
        if (name === 'tls') return ['vless', 'vmess', 'trojan', 'tuic'].includes(p)
        return false
      }

      const buildNode = () => {
        const p = protocol.value
        const f = form.value
        const tagVal = (f.tag || `${p}-${f.server}:${f.server_port}`).trim()
        const common = { type: p, tag: tagVal, server: (f.server || '').trim(), server_port: Number(f.server_port) || 0 }

        if (p === 'socks5' || p === 'http') {
          const node = { ...common, network: 'tcp' }
          if (f.username) node.username = f.username.trim()
          if (f.password) node.password = f.password.trim()
          return node
        }

        if (p === 'vless') {
          const node = {
            ...common,
            uuid: f.uuid.trim() || undefined,
            network: f.network || 'tcp',
            flow: f.flow || undefined,
            tls: f.tls_enable ? { servername: f.tls_servername || undefined } : {}
          }
          return node
        }

        if (p === 'vmess') {
          const node = {
            ...common,
            uuid: f.uuid.trim() || undefined,
            alterId: Number(f.alterId) || 0,
            network: f.network || 'tcp',
            tls: f.tls_enable ? { servername: f.tls_servername || undefined } : {}
          }
          return node
        }

        if (p === 'shadowsocks') {
          return {
            ...common,
            method: f.method || 'aes-256-gcm',
            password: f.password || undefined,
            network: 'tcp'
          }
        }

        if (p === 'trojan') {
          return {
            ...common,
            password: f.password || undefined,
            network: f.network || 'tcp',
            tls: f.tls_enable ? { servername: f.tls_servername || undefined } : {}
          }
        }

        if (p === 'tuic') {
          return {
            ...common,
            uuid: f.uuid.trim() || undefined,
            password: f.password || undefined,
            congestion_control: 'cubic',
            udp_relay_mode: 'native',
            udp_over_stream: false,
            zero_rtt_handshake: false,
            heartbeat: '10s',
            network: f.network || 'tcp',
            tls: f.tls_enable ? { servername: f.tls_servername || undefined } : {}
          }
        }

        return common
      }

      const validateNode = (n) => {
        if (!n.server) return '地址不能为空'
        if (!Number.isInteger(n.server_port) || n.server_port < 1 || n.server_port > 65535) return '端口必须为 1-65535 的整数'
        if (n.type === 'vless' || n.type === 'vmess' || n.type === 'tuic') {
          if (!n.uuid) return `${n.type.toUpperCase()} 需要 UUID`
        }
        if (n.type === 'trojan') {
          if (!n.password) return 'Trojan 需要密码'
        }
        if (n.type === 'shadowsocks') {
          if (!n.password) return 'Shadowsocks 需要密码'
          if (!n.method) return 'Shadowsocks 需要 method'
        }
        return null
      }

      const render = (n) => { output.value = JSON.stringify(n, null, 2) }

      const onGenerate = async () => {
        const node = buildNode()
        const err = validateNode(node)
        if (err) {
          Plugins.message.error(err)
          return
        }
        render(node)
        try {
          const profilesStore = Plugins.useProfilesStore()
          const profile = profilesStore.getProfileById(window[Plugin.id].selectedProfileId)
          const cfg = await Plugins.generateConfig(profile)
          cfg.outbounds.push(node)
          profile.outbounds = cfg.outbounds
          profilesStore.editProfile(profile.id, profile)
          Plugins.message.info('节点已写入当前配置的 outbounds（已添加至末尾）')
        } catch (e) {
          console.warn('写入配置失败，已在页面显示生成的 JSON', e)
          Plugins.message.warn('写入配置失败，请复制 JSON 手动导入')
        }
      }

      const onCopy = async () => {
        const node = buildNode()
        render(node)
        await Plugins.ClipboardSetText(output.value)
        Plugins.message.info('已复制到剪贴板')
      }

      const insertTag = (t) => { form.value.tag = t }

      return { protocols, protocol, form, outList, output, showField, onGenerate, onCopy, insertTag }
    }
  }

  const modal = Plugins.modal(
    {
      title: '多协议 动态字段 单节点助手',
      submit: false,
      width: '75',
      cancelText: '关闭',
      afterClose: () => { modal.destroy() }
    },
    { default: () => h(component) }
  )

  return modal
}

window[Plugin.id].onRun = onRun
