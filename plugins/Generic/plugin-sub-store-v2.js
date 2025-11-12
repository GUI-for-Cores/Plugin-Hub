/**
 * 本插件使用项目：https://github.com/sub-store-org/Sub-Store
 * 注：重构【Sub-Store v1】插件时发现v1和v2的实现原理相同，故合并为此插件，并添加右键【更新程序】
 */

const PATH = 'data/third/sub-store-v2'
const PID_FILE = PATH + '/sub-store.pid'
const FRONTEND_PATH = PATH + '/frontend'
const BACKEND_FILE = PATH + '/sub-store.bundle.js'

window[Plugin.id] = window[Plugin.id] || {}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await installSubStore()
  return 0
}

/**
 * 插件钩子 - 点击卸载按钮时
 */
const onUninstall = async () => {
  if (await isSubStoreRunning()) {
    throw '请先停止Sub-Store服务！'
  }
  await Plugins.confirm('确定要删除Sub-Store吗？', '配置文件将不会保留！')
  await Plugins.RemoveFile(PATH)
  return 0
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isSubStoreRunning())) {
    if (!(await Plugins.ignoredError(Plugins.Exec, Plugin.NODE_PATH || 'node', ['-v']))) {
      throw '检测到系统未安装Nodejs环境，请先安装。'
    }
    await startSubStoreService()
  }
  openSubStoreUI()
  return 1
}

/**
 * 插件钩子 - 启动APP时
 */
const onStartup = async () => {
  if (Plugin.AutoStartOrStop && !(await isSubStoreRunning())) {
    await startSubStoreService()
    return 1
  }
}

/**
 * 插件钩子 - 关闭APP时
 */
const onShutdown = async () => {
  if (Plugin.AutoStartOrStop && (await isSubStoreRunning())) {
    await stopSubStoreService()
    return 2
  }
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isSubStoreRunning()) {
    throw '当前服务已经在运行了'
  }
  if (!(await Plugins.ignoredError(Plugins.Exec, Plugin.NODE_PATH || 'node', ['-v']))) {
    throw '检测到系统未安装Nodejs环境，请先安装。'
  }
  await startSubStoreService()
  Plugins.message.success('✨Sub-Store 启动成功!')
  return 1
}

/**
 * 插件菜单项 - 停止服务
 */
const Stop = async () => {
  if (!(await isSubStoreRunning())) {
    throw '当前服务并未在运行'
  }
  await stopSubStoreService()
  Plugins.message.success('停止Sub-Store成功')
  return 2
}

/**
 * 插件菜单项 - 更新程序
 */
const Update = async () => {
  const isRunning = await isSubStoreRunning()
  isRunning && (await stopSubStoreService())

  await Plugins.RemoveFile(PATH + '/frontend')
  await Plugins.RemoveFile(PATH + '/sub-store.bundle.js')

  await installSubStore()

  isRunning && (await startSubStoreService())
  Plugins.message.success('更新完成')
  return isRunning ? 1 : 2
}

/**
 * 启动Sub-Store服务
 */
const startSubStoreService = () => {
  return new Promise(async (resolve, reject) => {
    const { env } = Plugins.useEnvStore()
    let backendFlag = false
    let timeout = true
    setTimeout(() => timeout && reject('启动Sub-Store服务超时'), 5000)
    try {
      const pid = await Plugins.ExecBackground(
        Plugin.NODE_PATH || 'node',
        [env.basePath + '/' + BACKEND_FILE],
        (out) => {
          if (out.includes('[sub-store] INFO: [BACKEND]')) {
            backendFlag = true
          }
          if (out.includes('[sub-store] INFO: [FRONTEND]') && backendFlag) {
            Plugins.WriteFile(PID_FILE, pid.toString())
            timeout = false
            resolve()
          }
        },
        () => Plugins.WriteFile(PID_FILE, '0'),
        {
          env: {
            SUB_STORE_BACKEND_API_HOST: Plugin.SUB_STORE_BACKEND_API_HOST,
            SUB_STORE_FRONTEND_HOST: Plugin.SUB_STORE_FRONTEND_HOST,
            SUB_STORE_FRONTEND_API_PORT: Plugin.SUB_STORE_FRONTEND_API_PORT,
            SUB_STORE_BACKEND_API_PORT: Plugin.SUB_STORE_BACKEND_API_PORT,
            SUB_STORE_BACKEND_CUSTOM_NAME: Plugin.SUB_STORE_BACKEND_CUSTOM_NAME,
            SUB_STORE_BACKEND_CUSTOM_ICON: Plugin.SUB_STORE_BACKEND_CUSTOM_ICON,
            SUB_STORE_BACKEND_DOWNLOAD_CRON: Plugin.SUB_STORE_BACKEND_DOWNLOAD_CRON,
            SUB_STORE_BACKEND_UPLOAD_CRON: Plugin.SUB_STORE_BACKEND_UPLOAD_CRON,
            SUB_STORE_BACKEND_SYNC_CRON: Plugin.SUB_STORE_BACKEND_SYNC_CRON,
            SUB_STORE_FRONTEND_PATH: env.basePath + '/' + FRONTEND_PATH,
            SUB_STORE_DATA_BASE_PATH: env.basePath + '/' + PATH
          }
        }
      )
    } catch (error) {
      reject(error.message || error)
    }

    addToCoreStatePanel()
  })
}

