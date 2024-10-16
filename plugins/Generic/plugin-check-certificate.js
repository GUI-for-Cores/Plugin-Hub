/**
 * 本插件使用微软工具：https://learn.microsoft.com/en-us/sysinternals/downloads/sigcheck
 */
const DOWNLOAD_URL = 'https://download.sysinternals.com/files/Sigcheck.zip'
const PATH = 'data/third/check-my-certificate'

/* 触发器 手动触发 */
const onRun = async () => {
  await checkOS()
  const output = await Plugins.Exec(PATH + '/sigcheck.exe', ['-nobanner', '-accepteula', '-tuv', '-c'])
  if (output.includes('No certificates found')) {
    const img = await Plugins.Readfile('data/.cache/imgs/notify_success.png', { Mode: 'Binary' })
    // prettier-ignore
    await Plugins.alert(Plugin.name, `<center>
      <img src="data:image/png;base64,${img}">
      恭喜，未发现不安全的证书！
    </center>`, {type: 'markdown'})
    return
  }

  const lines = output.trim().replaceAll('"', '').split('\n').slice(3)
  const list = lines.map((line) => {
    const [Store, Subject, Status, ValidUsage, Issuer, SerialNumber, Thumbprint, Algorithm, ValidFrom, ValidTo] = line.split(',')
    return { Store, Subject, Status, ValidUsage, Issuer, SerialNumber, Thumbprint, Algorithm, ValidFrom, ValidTo }
  })
  const img = await Plugins.Readfile('data/.cache/imgs/notify_error.png', { Mode: 'Binary' })
  // prettier-ignore
  await Plugins.alert(Plugin.name, `<center>
  <img src="data:image/png;base64,${img}">
  糟糕，发现 ${list.length} 个未经验证的有效证书！
  </center>

  > 不必过于担心，但是建议进一步验证证书是否有害！
  
  | 证书颁发者 | 状态 | 有效期 |
  | --- | - | ---- |
  ${list.map(v => `|${v.Issuer}|${v.Status}|${v.ValidTo}|`).join('\n')}
  `, {type: 'markdown'})
}

/* 触发器 安装 */
const onInstall = async () => {
  await checkOS()
  const { update, success, destroy, error } = Plugins.message.info('正在下载...', 1200 * 1000)
  try {
    const TMP_FILE = 'data/.cache/Sigcheck.zip'
    await Plugins.Download(DOWNLOAD_URL, TMP_FILE, {}, (progress, total) => {
      update('下载中...' + ((progress / total) * 100).toFixed(2) + '%')
    })
    update('正在解压...')
    await Plugins.UnzipZIPFile(TMP_FILE, PATH)
    await Plugins.Removefile(TMP_FILE)
    success('安装成功')
  } catch (err) {
    error('下载失败：' + (err.message || err))
  } finally {
    await Plugins.sleep(1000)
    destroy()
  }
  return 0
}

/* 触发器 卸载 */
const onUninstall = async () => {
  await checkOS()
  await Plugins.Removefile(PATH)
  return 0
}

const checkOS = async () => {
  const { env } = Plugins.useEnvStore()
  if (env.os !== 'windows') {
    throw '暂未支持非 Windows 系统'
  }
}
