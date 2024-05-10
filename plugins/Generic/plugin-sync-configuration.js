/**
 * 本插件使用项目：https://github.com/GUI-for-Cores/gui-sync
 */

const PATH = 'data/third/sync-gui'
const JS_FILE = PATH + '/crypto-js.js'

const onRun = async () => {
  const action = await Plugins.picker.single(
    '请选择操作',
    [
      { label: '立即备份', value: 'backup' },
      { label: '同步至本地', value: 'sync' },
      { label: '查看备份列表', value: 'list' },
      { label: '管理备份列表', value: 'remove' }
    ],
    []
  )

  const handler = {
    backup: Backup,
    sync: Sync,
    list: List,
    remove: Remove
  }

  await handler[action]()
}

/**
 * 插件钩子：右键 - 同步至本地
 */
const Sync = async () => {
  if (!window.CryptoJS) throw '请先安装插件或重新安装插件'

  const list = await httpGet('/backup')
  const _list = filterList(list)
  if (_list.length === 0) throw '没有可同步的备份'
  const backupId = await Plugins.picker.single('请选择要同步至本地的备份', _list, [list.shift()])

  const files = await httpGet('/backup?id=' + backupId)

  const { id } = Plugins.message.info('正在同步...', 60 * 60 * 1000)
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    Plugins.message.update(id, `正在同步...[ ${i + 1}/${files.length} ]`)
    try {
      const encrypted = await httpGet(`/file?path=${backupId}/${file}`)
      await Plugins.Writefile(file, decrypt(encrypted))
    } catch (error) {
      console.log(error)
      Plugins.message.update(id, `[${file}] 同步失败`, 'error')
    } finally {
      await Plugins.sleep(100)
    }
  }

  Plugins.message.update(id, '同步完成，即将重载界面', 'success')
  await Plugins.sleep(1500).then(() => Plugins.message.destroy(id))

  const kernelApiStore = Plugins.useKernelApiStore()
  await kernelApiStore.stopKernel()

  await Plugins.WindowReloadApp()
}

/**
 * 插件钩子：右键 - 立即备份
 */
const Backup = async () => {
  if (!window.CryptoJS) throw '请先安装插件或重新安装插件'

  const files = ['data/user.yaml', 'data/profiles.yaml', 'data/subscribes.yaml', 'data/rulesets.yaml', 'data/plugins.yaml', 'data/scheduledtasks.yaml']

  const subscribesStore = Plugins.useSubscribesStore()
  const pluginsStore = Plugins.usePluginsStore()
  const rulesetsStore = Plugins.useRulesetsStore()

  const l1 = subscribesStore.subscribes.map((v) => v.path).filter((v) => v.startsWith('data'))
  const l2 = pluginsStore.plugins.map((v) => v.path).filter((v) => v.startsWith('data'))
  const l3 = rulesetsStore.rulesets.map((v) => v.path).filter((v) => v.startsWith('data') && (v.endsWith('yaml') || v.endsWith('json')))

  files.push(...l1, ...l2, ...l3)

  const { id } = Plugins.message.info('正在备份...', 60 * 60 * 1000)
  const backupId = Date.now().toString()
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    Plugins.message.update(id, `正在备份...[ ${i + 1}/${files.length} ]`)
    try {
      const text = await Plugins.Readfile(file)
      const encrypted = encrypt(text)
      await httpPost('/file', {
        id: backupId,
        file: file,
        body: encrypted
      })
    } catch (error) {
      console.log(error)
      Plugins.message.update(id, `[${file}] 备份失败`, 'error')
    } finally {
      await Plugins.sleep(100)
    }
  }

  Plugins.message.update(id, '备份完成', 'success')
  await Plugins.sleep(1500).then(() => Plugins.message.destroy(id))
}

const List = async () => {
  const list = await httpGet('/backup')
  const _list = filterList(list)
  if (_list.length === 0) throw '备份列表为空'
  await Plugins.picker.single('服务器备份列表如下：', _list, [])
}

const Remove = async () => {
  const list = await httpGet('/backup')
  const _list = filterList(list)
  if (_list.length === 0) throw '没有可管理的备份'
  const ids = await Plugins.picker.multi('请勾选要删除的备份', _list, [])
  await httpDelete('/backup?ids=' + ids.join(','))
  Plugins.message.success('删除成功')
}

const onInstall = async () => {
  await Plugins.Download('https://unpkg.com/crypto-js@latest/crypto-js.js', JS_FILE)
  await loadDependence()
  return 0
}

const onUninstall = async () => {
  const dom = document.getElementById(Plugin.id)
  dom && dom.remove()
  window.CryptoJS = null
  delete window.CryptoJS
  await Plugins.Removefile(PATH)
  return 0
}

const onReady = async () => {
  await loadDependence()
}

const filterList = (list) => {
  return list.reverse().map((v) => {
    const date = new Date(Number(v))
    const YYYY = date.getFullYear()
    const MM = date.getMonth() + 1
    const DD = date.getDate()
    const hh = date.getHours()
    const mm = date.getMinutes()
    const ss = date.getSeconds()
    return { label: `${YYYY}/${MM}/${DD} ${hh}:${mm}:${ss}`, value: v }
  })
}

/**
 * 动态引入依赖
 */
function loadDependence() {
  return new Promise(async (resolve, reject) => {
    if (window.CryptoJS) {
      resolve()
      return
    }
    try {
      const text = await Plugins.Readfile(JS_FILE)
      const script = document.createElement('script')
      script.id = Plugin.id
      script.text = text
      document.body.appendChild(script)
      resolve()
    } catch (error) {
      console.error(error)
      reject('加载加密套件失败，请重新安装本插件')
    }
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

async function httpGet(url) {
  if (!Plugin.Authorization) throw '未配置TOKEN'
  const { body } = await Plugins.HttpGet(`http://${Plugin.ServerAddress}${url}`, {
    'User-Agent': 'GUI.for.Cores',
    Connection: 'close',
    Authorization: 'Bearer ' + Plugin.Authorization
  })
  // 因为GUI封装的网络请求没有处理响应码为非200的情况
  if (typeof body === 'string' && ['Faild', 'Unauthorized', 'Error', 'Method not allowed'].some((v) => body.startsWith(v))) {
    throw body
  }
  return body
}

function httpPost(url, data) {
  if (!Plugin.Authorization) throw '未配置TOKEN'
  return Plugins.HttpPost(
    `http://${Plugin.ServerAddress}${url}`,
    {
      'User-Agent': 'GUI.for.Cores',
      'Content-Type': 'application/json',
      Connection: 'close',
      Authorization: 'Bearer ' + Plugin.Authorization
    },
    data
  )
}

function httpDelete(url) {
  if (!Plugin.Authorization) throw '未配置TOKEN'
  return Plugins.HttpDelete(`http://${Plugin.ServerAddress}${url}`, {
    'User-Agent': 'GUI.for.Cores',
    'Content-Type': 'application/json',
    Connection: 'close',
    Authorization: 'Bearer ' + Plugin.Authorization
  })
}
