// 参考项目：https://github.com/SpaceTimee/Sheas-Cealer

const RULES_URL_PREFIX = 'https://github.com/SpaceTimee/Cealing-Host/raw/main'
const NGINX_BIN_URL_PREFIX = 'https://github.com/jirutka/nginx-binaries/raw/refs/heads/binaries'
const BASE_RULES_URL = `${RULES_URL_PREFIX}/Cealing-Host.json`

const THIRD_DIR = 'data/third/sni-spoofing'
const BASE_RULES_FILE_PATH = `${THIRD_DIR}/Base-Hosts-Rules.json`

const NGINX_TEMP_DIR = `${THIRD_DIR}/temp`
const NGINX_LOGS_DIR = `${THIRD_DIR}/logs`
const NGINX_ERROR_LOG_PATH = `${NGINX_LOGS_DIR}/error.log`
const NGINX_ACCESS_LOG_PATH = `${NGINX_LOGS_DIR}/access.log`

const NGINX_PID_FILE_PATH = `${NGINX_LOGS_DIR}/nginx.pid`
const NGINX_CONF_FILE_PATH = `${THIRD_DIR}/nginx.conf`

const ROOT_CA_KEY_PATH = `${THIRD_DIR}/${Plugins.APP_TITLE}-Root-Ca.key`
const ROOT_CA_CRT_PATH = `${THIRD_DIR}/${Plugins.APP_TITLE}-Root-Ca.crt`
const ROOT_CA_CRT_SHA1 = `${THIRD_DIR}/${Plugins.APP_TITLE}-Root-Crt-Sha1`
const CHILD_CERT_KEY_PATH = `${THIRD_DIR}/${Plugins.APP_TITLE}-Child.key`
const CHILD_CERT_CRT_PATH = `${THIRD_DIR}/${Plugins.APP_TITLE}-Child.crt`

const TEMP_DIR = 'data/.cache'

const HOSTS_START_MARKER = '# Nginx Hosts Start'
const HOSTS_END_MARKER = '# Nginx Hosts End'

