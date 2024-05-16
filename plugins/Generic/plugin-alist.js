/**
 * 本插件使用项目：https://github.com/alist-org/alist
 */

const PATH = 'data/third/alist'
const PID_FILE = PATH + '/alist.pid'

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installAlist()
  const res = await Plugins.Exec(PATH + '/alist.exe', ['admin'])
  const username = res.match(/Admin user's username: (\w+)/)?.[1]
  const password = res.match(/initial password is: (\w+)/)?.[1]
  console.log(username, password)
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isAlistRunning()) {
    throw '请先停止运行alist服务！'
  }
  await Plugins.confirm('确定要删除alist吗？', '配置文件将不会保留')
  await uninstallAlist()
  return 0
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isAlistRunning())) {
    await startAlistService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isAlistRunning())) {
    await stopAlistService()
    return 2
  }
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isAlistRunning())) {
    await startAlistService()
  }
  const url = 'http://127.0.0.1:' + Plugin.Address.split(':')[1]
  Plugins.BrowserOpenURL(url)
  return 1
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isAlistRunning()) {
    throw '当前服务已经在运行了'
  }
  await startAlistService()
  Plugins.message.success('✨alist 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isAlistRunning())) {
    throw '当前服务并未在运行'
  }
  await stopAlistService()
  Plugins.message.success('停止alist成功')
  return 2
}

/**
 * 插件菜单项 - Web界面
 */
const Web = async () => {}

/**
 * 插件菜单项 - 配置管理
 */
const More = async () => {
  const action = await Plugins.picker.single(
    '请选择操作',
    [
      { label: '重置密码', value: 'admin:random' },
      { label: '设置密码', value: 'admin:set' },
      { label: '', value: '' },
      { label: '', value: '' },
      { label: '', value: '' }
    ],
    []
  )
}

/**
 * 检测alist是否在运行
 */
const isAlistRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return ['alist', 'alist.exe'].includes(name)
  }
  return false
}

/**
 * 停止alist服务
 */
const stopAlistService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
  }
}

/**
 * 启动alist服务
 */
const startAlistService = async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const envStore = Plugins.useEnvStore()
      const pid = await Plugins.ExecBackground(
        PATH + { linux: '', windows: '', darwin: '' }[envStore.env.os],
        [],
        async (out) => {
          console.log(out)
          await Plugins.Writefile(PID_FILE, pid)
          resolve()
        },
        () => Plugins.Writefile(PID_FILE, '0')
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 安装alist
 */
const installAlist = async () => {
  const { env } = Plugins.useEnvStore()
  const suffix = env.os === 'windows' ? '.zip' : '.tar.gz'
  const tmp_file = 'data/.cache/alist' + suffix
  const { id } = Plugins.message.info('获取alist下载地址', 999999999)
  try {
    const { body } = await Plugins.HttpGet('https://api.github.com/repos/alist-org/alist/releases/latest', {
      Authorization: Plugins.getGitHubApiAuthorization?.()
    })
    if (body.message) throw body.message
    const url = `https://github.com/alist-org/alist/releases/download/${body.tag_name}/alist-${env.os}-${env.arch}${suffix}`
    Plugins.message.update(id, '下载alist压缩包')
    await Plugins.Makedir(PATH)
    await Plugins.Download(url, tmp_file, {}, (progress, total) => {
      Plugins.message.update(id, '下载alist压缩包：' + ((progress / total) * 100).toFixed(2) + '%')
    })
    if (env.os === 'windows') {
      await Plugins.UnzipZIPFile(tmp_file, PATH)
    } else {
      await Plugins.Exec('tar', ['zxvf', tmp_file, '-C', PATH])
      await Plugins.Exec('chmod', ['+x', PATH + '/alist'])
    }
    await Plugins.Removefile(tmp_file)
    Plugins.message.update(id, '安装alist完成', 'success')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/* 卸载alist */
const uninstallAlist = async () => {
  await Plugins.Removefile(PATH)
}
