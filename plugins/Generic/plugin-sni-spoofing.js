// 参考项目：https://github.com/SpaceTimee/Sheas-Cealer

const RULE_URL_PREFIX = 'https://github.com/SpaceTimee/Cealing-Host/raw/main'
const BASE_RULE_URL = `${RULE_URL_PREFIX}/Cealing-Host.json`
const THIRD_DIR = 'data/third/sni-spoofing'
const RULE_FILE_PATH = `${THIRD_DIR}/Cealing-Host.json`
const NGINX_BIN_URL_PREFIX = 'https://github.com/jirutka/nginx-binaries/raw/refs/heads/binaries'
const NGINX_TEMP_DIR = `${THIRD_DIR}/temp`
const NGINX_LOGS_DIR = `${THIRD_DIR}/logs`

const NGINX_PID_FILE_PATH = `${NGINX_LOGS_DIR}/nginx.pid`

const TMEP_DIR = 'data/.cache'

const NGINX_CONF = `pid logs/nginx.pid;

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
        ssl_certificate crt.pem;
        ssl_certificate_key key.pem;
        proxy_ssl_name E0;
        resolver 223.5.5.5 ipv4=off;

        location / {
            if ($http_host ~* ^(.+).googlevideo.com$) {
                proxy_pass https://$1.gvt1.com;
            }
        }
    }
}`

const HOSTS = `# Nginx Start
127.0.0.1  www.googlevideo.com
127.0.0.1  www.google.com
127.0.0.1  google.com
# Nginx End`

window[Plugin.id] = window[Plugin.id] || {}

const onReady = async () => {
  return 2
}

/**
 * 插件钩子：运行按钮 - onRun
 */
const onRun = async () => {
  if (!(await Plugins.FileExists(RULE_FILE_PATH))) {
    throw '请先右键插件更新规则'
  }

  const execPath = Plugin.browserPath
  if (!execPath) {
    throw '请先配置浏览器路径'
  }

  const startArgs = !window[Plugin.id].startArgs ? await generateStartArgs() : window[Plugin.id].startArgs

  try {
    if (!(await isRunningNginx())) {
      await Plugins.message.info('为了启动参数能成功注入，请关闭所有浏览器窗口后，再运行插件，并通过插件运行来启动浏览器')
      await startNginx()
    }

    const browerPid = await Plugins.ExecBackground(
      execPath,
      startArgs,
      async (out) => {},
      async () => {
        if (browerPid && browerPid !== 0) {
          await Plugins.KillProcess(Number(browerPid))
        }
      }
    )
    return 1
  } catch (e) {
    return 2
  }
}

const onInstall = async () => {
  if (!(await Plugins.FileExists(THIRD_DIR)) || (await Plugins.Readdir(THIRD_DIR)).length < 6) {
    await installNginx()
  }

  return 0 // 表示初始状态
}

const onUninstall = async () => {
  if (await isRunningNginx()) {
    await stopNginx()
  }

  if (await Plugins.FileExists(THIRD_DIR)) {
    await Plugins.Removefile(THIRD_DIR)
  }

  await Plugins.message.success('卸载成功')
  return 0
}

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
  if (!(await Plugins.FileExists(THIRD_DIR))) {
    await Plugins.Makedir(THIRD_DIR)
  }
  await Plugins.Download(BASE_RULE_URL, RULE_FILE_PATH)
  await Plugins.message.success('更新规则成功')
}

const onStart = async () => {
  if (!(await isRunningNginx())) {
    await startNginx()
    await Plugins.message.success('nginx 启动成功，如果不使用，请右键插件停止服务')
    return 1
  }
}

const onStop = async () => {
  if (await isRunningNginx()) {
    await stopNginx()
    await Plugins.message.success('nginx 停止成功')
    return 2
  }
}