// @ts-ignore
const BROWSER_EXEC_PATH = (Plugin.BrowserPath || '').replace(/\\/g, '/').replace(/"/g, '').trim()
// @ts-ignore
const OPENSSL_EXEC_PATH = (Plugin.OpensslPath || 'C:/Program Files/FireDaemon OpenSSL 3/bin/openssl.exe').replace(/\\/g, '/').replace(/"/g, '').trim()
// @ts-ignore
const GLOBAL_SPOOFING = Plugin.GlobalSpoofing || false
// @ts-ignore
const CUSTOM_RULES = Plugin.CustomRules || []
// @ts-ignore
const EXTRA_START_ARGS = (Plugin.ExtraStartArgs || '').replace(/\\/g, '/').trim()

// @ts-ignore
window[Plugin.id] = window[Plugin.id] || {}

/**
 * 插件钩子：APP就绪后
 */

// @ts-ignore
const onReady = async () => {
  return 2
}

/**
 * 插件钩子：运行按钮 - onRun
 */

// @ts-ignore
const onRun = async () => {
  const kernelApiStore = Plugins.useKernelApiStore()
  if (kernelApiStore.running) {
    throw '为了插件能正常工作，请先停止内核'
  }

  if (!BROWSER_EXEC_PATH) {
    throw '请配置浏览器路径'
  }

  await Plugins.alert(
    '⚠️ 重要通知',
    '由于 **Chromium** 在 **141.0.7356.0** 中的一个变更导致浏览器伪造失效，如果你遇到伪造失败的问题，请尝试安装 **旧版本** 的浏览器。',
    {
      markdown: true
    }
  )

  try {
    if (!(await isRunningNginx()) && GLOBAL_SPOOFING) {
      await startNginx()
    }

    // @ts-ignore
    if (!window[Plugin.id].isPrompted) {
      Plugins.message.info('为了启动参数能成功注入，请关闭所有浏览器窗口后，再运行插件，并通过插件运行来启动浏览器')

      // @ts-ignore
      window[Plugin.id].isPrompted = true
    }

    const startArgs = await generateStartArgs()
    const browserPid = await Plugins.ExecBackground(
      BROWSER_EXEC_PATH,
      startArgs,
      // @ts-ignore
      async (out) => {},
      async () => {
        if (browserPid && browserPid !== 0) {
          await Plugins.ignoredError(Plugins.KillProcess, browserPid)
        }
      }
    )

    return GLOBAL_SPOOFING ? 1 : 0
  } catch (e) {
    Plugins.message.error(`运行失败: ${e.message || e}`)
    return 2
  }
}

/**
 * 插件钩子：安装 - onInstall
 */

// @ts-ignore
const onInstall = async () => {
  const envStore = Plugins.useEnvStore()
  const { os, arch } = envStore.env
  if ((os !== 'windows' && os !== 'linux') || arch !== 'amd64') {
    throw '本插件目前仅适配 Windows 和 Linux 系统，以及 AMD64(x86_64) 架构'
  }
  try {
    if (!(await Plugins.FileExists(THIRD_DIR)) || (await Plugins.Readdir(THIRD_DIR)).length < 6) {
      await Plugins.ignoredError(Plugins.Removefile, THIRD_DIR)
      await Plugins.Makedir(THIRD_DIR)
      await Plugins.Download(BASE_RULES_URL, BASE_RULES_FILE_PATH)
      await installNginxCore()
    }
    return 0
  } catch (e) {
    await Plugins.ignoredError(Plugins.Removefile, THIRD_DIR)
    throw e
  }
}

/**
 * 插件钩子：卸载 - onUninstall
 */

// @ts-ignore
const onUninstall = async () => {
  if (await isRunningNginx()) {
    await stopNginx()
  }
  await manageRootCertInSystemTrust(CERT_ACTION.UNINSTALL) // 移除根证书
  if (await Plugins.FileExists(THIRD_DIR)) {
    await Plugins.Removefile(THIRD_DIR)
  }

  Plugins.message.success('卸载成功')
  return 0
}

/**
 * 插件钩子：关闭 - onShutdown
 */

// @ts-ignore
const onShutdown = async () => {
  if (await isRunningNginx()) {
    await stopNginx()
  }
  return 2
}

/*
 * 插件菜单：更新规则 - updateRule
 */

// @ts-ignore
const updateRule = async () => {
  await Plugins.Download(BASE_RULES_URL, BASE_RULES_FILE_PATH)
  Plugins.message.success('规则更新成功')
  if (await isRunningNginx()) {
    if (
      await Plugins.confirm('帮助', '重启服务后应用新规则，是否立即重启？', {
        okText: '是',
        cancelText: '否'
      })
    ) {
      await stopNginx()
      await startNginx()
    }
  }
}

/**
 * 插件菜单：启动服务 - onStart
 */

// @ts-ignore
const onStart = async () => {
  if (GLOBAL_SPOOFING) {
    if (!(await isRunningNginx())) {
      const kernelApiStore = Plugins.useKernelApiStore()
      if (kernelApiStore.running) {
        Plugins.message.info('为了插件能正常工作，建议停止内核')
      }
      try {
        await startNginx()
        Plugins.message.success('nginx 启动成功，使用完后，建议手动停止服务')
        return 1
      } catch (e) {
        Plugins.message.error(`启动失败: ${e.message || e}`)
        return 2
      }
    } else {
      Plugins.message.info('nginx 已经在运行。')
      return 1
    }
  } else {
    Plugins.message.info('未启用全局伪造，无需启动 nginx。')
    return 0
  }
}

/**
 * 插件菜单：停止服务 - onStop
 */

// @ts-ignore
const onStop = async () => {
  if (await isRunningNginx()) {
    try {
      await stopNginx()
      Plugins.message.success('nginx 停止成功')
      return 2
    } catch (e) {
      Plugins.message.error(`停止失败: ${e.message || e}`)
      return 1
    }
  } else {
    Plugins.message.info('nginx 未运行。')
    return 2
  }
}

/**
 * Nginx 核心安装（下载二进制、创建目录、设置权限）
 */
const installNginxCore = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const nginxBinFile = {
    windows: 'nginx-1.27.5-x86_64-win32.exe',
    linux: 'nginx-1.27.5-x86_64-linux'
  }[os]

  const absPath = await Plugins.AbsolutePath(THIRD_DIR)
  const opensslExecPath = os === 'windows' ? OPENSSL_EXEC_PATH : '/usr/bin/openssl'
  if (os === 'windows') {
    if (!(await Plugins.FileExists(opensslExecPath))) {
      Plugins.message.warn(`未找到 OpenSSL 可执行文件，请配置 OpenSSL 安装路径，或者安装推荐的版本`)
      if (
        await Plugins.confirm('帮助', '是否复制安装命令？', {
          okText: '是',
          cancelText: '否'
        })
      ) {
        await Plugins.ClipboardSetText('winget install --id=FireDaemon.OpenSSL -e')
        Plugins.message.info('已复制 winget 安装命令到剪贴板，请粘贴到终端中执行。')
        throw '请先安装 OpenSSL'
      }
    }
  } else {
    if (!(await Plugins.FileExists(opensslExecPath))) {
      throw '未找到 OpenSSL 可执行文件，请先安装 OpenSSL。'
    }
  }

  try {
    await Plugins.Download(`${NGINX_BIN_URL_PREFIX}/${nginxBinFile}`, `${THIRD_DIR}/nginx${os === 'windows' ? '.exe' : ''}`)
    await Plugins.Makedir(NGINX_TEMP_DIR)
    await Plugins.Makedir(NGINX_LOGS_DIR)
    await Plugins.Writefile(NGINX_ACCESS_LOG_PATH, '')
    await Plugins.Writefile(NGINX_ERROR_LOG_PATH, '')
  } catch (e) {
    throw `安装 Nginx 失败 ${e.message || e}`
  }

  if (os === 'windows') {
    await Plugins.alert('提示', '为了服务正常运行，请确保软件设置内的以管理员身份运行选项已启用')
  } else {
    await Plugins.Exec('chmod', ['+x', `${absPath}/nginx`])
    try {
      await Plugins.Exec('pkexec', ['setcap', 'CAP_NET_BIND_SERVICE=+eip', `${absPath}/nginx`])
    } catch (e) {
      Plugins.message.warn(`设置 Nginx 权限失败，请手动授权`)
      if (
        await Plugins.confirm('帮助', '是否复制授权命令？', {
          okText: '是',
          cancelText: '否'
        })
      ) {
        await Plugins.ClipboardSetText(`sudo setcap CAP_NET_BIND_SERVICE=+eip ${absPath}/nginx`)
        Plugins.message.info('已复制授权命令到剪贴板，请粘贴到终端中执行。')
      }
    }
  }

  await generateAndInstallRootCert(opensslExecPath)

  Plugins.message.success('Nginx 核心安装成功')
}

/**
 * 生成根证书
 * @param {String} opensslExecPath
 */
const generateAndInstallRootCert = async (opensslExecPath) => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const rootKeyPath = await Plugins.AbsolutePath(ROOT_CA_KEY_PATH)
  const rootCrtPath = await Plugins.AbsolutePath(ROOT_CA_CRT_PATH)

  Plugins.message.info('生成根证书...')
  try {
    // 生成根证书私钥
    await Plugins.Exec(opensslExecPath, ['genrsa', '-out', rootKeyPath, '2048'])
    // 生成自签名根证书
    await Plugins.Exec(opensslExecPath, [
      'req',
      '-x509',
      '-new',
      '-key',
      rootKeyPath,
      '-out',
      rootCrtPath,
      '-days',
      '36500',
      '-sha256',
      '-subj',
      `/CN=${Plugins.APP_TITLE} Root CA`
    ])

    if (!(await Plugins.FileExists(rootKeyPath)) || !(await Plugins.FileExists(rootCrtPath))) {
      throw `根证书文件未成功生成。`
    }

    if (os === 'windows') {
      const rootCrtSha1 = await getRootCertSha1(opensslExecPath, rootCrtPath)
      await Plugins.Writefile(ROOT_CA_CRT_SHA1, rootCrtSha1)
      Plugins.message.success('写入根证书 SHA1 值成功。')
    }

    Plugins.message.success('根证书生成成功。')

    await manageRootCertInSystemTrust(CERT_ACTION.INSTALL)
  } catch (e) {
    throw `生成根证书失败: ${e.message || e}`
  }
}

