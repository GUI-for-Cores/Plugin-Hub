const { appName } = await Plugins.GetEnv()

const onSubscribe = async (proxies) => {
  if (appName.toLowerCase().includes('singbox')) {
    proxies = proxies.map((v, i) => ({ ...v, tag: v.tag + '_' + (i + 1) }))
  } else if (appName.toLowerCase().includes('clash')) {
    proxies = proxies.map((v, i) => ({ ...v, name: v.name + '_' + (i + 1) }))
  }
  return proxies
}
