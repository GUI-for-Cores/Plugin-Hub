/**
 * 本插件使用开源项目：https://github.com/XTLS/Xray-core
 *
 * sing-box 不支持 XHTTP 传输，本插件让 xray-core 作为前置代理：
 * 1. 更新订阅时，自动找出使用 XHTTP 传输（可选：REALITY）的 vless 节点，把真实节点保存到插件目录，
 *    并在订阅里把它替换成同名的 socks 节点（127.0.0.1:端口），策略组与规则不受影响；
 * 2. 启动核心前，为最终配置里实际引用到的这些 socks 节点生成 Xray 配置并启动 Xray；
 * 3. 核心停止后停止 Xray。
 *
 * 【节点转换】插件在转换为 sing-box 格式时会丢弃 XHTTP 节点：
 * - 推荐把本插件拖到【节点转换】之前，这样可以拿到原始的分享链接 / Clash 节点，信息最完整；
 * - 如果本插件排在后面，会从【节点转换】缓存的 Clash 格式中找回被丢弃的 XHTTP 节点。
 *
 * 防回环：在 sing-box 路由规则最前面插入 process_name = xray / xray.exe -> direct，
 * 避免 TUN 模式下 xray 自身的流量再次被 sing-box 接管。
 */

const PATH = 'data/third/xray-front-proxy'
const PID_FILE = PATH + '/xray.pid'
const CONFIG_FILE = PATH + '/config.json'
const NODES_FILE = PATH + '/nodes.json'
const PROCESS_NAMES = ['xray', 'xray.exe']
const DEFAULT_START_PORT = 20800
const LOCAL_HOST = '127.0.0.1'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const { env } = Plugins.useEnvStore()
  const BIN_FILE = PATH + '/xray' + (env.os === 'windows' ? '.exe' : '')

  // 绝对路径不会变化，只解析一次
  let absPaths = null
  const getAbsPaths = () =>
    (absPaths ??= Promise.all([Plugins.AbsolutePath(BIN_FILE), Plugins.AbsolutePath(CONFIG_FILE), Plugins.AbsolutePath(PATH)])
      .then(([bin, config, dir]) => ({ bin, config, dir }))
      .catch((err) => {
        absPaths = null
        throw err
      }))

  /* 触发器 安装 */
  const onInstall = async () => {
    await installXray()
    return 0
  }

  /* 触发器 卸载 */
  const onUninstall = async () => {
    if (await isXrayRunning()) {
      throw '请先停止核心！'
    }
    await Plugins.confirm('确定要卸载Xray前置代理吗？', '将删除 ' + PATH + ' 目录，卸载后请重新更新订阅以恢复原始节点。')
    await Plugins.RemoveFile(PATH)
    return 0
  }

  /* 触发器 手动触发：展示已接管的节点 */
  const onRun = async () => {
    const store = await readStore()
    const entries = Object.values(store.nodes)
    if (entries.length === 0) {
      throw '还没有接管任何节点，请先更新订阅（确保订阅中有 XHTTP 节点）'
    }
    const subscribesStore = Plugins.useSubscribesStore()
    const running = await isXrayRunning()
    const lines = entries
      .sort((a, b) => a.port - b.port)
      .map((v) => `- **${v.tag}**（${subscribesStore.getSubscribeById(v.subscription)?.name ?? v.subscription}）→ \`socks5://${LOCAL_HOST}:${v.port}\``)
    await Plugins.alert(
      Plugin.name,
      `Xray 状态：${running ? '运行中' : '未运行'}\n\n已接管 ${entries.length} 个节点：\n\n${lines.join('\n')}\n\n启动核心时，会为配置中实际用到的节点启动 Xray；停止核心时自动停止 Xray。`,
      { type: 'markdown' }
    )
  }

  /* 触发器 更新订阅时：接管 XHTTP / REALITY 节点，直接修改入参并返回 */
  const onSubscribe = async (proxies, subscription) => {
    const options = getOptions()
    const taken = []
    const take = (tag, outbound) => {
      taken.push({ tag, outbound })
      return taken.length - 1
    }

    if (proxies.length === 1 && proxies[0].base64) {
      // 原始分享链接（本插件排在【节点转换】之前）：把命中的链接替换为 socks5 链接，其余交给【节点转换】
      const lines = Plugins.base64Decode(proxies[0].base64).split(/\r?\n/)
      const refs = lines.map((line) => {
        const node = /^vless:\/\//i.test(line.trim()) ? ignoreError(() => parseShareLink(line.trim())) : null
        return node && shouldTakeOver(node.query, options.protocols) ? take(node.name, node.outbound) : -1
      })
      const ports = await allocate(subscription, taken, options)
      if (taken.length) {
        refs.forEach((ref, i) => {
          if (ref !== -1) lines[i] = `socks5://${LOCAL_HOST}:${ports[ref]}#${encodeURIComponent(taken[ref].tag)}`
        })
        proxies[0].base64 = Plugins.base64Encode(lines.join('\n'))
      }
      return proxies
    }

    if (proxies.some((proxy) => proxy.name && !proxy.tag)) {
      // Clash 格式（本插件排在【节点转换】之前）：原地替换为 Clash 的 socks5 节点
      const refs = proxies.map((proxy) => {
        const node = proxy.type === 'vless' ? ignoreError(() => fromClash(proxy)) : null
        return node && shouldTakeOver(node.query, options.protocols) ? take(proxy.name, node.outbound) : -1
      })
      const ports = await allocate(subscription, taken, options)
      refs.forEach((ref, i) => {
        if (ref !== -1) proxies[i] = { name: taken[ref].tag, type: 'socks5', server: LOCAL_HOST, port: ports[ref], udp: true }
      })
      return proxies
    }

    // sing-box 格式（原生 sing-box 订阅，或已被【节点转换】转换过）
    const refs = proxies.map((proxy) => {
      const node = proxy.type === 'vless' ? ignoreError(() => fromSingBox(proxy)) : null
      return node && shouldTakeOver(node.query, options.protocols) ? take(proxy.tag, node.outbound) : -1
    })
    // 找回被【节点转换】丢弃的 XHTTP 节点
    const cached = await readNodeConvertCache(subscription, proxies)
    const recovered = []
    cached.forEach((proxy) => {
      if (proxy.type !== 'vless' || proxies.some((v) => v.tag === proxy.name)) return
      const node = ignoreError(() => fromClash(proxy))
      if (node && shouldTakeOver(node.query, options.protocols)) recovered.push({ name: proxy.name, ref: take(proxy.name, node.outbound) })
    })
    const ports = await allocate(subscription, taken, options)
    const toSocks = (ref) => ({ type: 'socks', tag: taken[ref].tag, server: LOCAL_HOST, server_port: ports[ref], version: '5' })
    refs.forEach((ref, i) => {
      if (ref !== -1) proxies[i] = toSocks(ref)
    })
    // 按缓存中的原始顺序把找回的节点插回去
    recovered.forEach(({ name, ref }) => {
      const prev = cached
        .slice(
          0,
          cached.findIndex((v) => v.name === name)
        )
        .reverse()
      const anchor = prev.map((v) => proxies.findIndex((p) => p.tag === v.name)).find((i) => i !== -1)
      proxies.splice(anchor === undefined ? proxies.length : anchor + 1, 0, toSocks(ref))
    })
    return proxies
  }

  /* 触发器 启动核心前：为实际引用到的节点启动 Xray，并插入防回环规则，直接修改入参并返回 */
  const onBeforeCoreStart = async (config) => {
    await stopXray()

    const options = getOptions()
    const store = await readStore()
    const nodes = pickReferencedNodes(config, store)
    if (nodes.length === 0) return config

    if (!(await Plugins.FileExists(BIN_FILE))) {
      throw `[${Plugin.name}] 配置中使用了 ${nodes.length} 个需要 Xray 的节点，但尚未安装 Xray，请先安装插件`
    }

    await Plugins.WriteFile(CONFIG_FILE, JSON.stringify(buildXrayConfig(nodes, options), null, 2))
    await startXray()
    
    setTimeout(() => {
      Plugin.status = 1
    }, 1000)

    return patchSingBoxConfig(config, options)
  }

  /* 触发器 核心停止后 */
  const onCoreStopped = async () => {
    await stopXray()
    return 2
  }

  /* 触发器 保存插件配置时 */
  const onConfigure = async (config, old) => {
    if (JSON.stringify(config.Protocols) !== JSON.stringify(old.Protocols)) {
      Plugins.message.info('接管协议已修改，请重新更新订阅后生效')
    }
    const { Protocols: _a, ...rest } = config
    const { Protocols: _b, ...restOld } = old
    if (JSON.stringify(rest) === JSON.stringify(restOld)) return
    const kernelApiStore = Plugins.useKernelApiStore()
    if (!kernelApiStore.running) return
    const ok = await Plugins.confirm(Plugin.name, '配置已修改，是否立即重启核心使其生效？').catch(() => false)
    if (!ok) return
    // 等待 GUI 保存完新配置后再重启
    setTimeout(() => {
      kernelApiStore.restartCore().catch((err) => Plugins.message.error(err.message || err))
    }, 300)
  }

  /* 菜单项 预览 Xray 配置（包含全部已接管节点） */
  const ViewConfig = async () => {
    const store = await readStore()
    const content = JSON.stringify(buildXrayConfig(Object.values(store.nodes), getOptions()), null, 2)
    await Plugins.alert('Xray 配置预览', '```json\n' + content + '\n```', { type: 'markdown' })
  }

  /* 菜单项 更新Xray */
  const Update = async () => {
    if (await isXrayRunning()) {
      throw '请先停止核心再更新 Xray'
    }
    await installXray()
    const version = await Plugins.Exec(BIN_FILE, ['version']).catch(() => '')
    Plugins.message.success('已更新：' + (version.split('\n')[0] || 'Xray'))
  }

  const getOptions = () => ({
    protocols: Array.isArray(Plugin.Protocols) ? Plugin.Protocols : ['xhttp'],
    startPort: normalizePort(Plugin.StartPort),
    dns: (Plugin.XrayDNS || []).map((v) => String(v).trim()).filter(Boolean),
    logLevel: Plugin.LogLevel || 'warning',
    bypassRule: Plugin.BypassRule !== false
  })

  /* ---------------------------- 节点持久化 ---------------------------- */

  const readStore = async () => {
    const text = await Plugins.ignoredError(Plugins.ReadFile, NODES_FILE)
    const store = ignoreError(() => JSON.parse(text))
    return store && typeof store.nodes === 'object' ? store : { nodes: {} }
  }

  const allocate = async (subscription, taken, options) => {
    const store = await readStore()
    const subscribeIds = new Set(Plugins.useSubscribesStore().subscribes.map((v) => v.id))
    const ports = assignPorts(store, subscription.id, taken, options.startPort, subscribeIds)
    await Plugins.MakeDir(PATH)
    await Plugins.WriteFile(NODES_FILE, JSON.stringify(store, null, 2))
    return ports
  }

  const readNodeConvertCache = async (subscription, proxies) => {
    // 只有【节点转换】启用且排在本插件之前时，才可能存在被丢弃的节点；原生 sing-box 订阅（含策略组等）无需查找
    const plugins = Plugins.usePluginsStore().plugins
    const converter = plugins.findIndex((v) => v.id === 'plugin-node-convert' && !v.disabled)
    if (converter === -1 || converter > plugins.findIndex((v) => v.id === Plugin.id)) return []
    if (proxies.some((v) => ['selector', 'urltest', 'direct', 'block', 'dns'].includes(v.type))) return []
    const file = 'data/.cache/tmp_subscription_' + subscription.id
    // 【节点转换】写缓存时没有 await，稍等并校验缓存与当前订阅一致
    for (let i = 0; i < 10; i++) {
      const text = await Plugins.ignoredError(Plugins.ReadFile, file)
      const list = text ? ignoreError(() => Plugins.YAML.parse(text)?.proxies) : null
      if (Array.isArray(list)) {
        const names = new Set(list.map((v) => v.name))
        if (proxies.every((v) => names.has(v.tag))) return list
      }
      await Plugins.sleep(100)
    }
    return []
  }

  /* ---------------------------- 进程管理 ---------------------------- */

  // 返回正在运行的 xray 进程 PID，未运行返回 0
  const getXrayPid = async () => {
    const pid = Number(await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)) || 0
    if (!pid) return 0
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, pid)
    return PROCESS_NAMES.includes(String(name).toLowerCase()) ? pid : 0
  }

  const isXrayRunning = async () => (await getXrayPid()) !== 0

  const stopXray = async () => {
    const pid = await getXrayPid()
    if (pid) {
      await Plugins.KillProcess(pid).catch((err) => console.log(`[${Plugin.name}]`, err))
      // 等待旧进程退出，避免端口仍被占用
      for (let i = 0; i < 30 && (await isXrayRunning()); i++) await Plugins.sleep(100)
    }
    await Plugins.ignoredError(Plugins.WriteFile, PID_FILE, '0')
  }

  const startXray = () => {
    return new Promise(async (resolve, reject) => {
      let output = ''
      let settled = false
      const done = (fn, arg) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn(arg)
      }
      const timer = setTimeout(async () => {
        // 没有等到启动日志，但进程还在，也视为成功
        if (await isXrayRunning()) done(resolve)
        else done(reject, 'Xray 启动超时：\n' + output.slice(-1000))
      }, 10000)
      let pid = 0
      try {
        const abs = await getAbsPaths()
        pid = await Plugins.ExecBackground(
          abs.bin,
          ['run', '-c', abs.config],
          (out) => {
            output += out + '\n'
            console.log(`[${Plugin.name}]`, out)
            if (/Xray .* started/.test(out)) done(resolve)
            if (/Failed to start|failed to load config/i.test(out)) done(reject, 'Xray 启动失败：\n' + output.slice(-1000))
          },
          async () => {
            // 只清理属于自己的 PID，避免误清掉重启后新进程的 PID
            if (pid && (await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)) === String(pid)) {
              await Plugins.ignoredError(Plugins.WriteFile, PID_FILE, '0')
            }
            done(reject, 'Xray 已退出：\n' + output.slice(-1000))
          },
          {
            PidFile: PID_FILE,
            WorkingDirectory: abs.dir,
            // 让 xray 在插件目录中查找 geoip.dat / geosite.dat
            Env: { XRAY_LOCATION_ASSET: abs.dir }
          }
        )
      } catch (error) {
        done(reject, error.message || error)
      }
    })
  }

  /* ---------------------------- 安装 ---------------------------- */

  const installXray = async () => {
    const name = getAssetName(env.os, env.arch)
    const tmp_file = 'data/.cache/' + name
    const { id } = Plugins.message.info('获取Xray下载地址', 999999999)
    try {
      const { body } = await Plugins.HttpGet('https://api.github.com/repos/XTLS/Xray-core/releases/latest', {
        Authorization: Plugins.getGitHubApiAuthorization?.()
      })
      if (body.message) throw body.message
      const asset = body.assets.find((asset) => asset.name === name)
      if (!asset) {
        throw '未找到对应资源: ' + name
      }
      if (asset.uploader.login !== 'github-actions[bot]') {
        throw '该资源可能非自动构建，存在安全风险'
      }
      Plugins.message.update(id, `下载Xray ${body.tag_name}`)
      await Plugins.MakeDir(PATH)
      await Plugins.Download(
        asset.browser_download_url,
        tmp_file,
        {},
        (progress, total) => {
          Plugins.message.update(id, `下载Xray ${body.tag_name}：` + ((progress / total) * 100).toFixed(2) + '%')
        },
        { Sha256: asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : undefined }
      )
      await Plugins.UnzipZIPFile(tmp_file, PATH)
      if (env.os !== 'windows') {
        await Plugins.Exec('chmod', ['+x', (await getAbsPaths()).bin])
      }
      await Plugins.RemoveFile(tmp_file)
      Plugins.message.update(id, '安装Xray完成', 'success')
    } finally {
      await Plugins.sleep(1000)
      Plugins.message.destroy(id)
    }
  }

  return { onInstall, onUninstall, onRun, onSubscribe, onBeforeCoreStart, onCoreStopped, onConfigure, ViewConfig, Update }
}

