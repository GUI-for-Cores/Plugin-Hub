/**
 * 本插件使用开源项目：https://github.com/router-for-me/CLIProxyAPI
 */

/** @type {EsmPlugin} */
export default (Plugin) => {
  const PATH = 'data/third/cliproxyapi'
  const CACHE_PATH = 'data/.cache/cliproxyapi'
  const CONFIG_FILE = PATH + '/config.yaml'
  const PID_FILE = PATH + '/cliproxyapi.pid'

  const { env } = Plugins.useEnvStore()
  const BIN_FILE = PATH + '/cli-proxy-api' + (env.os === 'windows' ? '.exe' : '')

  const onInstall = async () => {
    await installCLIProxyAPI()
    const credentials = await ensureConfig()
    if (credentials) {
      await Plugins.alert(
        'CLIProxyAPI 安装成功',
        `API Key：${credentials.apiKey}\n管理密钥：${credentials.managementKey}\n\n请妥善保存。后续可在管理面板或配置文件中修改。`
      )
    }
    return 0
  }

  const onUninstall = async () => {
    if (await isRunning()) {
      throw '请先停止 CLIProxyAPI 服务！'
    }
    await Plugins.confirm('确定要卸载 CLIProxyAPI 吗？', '配置、登录凭据和日志都将被删除。')
    await Plugins.RemoveFile(PATH)
    return 0
  }

  const onStartup = async () => {
    if (Plugin.AutoStartOrStop && !(await isRunning())) {
      await startService()
      return 1
    }
  }

  const onShutdown = async () => {
    if (Plugin.AutoStartOrStop && (await isRunning())) {
      await stopService()
      return 2
    }
  }

  const onConfigure = async (config, old) => {
    if (config.ListenAddress === old.ListenAddress) return

    const { host, port } = parseListenAddress(config.ListenAddress)

    const serviceConfig = await readConfig()
    const previousHost = serviceConfig.host
    const previousPort = serviceConfig.port
    serviceConfig.host = host
    serviceConfig.port = port
    await Plugins.WriteFile(CONFIG_FILE, Plugins.YAML.stringify(serviceConfig))

    if (await isRunning()) {
      await stopService()
      try {
        await startService()
      } catch (error) {
        serviceConfig.host = previousHost
        serviceConfig.port = previousPort
        await Plugins.WriteFile(CONFIG_FILE, Plugins.YAML.stringify(serviceConfig))
        await Plugins.ignoredError(startService)
        throw error
      }
      return 1
    }
  }

  const onRun = async () => {
    if (!(await isRunning())) {
      await startService()
    }
    await OpenPanel()
    return 1
  }

  const Start = async () => {
    if (await isRunning()) {
      throw 'CLIProxyAPI 服务已经在运行'
    }
    await startService()
    Plugins.message.success('CLIProxyAPI 启动成功')
    return 1
  }

  const Stop = async () => {
    if (!(await isRunning())) {
      throw 'CLIProxyAPI 服务并未运行'
    }
    await stopService()
    Plugins.message.success('CLIProxyAPI 已停止')
    return 2
  }

  const Update = async () => {
    const running = await isRunning()
    if (running) {
      await stopService()
    }

    try {
      await installCLIProxyAPI(true)
    } catch (error) {
      if (running && (await Plugins.FileExists(BIN_FILE))) {
        await startService()
      }
      throw error
    }

    if (running) {
      await startService()
      Plugins.message.success('CLIProxyAPI 已更新并重新启动')
      return 1
    }
    Plugins.message.success('CLIProxyAPI 更新成功')
    return 0
  }

  const OpenPanel = async () => {
    if (!(await isRunning())) {
      await startService()
    }
    const { url } = await getServerInfo()
    Plugins.BrowserOpenURL(url + '/management.html')
    return 1
  }

  const Config = async () => {
    await ensureConfig()
    Plugins.BrowserOpenURL(await Plugins.AbsolutePath(CONFIG_FILE))
  }

  const OpenDir = async () => {
    Plugins.BrowserOpenURL(await Plugins.AbsolutePath(PATH))
  }

  const CopyAPIInfo = async () => {
    const config = await readConfig()
    const { url } = getServerInfoFromConfig(config)
    const apiKey = config['api-keys']?.[0] || ''
    await Plugins.ClipboardSetText(`Base URL: ${url}/v1\nAPI Key: ${apiKey}`)
    Plugins.message.success('API 地址和密钥已复制')
  }

  const isRunning = async () => {
    const pid = await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)
    if (!pid || pid === '0') return false

    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return Boolean(name?.toLowerCase().includes('cli-proxy-api'))
  }

  const stopService = async () => {
    const pid = await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)
    if (pid && pid !== '0') {
      await Plugins.ignoredError(Plugins.KillProcess, Number(pid))
    }
    await Plugins.WriteFile(PID_FILE, '0')
  }

  const startService = async () => {
    if (!(await Plugins.FileExists(BIN_FILE))) {
      throw 'CLIProxyAPI 尚未安装，请先安装插件'
    }

    await ensureConfig()
    const workingDirectory = await Plugins.AbsolutePath(PATH)
    const configPath = await Plugins.AbsolutePath(CONFIG_FILE)
    const { address } = await getServerInfo()
    let output = ''
    const pid = await Plugins.ExecBackground(
      BIN_FILE,
      ['--config', configPath],
      (out) => {
        output = (output + out).slice(-2000)
        console.log(`[${Plugin.name}]`, out)
      },
      async (out) => {
        output = (output + out).slice(-2000)
        await Plugins.WriteFile(PID_FILE, '0')
      },
      { WorkingDirectory: workingDirectory }
    )
    await Plugins.WriteFile(PID_FILE, String(pid))

    for (let i = 0; i < 20; i++) {
      await Plugins.sleep(250)
      if (!(await isRunning())) {
        await Plugins.WriteFile(PID_FILE, '0')
        throw `CLIProxyAPI 启动失败${output ? `：\n${output}` : ''}`
      }
      if ((await Plugins.ignoredError(Plugins.TcpPing, address)) !== undefined) {
        return
      }
    }

    await stopService()
    throw `CLIProxyAPI 启动超时，请检查端口和配置${output ? `：\n${output}` : ''}`
  }

  const installCLIProxyAPI = async (isUpdate = false) => {
    const arch = { amd64: 'amd64', arm64: 'aarch64' }[env.arch]
    if (!['windows', 'linux', 'darwin'].includes(env.os) || !arch) {
      throw `不支持的平台：${env.os} ${env.arch}`
    }

    const suffix = env.os === 'windows' ? '.zip' : '.tar.gz'
    const archive = CACHE_PATH + suffix
    const extractPath = CACHE_PATH + '-extract'
    const { id } = Plugins.message.info(isUpdate ? '检查 CLIProxyAPI 更新' : '获取 CLIProxyAPI 下载地址', 999999999)

    try {
      const { body } = await Plugins.HttpGet('https://api.github.com/repos/router-for-me/CLIProxyAPI/releases/latest', {
        Authorization: Plugins.getGitHubApiAuthorization?.()
      })
      if (body.message) throw body.message

      const version = body.tag_name.replace(/^v/, '')
      const assetName = `CLIProxyAPI_${version}_${env.os}_${arch}${suffix}`
      const asset = body.assets.find((item) => item.name === assetName)
      if (!asset) throw '未找到对应资源：' + assetName
      if (asset.uploader.login !== 'github-actions[bot]') {
        throw '该资源可能并非自动构建，存在安全风险'
      }

      await Plugins.MakeDir(PATH)
      await Plugins.MakeDir('data/.cache')
      await Plugins.RemoveFile(extractPath)
      Plugins.message.update(id, `下载 CLIProxyAPI ${body.tag_name}`)
      await Plugins.Download(
        asset.browser_download_url,
        archive,
        {},
        (progress, total) => {
          if (total > 0) {
            Plugins.message.update(id, `下载 CLIProxyAPI：${((progress / total) * 100).toFixed(2)}%`)
          }
        },
        { Sha256: asset.digest?.startsWith('sha256:') ? asset.digest.slice(7) : undefined }
      )

      await Plugins.MakeDir(extractPath)
      if (env.os === 'windows') {
        await Plugins.UnzipZIPFile(archive, extractPath)
      } else {
        await Plugins.UnzipTarGZFile(archive, extractPath)
      }

      const extractedBinary = extractPath + '/cli-proxy-api' + (env.os === 'windows' ? '.exe' : '')
      const backupBinary = CACHE_PATH + '-backup' + (env.os === 'windows' ? '.exe' : '')
      if (!(await Plugins.FileExists(extractedBinary))) {
        throw '压缩包中未找到 CLIProxyAPI 主程序'
      }

      await Plugins.RemoveFile(backupBinary)
      if (await Plugins.FileExists(BIN_FILE)) {
        await Plugins.MoveFile(BIN_FILE, backupBinary)
      }
      try {
        await Plugins.MoveFile(extractedBinary, BIN_FILE)
        if (env.os !== 'windows') {
          await Plugins.Exec('chmod', ['+x', BIN_FILE])
        }
      } catch (error) {
        if (await Plugins.FileExists(backupBinary)) {
          await Plugins.ignoredError(Plugins.RemoveFile, BIN_FILE)
          await Plugins.MoveFile(backupBinary, BIN_FILE)
        }
        throw error
      }
      await Plugins.RemoveFile(backupBinary)
      await Plugins.WriteFile(PATH + '/version.txt', body.tag_name)
      Plugins.message.update(id, `CLIProxyAPI ${body.tag_name} ${isUpdate ? '更新' : '安装'}完成`, 'success')
    } finally {
      await Plugins.ignoredError(Plugins.RemoveFile, archive)
      await Plugins.ignoredError(Plugins.RemoveFile, extractPath)
      await Plugins.sleep(1000)
      Plugins.message.destroy(id)
    }
  }

  const ensureConfig = async () => {
    if (await Plugins.FileExists(CONFIG_FILE)) return

    const apiKey = randomKey('sk-')
    const managementKey = randomKey('mgmt-')
    const authDir = await Plugins.AbsolutePath(PATH + '/auth')
    const { host, port } = parseListenAddress(Plugin.ListenAddress)
    await Plugins.MakeDir(PATH + '/auth')
    await Plugins.WriteFile(
      CONFIG_FILE,
      Plugins.YAML.stringify({
        host,
        port,
        tls: { enable: false, cert: '', key: '' },
        'remote-management': {
          'allow-remote': false,
          'secret-key': managementKey,
          'disable-control-panel': false
        },
        'auth-dir': authDir,
        'api-keys': [apiKey],
        debug: false,
        'logging-to-file': true,
        'usage-statistics-enabled': true,
        'request-retry': 3,
        routing: { strategy: 'round-robin' }
      })
    )
    return { apiKey, managementKey }
  }

  const randomKey = (prefix) => {
    const bytes = new Uint8Array(24)
    crypto.getRandomValues(bytes)
    return prefix + Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  }

  const parseListenAddress = (value) => {
    const address = String(value ?? '127.0.0.1:8317').trim()
    if (!address || address.includes('://') || /\s/.test(address)) {
      throw '监听地址格式错误，请填写“主机:端口”，例如 127.0.0.1:8317'
    }

    const match = address.startsWith('[') ? address.match(/^\[([^\]]+)]:(\d+)$/) : address.match(/^([^:]*):(\d+)$/)
    if (!match) {
      throw '监听地址格式错误，请填写“主机:端口”；IPv6 地址需要使用方括号'
    }

    const port = Number(match[2])
    if (port < 1 || port > 65535) {
      throw '监听端口必须在 1 到 65535 之间'
    }
    return { host: match[1], port }
  }

  const readConfig = async () => {
    await ensureConfig()
    try {
      return Plugins.YAML.parse(await Plugins.ReadFile(CONFIG_FILE)) || {}
    } catch (error) {
      throw `config.yaml 格式错误：${error.message || error}`
    }
  }

  const getServerInfo = async () => getServerInfoFromConfig(await readConfig())

  const getServerInfoFromConfig = (config) => {
    const configuredHost = config.host || '127.0.0.1'
    const host = ['', '0.0.0.0', '::', '[::]'].includes(configuredHost) ? '127.0.0.1' : configuredHost
    const port = Number(config.port) || 8317
    const scheme = config.tls?.enable ? 'https' : 'http'
    const urlHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
    return { address: `${urlHost}:${port}`, url: `${scheme}://${urlHost}:${port}` }
  }

  return {
    onInstall,
    onUninstall,
    onStartup,
    onShutdown,
    onConfigure,
    onRun,
    Start,
    Stop,
    Update,
    OpenPanel,
    Config,
    OpenDir,
    CopyAPIInfo
  }
}
