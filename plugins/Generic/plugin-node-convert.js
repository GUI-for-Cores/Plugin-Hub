/**
 * 本插件使用项目：SubStore中节点转换相关功能，具体看下面引用的源码
 */

/**
 * 订阅上下文菜单 - 导出为URI
 */
const ExportAsURI = async (subscription) => {
  const proxies = await getClashProxies(subscription)
  const v2ray_proxies = ProxyUtils.produce(proxies, 'v2ray', 'internal')
  await Plugins.ClipboardSetText(v2ray_proxies)
  Plugins.message.success('已复制')
}

/**
 * 订阅上下文菜单 - 导出为clash
 */
const ExportAsClash = async (subscription) => {
  const proxies = await getClashProxies(subscription)
  await Plugins.ClipboardSetText(JSON.stringify(proxies))
  Plugins.message.success('已复制')
}

/**
 * 订阅上下文菜单 - 导出为sing-box
 */
const ExportAsSingBox = async (subscription) => {
  const proxies = await getClashProxies(subscription)
  const singbox_proxies = ProxyUtils.produce(proxies, 'singbox', 'internal')
  await Plugins.ClipboardSetText(JSON.stringify(singbox_proxies))
  Plugins.message.success('已复制')
}

/**
 * 获取clash格式的节点
 */
const getClashProxies = async (subscription) => {
  let sub_path = subscription.path
  if (Plugins.APP_TITLE.includes('SingBox')) {
    const tmp = 'data/.cache/tmp_subscription_' + subscription.id
    if (!(await Plugins.FileExists(tmp))) {
      await Plugins.alert(
        '提示',
        '你需要先更新此订阅，才能继续使用本功能！\n\n\n一直看见本提示？请`编辑`订阅在请求头中添加`User-Agent`=`clash.meta`后再更新订阅。\n\n注：手动管理的订阅不支持导出',
        {
          type: 'markdown'
        }
      )
      return
    }
    sub_path = tmp
  }
  const { proxies } = Plugins.YAML.parse(await Plugins.Readfile(sub_path))
  return proxies
}

/**
 * 插件钩子：点击运行按钮时
 */
const onRun = async () => {
  const input = await Plugins.prompt('请输入分享链接：', '', { placeholder: '(ss|ssr|vmess|vless|hysteria2|hysteria|tuic|wireguard|trojan)://', type: 'code' })

  const mihomo_proxies = ProxyUtils.parse(input)
  const singbox_proxies = ProxyUtils.produce(mihomo_proxies, 'singbox', 'internal')
  const v2ray_proxies = ProxyUtils.produce(mihomo_proxies, 'v2ray', 'internal')

  const platform = await Plugins.picker.single('请选择格式', [
    { label: 'Mihomo格式', value: 'mihomo' },
    { label: 'SingBox格式', value: 'singbox' },
    { label: 'v2Ray格式', value: 'v2ray' }
  ])

  // prettier-ignore
  const result = platform == 'singbox' ? JSON.stringify(singbox_proxies, null, 2) : platform == 'mihomo' ? Plugins.YAML.stringify(mihomo_proxies) : v2ray_proxies

  await Plugins.confirm('转换结果如下', result)
}

/**
 * 插件钩子：更新订阅时
 */
const onSubscribe = async (proxies, subscription) => {
  const isBase64 = proxies.length === 1 && proxies[0].base64

  // 如果是v2ray分享链接，则转为clash格式
  if (isBase64) {
    proxies = ProxyUtils.parse(proxies[0].base64)
  }

  const isClashProxies = proxies.some((proxy) => proxy.name && !proxy.tag)

  const isGFS = Plugins.APP_TITLE.includes('SingBox')

  // 缓存clash格式，导出URI时需要此格式
  if (isClashProxies && isGFS) {
    const tmp = 'data/.cache/tmp_subscription_' + subscription.id
    Plugins.Writefile(tmp, Plugins.YAML.stringify({ proxies }))
  }

  // 如果是clash格式，并且是GFS，则转为sing-box格式
  if (isClashProxies && isGFS) {
    proxies = ProxyUtils.produce(proxies, 'singbox', 'internal')
  }

  if (isGFS) {
    // 移除暂未适配的字段
    proxies.forEach((proxy) => {
      delete proxy.domain_resolver
    })
  }

  return proxies
}

// =======================================================================================================================
//                                      以下是兼容SubStore API的一些处理
// =======================================================================================================================

const Base64 = {
  decode: Plugins.base64Decode,
  encode: Plugins.base64Encode
}

const Buffer = {
  from(str) {
    return {
      toString(label) {
        return new TextDecoder(label).decode(new TextEncoder().encode(str))
      }
    }
  }
}

const rs = {
  generateFingerprint(caStr) {
    // SHA-256 实现（简化版，来源于公共实现）
    function sha256Sync(ascii) {
      const K = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
      ])

      let h0 = 0x6a09e667,
        h1 = 0xbb67ae85,
        h2 = 0x3c6ef372,
        h3 = 0xa54ff53a,
        h4 = 0x510e527f,
        h5 = 0x9b05688c,
        h6 = 0x1f83d9ab,
        h7 = 0x5be0cd19

      const msg = new TextEncoder().encode(ascii)
      const l = msg.length * 8

      const withOne = new Uint8Array(((msg.length + 9 + 63) >> 6) << 6)
      withOne.set(msg)
      withOne[msg.length] = 0x80

      const view = new DataView(withOne.buffer)
      view.setUint32(withOne.length - 4, l, false)

      for (let i = 0; i < withOne.length; i += 64) {
        const w = new Uint32Array(64)
        for (let j = 0; j < 16; j++) {
          w[j] = view.getUint32(i + j * 4, false)
        }
        for (let j = 16; j < 64; j++) {
          const s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3)
          const s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10)
          w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0
        }

        let a = h0,
          b = h1,
          c = h2,
          d = h3,
          e = h4,
          f = h5,
          g = h6,
          h = h7

        for (let j = 0; j < 64; j++) {
          const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))
          const ch = (e & f) ^ (~e & g)
          const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0
          const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))
          const maj = (a & b) ^ (a & c) ^ (b & c)
          const temp2 = (S0 + maj) >>> 0

          h = g
          g = f
          f = e
          e = (d + temp1) >>> 0
          d = c
          c = b
          b = a
          a = (temp1 + temp2) >>> 0
        }

        h0 = (h0 + a) >>> 0
        h1 = (h1 + b) >>> 0
        h2 = (h2 + c) >>> 0
        h3 = (h3 + d) >>> 0
        h4 = (h4 + e) >>> 0
        h5 = (h5 + f) >>> 0
        h6 = (h6 + g) >>> 0
        h7 = (h7 + h) >>> 0
      }

      return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, '0')).join('')
    }

    // PEM -> binary string
    function pemToBinary(pem) {
      return atob(
        pem
          .replace(/-----BEGIN CERTIFICATE-----/, '')
          .replace(/-----END CERTIFICATE-----/, '')
          .replace(/\s+/g, '')
      )
    }

    // binary string -> hex
    function binaryToHex(str) {
      return Array.from(str)
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    }

    const binary = pemToBinary(caStr)
    const hex = binaryToHex(binary)
    const hashHex = sha256Sync(hex)
    return hashHex.match(/.{2}/g).join(':').toUpperCase()
  }
}

const safeLoad = Plugins.YAML.parse

const URI = URI_Producer()

const PROXY_PRODUCERS = {
  v2ray: V2Ray_Producer(),
  mihomo: ClashMeta_Producer(),
  singbox: Singbox_Producer()
}

const $ = {
  info: (msg) => {
    console.log(`[${Plugin.name}]`, msg)
  },
  error: (msg) => {
    console.log(`[${Plugin.name}]`, msg)
  },
  log: (msg) => {
    console.log(`[${Plugin.name}]`, msg)
  }
}

const getTrojanURIParser = () => {
  const parse = (line) => {
    const [_, body] = line.split('://')
    const url = new URL('http://' + body)
    const query = url.searchParams
    const trojan = {
      name: decodeURIComponent(url.hash.slice(1)),
      type: 'trojan',
      server: url.hostname,
      port: Number(url.port),
      password: url.username,
      udp: true,
      'skip-cert-verify': Boolean(query.get('allowInsecure'))
    }
    if (query.get('alpn')) {
      trojan['alpn'] = query.get('alpn').split(',')
    }
    if (query.get('sni')) {
      trojan.sni = query.get('sni')
    }
    const network = query.get('type')?.toLowerCase()
    if (network) {
      trojan.network = network
    }
    switch (network) {
      case 'ws': {
        const wsOpts = {
          path: query.get('path'),
          headers: {
            'User-Agent': ''
          }
        }
        trojan['ws-opts'] = wsOpts
        break
      }
      case 'grpc': {
        trojan['grpc-opts'] = {
          'grpc-service-name': query.get('serviceName')
        }
        break
      }
    }
    trojan['client-fingerprint'] = query.get('fp') || 'chrome'
    return trojan
  }

  return { parse }
}

// =======================================================================================================================
//                                      以下是Sub-Store仓库中关于解析节点uri的相关源码
//                                  添加了一些注释，记录从哪个文件而来、以及是否做了一些修改
// =======================================================================================================================

/**
 * 说明：工具类方法
 * 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/utils/index.js
 * 修改：isPresent方法
 */

// source: https://stackoverflow.com/a/36760050
const IPV4_REGEX = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)(\.(?!$)|$)){4}$/

// source: https://ihateregex.io/expr/ipv6/
const IPV6_REGEX =
  /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/

function isIPv4(ip) {
  return IPV4_REGEX.test(ip)
}

function isIPv6(ip) {
  return IPV6_REGEX.test(ip)
}

function isNotBlank(str) {
  return typeof str === 'string' && str.trim().length > 0
}

function getIfNotBlank(str, defaultValue) {
  return isNotBlank(str) ? str : defaultValue
}

function isPresent(obj) {
  if (arguments.length === 1) {
    return typeof obj !== 'undefined' && obj !== null
  } else if (arguments.length === 2) {
    let attr = arguments[1]
    const keys = Array.isArray(attr) ? attr : attr.split('.').filter(Boolean)
    let result = obj
    for (const key of keys) {
      if (result == null || typeof result !== 'object') {
        return false
      }
      result = result[key]
    }
    return result !== undefined && result !== null
  }
}

function getIfPresent(obj, defaultValue) {
  return isPresent(obj) ? obj : defaultValue
}

function isValidUUID(uuid) {
  return typeof uuid === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(uuid)
}

function isValidPortNumber(port) {
  return /^((6553[0-5])|(655[0-2][0-9])|(65[0-4][0-9]{2})|(6[0-4][0-9]{3})|([1-5][0-9]{4})|([0-5]{0,5})|([0-9]{1,4}))$/.test(port)
}

function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomPort(portString) {
  let portParts = portString.split(/,|\//)
  let randomPart = portParts[Math.floor(Math.random() * portParts.length)]
  if (randomPart.includes('-')) {
    let [min, max] = randomPart.split('-').map(Number)
    return getRandomInt(min, max)
  } else {
    return Number(randomPart)
  }
}

function numberToString(value) {
  return Number.isSafeInteger(value) ? String(value) : BigInt(value).toString()
}

/**
 * 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/producers/clashmeta.js
 */
function ClashMeta_Producer() {
  const ipVersions = {
    dual: 'dual',
    'v4-only': 'ipv4',
    'v6-only': 'ipv6',
    'prefer-v4': 'ipv4-prefer',
    'prefer-v6': 'ipv6-prefer'
  }

  const type = 'ALL'
  const produce = (proxies, type, opts = {}) => {
    const list = proxies
      .filter((proxy) => {
        if (opts['include-unsupported-proxy']) return true
        if (proxy.type === 'snell' && proxy.version >= 4) {
          return false
        } else if (['juicity'].includes(proxy.type)) {
          return false
        } else if (
          ['ss'].includes(proxy.type) &&
          ![
            'aes-128-ctr',
            'aes-192-ctr',
            'aes-256-ctr',
            'aes-128-cfb',
            'aes-192-cfb',
            'aes-256-cfb',
            'aes-128-gcm',
            'aes-192-gcm',
            'aes-256-gcm',
            'aes-128-ccm',
            'aes-192-ccm',
            'aes-256-ccm',
            'aes-128-gcm-siv',
            'aes-256-gcm-siv',
            'chacha20-ietf',
            'chacha20',
            'xchacha20',
            'chacha20-ietf-poly1305',
            'xchacha20-ietf-poly1305',
            'chacha8-ietf-poly1305',
            'xchacha8-ietf-poly1305',
            '2022-blake3-aes-128-gcm',
            '2022-blake3-aes-256-gcm',
            '2022-blake3-chacha20-poly1305',
            'lea-128-gcm',
            'lea-192-gcm',
            'lea-256-gcm',
            'rabbit128-poly1305',
            'aegis-128l',
            'aegis-256',
            'aez-384',
            'deoxys-ii-256-128',
            'rc4-md5',
            'none'
          ].includes(proxy.cipher)
        ) {
          // https://wiki.metacubex.one/config/proxies/ss/#cipher
          return false
        } else if (
          ['anytls'].includes(proxy.type) &&
          proxy.network &&
          (!['tcp'].includes(proxy.network) || (['tcp'].includes(proxy.network) && proxy['reality-opts']))
        ) {
          return false
        }
        return true
      })
      .map((proxy) => {
        if (proxy.type === 'vmess') {
          // handle vmess aead
          if (isPresent(proxy, 'aead')) {
            if (proxy.aead) {
              proxy.alterId = 0
            }
            delete proxy.aead
          }
          if (isPresent(proxy, 'sni')) {
            proxy.servername = proxy.sni
            delete proxy.sni
          }
          // https://github.com/MetaCubeX/Clash.Meta/blob/Alpha/docs/config.yaml#L400
          // https://stash.wiki/proxy-protocols/proxy-types#vmess
          if (isPresent(proxy, 'cipher') && !['auto', 'none', 'zero', 'aes-128-gcm', 'chacha20-poly1305'].includes(proxy.cipher)) {
            proxy.cipher = 'auto'
          }
        } else if (proxy.type === 'tuic') {
          if (isPresent(proxy, 'alpn')) {
            proxy.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn]
          } else {
            proxy.alpn = ['h3']
          }
          if (isPresent(proxy, 'tfo') && !isPresent(proxy, 'fast-open')) {
            proxy['fast-open'] = proxy.tfo
          }
          // https://github.com/MetaCubeX/Clash.Meta/blob/Alpha/adapter/outbound/tuic.go#L197
          if ((!proxy.token || proxy.token.length === 0) && !isPresent(proxy, 'version')) {
            proxy.version = 5
          }
        } else if (proxy.type === 'hysteria') {
          // auth_str 将会在未来某个时候删除 但是有的机场不规范
          if (isPresent(proxy, 'auth_str') && !isPresent(proxy, 'auth-str')) {
            proxy['auth-str'] = proxy['auth_str']
          }
          if (isPresent(proxy, 'alpn')) {
            proxy.alpn = Array.isArray(proxy.alpn) ? proxy.alpn : [proxy.alpn]
          }
          if (isPresent(proxy, 'tfo') && !isPresent(proxy, 'fast-open')) {
            proxy['fast-open'] = proxy.tfo
          }
        } else if (proxy.type === 'wireguard') {
          proxy.keepalive = proxy.keepalive ?? proxy['persistent-keepalive']
          proxy['persistent-keepalive'] = proxy.keepalive
          proxy['preshared-key'] = proxy['preshared-key'] ?? proxy['pre-shared-key']
          proxy['pre-shared-key'] = proxy['preshared-key']
        } else if (proxy.type === 'snell' && proxy.version < 3) {
          delete proxy.udp
        } else if (proxy.type === 'vless') {
          if (isPresent(proxy, 'sni')) {
            proxy.servername = proxy.sni
            delete proxy.sni
          }
        } else if (proxy.type === 'ss') {
          if (isPresent(proxy, 'shadow-tls-password') && !isPresent(proxy, 'plugin')) {
            proxy.plugin = 'shadow-tls'
            proxy['plugin-opts'] = {
              host: proxy['shadow-tls-sni'],
              password: proxy['shadow-tls-password'],
              version: proxy['shadow-tls-version']
            }
            delete proxy['shadow-tls-password']
            delete proxy['shadow-tls-sni']
            delete proxy['shadow-tls-version']
          }
        }

        if (['vmess', 'vless'].includes(proxy.type) && proxy.network === 'http') {
          let httpPath = proxy['http-opts']?.path
          if (isPresent(proxy, 'http-opts.path') && !Array.isArray(httpPath)) {
            proxy['http-opts'].path = [httpPath]
          }
          let httpHost = proxy['http-opts']?.headers?.Host
          if (isPresent(proxy, 'http-opts.headers.Host') && !Array.isArray(httpHost)) {
            proxy['http-opts'].headers.Host = [httpHost]
          }
        }
        if (['vmess', 'vless'].includes(proxy.type) && proxy.network === 'h2') {
          let path = proxy['h2-opts']?.path
          if (isPresent(proxy, 'h2-opts.path') && Array.isArray(path)) {
            proxy['h2-opts'].path = path[0]
          }
          let host = proxy['h2-opts']?.headers?.host
          if (isPresent(proxy, 'h2-opts.headers.Host') && !Array.isArray(host)) {
            proxy['h2-opts'].headers.host = [host]
          }
        }
        if (['ws'].includes(proxy.network)) {
          const networkPath = proxy[`${proxy.network}-opts`]?.path
          if (networkPath) {
            const reg = /^(.*?)(?:\?ed=(\d+))?$/
            // eslint-disable-next-line no-unused-vars
            const [_, path = '', ed = ''] = reg.exec(networkPath)
            proxy[`${proxy.network}-opts`].path = path
            if (ed !== '') {
              proxy['ws-opts']['early-data-header-name'] = 'Sec-WebSocket-Protocol'
              proxy['ws-opts']['max-early-data'] = parseInt(ed, 10)
            }
          } else {
            proxy[`${proxy.network}-opts`] = proxy[`${proxy.network}-opts`] || {}
            proxy[`${proxy.network}-opts`].path = '/'
          }
        }

        if (proxy['plugin-opts']?.tls) {
          if (isPresent(proxy, 'skip-cert-verify')) {
            proxy['plugin-opts']['skip-cert-verify'] = proxy['skip-cert-verify']
          }
        }
        if (['trojan', 'tuic', 'hysteria', 'hysteria2', 'juicity', 'anytls'].includes(proxy.type)) {
          delete proxy.tls
        }

        if (proxy['tls-fingerprint']) {
          proxy.fingerprint = proxy['tls-fingerprint']
        }
        delete proxy['tls-fingerprint']

        if (proxy['underlying-proxy']) {
          proxy['dialer-proxy'] = proxy['underlying-proxy']
        }
        delete proxy['underlying-proxy']

        if (isPresent(proxy, 'tls') && typeof proxy.tls !== 'boolean') {
          delete proxy.tls
        }
        delete proxy.subName
        delete proxy.collectionName
        delete proxy.id
        delete proxy.resolved
        delete proxy['no-resolve']
        if (type !== 'internal' || opts['delete-underscore-fields']) {
          for (const key in proxy) {
            if (proxy[key] == null || /^_/i.test(key)) {
              delete proxy[key]
            }
          }
        }
        if (['grpc'].includes(proxy.network) && proxy[`${proxy.network}-opts`]) {
          delete proxy[`${proxy.network}-opts`]['_grpc-type']
          delete proxy[`${proxy.network}-opts`]['_grpc-authority']
        }

        if (proxy['ip-version']) {
          proxy['ip-version'] = ipVersions[proxy['ip-version']] || proxy['ip-version']
        }
        return proxy
      })

    return type === 'internal' ? list : 'proxies:\n' + list.map((proxy) => '  - ' + JSON.stringify(proxy) + '\n').join('')
  }
  return { type, produce }
}

