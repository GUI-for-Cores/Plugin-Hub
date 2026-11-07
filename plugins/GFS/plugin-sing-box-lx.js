/**
 * sing-box-lx: https://github.com/Leadaxe/sing-box-lx
 *
 * GUI.for.SingBox currently starts a fixed main/alpha executable. This plugin
 * manages that executable (and libcronet.dll on Windows), retaining the original
 * files and a durable recovery journal. It does not change the GUI's update URL.
 * Place this plugin BEFORE 节点转换. Ordinary nodes are converted through that
 * plugin's public trigger, without importing or injecting external JavaScript.
 */

const LX_PATH = 'data/third/sing-box-lx'
const LX_CACHE = 'data/.cache/sing-box-lx'
const LX_CORE = 'data/sing-box'
const LX_STATE = LX_PATH + '/state.json'
const LX_JOURNAL = LX_PATH + '/transaction.json'
const LX_API = 'https://api.github.com/repos/Leadaxe/sing-box-lx/releases'
const LX_RELEASES = 'https://github.com/Leadaxe/sing-box-lx/releases'
const LX_CONVERTER = 'plugin-node-convert'
const LX_XRAY = 'plugin-xray-front-proxy'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const { env } = Plugins.useEnvStore()
  const kernel = Plugins.useKernelApiStore()
  const settings = Plugins.useAppSettingsStore()
  let busy = false
  let allowStart = false

  const branch = () => (settings.app.kernel.branch === 'alpha' ? 'alpha' : 'main')
  const coreName = (value) => Plugins.getKernelFileName(value === 'alpha')
  const fileNames = (value) => [coreName(value), ...(env.os === 'windows' ? ['libcronet.dll'] : [])]
  const platform = () => `${env.os}-${env.arch}`
  const stringifyError = (error) => error?.message || String(error)

  const exclusive = async (action) => {
    if (busy) throw new Error('sing-box-lx 正在执行操作，请稍后重试')
    busy = true
    try {
      return await action()
    } finally {
      allowStart = false
      busy = false
    }
  }

  const confirm = async (content) => {
    const accepted = await Plugins.confirm(Plugin.name, content).catch(() => false)
    return accepted === true
  }

  const writeJSON = async (path, value) => {
    await Plugins.WriteFile(path + '.tmp', JSON.stringify(value, null, 2))
    await Plugins.MoveFile(path + '.tmp', path)
  }

  const validateSnapshot = (snapshot, value) => {
    const names = fileNames(value)
    if (
      !snapshot ||
      ![LX_PATH + '/original', LX_PATH + '/rollback'].includes(snapshot.dir) ||
      !Array.isArray(snapshot.files) ||
      snapshot.files.length !== names.length ||
      names.some((name) => snapshot.files.filter((file) => file.name === name).length !== 1) ||
      snapshot.files.some((file) => typeof file.exists !== 'boolean' || (file.exists && !/^[a-f0-9]{64}$/i.test(file.sha256)))
    ) {
      throw new Error('sing-box-lx 备份记录损坏，请保留插件目录并手动恢复原核心')
    }
  }

  const validateRelease = (release, value) => {
    if (
      !release ||
      !new RegExp('^' + LX_PATH + '/releases/[0-9]+-[0-9]+-[0-9]+$').test(release.dir) ||
      typeof release.tag !== 'string' ||
      !Array.isArray(release.files) ||
      release.files.length < 1 ||
      release.files.length > fileNames(value).length ||
      !release.files.some((file) => file.name === coreName(value)) ||
      new Set(release.files.map((file) => file.name)).size !== release.files.length ||
      release.files.some((file) => !fileNames(value).includes(file.name) || !/^[a-f0-9]{64}$/i.test(file.sha256))
    ) {
      throw new Error('sing-box-lx 版本记录损坏，请使用恢复操作或手动恢复备份')
    }
  }

  const validateState = (state) => {
    if (!state || state.schema !== 1 || !['main', 'alpha'].includes(state.branch) || state.platform !== platform()) {
      throw new Error('sing-box-lx 状态文件不兼容，请勿删除备份，先手动恢复原核心')
    }
    validateSnapshot(state.original, state.branch)
    if (state.original.dir !== LX_PATH + '/original') throw new Error('原始备份路径不兼容，请保留插件目录并手动恢复原核心')
    validateRelease(state.current, state.branch)
    if (state.previous) validateRelease(state.previous, state.branch)
    return state
  }

  const readState = async () => {
    if (!(await Plugins.FileExists(LX_STATE))) return null
    return validateState(JSON.parse(await Plugins.ReadFile(LX_STATE)))
  }

  const saveState = async (state) => {
    if (state) await writeJSON(LX_STATE, state)
    else await Plugins.RemoveFile(LX_STATE)
  }

  const requireNoJournal = async () => {
    if (await Plugins.FileExists(LX_JOURNAL)) {
      throw new Error('上次核心切换尚未完成。请先运行插件菜单「恢复中断操作」，备份仍保存在 ' + LX_PATH)
    }
  }

  const requireIdle = () => {
    if (kernel.starting || kernel.stopping || kernel.restarting) throw new Error('核心正在启停，请稍后重试')
  }

  const requireStopped = () => {
    requireIdle()
    if (kernel.running) throw new Error('请先停止核心再操作')
  }

  const chmod = async (path) => {
    if (env.os !== 'windows') await Plugins.Exec('chmod', ['+x', await Plugins.AbsolutePath(path)])
  }

  const copyChecked = async (source, target, sha256) => {
    if ((await Plugins.FileSHA256(source)).toLowerCase() !== sha256.toLowerCase()) throw new Error('备份或缓存校验失败：' + source)
    await Plugins.CopyFile(source, target)
    if ((await Plugins.FileSHA256(target)).toLowerCase() !== sha256.toLowerCase()) throw new Error('写入校验失败：' + target)
  }

  const takeSnapshot = async (value, dir) => {
    await Plugins.MakeDir(dir)
    const files = []
    for (const name of fileNames(value)) {
      const path = LX_CORE + '/' + name
      const exists = await Plugins.FileExists(path)
      const file = { name, exists, sha256: exists ? await Plugins.FileSHA256(path) : '' }
      if (exists) await copyChecked(path, dir + '/' + name, file.sha256)
      files.push(file)
    }
    return { dir, files }
  }

  const verifySnapshot = async (snapshot) => {
    for (const file of snapshot.files) {
      if (file.exists && (await Plugins.FileSHA256(snapshot.dir + '/' + file.name)).toLowerCase() !== file.sha256.toLowerCase()) {
        throw new Error('恢复文件校验失败，未修改核心：' + file.name)
      }
    }
  }

  const restoreSnapshot = async (snapshot, value) => {
    await verifySnapshot(snapshot)
    for (const file of snapshot.files) {
      requireStopped()
      const target = LX_CORE + '/' + file.name
      if (file.exists) await copyChecked(snapshot.dir + '/' + file.name, target, file.sha256)
      else await Plugins.RemoveFile(target)
    }
    if (snapshot.files.find((file) => file.name === coreName(value))?.exists) await chmod(LX_CORE + '/' + coreName(value))
  }

  const matchesRelease = async (release, value) => {
    for (const name of fileNames(value)) {
      const file = release.files.find((item) => item.name === name)
      const target = LX_CORE + '/' + name
      if (!file) {
        if (await Plugins.FileExists(target)) return false
      } else if (!(await Plugins.FileExists(target)) || (await Plugins.FileSHA256(target)).toLowerCase() !== file.sha256.toLowerCase()) {
        return false
      }
    }
    return true
  }

  const api = async (url) => {
    const headers = { Accept: 'application/vnd.github+json' }
    const authorization = Plugins.getGitHubApiAuthorization?.()
    if (authorization) headers.Authorization = authorization
    const response = await Plugins.HttpGet(url, headers)
    if (response.status < 200 || response.status >= 300 || response.body?.message) {
      throw new Error(response.body?.message || 'GitHub 请求失败：HTTP ' + response.status)
    }
    return response.body
  }

  const latestRelease = async () => {
    const includePrerelease = Plugin.Channel === 'latest'
    const body = await api(LX_API + (includePrerelease ? '?per_page=30' : '/latest'))
    const releases = (Array.isArray(body) ? body : [body])
      .filter(
        (release) => !release.draft && (includePrerelease || !release.prerelease) && /^v?[0-9][0-9A-Za-z.+-]*-lx\.[0-9A-Za-z.+-]+$/.test(release.tag_name)
      )
      .sort((a, b) => Date.parse(b.published_at || b.created_at) - Date.parse(a.published_at || a.created_at))
    if (!releases.length) throw new Error('未找到可用的 sing-box-lx Release，请检查更新渠道')
    return releases[0]
  }

  const selectAsset = (release) => {
    const aliases = { x64: 'amd64', x86_64: 'amd64', aarch64: 'arm64', ia32: '386', x86: '386', arm: 'armv7', armv7l: 'armv7' }
    let arch = aliases[env.arch] || env.arch
    if (env.os === 'linux' && ['mips', 'mipsle'].includes(arch)) arch += '-softfloat'
    if (!['windows', 'linux', 'darwin'].includes(env.os)) throw new Error('不支持的操作系统：' + env.os)
    const version = release.tag_name.replace(/^v/, '')
    const base = `sing-box-${version}-${env.os}-${arch}`
    const suffix = env.os === 'windows' ? '.zip' : '.tar.gz'
    const names = [base + suffix, ...(env.os === 'windows' && arch === '386' ? [base + '-legacy-windows-7.zip'] : [])]
    const asset = names.map((name) => release.assets?.find((item) => item.name === name)).find(Boolean)
    if (!asset) throw new Error(`Release ${release.tag_name} 没有 ${env.os}/${env.arch} 的附件：${names.join(' / ')}`)
    return asset
  }

  const checksum = async (release, asset) => {
    if (/^sha256:[a-f0-9]{64}$/i.test(asset.digest || '')) return asset.digest.slice(7).toLowerCase()
    const sums = release.assets.find((item) => item.name === 'SHA256SUMS')
    if (!sums) throw new Error('该 Release 没有附件 SHA256 或 SHA256SUMS，已取消下载')
    const response = await Plugins.HttpGet(sums.browser_download_url)
    if (response.status !== 200 || typeof response.body !== 'string') throw new Error('无法读取 SHA256SUMS')
    for (const line of response.body.split(/\r?\n/)) {
      const match = line.match(/^([a-f0-9]{64})\s+\*?(.+)$/i)
      if (match && match[2] === asset.name) return match[1].toLowerCase()
    }
    throw new Error('SHA256SUMS 中未找到：' + asset.name)
  }

  const findBinary = async (dir, depth = 0) => {
    const entries = await Plugins.ReadDir(dir)
    const name = env.os === 'windows' ? 'sing-box.exe' : 'sing-box'
    const binary = entries.find((entry) => !entry.isDir && entry.name === name)
    if (binary) return dir + '/' + binary.name
    if (depth < 3) {
      for (const entry of entries.filter((item) => item.isDir)) {
        const found = await findBinary(dir + '/' + entry.name, depth + 1)
        if (found) return found
      }
    }
    return null
  }

  const checkConfig = async (binary, value, config) => {
    const file = LX_CACHE + '/check.json'
    const normalized = { ...config, outbounds: (config.outbounds || []).map((node) => lxFromNative(node) || node) }
    await Plugins.WriteFile(file, JSON.stringify(normalized, null, 2))
    await Plugins.Exec(binary, ['check', '-D', await Plugins.AbsolutePath(LX_CORE), '-c', await Plugins.AbsolutePath(file)], {
      Env: Plugins.getKernelRuntimeEnv(value === 'alpha')
    })
  }

  const validateCandidate = async (release, value) => {
    for (const file of release.files) {
      if ((await Plugins.FileSHA256(release.dir + '/' + file.name)).toLowerCase() !== file.sha256.toLowerCase()) {
        throw new Error('缓存的核心或 DLL 校验失败，未执行或修改核心：' + file.name)
      }
    }
    const binary = release.dir + '/' + coreName(value)
    await chmod(binary)
    const output = await Plugins.Exec(binary, ['version'])
    const version = output.match(/\bsing-box version\s+(\S+)/)?.[1]?.replace(/^v/, '')
    if (version !== release.tag.replace(/^v/, '') || !/\bwith_xhttp\b/.test(output) || !/\bwith_clash_api\b/.test(output)) {
      throw new Error('下载的核心版本不符，或缺少 with_xhttp / with_clash_api：\n' + output)
    }
    if (env.os === 'windows' && /\bwith_naive_outbound\b/.test(output) && !release.files.some((file) => file.name === 'libcronet.dll')) {
      throw new Error('Windows Release 启用了 NaiveProxy，但压缩包缺少 libcronet.dll')
    }
    await Plugins.MakeDir(LX_CORE)
    await checkConfig(binary, value, {
      outbounds: [
        {
          type: 'vless',
          tag: 'lx-check',
          server: '127.0.0.1',
          server_port: 443,
          uuid: '00000000-0000-4000-8000-000000000000',
          transport: { type: 'xhttp', path: '/', mode: 'auto' }
        }
      ],
      experimental: { clash_api: { external_controller: '127.0.0.1:0' } }
    })
    const profile = Plugins.useProfilesStore().getProfileById(settings.app.kernel.profile)
    if (profile) await checkConfig(binary, value, await Plugins.generateConfig(profile))
  }

  const downloadRelease = async (release, value) => {
    const asset = selectAsset(release)
    const digest = await checksum(release, asset)
    const dir = `${LX_PATH}/releases/${release.id}-${asset.id}-${Date.now()}`
    const archive = LX_CACHE + '/' + asset.name
    const extract = LX_CACHE + '/extract'
    await Plugins.MakeDir(LX_CACHE)
    await Plugins.MakeDir(dir)
    await Plugins.RemoveFile(extract)
    const { id } = Plugins.message.info('下载 sing-box-lx ' + release.tag_name, 999999999)
    try {
      await Plugins.Download(
        asset.browser_download_url,
        archive,
        {},
        (loaded, total) => Plugins.message.update(id, '下载 sing-box-lx：' + (total ? ((loaded / total) * 100).toFixed(1) + '%' : Plugins.formatBytes(loaded))),
        { Sha256: digest }
      )
      if ((await Plugins.FileSHA256(archive)).toLowerCase() !== digest) throw new Error('下载文件的 SHA256 校验失败')
      if (asset.name.endsWith('.zip')) await Plugins.UnzipZIPFile(archive, extract)
      else await Plugins.UnzipTarGZFile(archive, extract)
      const binary = await findBinary(extract)
      if (!binary) throw new Error('压缩包中没有找到 sing-box 核心')
      const files = [{ name: coreName(value), sha256: await Plugins.FileSHA256(binary) }]
      await copyChecked(binary, dir + '/' + coreName(value), files[0].sha256)
      const dll = binary.slice(0, binary.lastIndexOf('/')) + '/libcronet.dll'
      if (env.os === 'windows' && (await Plugins.FileExists(dll))) {
        const file = { name: 'libcronet.dll', sha256: await Plugins.FileSHA256(dll) }
        await copyChecked(dll, dir + '/' + file.name, file.sha256)
        files.push(file)
      }
      const candidate = { dir, tag: release.tag_name, releaseId: release.id, assetId: asset.id, files }
      validateRelease(candidate, value)
      await validateCandidate(candidate, value)
      return candidate
    } catch (error) {
      await Plugins.RemoveFile(dir).catch(() => {})
      throw error
    } finally {
      Plugins.message.destroy(id)
      await Plugins.RemoveFile(archive).catch(() => {})
      await Plugins.RemoveFile(extract).catch(() => {})
      await Plugins.RemoveFile(LX_CACHE + '/check.json').catch(() => {})
    }
  }

  const pruneReleases = async (state) => {
    const keep = new Set([state?.current?.dir, state?.previous?.dir])
    const dir = LX_PATH + '/releases'
    if (!(await Plugins.FileExists(dir))) return
    for (const item of await Plugins.ReadDir(dir)) {
      if (item.isDir && /^[0-9]+-[0-9]+-[0-9]+$/.test(item.name) && !keep.has(dir + '/' + item.name)) await Plugins.RemoveFile(dir + '/' + item.name)
    }
  }

  // The journal is written BEFORE touching live files. On startup, an unfinished
  // journal blocks the core until Recover restores the complete before-image.
  const changeCore = async (before, value, candidate) => {
    requireIdle()
    const wasRunning = kernel.running
    const snapshot = await takeSnapshot(value, before ? LX_PATH + '/rollback' : LX_PATH + '/original')
    const journal = { schema: 1, platform: platform(), branch: value, snapshot, before }
    await writeJSON(LX_JOURNAL, journal)
    try {
      if (wasRunning) await kernel.stopCore()
      requireStopped()
      if (candidate) {
        for (const name of fileNames(value)) {
          requireStopped()
          const file = candidate.files.find((item) => item.name === name)
          if (file) await copyChecked(candidate.dir + '/' + name, LX_CORE + '/' + name, file.sha256)
          else await Plugins.RemoveFile(LX_CORE + '/' + name)
        }
        await chmod(LX_CORE + '/' + coreName(value))
        const next = {
          schema: 1,
          platform: platform(),
          branch: value,
          original: before?.original || snapshot,
          current: candidate,
          previous: before?.current || null
        }
        await saveState(next)
        if (wasRunning) {
          allowStart = true
          await kernel.startCore()
          allowStart = false
        }
        await Plugins.RemoveFile(LX_JOURNAL)
        await pruneReleases(next).catch((error) => Plugins.message.warn('核心已更新，但旧缓存清理失败：' + stringifyError(error)))
      } else {
        await restoreSnapshot(before.original, value)
        await saveState(null)
        await Plugins.RemoveFile(LX_JOURNAL)
        await pruneReleases(null).catch(() => {})
      }
    } catch (error) {
      allowStart = false
      try {
        if (kernel.running) await kernel.stopCore()
        requireStopped()
        await restoreSnapshot(snapshot, value)
        await saveState(before)
        await Plugins.RemoveFile(LX_JOURNAL)
      } catch (recoveryError) {
        throw new Error(`切换失败：${stringifyError(error)}\n自动恢复失败：${stringifyError(recoveryError)}\n请保留 ${LX_PATH} 并运行「恢复中断操作」。`)
      }
      if (wasRunning) {
        try {
          allowStart = true
          await kernel.startCore()
        } catch (restartError) {
          throw new Error(`切换失败，已恢复原文件：${stringifyError(error)}\n原核心重启失败：${stringifyError(restartError)}`)
        } finally {
          allowStart = false
        }
      }
      throw new Error('切换失败，已恢复原文件：' + stringifyError(error))
    }
  }

  const Update = () =>
    exclusive(async () => {
      await requireNoJournal()
      requireIdle()
      const before = await readState()
      const value = branch()
      if (before && before.branch !== value) throw new Error('请先切回已接管的分支，或恢复原核心后再切换分支')
      const release = await latestRelease()
      const matches = before && (await matchesRelease(before.current, value))
      if (matches && before.current.tag === release.tag_name) {
        Plugins.message.success('已是所选渠道的最新版本：' + release.tag_name)
        return
      }
      const details = [
        `安装 ${release.tag_name} 到 GUI 的 ${value} 分支。`,
        '会备份并替换该分支的核心文件；Windows 同时管理共享的 libcronet.dll。',
        kernel.running ? '新核心下载并通过配置检查后，会停止当前核心，替换成功后重新启动。' : '当前核心未运行，安装后保持停止。',
        before && !matches ? '检测到核心已被其他操作替换，本次安装会覆盖当前文件；首次备份仍然保留。' : '',
        'GUI 自带的核心更新仍指向官方版本，安装后请通过本插件更新。'
      ]
      if (!(await confirm(details.filter(Boolean).join('\n\n')))) return
      const candidate = await downloadRelease(release, value)
      await changeCore(before, value, candidate)
      Plugins.message.success('已安装 sing-box-lx ' + candidate.tag)
    })

  const CheckUpdate = async (interactive = true) => {
    const state = await readState()
    const release = await latestRelease()
    const current = state?.current.tag || '尚未安装'
    const changed = current !== release.tag_name
    if (interactive) {
      await Plugins.alert(
        Plugin.name,
        `当前版本：${current}\n最新 Release：${release.tag_name}\n渠道：${Plugin.Channel === 'latest' ? '含预发布' : '正式版'}\n\n${changed ? '运行「安装 / 更新核心」以安装该版本。' : '已是所选渠道的最新版本。'}`
      )
    } else if (changed) {
      Plugins.message.info(`sing-box-lx 可安装 ${release.tag_name}（当前：${current}），请通过插件菜单更新`, 8000)
    }
  }

  const Rollback = () =>
    exclusive(async () => {
      await requireNoJournal()
      requireIdle()
      const state = await readState()
      if (!state?.previous) throw new Error('没有可回滚的 sing-box-lx 版本')
      if (state.branch !== branch()) throw new Error('请先切回已接管的核心分支')
      if (!(await confirm(`回滚到 ${state.previous.tag}？${kernel.running ? '\n将停止核心并在回滚成功后重启。' : ''}`))) return
      await Plugins.MakeDir(LX_CACHE)
      try {
        await validateCandidate(state.previous, state.branch)
        await changeCore(state, state.branch, state.previous)
      } finally {
        await Plugins.RemoveFile(LX_CACHE + '/check.json').catch(() => {})
      }
      Plugins.message.success('已回滚到 ' + state.previous.tag)
    })

  const restore = async () => {
    await requireNoJournal()
    requireIdle()
    const state = await readState()
    if (!state) return
    if (!(await confirm('恢复安装前的核心和 DLL？\n当前核心会停止，恢复后保持停止。XHTTP 节点需移除或禁用；仅当确认不再需要 lx 后继续。'))) {
      throw new Error('已取消恢复，未修改核心')
    }
    await verifySnapshot(state.original)
    await changeCore(state, state.branch, null)
    Plugins.message.success('已恢复安装前的文件，核心保持停止')
  }

  const Restore = () => exclusive(restore)

  const Recover = () =>
    exclusive(async () => {
      if (!(await Plugins.FileExists(LX_JOURNAL))) {
        Plugins.message.info('没有待恢复的中断操作')
        return
      }
      const journal = JSON.parse(await Plugins.ReadFile(LX_JOURNAL))
      if (journal.schema !== 1 || journal.platform !== platform() || !['main', 'alpha'].includes(journal.branch))
        throw new Error('恢复日志不兼容，请保留备份并手动恢复')
      validateSnapshot(journal.snapshot, journal.branch)
      if (journal.before) {
        validateState(journal.before)
        if (journal.before.branch !== journal.branch) throw new Error('恢复日志的核心分支不一致，请保留备份并手动恢复')
      }
      await verifySnapshot(journal.snapshot)
      requireIdle()
      if (!(await confirm('将恢复上次切换前的全部核心文件和状态，当前核心会停止，恢复后保持停止。是否继续？'))) return
      if (kernel.running) await kernel.stopCore()
      requireStopped()
      await restoreSnapshot(journal.snapshot, journal.branch)
      await saveState(journal.before)
      await Plugins.RemoveFile(LX_JOURNAL)
      Plugins.message.success('已恢复中断操作，核心保持停止')
    })

  const ViewStatus = async () => {
    const state = await readState()
    const pending = await Plugins.FileExists(LX_JOURNAL)
    const lines = [
      '平台：' + platform(),
      'GUI 当前分支：' + branch(),
      '已接管分支：' + (state?.branch || '无'),
      '已安装版本：' + (state?.current.tag || '无'),
      '可回滚版本：' + (state?.previous?.tag || '无'),
      '核心文件：' +
        (state ? ((await matchesRelease(state.current, state.branch)) ? '与安装记录一致' : '已被外部操作修改，请通过插件重新安装或恢复') : '未接管'),
      '恢复日志：' + (pending ? '有中断操作，请先恢复' : '无'),
      '备份目录：' + LX_PATH,
      '',
      '请把本插件放在「节点转换」之前，并停用「Xray 前置代理」。',
      '禁用或卸载插件会要求先恢复原核心。恢复后核心保持停止。',
      'Linux/macOS 更换二进制后，TUN 可能需要通过「授予 TUN 权限」重新授权。'
    ]
    await Plugins.alert(Plugin.name, lines.join('\n'))
  }

  const GrantTUN = () =>
    exclusive(async () => {
      await requireNoJournal()
      requireStopped()
      const state = await readState()
      if (!state) throw new Error('请先安装 sing-box-lx')
      if (env.os === 'windows') throw new Error('Windows 请使用 GUI 的管理员模式运行 TUN')
      await Plugins.GrantTUNPermission(LX_CORE + '/' + coreName(state.branch))
      Plugins.message.success('已授予 TUN 权限')
    })

  const OpenReleases = () => Plugins.BrowserOpenURL(LX_RELEASES)

  const onRun = async () => {
    const action = await Plugins.picker.single(Plugin.name, [
      { label: '安装 / 更新核心', value: 'Update', description: '从 sing-box-lx Releases 下载、校验并安装到当前分支' },
      { label: '检查 Release 更新', value: 'CheckUpdate' },
      { label: '查看状态和使用说明', value: 'ViewStatus' },
      { label: '回滚上一 lx 版本', value: 'Rollback' },
      { label: '恢复原核心（保持停止）', value: 'Restore' },
      { label: '恢复中断操作', value: 'Recover' },
      { label: '授予 TUN 权限（Linux/macOS）', value: 'GrantTUN' },
      { label: '打开 Releases', value: 'OpenReleases' }
    ])
    const handlers = { Update, CheckUpdate, ViewStatus, Rollback, Restore, Recover, GrantTUN, OpenReleases }
    if (handlers[action]) await handlers[action]()
  }

  const onSubscribe = async (proxies, subscription) => {
    if (Plugin.ConvertXHTTP === false) return proxies
    const plugins = Plugins.usePluginsStore()
    const enabled = plugins.plugins.filter((item) => !item.disabled)
    if (enabled.some((item) => item.id === LX_XRAY)) throw new Error('请先停用「Xray 前置代理」，再更新订阅，避免两套 XHTTP 适配互相覆盖')
    const converter = enabled.findIndex((item) => item.id === LX_CONVERTER)
    const self = enabled.findIndex((item) => item.id === Plugin.id)
    if (converter !== -1 && converter < self) throw new Error('请把 sing-box-lx 插件拖到「节点转换」之前，再重新更新订阅')

    const encoded = proxies.length === 1 && typeof proxies[0].base64 === 'string'
    const source = encoded
      ? lxDecodeBase64(proxies[0].base64)
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      : proxies
    const converted = []
    const ordinary = []
    const order = []
    for (const node of source) {
      const outbound = encoded ? lxFromURI(node) : node.name && !node.tag ? lxFromClash(node) : lxFromNative(node)
      if (outbound) {
        converted.push(outbound)
        order.push(outbound.tag)
      } else {
        ordinary.push(node)
        order.push(encoded ? lxURIName(node) : node.tag || node.name)
      }
    }
    if (!converted.length) return proxies
    const raw = ordinary.filter((node) => encoded || (node.name && !node.tag))
    let rest = ordinary.filter((node) => !encoded && !(node.name && !node.tag))
    if (raw.length) {
      if (converter === -1) throw new Error('混合订阅中还有普通节点，请先安装并启用「节点转换」，并将本插件放在它之前')
      const result = await plugins.manualTrigger(LX_CONVERTER, 'onSubscribe', encoded ? [{ base64: Plugins.base64Encode(raw.join('\n')) }] : raw, subscription)
      if (!Array.isArray(result) || result.some((node) => !node.tag || !node.type)) throw new Error('「节点转换」没有返回有效的 sing-box 节点数组')
      rest = rest.concat(result)
    }
    const remaining = rest.concat(converted)
    const result = []
    for (const tag of order) {
      const index = remaining.findIndex((node) => node.tag === tag)
      if (index !== -1) result.push(...remaining.splice(index, 1))
    }
    return result.concat(remaining)
  }

  const onBeforeCoreStart = async (config) => {
    if (busy && !allowStart) throw new Error('sing-box-lx 正在切换核心，请等待操作完成')
    if (!allowStart) await requireNoJournal()
    const state = await readState()
    const usesXHTTP = (config.outbounds || []).some((node) => ['xhttp', 'splithttp'].includes(node.transport?.type))
    if (state && state.branch === branch() && !(await matchesRelease(state.current, state.branch))) {
      throw new Error('已接管的核心或 DLL 被其他操作替换，请通过 sing-box-lx 插件重新安装或恢复原核心')
    }
    if (usesXHTTP && (!state || state.branch !== branch())) throw new Error('当前配置包含 XHTTP，请先通过插件安装 sing-box-lx，并选择已接管的核心分支')
    if (usesXHTTP) {
      config.outbounds = config.outbounds.map((node) => lxFromNative(node) || node)
    }
    return config
  }

  const onInstall = async () => {
    await Plugins.MakeDir(LX_PATH)
    Plugins.message.info('已添加 sing-box-lx 管理插件。请运行插件，选择「安装 / 更新核心」；订阅适配需排在「节点转换」之前。', 10000)
  }

  const onReady = async () => {
    if (await Plugins.FileExists(LX_JOURNAL)) {
      Plugins.message.warn('sing-box-lx 检测到中断操作，请先运行「恢复中断操作」')
      return
    }
    if (Plugin.CheckOnStartup) await CheckUpdate(false).catch((error) => Plugins.message.warn('sing-box-lx 检查更新失败：' + stringifyError(error)))
  }

  const onDisabled = () => exclusive(restore)
  const onDispose = () => {
    if (busy) throw new Error('sing-box-lx 正在执行操作，请等待完成后再更新或重载插件')
  }
  const onUninstall = () =>
    exclusive(async () => {
      await restore()
      await Plugins.RemoveFile(LX_PATH)
      await Plugins.RemoveFile(LX_CACHE)
    })

  return {
    onInstall,
    onUninstall,
    onDisabled,
    onDispose,
    onRun,
    onReady,
    onSubscribe,
    onBeforeCoreStart,
    onTask: () => CheckUpdate(false),
    Update,
    CheckUpdate,
    Rollback,
    Restore,
    Recover,
    ViewStatus,
    GrantTUN,
    OpenReleases
  }
}

