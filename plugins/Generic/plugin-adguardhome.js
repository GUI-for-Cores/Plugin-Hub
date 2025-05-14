/**
 * 本插件使用项目：https://github.com/AdguardTeam/AdGuardHome
 */

const ADGUARDHOME_PATH = 'data/third/AdGuardHome'
const PID_FILE = ADGUARDHOME_PATH + '/AdGuardHome.pid'
const BACKUP_FILE = 'data/third/AdGuardHome.yaml.bak'

/**
 * 检测AdGuardHome是否在运行
 */
const isAdGuardHomeRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return [`AdGuardHome${os === 'windows' ? '.exe' : ''}`, 'AdGuardHome'].includes(name)
  }
  return false
}

/**
 * 停止AdGuardHome服务
 */
const stopAdGuardHomeService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
  }
}

/**
 * 启动AdGuardHome服务
 */
const startAdguardHomeService = async () => {
  return new Promise(async (resolve, reject) => {
    let isOK = false
    let isFatalError = false
    const envStore = Plugins.useEnvStore()
    const { os } = envStore.env
    const dnsPort = Number(Plugin.dnsPort) || 20053
    const adgConfigFilePath = `${ADGUARDHOME_PATH}/AdGuardHome.yaml`
    if (await Plugins.FileExists(adgConfigFilePath)) {
      const adgConfigFile = await Plugins.Readfile(adgConfigFilePath)
      const adgConfig = Plugins.YAML.parse(adgConfigFile)
      if (adgConfig.dns.port !== dnsPort) {
        adgConfig.dns.port = dnsPort
        await Plugins.Writefile(adgConfigFilePath, Plugins.YAML.stringify(adgConfig))
      }
    } else {
      const initConfig = { dns: { port: dnsPort } }
      await Plugins.Writefile(adgConfigFilePath, Plugins.YAML.stringify(initConfig))
    }

    try {
      const pid = await Plugins.ExecBackground(
        `${ADGUARDHOME_PATH}/AdGuardHome${os === 'windows' ? '.exe' : ''}`,
        ['--web-addr', Plugin.Address, '--no-check-update'],
        async (out) => {
          if (out.includes('[fatal]')) {
            if (!isOK && !isFatalError) {
              isFatalError = true
              if (out.includes('bind: permission denied')) {
                Plugins.message.error('AdGuardHome 启动失败：权限不足，请先为 AdGuardHome 程序授权，或使用 1024 以上端口')
              } else if (out.includes('bind: address already in use')) {
                Plugins.message.error('AdGuardHome 启动失败：DNS 端口已被占用，请更换其他端口')
              } else {
                Plugins.message.error('AdGuardHome 启动失败：未知错误')
              }
              if (pid && pid !== 0) {
                await Plugins.KillProcess(Number(pid))
              }
              reject(new Error(out))
            }
          } else if (out.includes('entering listener loop')) {
            if (!isOK && !isFatalError) {
              isOK = true
              await Plugins.Writefile(PID_FILE, pid.toString())
              resolve()
            }
          }
        },
        async () => {
          await Plugins.Writefile(PID_FILE, '0')
          if (!isOK && !isFatalError) {
            Plugins.message.error('AdGuardHome 进程意外退出')
            reject(new Error('AdGuardHome process exited unexpectedly'))
          }
        }
      )
    } catch (error) {
      Plugins.message.error(`启动 AdGuardHome 进程失败: ${error.message || error}`)
      reject(error.message || error)
    }
  })
}

/**
 * 安装AdGuardHome
 */
