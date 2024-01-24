const protocolHandler = {
  hysteria: (line) => {
    const urlHysteria = new URL(line)
    const query = urlHysteria.searchParams
    const up = query.get('up') || query.get('upmbps')
    const down = query.get('down') || query.get('downmbps')
    const hysteria = {
      name: '',
      type: 'hysteria',
      server: urlHysteria.hostname,
      port: urlHysteria.port,
      sni: query.get('peer'),
      obfs: query.get('obfs'),
      auth_str: query.get('auth'),
      protocol: query.get('protocol'),
      up,
      down,
      'skip-cert-verify': Boolean(query.get('insecure'))
    }
    if (query.get('alpn')) {
      hysteria['alpn'] = query.get('alpn').split(',')
    }
    return hysteria
  },
  hysteria2: (line) => {
    const urlHysteria2 = new URL(line)
    const query = urlHysteria2.searchParams
    const hysteria2 = {
      name: '',
      type: 'hysteria2',
      server: urlHysteria2.hostname,
      port: urlHysteria2.port || 443,
      obfs: query.get('obfs'),
      'obfs-password': query.get('obfs-password'),
      sni: query.get('peer'),
      'skip-cert-verify': Boolean(query.get('insecure')),
      fingerprint: query.get('pinSHA256'),
      down: query.get('down'),
      up: query.get('up')
    }
    if (query.get('alpn')) {
      hysteria2['alpn'] = query.get('alpn').split(',')
    }
    if (urlHysteria2.username) {
      hysteria2['password'] = urlHysteria2.username
    }
    return hysteria2
  },
  tuic: (line) => {
    const urlTUIC = new URL(line)
    const query = urlTUIC.searchParams
    const tuic = {
      name: '',
      type: 'tuic',
      server: urlTUIC.hostname,
      port: urlTUIC.port,
      udp: true
    }
    // uuid, password / token
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
  trojan: (line) => {
    const urlTrojan = new URL(line)
    const query = urlTrojan.searchParams
    const trojan = {
      name: '',
      type: 'trojan',
      server: urlTrojan.hostname,
      port: urlTrojan.port,
      password: urlTrojan.username,
      udp: true,
      'skip-cert-verify': Boolean(query.get('allowInsecure'))
    }
    if (query.get('alpn')) {
      trojan['alpn'] = query.get('alpn').split(',')
    }
    if (query.get('sni')) {
      trojan.sni = query.get('sni')
    }
    const network = query.get('type').toLowerCase()
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
      }
    }
    trojan['client-fingerprint'] = query.get('fp') || 'chrome'
    return trojan
  },
  vless: (line) => {},
  vmess: (line) => {},
  ss: (line) => {},
  ssr: (line) => {}
}

const onSubscribe = async (proxies) => {
  const arr = proxies.split('\n')

  for (const line of arr) {
    let [schema, body] = line.split('://')
    schema = schema.toLowerCase()
    try {
      protocolHandler[schema]?.(line, body)
    } catch (error) {
      console.log('parse error')
    }
  }

  return proxies
}
