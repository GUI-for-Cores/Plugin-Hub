/* Trigger on::manual */
const onRun = async () => {
  await Plugins.ignoredError(Stop, false);
  await Start();
  return 1;
};

/* Trigger on::configure */
const onConfigure = async (config, old) => {
  if (config.ApiAddress !== old.ApiAddress || config.ApiPort !== old.ApiPort || config.ApiSecret !== old.ApiSecret) {
    await onRun();
  }
};

const Start = async (feedback = true) => {
  const router = new Router();

  router.use(jsonMiddleware);
  Plugin.ApiSecret && router.use(authMiddleware);

  registerSubscriptions(router);
  registerAppSettings(router);
  registerProfiles(router);
  registerRulesets(router);
  registerPlugins(router);

  await Plugins.StartServer(Plugin.ApiAddress + ':' + Plugin.ApiPort, Plugin.id, async (req, res) => {
    router.match(req, res);
  });

  feedback && (await Plugins.message.success('RESTful Api 启动成功'));
  return 1;
};

const Stop = async (feedback = true) => {
  await Plugins.StopServer(Plugin.id);
  feedback && (await Plugins.message.success('RESTful Api 停止成功'));
  return 2;
};

function registerAppSettings(router) {
  router.get('/settings', (req, res, params) => {
    const store = Plugins.useAppSettingsStore();
    res.json(200, store.app);
  });
}

function registerProfiles(router) {
  router.get('/profiles', (req, res, params) => {
    const store = Plugins.useProfilesStore();
    res.json(200, store.profiles);
  });

  router.get('/profiles/:id', (req, res, params) => {
    const id = decodeURIComponent(params.id);
    const store = Plugins.useProfilesStore();
    const profile = store.profiles.find((v) => v.name === id || v.id === id);
    res.json(profile ? 200 : 404, profile);
  });
}

function registerSubscriptions(router) {
  router.get('/subscriptions', (req, res, params) => {
    const store = Plugins.useSubscribesStore();
    res.json(200, store.subscribes);
  });

  router.get('/subscriptions/:id', (req, res, params) => {
    const id = decodeURIComponent(params.id);
    const store = Plugins.useSubscribesStore();
    const subscription = store.subscribes.find((v) => v.name === id || v.id === id);
    res.json(subscription ? 200 : 404, subscription);
  });
}

function registerRulesets(router) {
  router.get('/rulesets', (req, res, params) => {
    const store = Plugins.useRulesetsStore();
    res.json(200, store.rulesets);
  });

  router.get('/rulesets/:id', (req, res, params) => {
    const id = decodeURIComponent(params.id);
    const store = Plugins.useRulesetsStore();
    const ruleset = store.rulesets.find((v) => v.name === id || v.id === id);
    res.json(ruleset ? 200 : 404, ruleset);
  });
}

function registerPlugins(router) {
  router.get('/plugins', (req, res, params) => {
    const store = Plugins.usePluginsStore();
    res.json(200, store.plugins);
  });

  router.get('/plugins/:id', (req, res, params) => {
    const id = decodeURIComponent(params.id);
    const store = Plugins.usePluginsStore();
    const plugin = store.plugins.find((v) => v.name === id || v.id === id);
    res.json(plugin ? 200 : 404, plugin);
  });
}

/**
 * Router
 */
class Router {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }

  use(middleware) {
    this.middlewares.push(middleware);
  }

  register(method, path, handler) {
    const keys = [];
    const regexPath = path.replace(/:(\w+)/g, (_, key) => {
      keys.push(key);
      return '([^\\/]+)';
    });
    const regex = new RegExp(`^${regexPath}$`);
    this.routes.push({ method, regex, keys, handler });
  }

  get(path, handler) {
    this.register('GET', path, handler);
  }

  post(path, handler) {
    this.register('POST', path, handler);
  }

  put(path, handler) {
    this.register('PUT', path, handler);
  }

  delete(path, handler) {
    this.register('DELETE', path, handler);
  }

  async match(req, res) {
    for (const middleware of this.middlewares) {
      const next = await middleware(req, res);
      if (!next) return;
    }

    const { method, url } = req;
    for (const route of this.routes) {
      const match = url.match(route.regex);
      if (match && route.method === method) {
        const params = route.keys.reduce((acc, key, index) => {
          acc[key] = match[index + 1];
          return acc;
        }, {});
        return await route.handler(req, res, params);
      }
    }
    res.json(404, 'Not Found');
  }
}

function authMiddleware(req, res) {
  return new Promise((resolve) => {
    const authHeader = req.headers['Authorization'];
    if (!authHeader || authHeader !== 'Bearer ' + Plugin.ApiSecret) {
      res.json(401, 'Unauthorized');
      resolve(false);
    } else {
      resolve(true);
    }
  });
}

function jsonMiddleware(req, res) {
  return new Promise((resolve) => {
    res.json = (code, data) => {
      res.end(code, { 'Content-Type': 'application/json' }, JSON.stringify(data));
    };
    resolve(true);
  });
}
