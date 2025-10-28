/* Trigger on::manual */
const onRun = async () => {
  await Plugins.ignoredError(Stop, false)
  await Start(Plugin)
  return 1
}

/* Trigger on::configure */
const onConfigure = async (config, old) => {
  if (config.ApiAddress !== old.ApiAddress || config.ApiPort !== old.ApiPort || config.ApiSecret !== old.ApiSecret) {
    if (await isRunning()) {
      await Stop(false)
      await Start({ feedback: false, ...config })
    }
  }
}

/* Trigger on::ready */
const onReady = async () => {
  if (Plugin.AutoStartOrStop) {
    return await onRun()
  }
}

const Start = async (params = Plugin) => {
  if (params.ApiAddress === '0.0.0.0' && !params.ApiSecret) throw '请先配置密钥'

  const router = new Router()

  router.use(jsonMiddleware)
  router.use(withRequestBodyMiddleWare)
  params.ApiSecret && router.use(authMiddleware)

  registerAppSettings(router)
  registerProfiles(router)
  registerSubscriptions(router)
  registerRulesets(router)
  registerPlugins(router)
  registerScheduledTasks(router)
  registerCores(router)
  registerGUI(router)

  registerDocument(router)

  await Plugins.StartServer(params.ApiAddress + ':' + params.ApiPort, Plugin.id, async (req, res) => {
    router.match(req, res)
  })

  params.feedback && (await Plugins.message.success('RESTful Api 启动成功'))
  return 1
}

const Stop = async (feedback = true) => {
  await Plugins.ignoredError(Plugins.StopServer, Plugin.id)
  feedback && (await Plugins.message.success('RESTful Api 停止成功'))
  return 2
}

const isRunning = async () => {
  return (await Plugins.ListServer()).includes(Plugin.id)
}

function registerDocument(router) {
  const routes = router.routes.map((route) => ({
    method: route.method,
    path: route.path,
    metadata: route.metadata
  }))

  router.get('/', {}, (req, res, params) => {
    res.json(200, { pluig_name: Plugin.name, powered_by: 'GUI.for.Cores', app_name: Plugins.APP_TITLE, app_version: Plugins.APP_VERSION, '/v1': '/v1' })
  })

  router.get('/v1', {}, (req, res, params) => {
    res.json(200, { '/v1/docs/json': '/v1/docs/json', '/v1/docs/html': '/v1/docs/html' })
  })

  router.get('/v1/docs/json', {}, (req, res, params) => {
    res.json(200, routes)
  })

  router.get('/v1/docs/html', {}, (req, res, params) => {
    res.json(200, routes)
  })
}

/**
 * APP设置、插件设置
 * @param {Router} router
 */
function registerAppSettings(router) {
  const store = Plugins.useAppSettingsStore()

  router.get(
    '/v1/settings',
    {
      description: {
        zh: '获取APP设置和插件设置'
      }
    },
    (req, res, params) => {
      res.json(200, store.app)
    }
  )

  router.put(
    '/v1/settings',
    {
      description: {
        zh: '修改APP设置和插件设置'
      }
    },
    async (req, res, params) => {
      store.app = Plugins.deepAssign(store.app, req.body)
      res.json(201, store.app)
    }
  )
}

/**
 * 配置
 * @param {Router} router
 */
