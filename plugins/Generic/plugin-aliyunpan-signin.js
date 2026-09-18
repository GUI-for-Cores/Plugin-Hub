/**
 * 本插件参考项目：https://github.com/mrabit/aliyundriveDailyCheck/blob/master/autoSignin.js
 *
 * 新增功能：
 * 1. 自定义菜单项：管理 RefreshToken -> ManageTokens()
 *    （需在插件设置的 menus 中添加：菜单名「管理 RefreshToken」-> 函数名「ManageTokens」）
 * 2. 弹窗内可批量添加 / 删除多个 refresh_token（每行一个，自动去重）
 * 3. 保存后直接写回插件配置 RefreshTokenList（InputList），与配置页保持同步
 * 4. 弹窗全部使用内联样式 + GUI 语义 CSS 变量，自动跟随亮/暗主题，不创建 style 标签
 */

const UA =
  'Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5'

const CONFIG_KEY = 'RefreshTokenList'

/* =========================================================
 * RefreshToken 列表读写（直接读写插件配置，和 InputList 同步）
 * ========================================================= */
const getConfigTokens = () => {
  const parse = (v) => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean)
    if (typeof v === 'string')
      return v
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean)
    return []
  }
  try {
    const pluginsStore = Plugins.usePluginsStore()
    const plugin = pluginsStore.getPluginById(Plugin.id)
    const item = (plugin?.configuration || []).find((c) => c.key === CONFIG_KEY)
    if (item) return parse(item.value)
  } catch (error) {
    console.log('[AliyunSignin] 读取插件配置失败：', error)
  }
  return parse(Plugin[CONFIG_KEY])
}

const setConfigTokens = async (list) => {
  const pluginsStore = Plugins.usePluginsStore()
  const source = pluginsStore.getPluginById(Plugin.id)
  if (!source) throw '未找到当前插件'
  const plugin = Plugins.deepClone(source)
  plugin.configuration = Array.isArray(plugin.configuration) ? plugin.configuration : []
  let item = plugin.configuration.find((c) => c.key === CONFIG_KEY)
  if (!item) {
    item = {
      id: 'ID_' + Plugins.sampleID(),
      title: 'RefreshToken列表',
      description: '支持多个账号',
      key: CONFIG_KEY,
      component: 'InputList',
      value: [],
      options: []
    }
    plugin.configuration.push(item)
  }
  item.value = list
  await pluginsStore.editPlugin(plugin.id, plugin)
  return list
}

const maskToken = (token) => {
  const t = String(token)
  if (t.length <= 12) return t.slice(0, 4) + '****'
  return t.slice(0, 8) + '****' + t.slice(-4)
}

// 使用 refresh_token 更新 access_token
async function updateAccesssToken(refreshToken) {
  const { body } = await Plugins.HttpPost(
    'https://auth.aliyundrive.com/v2/account/token',
    {
      'User-Agent': UA,
      'Content-Type': 'application/json'
    },
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }
  )
  const { code, message, refresh_token, access_token, nick_name, user_name } = body
  if (code) {
    throw message
  }
  return { refresh_token, access_token, nick_name, user_name }
}

// 签到列表
async function sign_in(access_token) {
  const { body } = await Plugins.HttpPost(
    'https://member.aliyundrive.com/v1/activity/sign_in_list?_rx-s=mobile',
    {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      Authorization: access_token
    },
    {
      isReward: false
    }
  )

  if (body.code) {
    throw body.message
  }

  const { signInLogs, signInCount } = body.result
  return `累计签到${signInCount}天。`
}

// 领取奖励
async function getReward(access_token, signInDay) {
  const { body } = await Plugins.HttpPost(
    'https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile',
    {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      authorization: access_token
    },
    {
      signInDay
    }
  )

  if (!body.success) {
    throw body.message
  }
}

/* =========================================================
 * 自定义菜单项：管理 RefreshToken - ManageTokens
 * 弹窗支持：查看列表 / 单个删除 / 批量添加（每行一个）/ 保存写回配置
 * 弹窗主题系统 (完美跟随 GUI 亮/暗主题)
 * 核心：注入一次 <style> 标签，利用 CSS 变量和 transition 实现零 JS 监听的主题跟随
 * ========================================================= */
const TOKEN_MODAL_STYLE_ID = `${Plugin.id}_token_modal_style`

