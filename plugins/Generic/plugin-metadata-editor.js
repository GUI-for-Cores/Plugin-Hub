const RAW_PREFIX = 'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Generic/'

const RUNTIME_FIELDS = ['updating', 'loading', 'running']

const TRIGGERS = [
  'on::enabled',
  'on::disabled',
  'on::manual',
  'on::subscribe',
  'on::generate',
  'on::startup',
  'on::shutdown',
  'on::ready',
  'on::reload',
  'on::core::started',
  'on::core::stopped',
  'on::before::core::start',
  'on::before::core::stop',
  'on::tray::update'
]

const CONFIG_COMPONENT_VALUES = ['CheckBox', 'CodeEditor', 'Input', 'InputList', 'KeyValueEditor', 'Radio', 'Select', 'MultipleSelect', 'Switch', 'ColorPicker']

const CONFIG_COMPONENTS = new Set(['', ...CONFIG_COMPONENT_VALUES])

const CONTEXT_KINDS = ['profiles', 'subscriptions', 'rulesets', 'plugins', 'scheduledtasks']

const TRIGGER_SET = new Set(TRIGGERS)

const KEY_HINTS = {
  id: { type: 'string' },
  name: { type: 'string' },
  version: { type: 'string（v主版本.次版本.修订号）' },
  description: { type: 'string' },
  type: { type: 'string', values: ['Http', 'File'] },
  url: { type: 'string' },
  path: { type: 'string' },
  triggers: { type: 'string[]', values: TRIGGERS },
  tags: { type: 'string[]' },
  hasUI: { type: 'boolean', values: ['true', 'false'] },
  group: { type: 'string' },
  menus: { type: 'Record<string, string>' },
  context: { type: 'object' },
  configuration: { type: 'array' },
  disabled: { type: 'boolean', values: ['true', 'false'] },
  status: {
    type: '0 | 1 | 2',
    values: ['0 正常', '1 运行中', '2 已停止']
  },
  title: { type: 'string' },
  component: { type: 'string', values: CONFIG_COMPONENT_VALUES },
  key: { type: 'string' },
  value: { type: 'any' },
  options: { type: 'string[]' },
  profiles: { type: 'Record<string, string>' },
  subscriptions: { type: 'Record<string, string>' },
  rulesets: { type: 'Record<string, string>' },
  plugins: { type: 'Record<string, string>' },
  scheduledtasks: { type: 'Record<string, string>' },
  install: { type: 'boolean', values: ['true', 'false'] },
  installed: { type: 'boolean', values: ['true', 'false'] }
}

