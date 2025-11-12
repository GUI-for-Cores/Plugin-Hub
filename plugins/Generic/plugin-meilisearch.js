/**
 * 本插件使用开源项目：https://github.com/meilisearch/meilisearch
 */

const PATH = 'data/third/meilisearch'
const PID_FILE = PATH + '/meilisearch.pid'

const { env } = Plugins.useEnvStore()

/**
 * 获取 Meilisearch 二进制文件名
 */
const getMeilisearchAssetName = () => {
  return {
    windows: 'meilisearch-windows-amd64.exe',
    linux: `meilisearch-linux-${env.arch === 'amd64' ? 'amd64' : 'aarch64'}`,
    darwin: `meilisearch-macos-${env.arch === 'amd64' ? 'amd64' : 'apple-silicon'}`
  }[env.os]
}

const BIN_FILE = PATH + '/' + getMeilisearchAssetName()


/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installMeilisearch()
  if (Plugin.MasterKey) {
    await Plugins.alert('安装成功', `已设置 Master Key，请妥善保管！`)
  } else {
    await Plugins.alert('安装成功', `Master Key 未设置，建议在插件配置中进行设置以保证安全。`)
  }
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isMeilisearchRunning()) {
    throw '请先停止运行 Meilisearch 服务！'
  }
  await Plugins.confirm('确定要删除 Meilisearch 吗？', '数据和配置文件将不会保留')
  await uninstallMeilisearch()
  return 0
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isMeilisearchRunning())) {
    await startMeilisearchService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isMeilisearchRunning())) {
    await stopMeilisearchService()
    return 2
  }
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isMeilisearchRunning())) {
    await startMeilisearchService()
  }
  const addr = Plugin.HttpAddress || '127.0.0.1:7700'
  Plugins.BrowserOpenURL(`http://${addr.startsWith('0.0.0.0') ? '127.0.0.1' + addr.substring(5) : addr}`)
  return 1
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isMeilisearchRunning()) {
    throw '当前服务已经在运行了'
  }
  await startMeilisearchService()
  Plugins.message.success('✨ Meilisearch 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isMeilisearchRunning())) {
    throw '当前服务并未在运行'
  }
  await stopMeilisearchService()
  Plugins.message.success('停止 Meilisearch 成功')
  return 2
}

/**
 * 插件菜单项 - 数据目录
 */
const OpenDataDir = async () => {
  const dataPath = Plugin.DbPath || PATH
  Plugins.BrowserOpenURL(await Plugins.AbsolutePath(dataPath))
}

/**
 * 检测Meilisearch是否在运行
 */
const isMeilisearchRunning = async () => {
  const pid = await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)
  if (pid && pid !== '0') {
    const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
    return name && name.toLowerCase().includes('meilisearch')
  }
  return false
}

/**
 * 停止Meilisearch服务
 */
const stopMeilisearchService = async () => {
  const pid = await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.WriteFile(PID_FILE, '0')
  }
}

/**
 * 启动Meilisearch服务
 */
const startMeilisearchService = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const args = await defaultArgs()
      const pid = await Plugins.ExecBackground(
        BIN_FILE,
        args,
        async (out) => {
          if (out.includes('listening on')) {
            await Plugins.WriteFile(PID_FILE, String(pid))
            resolve()
          }
        },
        () => Plugins.WriteFile(PID_FILE, '0')
      )
    } catch (error) {
      reject(error.message || error)
    }
  })
}

/**
 * 安装Meilisearch
 */
const installMeilisearch = async () => {
  const assetName = getMeilisearchAssetName()
  if (!assetName) {
    throw `不支持的平台: ${env.os} - ${env.arch}`
  }

  const tmp_file = 'data/.cache/' + assetName
  const { id } = Plugins.message.info('获取 Meilisearch 下载地址', 999999999)
  try {
    const { body } = await Plugins.HttpGet('https://api.github.com/repos/meilisearch/meilisearch/releases/latest', {
      Authorization: Plugins.getGitHubApiAuthorization?.()
    })
    if (body.message) throw body.message

    const asset = body.assets.find((asset) => asset.name === assetName)
    if (!asset) {
      throw '未找到对应资源: ' + assetName
    }

    const url = asset.browser_download_url
    Plugins.message.update(id, '下载 Meilisearch')
    await Plugins.MakeDir(PATH)
    await Plugins.Download(url, tmp_file, {}, (progress, total) => {
      Plugins.message.update(id, '下载 Meilisearch：' + ((progress / total) * 100).toFixed(2) + '%')
    })

    await Plugins.MoveFile(tmp_file, BIN_FILE)

    if (env.os !== 'windows') {
      await Plugins.Exec('chmod', ['+x', BIN_FILE])
    }

    Plugins.message.update(id, '安装 Meilisearch 完成', 'success')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/* 卸载Meilisearch */
const uninstallMeilisearch = async () => {
  await Plugins.RemoveFile(PATH)
}

const defaultArgs = async () => {
  const args = []
  if (Plugin.HttpAddress) {
    args.push('--http-addr', Plugin.HttpAddress)
  }
  if (Plugin.MasterKey) {
    args.push('--master-key', Plugin.MasterKey)
  }

  const dataPath = Plugin.DbPath || PATH
  args.push('--db-path', await Plugins.AbsolutePath(dataPath + '/data.ms'))
  args.push('--schedule-snapshot')
  args.push('--snapshot-dir', await Plugins.AbsolutePath(dataPath + '/snapshots'))

  return args
}