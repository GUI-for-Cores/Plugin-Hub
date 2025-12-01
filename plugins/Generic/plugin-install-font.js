/**
 * 本插件使用项目：https://github.com/mozilla/twemoji-colr
 */

const SRC_URL = 'https://github.com/mozilla/twemoji-colr/releases/download/v0.7.0/Twemoji.Mozilla.ttf'
const DST_FILE = 'C:/WINDOWS/Fonts/Twemoji.Mozilla.ttf'
const TMP_FILE = 'data/.cache/Twemoji.Mozilla.ttf'

/* 触发器 手动触发 */
const onRun = async () => {
  const envStore = Plugins.useEnvStore()

  if (envStore.env.os !== 'windows') {
    throw '不支持非Windows系统'
  }

  const exists = await Plugins.FileExists(DST_FILE)
  if (!exists) {
    await installFont()
    if (await Plugins.confirm('提示', '是否立即重启客户端，以便字体生效？')) {
      await Plugins.RestartApp()
    }
    return
  }

  if (await Plugins.confirm('提示', '检测到本字体已安装，是否卸载？')) {
    await uninstallFont()
  }
}

const installFont = async () => {
  let downloadOK = true
  if (!(await Plugins.FileExists(TMP_FILE))) {
    const { update, success, error, destroy } = Plugins.message.info('正在下载字体...', 5 * 60 * 1000)
    try {
      await Plugins.Download(SRC_URL, TMP_FILE, {}, (c, t) => {
        update('正在下载字体...' + ((c / t) * 100).toFixed(2) + '%')
      })
      success('下载完成')
    } catch (e) {
      console.log(`[${Plugin.name}]`, e)
      error(e.message || e)
      downloadOK = false
    } finally {
      await Plugins.sleep(1000)
      destroy()
    }
  }

  if (!downloadOK) return

  await Plugins.CopyFile(TMP_FILE, DST_FILE)
  await Plugins.Exec('reg', [
    'add',
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',
    '/v',
    'Twemoji.Mozilla.ttf',
    '/t',
    'REG_SZ',
    '/d',
    'Twemoji.Mozilla.ttf',
    '/f'
  ])
  Plugins.message.success('安装完成')
}

const uninstallFont = async () => {
  let uninstallOK = true
  await Plugins.RemoveFile(DST_FILE).catch((e) => {
    uninstallOK = false
    if (e.includes('The process cannot access the file because it is being used by another process.')) {
      Plugins.alert('提示', '请退出本程序，使用系统字体管理程序进行卸载。')
    }
  })

  if (!uninstallOK) return

  await Plugins.Exec('reg', ['delete', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', '/v', 'Twemoji.Mozilla.ttf', '/f'])
  Plugins.message.success('卸载完成')
}
