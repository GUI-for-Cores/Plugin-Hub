/**
 * 本插件使用开源项目：https://github.com/UnblockNeteaseMusic/server
 */
const MUSIC_PATH = 'data/third/unblock-netease-music'
const PID_FILE = MUSIC_PATH + '/unblock-netease-music.pid'

// 1、环境变量太多了就不写入UI了，按需修改
// 2、配置里只列出了默认启用的音源，如需更多请第42行添加
const ENV = {
  LOG_LEVEL: 'info' //	日志输出等级。请见〈日志等级〉部分。	LOG_LEVEL=debug  info  error
  // BLOCK_ADS: 'false' // 屏蔽应用内部分广告
  // ENABLE_FLAC: 'true', // 激活无损音质获取
  // ENABLE_LOCAL_VIP: 'true', // 激活本地黑胶 VIP，可选值：true（等同于 CVIP）、cvip 和 svip
  // LOCAL_VIP_UID: '', // 仅对这些 UID 激活本地黑胶 VIP，默认为对全部用户生效 LOCAL_VIP_UID=123456789,1234,123456
  // ENABLE_HTTPDNS: false, // 激活故障的 Netease HTTPDNS 查询（不建议）
  // DISABLE_UPGRADE_CHECK: 'true', // 禁用更新检测
  // FOLLOW_SOURCE_ORDER: 'true', // 严格按照配置音源的顺序进行查询
  // JSON_LOG: 'true' // 输出机器可读的 JSON 记录格式
  // NO_CACHE: 'true', // 停用 cache
  // MIN_BR: '320000', //	允许的最低源音质，小于该值将被替换	MIN_BR=320000
  // SELECT_MAX_BR: 'true', //	选择所有音源中的最高码率替换音频	SELECT_MAX_BR=true
  // LOG_FILE: 'app.log', //	从 Pino 端设置日志输出的文件位置。也可以用 *sh 的输出重导向功能 (node app.js >> app.log) 代替	LOG_FILE=app.log
  // JOOX_COOKIE: '', //	JOOX 音源的 wmid 和 session_key cookie	JOOX_COOKIE="wmid=<your_wmid>; session_key=<your_session_key>"
  // MIGU_COOKIE: '', //	咪咕音源的 aversionid cookie	MIGU_COOKIE="<your_aversionid>"
  // QQ_COOKIE: '', //	QQ 音源的 uin 和 qm_keyst cookie	QQ_COOKIE="uin=<your_uin>; qm_keyst=<your_qm_keyst>"
  // YOUTUBE_KEY: '', //	Youtube 音源的 Data API v3 Key	YOUTUBE_KEY="<your_data_api_key>"
  // SIGN_CERT: '', //	自定义证书文件	SIGN_CERT="./server.crt"
  // SIGN_KEY: '', //	自定义密钥文件	SIGN_KEY="./server.key"
  // SEARCH_ALBUM: 'true', //	在其他音源搜索歌曲时携带专辑名称（默认搜索条件 歌曲名 - 歌手，启用后搜索条件 歌曲名 - 歌手 专辑名）	SEARCH_ALBUM=true
  // NETEASE_COOKIE: '' //	网易云 Cookie	MUSIC_U=007554xxx
}

const Log = (...msg) => console.log('[解锁网易云音乐]', ...msg)

/**
 * 启动服务
 */
const startUnblockMusicService = () => {
  return new Promise(async (resolve) => {
    const pid = await Plugins.ExecBackground(
      MUSIC_PATH + '/' + 'unblockneteasemusic.exe',
      ['-p', Plugin.Port, '-a', Plugin.Addres, '-o', ...Plugin.Source],
      async (out) => {
        Log(out)
        if (out.includes('HTTP Server running')) {
          Plugins.Writefile(PID_FILE, pid.toString())
          resolve()
        }
      },
      async () => {
        await Plugins.Writefile(PID_FILE, '0')
      },
      {
        env: ENV
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
  const { env } = Plugins.useEnvStore()
  const BinaryFileUrl = `https://github.com/UnblockNeteaseMusic/server/releases/download/v0.27.6/unblockneteasemusic-win-${
    { amd64: 'x64' }[env.arch] || env.arch
  }.exe`
  const { id } = Plugins.message.info('正在下载...', 999999)
  try {
    await Plugins.Makedir(MUSIC_PATH)
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
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isUnblockMusicRunning()) {
    throw '请先停止插件服务！'
  }
  await Plugins.confirm('确定要卸载吗', '将删除插件资源：' + MUSIC_PATH)
  await Plugins.Removefile(MUSIC_PATH)
  return 0
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (await isUnblockMusicRunning()) {
    throw '当前插件已经在运行了'
  }
  await startUnblockMusicService()
  Plugins.message.success('✨ 插件启动成功!')
  return 1
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isUnblockMusicRunning())) {
    await startUnblockMusicService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isUnblockMusicRunning())) {
    await stopUnblockMusicService()
    return 2
  }
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isUnblockMusicRunning()) {
    throw '当前插件已经在运行了'
  }
  await startUnblockMusicService()
  Plugins.message.success('✨ 插件启动成功!')
  return 1
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
  return 2
}
