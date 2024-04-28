const onInstall = async () => {
  const envStore = Plugins.useEnvStore()
  const path = (envStore.env.basePath + '\\' + envStore.env.appName).replaceAll('\\', '\\\\')
  const file = 'data/.cache/register_singbox_protocol.reg'

  const reg = `Windows Registry Editor Version 5.00
[HKEY_CLASSES_ROOT\\sing-box]
"URL Protocol"="${path}"
@="${envStore.env.appName}"
[HKEY_CLASSES_ROOT\\sing-box\\DefaultIcon]
@="${path},1"
[HKEY_CLASSES_ROOT\\sing-box\\shell]
[HKEY_CLASSES_ROOT\\sing-box\\shell\\open]
[HKEY_CLASSES_ROOT\\sing-box\\shell\\open\\command]
@="\\"${path}\\" \\"%1\\""`

  await Plugins.Writefile(file, reg)
  await Plugins.Exec('reg', ['import', file])
  Plugins.message.success('注册完成')
}

const onUninstall = async () => {
  await Plugins.Exec('reg', ['delete', `HKEY_CLASSES_ROOT\\sing-box`, '/f'])
  Plugins.message.success('卸载完成')
}
