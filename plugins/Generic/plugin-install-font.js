const url = 'https://github.com/mozilla/twemoji-colr/releases/download/v0.7.0/Twemoji.Mozilla.ttf'
const cache = 'C:\\Windows\\Temp\\Twemoji.Mozilla.ttf'
const savePath = 'C:\\Windows\\Fonts\\Twemoji.Mozilla.ttf'

const DownloadFont = async () => {
    const exist = await Plugins.FileExists(cache)
    if (!exist) {
        const { id } = Plugins.message.info('正在下载字体...', 5 * 60 * 1000)
        try {
            await Plugins.Download(url, cache)
            Plugins.message.update(id, '下载字体完成')
            await Plugins.sleep(1000)
        } catch (err) {
            console.log(err)
            Plugins.message.update(id, '下载字体失败')
            Plugins.message.info(err.message || err)
        } finally {
            Plugins.message.destroy(id)
        }
    }
}

const InstallFont = async () => {
    const exist = await Plugins.FileExists(savePath)
    if (!exist) {
        const { id } = Plugins.message.info('正在安装字体', 5 * 60 * 1000)
        try {
            const script = `
set "zt=${cache}"
mshta "javascript:new ActiveXObject('Shell.Application').NameSpace(20).CopyHere('%zt:\\=\\\\%',0x0010);close()"
`
            await Plugins.Writefile('data/.cache/installFont.bat', script)
            await Plugins.Exec('data/.cache/installFont.bat')
            await Plugins.Removefile('data/.cache/installFont.bat')
            Plugins.message.update(id, '安装字体成功，请重启APP')
            await Plugins.sleep(1000)
        } catch (err) {
            console.log(err)
            Plugins.message.update('安装字体失败')
            Plugins.message.info(err.message || err)
        } finally {
            Plugins.message.destroy(id)
        }
    }
}

const UninstallFont = async () => {
    const { id } = Plugins.message.info('正在卸载字体', 5 * 60 * 1000)
    try {
        await Plugins.Removefile(savePath)
        Plugins.message.update(id, '卸载字体成功，请重启APP')
    } catch (err) {
        console.log(err)
        Plugins.message.update('卸载字体失败')
        Plugins.message.info(err.message || err)
    } finally {
        Plugins.message.destroy(id)
    }
}

const onInstall = async () => {
    if (!await Plugins.CheckPermissions()) {
        throw '需要管理员权限'
    }
    await DownloadFont()
    await InstallFont()
}

const onUninstall = async () => {
    // await UninstallFont()
    throw '暂未支持卸载字体，请手动卸载'
}