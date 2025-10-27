/**
 * Git 代理管理插件
 * 点击运行时弹出选项菜单，支持多种 Git 代理操作
 */

// 保存插件状态
window[Plugin.id] = window[Plugin.id] || {}

// 获取当前代理服务器地址
const getProxyServer = async () => {
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

  // Git 只支持 HTTP 代理，所以统一使用 HTTP
  const server = 'http://127.0.0.1:' + port
  return server
}

// 检查 Git 是否可用
const checkGitAvailable = async () => {
  try {
    await Plugins.Exec('git', ['--version'])
    return true
  } catch (error) {
    throw 'Git 未安装或不在 PATH 中，请先安装 Git'
  }
}

// 主运行函数 - 显示选项菜单
const onRun = async () => {
  const { env } = Plugins.useEnvStore()

  // 检查 Git 是否可用
  try {
    await checkGitAvailable()
  } catch (error) {
    Plugins.message.error(error)
    return 0
  }

  const options = [
    {
      label: '🚀 设置 Git HTTP 代理',
      value: 'set::http',
      os: ['windows', 'linux', 'darwin']
    },
    {
      label: '🚀 设置 Git HTTPS 代理',
      value: 'set::https',
      os: ['windows', 'linux', 'darwin']
    },
    {
      label: '🚀 设置 Git HTTP + HTTPS 代理',
      value: 'set::both',
      os: ['windows', 'linux', 'darwin']
    },
    {
      label: '🔍 查看当前 Git 代理设置',
      value: 'check::proxy',
      os: ['windows', 'linux', 'darwin']
    },
    {
      label: '🧹 清除 Git HTTP 代理',
      value: 'clear::http',
      os: ['windows', 'linux', 'darwin']
    },
    {
      label: '🧹 清除 Git HTTPS 代理',
      value: 'clear::https',
      os: ['windows', 'linux', 'darwin']
    },
    {
      label: '🧹 清除所有 Git 代理设置',
      value: 'clear::all',
      os: ['windows', 'linux', 'darwin']
    },
    {
      label: '📋 复制 Git 代理设置命令',
      value: 'copy::commands',
      os: ['windows', 'linux', 'darwin']
    }
  ]

  // 如果启用了增强功能，添加高级选项
  if (Plugin.enableEnhance) {
    options.push(
      {
        label: '*****************高级选项*****************',
        value: '---',
        os: ['windows', 'linux', 'darwin']
      },
      {
        label: '⚙️ 自定义代理地址设置',
        value: 'custom::set',
        os: ['windows', 'linux', 'darwin']
      },
      {
        label: '🔧 设置 Git 全局用户信息',
        value: 'config::user',
        os: ['windows', 'linux', 'darwin']
      },
      {
        label: '📊 显示所有 Git 全局配置',
        value: 'config::list',
        os: ['windows', 'linux', 'darwin']
      }
    )
  }

  const target = await Plugins.picker.single(
    '请选择 Git 代理操作：',
    options.filter((v) => v.os.includes(env.os))
  )

  // 跳过分隔符
  if (target === '---') return 0

  try {
    const server = await getProxyServer()

    switch (target) {
      case 'set::http': {
        await Plugins.Exec('git', ['config', '--global', 'http.proxy', server])
        Plugins.message.success(`Git HTTP 代理已设置为: ${server}`)
        break
      }

      case 'set::https': {
        await Plugins.Exec('git', ['config', '--global', 'https.proxy', server])
        Plugins.message.success(`Git HTTPS 代理已设置为: ${server}`)
        break
      }

      case 'set::both': {
        await Plugins.Exec('git', ['config', '--global', 'http.proxy', server])
        await Plugins.Exec('git', ['config', '--global', 'https.proxy', server])
        Plugins.message.success(`Git HTTP/HTTPS 代理已设置为: ${server}`)
        break
      }

      case 'check::proxy': {
        let httpProxy = '未设置'
        let httpsProxy = '未设置'

        try {
          const httpResult = await Plugins.Exec('git', ['config', '--global', 'http.proxy'])
          httpProxy = httpResult.trim() || '未设置'
        } catch (e) {}

        try {
          const httpsResult = await Plugins.Exec('git', ['config', '--global', 'https.proxy'])
          httpsProxy = httpsResult.trim() || '未设置'
        } catch (e) {}

        const message = `当前 Git 代理设置:

HTTP 代理: ${httpProxy}
HTTPS 代理: ${httpsProxy}

当前可用代理: ${server}`

        await Plugins.alert('Git 代理状态', message)
        break
      }

      case 'clear::http': {
        await Plugins.Exec('git', ['config', '--global', '--unset', 'http.proxy']).catch(() => {})
        Plugins.message.success('Git HTTP 代理已清除')
        break
      }

      case 'clear::https': {
        await Plugins.Exec('git', ['config', '--global', '--unset', 'https.proxy']).catch(() => {})
        Plugins.message.success('Git HTTPS 代理已清除')
        break
      }

      case 'clear::all': {
        await Plugins.Exec('git', ['config', '--global', '--unset', 'http.proxy']).catch(() => {})
        await Plugins.Exec('git', ['config', '--global', '--unset', 'https.proxy']).catch(() => {})
        Plugins.message.success('所有 Git 代理设置已清除')
        break
      }

      case 'copy::commands': {
        const commands = `# 设置 Git 代理
git config --global http.proxy ${server}
git config --global https.proxy ${server}

# 清除 Git 代理
git config --global --unset http.proxy
git config --global --unset https.proxy

# 查看 Git 代理
git config --global http.proxy
git config --global https.proxy`

        await Plugins.ClipboardSetText(commands)
        Plugins.message.success('Git 代理命令已复制到剪切板')
        break
      }

      case 'custom::set': {
        const customProxy = await Plugins.prompt(
          '自定义代理设置',
          '请输入代理地址 (格式: http://host:port)',
          server
        )

        if (!customProxy) {
          Plugins.message.info('操作已取消')
          break
        }

        // 验证代理地址格式
        const proxyRegex = /^https?:\/\/[\w.-]+:\d+$/
        if (!proxyRegex.test(customProxy)) {
          Plugins.message.error('代理地址格式不正确，请使用 http://host:port 格式')
          break
        }

        await Plugins.Exec('git', ['config', '--global', 'http.proxy', customProxy])
        await Plugins.Exec('git', ['config', '--global', 'https.proxy', customProxy])
        Plugins.message.success(`Git 代理已设置为: ${customProxy}`)
        break
      }

      case 'config::user': {
        const userName = await Plugins.prompt('设置用户名', '请输入 Git 用户名', '')
        if (!userName) break

        const userEmail = await Plugins.prompt('设置邮箱', '请输入 Git 邮箱', '')
        if (!userEmail) break

        await Plugins.Exec('git', ['config', '--global', 'user.name', userName])
        await Plugins.Exec('git', ['config', '--global', 'user.email', userEmail])
        Plugins.message.success(`Git 用户信息已设置: ${userName} <${userEmail}>`)
        break
      }

      case 'config::list': {
        try {
          const configList = await Plugins.Exec('git', ['config', '--global', '--list'])
          await Plugins.alert('Git 全局配置', configList || '无配置信息')
        } catch (error) {
          Plugins.message.error('获取配置失败: ' + error.message)
        }
        break
      }
    }

    return 1
  } catch (error) {
    Plugins.message.error('操作失败: ' + error)
    return 0
  }
}

