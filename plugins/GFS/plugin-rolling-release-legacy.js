/* 触发器 手动触发 */
const onRun = async () => {
  await Plugins.confirm(
    '确定要切换到旧版吗？',
    '旧版配置已不再适配新的 sing-box 核心，并将在不久的将来完全弃用。\n\n如果你习惯了旧版配置界面并不愿尝试新的界面，可以考虑使用 [GUI.for.Clash](https://github.com/GUI-for-Cores/GUI.for.Clash "GUI.for.Clash")（基于 Mihomo 核心）客户端，因为旧版配置界面是依据 Mihomo 设计的，实际上你熟悉的并不是 sing-box，而是 Mihomo。',
    {
      type: 'markdown'
    }
  )
  await Rolling()
}

/*
 * 右键菜单 - 滚动版本
 * params: confirm 是否进行交互式确认
 */
const Rolling = async (confirm = true) => {
  await checkRollingReleaseEnabled()
  await checkLatestVersion()

  const url = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.SingBox/releases/tags/rolling-release-legacy'

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
  const ChangelogUrl = body.assets.find((v) => v.name === 'changelog.md')?.browser_download_url

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
    Plugins.message.success(`[${Plugin.name}] 当前版本已是最新（旧版）`)
    destroy()
    return
  }

  let changelog = '维护性更新'

  if (ChangelogUrl && confirm) {
    update('正在获取更新日志...')
    const { body } = await Plugins.HttpGet(ChangelogUrl)
    changelog = body
  }
  destroy()

  confirm && (await Plugins.confirm(Plugin.name, changelog, { type: 'markdown' }))

  const { update: update2, destroy: destroy2 } = Plugins.message.info('正在更新...')
  try {
    await Plugins.Download(ZipUrl, ZipFile, {}, (progress, total) => {
      update2('正在更新...' + ((progress / total) * 100).toFixed(2) + '%')
    })
    await Plugins.ignoredError(Plugins.Movefile, 'data/rolling-release', BackupFile)
    await Plugins.UnzipZIPFile(ZipFile, 'data')
    await Plugins.Removefile(ZipFile)
    await Plugins.Removefile(BackupFile)
    destroy2()
    const ok = await Plugins.confirm(Plugin.name, '更新成功，是否立即重载界面？').catch(() => 0)
    ok && Plugins.WindowReloadApp()
  } catch (err) {
    error(err.message || err)
  } finally {
    Plugins.sleep(1500).then(() => destroy2())
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

/**
 * 右键菜单 - 更新日志
 */
const Changelog = async () => {
  const url = `https://github.com/GUI-for-Cores/${Plugins.APP_TITLE}/releases/download/rolling-release-legacy/changelog.md`
  const { body } = await Plugins.HttpGet(url)
  await Plugins.alert(Plugin.name, body, { type: 'markdown' })
}

const checkRollingReleaseEnabled = async () => {
  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.rollingRelease) {
    throw '请在【设置】中，开启【启用滚动发行】功能。'
  }
}

const checkLatestVersion = async () => {
  const url = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.SingBox/releases/latest'
  const { body } = await Plugins.HttpGet(url, {
    Authorization: Plugins.getGitHubApiAuthorization()
  })
  const { tag_name, message } = body
  if (message) throw message
  if (tag_name !== Plugins.APP_VERSION) {
    throw '无法跨大版本升级，请通过 设置 - 关于，更新APP！'
  }
}
