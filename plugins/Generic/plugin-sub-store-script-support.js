const PATH = 'data/third/sub-store-script-support'

/* Trigger on::manual */
const onRun = async () => {
  if (await isRunning()) {
    throw '该服务已经在运行了'
  }
  await startService()
  return 1
}

/* Trigger Install */
const onInstall = async () => {
  await Plugins.Makedir(PATH)
  // TODO: 下载对应平台的clash内核
  await Plugins.Copyfile('data/mihomo/mihomo-windows-amd64.exe', PATH + '/meta.exe')
  return 0
}

/* Trigger Uninstall */
const onUninstall = async () => {
  if (await isRunning()) {
    throw '请先停止该服务'
  }
  await Plugins.Removefile(PATH)
  return 0
}

const onReady = async () => {
  if (Plugin.AutoStart) {
    await startService()
    return 1
  }
  if (await isRunning()) {
    await stopService()
    await startService()
    return 1
  }
  return 2
}

const Start = async () => {
  if (await isRunning()) {
    throw '该服务已经在运行了'
  }
  await startService()
  return 1
}

const Stop = async () => {
  await stopService()
  return 2
}

const startService = async () => {
  let meta_pid = 0

  const ABS_PATH = await Plugins.AbsolutePath(PATH)

  await Plugins.StartServer('127.0.0.1:9876', Plugin.id, async (req, res) => {
    console.log(`[${Plugin.name}]`, req)

    if (req.url === '/stop') {
      await Plugins.KillProcess(meta_pid)
      return res.end(200, {}, 'stopped')
    }

    if (req.url === '/start') {
      const body = JSON.parse(Plugins.base64Decode(req.body))
      const ports = await getAvailablePorts(body.proxies.length)
      const config = {
        port: 9092,
        'allow-lan': false,
        'log-level': 'info',
        ipv6: true,
        profile: {
          'store-selected': false,
          'store-fake-ip': false
        },
        dns: {
          enable: true,
          ipv6: true,
          'enhanced-mode': 'fake-ip',
          'fake-ip-range': '28.0.0.1/8',
          nameserver: ['https://223.5.5.5/dns-query']
        },
        rules: ['MATCH,proxy'],
        proxies: body.proxies,
        'proxy-groups': [
          {
            name: 'proxy',
            type: 'select',
            proxies: body.proxies.map((v) => v.name)
          }
        ],
        listeners: body.proxies.map((p, index) => {
          return {
            name: `listener-${p.name}`,
            type: 'mixed',
            port: ports[index],
            listen: '127.0.0.1',
            proxy: p.name,
            udp: true
          }
        })
      }

      await Plugins.Writefile(PATH + '/config.yaml', Plugins.YAML.stringify(config))

      meta_pid = await Plugins.ExecBackground(
        PATH + '/meta.exe',
        ['-d', ABS_PATH, '-f', ABS_PATH + '/config.yaml'],
        async (out) => {
          // console.log(`meta: `, out)
        },
        async () => {
          // console.log(`meta: `, 'end')
        }
      )
      return res.end(
        200,
        { 'Content-Type': 'application/json' },
        JSON.stringify({
          ports,
          pid: meta_pid
        })
      )
    }
    res.end(200, { 'Content-Type': 'application/json' }, 'Server is running...')
  })
}

const stopService = async () => {
  await Plugins.StopServer(Plugin.id)
}

const isRunning = async () => {
  return (await Plugins.ListServer()).includes(Plugin.id)
}

const getAvailablePorts = async (count) => {
  const out = await Plugins.Exec('netstat', ['-n'], { convert: true })

  const regex = /(?:[\d\.]+):(\d+)/g
  const occupiedPorts = new Set()
  let match

  while ((match = regex.exec(out)) !== null) {
    occupiedPorts.add(parseInt(match[1], 10))
  }

  const availablePorts = []
  const minPort = 1024
  const maxPort = 65535

  for (let port = minPort; port <= maxPort && availablePorts.length < count; port++) {
    if (!occupiedPorts.has(port)) {
      availablePorts.push(port)
    }
  }

  return availablePorts
}
