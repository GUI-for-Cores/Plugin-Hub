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
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return ['AdGuardHome.exe', 'AdGuardHome'].includes(name)
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
    try {
      const pid = await Plugins.ExecBackground(
        ADGUARDHOME_PATH + '/AdGuardHome.exe',
        ['--web-addr', Plugin.Address, '--no-check-update'],
        async (out) => {
          if (out.includes('go to')) {
            if (!isOK) {
              isOK = true
              await Plugins.Writefile(PID_FILE, pid.toString())
              resolve()
            }
          }
        },
        async () => {
          await Plugins.Writefile(PID_FILE, '0')
        }
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 安装AdGuardHome
 */
const installAdGuardHome = async () => {
  const { env } = Plugins.useEnvStore()
  const tmpZip = 'data/.cache/adguardhome.zip'
  const url = `https://github.com/AdguardTeam/AdGuardHome/releases/download/v0.107.51/AdGuardHome_windows_${env.arch}.zip`
  const { id } = Plugins.message.info('下载AdGuardHome压缩包')
  try {
    await Plugins.Download(url, tmpZip, {}, (progress, total) => {
      Plugins.message.update(id, '下载AdGuardHome压缩包：' + ((progress / total) * 100).toFixed(2) + '%')
    })
    await Plugins.UnzipZIPFile(tmpZip, 'data/third')
    Plugins.message.update(id, '安装AdGuardHome完成', 'success')
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
    await startAdguardHomeService()
  }
  const url = 'http://127.0.0.1:' + Plugin.Address.split(':')[1]
  Plugins.BrowserOpenURL(url)
  return 1
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