/* ---------------------------- 纯函数 ---------------------------- */

const ignoreError = (fn) => {
  try {
    return fn()
  } catch {
    return null
  }
}

const normalizePort = (value) => {
  const port = Number(value)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_START_PORT
}

const getAssetName = (os, arch) => {
  const _os = { windows: 'windows', linux: 'linux', darwin: 'macos' }[os]
  const _arch = { amd64: '64', 386: '32', arm64: 'arm64-v8a', arm: 'arm32-v7a' }[arch]
  if (!_os || !_arch) throw `不支持的平台：${os}/${arch}`
  return `Xray-${_os}-${_arch}.zip`
}

/**
 * 是否接管：(勾选 xhttp 且传输为 xhttp) 或 (勾选 reality 且安全层为 reality)
 */
const shouldTakeOver = (query, protocols) => {
  const network = String(query.type || '').toLowerCase()
  const security = String(query.security || '').toLowerCase()
  return (protocols.includes('xhttp') && ['xhttp', 'splithttp'].includes(network)) || (protocols.includes('reality') && security === 'reality')
}

/**
 * 分配端口并更新持久化数据（直接修改 store）
 * - key 为 订阅ID + 节点名，重复更新订阅时沿用原端口
 * - 清理本订阅中已不存在的节点，以及已删除订阅的节点
 * 返回与 taken 一一对应的端口
 */