const ensureTokenModalStyle = () => {
  let style = document.getElementById(TOKEN_MODAL_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = TOKEN_MODAL_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `
    /* 遮罩层 (毛玻璃) */
    .aliyun-token-mask {
      position: fixed; inset: 0; z-index: 2147483000;
      display: flex; align-items: center; justify-content: center;
      padding: 24px; box-sizing: border-box;
      background: var(--modal-mask-bg, rgba(0,0,0,0.35));
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    }
    /* 面板：作为毛玻璃底板，透明度适中（建议 50%~70%），加上模糊 */
    .aliyun-token-panel {
      width: min(620px, calc(100vw - 48px)); max-height: calc(100vh - 48px);
      display: flex; flex-direction: column; overflow: hidden;
      border-radius: 12px; border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
      
      background: rgba(128, 128, 128, 0.4); /* 兜底 */
      background: color-mix(in srgb, var(--modal-bg, var(--card-bg, #fff)) 60%, transparent); /* 推荐 60% */
      backdrop-filter: blur(16px) saturate(1.5);
      -webkit-backdrop-filter: blur(16px) saturate(1.5);
      
      color: var(--color, #222);
      box-shadow: 0 24px 70px rgba(0,0,0,0.28);
      transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
    }
    /* 行卡片：不要再透底了！用文字颜色混入极少量的透明度，作为微弱的底色区分 */
    .aliyun-token-row {
      /* 用当前文字颜色 (--color) 混入 5% 的透明，形成非常干净、微弱的底色 */
      background: color-mix(in srgb, var(--color, #000) 5%, transparent); 
      border: 1px solid color-mix(in srgb, var(--color, #000) 8%, transparent);
    }
    /* 输入框：同样使用微弱底色，或者直接用 GUI 提供的输入框背景色 */
    .aliyun-token-input,
    .aliyun-token-textarea {
      /* 使用 GUI 原生的 input-bg，如果它本身是纯色，看起来会更干净 */
      background: var(--input-bg, rgba(0,0,0,0.05)); 
      /* 如果你非要半透明，可以写成：background: color-mix(in srgb, var(--input-bg, #fff) 80%, transparent); */
    }
    /* Header */
    .aliyun-token-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; padding: 16px 18px 14px; flex-shrink: 0;
      border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.12));
    }
    .aliyun-token-title { font-size: 16px; font-weight: 600; color: var(--color, #222); }
    .aliyun-token-close {
      width: 32px; height: 32px; border: 1px solid transparent; border-radius: 8px;
      color: var(--btn-normal-color, var(--color, #222)); background: transparent;
      font-size: 22px; line-height: 1; cursor: pointer; opacity: 0.68;
      transition: background .15s, opacity .15s;
    }
    .aliyun-token-close:hover { opacity: 1; background: var(--btn-normal-bg, rgba(0,0,0,0.06)); }
    
    /* Body */
    .aliyun-token-body {
      padding: 14px 18px; overflow: auto; display: flex; flex-direction: column; gap: 10px;
    }
    .aliyun-token-list { display: flex; flex-direction: column; gap: 6px; min-height: 40px; }
    .aliyun-token-empty { font-size: 12px; opacity: 0.55; padding: 8px 2px; color: var(--color); }
    .aliyun-token-row {
      display: flex; align-items: center; gap: 8px; padding: 6px 10px;
      border: 1px solid var(--divider-color, rgba(0,0,0,0.12)); border-radius: 8px;
      background: var(--card-bg, rgba(0,0,0,0.02));
      transition: background-color 0.2s ease, border-color 0.2s ease;
    }
    .aliyun-token-idx { font-size: 12px; opacity: 0.5; flex: 0 0 18px; color: var(--color); }
    .aliyun-token-text {
      flex: 1; font-family: Consolas, monospace; font-size: 12px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color);
    }
    
    /* 输入框 */
    .aliyun-token-textarea {
      width: 100%; height: 96px; box-sizing: border-box; padding: 10px 12px; outline: none;
      border: 1px solid var(--divider-color, rgba(0,0,0,0.12)); border-radius: 8px;
      color: var(--input-color, var(--color, #222));
      background: var(--input-bg, rgba(255,255,255,0.55));
      font-family: Consolas, monospace; font-size: 12px; resize: vertical;
      transition: border-color .15s, background-color 0.2s ease, color 0.2s ease;
    }
    .aliyun-token-textarea:focus { border-color: var(--btn-primary-bg, #3b82f6); }
    .aliyun-token-textarea::placeholder { color: var(--color); opacity: 0.45; }
    
    /* Hint */
    .aliyun-token-hint { font-size: 11px; opacity: 0.55; color: var(--color); }
    
    /* Footer */
    .aliyun-token-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 18px 16px; flex-shrink: 0;
      border-top: 1px solid var(--divider-color, rgba(0,0,0,0.12));
    }
    
    /* 按钮基础 */
    .aliyun-token-btn {
      min-width: 88px; height: 34px; padding: 0 14px; font-size: 13px;
      border: 1px solid var(--divider-color, rgba(0,0,0,0.12)); border-radius: 8px;
      color: var(--btn-normal-color, var(--color, #222));
      background: var(--btn-normal-bg, rgba(0,0,0,0.05));
      cursor: pointer; transition: background .15s, border-color .15s, color .15s;
    }
    .aliyun-token-btn:hover { background: var(--btn-normal-hover-bg, rgba(0,0,0,0.09)); }
    .aliyun-token-btn.primary {
      color: var(--btn-primary-color, #fff);
      background: var(--btn-primary-bg, #3b82f6);
      border-color: var(--btn-primary-bg, #3b82f6);
    }
    .aliyun-token-btn.primary:hover {
      background: var(--btn-primary-hover-bg, #2563eb);
      border-color: var(--btn-primary-hover-bg, #2563eb);
    }
    .aliyun-token-btn.danger { color: #ef4444; border-color: #fca5a5; }
    .aliyun-token-btn.danger:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; 
    }
    /* 行内编辑输入框 */
    .aliyun-token-input {
      flex: 1; min-width: 0; height: 28px; box-sizing: border-box;
      padding: 0 8px; outline: none;
      border: 1px solid var(--btn-primary-bg, #3b82f6);
      border-radius: 6px;
      color: var(--input-color, var(--color, #222));
      background: var(--input-bg, rgba(255,255,255,0.55));
      font-family: Consolas, monospace; font-size: 12px;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
  `
}

/* =========================================================
 * 自定义菜单项：管理 RefreshToken - ManageTokens
 * 新增支持：单个编辑 / 双击复制完整 Token / 自动去重校验
 * 自定义菜单项：管理 RefreshToken - ManageTokens（行内编辑版）
 * 交互：点击「编辑」当前行就地变为输入框；Enter=保存该行，Esc=取消该行
 * ========================================================= */
const ManageTokens = async () => {
  ensureTokenModalStyle()

  let working = getConfigTokens()
  let closed = false
  let editingIndex = -1 // 当前处于编辑态的行索引，-1 表示无
  let editingValue = '' // 编辑框实时值（DOM 重建时用于恢复，避免输入丢失）

  const mask = document.createElement('div')
  mask.className = 'aliyun-token-mask'

  const panel = document.createElement('div')
  panel.className = 'aliyun-token-panel'
  mask.appendChild(panel)
  document.body.appendChild(mask)

  const onKey = (e) => {
    if (e.key === 'Escape') close()
  }
  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKey)
    mask.remove()
  }
  document.addEventListener('keydown', onKey)

  /* ---------- Header ---------- */
  const header = document.createElement('div')
  header.className = 'aliyun-token-header'
  const title = document.createElement('div')
  title.className = 'aliyun-token-title'
  title.textContent = '管理 RefreshToken'
  const closeBtn = document.createElement('button')
  closeBtn.type = 'button'
  closeBtn.className = 'aliyun-token-close'
  closeBtn.textContent = '×'
  closeBtn.onclick = close
  header.appendChild(title)
  header.appendChild(closeBtn)
  panel.appendChild(header)

  /* ---------- Body ---------- */
  const bodyBox = document.createElement('div')
  bodyBox.className = 'aliyun-token-body'
  panel.appendChild(bodyBox)

  const listBox = document.createElement('div')
  listBox.className = 'aliyun-token-list'
  bodyBox.appendChild(listBox)

  const smallBtn = (text, cls = '') => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `aliyun-token-btn ${cls}`.trim()
    b.style.cssText = 'min-width:auto;height:auto;padding:2px 8px;font-size:11px;'
    b.textContent = text
    return b
  }

  /* ---------- 行内编辑：取消 / 提交 ---------- */
  const cancelEdit = () => {
    editingIndex = -1
    editingValue = ''
    renderList()
  }

  const commitEdit = (index) => {
    const val = editingValue.trim()
    if (!val) {
      Plugins.message.warn('Token 不能为空')
      return
    }
    const dup = working.findIndex((t, i) => i !== index && t === val)
    if (dup >= 0) {
      Plugins.message.warn(`该 Token 与第 ${dup + 1} 行重复`)
      return
    }
    if (val !== working[index]) {
      working[index] = val
      Plugins.message.success('该行已更新，记得点击底部「保存」写盘', 1500)
    }
    editingIndex = -1
    editingValue = ''
    renderList()
    updateHint()
  }

  /* ---------- 渲染列表（展示态 / 编辑态） ---------- */
  const renderList = () => {
    listBox.innerHTML = ''
    if (!working.length) {
      const empty = document.createElement('div')
      empty.className = 'aliyun-token-empty'
      empty.textContent = '暂无 Token，请在下方粘贴添加（支持多个，每行一个）'
      listBox.appendChild(empty)
      return
    }
    working.forEach((token, index) => {
      const row = document.createElement('div')
      row.className = 'aliyun-token-row'

      const idx = document.createElement('span')
      idx.className = 'aliyun-token-idx'
      idx.textContent = String(index + 1)
      row.appendChild(idx)

      if (index === editingIndex) {
        /* ===== 编辑态：输入框 + 保存/取消 ===== */
        const input = document.createElement('input')
        input.type = 'text'
        input.className = 'aliyun-token-input'
        input.spellcheck = false
        input.value = editingValue
        input.oninput = () => {
          editingValue = input.value
        }
        input.onkeydown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitEdit(index)
          } else if (e.key === 'Escape') {
            // 只取消行内编辑，不关闭整个弹窗
            e.stopPropagation()
            cancelEdit()
          }
        }
        row.appendChild(input)

        const okBtn = smallBtn('保存', 'primary')
        okBtn.onclick = () => commitEdit(index)
        const noBtn = smallBtn('取消')
        noBtn.onclick = () => cancelEdit()
        row.appendChild(okBtn)
        row.appendChild(noBtn)

        listBox.appendChild(row)
        // 自动聚焦并把光标放到末尾
        input.focus()
        try {
          input.setSelectionRange(input.value.length, input.value.length)
        } catch {}
      } else {
        /* ===== 展示态：掩码 + 双击复制 + 编辑/删除 ===== */
        const text = document.createElement('span')
        text.className = 'aliyun-token-text'
        text.textContent = maskToken(token)
        text.style.cursor = 'pointer'
        text.title = '双击复制完整 Token'
        text.ondblclick = async () => {
          try {
            await Plugins.ClipboardSetText(token)
            Plugins.message.success('完整 Token 已复制到剪贴板', 1500)
          } catch (err) {
            Plugins.message.error('复制失败')
          }
        }
        row.appendChild(text)

        const editBtn = smallBtn('编辑')
        editBtn.onclick = () => {
          editingIndex = index
          editingValue = token // 预填完整真实 Token
          renderList()
        }
        row.appendChild(editBtn)

        const delBtn = smallBtn('删除', 'danger')
        delBtn.onclick = () => {
          working.splice(index, 1)
          if (editingIndex === index) {
            editingIndex = -1
            editingValue = ''
          } else if (editingIndex > index) {
            editingIndex-- // 删除行在编辑行之前，索引前移
          }
          renderList()
          updateHint()
        }
        row.appendChild(delBtn)

        listBox.appendChild(row)
      }
    })
  }

  const textarea = document.createElement('textarea')
  textarea.className = 'aliyun-token-textarea'
  textarea.placeholder = '粘贴 refresh_token，支持多个，每行一个'
  textarea.spellcheck = false
  bodyBox.appendChild(textarea)

  const hint = document.createElement('div')
  hint.className = 'aliyun-token-hint'
  const updateHint = () => {
    hint.textContent = `当前共 ${working.length} 个 Token，保存后写入插件配置 ${CONFIG_KEY}`
  }
  bodyBox.appendChild(hint)

  renderList()
  updateHint()

  /* ---------- Footer ---------- */
  const footer = document.createElement('div')
  footer.className = 'aliyun-token-footer'
  panel.appendChild(footer)

  const mkBtn = (text, cls = '') => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `aliyun-token-btn ${cls}`.trim()
    b.textContent = text
    return b
  }

  const addBtn = mkBtn('添加')
  addBtn.style.marginRight = 'auto'
  const cancelBtn = mkBtn('取消')
  const saveBtn = mkBtn('保存', 'primary')

  addBtn.onclick = () => {
    const lines = textarea.value
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean)
    if (!lines.length) {
      Plugins.message.warn('请先粘贴 refresh_token')
      return
    }
    let added = 0
    for (const line of lines) {
      if (!working.includes(line)) {
        working.push(line)
        added++
      }
    }
    textarea.value = ''
    renderList()
    updateHint()
    Plugins.message.success(`已添加 ${added} 个，跳过重复 ${lines.length - added} 个`, 1500)
  }

  cancelBtn.onclick = close

  saveBtn.onclick = async () => {
    if (editingIndex >= 0) {
      Plugins.message.warn('请先保存或取消行内编辑')
      return
    }
    const lines = textarea.value
      .split(/\r?\n/)
      .map((v) => v.trim())
      .filter(Boolean)
    for (const line of lines) {
      if (!working.includes(line)) working.push(line)
    }
    saveBtn.disabled = true
    saveBtn.textContent = '保存中...'
    try {
      await setConfigTokens(working)
      Plugins.message.success(`已保存 ${working.length} 个 RefreshToken`, 1800)
      close()
    } catch (error) {
      saveBtn.disabled = false
      saveBtn.textContent = '保存'
      Plugins.message.error('保存失败：' + (error?.message || error))
    }
  }

  footer.appendChild(addBtn)
  footer.appendChild(cancelBtn)
  footer.appendChild(saveBtn)

  return 0
}

