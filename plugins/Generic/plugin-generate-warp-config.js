// @ts-ignore
window[Plugin.id] = window[Plugin.id] || {}

const TEMP_DIR = 'data/.cache'
const PRIVATE_KEY_PATH = `${TEMP_DIR}/private_key.pem`
const CLOUDFLARE_API_URL = 'https://api.cloudflareclient.com/v0a2158/reg'
const WINDOWS_INSTALL_COMMAND = 'winget.exe install --id=FireDaemon.OpenSSL -e'
// @ts-ignore
const OPENSSL_EXEC_PATH = Plugin.OpenSslExecPath || 'C:/Program Files/FireDaemon OpenSSL 3/bin/openssl.exe'
const { env } = Plugins.useEnvStore()
/**
 * 插件钩子：运行按钮 - onRun
 */
const onRun = async () => {
  await generateWarpConfig()
  return 0
}

/**
 * 生成 WARP 配置
 */
const generateWarpConfig = async () => {
  const openSslExecPath = env.os === 'windows' ? OPENSSL_EXEC_PATH.replace(/\\/g, '/').replace(/^"|"$/g, '') : '/usr/bin/openssl'
  await checkOpenSsl(openSslExecPath)

  Plugins.message.info('生成私钥...')
  const { privateKeyHex, publicKeyHex } = await generatePrivateKey(openSslExecPath)
  Plugins.message.success('生成私钥并解析成功。')

  const privateKeyBase64 = hexToBase64(privateKeyHex)
  const publicKeyBase64 = hexToBase64(publicKeyHex)

  Plugins.message.info('向 Cloudflare WARP API 注册账户...')
  const warpInfo = await registerWarp(privateKeyBase64, publicKeyBase64)
  Plugins.message.success('WARP 账户注册成功。')

  Plugins.message.info('提取 Reserved 信息...')
  const warpReserved = getWarpReservedInfo(warpInfo)
  Plugins.message.success('Reserved 信息提取成功。')

  Plugins.message.info('生成最终配置...')
  const finalConfig = formatWarpConfig(warpInfo, warpReserved)

  try {
    if (
      await Plugins.confirm('帮助', `最终配置生成成功\n\n\n\`\`\`json\n${JSON.stringify(finalConfig, null, 2)}\n\`\`\`\n\n\n是否生成配置脚本？`, {
        okText: '是',
        cancelText: '否',
        markdown: true
      })
    ) {
      try {
        const configScript = await generateConfigScript(finalConfig)
        await Plugins.alert('帮助', `配置脚本生成成功\n\n\n\`\`\`javascript\n${configScript}\n\`\`\`\n\n\n点击确定复制`, {
          markdown: true
        })
        await Plugins.ClipboardSetText(configScript)
        Plugins.message.success('已复制配置脚本，请粘贴或者合并到配置设置-混入和脚本-脚本操作中使用')
      } catch (e) {
        throw `生成配置脚本时发生错误: ${e}`
      }
    }
  } catch (e) {
    await Plugins.ClipboardSetText(JSON.stringify(finalConfig, null, 2))
    Plugins.message.info('已复制 WARP 配置，请粘贴到文件中编辑。')
  }
}

/**
 * 检查是否安装 OpenSSL
 */
const checkOpenSsl = async (openSslExecPath) => {
  if (!(await Plugins.ignoredError(Plugins.Exec, openSslExecPath, ['-v']))) {
    if (env.os === 'windows') {
      Plugins.message.warn('未检测到 OpenSSL，请配置 OpenSSL 可执行文件路径，或者安装推荐的版本。')
      try {
        if (
          await Plugins.confirm('帮助', '是否立即安装？', {
            okText: '是',
            cancelText: '否'
          })
        ) {
          const [cmd, ...args] = WINDOWS_INSTALL_COMMAND.split(' ')
          await Plugins.Exec(cmd, args)
          Plugins.message.success('OpenSSL 安装成功。')
        }
      } catch (e) {
        await Plugins.ClipboardSetText(WINDOWS_INSTALL_COMMAND)
        throw '已复制 winget 安装命令，请手动粘贴到终端中执行，或者配置已安装的 OpenSSL 可执行文件路径。'
      }
    } else {
      throw '未检测到 OpenSSL，请安装后重新运行插件。'
    }
  }
}

/**
 * 生成 OpenSSL 私钥
 */
const generatePrivateKey = async (openSslExecPath) => {
  const privateKeyAbsPath = await Plugins.AbsolutePath(PRIVATE_KEY_PATH)
  const args1 = ['genpkey', '-algorithm', 'X25519', '-out', privateKeyAbsPath]
  const args2 = ['pkey', '-in', privateKeyAbsPath, '-text', '-noout']
  await Plugins.Exec(openSslExecPath, args1)
  const output = await Plugins.Exec(openSslExecPath, args2)
  await Plugins.RemoveFile(PRIVATE_KEY_PATH)
  return parseOpenSslOutput(output)
}

/**
 * 从 OpenSSL 的文本输出中解析私钥和公钥的十六进制字符串
 */
const parseOpenSslOutput = (outputString) => {
  const privMatch = /priv:\s*([\da-fA-F:\s]+?)(?=\npub:|$)/s.exec(outputString)
  const pubMatch = /pub:\s*([\da-fA-F:\s]+)/s.exec(outputString)
  const privateKeyHex = privMatch?.[1]?.replace(/[\s:]/g, '') || ''
  const publicKeyHex = pubMatch?.[1]?.replace(/[\s:]/g, '') || ''
  return { privateKeyHex, publicKeyHex }
}