/**
 * 获取根证书的 SHA1 值。
 */
const getRootCertSha1 = async (opensslExecPath, rootCrtPath) => {
  const fingerprintString = await Plugins.Exec(opensslExecPath, ['x509', '-in', rootCrtPath, '-noout', '-fingerprint', '-sha1'])
  const lowercaseString = fingerprintString
    .replace(/.*Fingerprint=/g, '')
    .replace(/:/g, '')
    .toLowerCase()
    .trim()
  return lowercaseString
}

/**
 * 根据规则生成包含 SAN 的子证书。
 */
const generateChildCertWithSans = async (jsonData) => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env

  const opensslExecPath = os === 'windows' ? OPENSSL_EXEC_PATH : '/usr/bin/openssl'
  const rootKeyPath = await Plugins.AbsolutePath(ROOT_CA_KEY_PATH)
  const rootCrtPath = await Plugins.AbsolutePath(ROOT_CA_CRT_PATH)
  const childKeyPath = await Plugins.AbsolutePath(CHILD_CERT_KEY_PATH)
  const childCrtPath = await Plugins.AbsolutePath(CHILD_CERT_CRT_PATH)
  const childCsrPath = `${await Plugins.AbsolutePath(THIRD_DIR)}/child.csr`
  const sanConfigPath = `${await Plugins.AbsolutePath(TEMP_DIR)}/san_config` // 临时 SAN 配置文件

  Plugins.message.info('生成子证书...')
  try {
    const sans = new Set() // 使用 Set 存储唯一的 SANs

    jsonData.forEach((entry) => {
      const rawDomains = Array.isArray(entry[0]) ? entry[0] : [entry[0]]

      rawDomains.forEach((domain) => {
        let includeDomain = domain.split('^', 2)[0].trim()

        // 忽略以 '#' 开头的域名
        if (includeDomain.startsWith('#')) {
          return
        }

        // 移除开头的 '$'
        let domainWithoutDollar = includeDomain.startsWith('$') ? includeDomain.substring(1) : includeDomain

        // 获取基础域名：移除开头的 '*', '.'
        let baseDomain = domainWithoutDollar
        if (baseDomain.startsWith('*')) baseDomain = baseDomain.substring(1)
        if (baseDomain.startsWith('.')) baseDomain = baseDomain.substring(1)

        // 忽略空的基础域名或仍然包含 '*' 的基础域名
        if (string.IsNullOrWhiteSpace(baseDomain) || baseDomain.includes('*')) {
          return
        }

        // 如果原始域名 (移除 $ 后) 以 '*' 开头，添加 *.baseDomain
        if (domainWithoutDollar.startsWith('*')) {
          sans.add(`DNS:*.${baseDomain}`)
          // 如果原始域名 (移除 $ 后) 以 '*.' 开头，则不再添加 baseDomain 本身
          if (domainWithoutDollar.startsWith('*.')) {
            return
          }
        }

        // 添加 baseDomain 本身 (对于非 * 开头或 *domain.com 形式)
        sans.add(`DNS:${baseDomain}`)
      })
    })

    const sanList = Array.from(sans).join(',')
    if (!sanList) {
      Plugins.message.warn('规则中没有找到有效的域名用于生成子证书 SAN。')
    }

    // 写入临时 SAN 配置文件
    const sanConfigContent = `[req]\ndistinguished_name=req\n[SAN]\nsubjectAltName=${sanList}\n\n[v3_extensions]\nsubjectAltName=${sanList}`
    await Plugins.Writefile(sanConfigPath, sanConfigContent)

    // 生成子证书私钥
    await Plugins.Exec(opensslExecPath, ['genrsa', '-out', childKeyPath, '2048'])

    // 生成子证书 CSR (Certificate Signing Request)
    await Plugins.Exec(opensslExecPath, [
      'req',
      '-new',
      '-key',
      childKeyPath,
      '-out',
      childCsrPath,
      '-subj',
      `/CN=${Plugins.APP_TITLE} Child CA`, // 子证书 CN
      '-reqexts',
      'SAN',
      '-config',
      sanConfigPath // 引用 SAN 配置
    ])

    // 使用根证书签发子证书
    await Plugins.Exec(opensslExecPath, [
      'x509',
      '-req',
      '-in',
      childCsrPath,
      '-CA',
      rootCrtPath,
      '-CAkey',
      rootKeyPath,
      '-CAcreateserial', // 创建或更新序列号文件 root_ca.srl
      '-out',
      childCrtPath,
      '-days',
      '3650',
      '-sha256',
      '-extensions',
      'v3_extensions',
      '-extfile',
      sanConfigPath // 引用 SAN 配置
    ])

    // 清理临时文件
    await Plugins.Removefile(sanConfigPath)
    await Plugins.Removefile(childCsrPath)

    if (!(await Plugins.FileExists(childKeyPath)) || !(await Plugins.FileExists(childCrtPath))) {
      throw new Error('子证书文件未成功生成。')
    }

    Plugins.message.success('子证书生成成功。')
  } catch (e) {
    // 尝试清理可能生成的文件
    await Plugins.ignoredError(Plugins.Removefile, childKeyPath)
    await Plugins.ignoredError(Plugins.Removefile, childCrtPath)
    await Plugins.ignoredError(Plugins.Removefile, childCsrPath)
    await Plugins.ignoredError(Plugins.Removefile, sanConfigPath)
    throw `生成子证书失败: ${e.message || e}`
  }
}