const installNginx = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  if (!os === 'windows' && !os === 'linux') {
    throw '此插件仅适配 Windows 和 Linux 系统'
  }
  const nginxBinFile = {
    windows: 'nginx-1.27.5-x86_64-win32.exe',
    linux: 'nginx-1.27.5-x86_64-linux'
  }[os]
  await Plugins.Makedir(THIRD_DIR)
  await Plugins.Download(`${NGINX_BIN_URL_PREFIX}/${nginxBinFile}`, `${THIRD_DIR}/nginx${os === 'windows' ? '.exe' : ''}`)

  await Plugins.Makedir(NGINX_TEMP_DIR)
  await Plugins.Makedir(NGINX_LOGS_DIR)
  await Plugins.Writefile(`${NGINX_LOGS_DIR}/access.log`, '')
  await Plugins.Writefile(`${NGINX_LOGS_DIR}/error.log`, '')
  await Plugins.Writefile(`${THIRD_DIR}/nginx.conf`, NGINX_CONF)

  const absPath = await Plugins.AbsolutePath(THIRD_DIR)

  const execArgs1 = ['genrsa', '-out', `${absPath}/key.pem`, '4096']

  const execArgs2 = [
    'req',
    '-x509',
    '-new',
    '-key',
    `${absPath}/key.pem`,
    '-out',
    `${absPath}/crt.pem`,
    '-days',
    '36500',
    '-sha256',
    '-subj',
    `/CN=${Plugins.APP_TITLE}`
  ]

  if (os === 'windows') {
    const execBinFilePath = Plugin.binFilePath || 'C:/Program Files/FireDaemon OpenSSL 3/bin/openssl.exe'

    if (!(await Plugins.FileExists(execBinFilePath))) {
      throw '请先配置你的 OpenSSL 安装路径，或者安装推荐的版本'
    }
    await Plugins.Exec(execBinFilePath, execArgs1)

    await Plugins.Exec(execBinFilePath, execArgs2)
  } else {
    const execBinFilePath = '/usr/bin/openssl'
    await Plugins.Exec(execBinFilePath, execArgs1)

    await Plugins.Exec(execBinFilePath, execArgs2)
  }

  if (!(await Plugins.FileExists(`${absPath}/key.pem`))) {
    throw 'SSL 证书未成功生成，请安装 OpenSSL 后重新安装插件'
  }

  if (os === 'windows') {
    await Plugins.message.info('为了服务正常运行，请确保软件设置内的以管理员身份运行选项已启用')
  } else {
    await Plugins.Exec('chmod', ['+x', `${absPath}/nginx`])

    await Plugins.Exec('pkexec', ['setcap', 'CAP_NET_BIND_SERVICE=+eip CAP_NET_RAW=+eip', `${absPath}/nginx`])
  }

  await Plugins.message.success('安装成功')
}

const startNginx = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const absPath = await Plugins.AbsolutePath(THIRD_DIR)

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
      const nginxPid = await Plugins.ExecBackground(
        `${absPath}/nginx${os === 'windows' ? '.exe' : ''}`,
        ['-c', `${absPath}/nginx.conf`, '-p', absPath],
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
            nginxStartPromiseReject(new Error(out)) // Reject the internal promise on error
            outerReject(new Error(out)) // Also reject the outer promise
          }
        },
        async () => {
          if (nginxPid && nginxPid !== 0) {
            await Plugins.ignoredError(Plugins.KillProcess, Number(nginxPid))
          }
          nginxStartPromiseReject(new Error('启动失败')) // Reject the internal promise on exit
          outerReject(new Error('启动失败')) // Also reject the outer promise
        }
      )

      if (nginxPid && nginxPid !== 0) {
        setTimeout(() => {
          nginxStartPromiseResolve()
        }, 1000) // Wait 1 second
      } else {
        nginxStartPromiseReject(new Error('无法启动 Nginx 进程'))
        outerReject(new Error('无法启动 Nginx 进程'))
      }

      await nginxStartPromise // Wait for the nginx process to signal success or failure
      await changeHosts(HOSTS_ACTION.ADD)
      outerResolve()
    } catch (e) {
      outerReject(e)
    }
  })
}

const stopNginx = async () => {
  const nginxPid = await Plugins.Readfile(NGINX_PID_FILE_PATH)
  await Plugins.ignoredError(Plugins.KillProcess, Number(nginxPid))
  await changeHosts(HOSTS_ACTION.REMOVE)
}