function registerProfiles(router) {
  const store = Plugins.useProfilesStore()

  router.get(
    '/v1/profiles',
    {
      description: {
        zh: '获取所有配置'
      }
    },
    (req, res, params) => {
      res.json(200, store.profiles)
    }
  )

  router.get(
    '/v1/profiles/:id',
    {
      description: {
        zh: '获取某个配置详情'
      }
    },
    (req, res, { id }) => {
      const profile = store.getProfileById(id)
      res.json(profile ? 200 : 404, profile)
    }
  )

  router.post(
    '/v1/profiles',
    {
      description: {
        zh: '创建一个配置'
      }
    },
    async (req, res, params) => {
      await store.addProfile(req.body)
      res.json(201, '已创建')
    }
  )

  router.put(
    '/v1/profiles/:id',
    {
      description: {
        zh: '修改一个配置'
      }
    },
    async (req, res, { id }) => {
      const profile = store.getProfileById(id)
      if (!profile) {
        return res.json(404, '配置不存在')
      }
      const _profile = Plugins.deepAssign(profile, req.body)
      await store.editProfile(id, _profile)
      res.json(201, _profile)
    }
  )

  router.delete(
    '/v1/profiles/:id',
    {
      description: {
        zh: '删除一个配置'
      }
    },
    async (req, res, { id }) => {
      const profile = store.getProfileById(id)
      if (!profile) {
        return res.json(404, '配置不存在')
      }
      await store.deleteProfile(id)
      res.json(204, 'No Content')
    }
  )

  router.get(
    '/v1/profiles/:id/config',
    {
      description: {
        zh: '获取由一个配置生成的核心配置'
      }
    },
    async (req, res, { id }) => {
      const profile = store.getProfileById(id)
      if (!profile) {
        return res.json(404, '配置不存在')
      }
      const config = await Plugins.generateConfig(profile)
      if (Plugins.APP_TITLE.includes('Clash')) {
        return res.end(200, { 'Content-Type': 'text/plain' }, Plugins.YAML.stringify(config))
      }
      res.json(200, config)
    }
  )
}

/**
 * 订阅
 * @param {Router} router
 */
function registerSubscriptions(router) {
  const store = Plugins.useSubscribesStore()

  router.get(
    '/v1/subscriptions',
    {
      description: {
        zh: '获取所有订阅'
      }
    },
    (req, res, params) => {
      res.json(200, store.subscribes)
    }
  )

  router.get(
    '/v1/subscriptions/:id',
    {
      description: {
        zh: '获取某个订阅详情'
      }
    },
    (req, res, { id }) => {
      const subscription = store.getSubscribeById(id)
      res.json(subscription ? 200 : 404, subscription)
    }
  )

  router.post(
    '/v1/subscriptions',
    {
      description: {
        zh: '添加一个订阅'
      }
    },
    async (req, res, params) => {
      await store.addSubscribe(req.body)
      res.json(201, '已创建')
    }
  )

  router.put(
    '/v1/subscriptions/:id',
    {
      description: {
        zh: '修改一个订阅'
      }
    },
    async (req, res, { id }) => {
      const subscription = store.getSubscribeById(id)
      if (!subscription) {
        return res.json(404, '订阅不存在')
      }
      const _subscription = Plugins.deepAssign(subscription, req.body)
      await store.editSubscribe(id, _subscription)
      res.json(201, _subscription)
    }
  )

  router.delete(
    '/v1/subscriptions/:id',
    {
      description: {
        zh: '删除一个订阅'
      }
    },
    async (req, res, { id }) => {
      const subscription = store.getSubscribeById(id)
      if (!subscription) {
        return res.json(404, '订阅不存在')
      }
      await store.deleteSubscribe(id)
      res.json(204, 'No Content')
    }
  )

  router.get(
    '/v1/subscriptions/:id/proxies',
    {
      description: {
        zh: '获取一个订阅内所有代理'
      }
    },
    async (req, res, { id }) => {
      const subscription = store.getSubscribeById(id)
      if (!subscription) {
        return res.json(404, '订阅不存在')
      }
      let proxies = await Plugins.ReadFile(subscription.path)
      if (Plugins.APP_TITLE.includes('Clash')) {
        proxies = Plugins.YAML.parse(proxies).proxies
      } else {
        proxies = JSON.parse(proxies)
      }
      res.json(200, proxies)
    }
  )

  router.post(
    '/v1/subscriptions/:id/update',
    {
      description: {
        zh: '更新一个订阅内所有代理'
      }
    },
    async (req, res, { id }) => {
      const subscription = store.getSubscribeById(id)
      if (!subscription) {
        return res.json(404, '订阅不存在')
      }
      await store.updateSubscribe(id)
      res.json(200, subscription)
    }
  )
}

