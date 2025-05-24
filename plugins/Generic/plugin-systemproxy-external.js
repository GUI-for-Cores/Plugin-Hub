const onRun = async () => {
  await checkOS()
  const action = await Plugins.picker.single(Plugin.name, [
    { label: '设置代理', value: 'Set' },
    { label: '清除代理', value: 'Clear' }
  ])
  const handler = { Set, Clear }[action]
  await handler()
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  try {
    await checkOS()
  } catch (error) {
    return
  }
  const appStore = Plugins.useAppStore()
  appStore.addCustomActions('core_state', {
    component: 'Switch',
    componentSlots: {
      default: '外接网卡系统代理'
    },
    componentProps: {
      onChange: async (val) => {
        ;(val ? Set() : Clear()).catch((err) => {
          Plugins.message.error(err)
        })
      }
    }
  })
}

/**
 * 右键 - 设置代理
 */
const Set = async () => {
  await checkOS()
  await setSystemProxy()
  Plugins.message.success('设置成功')
}

/**
 * 右键 - 清除代理
 */
const Clear = async () => {
  await checkOS()
  await setDarwinSystemProxy('', false)
  Plugins.message.success('清除成功')
}

const checkOS = async () => {
  const { env } = Plugins.useEnvStore()
  if (env.os !== 'darwin') throw '不支持非macOS系统'
}

const setSystemProxy = async () => {
  const kernelApiStore = Plugins.useKernelApiStore()

  let port = 0
  let proxyType = 0 // 0: Mixed    1: Http    2: Socks
  const { port: _port, 'socks-port': socksPort, 'mixed-port': mixedPort } = kernelApiStore.config

  if (mixedPort) {
    port = mixedPort
    proxyType = 0
  } else if (_port) {
    port = _port
    proxyType = 1
  } else if (socksPort) {
    port = socksPort
    proxyType = 2
  }

  if (!port) throw '需要启动内核，并设置一个可用的端口'

  await setDarwinSystemProxy('127.0.0.1:' + port, true, proxyType)
}

async function setDarwinSystemProxy(server, enabled, proxyType) {
  function _set(device) {
    const state = enabled ? 'on' : 'off'

    const httpState = [0, 1].includes(proxyType) ? state : 'off'
    const socksState = [0, 2].includes(proxyType) ? state : 'off'

    Plugins.ignoredError(Plugins.Exec, 'networksetup', ['-setwebproxystate', device, httpState])
    Plugins.ignoredError(Plugins.Exec, 'networksetup', ['-setsecurewebproxystate', device, httpState])
    Plugins.ignoredError(Plugins.Exec, 'networksetup', ['-setsocksfirewallproxystate', device, socksState])

    const [serverName, serverPort] = server.split(':')

    if (httpState === 'on') {
      Plugins.ignoredError(Plugins.Exec, 'networksetup', ['-setwebproxy', device, serverName, serverPort])
      Plugins.ignoredError(Plugins.Exec, 'networksetup', ['-setsecurewebproxy', device, serverName, serverPort])
    }
    if (socksState === 'on') {
      Plugins.ignoredError(Plugins.Exec, 'networksetup', ['-setsocksfirewallproxy', device, serverName, serverPort])
    }
  }

  const ports = await getPorts()
  ports.forEach((port) => {
    if (port.startsWith('Thunderbolt Ethernet')) {
      _set(port)
    }
  })
}

const getPorts = async () => {
  const output = await Plugins.Exec('networksetup', ['-listallhardwareports'])
  const regex = /Hardware Port:\s*(.+)/g
  let match
  const ports = []
  while ((match = regex.exec(output)) !== null) {
    ports.push(match[1].trim())
  }
  return ports
}
