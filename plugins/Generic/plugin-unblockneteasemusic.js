/**
 * 本插件使用开源项目：https://github.com/UnblockNeteaseMusic/server
 */
const MUSIC_PATH = 'data/third/unblock-netease-music'
const PID_FILE = MUSIC_PATH + '/unblock-netease-music.pid'
const PROCESS_NAME = 'unblockneteasemusic.exe'

const ENV = {
  LOG_LEVEL: 'info', //	日志输出等级。请见〈日志等级〉部分。	LOG_LEVEL=debug  info  error
  BLOCK_ADS: String(Plugin.BLOCK_ADS), // 屏蔽应用内部分广告
  ENABLE_FLAC: String(Plugin.ENABLE_FLAC), // 激活无损音质获取
  ENABLE_LOCAL_VIP: String(Plugin.ENABLE_LOCAL_VIP), // 激活本地黑胶 VIP，可选值：true（等同于 CVIP）、cvip 和 svip
  // LOCAL_VIP_UID: '', // 仅对这些 UID 激活本地黑胶 VIP，默认为对全部用户生效 LOCAL_VIP_UID=123456789,1234,123456
  // ENABLE_HTTPDNS: false, // 激活故障的 Netease HTTPDNS 查询（不建议）
  DISABLE_UPGRADE_CHECK: String(Plugin.DISABLE_UPGRADE_CHECK), // 禁用更新检测
  FOLLOW_SOURCE_ORDER: 'false', // 严格按照配置音源的顺序进行查询
  // JSON_LOG: 'true' // 输出机器可读的 JSON 记录格式
  NO_CACHE: String(Plugin.NO_CACHE), // 停用 cache
  MIN_BR: Plugin.MIN_BR, //	允许的最低源音质，小于该值将被替换	MIN_BR=320000
  SELECT_MAX_BR: String(Plugin.SELECT_MAX_BR), //	选择所有音源中的最高码率替换音频	SELECT_MAX_BR=true
  // LOG_FILE: 'app.log', //	从 Pino 端设置日志输出的文件位置。也可以用 *sh 的输出重导向功能 (node app.js >> app.log) 代替	LOG_FILE=app.log
  // JOOX_COOKIE: '', //	JOOX 音源的 wmid 和 session_key cookie	JOOX_COOKIE="wmid=<your_wmid>; session_key=<your_session_key>"
  MIGU_COOKIE: Plugin.MIGU_COOKIE, //	咪咕音源的 aversionid cookie	MIGU_COOKIE="<your_aversionid>"
  QQ_COOKIE: Plugin.QQ_COOKIE, //	QQ 音源的 uin 和 qm_keyst cookie	QQ_COOKIE="uin=<your_uin>; qm_keyst=<your_qm_keyst>"
  // YOUTUBE_KEY: '', //	Youtube 音源的 Data API v3 Key	YOUTUBE_KEY="<your_data_api_key>"
  // SIGN_CERT: '', //	自定义证书文件	SIGN_CERT="./server.crt"
  // SIGN_KEY: '', //	自定义密钥文件	SIGN_KEY="./server.key"
  SEARCH_ALBUM: 'true', //	在其他音源搜索歌曲时携带专辑名称（默认搜索条件 歌曲名 - 歌手，启用后搜索条件 歌曲名 - 歌手 专辑名）	SEARCH_ALBUM=true
  NETEASE_COOKIE: Plugin.NETEASE_COOKIE //	网易云 Cookie	MUSIC_U=007554xxx
}

/**
 * 启动服务
 */
