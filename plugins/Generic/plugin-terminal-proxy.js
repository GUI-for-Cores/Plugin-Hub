// 保存插件状态
window[Plugin.id] = window[Plugin.id] || {}

const getProxyServer = async () => {
  const kernelApiStore = Plugins.useKernelApiStore()
  if (!kernelApiStore.running) throw '请先启动内核程序'

  const kernelStore = Plugins.useKernelApiStore()

  let isHttp = true
  let port = kernelStore.config['mixed-port'] || kernelStore.config['port']

  if (!port) {
    isHttp = false
    port = kernelStore.config['socks-port']
  }

  if (!port) throw '请先开启一个代理端口'

  const server = (isHttp ? 'http://127.0.0.1:' : 'socks5://127.0.0.1:') + port
  return server
}

const onRun = async () => {
  const { env } = Plugins.useEnvStore()

  const options = [
    { label: '✨ 命令提示符（仅复制命令）', value: 'cmd::copy', os: ['windows'] },
    { label: '✨ PowerShell（仅复制命令）', value: 'powershell::copy', os: ['windows'] },
    {
      label: '✨ Bash（仅复制命令）',
      value: 'terminal::copy',
      os: ['windows']
    },
    {
      label: '✨ Terminal（仅复制命令）',
      value: 'terminal::copy',
      os: ['linux', 'darwin']
    },
    {
      label: '🪄 设置全局终端代理（修改用户环境变量）',
      value: 'env::set::user',
      os: ['windows']
    },
    {
      label: '🔨 清除全局终端代理（修改用户环境变量）',
      value: 'env::clear::user',
      os: ['windows']
    }
  ]

  if (Plugin.enableEnhance && ['windows'].includes(env.os)) {
    options.push(
      ...[
        {
          label: '*****************高级选项*****************',
          value: '---',
          os: ['windows']
        },
        {
          label: '🪛 清除全局终端代理（删除用户环境变量）',
          value: 'env::clear::reg::user',
          os: ['windows']
        },
        {
          label: '🪄 设置全局终端代理（修改系统环境变量）',
          value: 'env::set::system',
          os: ['windows']
        },
        {
          label: '🔨 清除全局终端代理（修改系统环境变量）',
          value: 'env::clear::system',
          os: ['windows']
        },
        {
          label: '🪛 清除全局终端代理（删除系统环境变量）',
          value: 'env::clear::reg::system',
          os: ['windows']
        }
      ]
    )
  }

  const target = await Plugins.picker.single(
    '请选择要设置代理的终端：',
    options.filter((v) => v.os.includes(env.os))
  )

  const server = await getProxyServer()

  switch (target) {
    case 'cmd::copy': {
      await Plugins.ClipboardSetText(`set HTTP_PROXY=${server} && set HTTPS_PROXY=${server}`)
      Plugins.message.info('已复制命令到剪切板')
      break
    }
    case 'powershell::copy': {
      await Plugins.ClipboardSetText(`$env:http_proxy="${server}"; $env:https_proxy="${server}"`)
      Plugins.message.info('已复制命令到剪切板')
      break
    }
    case 'env::set::user': {
      await Plugins.Exec('setx', ['HTTP_PROXY', server])
      await Plugins.Exec('setx', ['HTTPS_PROXY', server])
      Plugins.message.info('已设置环境变量：HTTP_PROXY、HTTPS_PROXY，若无效果请重启终端或检查环境变量是否设置成功', 5_000)
      break
    }
    case 'env::set::system': {
      await Plugins.Exec('setx', ['HTTP_PROXY', server, '/m'])
      await Plugins.Exec('setx', ['HTTPS_PROXY', server, '/m'])
      Plugins.message.info('已设置环境变量：HTTP_PROXY、HTTPS_PROXY，若无效果请重启终端或检查环境变量是否设置成功', 5_000)
      break
    }
    case 'env::clear::user': {
      await Plugins.Exec('setx', ['HTTP_PROXY', ''])
      await Plugins.Exec('setx', ['HTTPS_PROXY', ''])
      Plugins.message.info('已设置环境变量：HTTP_PROXY、HTTPS_PROXY为空', 5_000)
      break
    }
    case 'env::clear::system': {
      await Plugins.Exec('setx', ['HTTP_PROXY', '', '/m'])
      await Plugins.Exec('setx', ['HTTPS_PROXY', '', '/m'])
      Plugins.message.info('已设置环境变量：HTTP_PROXY、HTTPS_PROXY为空', 5_000)
      break
    }
    case 'env::clear::reg::user': {
      await Plugins.Exec('reg', ['delete', 'HKCU\\Environment', '/f', '/v', 'HTTP_PROXY'])
      await Plugins.Exec('reg', ['delete', 'HKCU\\Environment', '/f', '/v', 'HTTPS_PROXY'])
      Plugins.message.info('已删除用户环境变量：HTTP_PROXY、HTTPS_PROXY', 5_000)
      break
    }
    case 'env::clear::reg::system': {
      await Plugins.Exec('reg', ['delete', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/f', '/v', 'HTTP_PROXY'])
      await Plugins.Exec('reg', ['delete', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/f', '/v', 'HTTPS_PROXY'])
      Plugins.message.info('已删除系统环境变量：HTTP_PROXY、HTTPS_PROXY', 5_000)
      break
    }
    case 'terminal::copy': {
      await Plugins.ClipboardSetText(`export http_proxy="${server}"; export https_proxy="${server}"`)
      Plugins.message.info('已复制命令到剪切板')
      break
    }
  }
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  // 移除之前添加的：放在这个生命周期里用不到，但是保留着吧
  window[Plugin.id].remove?.()
  // 添加自定义操作到概览面板的核心状态组件里
  const appStore = Plugins.useAppStore()
  if (!appStore.addCustomActions) {
    Plugins.message.warn('本插件正在使用新的API，你的版本不受支持，请更新。')
    return
  }
  window[Plugin.id].remove = appStore.addCustomActions('core_state', [
    {
      component: 'Dropdown',
      componentProps: {
        size: 'small',
        trigger: ['hover']
      },
      componentSlots: {
        default: ({ h }) => {
          return h('Button', { type: 'link', size: 'small' }, '复制系统代理')
        },
        overlay: ({ h }) => {
          return h(
            'div',
            [
              ['复制Bash命令', copyBashEnv],
              ['复制Powershell命令', copyPowerShellEnv],
              ['复制Cmd命令', copyCMDEnv]
            ].map(([title, fn]) => {
              return h(
                'Button',
                {
                  type: 'link',
                  onClick: () => {
                    fn()
                      .then(() => Plugins.message.success('复制成功'))
                      .catch((err) => Plugins.message.error(err))
                  }
                },
                () => title
              )
            })
          )
        }
      }
    }
  ])
}

const copyBashEnv = async () => {
  const server = await getProxyServer()
  await Plugins.ClipboardSetText(`export http_proxy="${server}"; export https_proxy="${server}"`)
}

const copyPowerShellEnv = async () => {
  const server = await getProxyServer()
  await Plugins.ClipboardSetText(`$env:http_proxy="${server}"; $env:https_proxy="${server}"`)
}

const copyCMDEnv = async () => {
  const server = await getProxyServer()
  await Plugins.ClipboardSetText(`set HTTP_PROXY=${server} && set HTTPS_PROXY=${server}`)
}