/**
 * 将纯十六进制字符串还原为二进制并编码为 Base64
 */
const hexToBase64 = (hex) => {
  const bytes = Uint8Array.from(hex.match(/.{2}/g) || [], (h) => parseInt(h, 16))
  return btoa(String.fromCharCode(...bytes))
}

/**
 * 向 Cloudflare WARP API 注册账户
 */
const registerWarp = async (privateKeyBase64, publicKeyBase64) => {
  const currentTimestamp = new Date().toISOString()
  const { status, body } = await Plugins.HttpPost(
    CLOUDFLARE_API_URL,
    { 'CF-Client-Version': 'a-7.21-0721', 'Content-Type': 'application/json' },
    { key: publicKeyBase64, tos: currentTimestamp }
  )
  if (status !== 200) {
    throw '注册失败，请检查网络。'
  }
  body.config.private_key = privateKeyBase64
  return body.config
}

/**
 * 从 WARP 账户信息中提取并格式化 reserved 信息
 */
const getWarpReservedInfo = (warpInfo) => {
  const reservedStr = warpInfo.client_id
  const binary = atob(reservedStr)
  const decodedBytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  const hex = Array.from(decodedBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const decimals = Array.from(decodedBytes)
  return {
    reserved_dec: decimals,
    reserved_hex: `0x${hex}`,
    reserved_str: reservedStr
  }
}

/**
 * 格式化最终的 WARP 配置 JSON 对象
 */
const formatWarpConfig = (warpInfo, warpReserved) => {
  const { endpoint, public_key } = warpInfo.peers[0]
  return {
    endpoint: {
      v4: endpoint.v4.replace(/:0$/, ''),
      v6: endpoint.v6.replace(/:0$/, '').replace(/^\[|\]$/, ''),
      host: endpoint.host,
      ports: endpoint.ports
    },
    reserved_dec: warpReserved.reserved_dec,
    reserved_hex: warpReserved.reserved_hex,
    reserved_str: warpReserved.reserved_str,
    private_key: warpInfo.private_key,
    public_key: public_key,
    v4: warpInfo.interface.addresses.v4,
    v6: warpInfo.interface.addresses.v6
  }
}

/**
 * 生成配置脚本
 */
const generateConfigScript = async (warpConfig) => {
  const {
    endpoint: { v4: server, ports },
    reserved_dec: reserved,
    private_key: privateKey,
    public_key: publicKey,
    v4: addressV4,
    v6: addressV6
  } = warpConfig
  const port = ports[Math.floor(Math.random() * ports.length)]
  let proxyGroups = ''
  let upStreamProxy = ''
  try {
    proxyGroups = await Plugins.prompt('请输入要包含 Warp 节点的代理组/出站分组名称，多个分组请用英文逗号隔开', null, {
      placeholder: 'Group1,Group2,Group3',
      type: 'text'
    })
    upStreamProxy = await Plugins.prompt('请输入要作为前置代理的节点/代理组名称，如果不需要请留空', null, { placeholder: 'Proxy1', type: 'text' })
  } catch (e) {
    throw '未输入有效代理名称'
  }
  let configScript = ''
  if (Plugins.APP_TITLE.includes('SingBox')) {
    configScript = `const warp = {
    type: 'wireguard',
    tag: 'warp',
    address: ${JSON.stringify([`${addressV4}/32`, `${addressV6}/128`])
      .replace(/,/g, ', ')
      .replace(/"/g, "'")},
    private_key: '${privateKey}',
    peers: [
      {
        address: '${server}',
        port: ${port},
        public_key: '${publicKey}',
        allowed_ips: ['0.0.0.0/0', '::/0'],
        reserved: ${JSON.stringify(reserved).replace(/,/g, ', ')}
      }
    ],
    ${upStreamProxy ? `detour: '${upStreamProxy}'` : ''}
  }
  ${
    proxyGroups
      ? `const groupNames = ${JSON.stringify(proxyGroups.split(',').map((s) => s.trim()))
          .replace(/,/g, ', ')
          .replace(/"/g, "'")};
  config.outbounds.forEach((out) => {
    if (groupNames.includes(out.tag)) {
      if (!out.outbounds) {
        out.outbounds = [];
      }
      out.outbounds.push('warp');
    }
  })`
      : ''
  }
  config.endpoints = [warp]`
  } else {
    configScript = `const warp = {
    name: "warp",
    type: 'wireguard',
    ip: '${addressV4}',
    ipv6: '${addressV6}',
    'private-key': '${privateKey}',
    peers: [
      {
        server: '${server}',
        port: ${port},
        'public-key': '${publicKey}',
        allowed_ips: ['0.0.0.0/0', '::/0'],
        reserved: ${JSON.stringify(reserved).replace(/,/g, ', ')}
      }
    ],
    udp: true,
    ${upStreamProxy ? `'dialer-proxy': '${upStreamProxy}'` : ''}
  }
  ${
    proxyGroups
      ? `const groupNames = ${JSON.stringify(proxyGroups.split(',').map((v) => v.trim()))
          .replace(/,/g, ', ')
          .replace(/"/g, "'")};
  config['proxy-groups'].forEach((proxy) => {
    if (groupNames.includes(proxy.name)) {
      if (!proxy.proxies) {
        proxy.proxies = [];
      }
      proxy.proxies.push('warp')
    }
  })`
      : ''
  }
  config.proxies.push(warp)`
  }
  return `const onGenerate = async (config) => {
  ${configScript}
  return config
}`.replace(/^\s*$(?:\r\n?|\n)/gm, '')
}