/**
 * 规则集
 * @param {Router} router
 */
function registerRulesets(router) {
  const store = Plugins.useRulesetsStore()

  router.get(
    '/v1/rulesets',
    {
      description: {
        zh: '获取所有规则集'
      }
    },
    (req, res, params) => {
      res.json(200, store.rulesets)
    }
  )

  router.get(
    '/v1/rulesets/:id',
    {
      description: {
        zh: '获取某个规则集详情'
      }
    },
    (req, res, { id }) => {
      const ruleset = store.rulesets.find((v) => v.name === id || v.id === id)
      res.json(ruleset ? 200 : 404, ruleset)
    }
  )

  router.post(
    '/v1/rulesets',
    {
      description: {
        zh: '添加一个规则集'
      }
    },
    async (req, res, params) => {
      await store.addRuleset(req.body)
      res.json(201, 'No Content')
    }
  )

  router.put(
    '/v1/rulesets/:id',
    {
      description: {
        zh: '修改一个规则集'
      }
    },
    async (req, res, { id }) => {
      const ruleset = store.getRulesetById(id)
      if (!ruleset) {
        return res.json(404, '规则集不存在')
      }
      const _ruleset = Plugins.deepAssign(ruleset, req.body)
      await store.editRuleset(id, _ruleset)
      res.json(201, _ruleset)
    }
  )

  router.delete(
    '/v1/rulesets/:id',
    {
      description: {
        zh: '删除一个规则集'
      }
    },
    async (req, res, { id }) => {
      const ruleset = store.getRulesetById(id)
      if (!ruleset) {
        return res.json(404, '规则集不存在')
      }
      await store.deleteRuleset(id)
      res.json(204, 'No Content')
    }
  )

  router.post(
    '/v1/rulesets/:id/update',
    {
      description: {
        zh: '更新一个规则集'
      }
    },
    async (req, res, { id }) => {
      const ruleset = store.getRulesetById(id)
      if (!ruleset) {
        return res.json(404, '规则集不存在')
      }
      await store.updateRuleset(id)
      res.json(200, ruleset)
    }
  )
}

/**
 * 插件
 * @param {Router} router
 */
function registerPlugins(router) {
  const store = Plugins.usePluginsStore()

  router.get(
    '/v1/plugins',
    {
      description: {
        zh: '获取所有插件'
      }
    },
    (req, res, params) => {
      res.json(200, store.plugins)
    }
  )

  router.get(
    '/v1/plugins/:id',
    {
      description: {
        zh: '获取某个插件详情'
      }
    },
    (req, res, { id }) => {
      const plugin = store.plugins.find((v) => v.name === id || v.id === id)
      res.json(plugin ? 200 : 404, plugin)
    }
  )

  router.post(
    '/v1/plugins',
    {
      description: {
        zh: '添加一个插件'
      }
    },
    async (req, res, params) => {
      await store.addPlugin(req.body)
      res.json(201, '已创建')
    }
  )

  router.put(
    '/v1/plugins/:id',
    {
      description: {
        zh: '修改一个插件'
      }
    },
    async (req, res, { id }) => {
      const plugin = store.getPluginById(id)
      if (!plugin) {
        return res.json(404, '插件不存在')
      }
      const _plugin = Plugins.deepAssign(plugin, req.body)
      await store.editPlugin(id, _plugin)
      res.json(201, _plugin)
    }
  )

  router.delete(
    '/v1/plugins/:id',
    {
      description: {
        zh: '删除一个插件'
      }
    },
    async (req, res, { id }) => {
      const plugin = store.getPluginById(id)
      if (!plugin) {
        return res.json(404, '插件不存在')
      }
      await store.deletePlugin(id)
      res.json(204, 'No Content')
    }
  )

  router.post(
    '/v1/plugins/:id/update',
    {
      description: {
        zh: '更新一个插件'
      }
    },
    async (req, res, { id }) => {
      const plugin = store.getPluginById(id)
      if (!plugin) {
        return res.json(404, '插件不存在')
      }
      await store.updatePlugin(id)
      res.json(204, 'No Content')
    }
  )

  router.post(
    '/v1/plugins/:id/run',
    {
      description: {
        zh: '执行一个插件'
      }
    },
    async (req, res, { id }) => {
      const method = req.body.method || 'onRun'
      const args = req.body.args || []
      const result = await store.manualTrigger(id, method, ...args)
      res.json(200, result ?? '插件执行完毕，无返回值')
    }
  )
}

