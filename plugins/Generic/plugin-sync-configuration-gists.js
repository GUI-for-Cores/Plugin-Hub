const PATH = 'data/third/sync-gui-gists'
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

    const list = await httpGet('/gists')
    const _list = filterList(list)
    if (_list.length === 0) throw '没有可同步的备份'
    const gistId = await Plugins.picker.single('Gists 备份列表如下：', _list, [_list[0].value])

    const files = Object.values(list.find((v) => v.id === gistId).files)

    const { id } = Plugins.message.info('正在同步...', 60 * 60 * 1000)
    for (let i = 0; i < files.length; i++) {
        const file = files[i]
        Plugins.message.update(id, `正在同步...[ ${i + 1}/${files.length} ]`)
        try {
            const { body: encrypted } = await Plugins.HttpGet(file.raw_url)
            await Plugins.WriteFile(file.filename.replaceAll('\\', '/'), decrypt(encrypted))
        } catch (error) {
            console.log(error)
            Plugins.message.update(id, `[${file.filename}] 同步失败`, 'error')
            await Plugins.sleep(1000)
        } finally {
            await Plugins.sleep(100)
        }
    }

    Plugins.message.update(id, '同步完成，即将重载界面', 'success')
    await Plugins.sleep(1500).then(() => Plugins.message.destroy(id))

    const kernelApiStore = Plugins.useKernelApiStore()
    if (kernelApiStore.running) {
        await kernelApiStore.stopCore()
    }

    await Plugins.WindowReloadApp()
}

/**
 * 插件钩子：右键 - 立即备份
 */
