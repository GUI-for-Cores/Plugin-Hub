/**
 * 本插件使用开源项目：https://github.com/OpenListTeam/OpenList
 */

const PATH = 'data/third/openlist'
const PID_FILE = PATH + '/openlist.pid'

const { env } = Plugins.useEnvStore()
const BIN_FILE = PATH + '/openlist' + { linux: '', windows: '.exe', darwin: '' }[env.os]

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installOpenList()
  const res = await Plugins.Exec(BIN_FILE, ['admin', ...(await defaultArgs())])
  const password = res.match(/password is: (\w+)/)?.[1]
  await Plugins.alert('账号信息', `用户名：admin\n初始密码：${password}\n\n如果你忘记了密码，可点击菜单项【管理员】-【重置密码】。`)
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isOpenListRunning()) {
    throw '请先停止运行OpenList服务！'
  }
  await Plugins.confirm('确定要删除OpenList吗？', '配置文件将不会保留')
  await uninstallOpenList()
  return 0
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isOpenListRunning())) {
    await startOpenListService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isOpenListRunning())) {
    await stopOpenListService()
    return 2
  }
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isOpenListRunning())) {
    await startOpenListService()
  }
  const config = JSON.parse(await Plugins.Readfile(PATH + '/config.json'))
  Plugins.BrowserOpenURL(`http://127.0.0.1:${config.scheme.http_port}`)
  return 1
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isOpenListRunning()) {
    throw '当前服务已经在运行了'
  }
  await startOpenListService()
  Plugins.message.success('✨openlist 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isOpenListRunning())) {
    throw '当前服务并未在运行'
  }
  await stopOpenListService()
  Plugins.message.success('停止OpenList成功')
  return 2
}

/**
 * 插件菜单项 - 配置文件
 */
const Config = async () => {
  Plugins.BrowserOpenURL(await Plugins.AbsolutePath(PATH + '/config.json'))
}

/**
 * 插件菜单项 - 管理员
 */
const More = async () => {
  const action = await Plugins.picker.single(
    '请选择操作',
    [
      { label: '重置密码', value: 'admin:random:password' },
      { label: '设置密码', value: 'admin:set:password' },
      { label: '删除两步验证', value: 'admin:cancel2fa' }
    ],
    []
  )

  switch (action) {
    case 'admin:random:password': {
      const res = await Plugins.Exec(BIN_FILE, ['admin', 'random', ...(await defaultArgs())])
      Plugins.alert('密码已重置', res.match(/password: (\w+)/)?.[1])
      break
    }
    case 'admin:set:password': {
      const password = await Plugins.prompt('请输入新的密码')
      const res = await Plugins.Exec(BIN_FILE, ['admin', 'set', password, ...(await defaultArgs())])
      Plugins.alert('密码已设置', res.match(/password: (\w+)/)?.[1])
      break
    }
    case 'admin:cancel2fa': {
      await Plugins.Exec(BIN_FILE, ['cancel2fa', ...(await defaultArgs())])
      Plugins.message.success('已取消两步验证')
      break
    }
  }
}

/**
 * 检测OpenList是否在运行
 */
const isOpenListRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return ['openlist', 'openlist.exe'].includes(name)
  }
  return false
}

/**
 * 停止OpenList服务
 */
const stopOpenListService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
  }
}

/**
 * 启动OpenList服务
 */
const startOpenListService = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const pid = await Plugins.ExecBackground(
        BIN_FILE,
        ['server', ...(await defaultArgs())],
        async (out) => {
          if (out.includes('start HTTP server')) {
            await Plugins.Writefile(PID_FILE, String(pid))
            resolve()
          }
        },
        () => Plugins.Writefile(PID_FILE, '0')
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 安装OpenList
 */
const installOpenList = async () => {
  const suffix = env.os === 'windows' ? '.zip' : '.tar.gz'
  const tmp_file = 'data/.cache/openlist' + suffix
  const { id } = Plugins.message.info('获取OpenList下载地址', 999999999)
  try {
    const { body } = await Plugins.HttpGet('https://api.github.com/repos/OpenListTeam/OpenList/releases/latest', {
      Authorization: Plugins.getGitHubApiAuthorization?.()
    })
    if (body.message) throw body.message
    const name = `openlist-${env.os}-${env.arch}${suffix}`
    const asset = body.assets.find((asset) => asset.name === name)
    if (!asset) {
      throw '未找到对应资源: ' + name
    }
    if (asset.uploader.login !== 'github-actions[bot]') {
      throw '该资源可能非自动构建，存在安全风险'
    }
    const url = asset.browser_download_url
    Plugins.message.update(id, '下载OpenList压缩包')
    await Plugins.Makedir(PATH)
    await Plugins.Download(url, tmp_file, {}, (progress, total) => {
      Plugins.message.update(id, '下载OpenList压缩包：' + ((progress / total) * 100).toFixed(2) + '%')
    })
    if (env.os === 'windows') {
      await Plugins.UnzipZIPFile(tmp_file, PATH)
    } else {
      await Plugins.Exec('tar', ['zxvf', tmp_file, '-C', PATH])
      await Plugins.Exec('chmod', ['+x', PATH + '/openlist'])
    }
    await Plugins.Removefile(tmp_file)
    Plugins.message.update(id, '安装OpenList完成', 'success')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/* 卸载OpenList */
const uninstallOpenList = async () => {
  await Plugins.Removefile(PATH)
}

const defaultArgs = async () => {
  return ['--data', await Plugins.AbsolutePath(PATH)]
}