// 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/producers/sing-box.js
function Singbox_Producer() {
  const ipVersions = {
    ipv4: 'ipv4_only',
    ipv6: 'ipv6_only',
    'v4-only': 'ipv4_only',
    'v6-only': 'ipv6_only',
    'ipv4-prefer': 'prefer_ipv4',
    'ipv6-prefer': 'prefer_ipv6',
    'prefer-v4': 'prefer_ipv4',
    'prefer-v6': 'prefer_ipv6'
  }

  const ipVersionParser = (proxy, parsedProxy) => {
    const strategy = ipVersions[proxy['ip-version']]
    if (proxy._dns_server && strategy) {
      parsedProxy.domain_resolver = {
        server: proxy._dns_server,
        strategy
      }
    }
  }
  const detourParser = (proxy, parsedProxy) => {
    parsedProxy.detour = proxy['dialer-proxy'] || proxy.detour
  }
  const networkParser = (proxy, parsedProxy) => {
    if (['tcp', 'udp'].includes(proxy._network)) parsedProxy.network = proxy._network
  }
  const tfoParser = (proxy, parsedProxy) => {
    parsedProxy.tcp_fast_open = false
    if (proxy.tfo) parsedProxy.tcp_fast_open = true
    if (proxy.tcp_fast_open) parsedProxy.tcp_fast_open = true
    if (proxy['tcp-fast-open']) parsedProxy.tcp_fast_open = true
    if (!parsedProxy.tcp_fast_open) delete parsedProxy.tcp_fast_open
  }

  const smuxParser = (smux, proxy) => {
    if (!smux || !smux.enabled) return
    proxy.multiplex = { enabled: true }
    proxy.multiplex.protocol = smux.protocol
    if (smux['max-connections']) proxy.multiplex.max_connections = parseInt(`${smux['max-connections']}`, 10)
    if (smux['max-streams']) proxy.multiplex.max_streams = parseInt(`${smux['max-streams']}`, 10)
    if (smux['min-streams']) proxy.multiplex.min_streams = parseInt(`${smux['min-streams']}`, 10)
    if (smux.padding) proxy.multiplex.padding = true
    if (smux['brutal-opts']?.up || smux['brutal-opts']?.down) {
      proxy.multiplex.brutal = {
        enabled: true
      }
      if (smux['brutal-opts']?.up) proxy.multiplex.brutal.up_mbps = parseInt(`${smux['brutal-opts']?.up}`, 10)
      if (smux['brutal-opts']?.down) proxy.multiplex.brutal.down_mbps = parseInt(`${smux['brutal-opts']?.down}`, 10)
    }
  }

  const wsParser = (proxy, parsedProxy) => {
    const transport = { type: 'ws', headers: {} }
    if (proxy['ws-opts']) {
      const {
        path: wsPath = '',
        headers: wsHeaders = {},
        'max-early-data': max_early_data,
        'early-data-header-name': early_data_header_name
      } = proxy['ws-opts']
      transport.early_data_header_name = early_data_header_name
      transport.max_early_data = max_early_data ? parseInt(max_early_data, 10) : undefined
      if (wsPath !== '') transport.path = `${wsPath}`
      if (Object.keys(wsHeaders).length > 0) {
        const headers = {}
        for (const key of Object.keys(wsHeaders)) {
          let value = wsHeaders[key]
          if (value === '') continue
          if (!Array.isArray(value)) value = [`${value}`]
          if (value.length > 0) headers[key] = value
        }
        const { Host: wsHost } = headers
        if (wsHost.length === 1)
          for (const item of `Host:${wsHost[0]}`.split('\n')) {
            const [key, value] = item.split(':')
            if (value.trim() === '') continue
            headers[key.trim()] = value.trim().split(',')
          }
        transport.headers = headers
      }
    }
    if (proxy['ws-headers']) {
      const headers = {}
      for (const key of Object.keys(proxy['ws-headers'])) {
        let value = proxy['ws-headers'][key]
        if (value === '') continue
        if (!Array.isArray(value)) value = [`${value}`]
        if (value.length > 0) headers[key] = value
      }
      const { Host: wsHost } = headers
      if (wsHost.length === 1)
        for (const item of `Host:${wsHost[0]}`.split('\n')) {
          const [key, value] = item.split(':')
          if (value.trim() === '') continue
          headers[key.trim()] = value.trim().split(',')
        }
      for (const key of Object.keys(headers)) transport.headers[key] = headers[key]
    }
    if (proxy['ws-path'] && proxy['ws-path'] !== '') transport.path = `${proxy['ws-path']}`
    if (transport.path) {
      const reg = /^(.*?)(?:\?ed=(\d+))?$/
      // eslint-disable-next-line no-unused-vars
      const [_, path = '', ed = ''] = reg.exec(transport.path)
      transport.path = path
      if (ed !== '') {
        transport.early_data_header_name = 'Sec-WebSocket-Protocol'
        transport.max_early_data = parseInt(ed, 10)
      }
    }

    if (parsedProxy.tls.insecure) parsedProxy.tls.server_name = transport.headers.Host[0]
    if (proxy['ws-opts'] && proxy['ws-opts']['v2ray-http-upgrade']) {
      transport.type = 'httpupgrade'
      if (transport.headers.Host) {
        transport.host = transport.headers.Host[0]
        delete transport.headers.Host
      }
      if (transport.max_early_data) delete transport.max_early_data
      if (transport.early_data_header_name) delete transport.early_data_header_name
    }
    for (const key of Object.keys(transport.headers)) {
      const value = transport.headers[key]
      if (value.length === 1) transport.headers[key] = value[0]
    }
    parsedProxy.transport = transport
  }

  const h1Parser = (proxy, parsedProxy) => {
    const transport = { type: 'http', headers: {} }
    if (proxy['http-opts']) {
      const { method = '', path: h1Path = '', headers: h1Headers = {} } = proxy['http-opts']
      if (method !== '') transport.method = method
      if (Array.isArray(h1Path)) {
        transport.path = `${h1Path[0]}`
      } else if (h1Path !== '') transport.path = `${h1Path}`
      for (const key of Object.keys(h1Headers)) {
        let value = h1Headers[key]
        if (value === '') continue
        if (key.toLowerCase() === 'host') {
          let host = value
          if (!Array.isArray(host)) host = `${host}`.split(',').map((i) => i.trim())
          if (host.length > 0) transport.host = host
          continue
        }
        if (!Array.isArray(value)) value = `${value}`.split(',').map((i) => i.trim())
        if (value.length > 0) transport.headers[key] = value
      }
    }
    if (proxy['http-host'] && proxy['http-host'] !== '') {
      let host = proxy['http-host']
      if (!Array.isArray(host)) host = `${host}`.split(',').map((i) => i.trim())
      if (host.length > 0) transport.host = host
    }
    // if (!transport.host) return;
    if (proxy['http-path'] && proxy['http-path'] !== '') {
      const path = proxy['http-path']
      if (Array.isArray(path)) {
        transport.path = `${path[0]}`
      } else if (path !== '') transport.path = `${path}`
    }
    if (parsedProxy.tls.insecure) parsedProxy.tls.server_name = transport.host[0]
    if (transport.host?.length === 1) transport.host = transport.host[0]
    for (const key of Object.keys(transport.headers)) {
      const value = transport.headers[key]
      if (value.length === 1) transport.headers[key] = value[0]
    }
    parsedProxy.transport = transport
  }

  const h2Parser = (proxy, parsedProxy) => {
    const transport = { type: 'http' }
    if (proxy['h2-opts']) {
      let { host = '', path = '' } = proxy['h2-opts']
      if (path !== '') transport.path = `${path}`
      if (host !== '') {
        if (!Array.isArray(host)) host = `${host}`.split(',').map((i) => i.trim())
        if (host.length > 0) transport.host = host
      }
    }
    if (proxy['h2-host'] && proxy['h2-host'] !== '') {
      let host = proxy['h2-host']
      if (!Array.isArray(host)) host = `${host}`.split(',').map((i) => i.trim())
      if (host.length > 0) transport.host = host
    }
    if (proxy['h2-path'] && proxy['h2-path'] !== '') transport.path = `${proxy['h2-path']}`
    parsedProxy.tls.enabled = true
    if (parsedProxy.tls.insecure) parsedProxy.tls.server_name = transport.host[0]
    if (transport.host.length === 1) transport.host = transport.host[0]
    parsedProxy.transport = transport
  }

  const grpcParser = (proxy, parsedProxy) => {
    const transport = { type: 'grpc' }
    if (proxy['grpc-opts']) {
      const serviceName = proxy['grpc-opts']['grpc-service-name']
      if (serviceName != null && serviceName !== '') transport.service_name = `${serviceName}`
    }
    parsedProxy.transport = transport
  }

  const tlsParser = (proxy, parsedProxy) => {
    if (proxy.tls) parsedProxy.tls.enabled = true
    if (proxy.servername && proxy.servername !== '') parsedProxy.tls.server_name = proxy.servername
    if (proxy.peer && proxy.peer !== '') parsedProxy.tls.server_name = proxy.peer
    if (proxy.sni && proxy.sni !== '') parsedProxy.tls.server_name = proxy.sni
    if (proxy['skip-cert-verify']) parsedProxy.tls.insecure = true
    if (proxy.insecure) parsedProxy.tls.insecure = true
    if (proxy['disable-sni']) parsedProxy.tls.disable_sni = true
    if (typeof proxy.alpn === 'string') {
      parsedProxy.tls.alpn = [proxy.alpn]
    } else if (Array.isArray(proxy.alpn)) parsedProxy.tls.alpn = proxy.alpn
    if (proxy.ca) parsedProxy.tls.certificate_path = `${proxy.ca}`
    if (proxy.ca_str) parsedProxy.tls.certificate = [proxy.ca_str]
    if (proxy['ca-str']) parsedProxy.tls.certificate = [proxy['ca-str']]
    if (proxy['reality-opts']) {
      parsedProxy.tls.reality = { enabled: true }
      if (proxy['reality-opts']['public-key']) parsedProxy.tls.reality.public_key = proxy['reality-opts']['public-key']
      if (proxy['reality-opts']['short-id']) parsedProxy.tls.reality.short_id = proxy['reality-opts']['short-id']
      parsedProxy.tls.utls = { enabled: true }
    }
    if (!['hysteria', 'hysteria2', 'tuic'].includes(proxy.type) && proxy['client-fingerprint'] && proxy['client-fingerprint'] !== '')
      parsedProxy.tls.utls = {
        enabled: true,
        fingerprint: proxy['client-fingerprint']
      }
    if (!parsedProxy.tls.enabled) delete parsedProxy.tls
  }

  const sshParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'ssh',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10)
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy.username) parsedProxy.user = proxy.username
    if (proxy.password) parsedProxy.password = proxy.password
    // https://wiki.metacubex.one/config/proxies/ssh
    // https://sing-box.sagernet.org/zh/configuration/outbound/ssh
    if (proxy['privateKey']) parsedProxy.private_key_path = proxy['privateKey']
    if (proxy['private-key']) parsedProxy.private_key_path = proxy['private-key']
    if (proxy['private-key-passphrase']) parsedProxy.private_key_passphrase = proxy['private-key-passphrase']
    if (proxy['server-fingerprint']) {
      parsedProxy.host_key = [proxy['server-fingerprint']]
      // https://manual.nssurge.com/policy/ssh.html
      // Surge only supports curve25519-sha256 as the kex algorithm and aes128-gcm as the encryption algorithm. It means that the SSH server must use OpenSSH v7.3 or above. (It should not be a problem since OpenSSH 7.3 was released on 2016-08-01.)
      // TODO: ?
      parsedProxy.host_key_algorithms = [proxy['server-fingerprint'].split(' ')[0]]
    }
    if (proxy['host-key']) parsedProxy.host_key = proxy['host-key']
    if (proxy['host-key-algorithms']) parsedProxy.host_key_algorithms = proxy['host-key-algorithms']
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }

  const httpParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'http',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      tls: { enabled: false, server_name: proxy.server, insecure: false }
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy.username) parsedProxy.username = proxy.username
    if (proxy.password) parsedProxy.password = proxy.password
    if (proxy.headers) {
      parsedProxy.headers = {}
      for (const k of Object.keys(proxy.headers)) {
        parsedProxy.headers[k] = `${proxy.headers[k]}`
      }
      if (Object.keys(parsedProxy.headers).length === 0) delete parsedProxy.headers
    }
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    tlsParser(proxy, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }

  const socks5Parser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'socks',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      password: proxy.password,
      version: '5'
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy.username) parsedProxy.username = proxy.username
    if (proxy.password) parsedProxy.password = proxy.password
    if (proxy.uot) parsedProxy.udp_over_tcp = true
    if (proxy['udp-over-tcp']) parsedProxy.udp_over_tcp = true
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    networkParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }

  const shadowTLSParser = (proxy = {}) => {
    const ssPart = {
      tag: proxy.name,
      type: 'shadowsocks',
      method: proxy.cipher,
      password: proxy.password,
      detour: `${proxy.name}_shadowtls`
    }
    if (proxy.uot) ssPart.udp_over_tcp = true
    if (proxy['udp-over-tcp']) {
      ssPart.udp_over_tcp = {
        enabled: true,
        version: !proxy['udp-over-tcp-version'] || proxy['udp-over-tcp-version'] === 1 ? 1 : 2
      }
    }
    const stPart = {
      tag: `${proxy.name}_shadowtls`,
      type: 'shadowtls',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      version: proxy['plugin-opts'].version,
      password: proxy['plugin-opts'].password,
      tls: {
        enabled: true,
        server_name: proxy['plugin-opts'].host,
        utls: {
          enabled: true,
          fingerprint: proxy['client-fingerprint']
        }
      }
    }
    if (stPart.server_port < 0 || stPart.server_port > 65535) throw '端口值非法'
    if (proxy['fast-open'] === true) stPart.udp_fragment = true
    tfoParser(proxy, stPart)
    detourParser(proxy, stPart)
    smuxParser(proxy.smux, ssPart)
    ipVersionParser(proxy, stPart)
    return { type: 'ss-with-st', ssPart, stPart }
  }
  const ssParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'shadowsocks',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      method: proxy.cipher,
      password: proxy.password
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy.uot) parsedProxy.udp_over_tcp = true
    if (proxy['udp-over-tcp']) {
      parsedProxy.udp_over_tcp = {
        enabled: true,
        version: !proxy['udp-over-tcp-version'] || proxy['udp-over-tcp-version'] === 1 ? 1 : 2
      }
    }
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    networkParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    if (proxy.plugin) {
      const optArr = []
      if (proxy.plugin === 'obfs') {
        parsedProxy.plugin = 'obfs-local'
        parsedProxy.plugin_opts = ''
        if (proxy['obfs-host']) proxy['plugin-opts'].host = proxy['obfs-host']
        Object.keys(proxy['plugin-opts']).forEach((k) => {
          switch (k) {
            case 'mode':
              optArr.push(`obfs=${proxy['plugin-opts'].mode}`)
              break
            case 'host':
              optArr.push(`obfs-host=${proxy['plugin-opts'].host}`)
              break
            default:
              optArr.push(`${k}=${proxy['plugin-opts'][k]}`)
              break
          }
        })
      }
      if (proxy.plugin === 'v2ray-plugin') {
        parsedProxy.plugin = 'v2ray-plugin'
        if (proxy['ws-host']) proxy['plugin-opts'].host = proxy['ws-host']
        if (proxy['ws-path']) proxy['plugin-opts'].path = proxy['ws-path']
        Object.keys(proxy['plugin-opts']).forEach((k) => {
          switch (k) {
            case 'tls':
              if (proxy['plugin-opts'].tls) optArr.push('tls')
              break
            case 'host':
              optArr.push(`host=${proxy['plugin-opts'].host}`)
              break
            case 'path':
              optArr.push(`path=${proxy['plugin-opts'].path}`)
              break
            case 'headers':
              optArr.push(`headers=${JSON.stringify(proxy['plugin-opts'].headers)}`)
              break
            case 'mux':
              if (proxy['plugin-opts'].mux) parsedProxy.multiplex = { enabled: true }
              break
            default:
              optArr.push(`${k}=${proxy['plugin-opts'][k]}`)
          }
        })
      }
      parsedProxy.plugin_opts = optArr.join(';')
    }

    return parsedProxy
  }
  // eslint-disable-next-line no-unused-vars
  const ssrParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'shadowsocksr',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      method: proxy.cipher,
      password: proxy.password,
      obfs: proxy.obfs,
      protocol: proxy.protocol
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy['obfs-param']) parsedProxy.obfs_param = proxy['obfs-param']
    if (proxy['protocol-param'] && proxy['protocol-param'] !== '') parsedProxy.protocol_param = proxy['protocol-param']
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }

  const vmessParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'vmess',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      uuid: proxy.uuid,
      security: proxy.cipher,
      alter_id: parseInt(`${proxy.alterId}`, 10),
      tls: { enabled: false, server_name: proxy.server, insecure: false }
    }
    if (['auto', 'none', 'zero', 'aes-128-gcm', 'chacha20-poly1305', 'aes-128-ctr'].indexOf(parsedProxy.security) === -1) parsedProxy.security = 'auto'
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy.xudp) parsedProxy.packet_encoding = 'xudp'
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    if (proxy.network === 'ws') wsParser(proxy, parsedProxy)
    if (proxy.network === 'h2') h2Parser(proxy, parsedProxy)
    if (proxy.network === 'http') h1Parser(proxy, parsedProxy)
    if (proxy.network === 'grpc') grpcParser(proxy, parsedProxy)
    networkParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    tlsParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }

  const vlessParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'vless',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      uuid: proxy.uuid,
      tls: { enabled: false, server_name: proxy.server, insecure: false }
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy.xudp) parsedProxy.packet_encoding = 'xudp'
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    // if (['xtls-rprx-vision', ''].includes(proxy.flow)) parsedProxy.flow = proxy.flow;
    if (proxy.flow != null) parsedProxy.flow = proxy.flow
    if (proxy.network === 'ws') wsParser(proxy, parsedProxy)
    if (proxy.network === 'h2') h2Parser(proxy, parsedProxy)
    if (proxy.network === 'http') h1Parser(proxy, parsedProxy)
    if (proxy.network === 'grpc') grpcParser(proxy, parsedProxy)
    networkParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    tlsParser(proxy, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }
  const trojanParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'trojan',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      password: proxy.password,
      tls: { enabled: true, server_name: proxy.server, insecure: false }
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    if (proxy.network === 'grpc') grpcParser(proxy, parsedProxy)
    if (proxy.network === 'ws') wsParser(proxy, parsedProxy)
    networkParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    tlsParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }
  const hysteriaParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'hysteria',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      disable_mtu_discovery: false,
      tls: { enabled: true, server_name: proxy.server, insecure: false }
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy['hop-interval']) parsedProxy.hop_interval = /^\d+$/.test(proxy['hop-interval']) ? `${proxy['hop-interval']}s` : proxy['hop-interval']
    if (proxy['ports'])
      parsedProxy.server_ports = proxy['ports'].split(/\s*,\s*/).map((p) => {
        const range = p.replace(/\s*-\s*/g, ':')
        return range.includes(':') ? range : `${range}:${range}`
      })
    if (proxy.auth_str) parsedProxy.auth_str = `${proxy.auth_str}`
    if (proxy['auth-str']) parsedProxy.auth_str = `${proxy['auth-str']}`
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    // eslint-disable-next-line no-control-regex
    const reg = new RegExp('^[0-9]+[ \t]*[KMGT]*[Bb]ps$')
    // sing-box 跟文档不一致, 但是懒得全转, 只处理最常见的 Mbps
    if (reg.test(`${proxy.up}`) && !`${proxy.up}`.endsWith('Mbps')) {
      parsedProxy.up = `${proxy.up}`
    } else {
      parsedProxy.up_mbps = parseInt(`${proxy.up}`, 10)
    }
    if (reg.test(`${proxy.down}`) && !`${proxy.down}`.endsWith('Mbps')) {
      parsedProxy.down = `${proxy.down}`
    } else {
      parsedProxy.down_mbps = parseInt(`${proxy.down}`, 10)
    }
    if (proxy.obfs) parsedProxy.obfs = proxy.obfs
    if (proxy.recv_window_conn) parsedProxy.recv_window_conn = proxy.recv_window_conn
    if (proxy['recv-window-conn']) parsedProxy.recv_window_conn = proxy['recv-window-conn']
    if (proxy.recv_window) parsedProxy.recv_window = proxy.recv_window
    if (proxy['recv-window']) parsedProxy.recv_window = proxy['recv-window']
    if (proxy.disable_mtu_discovery) {
      if (typeof proxy.disable_mtu_discovery === 'boolean') {
        parsedProxy.disable_mtu_discovery = proxy.disable_mtu_discovery
      } else {
        if (proxy.disable_mtu_discovery === 1) parsedProxy.disable_mtu_discovery = true
      }
    }
    networkParser(proxy, parsedProxy)
    tlsParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }
  const hysteria2Parser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'hysteria2',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      password: proxy.password,
      obfs: {},
      tls: { enabled: true, server_name: proxy.server, insecure: false }
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy['hop-interval']) parsedProxy.hop_interval = /^\d+$/.test(proxy['hop-interval']) ? `${proxy['hop-interval']}s` : proxy['hop-interval']
    if (proxy['ports'])
      parsedProxy.server_ports = proxy['ports'].split(/\s*,\s*/).map((p) => {
        const range = p.replace(/\s*-\s*/g, ':')
        return range.includes(':') ? range : `${range}:${range}`
      })
    if (proxy.up) parsedProxy.up_mbps = parseInt(`${proxy.up}`, 10)
    if (proxy.down) parsedProxy.down_mbps = parseInt(`${proxy.down}`, 10)
    if (proxy.obfs === 'salamander') parsedProxy.obfs.type = 'salamander'
    if (proxy['obfs-password']) parsedProxy.obfs.password = proxy['obfs-password']
    if (!parsedProxy.obfs.type) delete parsedProxy.obfs
    networkParser(proxy, parsedProxy)
    tlsParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }
  const tuic5Parser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'tuic',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      uuid: proxy.uuid,
      password: proxy.password,
      tls: { enabled: true, server_name: proxy.server, insecure: false }
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    if (proxy['congestion-controller'] && proxy['congestion-controller'] !== 'cubic') parsedProxy.congestion_control = proxy['congestion-controller']
    if (proxy['udp-relay-mode'] && proxy['udp-relay-mode'] !== 'native') parsedProxy.udp_relay_mode = proxy['udp-relay-mode']
    if (proxy['reduce-rtt']) parsedProxy.zero_rtt_handshake = true
    if (proxy['udp-over-stream']) parsedProxy.udp_over_stream = true
    if (proxy['heartbeat-interval']) parsedProxy.heartbeat = `${proxy['heartbeat-interval']}ms`
    networkParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    tlsParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }
  const anytlsParser = (proxy = {}) => {
    const parsedProxy = {
      tag: proxy.name,
      type: 'anytls',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      password: proxy.password,
      tls: { enabled: true, server_name: proxy.server, insecure: false }
    }
    if (/^\d+$/.test(proxy['idle-session-check-interval'])) parsedProxy.idle_session_check_interval = `${proxy['idle-session-check-interval']}s`
    if (/^\d+$/.test(proxy['idle-session-timeout'])) parsedProxy.idle_session_timeout = `${proxy['idle-session-timeout']}s`
    if (/^\d+$/.test(proxy['min-idle-session'])) parsedProxy.min_idle_session = parseInt(`${proxy['min-idle-session']}`, 10)
    networkParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    tlsParser(proxy, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }

  const wireguardParser = (proxy = {}) => {
    const local_address = ['ip', 'ipv6']
      .map((i) => proxy[i])
      .map((i) => {
        if (isIPv4(i)) return `${i}/32`
        if (isIPv6(i)) return `${i}/128`
      })
      .filter((i) => i)
    const parsedProxy = {
      tag: proxy.name,
      type: 'wireguard',
      server: proxy.server,
      server_port: parseInt(`${proxy.port}`, 10),
      local_address,
      private_key: proxy['private-key'],
      peer_public_key: proxy['public-key'],
      pre_shared_key: proxy['pre-shared-key'],
      reserved: []
    }
    if (parsedProxy.server_port < 0 || parsedProxy.server_port > 65535) throw 'invalid port'
    if (proxy['fast-open']) parsedProxy.udp_fragment = true
    if (typeof proxy.reserved === 'string') {
      parsedProxy.reserved = proxy.reserved
    } else if (Array.isArray(proxy.reserved)) {
      for (const r of proxy.reserved) parsedProxy.reserved.push(r)
    } else {
      delete parsedProxy.reserved
    }
    if (proxy.peers && proxy.peers.length > 0) {
      parsedProxy.peers = []
      for (const p of proxy.peers) {
        const peer = {
          server: p.server,
          server_port: parseInt(`${p.port}`, 10),
          public_key: p['public-key'],
          allowed_ips: p['allowed-ips'] || p.allowed_ips,
          reserved: []
        }
        if (typeof p.reserved === 'string') {
          peer.reserved.push(p.reserved)
        } else if (Array.isArray(p.reserved)) {
          for (const r of p.reserved) peer.reserved.push(r)
        } else {
          delete peer.reserved
        }
        if (p['pre-shared-key']) peer.pre_shared_key = p['pre-shared-key']
        parsedProxy.peers.push(peer)
      }
    }
    networkParser(proxy, parsedProxy)
    tfoParser(proxy, parsedProxy)
    detourParser(proxy, parsedProxy)
    smuxParser(proxy.smux, parsedProxy)
    ipVersionParser(proxy, parsedProxy)
    return parsedProxy
  }

  const type = 'ALL'
  const produce = (proxies, type, opts = {}) => {
    const list = []
    ClashMeta_Producer()
      .produce(proxies, 'internal', { 'include-unsupported-proxy': true })
      .map((proxy) => {
        try {
          switch (proxy.type) {
            case 'ssh':
              list.push(sshParser(proxy))
              break
            case 'http':
              list.push(httpParser(proxy))
              break
            case 'socks5':
              if (proxy.tls) {
                throw new Error(`Platform sing-box does not support proxy type: ${proxy.type} with tls`)
              } else {
                list.push(socks5Parser(proxy))
              }
              break
            case 'ss':
              // if (!proxy.cipher) {
              //     proxy.cipher = 'none';
              // }
              // if (
              //     ![
              //         '2022-blake3-aes-128-gcm',
              //         '2022-blake3-aes-256-gcm',
              //         '2022-blake3-chacha20-poly1305',
              //         'aes-128-cfb',
              //         'aes-128-ctr',
              //         'aes-128-gcm',
              //         'aes-192-cfb',
              //         'aes-192-ctr',
              //         'aes-192-gcm',
              //         'aes-256-cfb',
              //         'aes-256-ctr',
              //         'aes-256-gcm',
              //         'chacha20-ietf',
              //         'chacha20-ietf-poly1305',
              //         'none',
              //         'rc4-md5',
              //         'xchacha20',
              //         'xchacha20-ietf-poly1305',
              //     ].includes(proxy.cipher)
              // ) {
              //     throw new Error(
              //         `cipher ${proxy.cipher} is not supported`,
              //     );
              // }
              if (proxy.plugin === 'shadow-tls') {
                const { ssPart, stPart } = shadowTLSParser(proxy)
                list.push(ssPart)
                list.push(stPart)
              } else {
                list.push(ssParser(proxy))
              }
              break
            case 'ssr':
              if (opts['include-unsupported-proxy']) {
                list.push(ssrParser(proxy))
              } else {
                throw new Error(`Platform sing-box does not support proxy type: ${proxy.type}`)
              }
              break
            case 'vmess':
              if (!proxy.network || ['ws', 'grpc', 'h2', 'http'].includes(proxy.network)) {
                list.push(vmessParser(proxy))
              } else {
                throw new Error(`Platform sing-box does not support proxy type: ${proxy.type} with network ${proxy.network}`)
              }
              break
            case 'vless':
              if (!proxy.flow || ['xtls-rprx-vision'].includes(proxy.flow)) {
                list.push(vlessParser(proxy))
              } else {
                throw new Error(`Platform sing-box does not support proxy type: ${proxy.type} with flow ${proxy.flow}`)
              }
              break
            case 'trojan':
              if (!proxy.flow) {
                list.push(trojanParser(proxy))
              } else {
                throw new Error(`Platform sing-box does not support proxy type: ${proxy.type} with flow ${proxy.flow}`)
              }
              break
            case 'hysteria':
              list.push(hysteriaParser(proxy))
              break
            case 'hysteria2':
              list.push(hysteria2Parser(proxy, opts['include-unsupported-proxy']))
              break
            case 'tuic':
              if (!proxy.token || proxy.token.length === 0) {
                list.push(tuic5Parser(proxy))
              } else {
                throw new Error(`Platform sing-box does not support proxy type: TUIC v4`)
              }
              break
            case 'wireguard':
              list.push(wireguardParser(proxy))
              break
            case 'anytls':
              list.push(anytlsParser(proxy))
              break
            default:
              throw new Error(`Platform sing-box does not support proxy type: ${proxy.type}`)
          }
        } catch (e) {
          // console.log(e);
          $.error(e.message ?? e)
        }
      })

    return type === 'internal' ? list : JSON.stringify({ outbounds: list }, null, 2)
  }
  return { type, produce }
}