const lxDecodeBase64 = (text) => {
  const normalized = text.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  return Plugins.base64Decode(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
}

const lxBoolean = (value) => {
  if ([true, 1, '1', 'true'].includes(value)) return true
  if ([false, 0, '0', 'false'].includes(value)) return false
  throw new Error('无效的布尔值：' + value)
}

const lxObject = (value, label) => {
  const object = typeof value === 'string' ? JSON.parse(value) : value
  if (!object || typeof object !== 'object' || Array.isArray(object)) throw new Error(label + ' 必须是对象')
  return object
}

// Field names and value types follow option/v2ray_xhttp.go, not Xray's JSON
// schema. Unsupported extras fail visibly instead of silently losing settings.
const lxSnake = (key) =>
  key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase()

const lxRange = (value) => {
  if (Array.isArray(value) && value.length === 2) value = value.join('-')
  const text = String(value)
  if (!/^\d+(?:-\d+)?$/.test(text)) throw new Error('无效的 XHTTP 数值范围：' + text)
  const [min, max = min] = text.split('-').map(Number)
  if (min > max) throw new Error('XHTTP 数值范围起点大于终点：' + text)
  return text
}

const lxTransport = (options = {}) => {
  const result = { type: 'xhttp' }
  const ranges = ['x_padding_bytes', 'session_length', 'uplink_chunk_size', 'sc_max_each_post_bytes', 'sc_min_posts_interval_ms', 'sc_stream_up_server_secs']
  const booleans = ['no_grpc_header', 'no_sse_header', 'x_padding_obfs_mode']
  const integers = ['sc_max_concurrent_posts', 'sc_max_buffered_posts', 'server_max_header_bytes']
  const strings = [
    'host',
    'path',
    'mode',
    'session_placement',
    'session_key',
    'session_table',
    'seq_placement',
    'seq_key',
    'uplink_data_placement',
    'uplink_data_key',
    'uplink_http_method',
    'x_padding_key',
    'x_padding_header',
    'x_padding_placement',
    'x_padding_method'
  ]
  const extra = options.extra === undefined || options.extra === '' ? {} : lxObject(options.extra, 'XHTTP extra')
  for (const [rawKey, value] of Object.entries({ ...extra, ...options })) {
    if (value === undefined || value === null || rawKey === 'extra' || rawKey === 'type') continue
    let key = lxSnake(rawKey)
    key =
      { session_id_placement: 'session_placement', session_id_key: 'session_key', session_id_table: 'session_table', session_id_length: 'session_length' }[
        key
      ] || key
    if (ranges.includes(key)) result[key] = value === '' ? '' : lxRange(value)
    else if (booleans.includes(key)) result[key] = lxBoolean(value)
    else if (integers.includes(key)) {
      if (!Number.isSafeInteger(Number(value)) || Number(value) < 0) throw new Error('无效的 XHTTP 整数字段：' + rawKey)
      result[key] = Number(value)
    } else if (strings.includes(key)) {
      if (typeof value !== 'string') throw new Error('XHTTP 字段必须是字符串：' + rawKey)
      result[key] = value
    } else if (key === 'headers') result.headers = lxObject(value, 'XHTTP headers')
    else if (key === 'xmux') {
      const xmux = lxObject(value, 'XHTTP xmux')
      result.xmux = {}
      for (const [name, range] of Object.entries(xmux)) {
        const field = lxSnake(name)
        if (field === 'h_keep_alive_period') {
          if (!Number.isSafeInteger(Number(range))) throw new Error('无效的 XMUX h_keep_alive_period')
          result.xmux[field] = Number(range)
        } else if (['max_concurrency', 'max_connections', 'c_max_reuse_times', 'h_max_request_times', 'h_max_reusable_secs'].includes(field)) {
          result.xmux[field] = lxRange(range)
        } else throw new Error('sing-box-lx 不支持 XMUX 字段：' + name)
      }
    } else throw new Error('sing-box-lx 不支持 XHTTP 字段：' + rawKey)
  }
  result.path ||= '/'
  result.mode ||= 'auto'
  if (!['auto', 'packet-up', 'stream-up', 'stream-one'].includes(result.mode)) throw new Error('不支持的 XHTTP mode：' + result.mode)
  return result
}

const lxTLS = (query, defaultTLS = false) => {
  const security = String(query.security || (defaultTLS ? 'tls' : 'none')).toLowerCase()
  if (!['none', 'tls', 'reality'].includes(security)) throw new Error('不支持的安全层：' + security)
  if (query.pqv || query.spx) throw new Error('sing-box-lx 不支持 REALITY pqv / spiderX，请使用兼容的节点参数')
  const unsupported = ['ech', 'echConfig', 'pinSHA256', 'certificate'].filter((key) => query[key])
  if (unsupported.length) throw new Error('尚未适配的 TLS 参数：' + unsupported.join(', ') + '；请改用原生 sing-box-lx JSON')
  if (security === 'none') return undefined
  const tls = { enabled: true }
  if (query.sni) tls.server_name = query.sni
  if (query.alpn) tls.alpn = Array.isArray(query.alpn) ? query.alpn : String(query.alpn).split(',').filter(Boolean)
  if (query.allowInsecure !== undefined || query.insecure !== undefined) tls.insecure = lxBoolean(query.allowInsecure ?? query.insecure)
  if (query.fp || security === 'reality') tls.utls = { enabled: true, fingerprint: query.fp || 'chrome' }
  if (security === 'reality') {
    if (!query.pbk) throw new Error('REALITY 节点缺少 public key')
    tls.reality = { enabled: true, public_key: query.pbk, short_id: query.sid || '' }
    if (query.keyShare) tls.reality.key_share = query.keyShare
  }
  return tls
}

const lxEndpoint = (outbound) => {
  if (
    typeof outbound.tag !== 'string' ||
    !outbound.tag ||
    typeof outbound.server !== 'string' ||
    !outbound.server ||
    !Number.isInteger(outbound.server_port) ||
    outbound.server_port < 1 ||
    outbound.server_port > 65535
  ) {
    throw new Error('XHTTP 节点名称、地址或端口无效')
  }
  const credential = outbound.type === 'trojan' ? outbound.password : outbound.uuid
  if (!['vless', 'vmess', 'trojan'].includes(outbound.type) || typeof credential !== 'string' || !credential) {
    throw new Error('XHTTP 节点协议或身份凭据无效')
  }
  return outbound
}

const lxURIName = (link) => {
  try {
    if (/^vmess:\/\//i.test(link)) return JSON.parse(lxDecodeBase64(link.slice(8))).ps
    const hash = link.indexOf('#')
    if (hash !== -1) return decodeURIComponent(link.slice(hash + 1))
    const query = link.indexOf('?')
    return query === -1 ? '' : new URLSearchParams(link.slice(query + 1)).get('remarks') || ''
  } catch {
    return ''
  }
}

const lxFromURI = (link) => {
  if (/^vmess:\/\//i.test(link)) {
    let node
    try {
      node = lxObject(JSON.parse(lxDecodeBase64(link.slice(8))), 'VMess')
    } catch {
      if (/[?&](?:type|network)=(?:xhttp|splithttp)(?:&|#|$)/i.test(link)) throw new Error('XHTTP VMess 请使用 JSON/Base64 分享格式')
      return null
    }
    if (!['xhttp', 'splithttp'].includes(String(node.net).toLowerCase())) return null
    const outbound = {
      type: 'vmess',
      tag: node.ps || `vmess-${node.add}:${node.port}`,
      server: node.add,
      server_port: Number(node.port),
      uuid: node.id,
      security: node.scy || 'auto',
      alter_id: Number(node.aid || 0),
      transport: lxTransport({ host: node.host || '', path: node.path || '/', mode: node.mode || 'auto', extra: node.extra })
    }
    const tls = lxTLS({ security: node.tls || 'none', sni: node.sni || node.host, fp: node.fp, alpn: node.alpn, allowInsecure: node.allowInsecure })
    if (tls) outbound.tls = tls
    return lxEndpoint(outbound)
  }
  if (!/^(vless|trojan):\/\//i.test(link)) {
    if (/[?&](?:type|network|obfs)=(?:xhttp|splithttp)(?:&|#|$)/i.test(link)) throw new Error('仅支持 VLESS / VMess / Trojan 的 XHTTP 分享链接')
    return null
  }
  // Shadowrocket exports vless://base64(none:uuid@server:port)?obfs=xhttp
  // with tls/peer/obfsParam aliases. Decode the authority BEFORE using URL;
  // otherwise its Base64 text is mistaken for a hostname and the UUID is lost.
  const match = link.match(/^(vless|trojan):\/\/([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/i)
  if (!match) throw new Error('无法解析 XHTTP 分享链接')
  const [, scheme, rawAuthority, rawQuery = '', rawName = ''] = match
  const query = Object.fromEntries(new URLSearchParams(rawQuery))
  if (!['xhttp', 'splithttp'].includes(String(query.type || query.network || query.obfs).toLowerCase())) return null
  const type = scheme.toLowerCase()
  let authority = rawAuthority
  if (type === 'vless' && !authority.includes('@')) {
    try {
      authority = lxDecodeBase64(decodeURIComponent(authority))
    } catch {
      throw new Error('VLESS 连接信息不是有效的 Base64')
    }
    if (!authority.includes('@')) throw new Error('VLESS 连接信息缺少身份凭据或服务器地址')
  }
  const url = new URL(`${type}://${authority}`)
  if (!url.username || (url.pathname && url.pathname !== '/') || url.search || url.hash) throw new Error('XHTTP 分享链接的连接信息格式无效')
  let credential = decodeURIComponent(url.username)
  const userinfo = authority.slice(0, authority.lastIndexOf('@'))
  if (type === 'vless') {
    if (userinfo.includes(':')) {
      if (credential !== 'none' || !url.password) throw new Error('VLESS 连接信息应为 UUID 或 none:UUID')
      credential = decodeURIComponent(url.password)
    } else if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(credential)) {
      try {
        const decoded = lxDecodeBase64(credential)
        const encodedUser = decoded.match(/^(?:none:)?([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i)
        if (encodedUser) credential = encodedUser[1]
      } catch {
        // Keep standard, non-Base64 credentials for the core's validation.
      }
    }
  } else if (url.password) throw new Error('XHTTP 分享链接的用户信息格式无效')
  if (!query.security && query.tls !== undefined) query.security = query.tls === 'tls' || lxBoolean(query.tls) ? 'tls' : 'none'
  query.sni ||= query.peer
  query.fp ||= query.fingerprint
  let transportHost = query.host || query.obfsParam || ''
  if (transportHost.trim().startsWith('{')) {
    const headers = lxObject(transportHost, 'XHTTP obfsParam')
    transportHost = headers.Host || headers.host || ''
    if (typeof transportHost !== 'string' || !transportHost) throw new Error('XHTTP obfsParam JSON 缺少 Host 字符串')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const outbound = {
    type,
    tag: decodeURIComponent(rawName) || query.remarks || `${type}-${host}:${url.port || 443}`,
    server: host,
    server_port: Number(url.port || 443),
    transport: lxTransport({ host: transportHost, path: query.path || '/', mode: query.mode || 'auto', extra: query.extra })
  }
  if (type === 'vless') {
    outbound.uuid = credential
    if (query.flow) outbound.flow = query.flow
    if (query.encryption && query.encryption !== 'none') outbound.encryption = query.encryption
    if (query.packetEncoding || query.packet_encoding) outbound.packet_encoding = query.packetEncoding || query.packet_encoding
  } else outbound.password = credential
  if (query.udp !== undefined && !lxBoolean(query.udp)) outbound.network = 'tcp'
  const tls = lxTLS(query, type === 'trojan')
  if (tls) outbound.tls = tls
  return lxEndpoint(outbound)
}

// Mihomo adapter/outbound/ech.go uses a Base64 ECHConfigList; lx common/tls/ech.go
// expects the same bytes inside an ECH CONFIGS PEM block.
const lxClashECH = (value) => {
  const options = lxObject(value, 'Clash ech-opts')
  const unsupported = Object.keys(options).filter((key) => !['enable', 'config', 'query-server-name'].includes(key))
  if (unsupported.length) throw new Error('尚未适配的 Clash ech-opts 字段：' + unsupported.join(', ') + '；请改用原生 sing-box-lx JSON')
  const ech = { enabled: options.enable === undefined ? false : lxBoolean(options.enable) }
  if (!ech.enabled) return ech
  if (options.config !== undefined) {
    if (typeof options.config !== 'string') throw new Error('Clash ech-opts.config 必须是 Base64 字符串')
    const config = options.config.replace(/\s+/g, '')
    if (config) {
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(config)) {
        throw new Error('Clash ech-opts.config 不是有效的 Base64')
      }
      ech.config = ['-----BEGIN ECH CONFIGS-----', ...config.match(/.{1,64}/g), '-----END ECH CONFIGS-----'].join('\n')
    }
  }
  if (options['query-server-name'] !== undefined) {
    if (typeof options['query-server-name'] !== 'string') throw new Error('Clash ech-opts.query-server-name 必须是字符串')
    if (options['query-server-name']) ech.query_server_name = options['query-server-name']
  }
  return ech
}

const lxFromClash = (node) => {
  if (!['xhttp', 'splithttp'].includes(String(node.network).toLowerCase())) return null
  if (!['vless', 'vmess', 'trojan'].includes(node.type)) throw new Error('不支持的 XHTTP 节点协议：' + node.type)
  const reality = node['reality-opts']
  const tls = lxTLS({
    security: reality ? 'reality' : node.tls || node.type === 'trojan' ? 'tls' : 'none',
    sni: node.servername || node.sni,
    fp: node['client-fingerprint'],
    alpn: node.alpn,
    insecure: node['skip-cert-verify'],
    pbk: reality?.['public-key'],
    sid: reality?.['short-id'],
    spx: reality?.['spider-x'] || reality?._spider_x,
    pqv: reality?.pqv,
    keyShare: reality?.['key-share']
  })
  if (node['ech-opts'] !== undefined) {
    const ech = lxClashECH(node['ech-opts'])
    if (ech.enabled) {
      if (!tls) throw new Error('ECH 需要启用 TLS，请设置 tls: true')
      if (tls.reality) throw new Error('ECH 不能与 REALITY 同时启用')
    }
    if (tls) tls.ech = ech
  }
  const outbound = {
    type: node.type,
    tag: node.name,
    server: node.server,
    server_port: Number(node.port),
    transport: lxTransport(node['xhttp-opts'] || node['splithttp-opts'] || {})
  }
  if (node.type === 'trojan') outbound.password = node.password
  else outbound.uuid = node.uuid
  if (node.type === 'vless') {
    if (node.flow) outbound.flow = node.flow
    if (node.encryption && node.encryption !== 'none') outbound.encryption = node.encryption
    if (node['packet-encoding']) outbound.packet_encoding = node['packet-encoding']
  }
  if (node.type === 'vmess') {
    outbound.security = node.cipher || 'auto'
    outbound.alter_id = Number(node.alterId || 0)
    if (node['packet-encoding']) outbound.packet_encoding = node['packet-encoding']
  }
  if (node.udp === false) outbound.network = 'tcp'
  if (tls) outbound.tls = tls
  const unsupported = [
    'smux',
    'dialer-proxy',
    'ip-version',
    'interface-name',
    'routing-mark',
    'fingerprint',
    'ca',
    'ca-str',
    'client-cert',
    'client-key',
    'certificate',
    'certificate-path',
    'client-certificate',
    'client-certificate-path'
  ].filter((key) => node[key] !== undefined)
  if (unsupported.length) throw new Error('XHTTP 节点含有尚未适配的 Clash 字段：' + unsupported.join(', ') + '；请改用原生 sing-box-lx JSON')
  return lxEndpoint(outbound)
}

const lxFromNative = (node) => {
  if (!['xhttp', 'splithttp'].includes(node.transport?.type)) return null
  return lxEndpoint({ ...node, transport: lxTransport(node.transport) })
}
