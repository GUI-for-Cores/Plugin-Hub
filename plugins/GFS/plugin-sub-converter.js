/**
 * 本插件使用项目：https://github.com/GUI-for-Cores/sing-box-subconverter-offline
 */

const CONVERTER_PATH = 'data/third/subconverter'
const CONVERTER_FILE = CONVERTER_PATH + '/sing-box-subconverter.exe'

const onSubscribe = async (proxies, metadata) => {
  if (proxies.some((proxy) => proxy.name && !proxy.tag)) {
    const tmp = await Plugins.AbsolutePath(`data/.cache/conveter_${metadata.id}.yaml`)

    await Plugins.Writefile(tmp, Plugins.YAML.stringify({ proxies }))
    await Plugins.Exec(CONVERTER_FILE, ['--path', tmp, '--out', tmp])

    const str = await Plugins.Readfile(tmp)
    proxies = JSON.parse(str)

    await Plugins.Removefile(tmp)
  }

  return proxies
}

const onInstall = async () => {
  const { env } = Plugins.useEnvStore()

  const { id } = Plugins.message.info('安装中...', 10 * 60 * 1_000)

  await Plugins.Download(
    `https://github.com/GUI-for-Cores/sing-box-subconverter-offline/releases/download/v1.1.6/sing-box-subconverter-windows-${env.arch}.exe`,
    CONVERTER_FILE,
    {},
    (progress, total) => {
      Plugins.message.update(id, '安装中...' + ((progress / total) * 100).toFixed(2) + '%')
    }
  ).finally(() => {
    Plugins.message.destroy(id)
  })

  Plugins.message.success('安装完成')
}

const onUninstall = async () => {
  await Plugins.Removefile(CONVERTER_PATH)
  Plugins.message.success('卸载完成')
}
