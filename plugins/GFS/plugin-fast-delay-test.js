/** @type {EsmPlugin} */
export default (Plugin) => {
  const tmpPath = `data/.cache/${Plugin.id}`
  const testUrl = TEST_URL_MAP[Plugin['test_url']]
  const testTimeout = Plugin['test_timeout']
  const concurrencyLimit = Number(Plugin['concurrency_limit'])
  const appSettingsStore = Plugins.useAppSettingsStore()
  const kernelApiStore = Plugins.useKernelApiStore()
  const subscribesStore = Plugins.useSubscribesStore()
  const corePidMap = new Map()
  const testDelay = async (subscription) => {
    if (await Plugins.FileExists(tmpPath)) {
      await Plugins.MakeDir(tmpPath)
    }
    if (corePidMap.get(subscription.id)) {
      throw `订阅 [${subscription.name}] 已在测试中，请勿重复执行`
    }
    const proxies = await Plugins.ReadFile(subscription.path)
      .then((c) => JSON.parse(c))
      .catch(() => [])
    if (proxies.length === 0) {
      throw '缺少节点/数据读取失败'
    }
    if (kernelApiStore.running) {
      Plugins.message.warn('核心运行中，可能影响测试结果，请自行评估')
    }
    const secret = Plugins.generateSecureKey()
    const randomPort = Math.floor(Math.random() * 30000) + 30000
    const controller = `127.0.0.1:${randomPort}`
    const baseUrl = `http://${controller}`
    const testConfigPath = `${tmpPath}/config_${subscription.id}.json`
    const runtimeConfig = {
      ...BASE_CONFIG,
      outbounds: proxies,
      experimental: {
        ...BASE_CONFIG.experimental,
        clash_api: {
          external_controller: controller,
          secret
        }
      }
    }
    await Plugins.WriteFile(testConfigPath, JSON.stringify(runtimeConfig))
    const corePid = await runCore(testConfigPath)
    corePidMap.set(subscription.id, corePid)
    Plugins.message.info('开始测试延迟，完成后将发送通知')
    let index = 0
    let success = 0
    let failure = 0
    const totalCount = proxies.length
    const { update, destroy, success: msgSuccess } = Plugins.message.info(`[${subscription.name}] 测试中...`, 999999)
    const proxyUpdateMap = new Map()
    const completedProxies = await Plugins.asyncPool(concurrencyLimit, proxies, async (proxy) => {
      index += 1
      update(`[${subscription.name}] 测试中... ${index} / ${totalCount}, 成功：${success} 失败：${failure}`)
      const delay = await getProxyDelay({
        baseUrl,
        proxy: proxy.tag,
        testUrl,
        timeout: testTimeout,
        secret
      })
      if (delay > 0) {
        success += 1
      } else {
        failure += 1
      }
      const newTag = `${proxy.tag.replace(/(\s*\[-?[\d.]+ms\])?$/, ` [${delay}ms]`)}`
      proxyUpdateMap.set(proxy.tag, { newTag, delay })
      update(`[${subscription.name}] 测试中... ${index} / ${totalCount}, 成功：${success} 失败：${failure}`)
      return {
        ...proxy,
        tag: newTag
      }
    })
    await stopCore(subscription.id)
    await Plugins.RemoveFile(testConfigPath)
    await Plugins.WriteFile(
      subscription.path,
      JSON.stringify(
        completedProxies.map((p) => p.value),
        null,
        2
      )
    )
    subscription.proxies.sort((a, b) => {
      const delayA = proxyUpdateMap.get(a.tag)?.delay ?? -1
      const delayB = proxyUpdateMap.get(b.tag)?.delay ?? -1
      const valA = delayA <= 0 ? Infinity : delayA
      const valB = delayB <= 0 ? Infinity : delayB
      return valA - valB
    })
    subscription.proxies.forEach((p) => {
      if (proxyUpdateMap.has(p.tag)) {
        p.tag = proxyUpdateMap.get(p.tag).newTag
      }
    })
    await subscribesStore.editSubscribe(subscription.id, subscription)
    const successMsg = `订阅 [${subscription.name}] 测试完成`
    msgSuccess(`${successMsg} ${index} / ${totalCount}, 成功：${success} 失败：${failure}`)
    Plugins.Notify(successMsg)
    await Plugins.sleep(3_000)
    destroy()
  }
  const runCore = async (targetConfigPath) => {
    const isAlpha = appSettingsStore.app.kernel.branch === 'alpha'
    const core = await Plugins.getKernelFileName(isAlpha)
    const [corePath, configPath, workingDir] = await Promise.all([
      Plugins.AbsolutePath(`data/sing-box/${core}`),
      Plugins.AbsolutePath(targetConfigPath),
      Plugins.AbsolutePath(tmpPath)
    ])
    return new Promise((resolve, reject) => {
      let output
      const pid = Plugins.ExecBackground(
        corePath,
        ['run', '--disable-color', '-c', configPath, '-D', workingDir],
        (out) => {
          output = out
          if (out.includes(CORE_STOP_OUTPUT_KEYWORD)) {
            resolve(pid)
          }
        },
        () => {
          reject(output)
        },
        {
          StopOutputKeyword: CORE_STOP_OUTPUT_KEYWORD
        }
      ).catch((e) => reject(e))
    })
  }
  const stopCore = async (subId) => {
    const pid = corePidMap.get(subId)
    if (!pid) return
    await Plugins.KillProcess(pid).catch(() => {})
    corePidMap.delete(subId)
  }
  const getProxyDelay = async (opts) => {
    const { baseUrl, proxy, testUrl, timeout, secret } = opts
    const url = new URL(`${baseUrl}/proxies/${encodeURIComponent(proxy)}/delay`)
    url.searchParams.append('url', testUrl)
    url.searchParams.append('timeout', timeout)
    try {
      const { body } = await Plugins.HttpGet(
        url.toString(),
        {
          Authorization: `Bearer ${secret}`
        },
        {
          Timeout: Number(timeout)
        }
      )
      return body?.delay ?? -1
    } catch (err) {
      console.log(`${Plugin.name}`, err)
      return -1
    }
  }
  return {
    testDelay,
    onInstall: async () => {
      await Plugins.MakeDir(tmpPath)
    },
    onUninstall: async () => {
      await Plugins.RemoveFile(tmpPath)
    },
    onShutdown: async () => {
      for (const pid of corePidMap.values()) {
        await Plugins.KillProcess(pid).catch(() => {})
      }
    }
  }
}
const CORE_STOP_OUTPUT_KEYWORD = 'sing-box started'
const TEST_URL_MAP = {
  Google: 'http://www.gstatic.com/generate_204',
  Cloudflare: 'http://cp.cloudflare.com/generate_204',
  Qualcomm: 'http://www.qualcomm.cn/generate_204',
  Apple: 'http://www.apple.com/library/test/success.html',
  Microsoft: 'http://www.msftconnecttest.com/connecttest.txt'
}
const BASE_CONFIG = {
  log: {
    level: 'info',
    timestamp: true
  },
  dns: {
    servers: [
      {
        tag: 'dns-ali',
        type: 'https',
        server: 'dns.alidns.com',
        domain_resolver: 'dns-hosts'
      },
      {
        tag: 'dns-hosts',
        type: 'hosts',
        predefined: {
          'dns.alidns.com': ['223.5.5.5', '223.6.6.6']
        }
      }
    ]
  },
  ntp: {
    enabled: true,
    server: 'ntp.aliyun.com',
    server_port: 123
  },
  outbounds: [],
  route: {
    auto_detect_interface: true,
    default_domain_resolver: 'dns-ali'
  },
  experimental: {
    clash_api: {
      external_controller: '',
      secret: ''
    }
  }
}