/**
 * 计划任务
 * @param {Router} router
 */
function registerScheduledTasks(router) {
  const store = Plugins.useScheduledTasksStore()

  router.get(
    '/v1/tasks',
    {
      description: {
        zh: '获取所有计划任务'
      }
    },
    (req, res, params) => {
      res.json(200, store.scheduledtasks)
    }
  )

  router.get(
    '/v1/tasks/:id',
    {
      description: {
        zh: '获取某个计划任务详情'
      }
    },
    (req, res, { id }) => {
      const task = store.getScheduledTaskById(id)
      res.json(task ? 200 : 404, task)
    }
  )

  router.post(
    '/v1/tasks',
    {
      description: {
        zh: '添加一个计划任务'
      }
    },
    async (req, res, params) => {
      await store.addScheduledTask(req.body)
      res.json(201, '已创建')
    }
  )

  router.put(
    '/v1/tasks/:id',
    {
      description: {
        zh: '修改一个计划任务'
      }
    },
    async (req, res, { id }) => {
      const task = store.getScheduledTaskById(id)
      if (!task) {
        return res.json(404, '计划任务不存在')
      }
      const _task = Plugins.deepAssign(task, req.body)
      await store.editScheduledTask(id, _task)
      res.json(201, _task)
    }
  )

  router.delete(
    '/v1/tasks/:id',
    {
      description: {
        zh: '删除一个计划任务'
      }
    },
    async (req, res, { id }) => {
      const task = store.getScheduledTaskById(id)
      if (!task) {
        return res.json(404, '计划任务不存在')
      }
      await store.deleteScheduledTask(id)
      res.json(204, 'No Content')
    }
  )

  router.post(
    '/v1/tasks/:id/run',
    {
      description: {
        zh: '执行一个计划任务'
      }
    },
    async (req, res, { id }) => {
      const task = store.getScheduledTaskById(id)
      if (!task) {
        return res.json(404, '计划任务不存在')
      }
      const result = await store.runScheduledTask(id)
      res.json(200, result)
    }
  )
}

/**
 * 核心管理
 * @param {Router} router
 */
function registerCores(router) {
  router.post(
    '/v1/cores/mode',
    {
      description: {
        zh: '切换核心工作模式'
      }
    },
    async (req, res) => {
      await Plugins.handleChangeMode(req.body.mode)
      res.json(200, '已切换')
    }
  )

  router.post(
    '/v1/cores/start',
    {
      description: {
        zh: '启动核心'
      }
    },
    async (req, res) => {
      const kernelApiStore = Plugins.useKernelApiStore()
      await kernelApiStore.startCore()
      res.json(200, '已启动')
    }
  )

  router.post(
    '/v1/cores/stop',
    {
      description: {
        zh: '停止核心'
      }
    },
    async (req, res) => {
      const kernelApiStore = Plugins.useKernelApiStore()
      await kernelApiStore.stopCore()
      res.json(200, '已停止')
    }
  )

  router.post(
    '/v1/cores/restart',
    {
      description: {
        zh: '重启核心'
      }
    },
    async (req, res) => {
      const kernelApiStore = Plugins.useKernelApiStore()
      await kernelApiStore.restartCore()
      res.json(200, '已重新启动')
    }
  )

  router.post(
    '/v1/cores/tun',
    {
      description: {
        zh: '开启/关闭TUN'
      }
    },
    async (req, res) => {
      const mode = req.body.mode
      const kernelApiStore = Plugins.useKernelApiStore()
      await kernelApiStore.updateConfig('tun', { enable: mode === 'on' })
      res.json(200, '已完成')
    }
  )
}