const startUnblockMusicService = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const pid = await Plugins.ExecBackground(
        MUSIC_PATH + '/' + PROCESS_NAME,
        ['-p', Plugin.Port + ':' + (Number(Plugin.Port) + 1), '-a', '127.0.0.1', '-o', ...Plugin.Source],
        async (out) => {
          console.log(`[${Plugin.name}]`, out)
          if (out.includes('HTTP Server running')) {
            Plugins.Writefile(PID_FILE, pid.toString())
            await switchTo(1) // 切换为代理
            resolve()
          }
        },
        async () => {
          await Plugins.Writefile(PID_FILE, '0')
          await switchTo(0) // 切换为直连
        },
        {
          env: ENV
        }
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 插件钩子 - 生成配置时
 */
const onGenerate = async (config) => {
  const isClash = !!config.mode

  const group = isClash ? config['proxy-groups'] : config['outbounds']
  const flag = isClash ? 'name' : 'tag'
  const direct = (group.find((v) => v[flag] === '🎯 全球直连') || group.find((v) => v[flag] === '🎯 Direct'))?.[flag] || (isClash ? 'DIRECT' : 'direct')

  if (isClash) {
    config.proxies.unshift({
      name: Plugin.Proxy,
      type: 'http',
      server: '127.0.0.1',
      port: Plugin.Port
    })

    group.unshift({
      name: Plugin.ProxyGroup,
      type: 'select',
      proxies: [direct, Plugin.Proxy]
    })

    config.rules.unshift(`PROCESS-NAME,${Plugin.Process},${Plugin.ProxyGroup}`)
  } else {
    group.unshift({
      tag: Plugin.Proxy,
      type: 'http',
      server: '127.0.0.1',
      server_port: Number(Plugin.Port)
    })

    group.unshift({
      tag: Plugin.ProxyGroup,
      type: 'selector',
      outbounds: [direct, Plugin.Proxy]
    })

    config.route.rules.unshift({
      process_name: Plugin.Process,
      outbound: Plugin.ProxyGroup
    })
  }

  return config
}

/**
 * 停止服务
 */
const stopUnblockMusicService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.Writefile(PID_FILE, '0')
    // 切换为直连
    await switchTo(0)
  }
}

/*
 * 切换网易云代理，index是onGenerate时添加的顺序
 * index: 0切换为直连
 * index: 1切换为代理
 */
const switchTo = async (index) => {
  const kernelApiStore = Plugins.useKernelApiStore()
  const group = kernelApiStore.proxies[Plugin.ProxyGroup]
  const proxy = group?.all[index]
  if (group && proxy) {
    await Plugins.ignoredError(Plugins.handleUseProxy, group, { name: proxy })
  }
}

/**
 * 检测是否在运行
 */
const isUnblockMusicRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return name === PROCESS_NAME
  }
  return false
}

/**
 * 安装
 */
const InstallUnblockMusic = async () => {
  const { env } = Plugins.useEnvStore()
  if (env.os !== 'windows') throw '该插件暂不支持此操作系统'
  const BinaryFileUrl = `https://github.com/UnblockNeteaseMusic/server/releases/download/v0.27.6/unblockneteasemusic-win-${
    { amd64: 'x64' }[env.arch] || env.arch
  }.exe`
  const { id } = Plugins.message.info('正在下载...', 999999)
  try {
    await Plugins.Makedir(MUSIC_PATH)
    await Plugins.Download(BinaryFileUrl, MUSIC_PATH + '/unblockneteasemusic.exe', {}, (c, t) => {
      Plugins.message.update(id, '正在下载...' + ((c / t) * 100).toFixed(2) + '%')
    })
    Plugins.message.update(id, '下载完成')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }

  const ca = 'data/.cache/ca.crt'
  await Plugins.Download('https://raw.githubusercontent.com/UnblockNeteaseMusic/server/enhanced/ca.crt', ca)
  await Plugins.alert('最后一步', '请手动安装CA证书。\n\n证书路径：' + ca + '\n\n安装教程：https://github.com/UnblockNeteaseMusic/server/discussions/426')
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
  await Plugins.confirm('确定要卸载吗', '将删除插件资源：' + MUSIC_PATH + '\n\n若已安装CA证书，记得手动卸载哦')
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
    // 再切换一次，因为GUI启动后没来得及获取内核信息，插件就调用了switchTo，导致获取不到group和proxy，没有切换成功
    setTimeout(() => {
      switchTo(1)
    }, 3000)
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
