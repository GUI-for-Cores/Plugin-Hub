/**
 * 本插件使用开源项目：https://github.com/UnblockNeteaseMusic/server
 */
const MUSIC_PATH = 'data/third/unblock-netease-music'
const DOWNLOAD_PATH = Plugin.DownloadsPath || MUSIC_PATH + '/downloads'
const PID_FILE = MUSIC_PATH + '/unblock-netease-music.pid'
const PROCESS_NAME = 'unblockneteasemusic.exe'
const PROCESS_PATH = MUSIC_PATH + '/' + PROCESS_NAME

const ENV = {
  LOG_LEVEL: 'info', //	日志输出等级。请见〈日志等级〉部分。	LOG_LEVEL=debug  info  error
  BLOCK_ADS: String(Plugin.BLOCK_ADS), // 屏蔽应用内部分广告
  ENABLE_FLAC: String(Plugin.ENABLE_FLAC), // 激活无损音质获取
  ENABLE_LOCAL_VIP: String(Plugin.ENABLE_LOCAL_VIP), // 激活本地黑胶 VIP，可选值：true（等同于 CVIP）、cvip 和 svip
  // LOCAL_VIP_UID: '', // 仅对这些 UID 激活本地黑胶 VIP，默认为对全部用户生效 LOCAL_VIP_UID=123456789,1234,123456
  // ENABLE_HTTPDNS: false, // 激活故障的 Netease HTTPDNS 查询（不建议）
  DISABLE_UPGRADE_CHECK: String(Plugin.DISABLE_UPGRADE_CHECK), // 禁用更新检测
  FOLLOW_SOURCE_ORDER: 'false', // 严格按照配置音源的顺序进行查询
  JSON_LOG: 'true', // 输出机器可读的 JSON 记录格式
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

// 存储插件全局变量
window[Plugin.id] = window[Plugin.id] || {
  unblockHistory: Vue.ref([]),
  onServiceStopped: Plugins.debounce(async () => {
    delete window[Plugin.id]
    console.log(`[${Plugin.name}]`, '插件已停止')
    await Plugins.Writefile(PID_FILE, '0')
  }, 100)
}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installUnblockMusic()
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
  const modal = Plugins.modal({
    title: Plugin.name,
    submit: false,
    width: '70',
    cancelText: 'common.close',
    maskClosable: true,
    afterClose() {
      modal.destroy()
    }
  })

  const content = {
    template: `
    <div class="min-w-256 min-h-256">
      <Card>
        <div  class="flex items-center justify-between p-8">
          <div class="font-bold" :style="{color: isRunning ? 'green' : 'red'}">
            {{isRunning ? '服务运行中...' : '服务已停止'}}
          </div>
          <Button @click="handleToggle" :loading="loading" type="primary">
            {{isRunning ? '停止服务' : '运行服务'}}
          </Button>
        </div>
      </Card>

      <Card class="mt-16" title="本次解锁记录">
        <Table :columns="columns" :data-source="dataSource" />
        <Empty v-if="dataSource.length === 0" class="mt-16" />
        <div class="pt-16 text-12">注：重载界面后，需要重新启动服务才能开始记录解锁日志。</div>

        <template #extra>
          <Button type="link" @click="handleOpen" icon="folder">打开下载目录</Button>
          <Button type="link" @click="handleClear" icon="clear">清除日志</Button>
        </template>
      </Card>
    </div>
    `,
    setup() {
      const { ref, h } = Vue
      const dataSource = window[Plugin.id].unblockHistory
      const loading = ref(false)
      const isRunning = ref()

      isUnblockMusicRunning().then((res) => {
        isRunning.value = res
      })

      return {
        columns: [
          { title: '解锁时间', key: 'time', align: 'center', customRender: ({ value }) => Plugins.formatDate(value, 'YYYY-MM-DD HH:mm:ss') },
          { title: '音频ID', key: 'audioId', align: 'center' },
          { title: '歌曲名', key: 'songName', align: 'center' },
          {
            title: '链接',
            key: 'url',
            align: 'center',
            minWidth: '100px',
            customRender: ({ value, record }) =>
              h(
                'div',
                {
                  onClick: async () => {
                    const ext = value.match(/\.(mp3|flac|wav|aac|ogg|m4a)(?:\?.*)?$/i)?.[1]
                    await Plugins.Download(value, DOWNLOAD_PATH + '/' + (record.songName + (ext ? `.${ext}` : '')), {}, (p, t) => {
                      record._progress = ((p / t) * 100).toFixed(2) + '%'
                    })
                    record._progress = '已下载'
                  },
                  class: 'cursor-pointer ',
                  style: {
                    color: 'var(--primary-color)'
                  }
                },
                record._progress || '下载'
              )
          }
        ],
        dataSource,
        loading,
        isRunning,
        handleToggle: async () => {
          loading.value = true
          if (isRunning.value) {
            await stopUnblockMusicService()
          } else {
            await startUnblockMusicService()
          }
          loading.value = false
          isRunning.value = !isRunning.value
        },
        handleClear: () => {
          dataSource.value.splice(0)
        },
        handleOpen: async () => {
          const path = await Plugins.AbsolutePath(DOWNLOAD_PATH)
          Plugins.BrowserOpenURL(path)
        }
      }
    }
  }

  modal.setContent(content)
  modal.open()
}