const Backup = async () => {
    if (!window.CryptoJS) throw '请先安装插件或重新安装插件'

    // 基础配置文件
    const files = [
        'data/user.yaml',
        'data/profiles.yaml',
        'data/subscribes.yaml',
        'data/rulesets.yaml',
        'data/plugins.yaml',
        'data/scheduledtasks.yaml'
    ]

    const subscribesStore = Plugins.useSubscribesStore()
    const pluginsStore = Plugins.usePluginsStore()
    const rulesetsStore = Plugins.useRulesetsStore()

    // 备份订阅生成的配置文件
    const l1 = subscribesStore.subscribes.map((v) => v.path).filter((v) => v.startsWith('data'))

    // 【改进】备份本地订阅源文件 (type === 'File' 时的 url 字段)
    const localSubscribeFiles = subscribesStore.subscribes
        .filter((v) => v.type === 'File' && v.url && v.url.startsWith('data'))
        .map((v) => v.url)

    const l2 = pluginsStore.plugins.map((v) => v.path).filter((v) => v.startsWith('data'))

    // 备份规则集生成的配置文件
    const l3 = rulesetsStore.rulesets.map((v) => v.path).filter((v) => v.startsWith('data') && (v.endsWith('yaml') || v.endsWith('json')))

    // 【改进】备份本地规则集源文件 (type === 'File' 时的 url 字段)
    const localRulesetFiles = rulesetsStore.rulesets
        .filter((v) => v.type === 'File' && v.url && v.url.startsWith('data'))
        .map((v) => v.url)

    // 【改进】备份插件第三方依赖文件 (data/third/ 目录下的所有文件)
    const thirdPartyFiles = []
    try {
        const thirdDirs = await Plugins.ignoredError(Plugins.ReadDir, 'data/third')
        if (thirdDirs) {
            for (const dir of thirdDirs) {
                if (dir.isDir) {
                    // 读取子目录中的文件
                    const subFiles = await Plugins.ignoredError(Plugins.ReadDir, 'data/third/' + dir.name)
                    if (subFiles) {
                        for (const file of subFiles) {
                            if (!file.isDir) {
                                thirdPartyFiles.push('data/third/' + dir.name + '/' + file.name)
                            }
                        }
                    }
                } else {
                    thirdPartyFiles.push('data/third/' + dir.name)
                }
            }
        }
    } catch (e) {
        console.log('读取 data/third 目录失败:', e)
    }

    files.push(...l1, ...localSubscribeFiles, ...l2, ...l3, ...localRulesetFiles, ...thirdPartyFiles)

    // 去重
    const uniqueFiles = [...new Set(files)]

    const { id } = Plugins.message.info('正在创建备份...', 60 * 60 * 1000)

    const filesMap = {}

    for (let i = 0; i < uniqueFiles.length; i++) {
        const file = uniqueFiles[i]
        Plugins.message.update(id, `正在创建备份...[ ${i + 1}/${uniqueFiles.length} ]`)
        try {
            const text = await Plugins.ignoredError(Plugins.ReadFile, file)
            if (text) {
                filesMap[file.replaceAll('/', '\\')] = { content: encrypt(text) }
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
        await httpPost('/gists', {
            description: getPrefix() + '_' + new Date().toLocaleString() + '_备份',
            public: false,
            files: filesMap
        })
        Plugins.message.update(id, '备份完成', 'success')
    } catch (error) {
        Plugins.message.update(id, `备份失败:` + (error.message || error), 'error')
    }

    await Plugins.sleep(1500).then(() => Plugins.message.destroy(id))
}

const List = async () => {
    const list = await httpGet('/gists')
    const _list = filterList(list)
    if (_list.length === 0) throw '备份列表为空'
    await Plugins.picker.single('Gists 备份列表如下：', _list, [])
}

const Remove = async () => {
    const list = await httpGet('/gists')
    const _list = filterList(list)
    if (_list.length === 0) throw '没有可管理的备份'
    const ids = await Plugins.picker.multi('请勾选要删除的备份', _list, [])
    for (let i = 0; i < ids.length; i++) {
        await httpDelete('/gists/' + ids[i])
        Plugins.message.success('删除成功: ' + ids[i])
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
    await Plugins.RemoveFile(PATH)
    return 0
}

const onReady = async () => {
    await loadDependence()
}

const getPrefix = () => {
    return Plugins.APP_TITLE.includes('Clash') ? 'GUI.for.Clash' : 'GUI.for.SingBox'
}

const filterList = (list) => {
    const prefix = getPrefix()
    return list.filter((v) => v.description && v.description.startsWith(prefix)).map((v) => ({ label: v.description, value: v.id }))
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
            const text = await Plugins.ReadFile(JS_FILE)
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
    if (!window.CryptoJS) throw '加密套件未加载，请卸载并重新安装插件'
    return window.CryptoJS.AES.encrypt(data, Plugin.Secret).toString()
}

/**
 *解密
 */
function decrypt(data) {
    if (!Plugin.Secret) throw '未配置密钥'
    if (!window.CryptoJS) throw '加密套件未加载，请卸载并重新安装插件'
    return window.CryptoJS.AES.decrypt(data, Plugin.Secret).toString(CryptoJS.enc.Utf8)
}

async function httpGet(url) {
    if (!Plugin.Authorization) throw '未配置TOKEN'
    const { body } = await Plugins.HttpGet(`https://api.github.com${url}`, {
        'User-Agent': 'GUI.for.Cores',
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github+json',
        Connection: 'close',
        Authorization: 'Bearer ' + Plugin.Authorization
    })
    console.log(body)
    if (body.message) {
        throw body.message
    }
    return body
}

async function httpPost(url, data) {
    if (!Plugin.Authorization) throw '未配置TOKEN'
    const { body } = await Plugins.HttpPost(
        `https://api.github.com${url}`,
        {
            'User-Agent': 'GUI.for.Cores',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
            Accept: 'application/vnd.github+json',
            Connection: 'close',
            Authorization: 'Bearer ' + Plugin.Authorization
        },
        data
    )
    if (body.message) {
        throw body.message
    }
    return body
}

async function httpDelete(url) {
    if (!Plugin.Authorization) throw '未配置TOKEN'
    const { body } = await Plugins.HttpDelete(`https://api.github.com${url}`, {
        'User-Agent': 'GUI.for.Cores',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        Accept: 'application/vnd.github+json',
        Connection: 'close',
        Authorization: 'Bearer ' + Plugin.Authorization
    })
    if (body.message) {
        throw body.message
    }
    return body
}
