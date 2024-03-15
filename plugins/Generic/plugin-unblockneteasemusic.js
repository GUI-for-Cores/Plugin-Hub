const { env } = Plugins.useEnvStore()

const BinaryFileUrl = `https://github.com/UnblockNeteaseMusic/server/releases/download/v0.27.6/unblockneteasemusic-win-${
  { amd64: 'x64' }[env.arch] || env.arch
}.exe`
const MUSIC_PATH = 'data/third/unblock-netease-music'
const PID_FILE = MUSIC_PATH + '/unblock-netease-music.pid'

/**
 * 启动服务
 */
const startUnblockMusicService = () => {
  return new Promise(async (resolve, reject) => {
    setTimeout(() => timeout && reject('启动服务超时'), 5000)
    const pid = await Plugins.ExecBackground(
      MUSIC_PATH + '/unblockneteasemusic.exe',
      ['-p', '80', '-f', '45.254.48.92'],
      (out) => {
        console.log(out)
        if (out.includes('HTTP Server running')) {
          Plugins.Writefile(PID_FILE, pid.toString())
          timeout = false
          resolve()
        }
      },
      async () => {
        await Plugins.Writefile(PID_FILE, '0')
      },
      {
        env: {
          LOG_LEVEL: 'debug'
        }
      }
    )
  })
}

/**
 * 停止服务
 */
const stopUnblockMusicService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.ignoredError(Plugins.KillProcess, Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
  }
}

/**
 * 检测是否在运行
 */
const isUnblockMusicRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  return pid && pid !== '0'
}

/**
 * 安装
 */
const InstallUnblockMusic = async () => {
  const { id } = Plugins.message.info('正在执行安装...', 999999)
  try {
    await Plugins.Makedir(MUSIC_PATH)
    Plugins.message.update(id, '正在下载')
    await Plugins.Download(BinaryFileUrl, MUSIC_PATH + '/unblockneteasemusic.exe', (c, t) => {
      Plugins.message.update(id, '正在下载...' + ((c / t) * 100).toFixed(2) + '%')
    })
    Plugins.message.update(id, '下载完成')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await InstallUnblockMusic()
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isUnblockMusicRunning()) {
    throw '请先停止服务！'
  }
  await Plugins.confirm('确定要卸载吗', '将删除插件资源：' + MUSIC_PATH)
  await Plugins.Removefile(MUSIC_PATH)
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isUnblockMusicRunning())) {
    await startUnblockMusicService()
    Plugins.message.success('✨ 插件启动成功!')
  }
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isUnblockMusicRunning())) {
    await startUnblockMusicService()
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isUnblockMusicRunning())) {
    await stopUnblockMusicService()
  }
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isUnblockMusicRunning()) {
    throw '当前服务已经在运行了'
  }
  await startUnblockMusicService()
  Plugins.message.success('✨ 插件启动成功!')
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isUnblockMusicRunning())) {
    throw '当前服务并未在运行'
  }
  await stopUnblockMusicService()
  Plugins.message.success('✨ 插件停止成功')
}
