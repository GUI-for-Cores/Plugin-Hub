const onSubscribe = async (/** @type {any} */ proxies) => {
  const isSingBox = Plugins.APP_TITLE.includes('SingBox')
  const isClash = Plugins.APP_TITLE.includes('Clash')

  const seenEndpoints = new Set()
  const uniqueProxies = []
  const removedProxies = []

  // 1. Identify and separate unique vs. duplicate proxies.
  for (const proxy of proxies) {
    const endpoint = `${proxy.server}:${proxy.server_port || proxy.port}`
    if (seenEndpoints.has(endpoint)) {
      removedProxies.push(proxy)
    } else {
      seenEndpoints.add(endpoint)
      uniqueProxies.push(proxy)
    }
  }

  // 2. Notify the user about which duplicate proxies were removed.
  if (removedProxies.length > 0) {
    const removedProxyNames = removedProxies
      .map((proxy) => {
        if (isSingBox) return proxy.tag
        if (isClash) return proxy.name
        return proxy.name || proxy.tag || 'Unknown Proxy'
      })
      .join(', ')

    const message = `Removed ${removedProxies.length} duplicate proxies: ${removedProxyNames}`
    Plugins.message.success(message)
  }

  // 3. Apply the original renaming logic to the now-unique list of proxies.
  let processedProxies = uniqueProxies
  if (isSingBox) {
    processedProxies = uniqueProxies.map((proxy, i) => ({ ...proxy, tag: `${proxy.tag}_${i + 1}` }))
  } else if (isClash) {
    processedProxies = uniqueProxies.map((proxy, i) => ({ ...proxy, name: `${proxy.name}_${i + 1}` }))
  }

  return processedProxies
}