/** @type {EsmPlugin} */
export default (Plugin) => {
  let closePanel = undefined

  const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

  const formatError = (error) => {
    if (typeof error === 'string') {
      return error
    }
    if (error instanceof Error) {
      return error.message
    }
    return '未知错误'
  }

  const createDefaultContext = () => ({
    profiles: {},
    subscriptions: {},
    rulesets: {},
    plugins: {},
    scheduledtasks: {}
  })

  const createDefaultPlugin = (id) => {
    const pluginId = id ?? `plugin-${Plugins.sampleID()}`

    return {
      id: pluginId,
      name: '新插件',
      version: 'v1.0.0',
      description: '',
      type: 'Http',
      url: `${RAW_PREFIX}${pluginId}.js`,
      path: `data/plugins/${pluginId}.js`,
      triggers: ['on::manual'],
      hasUI: false,
      group: 'Development',
      tags: [],
      menus: {},
      context: createDefaultContext(),
      configuration: [],
      disabled: false,
      status: 0
    }
  }

  const serializePlugin = (record) => {
    const plain = { ...record }
    for (const field of RUNTIME_FIELDS) {
      delete plain[field]
    }
    return JSON.stringify(plain, null, 2)
  }

  const readRequiredString = (input, key, fallback, label, errors) => {
    const value = input[key]
    if (value === undefined) {
      if (fallback.trim()) {
        return fallback
      }
      errors.push(`${label} 不能为空`)
      return ''
    }
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${label} 必须是非空字符串`)
      return fallback
    }
    return value.trim()
  }

  const readOptionalString = (input, key, fallback, label, errors) => {
    const value = input[key]
    if (value === undefined) {
      return fallback
    }
    if (typeof value !== 'string') {
      errors.push(`${label} 必须是字符串`)
      return fallback
    }
    return value
  }

  const readBoolean = (input, key, fallback, errors) => {
    const value = input[key]
    if (value === undefined) {
      return fallback
    }
    if (typeof value !== 'boolean') {
      errors.push(`${key} 必须是布尔值`)
      return fallback
    }
    return value
  }

  const normalizeStringArray = (raw, fallback, label, errors) => {
    if (raw === undefined) {
      return [...fallback]
    }
    if (!Array.isArray(raw)) {
      errors.push(`${label} 必须是字符串数组`)
      return [...fallback]
    }

    const result = []
    raw.forEach((item, index) => {
      if (typeof item !== 'string') {
        errors.push(`${label}[${index}] 必须是字符串`)
        return
      }
      result.push(item)
    })
    return result
  }

  const normalizeStringMap = (raw, fallback, label, errors) => {
    if (raw === undefined) {
      return { ...fallback }
    }
    if (!isRecord(raw)) {
      errors.push(`${label} 必须是对象`)
      return { ...fallback }
    }

    const result = {}
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== 'string') {
        errors.push(`${label}.${key} 必须是字符串`)
        continue
      }
      result[key] = value
    }
    return result
  }

  const normalizeTriggers = (raw, fallback, errors) => {
    if (raw === undefined) {
      return [...fallback]
    }
    if (!Array.isArray(raw)) {
      errors.push('triggers 必须是数组')
      return [...fallback]
    }

    const result = []
    for (const item of raw) {
      if (typeof item !== 'string') {
        errors.push('triggers 只能包含字符串')
        continue
      }
      if (!TRIGGER_SET.has(item)) {
        errors.push(`未知触发器：${item}`)
        continue
      }
      const trigger = item
      if (!result.includes(trigger)) {
        result.push(trigger)
      }
    }
    return result
  }

  const normalizeStatus = (raw, fallback, errors) => {
    if (raw === undefined) {
      return fallback
    }
    if (raw === 0 || raw === 1 || raw === 2) {
      return raw
    }
    errors.push('status 只能是 0（正常）、1（运行中）或 2（已停止）')
    return fallback
  }

  const normalizeContext = (raw, fallback, errors) => {
    const result = createDefaultContext()

    if (raw === undefined) {
      for (const kind of CONTEXT_KINDS) {
        result[kind] = { ...fallback[kind] }
      }
      return result
    }

    if (!isRecord(raw)) {
      errors.push('context 必须是对象')
      for (const kind of CONTEXT_KINDS) {
        result[kind] = { ...fallback[kind] }
      }
      return result
    }

    for (const kind of CONTEXT_KINDS) {
      result[kind] = normalizeStringMap(raw[kind], fallback[kind], `context.${kind}`, errors)
    }
    return result
  }

  const normalizeConfigItem = (raw, base, index, errors) => {
    const fallback = base ?? {
      id: `ID_${index + 1}`,
      title: '',
      description: '',
      key: '',
      component: '',
      value: '',
      options: []
    }

    if (!isRecord(raw)) {
      errors.push(`configuration[${index}] 必须是对象`)
      return { ...fallback }
    }

    const id = readOptionalString(raw, 'id', fallback.id, `configuration[${index}].id`, errors)
    const title = readOptionalString(raw, 'title', fallback.title, `configuration[${index}].title`, errors)
    const description = readOptionalString(raw, 'description', fallback.description, `configuration[${index}].description`, errors)
    const key = readOptionalString(raw, 'key', fallback.key, `configuration[${index}].key`, errors)

    let component = fallback.component
    const rawComponent = raw['component']
    if (rawComponent !== undefined) {
      if (typeof rawComponent === 'string' && CONFIG_COMPONENTS.has(rawComponent)) {
        component = rawComponent
      } else {
        errors.push(`configuration[${index}].component 不受支持`)
      }
    }

    const fallbackOptions = Array.isArray(fallback.options) ? fallback.options.filter((option) => typeof option === 'string') : []
    const options = normalizeStringArray(raw['options'], fallbackOptions, `configuration[${index}].options`, errors)

    return {
      id,
      title,
      description,
      key,
      component,
      value: raw['value'] === undefined ? fallback.value : raw['value'],
      options
    }
  }

  const normalizeConfiguration = (raw, fallback, errors) => {
    if (raw === undefined) {
      return fallback.map((item) => ({
        ...item,
        options: Array.isArray(item.options) ? [...item.options] : []
      }))
    }
    if (!Array.isArray(raw)) {
      errors.push('configuration 必须是数组')
      return fallback.map((item) => ({
        ...item,
        options: Array.isArray(item.options) ? [...item.options] : []
      }))
    }
    return raw.map((item, index) => normalizeConfigItem(item, fallback[index], index, errors))
  }

  const normalizeRecord = (input, base) => {
    const errors = []
    const id = readRequiredString(input, 'id', base.id, 'id', errors)
    const name = readRequiredString(input, 'name', base.name, 'name', errors)
    const version = readRequiredString(input, 'version', base.version, 'version', errors)

    if (version && !/^v\d+\.\d+\.\d+$/.test(version)) {
      errors.push('version 必须符合 v主版本.次版本.修订号，例如 v1.0.0')
    }

    let type = base.type
    const rawType = input['type']
    if (rawType !== undefined) {
      if (rawType === 'Http' || rawType === 'File') {
        type = rawType
      } else {
        errors.push('type 必须是 "Http" 或 "File"')
      }
    }

    const path = readRequiredString(input, 'path', base.path || `data/plugins/${id}.js`, 'path', errors)
    const description = readOptionalString(input, 'description', base.description, 'description', errors)
    const group = readOptionalString(input, 'group', base.group, 'group', errors)
    const url = readOptionalString(input, 'url', base.url, 'url', errors).trim()

    if (type === 'Http') {
      if (!url) {
        errors.push('type 为 Http 时必须填写 url')
      } else if (!/^https?:\/\//i.test(url)) {
        errors.push('url 必须以 http:// 或 https:// 开头')
      }
    }

    const triggers = normalizeTriggers(input['triggers'], base.triggers, errors)
    const tags = normalizeStringArray(input['tags'], base.tags, 'tags', errors)
    const hasUI = readBoolean(input, 'hasUI', base.hasUI, errors)
    const disabled = readBoolean(input, 'disabled', base.disabled, errors)
    const status = normalizeStatus(input['status'], base.status, errors)
    const menus = normalizeStringMap(input['menus'], base.menus, 'menus', errors)
    const context = normalizeContext(input['context'], base.context, errors)
    const configuration = normalizeConfiguration(input['configuration'], base.configuration, errors)

    const record = {
      ...base,
      ...input,
      id,
      name,
      version,
      description,
      type,
      url,
      path,
      triggers,
      tags,
      hasUI,
      group,
      menus,
      context,
      configuration,
      disabled,
      status
    }
    for (const field of RUNTIME_FIELDS) {
      delete record[field]
    }

    return { record: record, errors }
  }

  const parseDraft = (source, base, editing) => {
    let parsed = undefined
    try {
      parsed = JSON.parse(source)
    } catch (error) {
      return {
        records: [],
        errors: [`JSON 解析失败：${formatError(error)}`],
        batch: false
      }
    }

    if (editing) {
      if (!isRecord(parsed)) {
        return {
          records: [],
          errors: ['编辑模式下 JSON 根节点必须是对象'],
          batch: false
        }
      }
      const result = normalizeRecord(parsed, base)
      return { records: [result.record], errors: result.errors, batch: false }
    }

    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        return { records: [], errors: ['批量新增的数组不能为空'], batch: true }
      }

      const records = []
      const errors = []
      parsed.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`第 ${index + 1} 项必须是对象`)
          return
        }
        const itemId = item['id']
        if (typeof itemId !== 'string' || !itemId.trim()) {
          errors.push(`第 ${index + 1} 项必须填写 id`)
          return
        }
        const result = normalizeRecord(item, createDefaultPlugin(itemId))
        records.push(result.record)
        errors.push(...result.errors.map((error) => `第 ${index + 1} 项：${error}`))
      })
      return { records, errors, batch: true }
    }

    if (!isRecord(parsed)) {
      return {
        records: [],
        errors: ['JSON 根节点必须是对象或数组'],
        batch: false
      }
    }

    const parsedId = typeof parsed['id'] === 'string' && parsed['id'].trim() ? parsed['id'].trim() : undefined
    const result = normalizeRecord(parsed, parsedId ? createDefaultPlugin(parsedId) : base)
    return { records: [result.record], errors: result.errors, batch: false }
  }

  const hintForKey = (key) => {
    const hint = KEY_HINTS[key]
    if (!hint) {
      return null
    }
    if (hint.values) {
      return { key, type: hint.type, values: [...hint.values] }
    }
    return { key, type: hint.type }
  }

  const inferRawHint = (raw) => {
    const value = raw.trim().replace(/,$/, '')
    if (value.startsWith('"')) {
      return { type: 'string' }
    }
    if (value === 'true' || value === 'false') {
      return { type: 'boolean', values: ['true', 'false'] }
    }
    if (value === 'null') {
      return { type: 'null' }
    }
    if (value.startsWith('[')) {
      return { type: 'array' }
    }
    if (value.startsWith('{')) {
      return { type: 'object' }
    }
    if (/^-?\d/.test(value)) {
      return { type: 'number' }
    }
    return { type: 'unknown' }
  }

  const findParentKeyFromLines = (lines) => {
    for (const line of lines) {
      const match = /^"([^"]+)"\s*:\s*[[{]\s*$/.exec(line.trim())
      if (match?.[1]) {
        return match[1]
      }
    }
    return null
  }

  const buildFieldHint = (lineText, parentKey) => {
    const trimmed = lineText.trim()
    if (!trimmed) {
      return null
    }

    const [, key, rawValue = ''] = /^"([^"]+)"\s*:\s*(.*)$/.exec(trimmed) ?? []
    if (key) {
      const known = hintForKey(key)
      if (known) {
        return known
      }
      if (parentKey === 'menus') {
        return { key: 'menus', type: 'string（导出函数名）' }
      }
      if (parentKey === 'context') {
        return { key, type: 'Record<string, string>' }
      }
      return { ...inferRawHint(rawValue), key }
    }

    if (/^[\]}{,]+$/.test(trimmed)) {
      return null
    }

    if (parentKey === 'triggers') {
      return { key: 'triggers[i]', type: 'string', values: [...TRIGGERS] }
    }
    if (parentKey === 'tags') {
      return { key: 'tags[i]', type: 'string' }
    }
    if (parentKey === 'options') {
      return { key: 'options[i]', type: 'string' }
    }
    if (parentKey === 'menus') {
      return { key: 'menus', type: 'string（导出函数名）' }
    }
    if (parentKey === 'context') {
      return { key: 'context', type: 'Record<string, string>' }
    }
    if (parentKey === 'configuration') {
      return { key: 'configuration[i]', type: 'object' }
    }

    return { ...inferRawHint(trimmed), key: '' }
  }

  const setupPanel = (initialId) => {
    const { computed, onMounted, onUnmounted, ref } = Vue

    const store = Plugins.usePluginsStore()
    const installed = computed(() => store.plugins)

    const keyword = ref('')
    const text = ref('')
    const baselineText = ref('')
    const saving = ref(false)
    const selectedId = ref(null)
    const emptyDraft = ref(createDefaultPlugin())
    const editorRef = ref(null)
    const editorHost = ref(null)
    const fieldHint = ref(null)

    const updateFieldHint = () => {
      const host = editorHost.value
      const selection = document.getSelection()
      if (!host || !selection?.anchorNode || !host.contains(selection.anchorNode)) {
        fieldHint.value = null
        return
      }

      const anchor = selection.anchorNode
      const anchorElement = anchor.nodeType === 1 ? anchor : anchor.parentElement
      const line = anchorElement?.closest('.cm-line')
      if (!line) {
        fieldHint.value = null
        return
      }

      const previousLines = []
      let sibling = line.previousElementSibling
      while (sibling) {
        if (sibling.classList.contains('cm-line')) {
          previousLines.push(sibling.textContent ?? '')
        }
        sibling = sibling.previousElementSibling
      }

      fieldHint.value = buildFieldHint(line.textContent ?? '', findParentKeyFromLines(previousLines))
    }

    onMounted(() => {
      document.addEventListener('selectionchange', updateFieldHint)
      updateFieldHint()
    })

    onUnmounted(() => {
      document.removeEventListener('selectionchange', updateFieldHint)
    })

    const filterPlugins = () => {
      const query = keyword.value.trim().toLowerCase()
      if (!query) {
        return installed.value
      }
      return installed.value.filter((item) => `${item.id} ${item.name} ${item.description}`.toLowerCase().includes(query))
    }

    const applyDraft = (record) => {
      baselineText.value = serializePlugin(record)
      text.value = baselineText.value
      fieldHint.value = null
    }

    const openPlugin = (record) => {
      selectedId.value = record.id
      applyDraft(record)
    }

    const startAdd = () => {
      selectedId.value = null
      emptyDraft.value = createDefaultPlugin()
      applyDraft(emptyDraft.value)
    }

    const initialRecord = initialId ? installed.value.find((item) => item.id === initialId) : undefined
    if (initialRecord) {
      openPlugin(initialRecord)
    } else {
      startAdd()
    }

    const filteredPlugins = computed(filterPlugins)

    const selectedRecord = computed(() => {
      const id = selectedId.value
      if (!id) {
        return null
      }
      return installed.value.find((item) => item.id === id) ?? null
    })

    const validation = computed(() => parseDraft(text.value, selectedRecord.value ?? emptyDraft.value, selectedId.value !== null))

    const currentErrors = computed(() => {
      const { errors: initialErrors, records } = validation.value
      const errors = [...initialErrors]
      const seenIds = new Set()
      const seenPaths = new Set()

      records.forEach((record, index) => {
        const label = validation.value.batch ? `第 ${index + 1} 项` : '插件'

        if (seenIds.has(record.id)) {
          errors.push(`${label} id 重复：${record.id}`)
        }
        seenIds.add(record.id)

        if (seenPaths.has(record.path)) {
          errors.push(`${label} path 重复：${record.path}`)
        }
        seenPaths.add(record.path)

        if (selectedId.value) {
          const idOwner = installed.value.find((item) => item.id !== selectedId.value && item.id === record.id)
          if (idOwner) {
            errors.push(`插件 id 已存在：${record.id}`)
          }
          const owner = installed.value.find((item) => item.id !== selectedId.value && item.path === record.path)
          if (owner) {
            errors.push(`path 已被插件 ${owner.name || owner.id} 使用`)
          }
        } else {
          const idOwner = installed.value.find((item) => item.id === record.id)
          if (idOwner) {
            errors.push(`插件 id 已存在：${record.id}`)
          }
          const pathOwner = installed.value.find((item) => item.path === record.path)
          if (pathOwner) {
            errors.push(`path 已被插件 ${pathOwner.name || pathOwner.id} 使用`)
          }
        }
      })

      return errors
    })

    const canSave = computed(() => !saving.value && validation.value.records.length > 0 && currentErrors.value.length === 0)

    const recordsLabel = computed(() => {
      const total = validation.value.records.length
      if (validation.value.batch && total > 1) {
        return `批量新增 ${total} 个`
      }
      return '添加插件'
    })

    const isDirty = computed(() => text.value !== baselineText.value)

    const formatDraft = async () => {
      try {
        await editorRef.value?.format()
      } catch (error) {
        Plugins.message.error(formatError(error))
      }
    }

    const resetDraft = () => {
      text.value = baselineText.value
      Plugins.message.info('已恢复为上次载入的内容')
    }

    const renamePlugin = async (oldId, current, record) => {
      const temporaryPath = `${record.path}.rename-${Plugins.sampleID()}`
      await store.editPlugin(oldId, {
        ...record,
        path: temporaryPath,
        disabled: current?.disabled ?? record.disabled
      })

      try {
        await store.editPlugin(record.id, record)
      } catch (error) {
        await store.editPlugin(record.id, { ...record, path: temporaryPath }).catch(() => undefined)
        throw error
      }

      const { pluginSettings } = Plugins.useAppSettingsStore().app
      if (isRecord(pluginSettings)) {
        const oldSettings = pluginSettings[oldId]
        if (oldSettings !== undefined && pluginSettings[record.id] === undefined) {
          pluginSettings[record.id] = oldSettings
          delete pluginSettings[oldId]
        }
      }
    }

    const saveDraft = async () => {
      if (!canSave.value) {
        return
      }

      const { records } = validation.value
      const editingId = selectedId.value
      const editingRecord = editingId ? (records[0] ?? selectedRecord.value) : null
      const renaming = editingId !== null && editingRecord !== null && editingRecord.id !== editingId

      if (renaming && editingRecord) {
        const confirmed = await Plugins.confirm(
          '重命名插件',
          `插件 ID 将从 ${editingId} 改为 ${editingRecord.id}。旧插件实例会被卸载，path 与 url 不会自动修改。是否继续？`,
          { type: 'text', okText: '重命名', cancelText: '取消' }
        ).catch(() => false)
        if (!confirmed) {
          return
        }
      }

      saving.value = true
      try {
        if (editingId) {
          const [record] = records
          if (!record) {
            return
          }
          if (renaming) {
            await renamePlugin(editingId, selectedRecord.value, record)
          } else {
            await store.editPlugin(editingId, record)
          }
          selectedId.value = record.id
          applyDraft(record)
          Plugins.message.success(renaming ? `已重命名为 ${record.name || record.id}` : `已保存 ${record.name || record.id} 的元数据`)
        } else {
          for (const record of records) {
            await store.addPlugin(record)
          }
          if (records.length === 1 && records[0]) {
            Plugins.message.success(`已添加 ${records[0].name || records[0].id}`)
            openPlugin(records[0])
          } else {
            Plugins.message.success(`已添加 ${records.length} 个插件`)
            startAdd()
          }
        }
      } catch (error) {
        Plugins.message.error(formatError(error))
      } finally {
        saving.value = false
      }
    }

    return {
      keyword,
      text,
      saving,
      selectedId,
      selectedRecord,
      filteredPlugins,
      installed,
      currentErrors,
      canSave,
      recordsLabel,
      isDirty,
      editorRef,
      editorHost,
      fieldHint,
      startAdd,
      openPlugin,
      formatDraft,
      resetDraft,
      saveDraft
    }
  }

  const panelTemplate = /* html */ `
    <div class="flex gap-16 p-16" style="height: 70vh; min-height: 420px">
      <div
        class="flex flex-col gap-8 w-[25%] min-w-256 pr-16"
        style="min-height: 0; border-right: 1px solid var(--divider-color)"
      >
        <div class="flex items-center justify-between">
          <span class="text-14 font-bold">已安装插件</span>
          <Tag size="small">{{ installed.length }}</Tag>
        </div>
        <Button type="primary" icon="add" class="w-full" @click="startAdd">
          新增插件
        </Button>
        <Input v-model="keyword" placeholder="搜索名称或 ID" clearable class="w-full" />
        <div class="flex-1 overflow-y-auto flex flex-col gap-4" style="min-height: 0">
          <Card
            v-for="item in filteredPlugins"
            :key="item.id"
            :selected="item.id === selectedId"
            class="shrink-0"
            @click="openPlugin(item)"
          >
            <div class="px-4 py-6">
              <div class="flex items-center gap-4">
                <span class="text-14 font-bold line-clamp-1">{{ item.name || item.id }}</span>
                <Tag size="small" :color="item.disabled ? 'red' : 'green'">
                  {{ item.disabled ? '已禁用' : '已启用' }}
                </Tag>
                <span class="ml-auto shrink-0 text-10">{{ item.version }}</span>
              </div>
              <div class="text-12 line-clamp-1" style="color: var(--level-0-color)">
                {{ item.id }}
              </div>
            </div>
          </Card>
          <Empty v-if="filteredPlugins.length === 0" description="没有匹配的插件" />
        </div>
      </div>

      <div class="flex-1 flex flex-col gap-8 min-w-0">
        <div class="flex items-center gap-8">
          <Tag size="small" :color="selectedId ? 'cyan' : 'green'">
            {{ selectedId ? '编辑' : '新增' }}
          </Tag>
          <div class="text-16 font-bold line-clamp-1">
            {{ selectedRecord?.name || '新插件' }}
          </div>
          <div v-if="selectedId" class="text-12" style="color: var(--level-0-color)">
            {{ selectedId }}
          </div>
          <div class="ml-auto flex items-center gap-4">
            <Button size="small" icon="code" @click="formatDraft">格式化</Button>
            <Button size="small" icon="rollback" :disabled="!isDirty" @click="resetDraft">
              重置
            </Button>
            <Button
              type="primary"
              size="small"
              icon="add"
              :loading="saving"
              :disabled="!canSave"
              @click="saveDraft"
            >
              {{ selectedId ? '保存' : recordsLabel }}
            </Button>
          </div>
        </div>

        <div ref="editorHost" class="flex-1 overflow-hidden" style="min-height: 0">
          <CodeEditor ref="editorRef" v-model="text" lang="json" editable class="h-full" />
        </div>

        <div class="flex items-start gap-8 text-12" style="min-height: 22px">
          <Tag v-if="currentErrors.length" color="red" size="small">无法保存</Tag>
          <Tag v-else color="green" size="small">JSON 有效</Tag>
          <div
            v-if="currentErrors.length"
            class="flex flex-col gap-2"
            style="color: var(--level-3-color)"
          >
            <span v-for="(error, index) in currentErrors.slice(0, 4)" :key="index">
              {{ error }}
            </span>
            <span v-if="currentErrors.length > 4" style="color: var(--level-0-color)">
              还有 {{ currentErrors.length - 4 }} 条错误…
            </span>
          </div>
          <div
            v-else-if="fieldHint"
            class="flex flex-wrap items-center gap-4"
            style="color: var(--level-0-color)"
          >
            <span class="font-bold" style="color: var(--color)">{{ fieldHint.key }}</span>
            <Tag size="small" color="cyan">{{ fieldHint.type }}</Tag>
            <span v-if="fieldHint.values?.length">
              可选：{{ fieldHint.values.join('、') }}
            </span>
          </div>
          <div v-else style="color: var(--level-0-color)">
            {{ selectedId ? '保存后立即写入已安装插件元数据；修改 ID 会触发重命名确认。' : '当前内容将作为新插件添加；也支持粘贴数组批量新增。' }}
          </div>
        </div>
      </div>
    </div>
  `

  /* 菜单 打开元数据编辑器 */
  const openEditor = (target) => {
    let initialId = undefined
    if (typeof target === 'string') {
      initialId = target
    } else if (isRecord(target) && typeof target['id'] === 'string') {
      initialId = target['id']
    }

    closePanel?.()

    const component = Vue.defineComponent({
      template: panelTemplate,
      setup: () => setupPanel(initialId)
    })

    const modal = Plugins.modal({
      title: Plugin.name,
      width: '90',
      height: '90',
      px: 0,
      py: 0,
      submit: false,
      cancelText: '关闭'
    })
    modal.setContent(component)
    modal.open()
    closePanel = () => modal.destroy()
  }

  /* 触发器 手动触发 */
  const onRun = () => {
    openEditor()
  }

  /* 触发器 插件销毁时 */
  const onDispose = () => {
    closePanel?.()
    closePanel = undefined
  }

  return { onRun, onDispose }
}
