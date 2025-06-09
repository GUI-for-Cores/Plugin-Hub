// 参考项目：https://github.com/SpaceTimee/Sheas-Cealer

const RULE_URL_PREFIX = 'https://github.com/SpaceTimee/Cealing-Host/raw/main'
const NGINX_BIN_URL_PREFIX = 'https://github.com/jirutka/nginx-binaries/raw/refs/heads/binaries'
const BASE_RULE_URL = `${RULE_URL_PREFIX}/Cealing-Host.json`

const THIRD_DIR = 'data/third/sni-spoofing'
const BASE_RULE_FILE_PATH = `${THIRD_DIR}/Cealing-Host.json`
const NGINX_TEMP_DIR = `${THIRD_DIR}/temp`
const NGINX_LOGS_DIR = `${THIRD_DIR}/logs`

const NGINX_PID_FILE_PATH = `${NGINX_LOGS_DIR}/nginx.pid`
const NGINX_CONF_FILE_PATH = `${THIRD_DIR}/nginx.conf`

const ROOT_CA_KEY_PATH = `${THIRD_DIR}/root_ca.key`
const ROOT_CA_CRT_PATH = `${THIRD_DIR}/root_ca.crt`
const ROOT_CA_CRT_SHA1 = `${THIRD_DIR}/root_crt_sha1`
const CHILD_CERT_KEY_PATH = `${THIRD_DIR}/child.key`
const CHILD_CERT_CRT_PATH = `${THIRD_DIR}/child.crt`

const TMEP_DIR = 'data/.cache'

const HOSTS_START_MARKER = '# Nginx Start'
const HOSTS_END_MARKER = '# Nginx End'

window[Plugin.id] = window[Plugin.id] || {}

/**
 * 插件钩子：APP就绪后
 */
const onReady = async () => {
  return 2
}

/**
 * 插件钩子：运行按钮 - onRun
 */
