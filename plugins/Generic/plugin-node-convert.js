/**
 * 本插件使用开源项目：https://github.com/sub-store-org/Sub-Store
 */

const PATH = 'data/third/node-convert'
const ProxyUtilsFile = PATH + '/proxy-utils.esm.mjs'

/** @type {EsmPlugin} */
export default async () => {
  let parse, produce

  // TODO: 等待GUI支持import本地文件
  const loadModule = async () => {
    const source = await Plugins.ReadFile(ProxyUtilsFile)
    const blob = new Blob([source], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    try {
      ;({ parse, produce } = await import(url))
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  await loadModule().catch(() => {
    Plugins.message.warn('请右键更新依赖')
  })

  /**
   * 插件右键菜单 - 更新依赖
   */
  const Update = async () => {
    const { body } = await Plugins.HttpGet('https://api.github.com/repos/sub-store-org/Sub-Store/releases/latest')
    const url = body.assets.find((v) => v.uploader.login === 'github-actions[bot]' && v.name === 'proxy-utils.esm.mjs')?.browser_download_url
    if (!url) {
      Plugins.message.error('未找到依赖: proxy-utils.esm.mjs')
      return
    }
    await Plugins.Download(url, ProxyUtilsFile)
    await loadModule()
    Plugins.message.success('更新成功')
  }

  const onInstall = async () => {
    await Update()
  }

  const onUninstall = async () => {
    await Plugins.RemoveFile(PATH)
  }

  /**
   * 订阅上下文菜单 - 导出为URI
   */
  const ExportAsURI = async (subscription) => {
    const proxies = await getClashProxies(subscription)
    const v2ray_proxies = produce(proxies, 'v2ray', 'internal')
    await Plugins.ClipboardSetText(v2ray_proxies)
    Plugins.message.success('已复制')
  }

  /**
   * 订阅上下文菜单 - 导出为clash
   */
  const ExportAsClash = async (subscription) => {
    const proxies = await getClashProxies(subscription)
    await Plugins.ClipboardSetText(JSON.stringify(proxies))
    Plugins.message.success('已复制')
  }

  /**
   * 订阅上下文菜单 - 导出为sing-box
   */
  const ExportAsSingBox = async (subscription) => {
    const proxies = await getClashProxies(subscription)
    const singbox_proxies = produce(proxies, 'singbox', 'internal')
    await Plugins.ClipboardSetText(JSON.stringify(singbox_proxies))
    Plugins.message.success('已复制')
  }

  /**
   * 获取clash格式的节点
   */
  const getClashProxies = async (subscription) => {
    let sub_path = subscription.path
    if (Plugins.APP_TITLE.includes('SingBox')) {
      const tmp = 'data/.cache/tmp_subscription_' + subscription.id
      if (!(await Plugins.FileExists(tmp))) {
        await Plugins.alert(
          '提示',
          '你需要先更新此订阅，才能继续使用本功能！\n\n\n一直看见本提示？请`编辑`订阅在请求头中添加`User-Agent`=`clash.meta`后再更新订阅。\n\n注：手动管理的订阅不支持导出',
          {
            type: 'markdown'
          }
        )
        return
      }
      sub_path = tmp
    }
    const { proxies } = Plugins.YAML.parse(await Plugins.ReadFile(sub_path))
    return proxies
  }

  /**
   * 插件钩子：点击运行按钮时
   */
  const onRun = async () => {
    const input = await Plugins.prompt('请输入分享链接：', '', {
      placeholder: '(ss|ssr|vmess|vless|hysteria2|hysteria|tuic|wireguard|trojan)://',
      type: 'code'
    })

    const mihomo_proxies = parse(input)
    const singbox_proxies = produce(mihomo_proxies, 'singbox', 'internal')
    const v2ray_proxies = produce(mihomo_proxies, 'v2ray', 'internal')

    const platform = await Plugins.picker.single('请选择格式', [
      { label: 'Mihomo格式', value: 'mihomo' },
      { label: 'SingBox格式', value: 'singbox' },
      { label: 'v2Ray格式', value: 'v2ray' }
    ])

    // prettier-ignore
    const result = platform == 'singbox' ? JSON.stringify(singbox_proxies, null, 2) : platform == 'mihomo' ? Plugins.YAML.stringify(mihomo_proxies) : v2ray_proxies

    await Plugins.confirm('转换结果如下', result)
  }

  /**
   * 插件钩子：更新订阅时
   */
  const onSubscribe = async (proxies, subscription) => {
    const isBase64 = proxies.length === 1 && proxies[0].base64

    // 如果是v2ray分享链接，则转为clash格式
    if (isBase64) {
      proxies = parse(proxies[0].base64)
    }

    const isClashProxies = proxies.some((proxy) => proxy.name && !proxy.tag)

    const isGFS = Plugins.APP_TITLE.includes('SingBox')

    // 缓存clash格式，导出URI时需要此格式
    if (isClashProxies && isGFS) {
      const tmp = 'data/.cache/tmp_subscription_' + subscription.id
      Plugins.WriteFile(tmp, Plugins.YAML.stringify({ proxies }))
    }

    // 如果是clash格式，并且是GFS，则转为sing-box格式
    if (isClashProxies && isGFS) {
      proxies = produce(proxies, 'singbox', 'internal')
    }

    if (isGFS) {
      // 移除暂未适配的字段
      proxies.forEach((proxy) => {
        delete proxy.domain_resolver
      })
    }

    return proxies
  }

  return { onInstall, onUninstall, onRun, Update, onSubscribe, ExportAsURI, ExportAsSingBox, ExportAsClash }
}