const CERT_ACTION = {
  INSTALL: 'install',
  UNINSTALL: 'uninstall'
}
/**
 * 管理根证书在系统信任区的安装和移除。
 * @param {string} action - 操作类型
 */
const manageRootCertInSystemTrust = async (action) => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env

  const rootCrtPath = await Plugins.AbsolutePath(ROOT_CA_CRT_PATH)
  const archLinuxCertDir = '/etc/ca-certificates/trust-source/anchors'
  const debianCertDir = '/usr/local/share/ca-certificates'
  const rootCrtFileName = rootCrtPath.split('/').pop()
  if (action === CERT_ACTION.INSTALL) {
    Plugins.message.info('安装根证书到系统信任区...')
    try {
      let isInstalled = false
      if (os === 'windows') {
        await Plugins.Exec('certutil', ['-addstore', '-f', 'ROOT', rootCrtPath])
        isInstalled = true
      } else {
        const linuxOsInfo = await Plugins.Exec('/usr/bin/cat', ['/etc/os-release'])
        if (linuxOsInfo.includes('Arch Linux')) {
          await Plugins.Exec('pkexec', ['cp', rootCrtPath, archLinuxCertDir])
          await Plugins.Exec('pkexec', ['update-ca-trust'])
          isInstalled = true
        } else if (linuxOsInfo.includes('Ubuntu') || linuxOsInfo.includes('Debian')) {
          await Plugins.Exec('pkexec', ['cp', rootCrtPath, debianCertDir])
          await Plugins.Exec('pkexec', ['update-ca-certificates'])
          isInstalled = true
        } else {
          Plugins.message.warn(`未知 Linux 系统，请手动将 ${rootCrtPath} 添加到系统信任区`)
        }
      }
      if (isInstalled) Plugins.message.success('根证书安装成功。')
    } catch (e) {
      throw `安装根证书失败: ${e.message || e}`
    }
  } else if (action === CERT_ACTION.UNINSTALL) {
    Plugins.message.info('从系统信任区移除根证书...')
    try {
      let isDeleted = false
      if (os === 'windows') {
        const rootCrtSha1 = (await Plugins.Readfile(ROOT_CA_CRT_SHA1)).trim()
        await Plugins.Exec('certutil', ['-delstore', 'ROOT', rootCrtSha1])
        isDeleted = true
      } else {
        const linuxOsInfo = await Plugins.Exec('cat', ['/etc/os-release'])
        if (linuxOsInfo.includes('Arch Linux')) {
          await Plugins.ignoredError(Plugins.Exec, 'pkexec', ['rm', `${archLinuxCertDir}/${rootCrtFileName}`])
          await Plugins.Exec('pkexec', ['update-ca-trust'])
          isDeleted = true
        } else if (linuxOsInfo.includes('Ubuntu') || linuxOsInfo.includes('Debian')) {
          await Plugins.ignoredError(Plugins.Exec, 'pkexec', ['rm', `${debianCertDir}/${rootCrtFileName}`])
          await Plugins.Exec('pkexec', ['update-ca-certificates'])
          isDeleted = true
        } else {
          Plugins.message.warn(`未知 Linux 系统，请手动移除根证书`)
        }
      }
      if (isDeleted) Plugins.message.success('根证书移除成功。')
    } catch (e) {
      throw `移除根证书失败: ${e.message || e}`
    }
  }
}