// 插件启动时的初始化
const onStartup = async () => {
  console.log('Git 代理管理插件已加载')
}

// 插件关闭时的清理
const onShutdown = async () => {
  console.log('Git 代理管理插件已卸载')
}

// 应用就绪后添加快捷操作（可选）
const onReady = async () => {
  // 移除之前添加的操作
  window[Plugin.id].remove?.()

  // 添加自定义操作到概览面板
  const appStore = Plugins.useAppStore()
  if (!appStore.addCustomActions) {
    return // 版本不支持，跳过
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
          return h('Button', { type: 'link', size: 'small' }, 'Git代理')
        },
        overlay: ({ h }) => {
          return h(
            'div',
            [
              ['快速设置', quickSetProxy],
              ['快速清除', quickClearProxy],
              ['查看状态', quickCheckProxy]
            ].map(([title, fn]) => {
              return h(
                'Button',
                {
                  type: 'link',
                  onClick: () => {
                    fn()
                      .then(() => {})
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

// 快捷操作函数
const quickSetProxy = async () => {
  const server = await getProxyServer()
  await Plugins.Exec('git', ['config', '--global', 'http.proxy', server])
  await Plugins.Exec('git', ['config', '--global', 'https.proxy', server])
  Plugins.message.success(`Git 代理已设置: ${server}`)
}

const quickClearProxy = async () => {
  await Plugins.Exec('git', ['config', '--global', '--unset', 'http.proxy']).catch(() => {})
  await Plugins.Exec('git', ['config', '--global', '--unset', 'https.proxy']).catch(() => {})
  Plugins.message.success('Git 代理已清除')
}

const quickCheckProxy = async () => {
  let httpProxy = '未设置'
  try {
    const result = await Plugins.Exec('git', ['config', '--global', 'http.proxy'])
    httpProxy = result.trim() || '未设置'
  } catch (e) {}

  Plugins.message.info(`当前 Git HTTP 代理: ${httpProxy}`)
}
