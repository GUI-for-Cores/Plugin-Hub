const onRun = async () => {
  const res = await Plugins.prompt('请输入分享链接：', '', { placeholder: 'vmess://' })
  const [schema, body] = res.split('://')

  const handler = protocolHandler[schema.toLowerCase()]
  if (!handler) throw `未实现当前协议[ ${schema} ]`

  const proxy = handler(body)
  if (!proxy) throw '解析错误'

  const str = Plugins.YAML.stringify(proxy)

  await Plugins.alert('解析结果如下：', str)
  Plugins.message.success('已复制剪切板')
  Plugins.ClipboardSetText(str)
}

const protocolHandler = {
  socks: (body) => {
    const url = new URL('http://' + body)
    const arr = atob(url.username).split(':')
    const socks = {
      name: url.hash.slice(1),
      type: 'socks5',
      server: url.hostname,
      port: Number(url.port),
      username: arr[0],
      password: arr[1],
      udp: true
    }
    return socks
  },
  hysteria: (body) => {
    const url = new URL('http://' + body)
    const query = url.searchParams
    const up = query.get('up') || query.get('upmbps') || 100
    const down = query.get('down') || query.get('downmbps') || 100
    const hysteria = {
      name: decodeURIComponent(url.hash.slice(1)),
      type: 'hysteria',
      server: url.hostname,
      port: url.port,
      sni: query.get('peer'),
      obfs: query.get('obfs'),
      auth_str: query.get('auth'),
      protocol: query.get('protocol'),
      up: Number(up),
      down: Number(down),
      'skip-cert-verify': Boolean(query.get('insecure'))
    }
    if (query.get('alpn')) {
      hysteria['alpn'] = query.get('alpn').split(',')
    }
    return hysteria
  },
  hysteria2: (body) => {
    const url = new URL('http://' + body)
    const query = url.searchParams
    const hysteria2 = {
      name: decodeURIComponent(url.hash.slice(1)),
      type: 'hysteria2',
      server: url.hostname,
      port: url.port || 443,
      obfs: query.get('obfs'),
      'obfs-password': query.get('obfs-password'),
      sni: query.get('sni'),
      'skip-cert-verify': Boolean(query.get('insecure')),
      fingerprint: query.get('pinSHA256'),
      down: query.get('down') || 100,
      up: query.get('up') || 100
    }
    if (query.get('alpn')) {
      hysteria2['alpn'] = query.get('alpn').split(',')
    }
    if (url.username) {
      hysteria2['password'] = url.username
    }
    return hysteria2
  },
  tuic: (body) => {
    const url = new URL('http://' + body)
    const query = url.searchParams
    const tuic = {
      name: decodeURIComponent(url.hash.slice(1)),
      type: 'tuic',
      server: url.hostname,
      port: Number(url.port),
      udp: true,
      uuid: url.username,
      password: url.password
    }
    // token
    if (query.get('congestion_control')) {
      tuic['congestion-controller'] = query.get('congestion_control')
    }
    if (query.get('alpn')) {
      tuic['alpn'] = query.get('alpn').split(',')
    }
    if (query.get('sni')) {
      tuic.sni = query.get('sni')
    }
    if (query.get('disable_sni') == 1) {
      tuic['disable-sni'] = true
    }
    if (query.get('udp_relay_mode')) {
      tuic['udp-relay-mode'] = query.get('udp_relay_mode')
    }
    return tuic
  },
  trojan: (body) => {
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
  },
  vless: (body) => {
    const url = new URL('http://' + body)
    const query = url.searchParams
    if (url.hostname == '') {
      throw 'hostname is empty'
    }
    if (url.port == '') {
      throw 'port is empty'
    }
    const vless = {
      name: decodeURIComponent(url.hash.slice(1)),
      type: 'vless',
      server: url.hostname,
      port: Number(url.port),
      uuid: url.username,
      udp: true
    }
    const tls = query.get('security').toLocaleLowerCase()
    if (tls.endsWith('tls') || tls == 'reality') {
      vless.tls = true
      vless['client-fingerprint'] = query.get('fp') || 'chrome'
      if (query.get('alpn')) {
        vless.alpn = query.get('alpn').split(',')
      }
    }
    if (query.get('sni')) {
      vless.servername = query.get('sni')
    }
    if (query.get('pbk')) {
      vless['reality-opts'] = {
        'public-key': query.get('pbk'),
        'short-id': query.get('sid')
      }
    }
    switch (query.get('packetEncoding')) {
      case 'none':
      case 'packet': {
        vless['packet-addr'] = true
        break
      }
      default: {
        vless['xudp'] = true
      }
    }
    let network = query.get('type')?.toLowerCase()
    if (!network) {
      network = 'tcp'
    }
    const fakeType = query.get('headerType')
    if (fakeType == 'http') {
      network = 'http'
    } else if (network == 'http') {
      network = 'h2'
    }
    vless.network = network
    switch (network) {
      case 'tcp': {
        if (fakeType != 'none') {
          const headers = {}
          const httpOpts = {
            path: '/'
          }
          if (query.get('host')) {
            headers.Host = query.get('host')
          }
          if (query.get('method')) {
            httpOpts.method = query.get('method')
          }
          if (query.get('path')) {
            httpOpts.path = query.get('path')
          }
          httpOpts.headers = headers
          vless['http-opts'] = httpOpts
        }
        break
      }
      case 'http': {
        const headers = {}
        const h2Opts = {
          path: '/'
        }
        if (query.get('path')) {
          h2Opts.path = query.get('path')
        }
        if (query.get('host')) {
          h2Opts.host = query.get('host')
        }
        h2Opts.headers = headers
        vless['h2-opts'] = h2Opts
        break
      }
      case 'ws': {
        const headers = {
          'User-Agent': 'chrome',
          Host: query.get('host')
        }
        const wsOpts = {
          path: query.get('path'),
          headers: headers
        }
        if (query.get('ed')) {
          const med = atob(query.get('ed'))
          wsOpts['max-early-data'] = med
        }
        if (query.get('eh')) {
          wsOpts['early-data-header-name'] = query.get('eh')
        }
        vless['ws-opts'] = wsOpts
        break
      }
      case 'grpc': {
        vless['grpc-opts'] = {
          'grpc-service-name': query.get('serviceName')
        }
        break
      }
    }
    if (query.get('flow')) {
      vless.flow = query.get('flow').toLowerCase()
    }
    return vless
  },
  vmess: (body) => {
    const url = new URL('http://' + body)
    const query = url.searchParams
    const json = JSON.parse(atob(body))
    const vmess = {
      name: decodeURIComponent(json.v || json.ps),
      type: 'vmess',
      server: json.add,
      port: Number(json.port),
      uuid: json.id,
      alterId: Number(json.aid) || 0,
      udp: true,
      xudp: true,
      tls: false,
      'skip-cert-verify': false,
      cipher: query.get('encryption') || 'auto'
    }
    let network = json.net?.toLowerCase()
    if (json.type == 'http') {
      network = 'http'
    } else if (network == 'http') {
      network = 'h2'
    }
    vmess.network = network
    let tls = json.tls?.toLowerCase()
    if (tls?.endsWith('tls')) {
      vmess.tls = true
    }
    const alpn = json.alpn
    if (alpn) {
      vmess.alpn = alpn.split(',')
    }
    const headers = {}
    const httpOpts = {}
    switch (network) {
      case 'http': {
        if (json.host) {
          headers['Host'] = [json.host]
        }
        httpOpts['path'] = ['/']
        if (json.path) {
          httpOpts['path'] = [json.path]
        }
        httpOpts['headers'] = headers
        vmess['http-opts'] = httpOpts
        break
      }
      case 'h2': {
        const wsOpts = {}
        if (json.host) {
          headers['Host'] = json.host
        }
        wsOpts['path'] = ['/']
        if (json.path) {
          httpOpts['path'] = [json.path]
        }
        httpOpts['headers'] = headers
        vmess['http-opts'] = httpOpts
        break
      }
    }
    return vmess
  },
  ss: (body) => {
    let url = new URL('http://' + body)
    const query = url.searchParams
    const ss = {
      name: decodeURIComponent(url.hash.slice(1)),
      type: 'ss',
      server: url.hostname,
      port: Number(url.port),
      udp: true
    }
    const cipherRaw = url.username
    if (url.username) {
      const dcStr = decodeURIComponent(url.host)
      url = new URL('ss://' + dcStr)
    }
    let cipher = cipherRaw,
      password
    if (!url.password) {
      const [_cipher, _password] = atob(cipherRaw).split(':')
      cipher = _cipher
      password = _password
    }
    ss.cipher = cipher
    ss.password = password
    if (query.get('udp-over-tcp') == 'true' || query.get('uot') == '1') {
      ss['udp-over-tcp'] = true
    }
    const plugin = query.get('plugin')
    if (plugin && plugin.includes(';')) {
      pluginInfo = new sear()
    }
    return ss
  },
  ssr: (body) => {
    const [before, after] = atob(body).split('/?')
    const beforeArr = before.split(':')
    const query = new URLSearchParams(after)
    const ss = {
      name: atob(query.get('remarks')),
      type: 'ssr',
      host: beforeArr[0],
      port: Number(beforeArr[1]),
      protocol: beforeArr[2],
      method: beforeArr[3],
      obfs: beforeArr[4],
      password: beforeArr[5],
      udp: true
    }
    const obfsParam = query.get('obfsparam')
    const protocolParam = query.get('protoparam')
    if (obfsParam) {
      ss['obfs-param'] = obfsParam
    }
    if (protocolParam) {
      ssr['protocol-param'] = protocolParam
    }
    return ss
  }
}