const isRunningNginx = async () => {
  if (await Plugins.FileExists(NGINX_PID_FILE_PATH)) {
    const pid = await Plugins.Readfile(NGINX_PID_FILE_PATH)
    if (pid && pid !== 0) {
      const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
      if (name && name.includes('nginx')) {
        return true
      }
    }
  }
  return false
}

/*
 * 生成启动参数
 */
const generateStartArgs = async () => {
  const hostRules = []
  const hostResolverRules = []
  let uCounter = 0
  // 用于映射 IP 地址到 U 标识符，确保相同 IP 的空目标主机使用相同的 U
  const ipToUIdMap = new Map()
  // 用于存储已添加到 host-resolver-rules 的目标，避免重复
  const resolverTargets = new Set()

  const rule = await Plugins.Readfile(RULE_FILE_PATH)
  const data = [...JSON.parse(rule)]

  data.forEach((entry) => {
    // 确保 domains 是一个数组，即使只有一个域名也是如此
    const domains = Array.isArray(entry[0]) ? entry[0] : [entry[0]]
    const targetHost = entry[1]
    const ipAddress = entry[2]

    let currentTargetIdentifier = ''
    // 如果 IP 地址为空，则默认为本地回环地址
    const actualIp = ipAddress === '' ? '127.0.0.1' : ipAddress

    // 判断是否需要生成 U 标识符
    if (targetHost === '' || targetHost === null) {
      // 如果此 IP 地址已经有对应的 U 标识符，则复用
      if (ipToUIdMap.has(actualIp)) {
        currentTargetIdentifier = ipToUIdMap.get(actualIp)
      } else {
        // 否则，生成新的 U 标识符并存储
        currentTargetIdentifier = `U${uCounter++}`
        ipToUIdMap.set(actualIp, currentTargetIdentifier)
      }
    } else {
      // 如果目标主机不为空，则直接使用它
      currentTargetIdentifier = targetHost
    }

    // 构建 host-rules 部分
    domains.forEach((domain) => {
      // 移除域名开头的 '#' 或 '$' 字符
      const cleanedDomain = domain.startsWith('#') || domain.startsWith('$') ? domain.substring(1) : domain
      hostRules.push(`MAP ${cleanedDomain} ${currentTargetIdentifier}`)
    })

    // 构建 host-resolver-rules 部分，确保目标唯一性
    if (!resolverTargets.has(currentTargetIdentifier)) {
      hostResolverRules.push(`MAP ${currentTargetIdentifier} ${actualIp}`)
      resolverTargets.add(currentTargetIdentifier)
    }
  })

  const hostRulesString = hostRules.join(',')
  const hostResolverRulesString = hostResolverRules.join(',')

  // 组合成最终的 Brave 启动参数命令
  const startArgs = [`--host-rules=${hostRulesString}`, `--host-resolver-rules=${hostResolverRulesString}`, '--test-type', '--ignore-certificate-errors']

  window[Plugin.id].startArgs = startArgs

  return startArgs
}

const HOSTS_ACTION = {
  ADD: 'add',
  REMOVE: 'remove'
}

const changeHosts = async (action) => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const hostsFilePath = await getHostsFilePath()

  const base = await Plugins.Readfile(hostsFilePath)

  let newContent = base

  if (action === HOSTS_ACTION.ADD) {
    if (!base.includes(HOSTS)) {
      newContent = `${base}\n\n${HOSTS}`
    } else {
      return
    }
  } else if (action === HOSTS_ACTION.REMOVE) {
    if (base.includes(HOSTS)) {
      newContent = base.replace(HOSTS, '').trim()
    } else {
      return
    }
  }

  if (os === 'windows') {
    await Plugins.Writefile(hostsFilePath, newContent)
  } else {
    const tempFileAbsPath = await Plugins.AbsolutePath(`${TMEP_DIR}/hosts_temp`)
    await Plugins.Writefile(tempFileAbsPath, newContent)
    await Plugins.Exec('pkexec', ['cp', tempFileAbsPath, hostsFilePath])
    await Plugins.Removefile(tempFileAbsPath)
  }
}

const getHostsFilePath = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  return os === 'windows' ? 'C:/Windows/System32/drivers/etc/hosts' : '/etc/hosts'
}