/**
 * 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/producers/uri.js
 */
function URI_Producer() {
  function vless(proxy) {
    let security = 'none'
    const isReality = proxy['reality-opts']
    let sid = ''
    let pbk = ''
    let spx = ''
    if (isReality) {
      security = 'reality'
      const publicKey = proxy['reality-opts']?.['public-key']
      if (publicKey) {
        pbk = `&pbk=${encodeURIComponent(publicKey)}`
      }
      const shortId = proxy['reality-opts']?.['short-id']
      if (shortId) {
        sid = `&sid=${encodeURIComponent(shortId)}`
      }
      const spiderX = proxy['reality-opts']?.['_spider-x']
      if (spiderX) {
        spx = `&spx=${encodeURIComponent(spiderX)}`
      }
    } else if (proxy.tls) {
      security = 'tls'
    }
    let alpn = ''
    if (proxy.alpn) {
      alpn = `&alpn=${encodeURIComponent(Array.isArray(proxy.alpn) ? proxy.alpn : proxy.alpn.join(','))}`
    }
    let allowInsecure = ''
    if (proxy['skip-cert-verify']) {
      allowInsecure = `&allowInsecure=1`
    }
    let sni = ''
    if (proxy.sni) {
      sni = `&sni=${encodeURIComponent(proxy.sni)}`
    }
    let fp = ''
    if (proxy['client-fingerprint']) {
      fp = `&fp=${encodeURIComponent(proxy['client-fingerprint'])}`
    }
    let flow = ''
    if (proxy.flow) {
      flow = `&flow=${encodeURIComponent(proxy.flow)}`
    }
    let extra = ''
    if (proxy._extra) {
      extra = `&extra=${encodeURIComponent(proxy._extra)}`
    }
    let mode = ''
    if (proxy._mode) {
      mode = `&mode=${encodeURIComponent(proxy._mode)}`
    }
    let pqv = ''
    if (proxy._pqv) {
      pqv = `&pqv=${encodeURIComponent(proxy._pqv)}`
    }
    let encryption = ''
    if (proxy._encryption) {
      encryption = `&encryption=${encodeURIComponent(proxy._encryption)}`
    }
    let vlessType = proxy.network
    if (proxy.network === 'ws' && proxy['ws-opts']?.['v2ray-http-upgrade']) {
      vlessType = 'httpupgrade'
    }

    let vlessTransport = `&type=${encodeURIComponent(vlessType)}`
    if (['grpc'].includes(proxy.network)) {
      // https://github.com/XTLS/Xray-core/issues/91
      vlessTransport += `&mode=${encodeURIComponent(proxy[`${proxy.network}-opts`]?.['_grpc-type'] || 'gun')}`
      const authority = proxy[`${proxy.network}-opts`]?.['_grpc-authority']
      if (authority) {
        vlessTransport += `&authority=${encodeURIComponent(authority)}`
      }
    }

    let vlessTransportServiceName = proxy[`${proxy.network}-opts`]?.[`${proxy.network}-service-name`]
    let vlessTransportPath = proxy[`${proxy.network}-opts`]?.path
    let vlessTransportHost = proxy[`${proxy.network}-opts`]?.headers?.Host
    if (vlessTransportPath) {
      vlessTransport += `&path=${encodeURIComponent(Array.isArray(vlessTransportPath) ? vlessTransportPath[0] : vlessTransportPath)}`
    }
    if (vlessTransportHost) {
      vlessTransport += `&host=${encodeURIComponent(Array.isArray(vlessTransportHost) ? vlessTransportHost[0] : vlessTransportHost)}`
    }
    if (vlessTransportServiceName) {
      vlessTransport += `&serviceName=${encodeURIComponent(vlessTransportServiceName)}`
    }
    if (proxy.network === 'kcp') {
      if (proxy.seed) {
        vlessTransport += `&seed=${encodeURIComponent(proxy.seed)}`
      }
      if (proxy.headerType) {
        vlessTransport += `&headerType=${encodeURIComponent(proxy.headerType)}`
      }
    }

    return `vless://${proxy.uuid}@${proxy.server}:${proxy.port}?security=${encodeURIComponent(
      security
    )}${vlessTransport}${alpn}${allowInsecure}${sni}${fp}${flow}${sid}${spx}${pbk}${mode}${extra}${pqv}${encryption}#${encodeURIComponent(proxy.name)}`
  }

  const type = 'SINGLE'
  const produce = (proxy) => {
    let result = ''
    delete proxy.subName
    delete proxy.collectionName
    delete proxy.id
    delete proxy.resolved
    delete proxy['no-resolve']
    for (const key in proxy) {
      if (proxy[key] == null) {
        delete proxy[key]
      }
    }
    if (['trojan', 'tuic', 'hysteria', 'hysteria2', 'juicity'].includes(proxy.type)) {
      delete proxy.tls
    }
    if (!['vmess'].includes(proxy.type) && proxy.server && isIPv6(proxy.server)) {
      proxy.server = `[${proxy.server}]`
    }
    switch (proxy.type) {
      case 'socks5':
        result = `socks://${encodeURIComponent(Base64.encode(`${proxy.username ?? ''}:${proxy.password ?? ''}`))}@${proxy.server}:${proxy.port}#${proxy.name}`
        break
      case 'ss':
        const userinfo = `${proxy.cipher}:${proxy.password}`
        result = `ss://${
          proxy.cipher?.startsWith('2022-blake3-') ? `${encodeURIComponent(proxy.cipher)}:${encodeURIComponent(proxy.password)}` : Base64.encode(userinfo)
        }@${proxy.server}:${proxy.port}${proxy.plugin ? '/' : ''}`
        if (proxy.plugin) {
          result += '?plugin='
          const opts = proxy['plugin-opts']
          switch (proxy.plugin) {
            case 'obfs':
              result += encodeURIComponent(`simple-obfs;obfs=${opts.mode}${opts.host ? ';obfs-host=' + opts.host : ''}`)
              break
            case 'v2ray-plugin':
              result += encodeURIComponent(`v2ray-plugin;obfs=${opts.mode}${opts.host ? ';obfs-host' + opts.host : ''}${opts.tls ? ';tls' : ''}`)
              break
            case 'shadow-tls':
              result += encodeURIComponent(`shadow-tls;host=${opts.host};password=${opts.password};version=${opts.version}`)
              break
            default:
              throw new Error(`Unsupported plugin option: ${proxy.plugin}`)
          }
        }
        if (proxy['udp-over-tcp']) {
          result = `${result}${proxy.plugin ? '&' : '?'}uot=1`
        }
        if (proxy.tfo) {
          result = `${result}${proxy.plugin || proxy['udp-over-tcp'] ? '&' : '?'}tfo=1`
        }
        result += `#${encodeURIComponent(proxy.name)}`
        break
      case 'ssr':
        result = `${proxy.server}:${proxy.port}:${proxy.protocol}:${proxy.cipher}:${proxy.obfs}:${Base64.encode(proxy.password)}/`
        result += `?remarks=${Base64.encode(proxy.name)}${proxy['obfs-param'] ? '&obfsparam=' + Base64.encode(proxy['obfs-param']) : ''}${
          proxy['protocol-param'] ? '&protocolparam=' + Base64.encode(proxy['protocol-param']) : ''
        }`
        result = 'ssr://' + Base64.encode(result)
        break
      case 'vmess':
        // V2RayN URI format
        let type = ''
        let net = proxy.network || 'tcp'
        if (proxy.network === 'http') {
          net = 'tcp'
          type = 'http'
        } else if (proxy.network === 'ws' && proxy['ws-opts']?.['v2ray-http-upgrade']) {
          net = 'httpupgrade'
        }
        result = {
          v: '2',
          ps: proxy.name,
          add: proxy.server,
          port: `${proxy.port}`,
          id: proxy.uuid,
          aid: `${proxy.alterId || 0}`,
          scy: proxy.cipher,
          net,
          type,
          tls: proxy.tls ? 'tls' : '',
          alpn: Array.isArray(proxy.alpn) ? proxy.alpn.join(',') : proxy.alpn,
          fp: proxy['client-fingerprint']
        }
        if (proxy.tls && proxy.sni) {
          result.sni = proxy.sni
        }
        // obfs
        if (proxy.network) {
          let vmessTransportPath = proxy[`${proxy.network}-opts`]?.path
          let vmessTransportHost = proxy[`${proxy.network}-opts`]?.headers?.Host

          if (['grpc'].includes(proxy.network)) {
            result.path = proxy[`${proxy.network}-opts`]?.['grpc-service-name']
            // https://github.com/XTLS/Xray-core/issues/91
            result.type = proxy[`${proxy.network}-opts`]?.['_grpc-type'] || 'gun'
            result.host = proxy[`${proxy.network}-opts`]?.['_grpc-authority']
          } else if (['kcp', 'quic'].includes(proxy.network)) {
            // https://github.com/XTLS/Xray-core/issues/91
            result.type = proxy[`${proxy.network}-opts`]?.[`_${proxy.network}-type`] || 'none'
            result.host = proxy[`${proxy.network}-opts`]?.[`_${proxy.network}-host`]
            result.path = proxy[`${proxy.network}-opts`]?.[`_${proxy.network}-path`]
          } else {
            if (vmessTransportPath) {
              result.path = Array.isArray(vmessTransportPath) ? vmessTransportPath[0] : vmessTransportPath
            }
            if (vmessTransportHost) {
              result.host = Array.isArray(vmessTransportHost) ? vmessTransportHost[0] : vmessTransportHost
            }
          }
        }
        result = 'vmess://' + Base64.encode(JSON.stringify(result))
        break
      case 'vless':
        result = vless(proxy)
        break
      case 'trojan':
        let trojanTransport = ''
        if (proxy.network) {
          let trojanType = proxy.network
          if (proxy.network === 'ws' && proxy['ws-opts']?.['v2ray-http-upgrade']) {
            trojanType = 'httpupgrade'
          }
          trojanTransport = `&type=${encodeURIComponent(trojanType)}`
          if (['grpc'].includes(proxy.network)) {
            let trojanTransportServiceName = proxy[`${proxy.network}-opts`]?.[`${proxy.network}-service-name`]
            let trojanTransportAuthority = proxy[`${proxy.network}-opts`]?.['_grpc-authority']
            if (trojanTransportServiceName) {
              trojanTransport += `&serviceName=${encodeURIComponent(trojanTransportServiceName)}`
            }
            if (trojanTransportAuthority) {
              trojanTransport += `&authority=${encodeURIComponent(trojanTransportAuthority)}`
            }
            trojanTransport += `&mode=${encodeURIComponent(proxy[`${proxy.network}-opts`]?.['_grpc-type'] || 'gun')}`
          }
          let trojanTransportPath = proxy[`${proxy.network}-opts`]?.path
          let trojanTransportHost = proxy[`${proxy.network}-opts`]?.headers?.Host
          if (trojanTransportPath) {
            trojanTransport += `&path=${encodeURIComponent(Array.isArray(trojanTransportPath) ? trojanTransportPath[0] : trojanTransportPath)}`
          }
          if (trojanTransportHost) {
            trojanTransport += `&host=${encodeURIComponent(Array.isArray(trojanTransportHost) ? trojanTransportHost[0] : trojanTransportHost)}`
          }
        }
        let trojanFp = ''
        if (proxy['client-fingerprint']) {
          trojanFp = `&fp=${encodeURIComponent(proxy['client-fingerprint'])}`
        }
        let trojanAlpn = ''
        if (proxy.alpn) {
          trojanAlpn = `&alpn=${encodeURIComponent(Array.isArray(proxy.alpn) ? proxy.alpn : proxy.alpn.join(','))}`
        }
        const trojanIsReality = proxy['reality-opts']
        let trojanSid = ''
        let trojanPbk = ''
        let trojanSpx = ''
        let trojanSecurity = ''
        let trojanMode = ''
        let trojanExtra = ''
        if (trojanIsReality) {
          trojanSecurity = `&security=reality`
          const publicKey = proxy['reality-opts']?.['public-key']
          if (publicKey) {
            trojanPbk = `&pbk=${encodeURIComponent(publicKey)}`
          }
          const shortId = proxy['reality-opts']?.['short-id']
          if (shortId) {
            trojanSid = `&sid=${encodeURIComponent(shortId)}`
          }
          const spiderX = proxy['reality-opts']?.['_spider-x']
          if (spiderX) {
            trojanSpx = `&spx=${encodeURIComponent(spiderX)}`
          }
          if (proxy._extra) {
            trojanExtra = `&extra=${encodeURIComponent(proxy._extra)}`
          }
          if (proxy._mode) {
            trojanMode = `&mode=${encodeURIComponent(proxy._mode)}`
          }
        }
        result = `trojan://${proxy.password}@${proxy.server}:${proxy.port}?sni=${encodeURIComponent(proxy.sni || proxy.server)}${
          proxy['skip-cert-verify'] ? '&allowInsecure=1' : ''
        }${trojanTransport}${trojanAlpn}${trojanFp}${trojanSecurity}${trojanSid}${trojanPbk}${trojanSpx}${trojanMode}${trojanExtra}#${encodeURIComponent(
          proxy.name
        )}`
        break
      case 'hysteria2':
        let hysteria2params = []
        if (proxy['hop-interval']) {
          hysteria2params.push(`hop-interval=${proxy['hop-interval']}`)
        }
        if (proxy['keepalive']) {
          hysteria2params.push(`keepalive=${proxy['keepalive']}`)
        }
        if (proxy['skip-cert-verify']) {
          hysteria2params.push(`insecure=1`)
        }
        if (proxy.obfs) {
          hysteria2params.push(`obfs=${encodeURIComponent(proxy.obfs)}`)
          if (proxy['obfs-password']) {
            hysteria2params.push(`obfs-password=${encodeURIComponent(proxy['obfs-password'])}`)
          }
        }
        if (proxy.sni) {
          hysteria2params.push(`sni=${encodeURIComponent(proxy.sni)}`)
        }
        if (proxy.ports) {
          hysteria2params.push(`mport=${proxy.ports}`)
        }
        if (proxy['tls-fingerprint']) {
          hysteria2params.push(`pinSHA256=${encodeURIComponent(proxy['tls-fingerprint'])}`)
        }
        if (proxy.tfo) {
          hysteria2params.push(`fastopen=1`)
        }
        result = `hysteria2://${encodeURIComponent(proxy.password)}@${proxy.server}:${proxy.port}?${hysteria2params.join(
          '&'
        )}#${encodeURIComponent(proxy.name)}`
        break
      case 'hysteria':
        let hysteriaParams = []
        Object.keys(proxy).forEach((key) => {
          if (!['name', 'type', 'server', 'port'].includes(key)) {
            const i = key.replace(/-/, '_')
            if (['alpn'].includes(key)) {
              if (proxy[key]) {
                hysteriaParams.push(`${i}=${encodeURIComponent(Array.isArray(proxy[key]) ? proxy[key][0] : proxy[key])}`)
              }
            } else if (['skip-cert-verify'].includes(key)) {
              if (proxy[key]) {
                hysteriaParams.push(`insecure=1`)
              }
            } else if (['tfo', 'fast-open'].includes(key)) {
              if (proxy[key] && !hysteriaParams.includes('fastopen=1')) {
                hysteriaParams.push(`fastopen=1`)
              }
            } else if (['ports'].includes(key)) {
              hysteriaParams.push(`mport=${proxy[key]}`)
            } else if (['auth-str'].includes(key)) {
              hysteriaParams.push(`auth=${proxy[key]}`)
            } else if (['up'].includes(key)) {
              hysteriaParams.push(`upmbps=${proxy[key]}`)
            } else if (['down'].includes(key)) {
              hysteriaParams.push(`downmbps=${proxy[key]}`)
            } else if (['_obfs'].includes(key)) {
              hysteriaParams.push(`obfs=${proxy[key]}`)
            } else if (['obfs'].includes(key)) {
              hysteriaParams.push(`obfsParam=${proxy[key]}`)
            } else if (['sni'].includes(key)) {
              hysteriaParams.push(`peer=${proxy[key]}`)
            } else if (proxy[key] && !/^_/i.test(key)) {
              hysteriaParams.push(`${i}=${encodeURIComponent(proxy[key])}`)
            }
          }
        })

        result = `hysteria://${proxy.server}:${proxy.port}?${hysteriaParams.join('&')}#${encodeURIComponent(proxy.name)}`
        break

      case 'tuic':
        if (!proxy.token || proxy.token.length === 0) {
          let tuicParams = []
          Object.keys(proxy).forEach((key) => {
            if (!['name', 'type', 'uuid', 'password', 'server', 'port', 'tls'].includes(key)) {
              const i = key.replace(/-/, '_')
              if (['alpn'].includes(key)) {
                if (proxy[key]) {
                  tuicParams.push(`${i}=${encodeURIComponent(Array.isArray(proxy[key]) ? proxy[key][0] : proxy[key])}`)
                }
              } else if (['skip-cert-verify'].includes(key)) {
                if (proxy[key]) {
                  tuicParams.push(`allow_insecure=1`)
                }
              } else if (['tfo', 'fast-open'].includes(key)) {
                if (proxy[key] && !tuicParams.includes('fast_open=1')) {
                  tuicParams.push(`fast_open=1`)
                }
              } else if (['disable-sni', 'reduce-rtt'].includes(key) && proxy[key]) {
                tuicParams.push(`${i.replace(/-/g, '_')}=1`)
              } else if (['congestion-controller'].includes(key)) {
                tuicParams.push(`congestion_control=${proxy[key]}`)
              } else if (proxy[key] && !/^_/i.test(key)) {
                tuicParams.push(`${i.replace(/-/g, '_')}=${encodeURIComponent(proxy[key])}`)
              }
            }
          })

          result = `tuic://${encodeURIComponent(proxy.uuid)}:${encodeURIComponent(proxy.password)}@${proxy.server}:${
            proxy.port
          }?${tuicParams.join('&')}#${encodeURIComponent(proxy.name)}`
        }
        break
      case 'anytls':
        result = vless({
          ...proxy,
          uuid: proxy.password,
          network: proxy.network || 'tcp'
        }).replace('vless', 'anytls')
        // 偷个懒
        let anytlsParams = []
        Object.keys(proxy).forEach((key) => {
          if (!['name', 'type', 'password', 'server', 'port', 'tls'].includes(key)) {
            const i = key.replace(/-/, '_')
            if (['alpn'].includes(key)) {
              if (proxy[key]) {
                anytlsParams.push(`${i}=${encodeURIComponent(Array.isArray(proxy[key]) ? proxy[key][0] : proxy[key])}`)
              }
            } else if (['skip-cert-verify'].includes(key)) {
              if (proxy[key]) {
                anytlsParams.push(`insecure=1`)
              }
            } else if (['udp'].includes(key)) {
              if (proxy[key]) {
                anytlsParams.push(`udp=1`)
              }
            } else if (proxy[key] && !/^_|client-fingerprint/i.test(key) && ['number', 'string', 'boolean'].includes(typeof proxy[key])) {
              anytlsParams.push(`${i.replace(/-/g, '_')}=${encodeURIComponent(proxy[key])}`)
            }
          }
        })

        // Parse existing query parameters from result
        const urlParts = result.split('?')
        let baseUrl = urlParts[0]
        let existingParams = {}

        if (urlParts.length > 1) {
          const queryString = urlParts[1].split('#')[0] // Remove fragment if exists
          const pairs = queryString.split('&')
          pairs.forEach((pair) => {
            const [key, value] = pair.split('=')
            if (key) {
              existingParams[key] = value
            }
          })
        }

        // Merge anytlsParams with existing parameters
        anytlsParams.forEach((param) => {
          const [key, value] = param.split('=')
          if (key) {
            existingParams[key] = value
          }
        })

        // Reconstruct query string
        const newParams = Object.keys(existingParams)
          .map((key) => `${key}=${existingParams[key]}`)
          .join('&')

        // Get fragment part if exists
        const fragmentMatch = result.match(/#(.*)$/)
        const fragment = fragmentMatch ? `#${fragmentMatch[1]}` : ''

        result = `${baseUrl}?${newParams}${fragment}`
        // result = `anytls://${encodeURIComponent(proxy.password)}@${
        //     proxy.server
        // }:${proxy.port}/?${anytlsParams.join('&')}#${encodeURIComponent(
        //     proxy.name,
        // )}`;
        break
      case 'wireguard':
        let wireguardParams = []

        Object.keys(proxy).forEach((key) => {
          if (!['name', 'type', 'server', 'port', 'ip', 'ipv6', 'private-key'].includes(key)) {
            if (['public-key'].includes(key)) {
              wireguardParams.push(`publickey=${proxy[key]}`)
            } else if (['udp'].includes(key)) {
              if (proxy[key]) {
                wireguardParams.push(`${key}=1`)
              }
            } else if (proxy[key] && !/^_/i.test(key)) {
              wireguardParams.push(`${key}=${encodeURIComponent(proxy[key])}`)
            }
          }
        })
        if (proxy.ip && proxy.ipv6) {
          wireguardParams.push(`address=${proxy.ip}/32,${proxy.ipv6}/128`)
        } else if (proxy.ip) {
          wireguardParams.push(`address=${proxy.ip}/32`)
        } else if (proxy.ipv6) {
          wireguardParams.push(`address=${proxy.ipv6}/128`)
        }
        result = `wireguard://${encodeURIComponent(proxy['private-key'])}@${proxy.server}:${proxy.port}/?${wireguardParams.join(
          '&'
        )}#${encodeURIComponent(proxy.name)}`
        break
    }
    return result
  }
  return { type, produce }
}

/**
 * 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/producers/v2ray.js
 */
function V2Ray_Producer() {
  const type = 'ALL'
  const produce = (proxies) => {
    let result = []
    proxies.map((proxy) => {
      try {
        result.push(URI.produce(proxy))
      } catch (err) {
        $.error(`Cannot produce proxy: ${JSON.stringify(proxy, null, 2)}\nReason: ${err}`)
      }
    })

    return Base64.encode(result.join('\n'))
  }

  return { type, produce }
}

// 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/parsers/index.js
const PROXY_PARSERS = (() => {
  function URI_PROXY() {
    // socks5+tls
    // socks5
    // http, https(可以这么写)
    const name = 'URI PROXY Parser'
    const test = (line) => {
      return /^(socks5\+tls|socks5|http|https):\/\//.test(line)
    }
    const parse = (line) => {
      // parse url
      // eslint-disable-next-line no-unused-vars
      let [__, type, tls, username, password, server, port, query, name] = line.match(
        /^(socks5|http|http)(\+tls|s)?:\/\/(?:(.*?):(.*?)@)?(.*?)(?::(\d+?))?\/?(\?.*?)?(?:#(.*?))?$/
      )
      if (port) {
        port = parseInt(port, 10)
      } else {
        if (tls) {
          port = 443
        } else if (type === 'http') {
          port = 80
        } else {
          $.error(`port is not present in line: ${line}`)
          throw new Error(`port is not present in line: ${line}`)
        }
        $.info(`port is not present in line: ${line}, set to ${port}`)
      }

      const proxy = {
        name: name != null ? decodeURIComponent(name) : `${type} ${server}:${port}`,
        type,
        tls: tls ? true : false,
        server,
        port,
        username: username != null ? decodeURIComponent(username) : undefined,
        password: password != null ? decodeURIComponent(password) : undefined
      }

      return proxy
    }
    return { name, test, parse }
  }
  function URI_SOCKS() {
    const name = 'URI SOCKS Parser'
    const test = (line) => {
      return /^socks:\/\//.test(line)
    }
    const parse = (line) => {
      // parse url
      // eslint-disable-next-line no-unused-vars
      let [__, type, auth, server, port, query, name] = line.match(/^(socks)?:\/\/(?:(.*)@)?(.*?)(?::(\d+?))?(\?.*?)?(?:#(.*?))?$/)
      if (port) {
        port = parseInt(port, 10)
      } else {
        $.error(`port is not present in line: ${line}`)
        throw new Error(`port is not present in line: ${line}`)
      }
      let username, password
      if (auth) {
        const parsed = Base64.decode(decodeURIComponent(auth)).split(':')
        username = parsed[0]
        password = parsed[1]
      }

      const proxy = {
        name: name != null ? decodeURIComponent(name) : `${type} ${server}:${port}`,
        type: 'socks5',
        server,
        port,
        username,
        password
      }

      return proxy
    }
    return { name, test, parse }
  }
  // Parse SS URI format (only supports new SIP002, legacy format is depreciated).
  // reference: https://github.com/shadowsocks/shadowsocks-org/wiki/SIP002-URI-Scheme
  function URI_SS() {
    // TODO: 暂不支持 httpupgrade
    const name = 'URI SS Parser'
    const test = (line) => {
      return /^ss:\/\//.test(line)
    }
    const parse = (line) => {
      // parse url
      let content = line.split('ss://')[1]

      let name = line.split('#')[1]
      const proxy = {
        type: 'ss'
      }
      content = content.split('#')[0] // strip proxy name
      // handle IPV4 and IPV6
      let serverAndPortArray = content.match(/@([^/?]*)(\/|\?|$)/)

      let rawUserInfoStr = decodeURIComponent(content.split('@')[0]) // 其实应该分隔之后, 用户名和密码再 decodeURIComponent. 但是问题不大
      let userInfoStr
      if (rawUserInfoStr?.startsWith('2022-blake3-')) {
        userInfoStr = rawUserInfoStr
      } else {
        userInfoStr = Base64.decode(rawUserInfoStr)
      }

      let query = ''
      if (!serverAndPortArray) {
        if (content.includes('?')) {
          const parsed = content.match(/^(.*)(\?.*)$/)
          content = parsed[1]
          query = parsed[2]
        }
        content = Base64.decode(content)

        if (query) {
          if (/(&|\?)v2ray-plugin=/.test(query)) {
            const parsed = query.match(/(&|\?)v2ray-plugin=(.*?)(&|$)/)
            let v2rayPlugin = parsed[2]
            if (v2rayPlugin) {
              proxy.plugin = 'v2ray-plugin'
              proxy['plugin-opts'] = JSON.parse(Base64.decode(v2rayPlugin))
            }
          }
          content = `${content}${query}`
        }
        userInfoStr = content.match(/(^.*)@/)?.[1]
        serverAndPortArray = content.match(/@([^/@]*)(\/|$)/)
      } else if (content.includes('?')) {
        const parsed = content.match(/(\?.*)$/)
        query = parsed[1]
      }

      const serverAndPort = serverAndPortArray[1]
      const portIdx = serverAndPort.lastIndexOf(':')
      proxy.server = serverAndPort.substring(0, portIdx)
      proxy.port = `${serverAndPort.substring(portIdx + 1)}`.match(/\d+/)?.[0]
      let userInfo = userInfoStr.match(/(^.*?):(.*$)/)
      proxy.cipher = userInfo?.[1]
      proxy.password = userInfo?.[2]
      // if (!proxy.cipher || !proxy.password) {
      //     userInfo = rawUserInfoStr.match(/(^.*?):(.*$)/);
      //     proxy.cipher = userInfo?.[1];
      //     proxy.password = userInfo?.[2];
      // }

      // handle obfs
      const pluginMatch = content.match(/[?&]plugin=([^&]+)/)
      const shadowTlsMatch = content.match(/[?&]shadow-tls=([^&]+)/)

      if (pluginMatch) {
        const pluginInfo = ('plugin=' + decodeURIComponent(pluginMatch[1])).split(';')
        const params = {}
        for (const item of pluginInfo) {
          const [key, val] = item.split('=')
          if (key) params[key] = val || true // some options like "tls" will not have value
        }
        switch (params.plugin) {
          case 'obfs-local':
          case 'simple-obfs':
            proxy.plugin = 'obfs'
            proxy['plugin-opts'] = {
              mode: params.obfs,
              host: getIfNotBlank(params['obfs-host'])
            }
            break
          case 'v2ray-plugin':
            proxy.plugin = 'v2ray-plugin'
            proxy['plugin-opts'] = {
              mode: 'websocket',
              host: getIfNotBlank(params['obfs-host']),
              path: getIfNotBlank(params.path),
              tls: getIfPresent(params.tls)
            }
            break
          case 'shadow-tls': {
            proxy.plugin = 'shadow-tls'
            const version = getIfNotBlank(params['version'])
            proxy['plugin-opts'] = {
              host: getIfNotBlank(params['host']),
              password: getIfNotBlank(params['password']),
              version: version ? parseInt(version, 10) : undefined
            }
            break
          }
          default:
            throw new Error(`Unsupported plugin option: ${params.plugin}`)
        }
      }
      // Shadowrocket
      if (shadowTlsMatch) {
        const params = JSON.parse(Base64.decode(shadowTlsMatch[1]))
        const version = getIfNotBlank(params['version'])
        const address = getIfNotBlank(params['address'])
        const port = getIfNotBlank(params['port'])
        proxy.plugin = 'shadow-tls'
        proxy['plugin-opts'] = {
          host: getIfNotBlank(params['host']),
          password: getIfNotBlank(params['password']),
          version: version ? parseInt(version, 10) : undefined
        }
        if (address) {
          proxy.server = address
        }
        if (port) {
          proxy.port = parseInt(port, 10)
        }
      }
      if (/(&|\?)uot=(1|true)/i.test(query)) {
        proxy['udp-over-tcp'] = true
      }
      if (/(&|\?)tfo=(1|true)/i.test(query)) {
        proxy.tfo = true
      }
      if (name != null) {
        name = decodeURIComponent(name)
      }
      proxy.name = name ?? `SS ${proxy.server}:${proxy.port}`
      return proxy
    }
    return { name, test, parse }
  }

  // Parse URI SSR format, such as ssr://xxx
  function URI_SSR() {
    const name = 'URI SSR Parser'
    const test = (line) => {
      return /^ssr:\/\//.test(line)
    }
    const parse = (line) => {
      line = Base64.decode(line.split('ssr://')[1])

      // handle IPV6 & IPV4 format
      let splitIdx = line.indexOf(':origin')
      if (splitIdx === -1) {
        splitIdx = line.indexOf(':auth_')
      }
      const serverAndPort = line.substring(0, splitIdx)
      const server = serverAndPort.substring(0, serverAndPort.lastIndexOf(':'))
      const port = serverAndPort.substring(serverAndPort.lastIndexOf(':') + 1)

      let params = line
        .substring(splitIdx + 1)
        .split('/?')[0]
        .split(':')
      let proxy = {
        type: 'ssr',
        server,
        port,
        protocol: params[0],
        cipher: params[1],
        obfs: params[2],
        password: Base64.decode(params[3])
      }
      // get other params
      const other_params = {}
      line = line.split('/?')[1].split('&')
      if (line.length > 1) {
        for (const item of line) {
          let [key, val] = item.split('=')
          val = val.trim()
          if (val.length > 0 && val !== '(null)') {
            other_params[key] = val
          }
        }
      }
      proxy = {
        ...proxy,
        name: other_params.remarks ? Base64.decode(other_params.remarks) : proxy.server,
        'protocol-param': getIfNotBlank(Base64.decode(other_params.protoparam || '').replace(/\s/g, '')),
        'obfs-param': getIfNotBlank(Base64.decode(other_params.obfsparam || '').replace(/\s/g, ''))
      }
      return proxy
    }

    return { name, test, parse }
  }

  // V2rayN URI VMess format
  // reference: https://github.com/2dust/v2rayN/wiki/%E5%88%86%E4%BA%AB%E9%93%BE%E6%8E%A5%E6%A0%BC%E5%BC%8F%E8%AF%B4%E6%98%8E(ver-2)

  // Quantumult VMess format
  function URI_VMess() {
    const name = 'URI VMess Parser'
    const test = (line) => {
      return /^vmess:\/\//.test(line)
    }
    const parse = (line) => {
      line = line.split('vmess://')[1]
      let content = Base64.decode(line.replace(/\?.*?$/, ''))
      if (/=\s*vmess/.test(content)) {
        // Quantumult VMess URI format
        const partitions = content.split(',').map((p) => p.trim())
        // get keyword params
        const params = {}
        for (const part of partitions) {
          if (part.indexOf('=') !== -1) {
            const [key, val] = part.split('=')
            params[key.trim()] = val.trim()
          }
        }

        const proxy = {
          name: partitions[0].split('=')[0].trim(),
          type: 'vmess',
          server: partitions[1],
          port: partitions[2],
          cipher: getIfNotBlank(partitions[3], 'auto'),
          uuid: partitions[4].match(/^"(.*)"$/)[1],
          tls: params.obfs === 'wss',
          udp: getIfPresent(params['udp-relay']),
          tfo: getIfPresent(params['fast-open']),
          'skip-cert-verify': isPresent(params['tls-verification']) ? !params['tls-verification'] : undefined
        }

        // handle ws headers
        if (isPresent(params.obfs)) {
          if (params.obfs === 'ws' || params.obfs === 'wss') {
            proxy.network = 'ws'
            proxy['ws-opts'].path = (getIfNotBlank(params['obfs-path']) || '"/"').match(/^"(.*)"$/)[1]
            let obfs_host = params['obfs-header']
            if (obfs_host && obfs_host.indexOf('Host') !== -1) {
              obfs_host = obfs_host.match(/Host:\s*([a-zA-Z0-9-.]*)/)[1]
            }
            if (isNotBlank(obfs_host)) {
              proxy['ws-opts'].headers = {
                Host: obfs_host
              }
            }
          } else {
            throw new Error(`Unsupported obfs: ${params.obfs}`)
          }
        }
        return proxy
      } else {
        let params = {}

        try {
          // V2rayN URI format
          params = JSON.parse(content)
        } catch (e) {
          // Shadowrocket URI format
          // eslint-disable-next-line no-unused-vars
          let [__, base64Line, qs] = /(^[^?]+?)\/?\?(.*)$/.exec(line)
          content = Base64.decode(base64Line)

          for (const addon of qs.split('&')) {
            const [key, valueRaw] = addon.split('=')
            let value = valueRaw
            value = decodeURIComponent(valueRaw)
            if (value.indexOf(',') === -1) {
              params[key] = value
            } else {
              params[key] = value.split(',')
            }
          }
          // eslint-disable-next-line no-unused-vars
          let [___, cipher, uuid, server, port] = /(^[^:]+?):([^:]+?)@(.*):(\d+)$/.exec(content)

          params.scy = cipher
          params.id = uuid
          params.port = port
          params.add = server
        }
        const server = params.add
        const port = parseInt(getIfPresent(params.port), 10)
        const proxy = {
          name: params.ps ?? params.remarks ?? params.remark ?? `VMess ${server}:${port}`,
          type: 'vmess',
          server,
          port,
          // https://github.com/2dust/v2rayN/wiki/Description-of-VMess-share-link
          // https://github.com/XTLS/Xray-core/issues/91
          cipher: ['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none'].includes(params.scy) ? params.scy : 'auto',
          uuid: params.id,
          alterId: parseInt(getIfPresent(params.aid ?? params.alterId, 0), 10),
          tls: ['tls', true, 1, '1'].includes(params.tls),
          'skip-cert-verify': isPresent(params.verify_cert) ? !params.verify_cert : undefined
        }
        if (!proxy['skip-cert-verify'] && isPresent(params.allowInsecure)) {
          proxy['skip-cert-verify'] = /(TRUE)|1/i.test(params.allowInsecure)
        }
        // https://github.com/2dust/v2rayN/wiki/%E5%88%86%E4%BA%AB%E9%93%BE%E6%8E%A5%E6%A0%BC%E5%BC%8F%E8%AF%B4%E6%98%8E(ver-2)
        if (proxy.tls) {
          if (params.sni && params.sni !== '') {
            proxy.sni = params.sni
          } else if (params.peer && params.peer !== '') {
            proxy.sni = params.peer
          }
        }
        let httpupgrade = false
        // handle obfs
        if (params.net === 'ws' || params.obfs === 'websocket') {
          proxy.network = 'ws'
        } else if (['http'].includes(params.net) || ['http'].includes(params.obfs) || ['http'].includes(params.type)) {
          proxy.network = 'http'
        } else if (['grpc', 'kcp', 'quic'].includes(params.net)) {
          proxy.network = params.net
        } else if (params.net === 'httpupgrade' || proxy.network === 'httpupgrade') {
          proxy.network = 'ws'
          httpupgrade = true
        } else if (params.net === 'h2' || proxy.network === 'h2') {
          proxy.network = 'h2'
        }
        // 暂不支持 tcp + host + path
        // else if (params.net === 'tcp' || proxy.network === 'tcp') {
        //     proxy.network = 'tcp';
        // }
        if (proxy.network) {
          let transportHost = params.host ?? params.obfsParam
          try {
            const parsedObfs = JSON.parse(transportHost)
            const parsedHost = parsedObfs?.Host
            if (parsedHost) {
              transportHost = parsedHost
            }
            // eslint-disable-next-line no-empty
          } catch (e) {}
          let transportPath = params.path

          // 补上默认 path
          if (['ws'].includes(proxy.network)) {
            transportPath = transportPath || '/'
          }

          if (proxy.network === 'http') {
            if (transportHost) {
              // 1)http(tcp)->host中间逗号(,)隔开
              transportHost = transportHost.split(',').map((i) => i.trim())
              transportHost = Array.isArray(transportHost) ? transportHost[0] : transportHost
            }
            if (transportPath) {
              transportPath = Array.isArray(transportPath) ? transportPath[0] : transportPath
            } else {
              transportPath = '/'
            }
          }
          // 传输层应该有配置, 暂时不考虑兼容不给配置的节点
          if (transportPath || transportHost || ['kcp', 'quic'].includes(proxy.network)) {
            if (['grpc'].includes(proxy.network)) {
              proxy[`${proxy.network}-opts`] = {
                'grpc-service-name': getIfNotBlank(transportPath),
                '_grpc-type': getIfNotBlank(params.type),
                '_grpc-authority': getIfNotBlank(params.authority)
              }
            } else if (['kcp', 'quic'].includes(proxy.network)) {
              proxy[`${proxy.network}-opts`] = {
                [`_${proxy.network}-type`]: getIfNotBlank(params.type),
                [`_${proxy.network}-host`]: getIfNotBlank(getIfNotBlank(transportHost)),
                [`_${proxy.network}-path`]: getIfNotBlank(transportPath)
              }
            } else {
              const opts = {
                path: getIfNotBlank(transportPath),
                headers: { Host: getIfNotBlank(transportHost) }
              }
              if (httpupgrade) {
                opts['v2ray-http-upgrade'] = true
                opts['v2ray-http-upgrade-fast-open'] = true
              }
              proxy[`${proxy.network}-opts`] = opts
            }
          } else {
            delete proxy.network
          }
        }

        proxy['client-fingerprint'] = params.fp
        proxy.alpn = params.alpn ? params.alpn.split(',') : undefined
        // 然而 wiki 和 app 实测中都没有字段表示这个
        // proxy['skip-cert-verify'] = /(TRUE)|1/i.test(params.allowInsecure);

        return proxy
      }
    }
    return { name, test, parse }
  }

  function URI_VLESS() {
    const name = 'URI VLESS Parser'
    const test = (line) => {
      return /^vless:\/\//.test(line)
    }
    const parse = (line) => {
      line = line.split('vless://')[1]
      let isShadowrocket
      let parsed = /^(.*?)@(.*?):(\d+)\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)
      if (!parsed) {
        // eslint-disable-next-line no-unused-vars
        let [_, base64, other] = /^(.*?)(\?.*?$)/.exec(line)
        line = `${Base64.decode(base64)}${other}`
        parsed = /^(.*?)@(.*?):(\d+)\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)
        isShadowrocket = true
      }
      // eslint-disable-next-line no-unused-vars
      let [__, uuid, server, port, ___, addons = '', name] = parsed
      if (isShadowrocket) {
        uuid = uuid.replace(/^.*?:/g, '')
      }

      port = parseInt(`${port}`, 10)
      uuid = decodeURIComponent(uuid)
      if (name != null) {
        name = decodeURIComponent(name)
      }

      const proxy = {
        type: 'vless',
        name,
        server,
        port,
        uuid
      }
      const params = {}
      for (const addon of addons.split('&')) {
        if (addon) {
          const [key, valueRaw] = addon.split('=')
          let value = valueRaw
          value = decodeURIComponent(valueRaw)
          params[key] = value
        }
      }

      proxy.name = name ?? params.remarks ?? params.remark ?? `VLESS ${server}:${port}`

      proxy.tls = params.security && params.security !== 'none'
      if (isShadowrocket && /TRUE|1/i.test(params.tls)) {
        proxy.tls = true
        params.security = params.security ?? 'reality'
      }
      proxy.sni = params.sni || params.peer
      proxy.flow = params.flow
      if (!proxy.flow && isShadowrocket && params.xtls) {
        // "none" is undefined
        const flow = [undefined, 'xtls-rprx-direct', 'xtls-rprx-vision'][params.xtls]
        if (flow) {
          proxy.flow = flow
        }
      }
      proxy['client-fingerprint'] = params.fp
      proxy.alpn = params.alpn ? params.alpn.split(',') : undefined
      proxy['skip-cert-verify'] = /(TRUE)|1/i.test(params.allowInsecure)

      if (['reality'].includes(params.security)) {
        const opts = {}
        if (params.pbk) {
          opts['public-key'] = params.pbk
        }
        if (params.sid) {
          opts['short-id'] = params.sid
        }
        if (params.spx) {
          opts['_spider-x'] = params.spx
        }
        if (Object.keys(opts).length > 0) {
          // proxy[`${params.security}-opts`] = opts;
          proxy[`${params.security}-opts`] = opts
        }
      }
      let httpupgrade = false
      proxy.network = params.type
      if (proxy.network === 'tcp' && params.headerType === 'http') {
        proxy.network = 'http'
      } else if (proxy.network === 'httpupgrade') {
        proxy.network = 'ws'
        httpupgrade = true
      }
      if (!proxy.network && isShadowrocket && params.obfs) {
        proxy.network = params.obfs
        if (['none'].includes(proxy.network)) {
          proxy.network = 'tcp'
        }
      }
      if (['websocket'].includes(proxy.network)) {
        proxy.network = 'ws'
      }
      if (proxy.network && !['tcp', 'none'].includes(proxy.network)) {
        const opts = {}
        const host = params.host ?? params.obfsParam
        if (host) {
          if (params.obfsParam) {
            try {
              const parsed = JSON.parse(host)
              opts.headers = parsed
            } catch (e) {
              opts.headers = { Host: host }
            }
          } else {
            opts.headers = { Host: host }
          }
        }
        if (params.serviceName) {
          opts[`${proxy.network}-service-name`] = params.serviceName
          if (['grpc'].includes(proxy.network) && params.authority) {
            opts['_grpc-authority'] = params.authority
          }
        } else if (isShadowrocket && params.path) {
          if (!['ws', 'http', 'h2'].includes(proxy.network)) {
            opts[`${proxy.network}-service-name`] = params.path
            delete params.path
          }
        }
        if (params.path) {
          opts.path = params.path
        }
        // https://github.com/XTLS/Xray-core/issues/91
        if (['grpc'].includes(proxy.network)) {
          opts['_grpc-type'] = params.mode || 'gun'
        }
        if (httpupgrade) {
          opts['v2ray-http-upgrade'] = true
          opts['v2ray-http-upgrade-fast-open'] = true
        }
        if (Object.keys(opts).length > 0) {
          proxy[`${proxy.network}-opts`] = opts
        }
        if (proxy.network === 'kcp') {
          // mKCP 种子。省略时不使用种子，但不可以为空字符串。建议 mKCP 用户使用 seed。
          if (params.seed) {
            proxy.seed = params.seed
          }
          // mKCP 的伪装头部类型。当前可选值有 none / srtp / utp / wechat-video / dtls / wireguard。省略时默认值为 none，即不使用伪装头部，但不可以为空字符串。
          proxy.headerType = params.headerType || 'none'
        }

        if (params.mode) {
          proxy._mode = params.mode
        }
        if (params.extra) {
          proxy._extra = params.extra
        }
        if (params.encryption) {
          proxy._encryption = params.encryption
        }
        if (params.pqv) {
          proxy._pqv = params.pqv
        }
      }

      return proxy
    }
    return { name, test, parse }
  }
  function URI_AnyTLS() {
    const name = 'URI AnyTLS Parser'
    const test = (line) => {
      return /^anytls:\/\//.test(line)
    }
    const parse = (line) => {
      const parsed = URI_VLESS().parse(line.replace('anytls', 'vless'))
      // 偷个懒
      line = line.split(/anytls:\/\//)[1]
      // eslint-disable-next-line no-unused-vars
      let [__, password, server, port, addons = '', name] = /^(.*?)@(.*?)(?::(\d+))?\/?(?:\?(.*?))?(?:#(.*?))?$/.exec(line)
      password = decodeURIComponent(password)
      port = parseInt(`${port}`, 10)
      if (isNaN(port)) {
        port = 443
      }
      password = decodeURIComponent(password)
      if (name != null) {
        name = decodeURIComponent(name)
      }
      name = name ?? `AnyTLS ${server}:${port}`

      const proxy = {
        ...parsed,
        uuid: undefined,
        type: 'anytls',
        name,
        server,
        port,
        password
      }

      for (const addon of addons.split('&')) {
        if (addon) {
          let [key, value] = addon.split('=')
          key = key.replace(/_/g, '-')
          value = decodeURIComponent(value)
          if (['alpn'].includes(key)) {
            proxy[key] = value ? value.split(',') : undefined
          } else if (['insecure'].includes(key)) {
            proxy['skip-cert-verify'] = /(TRUE)|1/i.test(value)
          } else if (['udp'].includes(key)) {
            proxy[key] = /(TRUE)|1/i.test(value)
          } else if (!Object.keys(proxy).includes(key)) {
            proxy[key] = value
          }
        }
      }

      if (['tcp'].includes(proxy.network) && !proxy['reality-opts']) {
        delete proxy.network
        delete proxy.security
      }

      return proxy
    }
    return { name, test, parse }
  }
  function URI_Hysteria2() {
    const name = 'URI Hysteria2 Parser'
    const test = (line) => {
      return /^(hysteria2|hy2):\/\//.test(line)
    }
    const parse = (line) => {
      line = line.split(/(hysteria2|hy2):\/\//)[2]
      // 端口跳跃有两种写法:
      // 1. 服务器的地址和可选端口。如果省略端口，则默认为 443。
      // 端口部分支持 端口跳跃 的「多端口地址格式」。
      // https://hysteria.network/zh/docs/advanced/Port-Hopping
      // 2. 参数 mport
      let ports
      /* eslint-disable no-unused-vars */
      let [__, password, server, ___, port, ____, _____, ______, _______, ________, addons = '', name] =
        /^(.*?)@(.*?)(:((\d+(-\d+)?)([,;]\d+(-\d+)?)*))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)

      /* eslint-enable no-unused-vars */
      if (/^\d+$/.test(port)) {
        port = parseInt(`${port}`, 10)
        if (isNaN(port)) {
          port = 443
        }
      } else if (port) {
        ports = port
        port = getRandomPort(ports)
      } else {
        port = 443
      }

      password = decodeURIComponent(password)
      if (name != null) {
        name = decodeURIComponent(name)
      }
      name = name ?? `Hysteria2 ${server}:${port}`

      const proxy = {
        type: 'hysteria2',
        name,
        server,
        port,
        ports,
        password
      }

      const params = {}
      for (const addon of addons.split('&')) {
        if (addon) {
          const [key, valueRaw] = addon.split('=')
          let value = valueRaw
          value = decodeURIComponent(valueRaw)
          params[key] = value
        }
      }

      proxy.sni = params.sni
      if (!proxy.sni && params.peer) {
        proxy.sni = params.peer
      }
      if (params.obfs && params.obfs !== 'none') {
        proxy.obfs = params.obfs
      }
      if (params.mport) {
        proxy.ports = params.mport
      }
      proxy['obfs-password'] = params['obfs-password']
      proxy['skip-cert-verify'] = /(TRUE)|1/i.test(params.insecure)
      proxy.tfo = /(TRUE)|1/i.test(params.fastopen)
      proxy['tls-fingerprint'] = params.pinSHA256
      let hop_interval = params['hop-interval'] || params['hop_interval']

      if (/^\d+$/.test(hop_interval)) {
        proxy['hop-interval'] = parseInt(`${hop_interval}`, 10)
      }
      let keepalive = params['keepalive']

      if (/^\d+$/.test(keepalive)) {
        proxy['keepalive'] = parseInt(`${keepalive}`, 10)
      }

      return proxy
    }
    return { name, test, parse }
  }
  function URI_Hysteria() {
    const name = 'URI Hysteria Parser'
    const test = (line) => {
      return /^(hysteria|hy):\/\//.test(line)
    }
    const parse = (line) => {
      line = line.split(/(hysteria|hy):\/\//)[2]
      // eslint-disable-next-line no-unused-vars
      let [__, server, ___, port, ____, addons = '', name] = /^(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)
      port = parseInt(`${port}`, 10)
      if (isNaN(port)) {
        port = 443
      }
      if (name != null) {
        name = decodeURIComponent(name)
      }
      name = name ?? `Hysteria ${server}:${port}`

      const proxy = {
        type: 'hysteria',
        name,
        server,
        port
      }
      const params = {}
      for (const addon of addons.split('&')) {
        if (addon) {
          let [key, value] = addon.split('=')
          key = key.replace(/_/, '-')
          value = decodeURIComponent(value)
          if (['alpn'].includes(key)) {
            proxy[key] = value ? value.split(',') : undefined
          } else if (['insecure'].includes(key)) {
            proxy['skip-cert-verify'] = /(TRUE)|1/i.test(value)
          } else if (['auth'].includes(key)) {
            proxy['auth-str'] = value
          } else if (['mport'].includes(key)) {
            proxy['ports'] = value
          } else if (['obfsParam'].includes(key)) {
            proxy['obfs'] = value
          } else if (['upmbps'].includes(key)) {
            proxy['up'] = value
          } else if (['downmbps'].includes(key)) {
            proxy['down'] = value
          } else if (['obfs'].includes(key)) {
            // obfs: Obfuscation mode (optional, empty or "xplus")
            proxy['_obfs'] = value || ''
          } else if (['fast-open', 'peer'].includes(key)) {
            params[key] = value
          } else if (!Object.keys(proxy).includes(key)) {
            proxy[key] = value
          }
        }
      }

      if (!proxy.sni && params.peer) {
        proxy.sni = params.peer
      }
      if (!proxy['fast-open'] && params.fastopen) {
        proxy['fast-open'] = true
      }
      if (!proxy.protocol) {
        // protocol: protocol to use ("udp", "wechat-video", "faketcp") (optional, default: "udp")
        proxy.protocol = 'udp'
      }

      return proxy
    }
    return { name, test, parse }
  }
  function URI_TUIC() {
    const name = 'URI TUIC Parser'
    const test = (line) => {
      return /^tuic:\/\//.test(line)
    }
    const parse = (line) => {
      line = line.split(/tuic:\/\//)[1]
      // eslint-disable-next-line no-unused-vars
      let [__, auth, server, port, addons = '', name] = /^(.*?)@(.*?)(?::(\d+))?\/?(?:\?(.*?))?(?:#(.*?))?$/.exec(line)
      auth = decodeURIComponent(auth)
      let [uuid, ...passwordParts] = auth.split(':')
      let password = passwordParts.join(':')
      port = parseInt(`${port}`, 10)
      if (isNaN(port)) {
        port = 443
      }
      password = decodeURIComponent(password)
      if (name != null) {
        name = decodeURIComponent(name)
      }
      name = name ?? `TUIC ${server}:${port}`

      const proxy = {
        type: 'tuic',
        name,
        server,
        port,
        password,
        uuid
      }

      for (const addon of addons.split('&')) {
        if (addon) {
          let [key, value] = addon.split('=')
          key = key.replace(/_/g, '-')
          value = decodeURIComponent(value)
          if (['alpn'].includes(key)) {
            proxy[key] = value ? value.split(',') : undefined
          } else if (['allow-insecure', 'insecure'].includes(key)) {
            proxy['skip-cert-verify'] = /(TRUE)|1/i.test(value)
          } else if (['fast-open'].includes(key)) {
            proxy.tfo = true
          } else if (['disable-sni', 'reduce-rtt'].includes(key)) {
            proxy[key] = /(TRUE)|1/i.test(value)
          } else if (key === 'congestion-control') {
            proxy['congestion-controller'] = value
            delete proxy[key]
          } else if (!Object.keys(proxy).includes(key)) {
            proxy[key] = value
          }
        }
      }

      return proxy
    }
    return { name, test, parse }
  }
  function URI_WireGuard() {
    const name = 'URI WireGuard Parser'
    const test = (line) => {
      return /^(wireguard|wg):\/\//.test(line)
    }
    const parse = (line) => {
      line = line.split(/(wireguard|wg):\/\//)[2]
      /* eslint-disable no-unused-vars */
      let [__, ___, privateKey, server, ____, port, _____, addons = '', name] = /^((.*?)@)?(.*?)(:(\d+))?\/?(\?(.*?))?(?:#(.*?))?$/.exec(line)
      /* eslint-enable no-unused-vars */

      port = parseInt(`${port}`, 10)
      if (isNaN(port)) {
        port = 51820
      }
      privateKey = decodeURIComponent(privateKey)
      if (name != null) {
        name = decodeURIComponent(name)
      }
      name = name ?? `WireGuard ${server}:${port}`
      const proxy = {
        type: 'wireguard',
        name,
        server,
        port,
        'private-key': privateKey,
        udp: true
      }
      for (const addon of addons.split('&')) {
        if (addon) {
          let [key, value] = addon.split('=')
          key = key.replace(/_/, '-')
          value = decodeURIComponent(value)
          if (['reserved'].includes(key)) {
            const parsed = value
              .split(',')
              .map((i) => parseInt(i.trim(), 10))
              .filter((i) => Number.isInteger(i))
            if (parsed.length === 3) {
              proxy[key] = parsed
            }
          } else if (['address', 'ip'].includes(key)) {
            value.split(',').map((i) => {
              const ip = i
                .trim()
                .replace(/\/\d+$/, '')
                .replace(/^\[/, '')
                .replace(/\]$/, '')
              if (isIPv4(ip)) {
                proxy.ip = ip
              } else if (isIPv6(ip)) {
                proxy.ipv6 = ip
              }
            })
          } else if (['mtu'].includes(key)) {
            const parsed = parseInt(value.trim(), 10)
            if (Number.isInteger(parsed)) {
              proxy[key] = parsed
            }
          } else if (/publickey/i.test(key)) {
            proxy['public-key'] = value
          } else if (/privatekey/i.test(key)) {
            proxy['private-key'] = value
          } else if (['udp'].includes(key)) {
            proxy[key] = /(TRUE)|1/i.test(value)
          } else if (![...Object.keys(proxy), 'flag'].includes(key)) {
            proxy[key] = value
          }
        }
      }

      return proxy
    }
    return { name, test, parse }
  }

  // Trojan URI format
  function URI_Trojan() {
    const name = 'URI Trojan Parser'
    const test = (line) => {
      return /^trojan:\/\//.test(line)
    }

    const parse = (line) => {
      const matched = /^(trojan:\/\/.*?@.*?)(:(\d+))?\/?(\?.*?)?$/.exec(line)
      const port = matched?.[2]
      if (!port) {
        line = line.replace(matched[1], `${matched[1]}:443`)
      }
      let [newLine, name] = line.split(/#(.+)/, 2)
      const parser = getTrojanURIParser()
      const proxy = parser.parse(newLine)
      if (isNotBlank(name)) {
        try {
          proxy.name = decodeURIComponent(name)
        } catch (e) {
          console.log(e)
        }
      }
      return proxy
    }
    return { name, test, parse }
  }

  return [
    URI_PROXY(),
    URI_SOCKS(),
    URI_SS(),
    URI_SSR(),
    URI_VMess(),
    URI_VLESS(),
    URI_AnyTLS(),
    URI_Hysteria(),
    URI_Hysteria2(),
    URI_TUIC(),
    URI_WireGuard(),
    URI_Trojan()
  ]
})()

// 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/preprocessors/index.js
const PROXY_PREPROCESSORS = (() => {
  function HTML() {
    const name = 'HTML'
    const test = (raw) => /^<!DOCTYPE html>/.test(raw)
    // simply discard HTML
    const parse = () => ''
    return { name, test, parse }
  }

  function Base64Encoded() {
    const name = 'Base64 Pre-processor'

    const keys = [
      'dm1lc3M', // vmess
      'c3NyOi8v', // ssr://
      'c29ja3M6Ly', // socks://
      'dHJvamFu', // trojan
      'c3M6Ly', // ss:/
      'c3NkOi8v', // ssd://
      'c2hhZG93', // shadow
      'aHR0c', // htt
      'dmxlc3M=', // vless
      'aHlzdGVyaWEy', // hysteria2
      'aHkyOi8v', // hy2://
      'd2lyZWd1YXJkOi8v', // wireguard://
      'd2c6Ly8=', // wg://
      'dHVpYzovLw==' // tuic://
    ]

    const test = function (raw) {
      return !/^\w+:\/\/\w+/im.test(raw) && keys.some((k) => raw.indexOf(k) !== -1)
    }
    const parse = function (raw) {
      const decoded = Base64.decode(raw)
      if (!/^\w+(:\/\/|\s*?=\s*?)\w+/m.test(decoded)) {
        $.error(`Base64 Pre-processor error: decoded line does not start with protocol`)
        return raw
      }

      return decoded
    }
    return { name, test, parse }
  }

  function fallbackBase64Encoded() {
    const name = 'Fallback Base64 Pre-processor'

    const test = function (raw) {
      return true
    }
    const parse = function (raw) {
      const decoded = Base64.decode(raw)
      if (!/^\w+(:\/\/|\s*?=\s*?)\w+/m.test(decoded)) {
        $.error(`Fallback Base64 Pre-processor error: decoded line does not start with protocol`)
        return raw
      }

      return decoded
    }
    return { name, test, parse }
  }

  function Clash() {
    const name = 'Clash Pre-processor'
    const test = function (raw) {
      if (!/proxies/.test(raw)) return false
      const content = safeLoad(raw)
      return content.proxies && Array.isArray(content.proxies)
    }
    const parse = function (raw, includeProxies) {
      // Clash YAML format

      // 防止 VLESS节点 reality-opts 选项中的 short-id 被解析成 Infinity
      // 匹配 short-id 冒号后面的值(包含空格和引号)
      const afterReplace = raw.replace(/short-id:([ \t]*[^#\n,}]*)/g, (matched, value) => {
        const afterTrim = value.trim()

        // 为空
        if (!afterTrim || afterTrim === '') {
          return 'short-id: ""'
        }

        // 是否被引号包裹
        if (/^(['"]).*\1$/.test(afterTrim)) {
          return `short-id: ${afterTrim}`
        } else if (['null'].includes(afterTrim)) {
          return `short-id: ${afterTrim}`
        } else {
          return `short-id: "${afterTrim}"`
        }
      })

      const { proxies, 'global-client-fingerprint': globalClientFingerprint } = safeLoad(afterReplace)
      return (
        (includeProxies ? 'proxies:\n' : '') +
        proxies
          .map((p) => {
            // https://github.com/MetaCubeX/mihomo/blob/Alpha/docs/config.yaml#L73C1-L73C26
            if (globalClientFingerprint && !p['client-fingerprint']) {
              p['client-fingerprint'] = globalClientFingerprint
            }
            return `${includeProxies ? '  - ' : ''}${JSON.stringify(p)}\n`
          })
          .join('')
      )
    }
    return { name, test, parse }
  }

  function SSD() {
    const name = 'SSD Pre-processor'
    const test = function (raw) {
      return raw.indexOf('ssd://') === 0
    }
    const parse = function (raw) {
      // preprocessing for SSD subscription format
      const output = []
      let ssdinfo = JSON.parse(Base64.decode(raw.split('ssd://')[1]))
      let port = ssdinfo.port
      let method = ssdinfo.encryption
      let password = ssdinfo.password
      // servers config
      let servers = ssdinfo.servers
      for (let i = 0; i < servers.length; i++) {
        let server = servers[i]
        method = server.encryption ? server.encryption : method
        password = server.password ? server.password : password
        let userinfo = Base64.encode(method + ':' + password)
        let hostname = server.server
        port = server.port ? server.port : port
        let tag = server.remarks ? server.remarks : i
        let plugin = server.plugin_options ? '/?plugin=' + encodeURIComponent(server.plugin + ';' + server.plugin_options) : ''
        output[i] = 'ss://' + userinfo + '@' + hostname + ':' + port + plugin + '#' + tag
      }
      return output.join('\n')
    }
    return { name, test, parse }
  }

  function FullConfig() {
    const name = 'Full Config Preprocessor'
    const test = function (raw) {
      return /^(\[server_local\]|\[Proxy\])/gm.test(raw)
    }
    const parse = function (raw) {
      const match = raw.match(/^\[server_local|Proxy\]([\s\S]+?)^\[.+?\](\r?\n|$)/im)?.[1]
      return match || raw
    }
    return { name, test, parse }
  }

  return [HTML(), Clash(), Base64Encoded(), SSD(), FullConfig(), fallbackBase64Encoded()]
})()

// 来源：https://github.com/sub-store-org/Sub-Store/blob/master/backend/src/core/proxy-utils/index.js
const ProxyUtils = (() => {
  function preprocess(raw) {
    for (const processor of PROXY_PREPROCESSORS) {
      try {
        if (processor.test(raw)) {
          $.info(`Pre-processor [${processor.name}] activated`)
          return processor.parse(raw)
        }
      } catch (e) {
        $.error(`Parser [${processor.name}] failed\n Reason: ${e}`)
      }
    }
    return raw
  }

  function parse(raw) {
    raw = preprocess(raw)
    // parse
    const lines = raw.split('\n')
    const proxies = []
    let lastParser

    for (let line of lines) {
      line = line.trim()
      if (line.length === 0) continue // skip empty line
      let success = false

      // try to parse with last used parser
      if (lastParser) {
        const [proxy, error] = tryParse(lastParser, line)
        if (!error) {
          proxies.push(lastParse(proxy))
          success = true
        }
      }

      if (!success) {
        // search for a new parser
        for (const parser of PROXY_PARSERS) {
          const [proxy, error] = tryParse(parser, line)
          if (!error) {
            proxies.push(lastParse(proxy))
            lastParser = parser
            success = true
            $.info(`${parser.name} is activated`)
            break
          }
        }
      }

      if (!success) {
        $.error(`Failed to parse line: ${line}`)
      }
    }
    return proxies.filter((proxy) => {
      if (['vless', 'vmess'].includes(proxy.type)) {
        const isProxyUUIDValid = isValidUUID(proxy.uuid)
        if (!isProxyUUIDValid) {
          $.error(`UUID may be invalid: ${proxy.name} ${proxy.uuid}`)
        }
        // return isProxyUUIDValid;
      }
      return true
    })
  }

  function produce(proxies, targetPlatform, type, opts = {}) {
    const producer = PROXY_PRODUCERS[targetPlatform]
    if (!producer) {
      throw new Error(`Target platform: ${targetPlatform} is not supported!`)
    }

    const sni_off_supported = /Surge|SurgeMac|Shadowrocket/i.test(targetPlatform)

    // filter unsupported proxies
    proxies = proxies.filter((proxy) => {
      // 检查代理是否支持目标平台
      if (proxy.supported && proxy.supported[targetPlatform] === false) {
        return false
      }

      // 对于 vless 和 vmess 代理,需要额外验证 UUID
      if (['vless', 'vmess'].includes(proxy.type)) {
        const isProxyUUIDValid = isValidUUID(proxy.uuid)
        if (!isProxyUUIDValid) $.error(`UUID may be invalid: ${proxy.name} ${proxy.uuid}`)
        // return isProxyUUIDValid;
      }

      return true
    })

    proxies = proxies.map((proxy) => {
      proxy._resolved = proxy.resolved

      if (!isNotBlank(proxy.name)) {
        proxy.name = `${proxy.type} ${proxy.server}:${proxy.port}`
      }
      if (proxy['disable-sni']) {
        if (sni_off_supported) {
          proxy.sni = 'off'
        } else if (!['tuic'].includes(proxy.type)) {
          $.error(`Target platform ${targetPlatform} does not support sni off. Proxy's fields (sni, tls-fingerprint and skip-cert-verify) will be modified.`)
          proxy.sni = ''
          proxy['skip-cert-verify'] = true
          delete proxy['tls-fingerprint']
        }
      }

      // 处理 端口跳跃
      if (proxy.ports) {
        proxy.ports = String(proxy.ports)
        if (!['ClashMeta'].includes(targetPlatform)) {
          proxy.ports = proxy.ports.replace(/\//g, ',')
        }
        if (!proxy.port) {
          proxy.port = getRandomPort(proxy.ports)
        }
      }

      return proxy
    })

    $.log(`Producing proxies for target: ${targetPlatform}`)
    if (typeof producer.type === 'undefined' || producer.type === 'SINGLE') {
      let list = proxies
        .map((proxy) => {
          try {
            return producer.produce(proxy, type, opts)
          } catch (err) {
            $.error(`Cannot produce proxy: ${JSON.stringify(proxy, null, 2)}\nReason: ${err}`)
            return ''
          }
        })
        .filter((line) => line.length > 0)
      list = type === 'internal' ? list : list.join('\n')
      if (targetPlatform.startsWith('Surge') && proxies.length > 0 && proxies.every((p) => p.type === 'wireguard')) {
        list = `#!name=${proxies[0]?._subName}
#!desc=${proxies[0]?._desc ?? ''}
#!category=${proxies[0]?._category ?? ''}
${list}`
      }
      return list
    } else if (producer.type === 'ALL') {
      return producer.produce(proxies, type, opts)
    }
  }

  function tryParse(parser, line) {
    if (!safeMatch(parser, line)) return [null, new Error('Parser mismatch')]
    try {
      const proxy = parser.parse(line)
      return [proxy, null]
    } catch (err) {
      return [null, err]
    }
  }

  function safeMatch(parser, line) {
    try {
      return parser.test(line)
    } catch (err) {
      return false
    }
  }

  function formatTransportPath(path) {
    if (typeof path === 'string' || typeof path === 'number') {
      path = String(path).trim()

      if (path === '') {
        return '/'
      } else if (!path.startsWith('/')) {
        return '/' + path
      }
    }
    return path
  }

  function lastParse(proxy) {
    if (typeof proxy.cipher === 'string') {
      proxy.cipher = proxy.cipher.toLowerCase()
    }
    if (typeof proxy.password === 'number') {
      proxy.password = numberToString(proxy.password)
    }
    if (['ss'].includes(proxy.type) && proxy.cipher === 'none' && !proxy.password) {
      // https://github.com/MetaCubeX/mihomo/issues/1677
      proxy.password = ''
    }
    if (proxy.interface) {
      proxy['interface-name'] = proxy.interface
      delete proxy.interface
    }
    if (isValidPortNumber(proxy.port)) {
      proxy.port = parseInt(proxy.port, 10)
    }
    if (proxy.server) {
      proxy.server = `${proxy.server}`.trim().replace(/^\[/, '').replace(/\]$/, '')
    }
    if (proxy.network === 'ws') {
      if (!proxy['ws-opts'] && (proxy['ws-path'] || proxy['ws-headers'])) {
        proxy['ws-opts'] = {}
        if (proxy['ws-path']) {
          proxy['ws-opts'].path = proxy['ws-path']
        }
        if (proxy['ws-headers']) {
          proxy['ws-opts'].headers = proxy['ws-headers']
        }
      }
      delete proxy['ws-path']
      delete proxy['ws-headers']
    }

    const transportPath = proxy[`${proxy.network}-opts`]?.path

    if (Array.isArray(transportPath)) {
      proxy[`${proxy.network}-opts`].path = transportPath.map((item) => formatTransportPath(item))
    } else if (transportPath != null) {
      proxy[`${proxy.network}-opts`].path = formatTransportPath(transportPath)
    }

    if (proxy.type === 'trojan') {
      if (proxy.network === 'tcp') {
        delete proxy.network
      }
    }
    if (['vless'].includes(proxy.type)) {
      if (!proxy.network) {
        proxy.network = 'tcp'
      }
    }
    if (['trojan', 'tuic', 'hysteria', 'hysteria2', 'juicity', 'anytls'].includes(proxy.type)) {
      proxy.tls = true
    }
    if (proxy.network) {
      let transportHost = proxy[`${proxy.network}-opts`]?.headers?.Host
      let transporthost = proxy[`${proxy.network}-opts`]?.headers?.host
      if (proxy.network === 'h2') {
        if (!transporthost && transportHost) {
          proxy[`${proxy.network}-opts`].headers.host = transportHost
          delete proxy[`${proxy.network}-opts`].headers.Host
        }
      } else if (transporthost && !transportHost) {
        proxy[`${proxy.network}-opts`].headers.Host = transporthost
        delete proxy[`${proxy.network}-opts`].headers.host
      }
    }
    if (proxy.network === 'h2') {
      const host = proxy['h2-opts']?.headers?.host
      const path = proxy['h2-opts']?.path
      if (host && !Array.isArray(host)) {
        proxy['h2-opts'].headers.host = [host]
      }
      if (Array.isArray(path)) {
        proxy['h2-opts'].path = path[0]
      }
    }

    // 非 tls, 有 ws/http 传输层, 使用域名的节点, 将设置传输层 Host 防止之后域名解析后丢失域名(不覆盖现有的 Host)
    if (!proxy.tls && ['ws', 'http'].includes(proxy.network) && !proxy[`${proxy.network}-opts`]?.headers?.Host && !isIP(proxy.server)) {
      proxy[`${proxy.network}-opts`] = proxy[`${proxy.network}-opts`] || {}
      proxy[`${proxy.network}-opts`].headers = proxy[`${proxy.network}-opts`].headers || {}
      proxy[`${proxy.network}-opts`].headers.Host = ['vmess', 'vless'].includes(proxy.type) && proxy.network === 'http' ? [proxy.server] : proxy.server
    }
    // 统一将 VMess 和 VLESS 的 http 传输层的 path 和 Host 处理为数组
    if (['vmess', 'vless'].includes(proxy.type) && proxy.network === 'http') {
      let transportPath = proxy[`${proxy.network}-opts`]?.path
      let transportHost = proxy[`${proxy.network}-opts`]?.headers?.Host
      if (transportHost && !Array.isArray(transportHost)) {
        proxy[`${proxy.network}-opts`].headers.Host = [transportHost]
      }
      if (transportPath && !Array.isArray(transportPath)) {
        proxy[`${proxy.network}-opts`].path = [transportPath]
      }
    }
    if (proxy.tls && !proxy.sni) {
      if (!isIP(proxy.server)) {
        proxy.sni = proxy.server
      }
      if (!proxy.sni && proxy.network) {
        let transportHost = proxy[`${proxy.network}-opts`]?.headers?.Host
        transportHost = Array.isArray(transportHost) ? transportHost[0] : transportHost
        if (transportHost) {
          proxy.sni = transportHost
        }
      }
    }
    // if (['hysteria', 'hysteria2', 'tuic'].includes(proxy.type)) {
    if (proxy.ports) {
      proxy.ports = String(proxy.ports).replace(/\//g, ',')
    } else {
      delete proxy.ports
    }
    // }
    if (['hysteria2'].includes(proxy.type) && proxy.obfs && !['salamander'].includes(proxy.obfs) && !proxy['obfs-password']) {
      proxy['obfs-password'] = proxy.obfs
      proxy.obfs = 'salamander'
    }
    if (['hysteria2'].includes(proxy.type) && !proxy['obfs-password'] && proxy['obfs_password']) {
      proxy['obfs-password'] = proxy['obfs_password']
      delete proxy['obfs_password']
    }
    if (['vless'].includes(proxy.type)) {
      // 删除 reality-opts: {}
      if (proxy['reality-opts'] && Object.keys(proxy['reality-opts']).length === 0) {
        delete proxy['reality-opts']
      }
      // 删除 grpc-opts: {}
      if (proxy['grpc-opts'] && Object.keys(proxy['grpc-opts']).length === 0) {
        delete proxy['grpc-opts']
      }
      // 非 reality, 空 flow 没有意义
      if (!proxy['reality-opts'] && !proxy.flow) {
        delete proxy.flow
      }
      if (['http'].includes(proxy.network)) {
        let transportPath = proxy[`${proxy.network}-opts`]?.path
        if (!transportPath) {
          if (!proxy[`${proxy.network}-opts`]) {
            proxy[`${proxy.network}-opts`] = {}
          }
          proxy[`${proxy.network}-opts`].path = ['/']
        }
      }
    }

    if (typeof proxy.name !== 'string') {
      if (/^\d+$/.test(proxy.name)) {
        proxy.name = `${proxy.name}`
      } else {
        try {
          if (proxy.name?.data) {
            proxy.name = Buffer.from(proxy.name.data).toString('utf8')
          } else {
            proxy.name = Buffer.from(proxy.name).toString('utf8')
          }
        } catch (e) {
          $.error(`proxy.name decode failed\nReason: ${e}`)
          proxy.name = `${proxy.type} ${proxy.server}:${proxy.port}`
        }
      }
    }
    if (['ws', 'http', 'h2'].includes(proxy.network)) {
      if (['ws', 'h2'].includes(proxy.network) && !proxy[`${proxy.network}-opts`]?.path) {
        proxy[`${proxy.network}-opts`] = proxy[`${proxy.network}-opts`] || {}
        proxy[`${proxy.network}-opts`].path = '/'
      } else if (proxy.network === 'http' && (!Array.isArray(proxy[`${proxy.network}-opts`]?.path) || proxy[`${proxy.network}-opts`]?.path.every((i) => !i))) {
        proxy[`${proxy.network}-opts`] = proxy[`${proxy.network}-opts`] || {}
        proxy[`${proxy.network}-opts`].path = ['/']
      }
    }
    if (['', 'off'].includes(proxy.sni)) {
      proxy['disable-sni'] = true
    }
    let caStr = proxy['ca_str']
    if (proxy['ca-str']) {
      caStr = proxy['ca-str']
    } else if (caStr) {
      delete proxy['ca_str']
      proxy['ca-str'] = caStr
    }
    try {
      if ($.env.isNode && !caStr && proxy['_ca']) {
        caStr = $.node.fs.readFileSync(proxy['_ca'], {
          encoding: 'utf8'
        })
      }
    } catch (e) {
      $.error(`Read ca file failed\nReason: ${e}`)
    }
    if (!proxy['tls-fingerprint'] && caStr) {
      proxy['tls-fingerprint'] = rs.generateFingerprint(caStr)
    }
    if (['ss'].includes(proxy.type) && isPresent(proxy, 'shadow-tls-password')) {
      proxy.plugin = 'shadow-tls'
      proxy['plugin-opts'] = {
        host: proxy['shadow-tls-sni'],
        password: proxy['shadow-tls-password'],
        version: proxy['shadow-tls-version']
      }
      delete proxy['shadow-tls-sni']
      delete proxy['shadow-tls-password']
      delete proxy['shadow-tls-version']
    }
    return proxy
  }

  function isIP(ip) {
    return isIPv4(ip) || isIPv6(ip)
  }

  return {
    parse,
    produce
  }
})()
