/* 触发器 手动触发 */
const onRun = async () => {
  const envStore = Plugins.useEnvStore()
  const { os } = envStore.env

  const common = ['常见问题：', ' - 没有网络：请更换tun堆栈', ' - 出现ssl错误：请手动设置系统dns为223.5.5.5或8.8.8.8']

  if (os === 'windows') {
    const arr = ['1、请转至设置，开启已管理员身份运行', '2、退出程序，重新打开（不要使用重启）', '3、修改配置，开启TUN模式', '4、启动内核\n'].concat(common)
    await Plugins.alert(Plugin.name, arr.join('\n'))
    return
  }

  const stable = await getKernelFilePath()
  const alpha = await getKernelFilePath(true)

  if (os === 'linux') {
    const arr = [
      '1、复制下列命令',
      '',
      `sudo setcap cap_net_bind_service,cap_net_admin,cap_dac_override=+ep ${stable}`,
      `sudo setcap cap_net_bind_service,cap_net_admin,cap_dac_override=+ep ${alpha}`,
      '',
      '2、打开终端并执行上面命令',
      '3、修改配置，开启TUN模式',
      '4、启动内核\n'
    ].concat(common)
    await Plugins.alert(Plugin.name, arr.join('\n'))
    return
  }

  if (os === 'darwin') {
    const arr = [
      '1、复制下列命令',
      '',
      `osascript -e 'do shell script "chown root:admin ${stable}\nchmod +sx ${stable}" with administrator privileges'`,
      `osascript -e 'do shell script "chown root:admin ${alpha}\nchmod +sx ${alpha}" with administrator privileges'`,
      '',
      '2、打开终端并执行上面命令',
      '3、修改配置，开启TUN模式',
      '4、启动内核\n'
    ].concat(common)
    await Plugins.alert(Plugin.name, arr.join('\n'))
  }
}

async function getKernelFilePath(isAlpha = false) {
  const envStore = Plugins.useEnvStore()
  const { os, arch, x64Level } = envStore.env
  const fileSuffix = { windows: '.exe', linux: '', darwin: '' }[os]

  // GFC
  if (Plugins.APP_TITLE.includes('Clash')) {
    const alpha = isAlpha ? '-alpha' : ''
    const amd64Compatible = arch === 'amd64' && x64Level < 3 ? '-compatible' : ''
    return await Plugins.AbsolutePath(`data/mihomo/mihomo-${os}-${arch}${amd64Compatible}${alpha}${fileSuffix}`)
  }

  // GFS
  const latest = isAlpha ? '-latest' : ''
  return await Plugins.AbsolutePath(`data/sing-box/sing-box${latest}${fileSuffix}`)
}