const onRun = async () => {
  const appSettings = Plugins.useAppSettingsStore()
  if (appSettings.app.kernel.running) {
    throw '为了插件能正常工作，请停止内核'
  }

  const execPath = Plugin.browserPath.replace(/\\/g, '/').replace(/"/g, '').trim()
  if (!execPath) {
    throw '请配置浏览器路径'
  }

  try {
    if (!(await isRunningNginx()) && Plugin.isGlobalSpoofing) {
      await startNginx()
    }

    if (!window[Plugin.id].isPrompted) {
      Plugins.message.info('为了启动参数能成功注入，请关闭所有浏览器窗口后，再运行插件，并通过插件运行来启动浏览器')

      window[Plugin.id].isPrompted = true
    }

    const startArgs = await generateStartArgs()
    const browerPid = await Plugins.ExecBackground(
      execPath,
      startArgs,
      async (out) => {},
      async () => {
        if (browerPid && browerPid !== 0) {
          await Plugins.ignoredError(Plugins.KillProcess, browerPid)
        }
      }
    )

    return Plugin.isGlobalSpoofing ? 1 : 0
  } catch (e) {
    Plugins.message.error(`运行失败: ${e.message || e}`)
    return 2
  }
}

/**
 * 插件钩子：安装 - onInstall
 */
const onInstall = async () => {
  const envStore = Plugins.useEnvStore()
  const { os, arch } = envStore.env
  if ((os !== 'windows' && os !== 'linux') || arch !== 'amd64') {
    throw '此插件目前仅适配 Windows 和 Linux 系统，以及 AMD64(x86_64) 架构'
  }
  if (!(await Plugins.FileExists(THIRD_DIR)) || !(await Plugins.FileExists(`${THIRD_DIR}/nginx${os === 'windows' ? '.exe' : ''}`))) {
    await Plugins.Makedir(THIRD_DIR)
    // 规则文件下载和 Nginx 核心安装
    await Plugins.Download(BASE_RULE_URL, BASE_RULE_FILE_PATH)
    await installNginxCore()
  }
  return 0
}

/**
 * 插件钩子：卸载 - onUninstall
 */
const onUninstall = async () => {
  if (await isRunningNginx()) {
    await stopNginx()
  }

  if (await Plugins.FileExists(THIRD_DIR)) {
    await Plugins.Removefile(THIRD_DIR)
  }

  Plugins.message.success('卸载成功')
  return 0
}

/**
 * 插件钩子：关闭 - onShutdown
 */
const onShutdown = async () => {
  if (await isRunningNginx()) {
    await stopNginx()
    return 2
  }
}

/*
 * 插件菜单：更新规则 - updateRule
 */
const updateRule = async () => {
  await Plugins.Download(BASE_RULE_URL, BASE_RULE_FILE_PATH)
  Plugins.message.success('更新规则成功')

  if (await isRunningNginx()) {
    try {
      await stopNginx()
      await startNginx()
      Plugins.message.info('证书和配置已根据新规则更新。')
    } catch (e) {
      Plugins.message.error(`更新配置失败: ${e.message || e}`)
    }
  }
}

/**
 * 插件菜单：启动服务 - onStart
 */
const onStart = async () => {
  if (!(await isRunningNginx()) && Plugin.isGlobalSpoofing) {
    try {
      await startNginx()
      Plugins.message.success('nginx 启动成功，使用完后，建议手动停止服务')
      return 1
    } catch (e) {
      Plugins.message.error(`启动失败: ${e.message || e}`)
      return 2
    }
  } else if (await isRunningNginx()) {
    Plugins.message.info('nginx 已经在运行。')
    return 1
  } else {
    Plugins.message.info('未启用全局伪造，无需启动 nginx。')
    return 0
  }
}

/**
 * 插件菜单：停止服务 - onStop
 */
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
  await Plugins.Download(`${NGINX_BIN_URL_PREFIX}/${nginxBinFile}`, `${THIRD_DIR}/nginx${os === 'windows' ? '.exe' : ''}`)

  await Plugins.Makedir(NGINX_TEMP_DIR)
  await Plugins.Makedir(NGINX_LOGS_DIR)
  await Plugins.Writefile(`${NGINX_LOGS_DIR}/access.log`, '')
  await Plugins.Writefile(`${NGINX_LOGS_DIR}/error.log`, '')

  const absPath = await Plugins.AbsolutePath(THIRD_DIR)

  let execBinFilePath = ''
  let isInstalledOpenssl = false
  if (os === 'windows') {
    execBinFilePath = Plugin.binFilePath || 'C:/Program Files/FireDaemon OpenSSL 3/bin/openssl.exe'
    if (!(await Plugins.FileExists(execBinFilePath))) {
      Plugins.message.warn(`未找到 OpenSSL 可执行文件，请配置 OpenSSL 安装路径，或者安装推荐的版本`)
      if (
        await Plugins.confirm('帮助', '是否复制安装命令？', {
          okText: '是',
          cancelText: '否'
        })
      ) {
        await Plugins.ClipboardSetText('winget install --id=FireDaemon.OpenSSL -e')
        Plugins.message.info('已复制 winget 安装命令到剪贴板，请粘贴到终端中执行。')
      }
    } else isInstalledOpenssl = true
  } else {
    execBinFilePath = '/usr/bin/openssl'
    try {
      await Plugins.Exec(execBinFilePath, ['-v'])
      isInstalledOpenssl = true
    } catch (e) {
      Plugins.message.warn(`未找到 OpenSSL 可执行文件，请安装 OpenSSL。`)
    }
  }

  if (os === 'windows') {
    await Plugins.message.info('为了服务正常运行，请确保软件设置内的以管理员身份运行选项已启用')
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

  if (isInstalledOpenssl) await generateRootCert()
  else Plugins.message.info(`根证书将在后续步骤生成，请再此之前安装或配置好 OpenSSL`)
  // 根据 OpenSSL 安装情况判断是否在安装阶段生成根证书
  Plugins.message.success('Nginx 核心安装成功')
}

/**
 * 确保根证书存在，如果不存在则生成。
 */
const generateRootCert = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const rootKeyPath = await Plugins.AbsolutePath(ROOT_CA_KEY_PATH)
  const rootCrtPath = await Plugins.AbsolutePath(ROOT_CA_CRT_PATH)

  const opensslPath = os === 'windows' ? Plugin.binFilePath || 'C:/Program Files/FireDaemon OpenSSL 3/bin/openssl.exe' : '/usr/bin/openssl'

  if (!opensslPath) {
    throw new Error('OpenSSL 路径未配置或未找到。')
  }

  if ((await Plugins.FileExists(rootKeyPath)) && (await Plugins.FileExists(rootCrtPath))) {
    Plugins.message.info('根证书已存在。')
    return
  }

  Plugins.message.info('生成根证书...')
  try {
    // 生成根证书私钥
    await Plugins.Exec(opensslPath, ['genrsa', '-out', rootKeyPath, '2048'])

    // 生成自签名根证书
    await Plugins.Exec(opensslPath, [
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
      const rootCrtSha1 = await getRootCertSha1(opensslPath, rootCrtPath)
      await Plugins.Writefile(ROOT_CA_CRT_SHA1, rootCrtSha1)
      Plugins.message.success('写入根证书 SHA1 值成功。')
    }

    Plugins.message.success('根证书生成成功。')
  } catch (e) {
    throw `生成根证书失败: ${e.message || e}`
  }
}

/**
 * 获取根证书的 SHA1 值。
 */
const getRootCertSha1 = async (opensslPath, rootCrtPath) => {
  const fingerprintString = await Plugins.Exec(opensslPath, ['x509', '-in', rootCrtPath, '-noout', '-fingerprint', '-sha1'])
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
  const absPath = await Plugins.AbsolutePath(THIRD_DIR)

  const opensslPath = os === 'windows' ? Plugin.binFilePath || 'C:/Program Files/FireDaemon OpenSSL 3/bin/openssl.exe' : '/usr/bin/openssl'
  const rootKeyPath = await Plugins.AbsolutePath(ROOT_CA_KEY_PATH)
  const rootCrtPath = await Plugins.AbsolutePath(ROOT_CA_CRT_PATH)
  const childKeyPath = await Plugins.AbsolutePath(CHILD_CERT_KEY_PATH)
  const childCrtPath = await Plugins.AbsolutePath(CHILD_CERT_CRT_PATH)
  const childCsrPath = `${absPath}/child.csr`
  const sanConfigPath = `${await Plugins.AbsolutePath(TMEP_DIR)}/san_config` // 临时 SAN 配置文件

  if (!opensslPath) {
    throw new Error('OpenSSL 路径未配置或未找到。')
  }
  if (!(await Plugins.FileExists(rootKeyPath)) || !(await Plugins.FileExists(rootCrtPath))) {
    throw new Error('根证书文件不存在，无法生成子证书。')
  }

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
    await Plugins.Exec(opensslPath, ['genrsa', '-out', childKeyPath, '2048'])

    // 生成子证书 CSR (Certificate Signing Request)
    await Plugins.Exec(opensslPath, [
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
    await Plugins.Exec(opensslPath, [
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
    Plugins.message.error(`生成子证书失败: ${e.message || e}`)
    // 尝试清理可能生成的文件
    await Plugins.ignoredError(Plugins.Removefile, childKeyPath)
    await Plugins.ignoredError(Plugins.Removefile, childCrtPath)
    await Plugins.ignoredError(Plugins.Removefile, childCsrPath)
    await Plugins.ignoredError(Plugins.Removefile, sanConfigPath)
    throw e
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

  await Plugins.Writefile(`${NGINX_LOGS_DIR}/access.log`, '')
  await Plugins.Writefile(`${NGINX_LOGS_DIR}/error.log`, '')

  await generateAndWriteConfigs() // 在启动前生成并写入配置和证书

  return new Promise(async (outerResolve, outerReject) => {
    try {
      let nginxStartPromiseResolved = false
      let nginxStartPromiseRejected = false
      let nginxStartPromiseResolve
      let nginxStartPromiseReject

      const nginxStartPromise = new Promise((res, rej) => {
        nginxStartPromiseResolve = () => {
          if (!nginxStartPromiseRejected) {
            nginxStartPromiseResolved = true
            res()
          }
        }
        nginxStartPromiseReject = (err) => {
          if (!nginxStartPromiseResolved) {
            nginxStartPromiseRejected = true
            rej(err)
          }
        }
      })

      const nginxConfAbsPath = await Plugins.AbsolutePath(NGINX_CONF_FILE_PATH)

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
              Plugins.message.error(out)
            }
            if (nginxPid && nginxPid !== 0) {
              await Plugins.ignoredError(Plugins.KillProcess, Number(nginxPid))
            }
            nginxStartPromiseReject(new Error(out)) // 错误时拒绝内部 Promise
            outerReject(new Error(out)) // 同时拒绝外部 Promise
          }
        },
        async () => {
          if (nginxPid && nginxPid !== 0) {
            await Plugins.ignoredError(Plugins.KillProcess, Number(nginxPid))
          }
          nginxStartPromiseReject(new Error('启动失败')) // 进程退出时拒绝内部 Promise
          outerReject(new Error('启动失败')) // 同时拒绝外部 Promise
        }
      )

      if (nginxPid && nginxPid !== 0) {
        setTimeout(() => {
          nginxStartPromiseResolve()
        }, 1000) // 等待 1 秒，给 Nginx 启动时间
      } else {
        nginxStartPromiseReject(new Error('无法启动 Nginx 进程'))
        outerReject(new Error('无法启动 Nginx 进程'))
      }

      await nginxStartPromise // 等待 Nginx 进程启动成功或失败的信号

      await manageRootCertInSystemTrust(CERT_ACTION.INSTALL) // 安装根证书

      const jsonData = await getMergedRules()
      const dynamicHostsContent = await generateDynamicHostsContent(jsonData)
      await updateSystemHostsFile(HOSTS_ACTION.ADD, dynamicHostsContent)

      outerResolve()
    } catch (e) {
      outerReject(e)
    }
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

  await manageRootCertInSystemTrust(CERT_ACTION.UNINSTALL) // 移除根证书
  await updateSystemHostsFile(HOSTS_ACTION.REMOVE, '') // 恢复 Hosts 文件

  Plugins.message.info('发送 Nginx 停止信号...')
  const nginxConfAbsPath = await Plugins.AbsolutePath(NGINX_CONF_FILE_PATH)
  try {
    await Plugins.Exec(execPath, ['-s', 'quit', '-c', nginxConfAbsPath, '-p', absPath])
    Plugins.message.success('Nginx 停止信号已发送。')
    await new Promise((resolve) => setTimeout(resolve, 2000)) // 等待 2 秒
    // 再次检查是否还在运行
    if (await isRunningNginx()) {
      Plugins.message.warn('Nginx 进程可能未完全停止，尝试强制杀死。')
      if (await Plugins.FileExists(NGINX_PID_FILE_PATH)) {
        const pid = Number(await Plugins.Readfile(NGINX_PID_FILE_PATH))
        if (pid && pid !== 0) {
          await Plugins.ignoredError(Plugins.KillProcess, pid)
          Plugins.message.success(`已尝试杀死进程 ${pid}。`)
        }
      }
      // 再次等待确保进程清理
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
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
  const baseRule = await Plugins.Readfile(BASE_RULE_FILE_PATH)
  try {
    const customRule = JSON.parse(Plugin.customRule)
    const completeRules = [...JSON.parse(baseRule), ...customRule]
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

  const extraStartArgs = Plugin.extraStartArgs || ''
  const startArgs = [
    `--host-rules="${hostRulesString}"`,
    `--host-resolver-rules="${hostResolverRulesString}"`,
    '--test-type',
    '--ignore-certificate-errors',
    extraStartArgs
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
const generateAndWriteConfigs = async () => {
  if (!(await Plugins.FileExists(BASE_RULE_FILE_PATH))) {
    throw new Error('规则文件不存在，请先更新规则。')
  }

  const jsonData = await getMergedRules()

  // 1. 确保根证书存在 (如果不存在则生成)
  await generateRootCert()

  // 2. 根据规则生成包含 SAN 的子证书
  await generateChildCertWithSans(jsonData)

  // 3. 生成并写入 Nginx 配置 (使用新生成的子证书)
  const nginxConfContent = await generateNginxConfContent(jsonData)
  await Plugins.Writefile(NGINX_CONF_FILE_PATH, nginxConfContent)
  Plugins.message.info(`Nginx 配置文件已更新: ${NGINX_CONF_FILE_PATH}`)
}

/**
 * @description 新增函数：根据 Cealing-Host.json 规则生成 Hosts 文件中动态部分的内容。
 * @param {Array<Array<any>>} jsonData - Cealing-Host.json 的解析内容。
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

  const tempFileAbsPath = await Plugins.AbsolutePath(`${TMEP_DIR}/hosts_temp}`)
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
 * @description 新增函数：根据 Cealing-Host.json 规则生成完整的 Nginx 配置内容。
 * @param {Array<Array<any>>} jsonData - Cealing-Host.json 的解析内容。
 * @returns {Promise<string>} 完整的 Nginx 配置字符串。
 */
const generateNginxConfContent = async (jsonData) => {
  const childCrtFileName = CHILD_CERT_CRT_PATH.split('/').pop()
  const childKeyFileName = CHILD_CERT_KEY_PATH.split('/').pop()

  const nginxPidFileAbsPath = await Plugins.AbsolutePath(NGINX_PID_FILE_PATH)

  let nginxConfig = `pid ${nginxPidFileAbsPath.replace(/\\/g, '/')};

worker_processes auto;

events {
    worker_connections 65536;
}

http {
    client_body_temp_path temp/client_body;
    proxy_temp_path temp/proxy;

    access_log logs/access.log;
    error_log logs/error.log;

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
        ssl_certificate ${childCrtFileName};
        ssl_certificate_key ${childKeyFileName};
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

    let serverNamesRegexParts = []
    rawDomains.forEach((domain) => {
      let [includeDomain, excludeDomain] = domain.split('^', 2)
      includeDomain = includeDomain.trim()
      excludeDomain = excludeDomain ? excludeDomain.trim() : ''

      // 忽略以 '#' 开头的域名字符串
      if (includeDomain.startsWith('#')) {
        return // 跳过当前域名字符串
      }

      // 忽略包含 googlevideo 的域名，避免与硬编码块冲突
      if (includeDomain.includes('googlevideo')) {
        return
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
        ssl_certificate ${childCrtFileName};
        ssl_certificate_key ${childKeyFileName};
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
