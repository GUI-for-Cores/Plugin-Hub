/** 阿里云盘签到，接口流程参考 https://github.com/mrabit/aliyundriveDailyCheck */
const CONFIG_KEY = 'RefreshTokenList'
const TOKEN_CONFIG = 'data/.cache/aliyunpan-signin.json'
const LEGACY_TOKEN_CONFIG = 'data/third/aliyunpan-signin/config.json'
const UA =
  'Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5'

const normalizeTokens = (tokens) => [...new Set(tokens.map((token) => token.trim()).filter(Boolean))]

const getConfigTokens = () => {
  const plugin = Plugins.usePluginsStore().getPluginById(Plugin.id)
  const item = plugin.configuration.find((item) => item.key === CONFIG_KEY)
  return normalizeTokens(item ? item.value : [])
}

const setConfigTokens = async (tokens) => {
  const store = Plugins.usePluginsStore()
  const plugin = Plugins.deepClone(store.getPluginById(Plugin.id))
  let item = plugin.configuration.find((item) => item.key === CONFIG_KEY)
  // 兼容旧版没有配置项、仅通过菜单添加 Token 的安装。
  if (!item) {
    item = {
      id: 'ID_' + Plugins.sampleID(),
      title: 'RefreshToken 列表',
      description: '支持多个账号',
      key: CONFIG_KEY,
      component: 'InputList',
      value: [],
      options: []
    }
    plugin.configuration.push(item)
  }
  item.value = tokens
  await store.editPlugin(plugin.id, plugin)
}

const maskToken = (token) => (token.length <= 12 ? token.slice(0, 4) + '****' : token.slice(0, 8) + '****' + token.slice(-4))