/**
 * 启动 Nginx 服务。
 * 在启动前生成并写入配置和证书。
 */
const startNginx = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const absPath = await Plugins.AbsolutePath(THIRD_DIR)
  const nginxConfAbsPath = await Plugins.AbsolutePath(NGINX_CONF_FILE_PATH)

  await Plugins.Writefile(NGINX_ACCESS_LOG_PATH, '')
  await Plugins.Writefile(NGINX_ERROR_LOG_PATH, '')

  await generateAndWriteNginxConfigs() // 在启动前生成并写入配置和证书

  return new Promise(async (resolve, reject) => {
    const nginxPid = await Plugins.ExecBackground(
      `${absPath}/nginx${os === 'windows' ? '.exe' : ''}`,
      ['-c', nginxConfAbsPath, '-p', absPath],
      async (out) => {
        if (out.includes('[emerg]')) {
          if (out.includes('Permission denied')) {
            Plugins.message.error(os === 'windows' ? '请启用以管理员身份运行' : '请重新安装插件并正确授权')
          } else if (out.includes('Address in use)')) {
            Plugins.message.error('HTTP 端口已被占用，请手动结束冲突进程')
          } else {
            Plugins.message.error('Nginx 启动失败')
          }
          if (nginxPid && nginxPid !== 0) {
            await Plugins.ignoredError(Plugins.KillProcess, Number(nginxPid))
          }
          reject(new Error(out))
        }
      },
      async () => {
        if (nginxPid && nginxPid !== 0) {
          await Plugins.ignoredError(Plugins.KillProcess, Number(nginxPid))
        }
      }
    )
    await Plugins.sleep(3000)
    if (await isRunningNginx()) {
      await generateAndWriteHostsConfigs()
      resolve()
    } else reject(new Error('启动 Nginx 失败：未知原因'))
  })
}

/**
 * 停止 Nginx 服务。
 */
const stopNginx = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const absPath = await Plugins.AbsolutePath(THIRD_DIR)
  const execPath = `${absPath}/nginx${os === 'windows' ? '.exe' : ''}`
  if (!(await isRunningNginx())) {
    Plugins.message.info('Nginx 未运行，无需停止。')
    return
  }
  await updateSystemHostsFile(HOSTS_ACTION.REMOVE, '') // 恢复 Hosts 文件
  Plugins.message.info('发送 Nginx 停止信号...')
  const nginxConfAbsPath = await Plugins.AbsolutePath(NGINX_CONF_FILE_PATH)
  try {
    await Plugins.Exec(execPath, ['-s', 'quit', '-c', nginxConfAbsPath, '-p', absPath])
    Plugins.message.success('Nginx 停止信号已发送。')
  } catch (e) {
    throw `停止 Nginx 失败: ${e.message || e}`
  }
}

/**
 * 检查 Nginx 是否正在运行。
 * @returns {Promise<boolean>} 如果 Nginx 正在运行则返回 true，否则返回 false。
 */
const isRunningNginx = async () => {
  if (await Plugins.FileExists(NGINX_PID_FILE_PATH)) {
    const pid = Number(await Plugins.Readfile(NGINX_PID_FILE_PATH))
    if (pid && pid > 0) {
      const name = await Plugins.ignoredError(Plugins.ProcessInfo, pid)
      if (name && name.includes('nginx')) {
        return true
      }
    }
  }
  return false
}

