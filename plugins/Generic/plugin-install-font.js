/**
 * 本插件使用项目：https://github.com/mozilla/twemoji-colr
 */

const InstallFont = async () => {
  const { id } = Plugins.message.info('正在下载字体...', 5 * 60 * 1000)
  const tmpFile = await Plugins.AbsolutePath('data/.cache/Twemoji.Mozilla.ttf')
  const batFile = 'data/.cache/installFont.bat'
  try {
    await Plugins.Download('https://github.com/mozilla/twemoji-colr/releases/download/v0.7.0/Twemoji.Mozilla.ttf', tmpFile, {}, (c, t) => {
      Plugins.message.update(id, '正在下载字体...' + ((c / t) * 100).toFixed(2) + '%')
    })
    Plugins.message.update(id, '下载字体完成', 'success')
  } catch (err) {
    console.log(err)
    Plugins.message.update(id, '下载字体失败', 'error')
    throw '下载字体失败'
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }

  const { id: id2 } = Plugins.message.info('正在安装字体', 5 * 60 * 1000)
  try {
    await Plugins.Writefile(
      batFile,
      `set "zt=${tmpFile}"\nmshta "javascript:new ActiveXObject('Shell.Application').NameSpace(20).CopyHere('%zt:\\=\\\\%',0x0010);close()"`
    )
    await Plugins.Exec(batFile)
    await Plugins.Removefile(batFile)
    await Plugins.Removefile(tmpFile)
    Plugins.message.update(id2, '安装字体成功，请重启APP', 'success')
  } catch (err) {
    console.log(err)
    Plugins.message.update(id2, '安装字体失败', 'error')
    throw '安装字体失败'
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id2)
  }
}

const onInstall = async () => {
  await InstallFont()
}

const onUninstall = async () => {
  Plugins.message.info('暂未支持卸载字体，请手动卸载')
}