/**
 * 停止Sub-Store服务
 */
const stopSubStoreService = async () => {
  removeFromCoreStatePanel()
  const pid = await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)
  if (pid && pid !== '0') {
    await Plugins.KillProcess(Number(pid))
    await Plugins.WriteFile(PID_FILE, '0')
  }
}

/**
 * 检测Sub-Store是否在运行
 */
const isSubStoreRunning = async () => {
  const { env } = Plugins.useEnvStore()
  const pid = await Plugins.ignoredError(Plugins.ReadFile, PID_FILE)
  if (pid && pid !== '0') {
    if (env.os !== 'linux') {
      const name = await Plugins.ignoredError(Plugins.ProcessInfo, Number(pid))
      return ['node.exe', 'node', 'node-default'].includes(name)
    }
    const processCommand = await Plugins.ignoredError(Plugins.Exec, '/usr/bin/ps', ['-p', pid.toString(), '-o', 'cmd='])
    const match = `.*${Plugin.NODE_PATH || 'node'}\\s+${env.basePath}/${BACKEND_FILE}`
    return new RegExp(match, 'g').test(String(processCommand).trim())
  }
  return false
}

/**
 * 下载Sub-Store前端和后端文件
 */
const installSubStore = async () => {
  const BackendUrl = 'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
  const FrontendUrl = 'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip'
  const tmpZip = 'data/.cache/sub-store.zip'
  const tmpDir = 'data/.cache/sub-store-frontend'
  const { id } = Plugins.message.info('正在执行安装Sub-Store...', 999999)
  try {
    Plugins.message.update(id, '正在下载前端资源')
    await Plugins.Download(FrontendUrl, tmpZip, {}, (c, t) => {
      Plugins.message.update(id, '正在下载前端资源...' + ((c / t) * 100).toFixed(2) + '%')
    })
    Plugins.message.update(id, '前端资源下载完成，正在解压...')
    await Plugins.sleep(1000)
    await Plugins.UnzipZIPFile(tmpZip, tmpDir)
    await Plugins.MakeDir(PATH)
    await Plugins.MoveFile(tmpDir + '/dist', FRONTEND_PATH)
    await Plugins.RemoveFile(tmpDir)
    await Plugins.RemoveFile(tmpZip)
    Plugins.message.update(id, '安装前端完成, 正在安装后端...')
    await Plugins.sleep(1000)
    await Plugins.Download(BackendUrl, BACKEND_FILE)
    Plugins.message.update(id, '安装后端完成', 'success')
  } finally {
    await Plugins.sleep(1000)
    Plugins.message.destroy(id)
  }
}

/**
 * 添加到概览页
 */
const addToCoreStatePanel = () => {
  window[Plugin.id].remove?.()
  const appStore = Plugins.useAppStore()
  window[Plugin.id].remove = appStore.addCustomActions('core_state', {
    component: 'div',
    componentSlots: {
      default: ({ h }) => {
        return h(
          'Button',
          {
            type: 'link',
            size: 'small',
            onClick: openSubStoreUI
          },
          () => [
            h('img', {
              src: 'https://raw.githubusercontent.com/sub-store-org/Sub-Store-Front-End/refs/heads/master/public/favicon.ico',
              width: '16px',
              height: '16px',
              style: {
                borderRadius: '4px',
                marginRight: '4px'
              }
            }),
            'Sub-Store'
          ]
        )
      }
    }
  })
}

/**
 * 从概览页移除
 */
const removeFromCoreStatePanel = () => {
  window[Plugin.id].remove?.()
}

const openSubStoreUI = () => {
  const src = 'http://127.0.0.1:' + Plugin.SUB_STORE_FRONTEND_API_PORT + '?api=http://127.0.0.1:' + Plugin.SUB_STORE_BACKEND_API_PORT
  const modal = Plugins.modal(
    {
      title: 'Sub-Store',
      width: '90',
      height: '90',
      footer: false,
      maskClosable: true,
      afterClose() {
        modal.destroy()
      }
    },
    {
      toolbar: () => [
        Vue.h(
          Vue.resolveComponent('Button'),
          {
            type: 'text',
            onClick: () => {
              Plugins.BrowserOpenURL(src)
            }
          },
          () => '浏览器中打开'
        ),
        Vue.h(Vue.resolveComponent('Button'), {
          type: 'text',
          icon: 'close',
          onClick: () => modal.destroy()
        })
      ],
      default: () =>
        Vue.h('iframe', {
          src: src,
          allow: 'clipboard-read; clipboard-write',
          class: 'w-full h-full border-0',
          style: {
            height: 'calc(100% - 6px)'
          }
        })
    }
  )
  modal.open()
}