const ManageTokens = async () => {
  const { ref, computed } = Vue
  const initialTokens = getConfigTokens()
  const tokens = ref([...initialTokens])
  const input = ref('')
  const editingIndex = ref(-1)
  const editingValue = ref('')
  const saving = ref(false)
  const editError = ref('')
  const addFeedback = ref('')
  const pendingTokens = computed(() =>
    input.value
      .split(/\r?\n/)
      .map((token) => token.trim())
      .filter(Boolean)
  )
  const newTokens = computed(() => normalizeTokens(pendingTokens.value).filter((token) => !tokens.value.includes(token)))
  const duplicateCount = computed(() => pendingTokens.value.length - newTokens.value.length)
  const hasChanges = computed(() => JSON.stringify(tokens.value) !== JSON.stringify(initialTokens) || newTokens.value.length > 0 || editingIndex.value !== -1)

  const cancelEdit = () => {
    editingIndex.value = -1
    editingValue.value = ''
    editError.value = ''
  }
  const commitEdit = () => {
    const value = editingValue.value.trim()
    if (!value) {
      editError.value = '请输入 RefreshToken'
      return false
    }
    if (tokens.value.some((token, index) => index !== editingIndex.value && token === value)) {
      editError.value = '该 Token 已在列表中，请勿重复添加'
      return false
    }
    tokens.value[editingIndex.value] = value
    cancelEdit()
    return true
  }
  const addTokens = () => {
    const added = newTokens.value.length
    const skipped = duplicateCount.value
    tokens.value = normalizeTokens([...tokens.value, ...input.value.split(/\r?\n/)])
    input.value = ''
    addFeedback.value = `已添加 ${added} 个 Token${skipped ? `，跳过 ${skipped} 个重复项` : ''}`
  }

  const component = {
    template: `
      <div class="flex flex-col gap-16 p-8" style="width: 100%; max-width: 720px; margin: 0 auto; box-sizing: border-box">
        <div class="flex items-center justify-between gap-12">
          <div>
            <div class="text-16 font-bold">签到账号</div>
            <div class="text-12 mt-4 opacity-60">每个 RefreshToken 对应一个账号，修改后保存生效。</div>
          </div>
          <Tag size="small">{{ tokens.length }} 个账号</Tag>
        </div>

        <div v-if="!tokens.length" class="flex flex-col items-center gap-8 py-24">
          <Icon icon="profiles" :size="32" class="opacity-40" />
          <div class="text-14">还没有添加账号</div>
          <div class="text-12 opacity-60">在下方粘贴 Token，即可添加第一个签到账号</div>
        </div>
        <div v-else class="flex flex-col gap-8" style="max-height: 320px; overflow-y: auto">
          <Card v-for="(token, index) in tokens" :key="index" :selected="editingIndex === index">
            <div class="flex flex-col gap-8 p-4">
              <div class="flex items-center justify-between gap-8" style="flex-wrap: wrap">
                <div class="flex items-center gap-8">
                  <Icon icon="profiles" :size="16" class="opacity-60" />
                  <span class="text-14 font-bold">账号 {{ String(index + 1).padStart(2, '0') }}</span>
                  <Tag v-if="editingIndex === index" size="small" color="primary">编辑中</Tag>
                </div>
                <div v-if="editingIndex !== index" class="flex items-center gap-4">
                  <Button type="text" size="small" icon="copy" :disabled="saving" @click="copyToken(token)">复制</Button>
                  <Button type="text" size="small" icon="edit" :disabled="saving || editingIndex !== -1" @click="editToken(index)">编辑</Button>
                  <Button type="text" size="small" icon="delete" :disabled="saving || editingIndex !== -1" @click="tokens.splice(index, 1)">删除</Button>
                </div>
              </div>
              <template v-if="editingIndex === index">
                <Input v-model="editingValue" class="w-full font-mono" :disabled="saving" placeholder="输入完整 RefreshToken"
                  aria-label="RefreshToken" @update:model-value="editError = ''"
                  @keydown.enter.stop.prevent="commitEdit" @keydown.esc.stop.prevent="cancelEdit" />
                <div v-if="editError" role="alert" class="text-12"><Tag color="red" size="small">{{ editError }}</Tag></div>
                <div class="flex items-center justify-between gap-8" style="flex-wrap: wrap">
                  <span class="text-12 opacity-60">Enter 确认 · Esc 取消</span>
                  <div class="flex gap-8">
                    <Button size="small" :disabled="saving" @click="cancelEdit">取消编辑</Button>
                    <Button type="primary" size="small" :disabled="saving" @click="commitEdit">确认修改</Button>
                  </div>
                </div>
              </template>
              <div v-else class="font-mono text-12 opacity-60" style="letter-spacing: 1px" title="已隐藏部分 Token">{{ maskToken(token) }}</div>
            </div>
          </Card>
        </div>

        <Card title="批量添加" subtitle="每行粘贴一个 RefreshToken，空行和重复项会自动跳过。">
          <div class="flex flex-col gap-12 mt-8">
            <CodeEditor v-model="input" lang="text" :editable="!saving" placeholder="在此粘贴 RefreshToken…" style="height: 136px" />
            <div class="flex items-center justify-between gap-8" style="flex-wrap: wrap">
              <div class="text-12 opacity-60" aria-live="polite">
                <template v-if="pendingTokens.length">待添加 {{ newTokens.length }} 个<span v-if="duplicateCount"> · {{ duplicateCount }} 个重复项将跳过</span></template>
                <template v-else>{{ addFeedback || '支持一次粘贴多个账号' }}</template>
              </div>
              <Button icon="add" :disabled="saving || !pendingTokens.length" @click="addTokens">添加到列表</Button>
            </div>
          </div>
        </Card>
        <div class="flex items-center gap-8 text-12 opacity-60" role="status">
          <Icon :icon="hasChanges ? 'edit' : 'selected'" :size="14" />
          <span>{{ hasChanges ? '有未保存的修改，点击「保存更改」后生效' : 'Token 仅显示部分内容，可点击「复制」获取完整值' }}</span>
        </div>
      </div>
    `,
    setup() {
      return {
        tokens,
        input,
        editingIndex,
        editingValue,
        saving,
        editError,
        addFeedback,
        pendingTokens,
        newTokens,
        duplicateCount,
        hasChanges,
        maskToken,
        cancelEdit,
        commitEdit,
        addTokens,
        editToken(index) {
          editingIndex.value = index
          editingValue.value = tokens.value[index]
        },
        async copyToken(token) {
          try {
            await Plugins.ClipboardSetText(token)
            Plugins.message.success('完整 Token 已复制')
          } catch (error) {
            Plugins.message.error('复制失败：' + (error.message || error))
          }
        }
      }
    }
  }

  const modal = Plugins.modal({
    title: '管理 RefreshToken',
    width: '60',
    submitText: '保存更改',
    cancelText: '取消',
    maskClosable: false,
    beforeClose: () => !saving.value,
    onOk: async () => {
      if (saving.value) return false
      if (editingIndex.value !== -1 && !commitEdit()) return false
      addTokens()
      saving.value = true
      try {
        await setConfigTokens([...tokens.value])
        Plugins.message.success(`已保存 ${tokens.value.length} 个 RefreshToken`)
      } catch (error) {
        Plugins.message.error('保存失败：' + (error.message || error))
        return false
      } finally {
        saving.value = false
      }
    }
  })
  modal.setContent(component)
  modal.open()
}