/* =========================================================
 * 签到主流程
 * ========================================================= */
const SignIn = async () => {
  const tokenList = getConfigTokens()
  if (!tokenList.length) throw '未提供任何账号'

  const TOKEN_CONFIG = 'data/third/aliyunpan-signin/config.json'

  // 确保所有父目录存在，如果不存在则递归创建
  const ensureDirectoryExists = async (path) => {
    const parts = path.split('/')
    let currentPath = ''

    for (const part of parts) {
      if (!part) continue // 跳过空部分（例如路径开头的斜杠）
      currentPath = currentPath ? `${currentPath}/${part}` : part

      try {
        await Plugins.Mkdir(currentPath)
      } catch (error) {
        // 如果目录已存在，Mkdir 可能会抛出错误，但我们可以忽略
        if (!error.message.includes('already exists')) {
          console.log('[AliyunSignin] 创建目录失败:', currentPath, error)
        }
      }
    }
  }

  // 确保目录存在
  const dirPath = TOKEN_CONFIG.split('/').slice(0, -1).join('/')
  await ensureDirectoryExists(dirPath)

  // 检查配置文件是否存在，如果不存在则自动创建
  let tokenConfig = '{}'
  try {
    tokenConfig = await Plugins.ReadFile(TOKEN_CONFIG)
    if (!tokenConfig) {
      tokenConfig = '{}'
    }
  } catch (error) {
    console.log('[AliyunSignin] 配置文件不存在，将自动创建:', TOKEN_CONFIG)
    tokenConfig = '{}'
  }
  const TokenMap = JSON.parse(tokenConfig)

  async function refreshAccessToken(token, refreshToken) {
    const { refresh_token, access_token, nick_name, user_name } = await updateAccesssToken(refreshToken)
    TokenMap[token] = {
      refresh_token,
      access_token,
      nick_name,
      user_name
    }
    console.log("🚀~ 'Xuzq' ~ refreshAccessToken ~ refresh_token, access_token, nick_name, user_name:", refresh_token, access_token, nick_name, user_name)
  }

  const res = []

  for (let i = 0; i < tokenList.length; i++) {
    const token = tokenList[i]
    const { refresh_token: latestRefreshToken = token, access_token: latestAccessToken } = TokenMap[token] || {}

    try {
      if (!latestAccessToken) {
        await refreshAccessToken(token, latestRefreshToken)
      }
      if (TokenMap[token]?.access_token) {
        const { nick_name, user_name } = TokenMap[token]
        try {
          const days = await sign_in(TokenMap[token].access_token)
          res.push(`账号【${nick_name || user_name || token.slice(0, 8)}】(${user_name || '未知'}) 签到成功，${days}`)
        } catch (error) {
          await refreshAccessToken(token, TokenMap[token]?.refresh_token || token)
          const { nick_name, user_name } = TokenMap[token]
          const days = await sign_in(TokenMap[token].access_token)
          res.push(`账号【${nick_name || user_name || token.slice(0, 8)}】(${user_name || '未知'}) 签到成功，${days}`)
        }
      }
    } catch (error) {
      console.log(error)
      res.push(`账号【${token.slice(0, 8)}】签到失败：${error.message || error}`)
    }
    await Plugins.sleep(1000)
  }

  await Plugins.WriteFile(TOKEN_CONFIG, JSON.stringify(TokenMap, null, 2))

  return res
}

const onRun = async () => {
  const res = await SignIn()
  Plugins.alert('签到信息', res.join('\n'))
}

const onTask = async () => {
  try {
    const res = await SignIn()
    return res.join('\n')
  } catch (error) {
    return error
  }
}
