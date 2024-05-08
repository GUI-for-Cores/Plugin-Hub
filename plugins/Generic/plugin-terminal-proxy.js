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

  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.kernel.running) throw '请先启动内核程序'

  const kernelStore = Plugins.useKernelApiStore()

  let isHttp = true
  let port = kernelStore.config['mixed-port'] || kernelStore.config['port']

  if (!port) {
    isHttp = false
    port = kernelStore.config['socks-port']
  }

  if (!port) throw '请先开启一个代理端口'

  const server = (isHttp ? 'http://127.0.0.1:' : 'socks5://127.0.0.1:') + port

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
