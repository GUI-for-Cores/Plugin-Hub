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

  const list = await httpGet('/backup?tag=' + getTag())
  if (list.length === 0) throw '没有可同步的备份'
  const backupId = await Plugins.picker.single(
    '请选择要同步至本地的备份',
    list.map((v) => ({ label: v, value: v })),
    [list.shift()]
  )

  const { update, destroy, success } = Plugins.message.info('获取备份文件...', 60 * 60 * 1000)

  const { files } = await httpGet(`/sync?tag=${getTag()}&id=${backupId}`)

  const _files = Object.keys(files)
  for (let i = 0; i < _files.length; i++) {
    const file = _files[i]
    const encrypted = files[file]
    update(`正在恢复文件...[ ${i + 1}/${_files.length} ]`, 'info')
    try {
      await Plugins.Writefile(file, decrypt(encrypted))
    } catch (error) {
      console.log(error)
      Plugins.message.error(`恢复文件失败：` + file)
    } finally {
      await Plugins.sleep(100)
    }
  }

  success('同步完成，即将重载界面')
  await Plugins.sleep(1500).then(() => destroy())

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

  const { destroy, update } = Plugins.message.info('正在创建备份...', 60 * 60 * 1000)

  const data = {
    id: Plugins.formatDate(Date.now(), 'YYYY-MM-DD_HHmmss'),
    tag: getTag(),
    files: {}
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    update(`正在加密文件...[ ${i + 1}/${files.length} ]`, 'info')
    try {
      const text = await Plugins.Readfile(file)
      data.files[file] = encrypt(text)
    } catch (error) {
      console.log(error)
      Plugins.message.error(`[${file}] 加密失败，跳过`)
    } finally {
      await Plugins.sleep(100)
    }
  }

  await httpPost('/backup', data)

  update('备份完成', 'success')
  await Plugins.sleep(1500).then(() => destroy())
}

const getTag = () => {
  if (Plugins.APP_TITLE.includes('Clash')) return 'gfc'
  if (Plugins.APP_TITLE.includes('SingBox')) return 'gfs'
  return ''
}

const List = async () => {
  const list = await httpGet('/backup?tag=' + getTag())
  if (list.length === 0) throw '备份列表为空'
  await Plugins.picker.single(
    '服务器备份列表如下：',
    list.map((v) => ({ label: v, value: v })),
    []
  )
}

const Remove = async () => {
  const list = await httpGet('/backup?tag=' + getTag())
  if (list.length === 0) throw '没有可管理的备份'
  const ids = await Plugins.picker.multi(
    '请勾选要删除的备份',
    list.map((v) => ({ label: v, value: v })),
    []
  )
  await httpDelete(`/backup?tag=${getTag()}&ids=${ids.join(',')}`)
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
  const { status, body } = await Plugins.HttpGet(`http://${Plugin.ServerAddress}${url}`, {
    'User-Agent': 'GUI.for.Cores',
    Connection: 'close',
    Authorization: 'Bearer ' + Plugin.Authorization
  })
  if (status !== 200) {
    if (body.includes('The system cannot find the file specified')) {
      throw '似乎是第一次使用，先备份一次吧!'
    }
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
