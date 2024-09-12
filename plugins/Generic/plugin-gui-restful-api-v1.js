/* Trigger on::manual */
const onRun = async () => {
  await Plugins.ignoredError(Stop, false)
  await Start()
  return 1
}

/* Trigger on::configure */
const onConfigure = async (config, old) => {
  if (config.ApiAddress !== old.ApiAddress || config.ApiPort !== old.ApiPort || config.ApiSecret !== old.ApiSecret) {
    await onRun()
  }
}

const Start = async (feedback = true) => {
  const router = new Router()

  router.use(jsonMiddleware)
  router.use(withRequestBodyMiddleWare)
  Plugin.ApiSecret && router.use(authMiddleware)

  registerAppSettings(router)
  registerProfiles(router)
  registerSubscriptions(router)
  registerRulesets(router)
  registerPlugins(router)
  registerScheduledTasks(router)

  registerDocument(router)

  await Plugins.StartServer(Plugin.ApiAddress + ':' + Plugin.ApiPort, Plugin.id, async (req, res) => {
    router.match(req, res)
  })

  feedback && (await Plugins.message.success('RESTful Api 启动成功'))
  return 1
}

const Stop = async (feedback = true) => {
  await Plugins.StopServer(Plugin.id)
  feedback && (await Plugins.message.success('RESTful Api 停止成功'))
  return 2
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
      const profile = store.profiles.find((v) => v.name === id || v.id === id)
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
      res.json(201, 'OK')
    }
  )

  router.put(
    '/v1/profiles',
    {
      description: {
        zh: '修改一个配置'
      }
    },
    async (req, res, params) => {
      const profile = store.getProfileById(req.body.id)
      if (!profile) {
        return res.json(404, '配置不存在')
      }
      const _profile = Plugins.deepAssign(profile, req.body)
      await store.editProfile(req.body.id, _profile)
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
      const subscription = store.subscribes.find((v) => v.name === id || v.id === id)
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
      res.json(201, 'OK')
    }
  )

  router.put(
    '/v1/subscriptions',
    {
      description: {
        zh: '修改一个订阅'
      }
    },
    async (req, res, params) => {
      const subscription = store.getSubscribeById(req.body.id)
      if (!subscription) {
        return res.json(404, '订阅不存在')
      }
      const _subscription = Plugins.deepAssign(subscription, req.body)
      await store.editSubscribe(req.body.id, _subscription)
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
      let proxies = await Plugins.Readfile(subscription.path)
      if (Plugins.APP_TITLE.includes('Clash')) {
        proxies = Plugins.YAML.parse(proxies)
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
      res.json(200, 'No Content')
    }
  )

  router.put(
    '/v1/rulesets/:id',
    {
      description: {
        zh: '修改一个规则集'
      }
    },
    async (req, res, params) => {
      const ruleset = store.getRulesetById(req.body.id)
      if (!ruleset) {
        return res.json(404, '规则集不存在')
      }
      const _ruleset = Plugins.deepAssign(ruleset, req.body)
      await store.editRuleset(req.body.id, _ruleset)
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
    (req, res, params) => {}
  )

  router.put(
    '/v1/plugins/:id',
    {
      description: {
        zh: '修改一个插件'
      }
    },
    (req, res, params) => {}
  )

  router.delete(
    '/v1/plugins/:id',
    {
      description: {
        zh: '删除一个插件'
      }
    },
    (req, res, params) => {}
  )

  router.post(
    '/v1/plugins/:id',
    {
      description: {
        zh: '更新一个插件'
      }
    },
    (req, res, params) => {}
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
      const task = store.scheduledtasks.find((v) => v.name === id || v.id === id)
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
    (req, res, params) => {}
  )

  router.put(
    '/v1/tasks/:id',
    {
      description: {
        zh: '修改一个计划任务'
      }
    },
    (req, res, params) => {}
  )

  router.delete(
    '/v1/tasks/:id',
    {
      description: {
        zh: '删除一个计划任务'
      }
    },
    (req, res, params) => {}
  )

  router.post(
    '/v1/tasks/:id',
    {
      description: {
        zh: '更新一个计划任务'
      }
    },
    (req, res, params) => {}
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
        return await route.handler(req, res, params)
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
