/**
 * 本插件使用项目：https://github.com/sub-store-org/Sub-Store
 */

const PATH = 'data/third/sub-store-v3'
const USER_PROFILE = PATH + '/user.json'
const BACKEND_FILE = PATH + '/sub-store.min.js'

/**
 * 启动Sub-Store服务
 */
const startSubStoreService = async () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const SUBSTORE_SOURCE_CODE = await Plugins.Readfile(BACKEND_FILE)

  /**
   * 提供此方法供Sub-Store进行类似localStorage.setItem/getItem/removeItem的操作
   * 此方法必须是同步的; 同时加入防抖进行性能优化:)
   */
  Plugins.SubStoreCache = {
    data: JSON.parse((await Plugins.ignoredError(Plugins.Readfile, USER_PROFILE)) || '{}'),
    sync: Plugins.debounce(() => {
      Plugins.Writefile(USER_PROFILE, JSON.stringify(this.data, null, 2))
    }, 1000),
    get(key) {
      return this.data[key]
    },
    set(key, value) {
      this.data[key] = value
      this.sync()
    },
    remove(key) {
      delete this.data[key]
      this.sync()
    }
  }

  await Plugins.StartServer(Plugin.Address, Plugin.id, async (req, res) => {
    if (/^\/api|^\/download/.test(req.url)) {
      const response = await new AsyncFunction(/* javascript */ `
          /* Code snippet injected by GUI.for.Cores . start */
          var $Plugins = Plugins;
          var $Plugin = ${JSON.stringify(Plugin)};
          var $done;
          var $donePromise = new Promise((resolve) => ($done = resolve));
          var $request = ${JSON.stringify({ ...req, url: `http://127.0.0.1${req.url}` })};
          /* Code snippet injected by GUI.for.Cores . end */
          
          ${SUBSTORE_SOURCE_CODE}
  
          /* Code snippet injected by GUI.for.Cores . start */
          return await $donePromise;
          /* Code snippet injected by GUI.for.Cores . end */
      `)()
      res.end(response.status, response.headers, response.body)
      return
    }
    res.end(200, { 'Content-Type': 'text/html; charset=utf-8' }, 'The Sub-Store Backend is running... Have a nice day :)')
  })
}

/**
 * 停止Sub-Store服务
 */
const stopSubStoreService = async () => {
  await Plugins.StopServer(Plugin.id)
}

/**
 * 检测Sub-Store是否在运行
 */
const isSubStoreRunning = async () => {
  return (await Plugins.ListServer()).includes(Plugin.id)
}

/**
 * 插件钩子 - APP就绪时
 */
const onReady = async () => {
  if (await isSubStoreRunning()) {
    // 重启服务，恢复web服务的处理程序
    await stopSubStoreService()
    await startSubStoreService()
    return 1
  }
  return 2
}

/**
 * 插件钩子 - 点击安装按钮时
 */
const onInstall = async () => {
  await Plugins.Download('https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.min.js', BACKEND_FILE)
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
  await Plugins.Removefile(PATH)
  return 0
}

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  if (!(await isSubStoreRunning())) {
    await startSubStoreService()
  }
  Plugins.BrowserOpenURL('https://sub-store.vercel.app/subs?api=http://' + Plugin.Address)
  return 1
}

/**
 * 插件菜单项 - 启动服务
 */
const Start = async () => {
  if (await isSubStoreRunning()) {
    throw '当前服务已经在运行了'
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
  if (isRunning) {
    await stopSubStoreService()
  }
  await onInstall()
  if (isRunning) {
    await startSubStoreService()
  }
  Plugins.message.success('更新成功')
}
