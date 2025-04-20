/**
 * 本插件使用项目：https://www.speedtest.net/zh-Hans/apps/cli
 */

const PATH = 'data/third/speed-test-cli'

const Constant = (() => {
  const { env } = Plugins.useEnvStore()

  if (env.os === 'windows') {
    return {
      download_url: 'https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-win64.zip',
      bin_path: PATH + '/speedtest.exe'
    }
  }

  if (env.os === 'darwin') {
    return {
      download_url: 'https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-macosx-universal.tgz',
      bin_path: PATH + '/speedtest'
    }
  }

  if (env.os === 'linux') {
    const i386 = 'https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-i386.tgz'
    const x86_64 = 'https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-x86_64.tgz'
    return {
      download_url: env.arch == 'amd64' ? x86_64 : i386,
      bin_path: PATH + '/speedtest'
    }
  }
})()

/* 触发器 手动触发 */
const onRun = async () => {
  await startSpeedTest()
}

/* 触发器 安装 */
const onInstall = async () => {
  const { download_url, bin_path } = Constant
  const { update, success, destroy } = Plugins.message.info('正在下载...', 1200 * 1000)
  const tmp = 'data/.cache/speedtest-cli' + (download_url.endsWith('.zip') ? '.zip' : '.tgz')

  await Plugins.Download(download_url, tmp, {}, (progress, total) => {
    update('下载中...' + ((progress / total) * 100).toFixed(2) + '%')
  })

  if (download_url.endsWith('.tgz')) {
    // 以下代码未在对应平台测试，欢迎PR
    await Plugins.Makedir(PATH)
    await Plugins.UnzipGZFile(tmp, bin_path)
    await Plugins.Exec('chmod', ['+x', await Plugins.AbsolutePath(bin_path)])
  } else {
    await Plugins.UnzipZIPFile(tmp, PATH)
  }

  await Plugins.Removefile(tmp)
  success('安装完成')

  Plugins.sleep(3000).then(() => destroy())
  return 0
}

/* 触发器 卸载 */
const onUninstall = async () => {
  await Plugins.Removefile(PATH)
  return 0
}

/**
 * 测速
 */
const startSpeedTest = async (serverId) => {
  const { bin_path } = Constant
  const args = ['--accept-license', '--format=json', '--progress=yes']
  if (serverId) {
    args.push('--server-id=' + serverId)
  }
  let pid = -1
  const { update, success, destroy } = Plugins.message.info('开始测速', 999999, async () => {
    if (pid !== -1) {
      await Plugins.KillProcess(pid)
      Plugins.message.info('已停止测速')
    }
  })
  console.log(`[${Plugin.name}]`, '开始测速...')
  pid = await Plugins.ExecBackground(
    bin_path,
    args,
    async (out) => {
      console.log(`[${Plugin.name}]`, out)
      const { type, ping, download, upload, result } = JSON.parse(out)
      if (type === 'ping') {
        update(`延迟: ${ping.latency}ms , ${ping.progress * 100}%`)
      } else if (type === 'download') {
        update(
          `👇下行: ${Plugins.formatBytes(download.bandwidth)}/s ,  使用流量: ${Plugins.formatBytes(download.bytes)} , ${(download.progress * 100).toFixed(2)}%`
        )
      } else if (type === 'upload') {
        update(`👆上行: ${Plugins.formatBytes(upload.bandwidth)}/s ,  使用流量: ${Plugins.formatBytes(upload.bytes)} ,  ${(upload.progress * 100).toFixed(2)}%`)
      } else if (type === 'result') {
        success('测速完毕')
        Plugins.sleep(2000).then(() => destroy())
        await Plugins.alert(
          '测速结果如下：',
          `![${result.id}](${result.url}.png "${result.id}")\n\n> 请访问【[测速详情](${result.url} "网页版")】以查看更详细的测速结果！`,
          { type: 'markdown' }
        )
      }
    },
    () => {
      console.log(`[${Plugin.name}]`, '测速结束')
    },
    { convert: true }
  )
}

/*
 * 插件菜单项 - 选择测速服务器
 */
const startSpeedTestByServerId = async () => {
  const { bin_path } = Constant
  const output = await Plugins.Exec(bin_path, ['--accept-license', '--format=json', '--servers'])
  console.log(`[${Plugin.name}]`, output)
  const { servers } = JSON.parse(output)
  const id = await Plugins.picker.single(
    '请选择测速服务器',
    servers.map((v) => ({
      label: `${v.name}（${v.country}）`,
      description: `${v.host}:${v.port} `,
      value: v.id
    })),
    []
  )
  if (!id) throw '未选择，已取消测速'
  await startSpeedTest(id)
}
