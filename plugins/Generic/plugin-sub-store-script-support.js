const PATH = 'data/third/sub-store-script-support'

/* Trigger on::manual */
const onRun = async () => {
  if ((await Plugins.ListServer()).includes(Plugin.id)) return
  await startService()
}

/* Trigger Install */
const onInstall = async () => {
  await Plugins.Makedir(PATH)
  await Plugins.Copyfile('data/mihomo/mihomo-windows-amd64.exe', PATH + '/meta.exe')
  return 0
}

/* Trigger Uninstall */
const onUninstall = async () => {
  await Plugins.Removefile(PATH)
  return 0
}

const Start = async () => {
  if ((await Plugins.ListServer()).includes(Plugin.id)) return
  await startService()
}

const Stop = async () => {
  await Plugins.StopServer(Plugin.id)
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
      const config = {
        'bind-address': '127.0.0.1',
        port: 9092,
        'external-controller': '127.0.0.1:54342',
        'allow-lan': false,
        'log-level': 'info',
        ipv6: true,
        profile: {
          'store-selected': false,
          'store-fake-ip': false
        },
        dns: {
          enable: true,
          'prefer-h3': false,
          ipv6: true,
          'use-hosts': true,
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
        ]
      }

      await Plugins.Writefile(PATH + '/config.yaml', Plugins.YAML.stringify(config))

      meta_pid = await Plugins.ExecBackground(
        PATH + '/meta.exe',
        ['-d', ABS_PATH, '-f', ABS_PATH + '/config.yaml'],
        async (out) => {
          console.log(`meta: `, out)
        },
        async () => {
          console.log(`meta: `, 'end')
        }
      )
      return res.end(
        200,
        { 'Content-Type': 'application/json' },
        JSON.stringify({
          // TODO: 所有请求目前都只使用第一个代理，这是不对的，但是SubStore的脚本发出测试请求的间隙没有机会调用clash的RestfulApi来切换节点，得想个优雅的法子:)
          ports: new Array(body.proxies.length).fill(9092),
          pid: meta_pid
        })
      )
    }
    res.end(200, { 'Content-Type': 'application/json' }, 'Server is running...')
  })
}
