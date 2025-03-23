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
  await checkLatestVersion()

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
    Plugins.message.success(`[${Plugin.name}] 当前版本已是最新`)
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
  const { body } = await Plugins.HttpGet(`https://api.github.com/repos/GUI-for-Cores/${Plugins.APP_TITLE}/commits`, {
    Authorization: Plugins.getGitHubApiAuthorization()
  })
  const releaseIndex = body.findIndex((v) => v.commit.message.startsWith('Release v'))
  let currentVersion
  try {
    currentVersion = await (await fetch('/version.txt')).text()
  } catch (error) {
    console.log(`[${Plugin.name}]`, '当前不是滚动发行版本')
  }
  const history = body.slice(0, releaseIndex).map((v) => ({
    message: v.commit.message,
    time: Plugins.formatRelativeTime(v.commit.committer.date),
    isCurrent: v.sha.slice(0, 7) === currentVersion
  }))
  let tip = ''
  if (!currentVersion) {
    tip = '\n\n注意：你当前使用的不是滚动发行版本，请执行本插件以获取上述更新特性。'
  }
  Plugins.alert('', '## 滚动发行日志\n\n' + history.map((v) => ` - ${v.isCurrent ? '`你的版本`' : ''}${v.message} 【${v.time}】`).join('\n') + tip, {
    type: 'markdown'
  })
}

/**
 * 右键菜单 - 版本统计
 */
const Statistics = async () => {
  const clientMap = {
    'GUI.for.Clash': 'https://api.github.com/repos/GUI-for-Cores/GUI.for.Clash/releases',
    'GUI.for.SingBox': 'https://api.github.com/repos/GUI-for-Cores/GUI.for.SingBox/releases'
  }
  const url = clientMap[Plugins.APP_TITLE]
  const { body } = await Plugins.HttpGet(url, {
    Authorization: Plugins.getGitHubApiAuthorization()
  })
  const { message } = body
  if (message) throw message
  const records = body
    .sort((a, b) => b.name.startsWith('v') - a.name.startsWith('rolling-release'))
    .map((r) => {
      const count = r.assets.reduce((p, c) => {
        if (c.name.includes('darwin')) {
          p.darwin = (p.darwin || 0) + c.download_count
        } else if (c.name.includes('windows')) {
          p.windows = (p.windows || 0) + c.download_count
        } else if (c.name.includes('linux')) {
          p.linux = (p.linux || 0) + c.download_count
        } else {
          p.other = (p.other || 0) + c.download_count
        }
        return p
      }, {})
      const size = r.assets.reduce((p, c) => p + c.size, 0)
      const name = r.name + (r.name === Plugins.APP_VERSION ? '`我的版本`' : '')
      const download = count.other ?? `${windows_icon} ${count.windows} / ${darwin_icon} ${count.darwin} / ${linux_icon} ${count.linux}`
      const fileSize = Plugins.formatBytes(size / r.assets.filter((v) => v.name.startsWith('GUI') || v.name.startsWith('rolling-')).length)
      const uploader = [...new Set(r.assets.map((asset) => asset.uploader.login))].join('、')
      const createTime = Plugins.formatRelativeTime(r.assets[0].updated_at)
      return `| ${name} | ${download} | ${fileSize} | ${uploader} | ${createTime} |`
    })
  const table = ['|版本名称|下载次数|文件大小|发布者|更新时间|', '|-|-|-|-|-|', records.join('\n')]
  await Plugins.alert('信息统计如下', table.join('\n'), { markdown: true })
}

const checkRollingReleaseEnabled = async () => {
  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.rollingRelease) {
    throw '请在【设置】中，开启【启用滚动发行】功能。'
  }
}

const checkLatestVersion = async () => {
  const GFC_URL = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.Clash/releases/latest'
  const GFS_URL = 'https://api.github.com/repos/GUI-for-Cores/GUI.for.SingBox/releases/latest'
  const url = Plugins.APP_TITLE.includes('Clash') ? GFC_URL : GFS_URL
  const { body } = await Plugins.HttpGet(url, {
    Authorization: Plugins.getGitHubApiAuthorization()
  })
  const { tag_name, message } = body
  if (message) throw message
  if (tag_name !== Plugins.APP_VERSION) {
    throw '无法跨大版本升级，请通过 设置 - 关于，更新APP！'
  }
}

