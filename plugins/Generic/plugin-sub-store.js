const subStoreDir = 'data/plugins/assets/plugin-sub-store-assets'
const subStoreConfigPath = 'data/plugins/assets/sub-store-config'
const subStoreSrcPath = subStoreDir + '/sub-store.min.js'
const subStoreBackendInfoPath = subStoreDir + '/sub-store-backend-info.yaml'
const envPath = subStoreConfigPath + '/.env'
async function installSubStore() {
  let hasNode = false
  try {
    const nodeVersion = await Plugins.Exec('node', ['-v'])
    hasNode = nodeVersion.trim().split('.').length === 3
  } catch (e) {}
  if (!hasNode) {
    console.error('Please install nodejs: https://nodejs.org/en/download/current')
    Plugins.message.info('请先安装 nodejs', 4_000)
    return false
  }
  let hasPnpm = false
  try {
    const pnpmVersion = await Plugins.Exec('pnpm', ['-v'])
    hasPnpm = pnpmVersion.trim().split('.').length === 3
  } catch (e) {}
  if (!hasPnpm) {
    await Plugins.Exec('npm', ['install', '-g', 'pnpm'])
  }

  const subStoreUrl = 'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.min.js'
  const packageUrl = 'https://raw.githubusercontent.com/sub-store-org/Sub-Store/master/backend/package.json'
  const packageLockUrl = 'https://raw.githubusercontent.com/sub-store-org/Sub-Store/master/backend/pnpm-lock.yaml'
  const packagePath = subStoreDir + '/package.json'
  const packageLockPath = subStoreDir + '/pnpm-lock.yaml'
  const absSubStoreConfigPath = (await Plugins.AbsolutePath(subStoreConfigPath)).replaceAll('\\', '/')

  const chDir = `process.chdir('${absSubStoreConfigPath}')\n`
  const requireDotenv = "require('dotenv').config()\n"

  const { body: subStoreSrc } = await Plugins.HttpGet(subStoreUrl)
  await Plugins.Writefile(subStoreSrcPath, chDir + requireDotenv + subStoreSrc)
  await Plugins.Download(packageUrl, packagePath)
  await Plugins.Download(packageLockUrl, packageLockPath)

  const workdDir = await Plugins.AbsolutePath(subStoreDir)
  await Plugins.Exec('pnpm', ['fetch', '--dir', workdDir])
  await Plugins.Exec('pnpm', ['install', '--frozen-lockfile', '--dir', workdDir])
  await Plugins.Exec('pnpm', ['install', 'dotenv', '--dir', workdDir])

  if (!(await Plugins.FileExists(envPath))) {
    await Plugins.Writefile(envPath, `SUB_STORE_BACKEND_API_PORT=${Plugin.port}`)
  }
  return true
}

async function onInstall() {
  try {
    if (await installSubStore()) {
      Plugins.message.info('安装成功')
    }
  } catch (e) {
    Plugins.message.error(`安装失败 ${e}`)
  }
}

async function onUninstall() {
  await Plugins.Removefile(subStoreDir)
  console.log('Uninstall Sub-Store finished')
}

async function onRun() {
  if (await Plugins.FileExists(subStoreBackendInfoPath)) {
    const backendUrl = Plugins.YAML.parse(await Plugins.Readfile(subStoreBackendInfoPath)).url
    const webUrl = 'https://sub-store.vercel.app?api=' + backendUrl
    try {
      await Plugins.HttpGet(backendUrl)
      console.log('Sub-Store Web URL: ' + webUrl)
      //await Plugins.Exec('cmd', ['/c', 'start', webUrl]);
      window.open(webUrl, 'Sub-Store')
      return
    } catch (e) {
      console.log(e)
    }
  }

  Plugins.message.info('请先运行Sub-Store服务')
}

async function onStartup() {
  await killProcess()

  const absSubStoreSrcPath = await Plugins.AbsolutePath(subStoreSrcPath)

  await Plugins.Writefile(envPath, `SUB_STORE_BACKEND_API_PORT=${Plugin.port}`)

  const pid = await Plugins.ExecBackground(
    'node',
    [absSubStoreSrcPath],
    // stdout
    async (out) => {
      const line = out.trim()
      if (line.includes('[BACKEND]')) {
        const backendPort = line.split(':::')[1]
        const backendUrl = `http://127.0.0.1:${backendPort}`
        Plugins.Writefile(
          subStoreBackendInfoPath,
          Plugins.YAML.stringify({
            url: backendUrl,
            pid: pid
          })
        )
        console.log(`Sub-Store backend URL: ${backendUrl}`)
      }
      console.log(line)
    },
    // end
    async () => {
      console.log('Sub-Store backend stopped')
    }
  )
}

async function onShutdown() {
  await killProcess()
}

async function killProcess() {
  if (await Plugins.FileExists(subStoreBackendInfoPath)) {
    const backendInfo = Plugins.YAML.parse(await Plugins.Readfile(subStoreBackendInfoPath))
    try {
      if ((await Plugins.KillProcess(backendInfo.pid)) === 'Success') {
        await Plugins.Removefile(subStoreBackendInfoPath)
        console.log(`Sub-Store backend stopped. PID: ${backendInfo.pid}`)
        return
      }
    } catch (e) {}
    console.log(`Sub-Store backend stop failed. PID: ${backendInfo.pid}`)
  }
}

async function onUpdate() {
  try {
    if (await installSubStore()) {
      Plugins.message.info('更新成功')
    }
  } catch (e) {
    Plugins.message.error(`更新失败 ${e}`)
  }
}
