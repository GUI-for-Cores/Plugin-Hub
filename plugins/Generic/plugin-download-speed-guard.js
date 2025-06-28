/* 触发器 手动触发 */
const onRun = async () => {
  const kernelApiStore = Plugins.useKernelApiStore()

  const groupName = Plugin.GroupName

  const change = async () => {
    const all = kernelApiStore.proxies[groupName].all
    const now = kernelApiStore.proxies[groupName].now
    let nextIndex = Math.min(all.indexOf(now) + 1, all.length)
    if (nextIndex >= all.length) {
      nextIndex = 0
    }

    const nextProxy = all[nextIndex]
    try {
      await Plugins.confirm('下载速率过慢', `当前下载速率过慢（低于阈值${Plugin.DownloadSpeed}MB/s），是否切换为下一个节点？\n\n${nextProxy}`)
    } catch (error) {
      // 不切？那我走了。
      console.log(`[${Plugin.name}]`, '用户选择了不切换，插件退出。')
      unregisterTrafficHandler()
      Plugins.message.warn('已退出监测')
      return
    }
    try {
      await Plugins.handleUseProxy(kernelApiStore.proxies[groupName], kernelApiStore.proxies[nextProxy])
      Plugins.message.success('切换成功')
    } catch (error) {
      console.log(`[${Plugin.name}]`, '尝试切换为下一个节点失败：', error)
    }
    count = 0
  }

  let count = 0
  const unregisterTrafficHandler = kernelApiStore.onTraffic(({ down }) => {
    const speed = Plugins.formatBytes(down)
    if (down > Number(Plugin.DownloadSpeed) * 1024 * 1024) {
      count = 0
      console.log(`[${Plugin.name}]`, '当前下载速率正常，无需切换：', speed)
      return
    }
    count += 1
    console.log(`[${Plugin.name}]`, `当前下载速率过慢：${speed}；超时阈值进度：${count}/${Plugin.MaxWaiting}`)

    // 达到最大等待时长（次数）
    if (count == Number(Plugin.MaxWaiting)) {
      console.log(`[${Plugin.name}]`, '下载速率过慢且超出最大等待时长，询问切换下一个节点')
      change()
    }
  })
  Plugins.message.success('正在监测下载速率')
}
