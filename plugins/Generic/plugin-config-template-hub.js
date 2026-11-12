/* 双端判定：SingBox 用 JSON 清单与 JSON 解析，Clash 用 YAML */
const IS_GFS = Plugins.APP_TITLE.includes('SingBox')

const DEFAULT_BASE_URL = 'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/refs/heads/main/plugins/Resources/plugin-config-template-hub/'
const README_FILE = 'README.md'

/* 清单 diff 时参与比对的字段 */
const TRACKED_FIELDS = ['name', 'description', 'author', 'version', 'tags', 'group', 'homepage', 'updatedAt', 'notes']

const REQUIRED_FIELDS = ['id', 'name', 'description', 'author']

const normalizeError = (err) => (err instanceof Error ? err.message : String(err))

const parseVersion = (v) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

const isVersionLower = (a, b) => {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) {
    return false
  }
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] < pb[i]
    }
  }
  return false
}

const manifestFingerprint = (t) => JSON.stringify(TRACKED_FIELDS.map((k) => t[k] ?? ''))

const diffManifests = (oldList, newList) => {
  const oldMap = new Map(oldList.map((t) => [t.id, t]))
  const newIds = new Set(newList.map((t) => t.id))
  const added = newList.filter((t) => !oldMap.has(t.id))
  const removed = oldList.filter((t) => !newIds.has(t.id))
  const changed = newList.flatMap((t) => {
    const prev = oldMap.get(t.id)
    if (!prev || manifestFingerprint(prev) === manifestFingerprint(t)) {
      return []
    }
    return [{ from: prev, to: t }]
  })
  return { added, removed, changed }
}

const isTemplateMeta = (item) => {
  if (!item || typeof item !== 'object') {
    return false
  }
  const meta = item
  return REQUIRED_FIELDS.every((k) => typeof meta[k] === 'string' && meta[k] !== '')
}

/* 读取 records.json 后统一规整为记录数组：兼容旧版单条格式，剔除非法条目 */
const normalizeRecords = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const isRecord = (it) => typeof it === 'object' && it !== null && typeof it['profileId'] === 'string'
  const out = {}
  for (const [id, val] of Object.entries(raw)) {
    const list = (Array.isArray(val) ? val : [val]).filter(isRecord)
    if (list.length > 0) {
      out[id] = list
    }
  }
  return out
}