const post = async (url, data, accessToken) => {
  const headers = { 'User-Agent': UA, 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = accessToken
  const { status, body } = await Plugins.HttpPost(url, headers, data)
  if (status < 200 || status >= 300 || body.code || body.success === false) {
    throw new Error(body.message || body.code || `请求失败（HTTP ${status}）`)
  }
  return body
}

const refreshAccessToken = async (refreshToken) => {
  const body = await post('https://auth.aliyundrive.com/v2/account/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  })
  if (!body.refresh_token || !body.access_token) throw new Error('刷新接口未返回有效 Token')
  return body
}

const signIn = async (accessToken) => {
  const body = await post('https://member.aliyundrive.com/v1/activity/sign_in_list?_rx-s=mobile', { isReward: false }, accessToken)
  if (!body.success) throw new Error(body.message || '签到失败')
  const { signInCount, signInLogs } = body.result
  const messages = [`签到成功，累计签到 ${signInCount} 天。`]
  for (const log of signInLogs.filter((log) => log.status === 'normal' && !log.isReward)) {
    try {
      const reward = await post('https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile', { signInDay: log.day }, accessToken)
      if (!reward.success) throw new Error(reward.message || '领取失败')
      messages.push(`第 ${log.day} 天奖励领取成功`)
    } catch (error) {
      messages.push(`第 ${log.day} 天奖励领取失败：${error.message || error}`)
    }
  }
  return messages.join('；')
}

const SignIn = async () => {
  const tokens = getConfigTokens()
  if (!tokens.length) throw new Error('未提供任何账号，请先通过「管理 RefreshToken」添加')

  // 只把文件不存在视为首次运行，读取和解析错误直接上报，避免覆盖有效凭据。
  const cachePath = (await Plugins.FileExists(TOKEN_CONFIG)) ? TOKEN_CONFIG : LEGACY_TOKEN_CONFIG
  const saved = (await Plugins.FileExists(cachePath)) ? JSON.parse(await Plugins.ReadFile(cachePath)) : {}
  const tokenMap = Object.fromEntries(tokens.filter((token) => saved[token]).map((token) => [token, saved[token]]))
  await Plugins.MakeDir('data/.cache')
  await Plugins.WriteFile(TOKEN_CONFIG, JSON.stringify(tokenMap, null, 2))
  if (await Plugins.FileExists(LEGACY_TOKEN_CONFIG)) await Plugins.RemoveFile(LEGACY_TOKEN_CONFIG)

  const results = []
  for (const [index, token] of tokens.entries()) {
    if (index) await Plugins.sleep(1000)
    let account
    try {
      account = await refreshAccessToken(tokenMap[token]?.refresh_token || token)
    } catch (error) {
      results.push(`账号 ${index + 1} 刷新失败：${error.message || error}`)
      continue
    }
    // refresh_token 会轮换：签到前立即持久化，写入失败时停止处理后续账号。
    tokenMap[token] = { refresh_token: account.refresh_token }
    await Plugins.WriteFile(TOKEN_CONFIG, JSON.stringify(tokenMap, null, 2))
    const name = account.nick_name || account.user_name || `账号 ${index + 1}`
    try {
      results.push(`账号【${name}】${await signIn(account.access_token)}`)
    } catch (error) {
      results.push(`账号【${name}】签到失败：${error.message || error}`)
    }
  }
  return results
}

const onRun = async () => {
  await Plugins.alert('签到信息', (await SignIn()).join('\n'))
}

const onTask = async () => (await SignIn()).join('\n')

const onUninstall = async () => {
  for (const path of [TOKEN_CONFIG, LEGACY_TOKEN_CONFIG]) {
    if (await Plugins.FileExists(path)) await Plugins.RemoveFile(path)
  }
}