/**
 * 获取合并后的规则
 */
const getMergedRules = async () => {
  const baseRules = await Plugins.Readfile(BASE_RULES_FILE_PATH)
  try {
    const completeRules = [...JSON.parse(baseRules), ...JSON.parse(CUSTOM_RULES)]
    return completeRules
  } catch (e) {
    throw `自定义规则内容不是有效的 JSON 数组: ${e.message || e}`
  }
}

/*
 * 生成启动参数
 */
const generateStartArgs = async () => {
  const hostRules = []
  const hostResolverRules = []
  let uCounter = 0 // 用于生成唯一的 U 标识符，每次 targetHost 为空或 null 时递增

  const data = await getMergedRules()

  data.forEach((entry) => {
    const rawDomains = Array.isArray(entry[0]) ? entry[0] : [entry[0]]
    const targetHost = entry[1]
    const ipAddress = entry[2]

    let currentTargetIdentifier
    // 根据 targetHost 确定当前规则的目标标识符
    if (targetHost === '' || targetHost === null) {
      // 如果 targetHost 为空或 null，则生成一个新的 U 标识符
      currentTargetIdentifier = `U${uCounter++}`
    } else {
      // 否则，使用 targetHost 作为标识符
      currentTargetIdentifier = targetHost
    }

    // 确定实际的 IP 地址，如果为空则默认为 127.0.0.1
    const actualIp = ipAddress === '' ? '127.0.0.1' : ipAddress

    // 将目标标识符和实际 IP 地址添加到 hostResolverRules 数组
    // 检查是否已经存在相同的 MAP targetIdentifier actualIp 规则，避免重复
    const resolverRule = `MAP ${currentTargetIdentifier} ${actualIp}`
    if (!hostResolverRules.includes(resolverRule)) {
      hostResolverRules.push(resolverRule)
    }

    // 遍历原始域名列表，生成 host-rules
    rawDomains.forEach((domain) => {
      // 严格忽略以 '$' 开头的域名，这些域名不应出现在 host-rules 中
      if (domain.startsWith('$')) {
        return // 跳过当前域名，不添加到 hostRules
      }

      let cleanedDomain = domain

      // 针对特定模式进行精确的字符串转换
      if (cleanedDomain.startsWith('#')) {
        cleanedDomain = domain.substring(1)
      }
      // 对于其他情况，保留原始域名（包括可能存在的其他通配符如 *）

      // 检查是否已经存在相同的 MAP cleanedDomain currentTargetIdentifier 规则，避免重复
      const hostRule = `MAP ${cleanedDomain} ${currentTargetIdentifier}`
      if (!hostRules.includes(hostRule)) {
        hostRules.push(hostRule)
      }
    })
  })

  // 将 hostRules 数组连接成字符串
  const hostRulesString = hostRules.join(',')

  // 将 hostResolverRules 数组连接成字符串
  const hostResolverRulesString = hostResolverRules.join(',')

  const startArgs = [
    `--host-rules="${hostRulesString}"`,
    `--host-resolver-rules="${hostResolverRulesString}"`,
    '--test-type',
    '--ignore-certificate-errors',
    EXTRA_START_ARGS
  ]

  return startArgs
}

const HOSTS_ACTION = {
  ADD: 'add',
  REMOVE: 'remove'
}

/**
 * 获取系统 Hosts 文件的路径。
 * @returns {Promise<string>} Hosts 文件的绝对路径。
 */
const getHostsFilePath = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  return os === 'windows' ? 'C:/Windows/System32/drivers/etc/hosts' : '/etc/hosts'
}

/**
 * @description 辅助函数：生成并写入 Nginx 配置
 */
const generateAndWriteNginxConfigs = async () => {
  const jsonData = await getMergedRules()
  // 根据规则生成包含 SAN 的子证书
  await generateChildCertWithSans(jsonData)
  // 生成并写入 Nginx 配置 (使用新生成的子证书)
  const nginxConfContent = await generateNginxConfContent(jsonData)
  await Plugins.Writefile(NGINX_CONF_FILE_PATH, nginxConfContent)
  Plugins.message.info(`Nginx 配置文件已更新`)
}

const generateAndWriteHostsConfigs = async () => {
  const jsonData = await getMergedRules()
  const dynamicHostsContent = await generateDynamicHostsContent(jsonData)
  await updateSystemHostsFile(HOSTS_ACTION.ADD, dynamicHostsContent)
}

/**
 * @description 新增函数：根据 Base-Hosts-Rules.json 规则生成 Hosts 文件中动态部分的内容。
 * @param {Array<Array<any>>} jsonData - Base-Hosts-Rules.json 的解析内容。
 * @returns {Promise<string>} 动态 Hosts 文件内容字符串 (例如 "127.0.0.1 example.com\n127.0.0.1 www.example.com")。
 */
