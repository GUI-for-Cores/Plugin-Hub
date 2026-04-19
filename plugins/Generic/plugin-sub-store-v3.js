/**
 * 本插件使用项目：https://github.com/sub-store-org/Sub-Store
 */

const PATH = 'data/third/sub-store-v3'
const USER_PROFILE = PATH + '/user.json'
const BACKEND_FILE = PATH + '/sub-store.min.js'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const ui_id = Plugin.id + '_UI'
  const src = `https://sub-store.vercel.app/subs?api=http://${Plugin.Address}`
  const appStore = Plugins.useAppStore()

  const openSubStoreUI = () => {
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

  const add_ui = () => {
    appStore.removeCustomActions('core_state', [ui_id])
    appStore.addCustomActions('core_state', {
      id: ui_id,
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
  const del_ui = () => {
    appStore.removeCustomActions('core_state', [ui_id])
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
    await Plugins.RemoveFile(PATH)
    return 0
  }

  /**
   * 插件钩子 - 点击运行按钮时
   */
  const onRun = async () => {
    if (!(await isSubStoreRunning())) {
      await startSubStoreService()
    }
    openSubStoreUI()
    return 1
  }

  /**
   * 插件钩子 - APP就绪时
   */
  const onReady = async () => {
    if (Plugin.AutoStart && !(await isSubStoreRunning())) {
      await startSubStoreService()
      return 1
    }
    if (await isSubStoreRunning()) {
      // 重启服务，恢复web服务的处理程序
      await stopSubStoreService()
      await startSubStoreService()
      return 1
    }
    return 2
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
    isRunning && (await stopSubStoreService())
    await onInstall()
    isRunning && (await startSubStoreService())
    Plugins.message.success('更新成功')
    return isRunning ? 1 : 2
  }

  /**
   * 启动Sub-Store服务
   */
  const startSubStoreService = async () => {
    const SUBSTORE_BANNER_REGEXP = /console\.log\(`\s*(?:┅|\\u2505){10,}\s+Sub-Store\s+--\s+v\$\{[^}]+\}\s+(?:┅|\\u2505){10,}\s*`\);?/g
    const SUBSTORE_SOURCE_CODE = (await Plugins.ReadFile(BACKEND_FILE)).replace(SUBSTORE_BANNER_REGEXP, '')
    const runSubStore = new AsyncFunction(
      '$request',
      /* javascript */ `
        /* Code snippet injected by GUI.for.Cores . start */
        var $Plugins = Plugins;
        var $Plugin = ${JSON.stringify(Plugin)};
        var $done;
        var $donePromise = new Promise((resolve) => ($done = resolve));
        /* Code snippet injected by GUI.for.Cores . end */

        ${SUBSTORE_SOURCE_CODE}

        /* Code snippet injected by GUI.for.Cores . start */
        return await $donePromise;
        /* Code snippet injected by GUI.for.Cores . end */
      `
    )

    /**
     * 提供此方法供Sub-Store进行类似localStorage.setItem/getItem/removeItem的操作
     * 此方法必须是同步的; 同时加入防抖进行性能优化:)
     */
    Plugins.SubStoreCache = {
      data: JSON.parse((await Plugins.ignoredError(Plugins.ReadFile, USER_PROFILE)) || '{}'),
      sync: Plugins.debounce(() => {
        // @ts-ignore
        Plugins.WriteFile(USER_PROFILE, JSON.stringify(Plugins.SubStoreCache.data, null, 2))
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
      if (req.method === 'OPTIONS') {
        return res.end(
          204,
          {
            'Content-Type': 'text/plain; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PATCH, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
          },
          ''
        )
      }
      if (/^\/api|^\/download/.test(req.url)) {
        try {
          const response = await runSubStore({
            ...req,
            url: `http://127.0.0.1${req.url}`,
            body: Plugins.base64Decode(req.body)
          })
          return res.end(response.status, response.headers, response.body)
        } catch (error) {
          return res.end(500, { 'Content-Type': 'text/plain; charset=utf-8' }, error.message || String(error))
        }
      }
      res.end(200, { 'Content-Type': 'text/html; charset=utf-8' }, 'The Sub-Store Backend is running... Have a nice day :)')
    })
    add_ui()
  }

  /**
   * 停止Sub-Store服务
   */
  const stopSubStoreService = async () => {
    await Plugins.StopServer(Plugin.id)
    del_ui()
  }

  /**
   * 检测Sub-Store是否在运行
   */
  const isSubStoreRunning = async () => {
    return (await Plugins.ListServer()).includes(Plugin.id)
  }

  const onDispose = async () => {
    await Plugins.StopServer(Plugin.id).catch(() => {})
    del_ui()
  }

  return { onInstall, onUninstall, onRun, onReady, Start, Stop, Update, onDispose }
}
