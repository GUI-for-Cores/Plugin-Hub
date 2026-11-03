import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import createPlugin from '../plugins/GFS/plugin-sing-box-lx.js'

const ROOT = 'data/third/sing-box-lx'
const CORE = 'data/sing-box'
// ECHConfigList with a public X25519 key, HKDF-SHA256/AES-128-GCM and public.example.
const ECH_CONFIG = 'AEH+DQA9AAAgACBCYPOLpjTMBpPoMK3mtxiXne/6uJYjizQ4PhgN7TQVLgAEAAEAAQAOcHVibGljLmV4YW1wbGUAAA=='
const hash = (value) => createHash('sha256').update(value).digest('hex')
const binary = (tag) => `sing-box version ${tag.replace(/^v/, '')}\nTags: with_xhttp,with_clash_api,with_naive_outbound`

function harness(options = {}) {
  const files = new Map([
    [CORE + '/sing-box.exe', 'official core'],
    [CORE + '/libcronet.dll', 'original dll']
  ])
  const dirs = new Set()
  const messages = []
  const calls = []
  const faults = {}
  let releaseNumber = 1
  let currentRelease
  let activePlugin
  const metadata = { id: 'plugin-sing-box-lx', name: 'sing-box-lx', Channel: 'stable', ConvertXHTTP: true, CheckOnStartup: false, ...options }
  const subscription = { id: 'test-subscription' }
  const config = { outbounds: [] }
  const env = { os: 'windows', arch: 'amd64' }
  const settings = { app: { kernel: { branch: 'main', profile: 'profile' } } }
  const pathOf = (value) => value.replace(/^ABS\//, '')
  const get = (path) => {
    path = pathOf(path)
    if (!files.has(path)) throw new Error('File not found: ' + path)
    return files.get(path)
  }
  const remove = (path) => {
    files.delete(path)
    for (const key of files.keys()) if (key.startsWith(path + '/')) files.delete(key)
    for (const key of dirs) if (key === path || key.startsWith(path + '/')) dirs.delete(key)
  }
  const setRelease = (tag, extras = {}) => {
    const version = tag.replace(/^v/, '')
    const name = `sing-box-${version}-${env.os}-${env.arch}${env.os === 'windows' ? '.zip' : '.tar.gz'}`
    const archive = JSON.stringify({
      [`sing-box-${version}/sing-box${env.os === 'windows' ? '.exe' : ''}`]: binary(tag),
      ...(env.os === 'windows' ? { [`sing-box-${version}/libcronet.dll`]: 'dll ' + tag } : {})
    })
    const id = releaseNumber++
    const asset = { id: id * 10, name, digest: 'sha256:' + hash(archive), browser_download_url: 'https://download/' + id }
    currentRelease = {
      id,
      tag_name: tag,
      draft: false,
      prerelease: false,
      published_at: `2026-10-${String(id).padStart(2, '0')}T00:00:00Z`,
      assets: [asset],
      archive,
      ...extras
    }
    return currentRelease
  }
  setRelease('v1.14.4-lx.29')
  const kernel = {
    running: false,
    starting: false,
    stopping: false,
    restarting: false,
    async stopCore() {
      calls.push('stop')
      if (faults.stop) throw new Error('stop failed')
      kernel.running = false
    },
    async startCore() {
      calls.push('start')
      await activePlugin.onBeforeCoreStart(structuredClone(config))
      if (faults.startTag && get(CORE + '/sing-box.exe').includes(faults.startTag)) throw new Error('startup failed')
      kernel.running = true
    }
  }
  const pluginStore = {
    plugins: [
      { id: metadata.id, disabled: false },
      { id: 'plugin-node-convert', disabled: false }
    ],
    async manualTrigger(id, event, nodes, sub) {
      calls.push({ id, event, nodes, sub })
      if (faults.converter) return faults.converter
      if (nodes[0]?.base64) {
        return Buffer.from(nodes[0].base64, 'base64')
          .toString()
          .split('\n')
          .map((uri) => ({ type: 'ss', tag: decodeURIComponent(new URL(uri).hash.slice(1)), server: 'normal.example', server_port: 443 }))
      }
      return nodes.map((node) => ({ type: node.type, tag: node.name, server: node.server, server_port: node.port }))
    }
  }
  const api = {
    useEnvStore: () => ({ env }),
    useKernelApiStore: () => kernel,
    useAppSettingsStore: () => settings,
    usePluginsStore: () => pluginStore,
    useProfilesStore: () => ({ getProfileById: () => (faults.noProfile ? undefined : { id: 'profile' }) }),
    getKernelFileName: (alpha) => `sing-box${alpha ? '-latest' : ''}${env.os === 'windows' ? '.exe' : ''}`,
    getKernelRuntimeEnv: () => ({ TEST_ENV: '1' }),
    generateConfig: async () => structuredClone(config),
    getGitHubApiAuthorization: () => '',
    async confirm() {
      return faults.cancel ? false : true
    },
    async alert(title, content) {
      messages.push(content)
    },
    picker: { single: async () => faults.action },
    BrowserOpenURL: (url) => calls.push(url),
    GrantTUNPermission: async (path) => calls.push({ grant: path }),
    message: {
      info: (message) => {
        messages.push(message)
        return { id: 'progress' }
      },
      warn: (message) => messages.push(message),
      success: (message) => messages.push(message),
      update() {},
      destroy() {}
    },
    AbsolutePath: async (path) => 'ABS/' + path,
    FileExists: async (path) => files.has(path) || dirs.has(path) || [...files.keys()].some((key) => key.startsWith(path + '/')),
    FileSHA256: async (path) => hash(get(path)),
    ReadFile: async (path) => get(path),
    WriteFile: async (path, content) => {
      if (faults.writePath === path) throw new Error('write failed')
      files.set(path, content)
    },
    MakeDir: async (path) => {
      dirs.add(path)
    },
    RemoveFile: async (path) => {
      if (faults.removeJournal && path === ROOT + '/transaction.json') throw new Error('journal removal failed')
      remove(path)
    },
    CopyFile: async (source, target) => {
      if (faults.copyTarget === target && faults.copyCount > 0) {
        faults.copyCount--
        throw new Error('copy failed')
      }
      files.set(target, get(source))
    },
    MoveFile: async (source, target) => {
      files.set(target, get(source))
      files.delete(source)
    },
    ReadDir: async (path) => {
      const entries = new Map()
      for (const key of [...files.keys(), ...dirs]) {
        if (!key.startsWith(path + '/')) continue
        const rest = key.slice(path.length + 1)
        if (!rest) continue
        const [name, ...tail] = rest.split('/')
        entries.set(name, { name, isDir: tail.length > 0 || dirs.has(key), size: 1 })
      }
      return [...entries.values()]
    },
    async HttpGet(url) {
      calls.push({ get: url })
      if (url.startsWith('https://download/sums')) return { status: 200, body: `${hash(currentRelease.archive)}  ${currentRelease.assets[0].name}\n` }
      if (faults.httpStatus) return { status: faults.httpStatus, body: { message: 'rate limited' } }
      if (url.endsWith('/latest')) return { status: 200, body: currentRelease }
      return { status: 200, body: faults.releaseList || [currentRelease] }
    },
    async Download(url, path, headers, progress, opts) {
      calls.push({ download: url, checksum: opts.Sha256 })
      if (faults.download) throw new Error('network failed')
      if (faults.duringDownload) await faults.duringDownload()
      files.set(path, faults.badArchive ? 'corrupt' : currentRelease.archive)
      progress(1, 1)
      return { status: 200 }
    },
    async UnzipZIPFile(archive, dir) {
      for (const [path, content] of Object.entries(JSON.parse(get(archive)))) files.set(dir + '/' + path, content)
    },
    async UnzipTarGZFile(archive, dir) {
      await api.UnzipZIPFile(archive, dir)
    },
    async Exec(path, args, opts) {
      calls.push({ exec: path, args, opts })
      if (path === 'chmod') return ''
      const content = get(path)
      if (args[0] === 'version') return content
      if (args[0] === 'check') {
        const checked = JSON.parse(get(args[args.indexOf('-c') + 1]))
        if (faults.checkTag && content.includes(faults.checkTag)) throw new Error('invalid configuration')
        assert.ok(Array.isArray(checked.outbounds))
        return ''
      }
      throw new Error('Unexpected command')
    },
    formatBytes: (bytes) => bytes + ' B',
    base64Decode: (value) => Buffer.from(value, 'base64').toString('utf8'),
    base64Encode: (value) => Buffer.from(value).toString('base64')
  }
  globalThis.Plugins = api
  activePlugin = createPlugin(metadata)
  return {
    files,
    calls,
    faults,
    messages,
    kernel,
    settings,
    pluginStore,
    metadata,
    api,
    env,
    config,
    subscription,
    setRelease,
    plugin: activePlugin,
    reload() {
      activePlugin = createPlugin(metadata)
      return activePlugin
    },
    state: () => JSON.parse(get(ROOT + '/state.json')),
    get,
    release: () => currentRelease
  }
}

test('catalog and manual picker expose implemented handlers and triggers', async () => {
  const catalog = JSON.parse(await readFile(new URL('../plugins/gfs.json', import.meta.url), 'utf8'))
  const item = catalog.find((entry) => entry.id === 'plugin-sing-box-lx')
  assert.ok(item)
  assert.equal(catalog.filter((entry) => entry.id === item.id).length, 1)
  const h = harness()
  for (const handler of Object.values(item.menus)) assert.equal(typeof h.plugin[handler], 'function', handler)
  for (const handler of ['onRun', 'onReady', 'onSubscribe', 'onBeforeCoreStart', 'onInstall', 'onUninstall', 'onDisabled', 'onTask'])
    assert.equal(typeof h.plugin[handler], 'function')
  assert.ok(item.url.endsWith('/plugins/GFS/plugin-sing-box-lx.js'))
  h.faults.action = 'ViewStatus'
  await h.plugin.onRun()
  assert.match(h.messages.at(-1), /尚|未接管/)
})

test('install verifies checksums, backs up core and DLL, and restarts a running core', async () => {
  const h = harness()
  h.kernel.running = true
  await h.plugin.Update()
  assert.equal(h.get(CORE + '/sing-box.exe'), binary('v1.14.4-lx.29'))
  assert.equal(h.get(CORE + '/libcronet.dll'), 'dll v1.14.4-lx.29')
  assert.equal(h.get(ROOT + '/original/sing-box.exe'), 'official core')
  assert.equal(h.get(ROOT + '/original/libcronet.dll'), 'original dll')
  assert.equal(h.state().current.tag, 'v1.14.4-lx.29')
  assert.equal(h.kernel.running, true)
  assert.deepEqual(
    h.calls.filter((call) => typeof call === 'string'),
    ['stop', 'start']
  )
  assert.equal(h.files.has(ROOT + '/transaction.json'), false)
  assert.equal(h.files.has('data/.cache/sing-box-lx/check.json'), false)
})

test('release update retains original backup, rollback swaps lx versions, restore leaves core stopped', async () => {
  const h = harness()
  await h.plugin.Update()
  h.setRelease('v1.14.4-lx.30')
  h.kernel.running = true
  await h.plugin.Update()
  assert.equal(h.state().previous.tag, 'v1.14.4-lx.29')
  await h.plugin.Rollback()
  assert.equal(h.state().current.tag, 'v1.14.4-lx.29')
  assert.equal(h.get(CORE + '/libcronet.dll'), 'dll v1.14.4-lx.29')
  assert.equal(h.state().previous.tag, 'v1.14.4-lx.30')
  await h.plugin.Restore()
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
  assert.equal(h.get(CORE + '/libcronet.dll'), 'original dll')
  assert.equal(h.kernel.running, false)
  assert.equal(h.files.has(ROOT + '/state.json'), false)
})

test('cancel, failed download, corrupt archive, and failed config check leave live files untouched', async (t) => {
  for (const fault of ['cancel', 'download', 'badArchive', 'checkTag']) {
    await t.test(fault, async () => {
      const h = harness()
      h.kernel.running = true
      h.faults[fault] = fault === 'checkTag' ? '1.14.4-lx.29' : true
      if (fault === 'cancel') await h.plugin.Update()
      else await assert.rejects(h.plugin.Update())
      assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
      assert.equal(h.get(CORE + '/libcronet.dll'), 'original dll')
      assert.equal(h.kernel.running, true)
      assert.equal(h.calls.includes('stop'), false)
      assert.equal(h.files.has(ROOT + '/state.json'), false)
    })
  }
})

test('partial DLL replacement failure restores both original files and restarts', async () => {
  const h = harness()
  h.kernel.running = true
  h.faults.copyTarget = CORE + '/libcronet.dll'
  h.faults.copyCount = 1
  await assert.rejects(h.plugin.Update(), /已恢复原文件/)
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
  assert.equal(h.get(CORE + '/libcronet.dll'), 'original dll')
  assert.equal(h.kernel.running, true)
  assert.equal(h.files.has(ROOT + '/transaction.json'), false)
})

test('new core startup failure rolls back files and persisted state', async () => {
  const h = harness()
  await h.plugin.Update()
  h.kernel.running = true
  h.setRelease('v1.14.4-lx.30')
  h.faults.startTag = '1.14.4-lx.30'
  await assert.rejects(h.plugin.Update(), /已恢复原文件/)
  assert.equal(h.state().current.tag, 'v1.14.4-lx.29')
  assert.equal(h.get(CORE + '/libcronet.dll'), 'dll v1.14.4-lx.29')
  assert.equal(h.kernel.running, true)
})

test('failed automatic recovery retains a journal; reloaded plugin blocks startup and recovers', async () => {
  const h = harness()
  h.faults.copyTarget = CORE + '/libcronet.dll'
  h.faults.copyCount = 2
  await assert.rejects(h.plugin.Update(), /自动恢复失败/)
  assert.equal(h.files.has(ROOT + '/transaction.json'), true)
  const plugin = h.reload()
  await assert.rejects(plugin.onBeforeCoreStart({ outbounds: [] }), /恢复中断操作/)
  await plugin.Recover()
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
  assert.equal(h.get(CORE + '/libcronet.dll'), 'original dll')
  assert.equal(h.files.has(ROOT + '/transaction.json'), false)
  assert.equal(h.files.has(ROOT + '/state.json'), false)
})

test('restore removes DLL and binary if neither existed before the first install', async () => {
  const h = harness()
  h.files.clear()
  await h.plugin.Update()
  await h.plugin.Restore()
  assert.equal(h.files.has(CORE + '/sing-box.exe'), false)
  assert.equal(h.files.has(CORE + '/libcronet.dll'), false)
})

test('external overwrite blocks startup; explicit reinstall preserves first backup', async () => {
  const h = harness()
  await h.plugin.Update()
  h.files.set(CORE + '/sing-box.exe', 'another official version')
  await assert.rejects(h.plugin.onBeforeCoreStart({ outbounds: [] }), /被其他操作替换/)
  await h.plugin.Update()
  assert.equal(h.get(CORE + '/sing-box.exe'), binary('v1.14.4-lx.29'))
  await h.plugin.Restore()
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
})

test('uninstall cancellation retains backup; successful uninstall restores files and cleans plugin directories', async () => {
  const h = harness()
  await h.plugin.Update()
  h.faults.cancel = true
  await assert.rejects(h.plugin.onUninstall(), /取消恢复/)
  assert.ok(h.files.has(ROOT + '/original/sing-box.exe'))
  h.faults.cancel = false
  await h.plugin.onUninstall()
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
  assert.equal(
    [...h.files.keys()].some((path) => path.startsWith(ROOT + '/')),
    false
  )
})

test('SHA256SUMS fallback, GitHub errors, and missing platform assets', async () => {
  const h = harness()
  delete h.release().assets[0].digest
  h.release().assets.push({ name: 'SHA256SUMS', browser_download_url: 'https://download/sums' })
  await h.plugin.Update()
  assert.equal(h.state().current.tag, 'v1.14.4-lx.29')
  h.faults.httpStatus = 403
  await assert.rejects(h.plugin.CheckUpdate(), /rate limited/)
  h.faults.httpStatus = 0
  h.setRelease('v1.14.4-lx.30')
  h.release().assets = []
  await assert.rejects(h.plugin.Update(), /没有 windows\/amd64/)
  assert.equal(h.state().current.tag, 'v1.14.4-lx.29')
})

test('latest channel sorts published releases and includes prereleases; task checks without replacing files', async () => {
  const h = harness({ Channel: 'latest' })
  h.faults.releaseList = [
    { ...h.release(), tag_name: 'v1.14.4-lx.30-rc.1', prerelease: true, published_at: '2026-11-02T00:00:00Z' },
    { ...h.release(), tag_name: 'v1.14.4-lx.29', published_at: '2026-11-01T00:00:00Z' },
    { ...h.release(), tag_name: 'v1.14.4-lx.31', draft: true, published_at: '2026-11-03T00:00:00Z' }
  ]
  await h.plugin.onTask()
  assert.match(h.messages.at(-1), /30-rc\.1/)
  assert.equal(
    h.calls.some((call) => call.download),
    false
  )
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
})

test('startup checks are opt-in and only notify; interrupted operations take priority', async () => {
  const h = harness()
  await h.plugin.onReady()
  assert.equal(
    h.calls.some((call) => call.get),
    false
  )
  h.metadata.CheckOnStartup = true
  await h.plugin.onReady()
  assert.match(h.messages.at(-1), /可安装/)
  assert.equal(
    h.calls.some((call) => call.download),
    false
  )
  h.faults.httpStatus = 403
  await h.plugin.onReady()
  assert.match(h.messages.at(-1), /检查更新失败/)
  h.files.set(ROOT + '/transaction.json', '{}')
  await h.plugin.onReady()
  assert.match(h.messages.at(-1), /中断操作/)
})

test('branch mismatch prevents installing to another slot; XHTTP requires the managed branch', async () => {
  const h = harness()
  await h.plugin.Update()
  h.settings.app.kernel.branch = 'alpha'
  await assert.rejects(h.plugin.Update(), /分支/)
  await assert.rejects(h.plugin.onBeforeCoreStart({ outbounds: [{ transport: { type: 'xhttp' } }] }), /已接管的核心分支/)
})

const uri = (extra = '') =>
  `vless://00000000-0000-4000-8000-000000000000@[2001:db8::1]:443?type=xhttp&security=reality&sni=example.com&pbk=public-key&sid=0123&fp=chrome&path=%2Fxhttp&${extra}#${encodeURIComponent('测试节点')}`
const base64 = (value) => [{ base64: Buffer.from(value).toString('base64url') }]
const shadowrocketURI = (encoding = 'base64', authority = 'none:00000000-0000-4000-8000-000000000000@edge.example:443', overrides = {}) => {
  const query = new URLSearchParams({
    obfs: 'xhttp',
    tls: '1',
    peer: 'sni.example',
    obfsParam: 'host.example',
    fingerprint: 'chrome',
    remarks: '测试 XHTTP',
    path: '/test-path',
    mode: 'auto',
    alpn: 'h2,http/1.1',
    ...overrides
  })
  return `vless://${encoding ? Buffer.from(authority).toString(encoding) : authority}?${query}`
}

test('Shadowrocket Base64 and Base64URL authorities preserve credentials, XHTTP and TLS aliases', async () => {
  const h = harness()
  for (const encoding of ['base64', 'base64url']) {
    const [node] = await h.plugin.onSubscribe(base64(shadowrocketURI(encoding)), h.subscription)
    assert.equal(node.uuid, '00000000-0000-4000-8000-000000000000')
    assert.equal(node.server, 'edge.example')
    assert.equal(node.server_port, 443)
    assert.equal(node.tag, '测试 XHTTP')
    assert.deepEqual(node.transport, { type: 'xhttp', host: 'host.example', path: '/test-path', mode: 'auto' })
    assert.equal(node.tls.enabled, true)
    assert.equal(node.tls.server_name, 'sni.example')
    assert.deepEqual(node.tls.utls, { enabled: true, fingerprint: 'chrome' })
    assert.deepEqual(node.tls.alpn, ['h2', 'http/1.1'])
  }
  assert.equal(
    h.calls.some((call) => call.event === 'onSubscribe'),
    false
  )
})

test('Shadowrocket plaintext and encoded userinfo, encoded IPv6 and JSON Host are supported', async () => {
  const h = harness()
  const credential = 'none:00000000-0000-4000-8000-000000000000'
  for (const userinfo of [credential, Buffer.from(credential).toString('base64url')]) {
    const [node] = await h.plugin.onSubscribe(base64(shadowrocketURI(null, userinfo + '@edge.example:8443')), h.subscription)
    assert.equal(node.uuid, credential.slice(5))
    assert.equal(node.server_port, 8443)
  }
  const [ipv6] = await h.plugin.onSubscribe(
    base64(shadowrocketURI('base64url', credential + '@[2001:db8::1]:8443', { obfsParam: JSON.stringify({ Host: 'ipv6.example' }) })),
    h.subscription
  )
  assert.equal(ipv6.server, '2001:db8::1')
  assert.equal(ipv6.transport.host, 'ipv6.example')
})

test('Shadowrocket TLS and UDP switches respect explicit standard TLS options and fragment names', async () => {
  const h = harness()
  const [cleartext] = await h.plugin.onSubscribe(base64(shadowrocketURI('base64', undefined, { tls: '0', udp: '0' })), h.subscription)
  assert.equal(cleartext.tls, undefined)
  assert.equal(cleartext.network, 'tcp')
  const [secure] = await h.plugin.onSubscribe(
    base64(
      shadowrocketURI('base64', undefined, { security: 'tls', tls: '0', sni: 'standard.example', fp: 'firefox', host: 'standard-host.example' }) + '#fragment'
    ),
    h.subscription
  )
  assert.equal(secure.tls.enabled, true)
  assert.equal(secure.tls.server_name, 'standard.example')
  assert.equal(secure.tls.utls.fingerprint, 'firefox')
  assert.equal(secure.transport.host, 'standard-host.example')
  assert.equal(secure.tag, 'fragment')
  const [disabled] = await h.plugin.onSubscribe(base64(shadowrocketURI('base64', undefined, { security: 'none', tls: '1' })), h.subscription)
  assert.equal(disabled.tls, undefined)
})

test('malformed Shadowrocket authority and empty none credentials fail before generic conversion', async () => {
  const h = harness()
  for (const link of ['vless://%%%%?obfs=xhttp', shadowrocketURI('base64', 'none:@edge.example:443'), shadowrocketURI(null, 'none:@edge.example:443')]) {
    await assert.rejects(h.plugin.onSubscribe(base64(link), h.subscription), /VLESS/)
  }
  assert.equal(
    h.calls.some((call) => call.event === 'onSubscribe'),
    false
  )
})

test('mixed Shadowrocket subscriptions preserve remarks names and delegate only ordinary nodes', async () => {
  const h = harness()
  const nodes = await h.plugin.onSubscribe(
    base64('ss://ordinary@example.com:443#before\n' + shadowrocketURI() + '\nss://ordinary@example.com:443#after'),
    h.subscription
  )
  assert.deepEqual(
    nodes.map((node) => node.tag),
    ['before', '测试 XHTTP', 'after']
  )
  const calls = h.calls.filter((call) => call.event === 'onSubscribe')
  assert.equal(calls.length, 1)
  assert.equal(Buffer.from(calls[0].nodes[0].base64, 'base64').toString().includes('vless://'), false)
})

test('Base64 VLESS XHTTP preserves IPv6, Chinese name, REALITY, encryption, and extra fields', async () => {
  const h = harness()
  const extra = {
    noGRPCHeader: true,
    xPaddingBytes: '100-200',
    sessionIDPlacement: 'header',
    xmux: { maxConnections: 3, hMaxReusableSecs: [600, 900], hKeepAlivePeriod: -1 }
  }
  const nodes = await h.plugin.onSubscribe(
    base64(uri('encryption=mlkem768x25519plus.native.0rtt.key&extra=' + encodeURIComponent(JSON.stringify(extra)))),
    h.subscription
  )
  assert.equal(nodes[0].tag, '测试节点')
  assert.equal(nodes[0].server, '2001:db8::1')
  assert.equal(nodes[0].tls.reality.public_key, 'public-key')
  assert.equal(nodes[0].tls.server_name, 'example.com')
  assert.equal(nodes[0].encryption, 'mlkem768x25519plus.native.0rtt.key')
  assert.equal(nodes[0].transport.no_grpc_header, true)
  assert.equal(nodes[0].transport.session_placement, 'header')
  assert.equal(nodes[0].transport.xmux.h_max_reusable_secs, '600-900')
  assert.equal(nodes[0].transport.xmux.h_keep_alive_period, -1)
  assert.equal(
    h.calls.some((call) => call.event === 'onSubscribe'),
    false
  )
})

test('mixed Base64 subscription converts ordinary nodes once and preserves node order', async () => {
  const h = harness()
  const nodes = await h.plugin.onSubscribe(base64('ss://ordinary@example.com:443#before\n' + uri() + '\nss://ordinary@example.com:443#after'), h.subscription)
  assert.deepEqual(
    nodes.map((node) => node.tag),
    ['before', '测试节点', 'after']
  )
  const calls = h.calls.filter((call) => call.event === 'onSubscribe')
  assert.equal(calls.length, 1)
  assert.equal(Buffer.from(calls[0].nodes[0].base64, 'base64').toString().includes('vless://'), false)
})

test('Clash XHTTP maps booleans, range numbers, TLS and ordinary nodes to one native array', async () => {
  const h = harness()
  const source = [
    { type: 'ss', name: 'normal', server: 'ss.example', port: 443 },
    {
      type: 'vless',
      name: 'xhttp',
      server: 'x.example',
      port: 8443,
      uuid: 'uuid',
      tls: true,
      servername: 'sni.example',
      'skip-cert-verify': false,
      network: 'xhttp',
      'xhttp-opts': { path: '/x', mode: 'packet-up', 'no-grpc-header': false, 'sc-max-each-post-bytes': 1000000, headers: { Host: 'x.example' } }
    }
  ]
  const nodes = await h.plugin.onSubscribe(source, h.subscription)
  assert.deepEqual(
    nodes.map((node) => node.tag),
    ['normal', 'xhttp']
  )
  assert.equal(nodes[1].transport.sc_max_each_post_bytes, '1000000')
  assert.equal(nodes[1].transport.no_grpc_header, false)
  assert.equal(nodes[1].tls.insecure, false)
  assert.equal(nodes[1].tls.server_name, 'sni.example')
  assert.equal(source[1]['xhttp-opts']['sc-max-each-post-bytes'], 1000000)
})

test('Clash XHTTP maps ECH enable, Base64 config and DNS query name without mutating input', async () => {
  const h = harness()
  const config = ECH_CONFIG
  const source = {
    type: 'vless',
    name: 'ech',
    server: 'x.example',
    port: 443,
    uuid: 'uuid',
    tls: true,
    servername: 'inner.example',
    'client-fingerprint': 'chrome',
    network: 'xhttp',
    'ech-opts': { enable: true, config, 'query-server-name': 'dns.example' }
  }
  const original = structuredClone(source)
  const [node] = await h.plugin.onSubscribe([source], h.subscription)
  assert.deepEqual(node.tls.ech, {
    enabled: true,
    config: ['-----BEGIN ECH CONFIGS-----', ...config.match(/.{1,64}/g), '-----END ECH CONFIGS-----'].join('\n'),
    query_server_name: 'dns.example'
  })
  assert.equal(node.tls.server_name, 'inner.example')
  assert.deepEqual(node.tls.utls, { enabled: true, fingerprint: 'chrome' })
  assert.deepEqual(source, original)

  const [multiline] = await h.plugin.onSubscribe([{ ...source, 'ech-opts': { enable: true, config: config.match(/.{1,16}/g).join('\n') } }], h.subscription)
  const pemBody = multiline.tls.ech.config.split('\n').slice(1, -1).join('')
  assert.deepEqual(Buffer.from(pemBody, 'base64'), Buffer.from(config, 'base64'))
  for (const options of [{ enable: true }, { enable: true, config: '' }, { enable: 'true', 'query-server-name': 'dns.example' }]) {
    const [dns] = await h.plugin.onSubscribe([{ ...source, 'ech-opts': options }], h.subscription)
    assert.equal(dns.tls.ech.enabled, true)
    assert.equal(dns.tls.ech.config, undefined)
    assert.equal(dns.tls.ech.query_server_name, options['query-server-name'])
  }
  for (const options of [{}, { enable: false }, { enable: 'false', config: 'unused-invalid-config' }]) {
    const [disabled] = await h.plugin.onSubscribe([{ ...source, 'ech-opts': options }], h.subscription)
    assert.deepEqual(disabled.tls.ech, { enabled: false })
  }
  const [plain] = await h.plugin.onSubscribe([{ ...source, tls: false, 'ech-opts': { enable: false } }], h.subscription)
  assert.equal(plain.tls, undefined)
  for (const type of ['vmess', 'trojan']) {
    const [other] = await h.plugin.onSubscribe(
      [{ ...source, type, tls: type === 'trojan' ? undefined : true, password: 'secret', network: 'splithttp', 'ech-opts': { enable: true } }],
      h.subscription
    )
    assert.deepEqual(other.tls.ech, { enabled: true })
    assert.equal(other.transport.type, 'xhttp')
  }
})

test('Clash ECH rejects malformed options and enabled ECH without regular TLS', async () => {
  const h = harness()
  const source = { type: 'vless', name: 'ech', server: 'x.example', port: 443, uuid: 'uuid', tls: true, network: 'xhttp' }
  for (const options of [
    null,
    [],
    'not-an-object',
    { enable: 'invalid' },
    { enable: true, config: 123 },
    { enable: true, config: 'not-base64!' },
    { enable: true, config: 'abc' },
    { enable: true, 'query-server-name': 123 },
    { enable: true, unknown: 'must-not-disappear' }
  ]) {
    await assert.rejects(h.plugin.onSubscribe([{ ...source, 'ech-opts': options }], h.subscription))
  }
  await assert.rejects(h.plugin.onSubscribe([{ ...source, tls: false, 'ech-opts': { enable: true } }], h.subscription), /ECH.*TLS/)
  await assert.rejects(
    h.plugin.onSubscribe([{ ...source, 'reality-opts': { 'public-key': 'key' }, 'ech-opts': { enable: true } }], h.subscription),
    /ECH.*REALITY/
  )
})

test('Trojan URI, VMess URI, and native splithttp with preserved dialer fields', async () => {
  const h = harness()
  const trojan = await h.plugin.onSubscribe(base64('trojan://secret%40password@t.example:443?type=xhttp#trojan'), h.subscription)
  assert.equal(trojan[0].password, 'secret@password')
  assert.equal(trojan[0].tls.enabled, true)
  const vmess = { v: '2', ps: 'vmess', add: 'v.example', port: '443', id: 'uuid', aid: '0', net: 'xhttp', tls: 'tls', host: 'host.example', path: '/x' }
  const nodes = await h.plugin.onSubscribe(base64('vmess://' + Buffer.from(JSON.stringify(vmess)).toString('base64')), h.subscription)
  assert.equal(nodes[0].type, 'vmess')
  assert.equal(nodes[0].tls.server_name, 'host.example')
  const native = {
    type: 'vless',
    tag: 'native',
    server: 'n.example',
    server_port: 443,
    uuid: 'uuid',
    detour: 'hop',
    tls: { enabled: true },
    transport: { type: 'splithttp', mode: 'stream-one' }
  }
  const result = await h.plugin.onSubscribe([native], h.subscription)
  assert.equal(result[0].transport.type, 'xhttp')
  assert.equal(result[0].detour, 'hop')
  assert.equal(native.transport.type, 'splithttp')
})

test('incompatible extras, invalid mode, unsupported REALITY and Clash fields fail visibly', async () => {
  const h = harness()
  for (const query of ['extra=' + encodeURIComponent('{"downloadSettings":{"address":"other.example"}}'), 'mode=invalid', 'pqv=signature', 'spx=%2F']) {
    await assert.rejects(h.plugin.onSubscribe(base64(uri(query)), h.subscription), /不支持/)
  }
  await assert.rejects(
    h.plugin.onSubscribe(
      [{ type: 'vless', name: 'unsupported', network: 'xhttp', server: 'x.example', port: 443, uuid: 'uuid', 'dialer-proxy': 'hop' }],
      h.subscription
    ),
    /尚未适配/
  )
})

test('ordering, Xray conflict, missing converter, and malformed converter result cannot silently lose nodes', async () => {
  const h = harness()
  h.pluginStore.plugins.reverse()
  await assert.rejects(h.plugin.onSubscribe(base64(uri()), h.subscription), /节点转换.*之前/)
  h.pluginStore.plugins.reverse()
  h.pluginStore.plugins.push({ id: 'plugin-xray-front-proxy' })
  await assert.rejects(h.plugin.onSubscribe(base64(uri()), h.subscription), /停用/)
  h.pluginStore.plugins.pop()
  h.pluginStore.plugins.pop()
  const mixed = base64(uri() + '\nss://ordinary@example.com:443#ordinary')
  await assert.rejects(h.plugin.onSubscribe(mixed, h.subscription), /普通节点/)
  h.pluginStore.plugins.push({ id: 'plugin-node-convert' })
  h.faults.converter = [{}]
  await assert.rejects(h.plugin.onSubscribe(mixed, h.subscription), /没有返回有效/)
})

test('disabled adapter and ordinary subscriptions pass through unchanged', async () => {
  const h = harness()
  const source = base64('ss://ordinary@example.com:443#ordinary')
  assert.equal(await h.plugin.onSubscribe(source, h.subscription), source)
  h.metadata.ConvertXHTTP = false
  const xhttp = base64(uri())
  assert.equal(await h.plugin.onSubscribe(xhttp, h.subscription), xhttp)
})

test('backup or journal write failure does not stop a running core', async (t) => {
  for (const fault of ['backup', 'journal']) {
    await t.test(fault, async () => {
      const h = harness()
      h.kernel.running = true
      if (fault === 'backup') {
        h.faults.copyTarget = ROOT + '/original/sing-box.exe'
        h.faults.copyCount = 1
      } else h.faults.writePath = ROOT + '/transaction.json.tmp'
      await assert.rejects(h.plugin.Update())
      assert.equal(h.kernel.running, true)
      assert.equal(h.calls.includes('stop'), false)
      assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
    })
  }
})

test('busy operation blocks concurrent install, core startup, and module disposal', async () => {
  const h = harness()
  h.faults.duringDownload = async () => {
    await assert.rejects(h.plugin.Update(), /正在执行操作/)
    await assert.rejects(h.plugin.onBeforeCoreStart({ outbounds: [] }), /正在切换核心/)
    assert.throws(() => h.plugin.onDispose(), /等待完成/)
  }
  await h.plugin.Update()
  assert.equal(h.state().current.tag, 'v1.14.4-lx.29')
})

test('tampered rollback cache is rejected before executing it or stopping the core', async () => {
  const h = harness()
  await h.plugin.Update()
  h.setRelease('v1.14.4-lx.30')
  await h.plugin.Update()
  const file = h.state().previous.dir + '/sing-box.exe'
  h.files.set(file, 'tampered')
  h.kernel.running = true
  const lastCalls = h.calls.length
  await assert.rejects(h.plugin.Rollback(), /缓存的核心或 DLL 校验失败/)
  assert.equal(
    h.calls.slice(lastCalls).some((call) => call.exec === file),
    false
  )
  assert.equal(h.calls.slice(lastCalls).includes('stop'), false)
  assert.equal(h.kernel.running, true)
})

test('alpha slot uses its own filename and restores it without changing the main executable', async () => {
  const h = harness()
  h.settings.app.kernel.branch = 'alpha'
  h.files.set(CORE + '/sing-box-latest.exe', 'alpha original')
  await h.plugin.Update()
  assert.equal(h.get(CORE + '/sing-box-latest.exe'), binary('v1.14.4-lx.29'))
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
  await h.plugin.onDisabled()
  assert.equal(h.get(CORE + '/sing-box-latest.exe'), 'alpha original')
  assert.equal(h.get(CORE + '/sing-box.exe'), 'official core')
})

test('Linux and macOS choose tar.gz assets and set executable permissions', async (t) => {
  for (const os of ['linux', 'darwin']) {
    await t.test(os, async () => {
      const h = harness()
      h.env.os = os
      h.env.arch = 'arm64'
      h.files.clear()
      h.files.set(CORE + '/sing-box', 'original unix core')
      h.setRelease('v1.14.4-lx.29')
      await h.plugin.Update()
      assert.equal(h.get(CORE + '/sing-box'), binary('v1.14.4-lx.29'))
      assert.ok(h.calls.some((call) => call.download?.endsWith('/2')))
      assert.ok(h.calls.some((call) => call.exec === 'chmod'))
      await h.plugin.GrantTUN()
      assert.ok(h.calls.some((call) => call.grant === CORE + '/sing-box'))
      await h.plugin.Restore()
      assert.equal(h.get(CORE + '/sing-box'), 'original unix core')
    })
  }
})

test('native XHTTP arrays preserve selectors and direct outbounds', async () => {
  const h = harness()
  const nodes = [
    { type: 'selector', tag: 'proxy', outbounds: ['native', 'direct'] },
    { type: 'vless', tag: 'native', server: 'n.example', server_port: 443, uuid: 'uuid', transport: { type: 'xhttp' } },
    { type: 'direct', tag: 'direct' }
  ]
  const result = await h.plugin.onSubscribe(nodes, h.subscription)
  assert.equal(result[0], nodes[0])
  assert.equal(result[2], nodes[2])
  assert.equal(result[1].transport.mode, 'auto')
})

test('non-JSON ordinary VMess URIs pass through to the existing converter', async () => {
  const h = harness()
  const nodes = base64('vmess://some-other-format@ordinary.example:443?type=ws#ordinary')
  assert.equal(await h.plugin.onSubscribe(nodes, h.subscription), nodes)
})

test('invalid credentials and reversed ranges reject adaptation', async () => {
  const h = harness()
  await assert.rejects(
    h.plugin.onSubscribe([{ type: 'vless', tag: 'missing-uuid', server: 'x.example', server_port: 443, transport: { type: 'xhttp' } }], h.subscription),
    /身份凭据/
  )
  await assert.rejects(h.plugin.onSubscribe(base64(uri('extra=' + encodeURIComponent('{"xPaddingBytes":"200-100"}'))), h.subscription), /起点大于终点/)
})

test('unmapped TLS pinning and certificates are rejected instead of silently removed', async () => {
  const h = harness()
  await assert.rejects(h.plugin.onSubscribe(base64(uri('pinSHA256=pinned-certificate')), h.subscription), /尚未适配的 TLS/)
  await assert.rejects(
    h.plugin.onSubscribe(
      [{ type: 'vless', name: 'pin', network: 'xhttp', server: 'x.example', port: 443, uuid: 'uuid', tls: true, fingerprint: 'pinned-certificate' }],
      h.subscription
    ),
    /尚未适配/
  )
})

test('generated configs pass the real sing-box-lx check command', { skip: !process.env.SING_BOX_LX_BINARY }, async () => {
  const h = harness()
  const { publicKey } = generateKeyPairSync('x25519')
  const pbk = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64url')
  const id = '00000000-0000-4000-8000-000000000000'
  const link = uri(
    'extra=' + encodeURIComponent(JSON.stringify({ noGRPCHeader: false, xPaddingBytes: '100-200', sessionIDPlacement: 'header', xmux: { maxConnections: 3 } }))
  ).replace('pbk=public-key', 'pbk=' + pbk)
  const vless = await h.plugin.onSubscribe(base64(link), h.subscription)
  const shadowrocket = await h.plugin.onSubscribe(base64(shadowrocketURI('base64', 'none:' + id + '@127.0.0.1:443')), h.subscription)
  const trojan = await h.plugin.onSubscribe(base64('trojan://secret@127.0.0.1:443?type=xhttp&security=tls&sni=example.com#trojan'), h.subscription)
  const vmess = await h.plugin.onSubscribe(
    base64(
      'vmess://' +
        Buffer.from(JSON.stringify({ ps: 'vmess', add: '127.0.0.1', port: 443, id, aid: 0, net: 'xhttp', tls: 'tls', sni: 'example.com' })).toString('base64')
    ),
    h.subscription
  )
  const clash = await h.plugin.onSubscribe(
    [
      {
        type: 'vless',
        name: 'clash',
        server: '127.0.0.1',
        port: 443,
        uuid: id,
        tls: true,
        servername: 'example.com',
        network: 'xhttp',
        'xhttp-opts': { mode: 'packet-up', headers: { 'X-Test': ['one', 'two'] }, 'sc-max-each-post-bytes': 1000000, 'sc-min-posts-interval-ms': '30-50' }
      }
    ],
    h.subscription
  )
  const ech = await h.plugin.onSubscribe(
    [{ enable: true, config: ECH_CONFIG }, { enable: true, 'query-server-name': 'public.example' }, { enable: false }].map((options, index) => ({
      type: 'trojan',
      name: 'ech-' + index,
      server: '127.0.0.1',
      port: 443,
      password: 'secret',
      servername: 'example.com',
      network: 'xhttp',
      'client-fingerprint': index === 0 ? 'chrome' : undefined,
      'ech-opts': options
    })),
    h.subscription
  )
  const dir = await mkdtemp(join(tmpdir(), 'codex-lx-config-check-'))
  try {
    const file = join(dir, 'config.json')
    const outbounds = [...vless, ...shadowrocket, ...trojan, ...vmess, ...clash, ...ech]
    await writeFile(file, JSON.stringify({ outbounds, experimental: { clash_api: { external_controller: '127.0.0.1:0' } } }))
    const execute = promisify(execFile)
    const { stdout } = await execute(process.env.SING_BOX_LX_BINARY, ['version'], { windowsHide: true, timeout: 30000 })
    assert.match(stdout, /with_xhttp/)
    await execute(process.env.SING_BOX_LX_BINARY, ['check', '-D', dir, '-c', file], { windowsHide: true, timeout: 30000 })
    for (const mode of ['auto', 'packet-up', 'stream-up', 'stream-one']) {
      const outbound = structuredClone(vless[0])
      outbound.transport.mode = mode
      await writeFile(file, JSON.stringify({ outbounds: [outbound] }))
      await execute(process.env.SING_BOX_LX_BINARY, ['check', '-D', dir, '-c', file], { windowsHide: true, timeout: 30000 })
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