const generateDynamicHostsContent = async (jsonData) => {
  const hostsContentLines = new Set() // 使用 Set 存储唯一的 Hosts 条目

  jsonData.forEach((entry) => {
    const rawDomains = Array.isArray(entry[0]) ? entry[0] : [entry[0]]

    rawDomains.forEach((domain) => {
      let includeDomain = domain.split('^', 2)[0].trim() // Hosts 文件只关心包含部分

      // 忽略以 '#' 开头的域名
      if (includeDomain.startsWith('#')) {
        return // 跳过当前域名字符串
      }

      // 复制一份用于检查原始域名是否以 '*' 开头（C# 逻辑）
      let originalDomainWithoutDollar = includeDomain
      if (originalDomainWithoutDollar.startsWith('$')) {
        originalDomainWithoutDollar = originalDomainWithoutDollar.substring(1)
      }

      // 获取基础域名：移除开头的 '$', '*', '.'
      let baseDomain = includeDomain
      if (baseDomain.startsWith('$')) baseDomain = baseDomain.substring(1)
      if (baseDomain.startsWith('*')) baseDomain = baseDomain.substring(1)
      if (baseDomain.startsWith('.')) baseDomain = baseDomain.substring(1)

      // 忽略空的基础域名或仍然包含 '*' 的基础域名 (与 C# 逻辑对齐)
      if (string.IsNullOrWhiteSpace(baseDomain) || baseDomain.includes('*')) {
        return
      }

      // 根据 C# 逻辑处理通配符 '*'
      if (originalDomainWithoutDollar.startsWith('*')) {
        // 处理 *.domain.com 或 *domain.com 形式
        hostsContentLines.add(`127.0.0.1 www.${baseDomain}`)
        // 如果是 *.domain.com 形式，则不再添加 baseDomain 本身
        if (originalDomainWithoutDollar.startsWith('*.')) {
          return // 相当于 C# 的 continue，跳过后续的 baseDomain 添加
        }
      }
      // 处理 domain.com 形式，以及 *domain.com (非 *.domain.com) 形式的 baseDomain
      hostsContentLines.add(`127.0.0.1 ${baseDomain}`)
    })
  })

  return Array.from(hostsContentLines).join('\n')
}

/**
 * @description 新增函数：更新系统 Hosts 文件，添加或移除特定标记的动态内容块。
 * @param {string} action - 操作类型，'add' 或 'remove'。
 * @param {string} dynamicHostsContent - 当 action 为 'add' 时要插入/替换的内容。
 */
const updateSystemHostsFile = async (action, dynamicHostsContent) => {
  const hostsFilePath = await getHostsFilePath()
  let baseContent = ''
  try {
    baseContent = await Plugins.Readfile(hostsFilePath)
  } catch (e) {
    throw `读取 Hosts 文件失败: ${e.message || e}`
  }

  let newContent = baseContent
  const startIndex = newContent.indexOf(HOSTS_START_MARKER)
  const endIndex = newContent.indexOf(HOSTS_END_MARKER)

  if (action === HOSTS_ACTION.ADD) {
    const contentToInsert = `${HOSTS_START_MARKER}\n${dynamicHostsContent}\n${HOSTS_END_MARKER}`
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      // 如果已存在标记块，则替换其内容
      newContent = newContent.substring(0, startIndex) + contentToInsert + newContent.substring(endIndex + HOSTS_END_MARKER.length)
    } else {
      // 如果不存在标记块，则追加新块
      // 确保在追加前有足够的换行符，避免与原有内容粘连
      newContent = `${newContent.trim()}\n\n${contentToInsert}`
    }
  } else if (action === HOSTS_ACTION.REMOVE) {
    if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
      // 如果存在标记块，则移除它
      newContent = newContent.substring(0, startIndex) + newContent.substring(endIndex + HOSTS_END_MARKER.length)
      newContent = newContent.trim() // 清理多余的空行
    } else {
      return // 块不存在，无需操作
    }
  }

  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env

  const tempFileAbsPath = await Plugins.AbsolutePath(`${TEMP_DIR}/hosts_temp}`)
  try {
    if (os === 'windows') {
      // 在 Windows 上直接写入，需要管理员权限运行整个应用
      await Plugins.Writefile(hostsFilePath, newContent)
    } else {
      await Plugins.Writefile(tempFileAbsPath, newContent)
      // 使用 pkexec cp 需要用户授权
      await Plugins.Exec('pkexec', ['cp', tempFileAbsPath, hostsFilePath])
      await Plugins.Removefile(tempFileAbsPath)
    }
    Plugins.message.info(`Hosts 文件已更新。`)
  } catch (e) {
    await Plugins.ignoredError(Plugins.Removefile, tempFileAbsPath)
    throw `写入 Hosts 文件失败: ${e.message || e}. 请确保应用以管理员权限运行。`
  }
}

/**
 * @description 新增函数：根据 Base-Hosts-Rules.json 规则生成完整的 Nginx 配置内容。
 * @param {Array<Array<any>>} jsonData - Base-Hosts-Rules.json 的解析内容。
 * @returns {Promise<string>} 完整的 Nginx 配置字符串。
 */