const windows_icon = `<svg viewBox="0 0 1024 1024" width="12" height="12"><path d="M180.532703 507.367493c158.678976-65.355497 235.486292-30.474059 304.269865 16.21838l-79.440283 273.0447c-69.018933-46.431495-144.083559-84.635609-303.396985-18.776645l77.643358-270.088368L180.532703 507.367493zM526.399965 549.988196c68.989257 46.397726 139.539057 80.43903 301.656341 24.985044l-75.661214 263.243473c-159.14151 65.832358-235.541551 28.585035-304.439734-18.128893L526.399965 549.988196zM498.022661 474.363821c-41.512463-27.970028-86.198198-54.113455-149.667741-54.582129-41.86448-0.322341-91.709725 11.587919-155.011446 37.731346l78.410837-271.752264c159.198815-65.822125 235.701187-28.520567 304.673048 18.128893L498.022661 474.363821zM922.033677 249.996774c-158.988014 65.700351-235.394195 28.753881-304.214606-17.613146l-78.428234 271.986601c68.7672 46.62797 151.876036 84.896552 304.315914 16.685008L922.033677 249.996774z" fill="#000000"></path></svg>`
const darwin_icon = `<svg viewBox="0 0 1024 1024" width="12" height="12"><path d="M928.768 750.592c-1.536 4.096-21.504 74.24-70.656 145.92-43.008 62.464-87.04 124.928-156.672 125.952-68.608 1.024-90.624-40.96-168.96-40.96s-102.912 39.936-167.936 41.984c-67.072 2.56-118.784-68.096-161.792-130.048C115.2 767.488 47.616 534.528 138.24 378.88c44.544-77.824 124.928-127.488 211.968-129.024 65.536-1.024 128.512 44.544 168.448 44.544 40.96 0 116.736-55.296 196.608-47.104 33.28 1.536 126.976 13.824 186.88 101.376-4.608 3.072-111.616 66.56-110.592 195.072 1.024 155.136 135.68 206.336 137.216 206.848m-266.24-586.24c35.84-44.032 59.904-104.448 53.248-164.352-51.2 2.048-114.176 34.304-151.04 77.824-32.768 37.888-61.952 99.328-53.76 158.72 56.832 3.072 115.712-30.208 151.552-72.192" fill="#040000"></path></svg>`
const linux_icon = `<svg viewBox="0 0 1024 1024" width="12" height="12"><path d="M452.32912 234.848q-6.272 0.576-8.864 6.016t-4.864 5.44q-2.848 0.576-2.848-2.848 0-6.848 10.848-8.576l5.728 0zM502.05712 242.848q-2.272 0.576-6.56-3.712t-10.016-2.56q13.728-6.272 18.272 1.152 1.728 3.424-1.728 5.152zM301.48112 486.848q-2.272-0.576-3.424 1.728t-2.56 7.136-3.136 7.712-5.728 7.424q-4 5.728-0.576 6.848 2.272 0.576 7.136-4t7.136-10.272q0.576-1.728 1.152-4t1.152-3.424 0.864-2.56 0.288-2.272l0-1.728t-0.576-1.44-1.728-1.152zM790.05712 692q0-10.272-31.424-24 2.272-8.576 4.288-15.712t2.848-14.848 1.728-12.288 0.288-12.864-0.576-11.136-2.016-12.576-2.272-11.712-2.848-14.272-3.136-15.136q-5.728-27.424-26.848-58.848t-41.152-42.848q13.728 11.424 32.576 47.424 49.728 92.576 30.848 158.848-6.272 22.848-28.576 24-17.728 2.272-22.016-10.56t-4.576-47.712-6.56-61.152q-5.152-22.272-11.136-39.424t-11.136-26.016-8.864-14.016-7.424-8.576-4.288-4q-8-35.424-17.728-58.848t-16.864-32-13.44-18.848-8.576-22.848q-2.272-12 3.424-30.56t2.56-28.288-25.44-14.272q-8.576-1.728-25.44-10.272t-20.288-9.152q-4.576-0.576-6.272-14.848t4.576-29.152 20.576-15.424q21.152-1.728 29.152 17.152t2.272 33.152q-6.272 10.848-1.152 15.136t17.152 0.288q7.424-2.272 7.424-20.576l0-21.152q-2.848-17.152-7.712-28.576t-12-17.44-13.44-8.576-15.424-4.288q-61.152 4.576-50.848 76.576 0 8.576-0.576 8.576-5.152-5.152-16.864-6.016t-18.848 0.288-8.864-2.848q0.576-32.576-9.152-51.424t-25.728-19.424q-15.424-0.576-23.712 15.712t-9.44 34.016q-0.576 8.576 2.016 21.152t7.424 21.44 8.864 7.712q5.728-1.728 9.152-8 2.272-5.152-4-4.576-4 0-8.864-8.288t-5.44-19.136q-0.576-12.576 5.152-21.152t19.424-8q9.728 0 15.424 12t5.44 22.272-0.864 12.576q-12.576 8.576-17.728 16.576-4.576 6.848-15.712 13.44t-11.712 7.136q-7.424 8-8.864 15.424t4.288 10.272q8 4.576 14.272 11.136t9.152 10.848 10.56 7.424 20.288 3.712q26.848 1.152 58.272-8.576 1.152-0.576 13.152-4t19.712-6.016 16.864-7.424 12-10.016q5.152-8 11.424-4.576 2.848 1.728 3.712 4.864t-1.728 6.848-9.44 5.44q-11.424 3.424-32.288 12.288t-26.016 11.136q-25.152 10.848-40 13.152-14.272 2.848-45.152-1.152-5.728-1.152-5.152 1.152t9.728 10.848q14.272 13.152 38.272 12.576 9.728-0.576 20.576-4t20.576-8 19.136-10.016 17.152-9.728 14.016-6.848 10.016-1.44 4.864 6.272q0 1.152-0.576 2.56t-2.272 2.848-3.424 2.56-4.864 2.848-5.152 2.56-5.728 2.848-5.44 2.56q-16 8-38.56 25.152t-38.016 24.576-28 0.576q-12-6.272-36-41.728-12.576-17.728-14.272-12.576-0.576 1.728-0.576 5.728 0 14.272-8.576 32.288t-16.864 31.712-12 33.152 6.56 36q-13.152 3.424-35.712 51.424t-27.136 80.576q-1.152 10.272-0.864 39.424t-3.136 33.728q-4.576 13.728-16.576 1.728-18.272-17.728-20.576-53.728-1.152-16 2.272-32 2.272-10.848-0.576-10.272l-2.272 2.848q-20.576 37.152 5.728 94.848 2.848 6.848 14.272 16t13.728 11.424q11.424 13.152 59.424 51.712t53.152 43.712q9.152 8.576 10.016 21.728t-8 24.576-26.016 13.152q4.576 8.576 16.576 25.44t16 30.848 4 40.288q26.272-13.728 4-52.576-2.272-4.576-6.016-9.152t-5.44-6.848-1.152-3.424q1.728-2.848 7.424-5.44t11.424 1.44q26.272 29.728 94.848 20.576 76-8.576 101.152-49.728 13.152-21.728 19.424-17.152 6.848 3.424 5.728 29.728-0.576 14.272-13.152 52.576-5.152 13.152-3.424 21.44t13.728 8.864q1.728-10.848 8.288-44t7.712-51.424q1.152-12-3.712-42.016t-4.288-55.424 13.152-40.288q8.576-10.272 29.152-10.272 0.576-21.152 19.712-30.272t41.44-6.016 34.272 12.864zM431.20912 219.424q1.728-9.728-1.44-17.152t-6.56-8.576q-5.152-1.152-5.152 4 1.152 2.848 2.848 3.424 5.728 0 4 8.576-1.728 11.424 4.576 11.424 1.728 0 1.728-1.728zM670.63312 332q-1.152-4.576-3.712-6.56t-7.424-2.848-8.288-3.136q-2.848-1.728-5.44-4.576t-4-4.576-3.136-3.712-2.272-2.272-2.272 0.864q-8 9.152 4 24.864t22.272 18.016q5.152 0.576 8.288-4.576t2.016-11.424zM568.90512 210.272q0-6.272-2.848-11.136t-6.272-7.136-5.152-1.728q-8 0.576-4 4l2.272 1.152q8 2.272 10.272 17.728 0 1.728 4.576-1.152zM599.75312 77.152q0-1.152-1.44-2.848t-5.152-4-5.44-3.424q-8.576-8.576-13.728-8.576-5.152 0.576-6.56 4.288t-0.576 7.424-0.288 7.136q-0.576 2.272-3.424 6.016t-3.424 5.152 1.728 4.864q2.272 1.728 4.576 0t6.272-5.152 8.576-5.152q0.576-0.576 5.152-0.576t8.576-1.152 5.152-4zM922.63312 843.424q11.424 6.848 17.728 14.016t6.848 13.728-1.44 12.864-8.864 12.576-13.44 11.136-17.152 10.56-18.016 9.44-18.272 8.864-15.424 7.424q-21.728 10.848-48.864 32t-43.136 36.576q-9.728 9.152-38.848 11.136t-50.848-8.288q-10.272-5.152-16.864-13.44t-9.44-14.56-12.576-11.136-26.848-5.44q-25.152-0.576-74.272-0.576-10.848 0-32.576 0.864t-33.152 1.44q-25.152 0.576-45.44 8.576t-30.56 17.152-24.864 16.288-30.56 6.56q-16.576-0.576-63.424-17.728t-83.424-24.576q-10.848-2.272-29.152-5.44t-28.576-5.152-22.56-5.44-19.136-8.288-9.728-11.136q-5.728-13.152 4-38.016t10.272-31.136q0.576-9.152-2.272-22.848t-5.728-24.288-2.56-20.864 6.016-15.424q8-6.848 32.576-8t34.272-6.848q17.152-10.272 24-20t6.848-29.152q12 41.728-18.272 60.576-18.272 11.424-47.424 8.576-19.424-1.728-24.576 5.728-7.424 8.576 2.848 32.576 1.152 3.424 4.576 10.272t4.864 10.272 2.56 9.728 0.576 12.576q0 8.576-9.728 28t-8 27.424q1.728 9.728 21.152 14.848 11.424 3.424 48.288 10.56t56.864 11.712q13.728 3.424 42.272 12.576t47.136 13.152 31.712 2.272q24.576-3.424 36.864-16t13.152-27.424-4.288-33.44-10.848-29.728-11.424-20.864q-69.152-108.576-96.576-138.272-38.848-42.272-64.576-22.848-6.272 5.152-8.576-8.576-1.728-9.152-1.152-21.728 0.576-16.576 5.728-29.728t13.728-26.848 12.576-24q4.576-12 15.136-41.152t16.864-44.576 17.152-34.848 22.272-30.848q62.848-81.728 70.848-111.424-6.848-64-9.152-177.152-1.152-51.424 13.728-86.56t60.576-59.712q22.272-12 59.424-12 30.272-0.576 60.576 7.712t50.848 23.712q32.576 24 52.288 69.44t16.864 84.288q-2.848 54.272 17.152 122.272 19.424 64.576 76 124.576 31.424 33.728 56.864 93.152t34.016 109.152q4.576 28 2.848 48.288t-6.848 31.712-11.424 12.576q-5.728 1.152-13.44 10.848t-15.424 20.288-23.136 19.136-34.848 8q-10.272-0.576-18.016-2.848t-12.864-7.712-7.712-8.864-6.56-11.712-5.152-11.136q-12.576-21.152-23.424-17.152t-16 28 4 55.424q11.424 40 0.576 111.424-5.728 37.152 10.272 57.44t41.728 18.848 48.576-20.288q33.728-28 51.136-38.016t59.136-24.288q30.272-10.272 44-20.864t10.56-19.712-14.272-16.288-29.44-13.44q-18.848-6.272-28.288-27.424t-8.576-41.44 8.864-27.136q0.576 17.728 4.576 32.288t8.288 23.136 11.712 16.288 12 10.848 12.288 7.424 9.44 5.44z" fill="#000000"></path></svg>`
