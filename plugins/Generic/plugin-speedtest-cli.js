/**
 * 本插件使用项目：https://www.speedtest.net/zh-Hans/apps/cli
 */

const PATH = 'data/third/speed-test-cli'
const History_File = PATH + '/history.json'

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
    await Plugins.MakeDir(PATH)
    await Plugins.UnzipGZFile(tmp, bin_path)
    await Plugins.Exec('chmod', ['+x', await Plugins.AbsolutePath(bin_path)])
  } else {
    await Plugins.UnzipZIPFile(tmp, PATH)
  }

  await Plugins.RemoveFile(tmp)
  success('安装完成')

  Plugins.sleep(3000).then(() => destroy())
  return 0
}

/* 触发器 卸载 */
const onUninstall = async () => {
  await Plugins.RemoveFile(PATH)
  return 0
}

/**
 * 测速
 */
const startSpeedTest = async (serverId) => {
  const { bin_path } = Constant
  const args = ['--accept-license', '--format=json', '--progress=yes']
  serverId && args.push('--server-id=' + serverId)
  console.log(`[${Plugin.name}]`, '开始测速...')
  await new Promise(async (resolve, reject) => {
    let pid = -1
    const { update, success, destroy } = Plugins.message.info('开始测速...', 999999, async () => {
      if (pid !== -1) {
        await Plugins.KillProcess(pid)
        Plugins.message.info('已停止测速')
      }
    })
    pid = await Plugins.ExecBackground(
      bin_path,
      args,
      async (out) => {
        console.log(`[${Plugin.name}]`, out)
        const { type, ping, download, upload, result, error } = JSON.parse(out)
        if (error) {
          destroy()
          reject(error)
          return
        }
        if (type === 'ping') {
          update(`延迟: ${ping.latency}ms , ${ping.progress * 100}%`)
        } else if (type === 'download') {
          update(
            `👇下行: ${Plugins.formatBytes(download.bandwidth)}/s ,  使用流量: ${Plugins.formatBytes(download.bytes)} , ${(download.progress * 100).toFixed(2)}%`
          )
        } else if (type === 'upload') {
          update(
            `👆上行: ${Plugins.formatBytes(upload.bandwidth)}/s ,  使用流量: ${Plugins.formatBytes(upload.bytes)} ,  ${(upload.progress * 100).toFixed(2)}%`
          )
        } else if (type === 'result') {
          success('测速完毕')
          Plugins.sleep(2000).then(() => destroy())
          saveResult(out)
          await Plugins.alert(
            '测速结果如下：',
            `![${result.id}](${result.url}.png "${result.id}")\n\n> 请访问【[测速详情](${result.url} "网页版")】以查看更详细的测速结果！`,
            { type: 'markdown' }
          )
        }
      },
      () => {
        console.log(`[${Plugin.name}]`, '测速结束')
        resolve()
      }
    )
  })
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

/**
 * 测速服务器名称由第三方提供，放进 markdown 前转义所有 ASCII 标点，避免注入 HTML
 */
const escapeMarkdownText = (text) =>
  String(text ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[!-/:-@[-`{-~]/g, '\\$&')

/*
 * 插件菜单项 - 查看测速历史
 */
const speedtestHistory = async () => {
  if (!(await Plugins.FileExists(History_File))) {
    throw '还没有测过速，来测测吧！'
  }
  const history = JSON.parse(await Plugins.ReadFile(History_File))
  let header = `
|带宽|延迟|服务器|时间|详情|
|--|--|--|--|--|
`
  const body = history
    .reverse()
    .map((v) =>
      [
        '|',
        `↓ ${Plugins.formatBytes(v.download.bandwidth)}/s ↑ ${Plugins.formatBytes(v.upload.bandwidth)}/s`,
        '|',
        `${v.ping.latency}ms`,
        '|',
        escapeMarkdownText(`${v.server.country} ${v.server.location}`),
        '|',
        Plugins.formatDate(v.timestamp, 'YYYY-MM-DD HH:mm:ss'),
        '|',
        `[](${v.result.url} "详情")`,
        '|'
      ].join('')
    )
    .join('\n')
  await Plugins.alert('测速历史', header + body, { type: 'markdown' })
}

/*
 * 插件菜单项 - 清理测速历史
 */
const clearHistory = async () => {
  if (!(await Plugins.FileExists(History_File))) {
    throw '无需清理'
  }
  const history = JSON.parse(await Plugins.ReadFile(History_File))
  if (history.length === 0) throw '无需清理'
  const ids = await Plugins.picker.multi(
    '请选择要清理的测速结果',
    history.reverse().map((v) => ({
      label: `↓ ${Plugins.formatBytes(v.download.bandwidth)}/s ↑ ${Plugins.formatBytes(v.upload.bandwidth)}/s`,
      description: `${Plugins.formatDate(v.timestamp, 'YYYY-MM-DD HH:mm:ss')} - ${v.server.country} ${v.server.location}`,
      value: v.result.id
    })),
    []
  )
  if (ids.length === 0) return
  const filtered = history.filter((v) => !ids.includes(v.result.id))
  await Plugins.WriteFile(History_File, JSON.stringify(filtered))
  Plugins.message.success('清理完成')
}

// 保存测速结果
const saveResult = async (result) => {
  const history = JSON.parse((await Plugins.ignoredError(Plugins.ReadFile, History_File)) || '[]')
  history.push(JSON.parse(result))
  Plugins.WriteFile(History_File, JSON.stringify(history))
}
