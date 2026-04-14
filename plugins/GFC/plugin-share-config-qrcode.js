const JS_FILE = 'https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.js'
const PATH = 'data/third/share-config-qrcode'

/* 触发器 手动触发 */
const onRun = async () => {
  const profilesStore = Plugins.useProfilesStore()
  if (profilesStore.profiles.length === 0) {
    throw '请先创建一个配置'
  }

  let profile = null
  if (profilesStore.profiles.length === 1) {
    profile = profilesStore.profiles[0]
  } else {
    profile = await Plugins.picker.single(
      '请选择要分享的配置',
      profilesStore.profiles.map((v) => ({
        label: v.name,
        value: v
      })),
      [profilesStore.profiles[0]]
    )
  }

  await share(Plugins.deepClone(profile))
}

const share = async (profile) => {
  const port = (Plugin.Port && Plugin.Port !== 'undefined' && Plugin.Port !== '') ? Plugin.Port : '18963'
  await loadDependence()

  // 1. 启用 TUN（手机端必须）
  profile.tunConfig.enable = true
  profile.tunConfig.stack = 'Mixed'
  profile.tunConfig['auto-route'] = true
  profile.tunConfig['auto-detect-interface'] = true
  profile.tunConfig['dns-hijack'] = ['any:53']
  profile.tunConfig['strict-route'] = true

  // 2. 替换本地规则集为远程规则集
  const rulesetsStore = Plugins.useRulesetsStore()
  for (const rule of profile.rulesConfig) {
    if (rule.type !== 'RULE-SET' || !rule.enable) continue
    if (rule['ruleset-type'] === 'file' && rule.payload) {
      const ruleset = rulesetsStore.getRulesetById(rule.payload)
      if (ruleset && ruleset.type === 'Http' && ruleset.url) {
        rule['ruleset-type'] = 'http'
        rule['ruleset-name'] = ruleset.name || rule.payload
        rule['ruleset-format'] = ruleset.format || rule['ruleset-format']
        rule['ruleset-behavior'] = ruleset.behavior || rule['ruleset-behavior']
        rule.payload = ruleset.url
      }
    }
  }

  // 3. 生成 Mihomo 配置
  const config = await Plugins.generateConfig(profile)

  // 4. 消除 proxy-providers：全部内联节点，展开 use 引用
  //    避免 http provider 与 inline proxies 重名冲突，确保配置完全自包含
  const subscribesStore = Plugins.useSubscribesStore()
  if (config['proxy-providers']) {
    const existingNames = new Set((config.proxies || []).map((p) => p.name))

    for (const [id, provider] of Object.entries(config['proxy-providers'])) {
      // 读取该 provider 的节点列表
      const sub = subscribesStore.getSubscribeById(id)
      const subPath = sub ? sub.path : provider.path?.replace(/^\.\.\//, 'data/')
      let providerProxyNames = []
      if (subPath) {
        try {
          const content = await Plugins.ReadFile(subPath)
          const parsed = Plugins.YAML.parse(content)
          const proxies = parsed.proxies || []
          // 内联不重复的节点
          for (const proxy of proxies) {
            if (!existingNames.has(proxy.name)) {
              config.proxies = config.proxies || []
              config.proxies.push(proxy)
              existingNames.add(proxy.name)
            }
          }
          providerProxyNames = proxies.map((p) => p.name)
        } catch (e) {
          console.warn(`无法读取订阅 ${id} 的缓存:`, e)
        }
      }

      // 将引用此 provider 的 proxy-groups 的 use 展开为 proxies
      for (const group of config['proxy-groups'] || []) {
        if (group.use && group.use.includes(id)) {
          group.use = group.use.filter((u) => u !== id)
          if (group.use.length === 0) delete group.use
          group.proxies = group.proxies || []
          group.proxies.push(...providerProxyNames.filter((n) => !group.proxies.includes(n)))
        }
      }
    }

    delete config['proxy-providers']
  }

  // 5. 兜底：检查 rule-providers 中残留的 file 类型
  if (config['rule-providers']) {
    for (const [name, provider] of Object.entries(config['rule-providers'])) {
      if (provider.type !== 'file') continue
      const ruleset = rulesetsStore.rulesets.find((r) => r.name === name || r.id === name)
      if (ruleset && ruleset.type === 'Http' && ruleset.url) {
        provider.type = 'http'
        provider.url = ruleset.url
        provider.interval = 86400
        delete provider.path
      }
    }
  }

  // 7. CMFA 只显示 GLOBAL 组引用的代理组，确保自定义组可见
  const groups = config['proxy-groups'] || []
  const globalGroup = groups.find((g) => g.name === 'GLOBAL')
  if (globalGroup) {
    const globalProxies = new Set(globalGroup.proxies || [])
    for (const group of groups) {
      if (group === globalGroup || group.hidden) continue
      if (!globalProxies.has(group.name)) {
        globalGroup.proxies = globalGroup.proxies || []
        globalGroup.proxies.push(group.name)
      }
    }
  }

  // 8. 清理 PC 专属配置
  delete config.secret
  config['external-controller'] = '127.0.0.1:9090'
  config['allow-lan'] = false

  // 9. TUN 模式 DNS 引导：确保代理节点域名和 DNS 服务器域名能直连解析，避免循环依赖
  if (config.dns) {
    const bootstrapDNS = ['223.5.5.5', '8.8.8.8']
    if (!config.dns['proxy-server-nameserver'] || config.dns['proxy-server-nameserver'].length === 0) {
      config.dns['proxy-server-nameserver'] = bootstrapDNS
    }
    if (!config.dns['default-nameserver'] || config.dns['default-nameserver'].length === 0) {
      config.dns['default-nameserver'] = bootstrapDNS
    }
  }


  // 8. 获取本机局域网 IP 并启动 HTTP 服务
  const ips = await getIPAddress()
  if (ips.length === 0) throw '未找到局域网 IP 地址，请检查网络连接'

  const configYaml = Plugins.YAML.stringify(config)

  // DEBUG: 保存生成的配置供检查（调试时取消注释）
  // await Plugins.WriteFile(PATH + '/debug-config.yaml', configYaml)

  const urls = await Promise.all(
    ips.map((ip) => {
      const url = `http://${ip}:${port}`
      return getQRCode(url, url)
    })
  )

  const { close } = await Plugins.StartServer('0.0.0.0:' + port, Plugin.id, async (req, res) => {
    res.end(200, { 'Content-Type': 'text/yaml; charset=utf-8' }, configYaml)
  })

  await Plugins.alert(
    Plugin.name,
    '### 注意事项：\n\n' +
      ' - 请保证电脑和手机处于同一局域网内\n' +
      ' - 请关闭电脑防火墙或放行端口 ' + port + '\n' +
      ' - 如果 CMFA 无法通过深度链接导入，请复制链接在 CMFA 中手动添加\n' +
      ' - 如果仍无法导入，请更换不同二维码尝试\n\n' +
      '|分享链接|二维码|\n|-|-|\n' +
      urls.map((item) => `|${item.url}|![](${item.qrcode})|`).join('\n'),
    { type: 'markdown' }
  )

  close()
}

/* 触发器 安装 */
const onInstall = async () => {
  await Plugins.Download(JS_FILE, PATH + '/qrcode.min.js')
  await Plugins.message.success('安装成功')
  return 0
}

/* 触发器 卸载 */
const onUninstall = async () => {
  await Plugins.RemoveFile(PATH)
  return 0
}

/**
 * 动态引入 QRCode 依赖，不存在时自动下载
 */
async function loadDependence() {
  if (window.QRCode) return

  const filePath = PATH + '/qrcode.min.js'
  let text = await Plugins.ignoredError(Plugins.ReadFile, filePath)

  if (!text) {
    const { id } = Plugins.message.info('正在下载二维码依赖...', 30000)
    try {
      await Plugins.Download(JS_FILE, filePath)
      text = await Plugins.ReadFile(filePath)
      Plugins.message.update(id, '依赖下载完成', 'success')
      await Plugins.sleep(1000).then(() => Plugins.message.destroy(id))
    } catch (error) {
      Plugins.message.destroy(id)
      throw '二维码依赖下载失败，请检查网络连接'
    }
  }

  const script = document.createElement('script')
  script.id = Plugin.id
  script.text = text
  document.body.appendChild(script)
}

/**
 * 生成二维码 Data URL
 */
function getQRCode(rawUrl, content) {
  return new Promise((resolve) => {
    QRCode.toDataURL(content, { width: 256, margin: 2 }, (err, dataUrl) => {
      resolve({ url: rawUrl, qrcode: dataUrl })
    })
  })
}

/**
 * 判断是否为私有 IP
 */
function isPrivateIP(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const first = parseInt(parts[0], 10)
  const second = parseInt(parts[1], 10)
  const fourth = parseInt(parts[3], 10)
  if (first === 255 || fourth === 1 || fourth === 255) return false
  if (first === 10) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  return false
}

/**
 * 获取本机局域网 IP 列表
 */
async function getIPAddress() {
  const os = Plugins.useEnvStore().env.os
  const cmd = { windows: 'ipconfig', linux: 'ip', darwin: 'ifconfig' }[os]
  const arg = { windows: [], linux: ['a'], darwin: [] }[os]
  const text = await Plugins.Exec(cmd, arg, { convert: os === 'windows' })
  const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
  let ips = text.match(ipv4Pattern) || []
  ips = ips.filter((ip) => isPrivateIP(ip))

  const getPriority = (ip) => {
    if (ip.startsWith('192.')) return 0
    if (ip.startsWith('10.')) return 1
    if (ip.startsWith('172.')) return 2
    return 3
  }
  return [...new Set(ips)].sort((a, b) => getPriority(a) - getPriority(b))
}
