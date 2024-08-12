/**
 * TODO: 更新失败的回滚操作
 */

/* 触发器 手动触发 */
const onRun = async () => {
  await Rolling()
}

/* 触发器 启动APP时 */
const onStartup = async () => {
  if (Plugin.AutoRollingMode === 'onStartup') {
    // 延迟检测，确保内核已经启动
    setTimeout(() => Rolling(false), (Plugin.AutoRollingDelay || 10) * 1000)
  }
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  if (Plugin.AutoRollingMode === 'onReady') {
    // 延迟检测，确保内核已经启动
    setTimeout(() => Rolling(false), (Plugin.AutoRollingDelay || 10) * 1000)
  }
}

/*
 * 右键菜单 - 滚动版本
 * params: confirm 是否进行交互式确认
 */
const Rolling = async (confirm = true) => {
  await checkRollingReleaseEnabled()

  const GFC_URL = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.Clash/releases/tags/rolling-release'
  const GFS_URL = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.SingBox/releases/tags/rolling-release'
  const url = Plugins.APP_TITLE.includes('Clash') ? GFC_URL : GFS_URL

  const { update, destroy, error } = Plugins.message.info(`[${Plugin.name}] 检测中...`, 999999)

  const { body } = await Plugins.HttpGet(url, {
    Authorization: Plugins.getGitHubApiAuthorization()
  })

  if (body.message) {
    destroy()
    throw body.message
  }

  const ZipFile = 'data/.cache/rolling-release.zip'
  const BackupFile = 'data/.cache/rolling-release.backup'
  const ZipUrl = body.assets.find((v) => v.name === 'rolling-release.zip')?.browser_download_url
  const VersionUrl = body.assets.find((v) => v.name === 'version.txt')?.browser_download_url

  if (!ZipUrl || !VersionUrl) {
    destroy()
    throw '出现一些错误，无法找到更新资源包'
  }

  let localVersion = ''
  let remoteVersion = ''

  try {
    const { body } = await Plugins.HttpGet(VersionUrl)
    remoteVersion = body

    const res = await fetch('/version.txt')
    localVersion = await res.text()
  } catch (err) {}

  if (!remoteVersion) {
    destroy()
    throw '无法获取远程版本信息'
  }

  if (localVersion === remoteVersion) {
    Plugins.message.success(`[${Plugin.name}] 当前版本已是最新`)
    destroy()
    return
  }

  confirm && (await Plugins.confirm(Plugin.name, '确认滚动版本至最新吗？'))

  try {
    await Plugins.Download(ZipUrl, ZipFile, {}, (progress, total) => {
      update('正在更新...' + ((progress / total) * 100).toFixed(2) + '%')
    })
    await Plugins.ignoredError(Plugins.Movefile, 'data/rolling-release', BackupFile)
    await Plugins.UnzipZIPFile(ZipFile, 'data')
    await Plugins.Removefile(ZipFile)
    await Plugins.Removefile(BackupFile)
    destroy()
    const ok = await Plugins.confirm(Plugin.name, '更新成功，是否立即重载界面？').catch(() => 0)
    ok && Plugins.WindowReloadApp()
  } catch (err) {
    error(err.message || err)
  } finally {
    Plugins.sleep(1500).then(() => destroy())
  }
}

/**
 * 右键菜单 - 恢复版本
 */
const Recovery = async () => {
  await checkRollingReleaseEnabled()
  if (!(await Plugins.FileExists('data/rolling-release'))) {
    Plugins.message.info('无需恢复，此版本已是默认版本。')
    return
  }
  await Plugins.confirm(Plugin.name, '是否移除当前版本，恢复为默认版本？\n这将移除 data/rolling-release 目录。')
  await Plugins.Removefile('data/rolling-release')
  const ok = await Plugins.confirm(Plugin.name, '恢复成功，是否立即重载界面').catch(() => 0)
  ok && (await Plugins.WindowReloadApp())
}

const checkRollingReleaseEnabled = async () => {
  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.rollingRelease) {
    throw '请在【设置】中，开启【启用滚动发行】功能。'
  }
}
