const onRun = async () => {
  const res = await Plugins.prompt('请输入分享链接：', '', { placeholder: 'vmess://' })
  const [schema, body] = res.split("://");
  const proxy = protocolHandler[schema.toLowerCase()]?.(body);
  if (proxy) {
    // await Plugins.confirm(JSON.stringify(proxy, null, 2))
    Plugins.ClipboardSetText(JSON.stringify(proxy, null, 2))
    Plugins.message.success('解析成功，请查看剪切板')
  } else {
    Plugins.message.error('解析错误')
  }
}

const onSubscribe = async (proxies) => {
  if (Plugins.isValidBase64(proxies)) {
    const result = []
    const arr = atob(proxies).trim().split("\n");
    for (const line of arr) {
      let [schema, body] = line.split("://");
      schema = schema.toLowerCase();
      try {
        const proxy = protocolHandler[schema]?.(body);
        result.push(proxy)
      } catch (error) {
        console.log("parse error", error);
      }
    }
    return result
  }
  return proxies
}


const protocolHandler = {
  socks: (body) => {
    const urlSocks = new URL('http://' + body)
    const arr = atob(urlSocks.username).split(':')
    const socks = {
      name: urlSocks.hash.slice(1),
      type: 'socks5',
      server: urlSocks.hostname,
      port: Number(urlSocks.port),
      username: arr[0],
      password: arr[1],
      udp: true,
    }
    return socks
  },
  hysteria: (body) => {
    const urlHysteria = new URL('http://' + body);
    const query = urlHysteria.searchParams;
    const up = query.get("up") || query.get("upmbps");
    const down = query.get("down") || query.get("downmbps");
    const hysteria = {
      name: "",
      type: "hysteria",
      server: urlHysteria.hostname,
      port: urlHysteria.port,
      sni: query.get("peer"),
      obfs: query.get("obfs"),
      auth_str: query.get("auth"),
      protocol: query.get("protocol"),
      up,
      down,
      "skip-cert-verify": Boolean(query.get("insecure")),
    };
    if (query.get("alpn")) {
      hysteria["alpn"] = query.get("alpn").split(",");
    }
    return hysteria;
  },
  hysteria2: (body) => {
    const urlHysteria2 = new URL('http://' + body);
    const query = urlHysteria2.searchParams;
    const hysteria2 = {
      name: urlHysteria2.hash.slice(1),
      type: "hysteria2",
      server: urlHysteria2.hostname,
      port: urlHysteria2.port || 443,
      obfs: query.get("obfs"),
      "obfs-password": query.get("obfs-password"),
      sni: query.get("sni"),
      "skip-cert-verify": Boolean(query.get("insecure")),
      fingerprint: query.get("pinSHA256"),
      down: query.get("down"),
      up: query.get("up"),
    };
    if (query.get("alpn")) {
      hysteria2["alpn"] = query.get("alpn").split(",");
    }
    if (urlHysteria2.username) {
      hysteria2["password"] = urlHysteria2.username;
    }
    return hysteria2;
  },
  tuic: (body) => {
    const urlTUIC = new URL('http://' + body);
    const query = urlTUIC.searchParams;

    const tuic = {
      name: urlTUIC.hash.slice(1),
      type: "tuic",
      server: urlTUIC.hostname,
      port: Number(urlTUIC.port),
      udp: true,
      uuid: urlTUIC.username,
      password: urlTUIC.password
    };
    // token
    if (query.get("congestion_control")) {
      tuic["congestion-controller"] = query.get("congestion_control");
    }
    if (query.get("alpn")) {
      tuic["alpn"] = query.get("alpn").split(",");
    }
    if (query.get("sni")) {
      tuic.sni = query.get("sni");
    }
    if (query.get("disable_sni") == 1) {
      tuic["disable-sni"] = true;
    }
    if (query.get("udp_relay_mode")) {
      tuic["udp-relay-mode"] = query.get("udp_relay_mode");
    }
    return tuic;
  },
  trojan: (body) => {
    const urlTrojan = new URL('http://' + body);
    const query = urlTrojan.searchParams;
    const trojan = {
      name: decodeURIComponent(urlTrojan.hash.slice(1)),
      type: "trojan",
      server: urlTrojan.hostname,
      port: Number(urlTrojan.port),
      password: urlTrojan.username,
      udp: true,
      "skip-cert-verify": Boolean(query.get("allowInsecure")),
    };
    if (query.get("alpn")) {
      trojan["alpn"] = query.get("alpn").split(",");
    }
    if (query.get("sni")) {
      trojan.sni = query.get("sni");
    }
    const network = query.get("type")?.toLowerCase();
    if (network) {
      trojan.network = network;
    }
    switch (network) {
      case "ws": {
        const wsOpts = {
          path: query.get("path"),
          headers: {
            "User-Agent": "",
          },
        };
        trojan["ws-opts"] = wsOpts;
        break;
      }
      case "grpc": {
        trojan["grpc-opts"] = {
          "grpc-service-name": query.get("serviceName"),
        };
        break
      }
    }
    trojan["client-fingerprint"] = query.get("fp") || "chrome";
    return trojan;
  },
  vless: (body) => {
    const urlVless = new URL('http://' + body);
    const query = urlVless.searchParams;
    if (urlVless.hostname == "") {
      throw 'hostname is empty'
    }
    if (urlVless.port == '') {
      throw 'port is empty'
    }
    const vless = {
      name: decodeURIComponent(urlVless.hash.slice(1)),
      type: 'vless',
      server: urlVless.hostname,
      port: Number(urlVless.port),
      uuid: urlVless.username,
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
        vless.xudp = true
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
          Host: query.get('host'),
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
          "grpc-service-name": query.get('serviceName')
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
    const urlVmess = new URL('http://' + body);
    const query = urlVmess.searchParams;
    const json = JSON.parse(atob(body));
    const vmess = {
      name: json.v,
      type: "vmess",
      server: json.add,
      port: Number(json.port),
      uuid: json.id,
      alterId: json.aid || 0,
      udp: true,
      xudp: true,
      tls: false,
      "skip-cert-verify": false,
      cipher: query.get("encryption") || "auto",
    };
    let network = json.net.toLowerCase();
    if (json.type == "http") {
      network = "http";
    } else if (network == "http") {
      network = "h2";
    }
    vmess.network = network;
    let tls = json.tls.toLowerCase();
    if (tls.endsWith("tls")) {
      vmess.tls = true;
    }
    const alpn = json.alpn;
    if (alpn) {
      vmess.alpn = alpn.split(",");
    }
    const headers = {};
    const httpOpts = {};
    switch (network) {
      case "http":
        if (json.host) {
          headers["Host"] = [json.host];
        }
        httpOpts["path"] = ["/"];
        if (json.path) {
          httpOpts["path"] = [json.path];
        }
        httpOpts["headers"] = headers;
        vmess["http-opts"] = httpOpts;
        break;
      case "h2":
        const wsOpts = {};
        if (json.host) {
          headers["Host"] = json.host;
        }
        wsOpts["path"] = ["/"];
        if (json.path) {
          httpOpts["path"] = [json.path];
        }
        httpOpts["headers"] = headers;
        vmess["http-opts"] = httpOpts;
        break;
    }
    return vmess
  },
  ss: (body) => {
    let urlSS = new URL('http://' + body);
    const query = urlSS.searchParams

    const ss = {
      name: urlSS.hash.slice(1),
      type: "ss",
      server: urlSS.hostname,
      port: Number(urlSS.port),
      udp: true,
    };

    let cipherRaw = urlSS.username;

    if (urlSS.username) {
      const dcStr = decodeURIComponent(urlSS.host);
      urlSS = new URL("ss://" + dcStr);
    }

    let cipher = cipherRaw,
      password;

    if (!urlSS.password) {
      const dcStr = atob(decodeURIComponent(cipherRaw))
      const [_cipher, _password] = dcStr.split(":");
      cipher = _cipher;
      password = _password;
    }

    ss.cipher = cipher
    ss.password = password

    if (query.get("udp-over-tcp") == "true" || query.get("uot") == "1") {
      ss["udp-over-tcp"] = true;
    }

    const plugin = query.get("plugin");
    if (plugin && plugin.includes(";")) {
      pluginInfo = new sear();
    }

    return ss;
  },
  ssr: (line) => {
    const [before, after] = line.split("/?");
    const beforeArr = before.split(":");
    const query = new URLSearchParams(after);
    const ss = {
      name: query.get("remarks"),
      type: "ssr",
      host: beforeArr[1],
      port: beforeArr[2],
      protocol: beforeArr[3],
      method: beforeArr[4],
      obfs: beforeArr[5],
      password: beforeArr[6],
      udp: true,
    };
    const obfsParam = query.get("obfsparam");
    const protocolParam = query.get("protoparam");
    if (obfsParam) {
      ss["obfs-param"] = obfsParam;
    }
    if (protocolParam) {
      ssr["protocol-param"] = protocolParam;
    }
    return ss;
  },
};