const installAdGuardHome = async (isUpdate = false) => {
  const envStore = Plugins.useEnvStore()
  const { os, arch } = envStore.env
  const destDir = 'data/third'
  const suffix = os === 'linux' ? '.tar.gz' : '.zip'
  const tmpDir = 'data/.cache'
  const tmpZip = `${tmpDir}/adguardhome${suffix}`
  const url = `https://github.com/AdguardTeam/AdGuardHome/releases/latest/download/AdGuardHome_${os}_${arch}${suffix}`
  const { id } = Plugins.message.info('下载 AdGuardHome 压缩包')
  try {
    await Plugins.Download(url, tmpZip, {}, (progress, total) => {
      Plugins.message.update(id, '下载 AdGuardHome 压缩包：' + ((progress / total) * 100).toFixed(2) + '%')
    })
    if (!isUpdate) {
      if (tmpZip.endsWith('.zip')) {
        await Plugins.UnzipZIPFile(tmpZip, destDir)
      } else {
        await Plugins.UnzipTarGZFile(tmpZip, destDir)
      }
    } else {
      if (tmpZip.endsWith('.zip')) {
        await Plugins.UnzipZIPFile(tmpZip, tmpDir)
      } else {
        await Plugins.UnzipTarGZFile(tmpZip, tmpDir)
      }
      await Plugins.Movefile(
        `${tmpDir}/AdGuardHome/AdGuardHome${os === 'windows' ? '.exe' : ''}`,
        `${destDir}/AdGuardHome/AdGuardHome${os === 'windows' ? '.exe' : ''}`
      )
      await Plugins.Removefile(`${tmpDir}/AdGuardHome`)
    }
    await Plugins.Removefile(tmpZip)
    Plugins.message.update(id, isUpdate ? '更新 AdGuardHome 成功' : '安装 AdGuardHome 完成', 'success')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/* 卸载AdGuardHome */
const uninstallAdGuardHome = async () => {
  await Plugins.Removefile(ADGUARDHOME_PATH)
}

/**
 * 为 AdGuardHome 授权
 */
const grantPermission = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  const absPath = await Plugins.AbsolutePath(`${ADGUARDHOME_PATH}/AdGuardHome`)
  if (os === 'linux') {
    await Plugins.Exec('pkexec', ['setcap', 'CAP_NET_BIND_SERVICE=+eip CAP_NET_RAW=+eip', absPath])
  } else {
    const osaScript = `chown root:admin ${absPath}\nchmod +sx ${absPath}`
    const bashScript = `osascript -e 'do shell script "${osaScript}" with administrator privileges'`
    await Plugins.Exec('bash', ['-c', bashScript])
  }
}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installAdGuardHome()
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isAdGuardHomeRunning()) {
    throw '请先停止运行AdguardHome服务！'
  }
  await Plugins.confirm('确定要删除AdGuardHome吗？', '请注意先备份配置文件！')
  await uninstallAdGuardHome()
  return 0
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isAdGuardHomeRunning())) {
    await startAdguardHomeService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isAdGuardHomeRunning())) {
    await stopAdGuardHomeService()
    return 2
  }
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isAdGuardHomeRunning())) {
    try {
      await startAdguardHomeService()
      const url = 'http://127.0.0.1:' + Plugin.Address.split(':')[1]
      Plugins.BrowserOpenURL(url)
      return 1
    } catch (error) {
      return 2
    }
  } else {
    const url = 'http://127.0.0.1:' + Plugin.Address.split(':')[1]
    Plugins.BrowserOpenURL(url)
    return 1
  }
}

/**
 * 插件菜单项 - 授权程序
 */

const Grant = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env
  if (os === 'windows') {
    throw 'Windows 系统不需要授权'
  }
  await grantPermission()
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isAdGuardHomeRunning()) {
    throw '当前服务已经在运行了'
  }
  await startAdguardHomeService()
  Plugins.message.success('✨AdguardHome 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isAdGuardHomeRunning())) {
    throw '当前服务并未在运行'
  }
  await stopAdGuardHomeService()
  Plugins.message.success('停止AdguardHome成功')
  return 2
}

/**
 * 插件菜单项 - 更新程序
 */

const Update = async () => {
  const isRunning = await isAdGuardHomeRunning()
  isRunning && (await stopAdGuardHomeService())
  await installAdGuardHome(true)
  isRunning && (await startAdguardHomeService())
  return isRunning ? 1 : 2
}

/**
 * 插件菜单项 - 备份配置
 */
const Backup = async () => {
  if (!(await Plugins.FileExists(ADGUARDHOME_PATH + '/AdGuardHome.yaml'))) {
    throw '没有可备份的配置文件'
  }
  const config_content = await Plugins.Readfile(ADGUARDHOME_PATH + '/AdGuardHome.yaml')
  await Plugins.Writefile(BACKUP_FILE, config_content)
  Plugins.message.success('配置文件备份成功')
}

/**
 * 插件菜单项 - 恢复配置
 */
const Restore = async () => {
  if (!(await Plugins.FileExists(BACKUP_FILE))) {
    throw '没有可恢复的配置文件'
  }
  if (await isAdGuardHomeRunning()) {
    throw '请先停止运行AdGuardHome'
  }
  const config_content = await Plugins.Readfile(BACKUP_FILE)
  await Plugins.Writefile(ADGUARDHOME_PATH + '/AdGuardHome.yaml', config_content)
  Plugins.message.success('配置文件恢复成功')
}