const assignPorts = (store, subscriptionId, taken, startPort, subscribeIds) => {
  const old = store.nodes
  const keep = {}
  for (const [key, value] of Object.entries(old)) {
    if (value.subscription === subscriptionId) continue
    if (subscribeIds && !subscribeIds.has(value.subscription)) continue
    keep[key] = value
  }
  const used = new Set(Object.values(keep).map((v) => v.port))
  const keys = new Set()
  const ports = taken.map(({ tag, outbound }) => {
    let key = `${subscriptionId}|${tag}`
    for (let n = 2; keys.has(key); n++) key = `${subscriptionId}|${tag}#${n}`
    keys.add(key)
    let port = old[key]?.port
    if (!port || used.has(port)) {
      port = startPort
      while (used.has(port)) port++
    }
    used.add(port)
    keep[key] = { subscription: subscriptionId, tag, port, outbound }
    return port
  })
  store.nodes = keep
  return ports
}

/**
 * 找出最终 sing-box 配置中实际引用到的已接管节点（按 127.0.0.1:端口 匹配）
 */
const pickReferencedNodes = (config, store) => {
  const byPort = new Map(Object.values(store.nodes).map((v) => [v.port, v]))
  const ports = new Set()
  ;(config.outbounds || []).forEach((v) => {
    if (v.type === 'socks' && v.server === LOCAL_HOST && byPort.has(v.server_port)) ports.add(v.server_port)
  })
  return [...ports].sort((a, b) => a - b).map((port) => byPort.get(port))
}