const generateNginxConfContent = async (jsonData) => {
  const childCertAbsPath = (await Plugins.AbsolutePath(CHILD_CERT_CRT_PATH)).replace(/\\/g, '/')
  const childKeyAbsPath = (await Plugins.AbsolutePath(CHILD_CERT_KEY_PATH)).replace(/\\/g, '/')
  const nginxPidFileAbsPath = (await Plugins.AbsolutePath(NGINX_PID_FILE_PATH)).replace(/\\/g, '/')
  const nginxAccessLogAbsPath = (await Plugins.AbsolutePath(NGINX_ACCESS_LOG_PATH)).replace(/\\/g, '/')
  const nginxErrorLogAbsPath = (await Plugins.AbsolutePath(NGINX_ERROR_LOG_PATH)).replace(/\\/g, '/')

  let nginxConfig = `pid ${nginxPidFileAbsPath};

		worker_processes auto;

		events {
			worker_connections 65536;
		}

		http {
			client_body_temp_path temp/client_body;
			proxy_temp_path temp/proxy;

			access_log ${nginxAccessLogAbsPath};
			error_log ${nginxErrorLogAbsPath};

			proxy_ssl_server_name on;
			proxy_set_header Host $http_host;
			proxy_buffer_size 14K;

			server {
				listen 80 default_server;
				return https://$host$request_uri;
			}

			server {
				server_name *.googlevideo.com;
				listen 443 ssl;
				ssl_certificate ${childCertAbsPath};
				ssl_certificate_key ${childKeyAbsPath};
				proxy_ssl_name E0;
				resolver 223.5.5.5 ipv4=off;

				location / {
					if ($http_host ~* ^(.+).googlevideo.com$) {
						proxy_pass https://$1.gvt1.com;
					}
				}
			}
			`

  let uniqueIdCounter = 0 // 用于生成唯一的 SNI（当 target_SNI 为空或 null 时）

  jsonData.forEach((entry) => {
    const rawDomains = Array.isArray(entry[0]) ? entry[0] : [entry[0]]
    const targetHost = entry[1] // 可以是字符串、null 或 ""
    const ipAddress = entry[2]
    if (ipAddress === '') return
    let serverNamesRegexParts = []
    rawDomains.forEach((domain) => {
      let [includeDomain, excludeDomain] = domain.split('^', 2)
      includeDomain = includeDomain.trim()
      excludeDomain = excludeDomain ? excludeDomain.trim() : ''

      // 忽略以 '#' 开头的域名字符串
      if (includeDomain.startsWith('#')) {
        return // 跳过当前域名字符串
      }

      // 转换包含域名为正则表达式
      let includeRegex = includeDomain.replace(/\./g, '\\.').replace(/\*/g, '.*')
      if (includeRegex.startsWith('$')) {
        includeRegex = includeRegex.substring(1) // 移除 '$' 用于正则表达式
      }

      // 转换排除域名为正则表达式的负向先行断言
      let excludeRegexPart = ''
      if (excludeDomain) {
        excludeRegexPart = `(?!${excludeDomain.replace(/\./g, '\\.').replace(/\*/g, '.*')})`
      }
      serverNamesRegexParts.push(`${excludeRegexPart}${includeRegex}`)
    })

    // 如果没有有效的域名，则跳过此规则的 server 块生成
    if (serverNamesRegexParts.length === 0) {
      return
    }

    // 组合 server_name 正则表达式
    const serverName = '~' + serverNamesRegexParts.map((part) => `^${part}$`).join('|')
    const actualIp = ipAddress === '' ? '127.0.0.1' : ipAddress

    let proxySslServerNameLine = ''
    let proxySslNameLine = ''

    // 根据 targetHost 的值设置 proxy_ssl_server_name 和 proxy_ssl_name
    if (targetHost === null) {
      // 如果 targetHost 为 null，则 proxy_ssl_server_name 设置为 off
      proxySslServerNameLine = `        proxy_ssl_server_name off;\n`
    } else {
      // 如果 targetHost 不为 null，则设置 proxy_ssl_name
      const actualSni = targetHost === '' ? `U${uniqueIdCounter++}` : targetHost
      proxySslNameLine = `        proxy_ssl_name ${actualSni};\n`
    }

    nginxConfig += `
					server {
						server_name ${serverName};
						listen 443 ssl;
						ssl_certificate ${childCertAbsPath};
						ssl_certificate_key ${childKeyAbsPath};
${proxySslServerNameLine}${proxySslNameLine}
						location / {
							proxy_pass https://${actualIp};
						}
					}
					`
  })

  nginxConfig += `}` // 关闭 http 块

  return nginxConfig
}

// 辅助函数：检查字符串是否为空或只包含空白字符
const string = {
  IsNullOrWhiteSpace: (str) => str === null || str === undefined || str.trim() === ''
}
