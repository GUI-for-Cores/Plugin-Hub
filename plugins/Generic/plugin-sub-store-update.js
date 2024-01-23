const subStoreDir = 'data/plugins/assets/plugin-sub-store-assets';
const subStoreSrcPath = subStoreDir + '/sub-store.min.js';
const subStoreConfigPath = 'data/plugins/assets/sub-store-config';

async function installSubStore() {
    let hasNode = false;
    try {
        const nodeVersion = await Plugins.Exec('node', ['-v']);
        hasNode = nodeVersion.trim().split('.').length === 3;
    } catch (e) {}
    if (!hasNode) {
        console.error(
            'Please install nodejs: https://nodejs.org/en/download/current'
        );
        Plugins.message.info('Please run Sub-Store service first', 4_000);
        return;
    }
    let hasPnpm = false;
    try {
        const pnpmVersion = await Plugins.Exec('pnpm', ['-v']);
        hasPnpm = pnpmVersion.trim().split('.').length === 3;
    } catch (e) {}
    if (!hasPnpm) {
        await Plugins.Exec('npm', ['install', '-g', 'pnpm']);
    }

    const subStoreUrl =
        'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.min.js';
    const packageUrl =
        'https://raw.githubusercontent.com/sub-store-org/Sub-Store/master/backend/package.json';
    const packageLockUrl =
        'https://raw.githubusercontent.com/sub-store-org/Sub-Store/master/backend/pnpm-lock.yaml';
    const packagePath = subStoreDir + '/package.json';
    const packageLockPath = subStoreDir + '/pnpm-lock.yaml';
    const absSubStoreConfigPath = (
        await Plugins.AbsolutePath(subStoreConfigPath)
    ).replaceAll('\\', '/');

    const chDir = `process.chdir('${absSubStoreConfigPath}')\n`;
    const requireDotenv = "require('dotenv').config()\n";

    const { body: subStoreSrc } = await Plugins.HttpGet(subStoreUrl);
    await Plugins.Writefile(
        subStoreSrcPath,
        chDir + requireDotenv + subStoreSrc
    );
    await Plugins.Download(packageUrl, packagePath);
    await Plugins.Download(packageLockUrl, packageLockPath);

    const workdDir = await Plugins.AbsolutePath(subStoreDir);
    await Plugins.Exec('pnpm', ['fetch', '--dir', workdDir]);
    await Plugins.Exec('pnpm', [
        'install',
        '--frozen-lockfile',
        '--dir',
        workdDir,
    ]);
    await Plugins.Exec('pnpm', ['install', 'dotenv', '--dir', workdDir]);
}

async function uninstallSubStore() {
    await Plugins.Removefile(subStoreDir);
}

async function onRun() {
    try {
        await installSubStore();
        Plugins.message.info('Update Sub-Store finished');
    } catch (e) {
        Plugins.message.info(`Update Sub-Store failed: ${e}`);
    }
}
