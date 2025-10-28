const openClashDashboard = async () => {
  let url

  let dashboardUrl = 'https://metacubexd.pages.dev'
  if (Plugin.xd_url) {
    dashboardUrl = Plugin.xd_url
  }
  if (Plugins.APP_TITLE.includes('SingBox')) {
    const configpath = './data/sing-box/config.json'

    // 读取 JSON 文件
    const jsonContent = await Plugins.ReadFile(configpath)

    // 解析 JSON 内容
    const jsonData = JSON.parse(jsonContent)

    // 将 JSON 中的值赋给不同的变量
    const localAddress = jsonData['experimental']['clash_api']['external_controller']
    const secret = jsonData['experimental']['clash_api']['secret']

    // 解构localAddress获取主机和端口
    const [, port] = localAddress.split(':')

    // 构建URL
    url = `${dashboardUrl}/?hostname=127.0.0.1&port=${port}&secret=${secret}&http=1`
  } else if (Plugins.APP_TITLE.includes('Clash')) {
    const configpath = './data/mihomo/config.yaml'

    // 读取 YAML 文件
    const yamlContent = await Plugins.ReadFile(configpath)

    // 解析 YAML 内容
    const yamlData = Plugins.YAML.parse(yamlContent)

    // 将 YAML 中的值赋给不同的变量
    const localAddress = yamlData['external-controller']
    const secret = yamlData['secret']

    // 解构localAddress获取主机和端口
    const [, port] = localAddress.split(':')

    // 构建URL
    url = `${dashboardUrl}/?hostname=127.0.0.1&port=${port}&secret=${secret}&http=1`
  }

  window.open(url)
}

const onRun = async () => {
  await openClashDashboard()
}

const onShutdown = async () => {
  await openClashDashboard()
}
const onReady = async () => {
  if (Plugin.start_onboot) {
    return await onRun()
  }
}
