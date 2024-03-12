const adb = Plugin.AdbPath || (Plugin.EnableDownloadAdb ? 'data/third/platform-tools/adb.exe' : 'adb')

if (Plugin.EnableDownloadAdb && !(await Plugins.FileExists('data/third/platform-tools/adb.exe'))) {
  console.log('已开启自动下载ADB模式，且当前未下载adb')
  let id
  try {
    if (!(await Plugins.FileExists('data/.cache/adb.zip'))) {
      console.log('未检测到adb缓存，将重新下载')
      id = Plugins.message.info('您已开启自动下载ADB工具，正在下载ADB工具', 200000).id
      await Plugins.Download('https://dl.google.com/android/repository/platform-tools-latest-windows.zip', 'data/.cache/adb.zip', (p, t) => {
        Plugins.message.update(id, '您已开启自动下载ADB工具，正在下载ADB工具：' + ((p / t) * 100).toFixed(1) + '%')
      })
    }
    console.log('下载完成，解压到 data/third/platform-tools 目录')
    Plugins.message.update(id, '下载成功，正在解压到 data/third/platform-tools 目录')
    await Plugins.UnzipZIPFile('data/.cache/adb.zip', 'data/third')
    Plugins.message.update(id, '解压成功')
  } finally {
    await Plugins.sleep(500)
    Plugins.message.destroy(id)
  }
}

const killAdbServer = () => Plugins.Exec(adb, ['kill-server'])

const getDevices = async () => {
  const res = await Plugins.Exec(adb, ['devices'], !true)
  return res
    .trim()
    .split('\n')
    .slice(1)
    .map((v) => v.replace('\tdevice', ''))
}

const sendText = async (text) => {
  const res = await Plugins.Exec(adb, ['shell', 'input', 'text', text], !true)
  console.log(res)
}

const viewApp = async () => {
  const res = await Plugins.Exec(adb, ['shell', 'pm', 'list', 'packages'], !true)
  return res.trim().split('\n')
}

const viewApp3 = async () => {
  const res = await Plugins.Exec(adb, ['shell', 'pm', 'list', 'packages', '-3'], !true)
  return res.trim().split('\n')
}

// 连接到设备
const connectDevice = async (address) => {
  if (!address) throw '请提供设备的IP，例如：192.168.0.100:5037'
  for (let i = 0; i < 3; i++) {
    try {
      const res = await Plugins.Exec(adb, ['connect', address], true)
      if (res.includes('connected to') || res.includes('already connected')) {
        console.log('连接到设备成功：', address)
        return
      } else {
        console.log('第' + (i + 1) + '次连接到设备失败：', address)
      }
    } catch (error) {
      console.log('执行连接命令失败：', error)
    }
  }
  throw '连接到设备失败'
}

// 断开设备
const disconnectDevice = async (address) => {
  const res = await Plugins.Exec(adb, ['disconnect', address], true)
  if (!res.includes('disconnected') && !res.includes('no such device')) throw '断开连接失败'
}

let currentDevice // 已连接的设备

const onRun = async () => {
  const actions = [
    { label: currentDevice ? '1、断开当前设备' : '1、连接到设备', value: 'connectDevice' },
    { label: '2、查看设备列表', value: 'getDevices' },
    { label: '3、关闭ADB服务并退出', value: 'exit' }
  ]

  if (currentDevice) {
    actions.push({ label: '4、远程输入文字', value: 'handleInput' })
    actions.push({ label: '5、查看第三方APP列表', value: 'viewApp3' })
    actions.push({ label: '6、查看所有APP列表', value: 'viewApp' })
    actions.push({ label: '7、重启设备', value: 'reboot' })
  }

  const action = await Plugins.picker.single(`请选择对${currentDevice || ''}设备的操作`, actions)

  // 退出交互式循环
  if (action == 'exit') {
    await killAdbServer()
    return
  }

  if (action == 'viewApp3') {
    const list = await viewApp3()
    await Plugins.picker.single(
      'APP列表如下：',
      list.map((v) => ({ label: v, value: v }))
    )
    return
  }

  if (action == 'viewApp') {
    const list = await viewApp()
    await Plugins.picker.single(
      'APP列表如下：',
      list.map((v) => ({ label: v, value: v }))
    )
    return
  }

  // 连接/断开设备
  if (action == 'connectDevice') {
    let add = currentDevice
    if (add) {
      try {
        await disconnectDevice(add)
        currentDevice = null
        Plugins.message.success('断开连接成功: ' + add)
      } catch (error) {
        Plugins.message.success('断开连接失败: ' + add)
      }
    } else {
      add = Plugin.DeviceAddress
      if (!add) {
        add = await Plugins.prompt('请输入要调试的设备IP及端口号', '', { placeholder: '例如：192.168.0.100:5037' })
      }
      try {
        await connectDevice(add)
        currentDevice = add
        Plugins.message.success('连接成功: ' + add)
      } catch (error) {
        Plugins.message.success('连接失败: ' + add)
      }
    }
  }

  if (action == 'getDevices') {
    const list = await getDevices()
    if (list.length === 0) {
      await Plugins.alert('当前无设备', '请使用USB连接电脑，并开启电视盒子的开发者模式和USB调试模式！')
    } else {
      const add = await Plugins.picker.single(
        '请选择一个设备开始调试',
        list.map((v) => ({ label: v, value: v })),
        [currentDevice]
      )
      if (add !== currentDevice) {
        try {
          await connectDevice(add)
          currentDevice = add
          Plugins.message.success('连接成功: ' + add)
        } catch (error) {
          Plugins.message.success('连接失败: ' + add)
        }
      }
    }
  }

  if (action == 'handleInput') {
    const text = await Plugins.prompt('请输入，请确保电视正处于输入状态哦')
    await Plugins.sleep(3000)
    await sendText(text)
  }

  await onRun()
}
