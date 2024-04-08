const onRun = async () => {
  console.log(Plugin)
}

/**
 * 插件钩子：右键 - 同步至本地
 */
const Sync = async () => {
  // const list = await httpGet('/backup')
  const list = [1]
  if (list.length === 0) throw '没有可同步的备份'
  const time = await Plugins.picker.single(
    '请选择要同步至本地的备份',
    [
      { label: '2024/4/9 1:04:40', value: 1 },
      { label: '2024/4/9 1:04:52', value: 2 },
      { label: '2024/4/9 1:04:55', value: 3 }
    ],
    [list.pop()]
  )

  // const files = await httpGet('/backup?time=' + time)
  const files = [1]
  const { id } = Plugins.message.info('正在同步...', 60 * 60 * 1000)
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    // await Plugins.Download(`http://${Plugin.ServerAddress}${file}`)
    Plugins.message.update(id, `正在同步...[ ${i + 1}/${files.length} ]`)
    await Plugins.sleep(500)
  }

  Plugins.message.update(id, '同步完成', 'success')
  await Plugins.sleep(1500).then(() => Plugins.message.destroy(id))
}

/**
 * 插件钩子：右键 - 立即备份
 */
const Backup = async () => {
  const files = ['data/user.yaml', 'data/profiles.yaml', 'data/subscribes.yaml', 'data/rulesets.yaml', 'data/plugins.yaml', 'data/scheduledtasks.yaml']

  const { id } = Plugins.message.info('正在备份...', 60 * 60 * 1000)
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const text = await Plugins.Readfile(file)
    const encrypted = encrypt(text)
    Plugins.message.update(id, `正在备份...[ ${i + 1}/${files.length} ]`)
    await httpPost('/backup', {
      time: new Date().toLocaleString(),
      text: encrypted
    })
    await Plugins.sleep(500)
  }

  Plugins.message.update(id, '备份完成', 'success')
  await Plugins.sleep(1500).then(() => Plugins.message.destroy(id))
}

const onInstall = async () => {
  await loadDependence()
}

const onUninstall = async () => {
  const dom = document.getElementById(Plugin.id)
  dom && dom.remove()
  window.CryptoJS = null
  delete window.CryptoJS
}

const onStartup = async () => {
  if (Plugin.installed) {
    await loadDependence()
  }
}

/**
 * 动态引入依赖
 */
function loadDependence() {
  return new Promise((resolve, reject) => {
    if (window.CryptoJS) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.id = Plugin.id
    script.src = 'https://unpkg.com/crypto-js@latest/crypto-js.js'
    script.onload = resolve
    script.onerror = () => reject('加载加密套件失败')
    document.body.appendChild(script)
  })
}

/**
 * 加密
 */
function encrypt(data) {
  if (!Plugin.Secret) throw '未配置密钥'
  return window.CryptoJS.AES.encrypt(data, Plugin.Secret).toString()
}

/**
 *解密
 */
function decrypt(data) {
  if (!Plugin.Secret) throw '未配置密钥'
  return window.CryptoJS.AES.decrypt(data, Plugin.Secret).toString(CryptoJS.enc.Utf8)
}

function httpGet(url) {
  return Plugins.HttpGet(`http://${Plugin.ServerAddress}${url}`, {
    'User-Agent': `GUI.for.Cores/${Plugin.id}`,
    Authentication: Plugin.Secret
  })
}

function httpPost(url, data) {
  return Plugins.HttpPost(
    `http://${Plugin.ServerAddress}${url}`,
    {
      UserAgent: `GUI.for.Cores/${Plugin.id}`,
      'Content-Type': 'application/json',
      Authentication: Plugin.Secret
    },
    data
  )
}