/** @type {EsmPlugin} */
export default (plugin) => {
  const BASE_DIR = `data/third/${plugin.id}`
  const RECORDS_PATH = `${BASE_DIR}/records.json`
  const MANIFEST_PATH = `${BASE_DIR}/manifest.json`
  const README_PATH = `${BASE_DIR}/${README_FILE}`
  const TEMPLATE_DIR = IS_GFS ? 'gfs' : 'gfc'
  const TEMPLATE_EXT = IS_GFS ? 'json' : 'yaml'

  const convertTip = IS_GFS
    ? '导入会将模板转换为应用托管配置：应用保留入站、出站分组、路由规则、DNS 等支持段；分组内节点按 tag 与现有订阅匹配，未匹配到的节点与引用它们的规则出站会丢失或为空。'
    : '导入会将模板转换为应用托管配置：仅保留内置出站与分组间引用，模板内嵌节点及其规则会被丢弃；general、tun、dns、hosts、sniffer 等支持段正常保留。'

  const profilesStore = Plugins.useProfilesStore()

  const templates = Vue.ref([])
  const records = Vue.ref({})
  const manifestLoading = Vue.ref(false)
  const manifestError = Vue.ref('')

  /* 模板正文会话内缓存，避免重复拉取 */
  const templateContentCache = new Map()

  const readConfigString = (key) => {
    const raw = plugin[key]
    return typeof raw === 'string' ? raw.trim() : ''
  }

  const headerEnabled = () => {
    const raw = plugin.ShowHeaderAction
    return raw !== false && String(raw) !== 'false'
  }

  const resourceBase = () => {
    const custom = readConfigString('BaseUrl')
    const base = custom || DEFAULT_BASE_URL
    return base.endsWith('/') ? base : `${base}/`
  }

  const getSubscribeIds = () => {
    const store = Plugins.useSubscribesStore()
    return (store.subscribes ?? []).map((s) => s.id)
  }

  /* 双端 restoreProfile 签名不同，分支内分别以各自签名调用 */
  const restoreGfsProfile = (config, name, options = {}) => Plugins.restoreProfile(config, name, options)

  const restoreGfcProfile = (config, subID) => Plugins.restoreProfile(config, subID, {}, {})

  const ensureDir = async (dir) => {
    if (!(await Plugins.FileExists(dir))) {
      await Plugins.MakeDir(dir)
    }
  }

  /* 工具栏按钮需以渲染函数构造，组件在模态渲染上下文内解析 */
  const uiButton = (props, label) => Vue.h(Vue.resolveComponent('Button'), props, () => label)

  const saveRecords = async () => {
    await ensureDir(BASE_DIR)
    await Plugins.WriteFile(RECORDS_PATH, JSON.stringify(records.value, null, 2))
  }

  const loadLocalData = async () => {
    try {
      const content = await Plugins.ReadFile(RECORDS_PATH)
      records.value = normalizeRecords(JSON.parse(content))
    } catch {
      records.value = {}
    }
    if (templates.value.length > 0) {
      return
    }
    try {
      const content = await Plugins.ReadFile(MANIFEST_PATH)
      const cached = JSON.parse(content)
      if (Array.isArray(cached)) {
        templates.value = cached.filter(isTemplateMeta)
      }
    } catch {
      /* 首次使用无缓存清单 */
    }
  }

  /* 贡献指南优先读本地缓存，缺失时拉取并落盘 */
  const loadReadme = async (force = false) => {
    if (!force) {
      try {
        return await Plugins.ReadFile(README_PATH)
      } catch {
        /* 无本地缓存 */
      }
    }
    const { body, status } = await Plugins.Requests({
      method: 'GET',
      url: `${resourceBase()}${README_FILE}`,
      autoTransformBody: false
    })
    if (status !== 200) {
      throw new Error(`HTTP ${status}`)
    }
    await ensureDir(BASE_DIR)
    await Plugins.WriteFile(README_PATH, body)
    return body
  }

  const openReadme = () => {
    const { defineComponent, ref } = Vue
    const content = ref('')
    const loading = ref(true)
    const error = ref('')

    const load = async (force = false) => {
      loading.value = true
      error.value = ''
      try {
        content.value = await loadReadme(force)
      } catch (err) {
        error.value = normalizeError(err)
      } finally {
        loading.value = false
      }
    }

    const component = defineComponent({
      template: `
      <div class="flex flex-col gap-8 p-12">
        <div v-if="loading" class="flex items-center justify-center py-24">
          <Icon icon="loading" :size="28" class="rotation" />
        </div>
        <Empty v-else-if="error">
          <template #description>
            <div class="flex flex-col items-center gap-8">
              <span class="text-12">{{ error }}</span>
              <Button type="primary" size="small" icon="refresh" @click="reload">重试</Button>
            </div>
          </template>
        </Empty>
        <MarkdownViewer v-else :content="content" />
      </div>
      `,
      setup() {
        return {
          content,
          loading,
          error,
          reload: () => void load(true)
        }
      }
    })

    const modal = Plugins.modal({
      title: '模板贡献指南',
      submit: false,
      cancelText: '关闭',
      width: '80',
      height: '80',
      px: 0,
      py: 0
    })
    modal.setContent(component)
    modal.open()
    void load()
  }

  const fetchManifest = async () => {
    const { body, status } = await Plugins.Requests({
      method: 'GET',
      url: `${resourceBase()}${IS_GFS ? 'gfs' : 'gfc'}.json`,
      autoTransformBody: false
    })
    if (status !== 200) {
      throw new Error(`HTTP ${status}`)
    }
    const list = JSON.parse(body)
    if (!Array.isArray(list)) {
      throw new Error('清单格式错误：应为数组')
    }
    return list.filter((item) => {
      if (isTemplateMeta(item)) {
        return true
      }
      console.warn(`[${plugin.id}] 清单条目缺少必填字段，已跳过：${JSON.stringify(item)}`)
      return false
    })
  }

  /* 远程模板已不存在时删除整条数据；特定配置已删除时仅删除对应条目 */
  const purgeStaleRecords = async (list) => {
    const ids = new Set(list.map((t) => t.id))
    let changed = false
    for (const id of Object.keys(records.value)) {
      const recs = records.value[id]
      if (!recs || recs.length === 0) {
        delete records.value[id]
        changed = true
        continue
      }
      if (!ids.has(id)) {
        delete records.value[id]
        changed = true
        continue
      }
      const kept = recs.filter((rec) => profilesStore.getProfileById(rec.profileId))
      if (kept.length === 0) {
        delete records.value[id]
        changed = true
      } else if (kept.length !== recs.length) {
        records.value[id] = kept
        changed = true
      }
    }
    if (changed) {
      await Plugins.WriteFile(RECORDS_PATH, JSON.stringify(records.value, null, 2))
      console.warn(`[${plugin.id}] 已清理失效的导入记录`)
    }
  }

  const showDiffAlert = (diff) => {
    const lines = []
    if (diff.added.length > 0) {
      lines.push([`### 新增（${diff.added.length}）`, ...diff.added.map((t) => `- **${t.name}** \`${t.id}\`${t.version ? ` ${t.version}` : ''}`)].join('\n'))
    }
    if (diff.removed.length > 0) {
      lines.push([`### 删除（${diff.removed.length}）`, ...diff.removed.map((t) => `- **${t.name}** \`${t.id}\``)].join('\n'))
    }
    if (diff.changed.length > 0) {
      lines.push(
        [
          `### 变更（${diff.changed.length}）`,
          ...diff.changed.map(({ from, to }) => `- **${to.name}** \`${to.id}\`：${from.version || '无版本'} → ${to.version || '无版本'}`)
        ].join('\n')
      )
    }
    void Plugins.alert('模板清单有更新', lines.join('\n\n'), {
      type: 'markdown'
    }).catch(() => undefined)
  }

  const updateManifest = async () => {
    if (manifestLoading.value) {
      return
    }
    manifestLoading.value = true
    manifestError.value = ''
    try {
      const list = await fetchManifest()
      const previous = templates.value
      templates.value = list
      await ensureDir(BASE_DIR)
      await Plugins.WriteFile(MANIFEST_PATH, JSON.stringify(list, null, 2))
      await purgeStaleRecords(list)
      if (previous.length > 0) {
        const diff = diffManifests(previous, list)
        if (diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0) {
          showDiffAlert(diff)
        }
      }
    } catch (err) {
      const msg = normalizeError(err)
      if (templates.value.length === 0) {
        manifestError.value = msg
      }
      Plugins.message.error(`模板清单更新失败：${msg}`)
    } finally {
      manifestLoading.value = false
    }
  }

  /* force 为真时跳过会话缓存，用于「重新加载」 */
  const fetchTemplateText = async (tpl, force = false) => {
    const cached = force ? undefined : templateContentCache.get(tpl.id)
    if (cached !== undefined) {
      return cached
    }
    const { body, status } = await Plugins.Requests({
      method: 'GET',
      url: `${resourceBase()}${TEMPLATE_DIR}/${tpl.id}.${TEMPLATE_EXT}`,
      autoTransformBody: false
    })
    if (status !== 200) {
      throw new Error(`HTTP ${status}`)
    }
    templateContentCache.set(tpl.id, body)
    return body
  }

  /* 解析失败时报错并返回 null，由调用方中止流程 */
  const parseTemplate = (text) => {
    try {
      const parsed = IS_GFS ? JSON.parse(text) : Plugins.YAML.parse(text)
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('模板内容不是有效的配置对象')
      }
      return parsed
    } catch (err) {
      Plugins.message.error(`模板解析失败：${normalizeError(err)}`)
      return null
    }
  }

  /* 转换损失确认弹窗（PRD §7.2 文案） */
  const confirmImport = async (tpl) => {
    try {
      return await Plugins.confirm(
        '导入模板',
        [
          `「${tpl.name}」将被转换为应用托管配置。应用仅保留其支持的配置段（入站、出站分组、路由规则、DNS 等），模板中的其余内容不会原样保留：`,
          IS_GFS
            ? '· SingBox：分组内节点按 tag 与现有订阅匹配，未匹配到的节点与引用它们的规则出站会丢失或为空；'
            : '· Clash：仅保留内置出站与分组间引用，模板内嵌节点及其规则会被丢弃；',
          '导入后请打开配置编辑器检查并补全节点引用。确定要导入吗？'
        ].join('\n'),
        { type: 'text', okText: '仍要导入' }
      )
    } catch {
      return false
    }
  }

  /* overrideText 为详情页编辑后的模板正文，缺省时按需拉取远程模板 */
  const doImport = async (tpl, importing, overrideText) => {
    if (!(await confirmImport(tpl))) {
      return
    }
    importing.value = true
    try {
      const text =
        overrideText ??
        (await fetchTemplateText(tpl).catch((err) => {
          Plugins.message.error(`模板获取失败：${normalizeError(err)}`)
          return ''
        }))
      if (text === '') {
        return
      }
      const parsed = parseTemplate(text)
      if (parsed === null) {
        return
      }
      const profile = IS_GFS
        ? restoreGfsProfile(parsed, tpl.name, {
            subscriptionIds: getSubscribeIds()
          })
        : restoreGfcProfile(parsed, Plugins.sampleID())
      if (!IS_GFS) {
        profile['name'] = tpl.name
      }
      await profilesStore.addProfile(profile)
      ;(records.value[tpl.id] ??= []).push({
        profileId: profile['id'],
        importedAt: Date.now(),
        version: tpl.version ?? ''
      })
      await saveRecords()
      Plugins.message.success(`已导入「${tpl.name}」，请在配置列表查看`)
    } catch (err) {
      Plugins.message.error(`导入失败：${normalizeError(err)}`)
    } finally {
      importing.value = false
    }
  }

  /* 合并更新：与导入一样优先使用预览页的临时修改内容，转换后按深合并保留已导入配置 */
  const doMergeUpdate = async (tpl, record, importing, overrideText) => {
    const oldProfile = profilesStore.getProfileById(record.profileId)
    if (!oldProfile) {
      Plugins.message.error('未找到已导入的配置')
      return
    }
    let ok = false
    try {
      ok = await Plugins.confirm(
        '合并更新',
        [
          `模板「${tpl.name}」已有新版本（${record.version || '未知版本'} → ${tpl.version || '未知版本'}）。`,
          overrideText === undefined
            ? '将拉取最新模板并转换为托管配置，再与当前已导入配置递归深合并：同名字段以已导入配置为准（保留你的修改），模板新增的字段会补入。'
            : '将使用当前预览内容（含你的临时修改）转换为托管配置，再与当前已导入配置递归深合并：同名字段以已导入配置为准（保留你的修改），模板新增的字段会补入。',
          '确定要合并更新吗？'
        ].join('\n'),
        { type: 'text', okText: '合并更新' }
      )
    } catch {
      ok = false
    }
    if (!ok) {
      return
    }
    importing.value = true
    try {
      const text =
        overrideText ??
        (await fetchTemplateText(tpl).catch((err) => {
          Plugins.message.error(`模板获取失败：${normalizeError(err)}`)
          return ''
        }))
      if (text === '') {
        return
      }
      const parsed = parseTemplate(text)
      if (parsed === null) {
        return
      }
      const fresh = IS_GFS
        ? restoreGfsProfile(parsed, oldProfile['name'], {
            subscriptionIds: getSubscribeIds()
          })
        : restoreGfcProfile(parsed, oldProfile['id'])
      const merged = Plugins.deepAssign(fresh, Plugins.deepClone(oldProfile))
      merged['id'] = oldProfile['id']
      await profilesStore.editProfile(oldProfile['id'], merged)
      record.importedAt = Date.now()
      record.version = tpl.version ?? ''
      await saveRecords()
      Plugins.message.success(`已合并更新「${tpl.name}」`)
    } catch (err) {
      Plugins.message.error(`合并更新失败：${normalizeError(err)}`)
    } finally {
      importing.value = false
    }
  }

  const openDetail = (tpl) => {
    const { computed, defineComponent, ref } = Vue

    const content = ref('')
    const originalContent = ref('')
    const contentLoading = ref(false)
    const contentError = ref('')
    const importing = ref(false)

    const contentDirty = computed(() => content.value !== originalContent.value)
    const recordList = computed(() => records.value[tpl.id] ?? [])
    const importEntries = computed(() =>
      recordList.value.map((rec) => {
        const profile = profilesStore.getProfileById(rec.profileId)
        return {
          rec,
          profile,
          canMerge: profile !== undefined && isVersionLower(rec.version, tpl.version ?? '')
        }
      })
    )

    const loadContent = async (force = false) => {
      contentLoading.value = true
      contentError.value = ''
      try {
        const text = await fetchTemplateText(tpl, force)
        content.value = text
        originalContent.value = text
      } catch (err) {
        contentError.value = normalizeError(err)
        Plugins.message.error(`模板获取失败：${contentError.value}`)
      } finally {
        contentLoading.value = false
      }
    }
    /* 详情打开即预取正文，避免首个编辑器实例挂载后才开始请求 */
    void loadContent()

    const resetContent = () => {
      content.value = originalContent.value
    }

    /* 预览与编辑独立成窗口：详情只保留元信息与操作，避免上下挤压 */
    const openEditor = () => {
      const editor = defineComponent({
        template: `
        <div class="flex flex-col w-full overflow-hidden" style="height: 100%; min-height: 0">
          <div v-if="contentLoading" class="flex items-center justify-center h-full">
            <Icon icon="loading" :size="28" class="rotation" />
          </div>
          <Empty v-else-if="contentError">
            <template #description>
              <div class="flex flex-col items-center gap-8">
                <span class="text-12">{{ contentError }}</span>
                <Button type="primary" size="small" icon="refresh" @click="reloadContent">重试</Button>
              </div>
            </template>
          </Empty>
          <CodeEditor
            v-else
            v-model="content"
            :lang="lang"
            :editable="!importing"
            class="h-full"
            style="border: 1px solid var(--divider-color); border-radius: 6px; overflow: hidden"
          />
        </div>
        `,
        setup() {
          return {
            content,
            contentLoading,
            contentError,
            importing,
            lang: IS_GFS ? 'json' : 'yaml',
            reloadContent: () => void loadContent(true)
          }
        }
      })

      const editorModal = Plugins.modal({
        title: `预览 / 编辑 — ${tpl.name}`,
        submit: false,
        cancelText: '关闭',
        width: '90',
        height: '90',
        px: 12,
        py: 12
      })
      editorModal.setContent(editor)
      editorModal.patchSlots({
        toolbar: () => [
          contentDirty.value
            ? uiButton(
                {
                  type: 'text',
                  size: 'small',
                  icon: 'refresh',
                  onClick: resetContent
                },
                '重置修改'
              )
            : undefined,
          uiButton(
            {
              type: 'text',
              size: 'small',
              icon: 'refresh',
              loading: contentLoading.value,
              onClick: () => void loadContent(true)
            },
            '重新加载'
          )
        ],
        action: () => Vue.h('span', { class: 'text-12 mr-auto' }, contentDirty.value ? '已修改，导入与合并更新将使用当前内容' : '')
      })
      editorModal.open()
    }

    const component = defineComponent({
      template: `
      <div class="flex flex-col gap-12 p-12">
        <Card>
          <div class="flex flex-col gap-8 p-8">
            <div class="flex flex-wrap items-center gap-8">
              <span class="text-16 font-bold">{{ tpl.name }}</span>
              <Tag v-if="tpl.version" size="small">{{ tpl.version }}</Tag>
              <Tag v-for="tag in tpl.tags" :key="tag" size="small">{{ tag }}</Tag>
              <div class="ml-auto flex items-center gap-8">
                <Tag v-if="contentDirty" color="orange" size="small">已修改</Tag>
                <Button type="primary" :loading="importing" @click="doImport">
                  导入模板
                </Button>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-8 text-12">
              <span>{{ tpl.author }}</span>
              <span v-if="tpl.updatedAt">更新于 {{ tpl.updatedAt }}</span>
              <Button
                class="ml-auto"
                type="normal"
                size="small"
                icon="preview"
                @click="openEditor"
              >
                预览模板
              </Button>
            </div>
            <div v-if="tpl.description" class="text-12 whitespace-pre-wrap">
              <span class="font-bold">简介：</span>{{ tpl.description }}
            </div>
            <div v-if="tpl.notes" class="text-12 whitespace-pre-wrap">
              <span class="font-bold">注意事项：</span>{{ tpl.notes }}
            </div>
          </div>
        </Card>
        <Card>
          <div class="flex flex-col gap-8 p-8">
            <div class="flex items-center gap-8">
              <span class="text-14 font-bold">已导入配置</span>
              <span class="text-12">{{ importEntries.length }} 份</span>
            </div>
            <span v-if="importEntries.length === 0" class="text-12">尚未导入此模板</span>
            <div v-else class="flex flex-col gap-8">
              <div
                v-for="entry in importEntries"
                :key="entry.rec.profileId"
                class="flex flex-wrap items-center gap-8 p-8 rounded-6 text-12"
                style="background: var(--card-bg)"
              >
                <template v-if="entry.profile">
                  <span class="font-bold line-clamp-1" style="min-width: 0; max-width: 40%">{{ entry.profile.name }}</span>
                  <Tag v-if="entry.canMerge" color="orange" size="small">可更新</Tag>
                  <span>导入于 {{ formatTime(entry.rec.importedAt) }}</span>
                  <span>模板版本：{{ entry.rec.version || '未知' }}</span>
                  <Button v-if="entry.canMerge" class="ml-auto" type="primary" size="small" :loading="importing" @click="doMergeUpdate(entry.rec)">
                    合并更新
                  </Button>
                </template>
                <span v-else>导入的配置已不存在，可重新导入</span>
              </div>
            </div>
          </div>
        </Card>
        <Card>
          <div class="flex flex-col gap-6 p-8 text-12">
            <div class="leading-relaxed">
              <span class="font-bold">转换提示：</span>{{ convertTip }}
            </div>
            <div>
              <span v-if="contentLoading">模板内容加载中…</span>
              <span v-else-if="contentError">模板内容加载失败：{{ contentError }}</span>
              <span v-else>导入会新建一份配置，不影响当前配置</span>
            </div>
          </div>
        </Card>
      </div>
      `,
      setup() {
        return {
          tpl,
          contentLoading,
          contentError,
          importing,
          importEntries,
          convertTip,
          contentDirty,
          openEditor,
          doImport: () => void doImport(tpl, importing, content.value || undefined),
          doMergeUpdate: (rec) => void doMergeUpdate(tpl, rec, importing, content.value || undefined),
          formatTime: (ts) => Plugins.formatDate(ts, 'YYYY-MM-DD HH:mm:ss')
        }
      }
    })

    const modal = Plugins.modal({
      title: tpl.name,
      submit: false,
      cancelText: '关闭',
      width: '80',
      height: '80',
      px: 0,
      py: 0
    })
    modal.setContent(component)
    modal.patchSlots({
      toolbar: () => [
        tpl.homepage
          ? uiButton(
              {
                type: 'link',
                size: 'small',
                icon: 'link',
                onClick: () => {
                  if (tpl.homepage) {
                    void Plugins.OpenURI(tpl.homepage)
                  }
                }
              },
              '来源'
            )
          : undefined
      ]
    })
    modal.open()
  }

  const openHub = async () => {
    const { computed, defineComponent, ref } = Vue

    await loadLocalData()
    void updateManifest()

    const keywords = ref('')

    const groups = computed(() => {
      const map = {}
      templates.value.forEach((t) => {
        const name = t.group || '通用'
        ;(map[name] ??= []).push(t)
      })
      return Object.keys(map).map((name) => ({ name, list: map[name] }))
    })

    const filteredGroups = computed(() => {
      const kw = keywords.value.trim()
      if (!kw) {
        return groups.value
      }
      const match = Plugins.createTextMatcher(kw.toLocaleLowerCase(), '')
      return groups.value
        .map((g) => ({
          name: g.name,
          list: g.list.filter((t) => match([t.name, t.description, t.author, (t.tags ?? []).join('')].join('').toLocaleLowerCase()))
        }))
        .filter((g) => g.list.length > 0)
    })

    const component = defineComponent({
      template: `
      <div class="h-full w-full overflow-hidden">
        <ModalContainer :empty="filteredGroups.length === 0">
          <template #top>
            <Input
              v-model="keywords"
              :border="false"
              :placeholder="'共 ' + total + ' 个模板'"
              clearable
              class="w-full"
            >
              <template #prefix>
                <Icon icon="search" :size="22" />
              </template>
              <template #suffix>
                <Button
                  v-tips="'刷新清单'"
                  icon="refresh"
                  :loading="manifestLoading"
                  type="text"
                  @click="refresh"
                />
              </template>
            </Input>
          </template>
          <template #empty>
            <Empty>
              <template #description>
                <div class="flex flex-col items-center gap-8">
                  <span class="text-12">{{ manifestError || '暂无模板' }}</span>
                  <Button type="primary" size="small" icon="refresh" :loading="manifestLoading" @click="refresh">
                    刷新
                  </Button>
                </div>
              </template>
            </Empty>
          </template>
          <template #body>
            <div v-for="group in filteredGroups" :key="group.name">
              <div class="text-16 font-bold px-4 py-12 sticky top-0 z-9">{{ group.name }}</div>
              <div class="grid grid-cols-2 gap-8">
                <Card v-for="tpl in group.list" :key="tpl.id" style="min-width: 0">
                  <template #title-prefix>
                    <div class="text-14 font-bold line-clamp-1" style="min-width: 0">{{ tpl.name }}</div>
                  </template>
                  <template #extra>
                    <Button v-tips="'查看详情'" type="text" icon="preview" size="small" @click="openDetail(tpl)" />
                  </template>
                  <div class="flex flex-col gap-4">
                    <div v-tips="tpl.description" class="line-clamp-1 break-all text-12">{{ tpl.description }}</div>
                    <div class="flex items-center gap-4">
                      <span class="flex-1 text-12 line-clamp-1" style="min-width: 0">
                        {{ tpl.author + (tpl.version ? ' · ' + tpl.version : '') }}
                      </span>
                      <Tag v-if="importCount(tpl.id) > 0" color="green" size="small" class="shrink-0">
                        {{ importCount(tpl.id) > 1 ? '已导入 ×' + importCount(tpl.id) : '已导入' }}
                      </Tag>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </template>
        </ModalContainer>
      </div>
      `,
      setup() {
        return {
          keywords,
          filteredGroups,
          total: computed(() => templates.value.length),
          manifestLoading,
          manifestError,
          importCount: (id) => records.value[id]?.length ?? 0,
          refresh: () => void updateManifest(),
          openDetail
        }
      }
    })

    const modal = Plugins.modal({
      title: '配置模板中心',
      submit: false,
      cancelText: '关闭',
      width: '90',
      height: '90'
    })
    modal.setContent(component)
    modal.patchSlots({
      toolbar: () =>
        uiButton(
          {
            type: 'link',
            size: 'small',
            icon: 'log',
            onClick: openReadme
          },
          '贡献指南'
        )
    })
    modal.open()
  }

  /* 触发器 手动触发 */
  const onRun = async () => {
    await openHub()
    return 0
  }

  /* 触发器 插件卡片菜单 */
  const OpenHub = async () => {
    await openHub()
    return 0
  }

  const addHeaderAction = () => {
    Plugins.useAppStore().addCustomActions('profiles_header', {
      id: plugin.id,
      component: 'Button',
      componentProps: {
        type: 'link',
        onClick: () => void openHub()
      },
      componentSlots: {
        default: '模板中心'
      }
    })
  }

  /* 触发器 APP就绪后 */
  const onReady = async () => {
    if (headerEnabled()) {
      addHeaderAction()
    }
    return 0
  }

  /* 触发器 配置更新时 */
  const onConfigure = async () => {
    Plugins.useAppStore().removeCustomActions('profiles_header', plugin.id)
    if (headerEnabled()) {
      addHeaderAction()
    }
    return 0
  }

  /* 触发器 插件销毁时 */
  const onDispose = () => {
    Plugins.useAppStore().removeCustomActions('profiles_header', plugin.id)
  }

  /* 触发器 安装插件时 */
  const onInstall = async () => {
    await ensureDir(BASE_DIR)
    return 0
  }

  /* 触发器 卸载插件时 */
  const onUninstall = async () => {
    await Plugins.ignoredError(Plugins.RemoveFile, BASE_DIR)
    return 0
  }

  return {
    onRun,
    OpenHub,
    onReady,
    onConfigure,
    onDispose,
    onInstall,
    onUninstall
  }
}
