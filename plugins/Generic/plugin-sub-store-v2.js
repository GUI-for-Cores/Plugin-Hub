const BackendUrl = 'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
const FrontendUrl = 'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip'
const SUBSTORE_PATH = 'data/third/sub-store'
const SUB_STORE_FRONTEND_PATH = SUBSTORE_PATH + '/frontend'
const SUB_STORE_BACKEND_PATH = SUBSTORE_PATH + '/sub-store.bundle.js'

const onRun = async () => {
  // const res = await Plugins.Exec('node', [SUB_STORE_BACKEND_PATH])
}

/**
 * 下载Sub-Store前端和后端文件
 */
const InstallSubStore = async () => {
  const { id } = Plugins.message.info('正在执行安装Sub-Store...', 999999)
  const tmpZip = 'data/.cache/sub-store.zip'
  const tmpDir = 'data/.cache/sub-store-frontend'
  try {
    Plugins.message.update(id, '正在下载前端资源')
    await Plugins.Download(FrontendUrl, tmpZip, (c, t) => {
      Plugins.message.update(id, '正在下载前端资源...' + ((c / t) * 100).toFixed(2) + '%')
    })
    Plugins.message.update(id, '前端资源下载完成，正在解压...')
    await Plugins.sleep(500)
    await Plugins.UnzipZIPFile(tmpZip, tmpDir)
    await Plugins.Makedir(SUBSTORE_PATH)
    await Plugins.Movefile(tmpDir + '/dist', SUB_STORE_FRONTEND_PATH)
    await Plugins.Removefile(tmpDir)
    await Plugins.Removefile(tmpZip)
    Plugins.message.update(id, '安装前端完成, 正在安装后端...')
    await Plugins.sleep(500)
    await Plugins.Download(BackendUrl, SUB_STORE_BACKEND_PATH)
    Plugins.message.update(id, '安装后端完成',  'success')
  } finally {
    await Plugins.sleep(500)
    Plugins.message.destroy(id)
  }
}

const onInstall = async () => {
  await InstallSubStore()
}

const onUninstall = async () => {
  await Plugins.Removefile(SUBSTORE_PATH)
}
