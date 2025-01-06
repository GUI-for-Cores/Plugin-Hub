const PATH = 'data/third/sync-gui-webdav'
const JS_FILE = PATH + '/crypto-js.js'

/* 触发器 手动触发 */
const onRun = async () => {
  const action = await Plugins.picker.single(
    '请选择操作',
    [
      { label: '立即备份', value: 'Backup' },
      { label: '同步至本地', value: 'Sync' },
      { label: '查看备份列表', value: 'List' },
      { label: '管理备份列表', value: 'Remove' }
    ],
    []
  )

  const handler = { Backup, Sync, List, Remove }
  await handler[action]()
}

/**
 * 插件钩子：右键 - 同步至本地
 */
const Sync = async () => {
  if (!window.CryptoJS) throw '请先安装插件或重新安装插件'
  if (!Plugin.Secret) throw '为了数据安全，请先配置文件加密密钥'

  const dav = new WebDAV(Plugin.Address, Plugin.Username, Plugin.Password)
  const list = await dav.propfind(Plugin.DataPath)
  const _list = filterList(list)
  if (_list.length === 0) throw '没有可同步的备份'

  const fileHref = await Plugins.picker.single('请选择要同步至本地的备份', _list, [_list[0].value])

  const { update, destroy, success, error } = Plugins.message.info('获取备份文件...', 60 * 60 * 1000)

  const content = await dav.get(fileHref)

  const files = JSON.parse(content)

  let failed = false

  const isWindows = Plugins.useEnvStore().env.os == 'windows'
  const separator = isWindows ? '\\' : '/'

  const _files = Object.keys(files)
  for (let i = 0; i < _files.length; i++) {
    const file = _files[i]
    const encrypted = files[file].content
    const processedFile = file.replaceAll(/\//g, separator).replaceAll(/\\/g, separator)
    update(`正在恢复文件...[ ${i + 1}/${_files.length} ]`, 'info')
    try {
      await Plugins.Writefile(processedFile, decrypt(encrypted))
    } catch (error) {
      if (error === '解密失败') {
        failed = true
      }
      console.log(file + ' ： ' + error)
      Plugins.message.error(`恢复文件失败：` + error)
    } finally {
      await Plugins.sleep(100)
    }
  }

  if (failed) {
    error('有文件解密失败，考虑是否是密钥配置错误')
    await Plugins.sleep(3000).then(() => destroy())
    return
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
  if (!Plugin.Secret) throw '为了数据安全，请先配置文件加密密钥'

  const backupFilename = await getBackupFilename()

  const files = ['data/user.yaml', 'data/profiles.yaml', 'data/subscribes.yaml', 'data/rulesets.yaml', 'data/plugins.yaml', 'data/scheduledtasks.yaml']

  const subscribesStore = Plugins.useSubscribesStore()
  const pluginsStore = Plugins.usePluginsStore()
  const rulesetsStore = Plugins.useRulesetsStore()

  const l1 = subscribesStore.subscribes.map((v) => v.path).filter((v) => v.startsWith('data'))
  const l2 = pluginsStore.plugins.map((v) => v.path).filter((v) => v.startsWith('data'))
  const l3 = rulesetsStore.rulesets.map((v) => v.path).filter((v) => v.startsWith('data') && (v.endsWith('yaml') || v.endsWith('json')))

  files.push(...l1, ...l2, ...l3)

  const { id } = Plugins.message.info('正在创建备份...', 60 * 60 * 1000)

  const filesMap = {}

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    Plugins.message.update(id, `正在创建备份...[ ${i + 1}/${files.length} ]`)
    try {
      const text = await Plugins.ignoredError(Plugins.Readfile, file)
      if (text) {
        filesMap[file] = { content: encrypt(text) }
      }
    } catch (error) {
      console.log(error)
      Plugins.message.destroy(id)
      throw error
    } finally {
      await Plugins.sleep(100)
    }
  }

  try {
    if (Object.keys(filesMap).length === 0) throw '缺少备份文件'
    Plugins.message.update(id, '正在备份...', 'info')
    const dav = new WebDAV(Plugin.Address, Plugin.Username, Plugin.Password)
    await dav.put(Plugin.DataPath + '/' + backupFilename, JSON.stringify(filesMap))
    Plugins.message.update(id, '备份完成', 'success')
  } catch (error) {
    Plugins.message.update(id, `备份失败:` + (error.message || error), 'error')
  }

  await Plugins.sleep(1500).then(() => Plugins.message.destroy(id))
}

const List = async () => {
  const dav = new WebDAV(Plugin.Address, Plugin.Username, Plugin.Password)
  const list = await dav.propfind(Plugin.DataPath)
  const _list = filterList(list)
  if (_list.length === 0) throw '备份列表为空'
  await Plugins.picker.single('备份列表如下：', _list, [])
}

const Remove = async () => {
  const dav = new WebDAV(Plugin.Address, Plugin.Username, Plugin.Password)
  const list = await dav.propfind(Plugin.DataPath)
  const _list = filterList(list)
  if (_list.length === 0) throw '没有可管理的备份'
  const files = await Plugins.picker.multi('请勾选要删除的备份', _list, [])
  for (let i = 0; i < files.length; i++) {
    await dav.delete(files[i])
    Plugins.message.success('删除成功: ' + files[i])
  }
}

const onInstall = async () => {
  await Plugins.Download('https://unpkg.com/crypto-js@latest/crypto-js.js', JS_FILE)
  await loadDependence()
  return 0
}

const onUninstall = async () => {
  const dom = document.getElementById(Plugin.id)
  dom && dom.remove()
  await Plugins.Removefile(PATH)
  return 0
}

const onReady = async () => {
  await loadDependence()
}

const getPrefix = () => {
  return Plugins.APP_TITLE.includes('Clash') ? 'GUI.for.Clash' : 'GUI.for.SingBox'
}

const getBackupFilename = async () => {
  const defaultFilename =
    getPrefix() + '-' +
    Plugins.APP_VERSION + '_' +
    Plugins.formatDate(Date.now(), 'YYYYMMDD-HHmmss') + '_' +
    'core-' + await getKernelVersion()

  const input = await Plugins.prompt(Plugin.name, defaultFilename) || defaultFilename
  if (!input.startsWith(getPrefix()) || /[\\/:*?"<>|]/.test(input)) {
    Plugins.message.error('文件名必须以 ' + getPrefix() + ' 起始，禁止包含 \\ / : * ? " < > |')
    throw '输入的文件名不合法，请重新输入并确保符合要求'
  }

  return input
}

const getKernelVersion = async () => {
  const isClashApp = Plugins.APP_TITLE.includes('Clash')
  const coreDir = isClashApp ? 'data/mihomo/' : 'data/sing-box/'
  const fileSuffix = Plugins.useEnvStore().env.os == 'windows' ? '.exe' : ''
  const branch = Plugins.useAppSettingsStore().app.kernel.branch

  const coreFileName = await Plugins.getKernelFileName(branch != 'main') + fileSuffix
  const kernelFilePath = await Plugins.AbsolutePath(coreDir + coreFileName)

  const param = isClashApp ? '-v' : 'version'
  const res = await Plugins.Exec(kernelFilePath, [param])
  return res.split('\n')[0].split(' ')[2]
}

const filterList = (list) => {
  const prefix = getPrefix()
  return list
    .filter((v) => v.displayname.startsWith(prefix))
    .map((v) => ({ label: v.displayname, value: v.href }))
    .reverse()
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
  return window.CryptoJS.AES.encrypt(data, Plugin.Secret).toString()
}

/**
 *解密
 */
function decrypt(data) {
  try {
    return window.CryptoJS.AES.decrypt(data, Plugin.Secret).toString(CryptoJS.enc.Utf8)
  } catch (error) {
    throw '解密失败'
  }
}

class WebDAV {
  constructor(address, username, password) {
    this.address = address
    this.headers = {
      Authorization: 'Basic ' + Plugins.base64Encode(username + ':' + password),
      'Content-Type': 'application/xml; charset=utf-8'
    }
  }

  async propfind(url) {
    const { body, status } = await Plugins.Requests({
      method: 'PROPFIND',
      url: this.address + url,
      headers: { ...this.headers, Depth: '1' }
    })
    if (status !== 207) throw body
    const list = []
    const parser = new DOMParser()
    const xmlDoc = parser.parseFromString(body, 'application/xml')
    const responses = Array.from(xmlDoc.getElementsByTagName('*')).filter((node) => node.tagName.toLowerCase() === 'd:response')
    const getTextContent = (element, tagName) => {
      const nodes = element.getElementsByTagName('*')
      for (let node of nodes) {
        if (node.tagName.toLowerCase() === tagName.toLowerCase()) {
          return node.textContent
        }
      }
    }
    for (let i = 0; i < responses.length; i++) {
      const isCollection = responses[i].getElementsByTagNameNS('DAV:', 'resourcetype')[0]?.getElementsByTagNameNS('DAV:', 'collection').length > 0
      if (isCollection) continue
      list.push({
        href: getTextContent(responses[i], 'D:href'),
        displayname: getTextContent(responses[i], 'D:displayname') || '',
        lastModified: getTextContent(responses[i], 'D:getlastmodified') || 'N/A',
        creationDate: getTextContent(responses[i], 'D:creationdate') || 'N/A'
      })
    }
    return list
  }

  async get(url) {
    const { body, status } = await Plugins.Requests({
      method: 'GET',
      url: this.address + url,
      headers: this.headers
    })
    if (status !== 200) throw body
    return body
  }

  async put(url, content) {
    const { body, status } = await Plugins.Requests({
      method: 'PUT',
      url: this.address + url,
      body: content,
      headers: this.headers
    })
    if (status !== 201) throw body
    return body
  }

  async delete(url) {
    const { body, status } = await Plugins.Requests({
      method: 'DELETE',
      url: this.address + url,
      headers: this.headers
    })
    if (status !== 204) throw body
    return body
  }
}
