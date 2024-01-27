const envStore = Plugins.useEnvStore()

const path = (envStore.env.basePath + "\\" + envStore.env.appName).replaceAll("\\", "\\\\")

const file = 'data/.cache/register_clash_protocol.reg'

const onInstall = async () => {
    const reg = `Windows Registry Editor Version 5.00
[HKEY_CLASSES_ROOT\\clash]
"URL Protocol"="${path}"
@="${envStore.env.appName}"
[HKEY_CLASSES_ROOT\\clash\\DefaultIcon]
@="${path},1"
[HKEY_CLASSES_ROOT\\clash\\shell]
[HKEY_CLASSES_ROOT\\clash\\shell\\open]
[HKEY_CLASSES_ROOT\\clash\\shell\\open\\command]
@="\\"${path}\\" \\"%1\\""`

    await Plugins.Writefile(file, reg)
    await Plugins.Exec('reg', ['import', file])
    Plugins.message.info('注册完成')
}

const onUninstall = async () => {
    await Plugins.Exec('reg', ['delete', `HKEY_CLASSES_ROOT\\clash`, '/f'])
    Plugins.message.info('卸载完成')
}