const safeDecode = (str) => {
  try {
    return decodeURIComponent(str)
  } catch {
    return str
  }
}

const buildVlessOutbound = ({ address, port, id, query }) => {
  const user = { id, encryption: query.encryption || 'none' }
  if (query.flow) user.flow = query.flow
  return {
    protocol: 'vless',
    settings: { vnext: [{ address, port: Number(port), users: [user] }] },
    streamSettings: buildStreamSettings(query)
  }
}

/**
 * 解析 vless:// 分享链接（XTLS 标准分享链接格式）
 */
const parseShareLink = (link) => {
  const match = link.match(/^vless:\/\/([^@]+)@(\[[^\]]+\]|[^:/?#]+):(\d+)\/?(\?[^#]*)?(#.*)?$/i)
  if (!match) throw '无法解析的分享链接：' + link.slice(0, 60)
  const [, userinfo, rawHost, port, query = '', hash = ''] = match
  const address = rawHost.replace(/^\[|\]$/g, '')
  const q = Object.fromEntries(new URLSearchParams(query.slice(1)))
  const name = safeDecode(hash.slice(1)) || `vless-${address}:${port}`
  return { name, query: q, outbound: buildVlessOutbound({ address, port, id: safeDecode(userinfo), query: q }) }
}

/**
 * Clash / mihomo 格式的 vless 节点 -> 分享链接参数
 */
const fromClash = (p) => {
  const reality = p['reality-opts']
  const q = {
    type: p.network || 'tcp',
    security: reality ? 'reality' : p.tls ? 'tls' : 'none',
    sni: p.servername || p.sni || '',
    fp: p['client-fingerprint'] || '',
    alpn: (p.alpn || []).join(','),
    insecure: p['skip-cert-verify'] ? '1' : '',
    flow: p.flow || '',
    encryption: p.encryption || ''
  }
  if (reality) {
    q.pbk = reality['public-key'] || ''
    q.sid = reality['short-id'] || ''
    q.spx = reality['spider-x'] || reality['_spider-x'] || ''
  }
  if (q.type === 'xhttp') {
    const o = p['xhttp-opts'] || {}
    Object.assign(q, { path: o.path || '/', host: o.host || '', mode: o.mode || 'auto' })
    const extra = {}
    if (o.headers) extra.headers = o.headers
    if (o['no-grpc-header'] !== undefined) extra.noGRPCHeader = o['no-grpc-header']
    if (o['x-padding-bytes']) extra.xPaddingBytes = o['x-padding-bytes']
    if (o['sc-max-each-post-bytes']) extra.scMaxEachPostBytes = o['sc-max-each-post-bytes']
    if (o['sc-min-posts-interval-ms']) extra.scMinPostsIntervalMs = o['sc-min-posts-interval-ms']
    if (Object.keys(extra).length) q.extra = extra
  } else if (q.type === 'ws') {
    const o = p['ws-opts'] || {}
    Object.assign(q, { path: o.path || '/', host: o.headers?.Host || '' })
  } else if (q.type === 'grpc') {
    q.serviceName = p['grpc-opts']?.['grpc-service-name'] || ''
  } else if (q.type !== 'tcp') {
    throw '不支持的传输：' + q.type
  }
  return { query: q, outbound: buildVlessOutbound({ address: p.server, port: p.port, id: p.uuid, query: q }) }
}

/**
 * sing-box 格式的 vless 节点 -> 分享链接参数
 */
const fromSingBox = (o) => {
  const tls = o.tls || {}
  const reality = tls.reality?.enabled ? tls.reality : null
  const t = o.transport || {}
  const q = {
    type: t.type || 'tcp',
    security: reality ? 'reality' : tls.enabled ? 'tls' : 'none',
    sni: tls.server_name || '',
    fp: tls.utls?.enabled ? tls.utls.fingerprint || 'chrome' : '',
    alpn: (tls.alpn || []).join(','),
    insecure: tls.insecure ? '1' : '',
    flow: o.flow || ''
  }
  if (reality) {
    q.pbk = reality.public_key || ''
    q.sid = reality.short_id || ''
  }
  if (q.type === 'ws') {
    Object.assign(q, { path: t.path || '/', host: t.headers?.Host || '' })
  } else if (q.type === 'httpupgrade') {
    Object.assign(q, { path: t.path || '/', host: t.host || '' })
  } else if (q.type === 'grpc') {
    q.serviceName = t.service_name || ''
  } else if (q.type !== 'tcp') {
    throw '不支持的传输：' + q.type
  }
  return { query: q, outbound: buildVlessOutbound({ address: o.server, port: o.server_port, id: o.uuid, query: q }) }
}

const buildStreamSettings = (q) => {
  let network = (q.type || 'tcp').toLowerCase()
  if (network === 'splithttp') network = 'xhttp'
  if (network === 'tcp') network = 'raw'
  const stream = { network }

  if (network === 'xhttp') {
    const xhttp = { path: q.path || '/', mode: q.mode || 'auto' }
    if (q.host) xhttp.host = q.host
    if (q.extra) {
      xhttp.extra = typeof q.extra === 'string' ? JSON.parse(q.extra) : q.extra
    }
    stream.xhttpSettings = xhttp
  } else if (network === 'ws') {
    stream.wsSettings = { path: q.path || '/', ...(q.host ? { host: q.host } : {}) }
  } else if (network === 'httpupgrade') {
    stream.httpupgradeSettings = { path: q.path || '/', ...(q.host ? { host: q.host } : {}) }
  } else if (network === 'grpc') {
    stream.grpcSettings = { serviceName: q.serviceName || '', multiMode: q.mode === 'multi' }
  } else if (network === 'raw' && q.headerType === 'http') {
    stream.rawSettings = {
      header: { type: 'http', request: { path: (q.path || '/').split(','), headers: q.host ? { Host: q.host.split(',') } : {} } }
    }
  }

  const security = (q.security || 'none').toLowerCase()
  stream.security = security
  if (security === 'tls') {
    const tls = {}
    if (q.sni) tls.serverName = q.sni
    if (q.fp) tls.fingerprint = q.fp
    if (q.alpn) tls.alpn = q.alpn.split(',')
    if (q.ech) tls.echConfigList = q.ech
    if (q.pcs) tls.pinnedPeerCertSha256 = q.pcs
    if (q.vcn) tls.verifyPeerCertByName = q.vcn
    if (q.allowInsecure === '1' || q.insecure === '1') tls.allowInsecure = true
    stream.tlsSettings = tls
  } else if (security === 'reality') {
    const reality = { serverName: q.sni || '', fingerprint: q.fp || 'chrome', publicKey: q.pbk || '' }
    if (q.sid) reality.shortId = q.sid
    if (q.spx) reality.spiderX = q.spx
    if (q.pqv) reality.mldsa65Verify = q.pqv
    stream.realitySettings = reality
  }
  return stream
}

/**
 * 生成 Xray 配置：每个节点一个 socks 入站（使用持久化的端口）+ 一个出站，通过 inboundTag 一一路由
 */
const buildXrayConfig = (nodes, options) => {
  const { dns, logLevel } = options
  const inbounds = []
  const outbounds = []
  const rules = []
  nodes.forEach((node) => {
    const inTag = `in-${node.port}`
    const outTag = `out-${node.port}`
    inbounds.push({
      tag: inTag,
      listen: LOCAL_HOST,
      port: node.port,
      protocol: 'socks',
      settings: { auth: 'noauth', udp: true, ip: LOCAL_HOST }
    })
    const outbound = JSON.parse(JSON.stringify(node.outbound))
    outbound.tag = outTag
    if (dns.length) {
      // 使用 Xray 内置 DNS 直接解析节点域名，不经过 sing-box（避免 FakeIP / DNS 劫持）
      outbound.streamSettings = outbound.streamSettings || {}
      outbound.streamSettings.sockopt = { domainStrategy: 'UseIP', ...outbound.streamSettings.sockopt }
    }
    outbounds.push(outbound)
    rules.push({ type: 'field', inboundTag: [inTag], outboundTag: outTag })
  })
  outbounds.push({ tag: 'direct', protocol: 'freedom' })

  const config = {
    log: { loglevel: logLevel },
    inbounds,
    outbounds,
    routing: { domainStrategy: 'AsIs', rules }
  }
  if (dns.length) {
    config.dns = { servers: dns, queryStrategy: 'UseIP' }
  }
  return config
}

/**
 * 修改 sing-box 配置：插入防回环规则（xray 进程自身的流量含 DNS 直连）。直接修改入参并返回
 */
const patchSingBoxConfig = (config, options) => {
  if (!options.bypassRule) return config
  config.outbounds = config.outbounds || []
  let direct = config.outbounds.find((v) => v.type === 'direct')
  if (!direct) {
    direct = { type: 'direct', tag: 'xray-front-direct' }
    config.outbounds.push(direct)
  }
  config.route = config.route || {}
  config.route.rules = config.route.rules || []
  config.route.rules.unshift({ process_name: PROCESS_NAMES, action: 'route', outbound: direct.tag })
  return config
}