/* 触发器 核心启动前 */
const onBeforeCoreStart = async (config, profile) => {
  console.log(`[${Plugin.name}]`, 'onBeforeCoreStart 启动插件并注入配置')
  if (!(await isUnblockMusicRunning())) {
    await startUnblockMusicService()
  }

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

/* 触发器 核心启动后 */
const onCoreStarted = async () => {
  console.log(`[${Plugin.name}]`, 'onCoreStarted 检测是否在运行并切换为解锁模式')
  const isRunning = await isUnblockMusicRunning()
  if (isRunning) {
    await switchTo(1)
  }
  return isRunning && 1
}

/* 触发器 核心停止后 */
const onCoreStopped = async () => {
  console.log(`[${Plugin.name}]`, 'onCoreStopped 停止插件并切换为直连模式')
  if (await isUnblockMusicRunning()) {
    await stopUnblockMusicService()
    switchTo(0)
    return 2
  }
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isUnblockMusicRunning()) {
    Plugins.message.warn('当前插件已经在运行了')
    return 1
  }
  await startUnblockMusicService()
  await switchTo(1)
  Plugins.message.success('✨ 插件启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (await isUnblockMusicRunning()) {
    await stopUnblockMusicService()
  }
  await switchTo(0)
  Plugins.message.success('✨ 插件停止成功')
  return 2
}

/**
 * 启动服务
 */
const startUnblockMusicService = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const pid = await Plugins.ExecBackground(
        PROCESS_PATH,
        ['-p', Plugin.Port + ':' + (Number(Plugin.Port) + 1), '-a', '127.0.0.1', '-o', ...Plugin.Source],
        async (out) => {
          console.log(`[${Plugin.name}]`, out)
          // 保存解锁信息
          const data = JSON.parse(out)
          if (data.songName && data.url) {
            window[Plugin.id].unblockHistory.value.unshift(data)
          }
          if (out.includes('Error: ')) {
            reject(out)
          }
          if (out.includes('HTTP Server running')) {
            await Plugins.Writefile(PID_FILE, pid.toString())
            resolve()
          }
        },
        () => {
          console.log(`[${Plugin.name}]`, 'ExecBackground onEnd 进程已结束')
          window[Plugin.id].onServiceStopped()
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
 * 停止服务
 */
const stopUnblockMusicService = async () => {
  const pid = await Plugins.ignoredError(Plugins.Readfile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    console.log(`[${Plugin.name}]`, 'KillProcess 已杀死进程')
    window[Plugin.id].onServiceStopped()
  }
}

/*
 * 切换网易云代理，index是onGenerate时添加的顺序
 * index: 0切换为直连
 * index: 1切换为代理
 */
const switchTo = async (index) => {
  console.log(`[${Plugin.name}]`, '切换为', ['直连模式', '解锁模式'][index])
  const appSettings = Plugins.useAppSettingsStore()
  if (!appSettings.app.kernel.running) return
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
const installUnblockMusic = async () => {
  const { env } = Plugins.useEnvStore()
  if (!['windows', 'linux'].includes(env.os)) throw '该插件暂不支持此操作系统'
  const isWin = env.os === 'windows'
  const isX64 = env.arch === 'amd64'
  const BinaryFileUrl = `https://github.com/UnblockNeteaseMusic/server/releases/download/v0.27.10/unblockneteasemusic-${isWin ? 'win' : 'linux'}-${isX64 ? 'x64' : 'arm64'}${isWin ? '.exe' : ''}`
  // https://github.com/UnblockNeteaseMusic/server/releases/download/v0.27.9/unblockneteasemusic-linux-x64
  // https://github.com/UnblockNeteaseMusic/server/releases/download/v0.27.9/unblockneteasemusic-win-x64.exe
  // https://github.com/UnblockNeteaseMusic/server/releases/download/v0.27.9/unblockneteasemusic-win-arm64.exe

  const { id } = Plugins.message.info('正在下载...', 999999)
  try {
    await Plugins.Makedir(MUSIC_PATH)
    await Plugins.Download(BinaryFileUrl, PROCESS_PATH, {}, (c, t) => {
      Plugins.message.update(id, '正在下载...' + ((c / t) * 100).toFixed(2) + '%')
    })
    if (!isWin) {
      await Plugins.Exec('chmod', ['+x', await Plugins.AbsolutePath(PROCESS_PATH)])
    }
    Plugins.message.update(id, '下载完成')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }

  const ca = 'data/.cache/ca.crt'
  await Plugins.Download('https://raw.githubusercontent.com/UnblockNeteaseMusic/server/enhanced/ca.crt', ca)
  const path = await Plugins.AbsolutePath(ca)
  await Plugins.alert(
    '最后一步',
    `请手动安装CA证书，该证书来自项目，但我们建议你使用自签证书。\n\n> 证书路径：${ca} [](${path.replaceAll('\\', '/')} "点击安装")\n\n安装教程：[](https://github.com/UnblockNeteaseMusic/server/discussions/426 "https://github.com/UnblockNeteaseMusic/server/discussions/426")`,
    {
      type: 'markdown'
    }
  )
}