/**
 * GUI管理
 * @param {Router} router
 */
function registerGUI(router) {
  router.post(
    '/v1/gui/window',
    {
      description: {
        zh: '切换GUI窗口状态'
      }
    },
    async (req, res) => {
      const mode = req.body.mode
      if (mode === 'hide') {
        await Plugins.WindowHide()
      } else if (mode == 'show') {
        await Plugins.WindowShow()
        // 临时设置总在顶部显示
        setTimeout(() => {
          Plugins.WindowSetAlwaysOnTop(true)
          setTimeout(() => {
            Plugins.WindowSetAlwaysOnTop(false)
          }, 100)
        }, 100)
      }
      res.json(200, '已切换')
    }
  )

  router.post(
    '/v1/gui/systemproxy',
    {
      description: {
        zh: '设置/清除系统代理'
      }
    },
    async (req, res) => {
      const mode = req.body.mode
      const envStore = Plugins.useEnvStore()
      if (mode === 'set') {
        await envStore.setSystemProxy()
      } else if (mode == 'clear') {
        await envStore.clearSystemProxy()
      }
      res.json(200, '已完成')
    }
  )
}

/**
 * Router
 */
class Router {
  constructor() {
    this.routes = []
    this.middlewares = []
  }

  use(middleware) {
    this.middlewares.push(middleware)
  }

  register(method, path, metadata, handler) {
    const keys = []
    const regexPath = path.replace(/:(\w+)/g, (_, key) => {
      keys.push(key)
      return '([^\\/]+)'
    })
    const regex = new RegExp(`^${regexPath}$`)
    this.routes.push({ method, regex, keys, metadata, handler, path })
  }

  get(path, metadata, handler) {
    this.register('GET', path, metadata, handler)
  }

  post(path, metadata, handler) {
    this.register('POST', path, metadata, handler)
  }

  put(path, metadata, handler) {
    this.register('PUT', path, metadata, handler)
  }

  delete(path, metadata, handler) {
    this.register('DELETE', path, metadata, handler)
  }

  async match(req, res) {
    for (const middleware of this.middlewares) {
      const next = await middleware(req, res)
      if (!next) return
    }

    const { method, url } = req
    for (const route of this.routes) {
      const match = url.match(route.regex)
      if (match && route.method === method) {
        const params = route.keys.reduce((acc, key, index) => {
          acc[key] = decodeURIComponent(match[index + 1])
          return acc
        }, {})
        try {
          await route.handler(req, res, params)
        } catch (error) {
          res.json(500, error.message || error)
        }
        return
      }
    }
    res.json(404, 'Not Found')
  }
}

function authMiddleware(req, res) {
  return new Promise((resolve) => {
    const authHeader = req.headers['Authorization']
    if (!authHeader || authHeader !== 'Bearer ' + Plugin.ApiSecret) {
      res.json(401, 'Unauthorized')
      resolve(false)
    } else {
      resolve(true)
    }
  })
}

function withRequestBodyMiddleWare(req, res) {
  return new Promise(async (resolve) => {
    req.rawBody = req.body
    req.body = await Plugins.ignoredError(Plugins.base64Decode, req.body)
    if (req.headers['Content-Type']?.includes('application/json')) {
      req.body = await Plugins.ignoredError(JSON.parse, req.body)
    }
    resolve(true)
  })
}

function jsonMiddleware(req, res) {
  return new Promise((resolve) => {
    res.json = (code, data) => {
      res.end(code, { 'Content-Type': 'application/json' }, JSON.stringify(data))
    }
    resolve(true)
  })
}
