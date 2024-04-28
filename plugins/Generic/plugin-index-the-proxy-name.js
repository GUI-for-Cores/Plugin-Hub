const onSubscribe = async (proxies) => {
  if (Plugins.APP_TITLE.includes('SingBox')) {
    proxies = proxies.map((v, i) => ({ ...v, tag: v.tag + '_' + (i + 1) }))
  } else if (Plugins.APP_TITLE.includes('Clash')) {
    proxies = proxies.map((v, i) => ({ ...v, name: v.name + '_' + (i + 1) }))
  }
  return proxies
}
