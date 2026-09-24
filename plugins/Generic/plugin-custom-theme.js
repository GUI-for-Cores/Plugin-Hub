/* VERSION: v11.7-patch1 */
const CONSTANTS = {
  PATHS: {
    THEME: 'data/third/custom-singbox-theme',
    ICON_REPO: 'data/third/custom-singbox-theme/icons',
    ICON_FACTORY: 'data/third/custom-singbox-theme/icons/original',
    CACHE: 'data/.cache',
    ICON_CACHE: 'data/.cache/icons',
    IMG_CACHE: 'data/.cache/imgs',
    CUSTOM_BG: 'data/third/custom-singbox-theme/custom_bg',
    CUSTOM_CSS: 'data/third/custom-singbox-theme/custom.css'
  },
  LIMITS: {
    MAX_IMAGE_SIZE: 30 * 1024 * 1024,
    MAX_ICON_FILE_SIZE: 512 * 1024,
    ICON_DOWNLOAD_TIMEOUT: 30,
    ONLINE_IMAGE_TIMEOUT: 90,
    CONFIG_CACHE_TTL: 60000,
    MAX_IMAGE_SIZE_MB: 30
  },
  UI: {
    ICON_PICK_SIZE: 20,
    ICON_PICK_GAP: 2
  },
  FEATURES: {
    VARIABLE_LIST: [
      '--color-light',
      '--color-dark',
      '--bg-color-light',
      '--bg-color-dark',
      '--scrollbar-track-bg-light',
      '--scrollbar-thumb-bg-light',
      '--scrollbar-track-bg-dark',
      '--scrollbar-thumb-bg-dark',
      '--btn-normal-color-light',
      '--btn-normal-bg-light',
      '--btn-normal-hover-color-light',
      '--btn-normal-hover-bg-light',
      '--btn-normal-hover-border-color-light',
      '--btn-normal-active-color-light',
      '--btn-normal-active-bg-light',
      '--btn-normal-active-border-color-light',
      '--btn-normal-color-dark',
      '--btn-normal-bg-dark',
      '--btn-normal-hover-color-dark',
      '--btn-normal-hover-bg-dark',
      '--btn-normal-hover-border-color-dark',
      '--btn-normal-active-color-dark',
      '--btn-normal-active-bg-dark',
      '--btn-normal-active-border-color-dark',
      '--btn-primary-color-light',
      '--btn-primary-bg-light',
      '--btn-primary-hover-bg-light',
      '--btn-primary-active-bg-light',
      '--btn-primary-color-dark',
      '--btn-primary-bg-dark',
      '--btn-primary-hover-bg-dark',
      '--btn-primary-active-bg-dark',
      '--btn-text-color-light',
      '--btn-text-bg-light',
      '--btn-text-hover-color-light',
      '--btn-text-hover-bg-light',
      '--btn-text-active-color-light',
      '--btn-text-active-bg-light',
      '--btn-text-color-dark',
      '--btn-text-bg-dark',
      '--btn-text-hover-color-dark',
      '--btn-text-hover-bg-dark',
      '--btn-text-active-color-dark',
      '--btn-text-active-bg-dark',
      '--radio-normal-color-light',
      '--radio-normal-bg-light',
      '--radio-normal-hover-color-light',
      '--radio-primary-color-light',
      '--radio-primary-bg-light',
      '--radio-primary-hover-bg-light',
      '--radio-primary-active-bg-light',
      '--radio-normal-color-dark',
      '--radio-normal-bg-dark',
      '--radio-normal-hover-color-dark',
      '--radio-primary-color-dark',
      '--radio-primary-bg-dark',
      '--radio-primary-hover-bg-dark',
      '--radio-primary-active-bg-dark',
      '--card-color-light',
      '--card-bg-light',
      '--card-hover-bg-light',
      '--card-active-bg-light',
      '--card-color-dark',
      '--card-bg-dark',
      '--card-hover-bg-dark',
      '--card-active-bg-dark',
      '--progress-bg-light',
      '--progress-inner-bg-light',
      '--progress-bg-dark',
      '--progress-inner-bg-dark',
      '--dropdown-bg-light',
      '--dropdown-bg-dark',
      '--modal-bg-light',
      '--modal-mask-bg-light',
      '--modal-bg-dark',
      '--modal-mask-bg-dark',
      '--switch-on-bg-light',
      '--switch-on-dot-bg-light',
      '--switch-on-bg-dark',
      '--switch-on-dot-bg-dark',
      '--switch-off-bg-light',
      '--switch-off-dot-bg-light',
      '--switch-off-bg-dark',
      '--switch-off-dot-bg-dark',
      '--input-color-light',
      '--input-bg-light',
      '--input-color-dark',
      '--input-bg-dark',
      '--color-picker-bg-light',
      '--color-picker-bg-dark',
      '--divider-color-light',
      '--divider-color-dark',
      '--select-color-light',
      '--select-bg-light',
      '--select-option-bg-light',
      '--select-color-dark',
      '--select-bg-dark',
      '--select-option-bg-dark',
      '--toast-bg-light',
      '--toast-bg-dark',
      '--menu-bg-light',
      '--menu-item-hover-light',
      '--menu-bg-dark',
      '--menu-item-hover-dark',
      '--table-tr-odd-bg-light',
      '--table-tr-even-bg-light',
      '--table-tr-odd-hover-bg-light',
      '--table-tr-even-hover-bg-light',
      '--table-tr-odd-bg-dark',
      '--table-tr-even-bg-dark',
      '--table-tr-odd-hover-bg-dark',
      '--table-tr-even-hover-bg-dark',
      '--level-0-color',
      '--level-1-color',
      '--level-2-color',
      '--level-3-color',
      '--level-4-color'
    ],
    BACKGROUND_LIST: [
      ['#00000000', 'none'],
      ['#FFDEE9', 'linear-gradient(0deg, #FFDEE9 0%, #B5FFFC 100%)'],
      ['#4158D0', 'linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)'],
      ['#0093E9', 'linear-gradient(160deg, #0093E9 0%, #80D0C7 100%)'],
      ['#8EC5FC', 'linear-gradient(62deg, #8EC5FC 0%, #E0C3FC 100%)'],
      ['#D9AFD9', 'linear-gradient(0deg, #D9AFD9 0%, #97D9E1 100%)'],
      ['#FFFFFF', 'linear-gradient(180deg, #FFFFFF 0%, #6284FF 50%, #FF0000 100%)'],
      ['#00DBDE', 'linear-gradient(90deg, #00DBDE 0%, #FC00FF 100%)'],
      ['#FBAB7E', 'linear-gradient(62deg, #FBAB7E 0%, #F7CE68 100%)'],
      ['#85FFBD', 'linear-gradient(45deg, #85FFBD 0%, #FFFB7D 100%)'],
      ['#8BC6EC', 'linear-gradient(135deg, #8BC6EC 0%, #9599E2 100%)'],
      ['#08AEEA', 'linear-gradient(0deg, #08AEEA 0%, #2AF598 100%)'],
      ['#52ACFF', 'linear-gradient(180deg, #52ACFF 25%, #FFE32C 100%)'],
      ['#FFE53B', 'linear-gradient(147deg, #FFE53B 0%, #FF2525 74%)'],
      ['#21D4FD', 'linear-gradient(19deg, #21D4FD 0%, #B721FF 100%)'],
      ['#3EECAC', 'linear-gradient(19deg, #3EECAC 0%, #EE74E1 100%)'],
      ['#FA8BFF', 'linear-gradient(45deg, #FA8BFF 0%, #2BD2FF 52%, #2BFF88 90%)'],
      ['#FF9A8B', 'linear-gradient(90deg, #FF9A8B 0%, #FF6A88 55%, #FF99AC 100%)'],
      ['#FBDA61', 'linear-gradient(45deg, #FBDA61 0%, #FF5ACD 100%)'],
      ['#F4D03F', 'linear-gradient(132deg, #F4D03F 0%, #16A085 100%)'],
      ['#A9C9FF', 'linear-gradient(180deg, #A9C9FF 0%, #FFBBEC 100%)'],
      ['#74EBD5', 'linear-gradient(90deg, #74EBD5 0%, #9FACE6 100%)'],
      ['#FAACA8', 'linear-gradient(19deg, #FAACA8 0%, #DDD6F3 100%)'],
      ['#FAD961', 'linear-gradient(90deg, #FAD961 0%, #F76B1C 100%)'],
      ['#FEE140', 'linear-gradient(90deg, #FEE140 0%, #FA709A 100%)'],
      ['#FF3CAC', 'linear-gradient(225deg, #FF3CAC 0%, #784BA0 50%, #2B86C5 100%)']
    ],
    OWNED_ICON_NAMES: ['tray_normal', 'tray_proxy', 'tray_tun'],
    ALLOWED_ICON_HOSTS: ['raw.githubusercontent.com', 'github.com'],
    IMAGE_FORMATS: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']
  }
}
// 使用CONSTANTS定义全局常量
const PATH = CONSTANTS.PATHS.THEME
const THEME_FILE = `${PATH}/singbox-themes.json`
const CUSTOM_CSS_NAME = 'custom.css'
const CUSTOM_CSS_FILE = CONSTANTS.PATHS.CUSTOM_CSS
const CUSTOM_BG_PREFIX = CONSTANTS.PATHS.CUSTOM_BG
const ICON_REPO_DIR = CONSTANTS.PATHS.ICON_REPO
const ICON_FACTORY_DIR = CONSTANTS.PATHS.ICON_FACTORY
const ICON_CACHE_DIR = CONSTANTS.PATHS.ICON_CACHE
const MAX_IMAGE_SIZE = CONSTANTS.LIMITS.MAX_IMAGE_SIZE
const ICON_MAX_FILE_SIZE = CONSTANTS.LIMITS.MAX_ICON_FILE_SIZE
const ICON_DOWNLOAD_TIMEOUT_SECONDS = CONSTANTS.LIMITS.ICON_DOWNLOAD_TIMEOUT
const ONLINE_IMAGE_TIMEOUT_SECONDS = CONSTANTS.LIMITS.ONLINE_IMAGE_TIMEOUT
const CONFIG_CACHE_TTL = CONSTANTS.LIMITS.CONFIG_CACHE_TTL
const ICON_PICK_SIZE = CONSTANTS.UI.ICON_PICK_SIZE
const ICON_PICK_GAP = CONSTANTS.UI.ICON_PICK_GAP

// 平台检测
const ICON_ENV = (() => {
  let combined = ''
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : {}
    combined = [nav.userAgent, nav.platform, nav.userAgentData?.platform].filter(Boolean).join(' ')
  } catch {}
  const isLinux = /linux/i.test(combined)
  return {
    isLinux,
    ext: isLinux ? '.png' : '.ico'
  }
})()

const ICON_EXT = ICON_ENV.ext
const ICON_TEMP_PREFIX = '.custom_icon_'
const VARIABLE_STYLE_ID = `${Plugin.id}_theme_variables`
const THEME_MODAL_STYLE_ID = `${Plugin.id}_theme_modal_style`
const CUSTOM_STYLE_ID = `${Plugin.id}_custom_css`
const FILE_SIZE_UNKNOWN = -1
const MAX_IMAGE_SIZE_MB = CONSTANTS.LIMITS.MAX_IMAGE_SIZE_MB
const BACKGROUND_VARIABLE_LIST = CONSTANTS.FEATURES.BACKGROUND_LIST
const FEATURES_IMAGE_FORMATS = CONSTANTS.FEATURES.IMAGE_FORMATS
const OWNED_ICON_NAMES = CONSTANTS.FEATURES.OWNED_ICON_NAMES
const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif'
}
const DEFAULT_CONFIG = {
  variable: {},
  backgroundIndex: 0,
  customBackground: '',
  customCSSPath: ''
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const errText = (error, fallback = '未知错误') => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error.trim()) return error
  if (isPlainObject(error) && typeof error.message === 'string' && error.message.trim()) return error.message
  return fallback
}
const confirmDialog = async (title, message) => {
  try {
    const result = await Plugins.confirm(title, message)
    return result !== false
  } catch {
    return false
  }
}
// 验证自定义背景路径
const isValidCustomBackgroundPath = (path) => {
  if (!path || typeof path !== 'string') return false
  // 检查路径格式是否正确
  return /^[^/\\:*?"<>|]+\.(jpg|jpeg|png|webp|gif|avif)$/i.test(path)
}

// 归一化背景索引
const normalizeBackgroundIndex = (index) => {
  if (typeof index !== 'number') return 0
  return Math.max(0, Math.min(index, BACKGROUND_VARIABLE_LIST.length - 1))
}
/*
 * 主题配置里只记录 custom.css 的「文件名」，不记录完整路径：
 * 目录由插件自身常量 PATH 决定，随环境变化（可移植目录 / 迁移）时
 * 配置不该携带可能失效的绝对路径。这里做归一化——
 * 剥掉任何目录部分只取文件名，非法值归一为空串（未设置）。
 * 历史遗留的完整路径会被自动收敛成文件名，不会丢记录。
 */
const normalizeCustomCSSPath = (value) => {
  if (typeof value !== 'string') return ''
  const name = value.trim().replace(/\\/g, '/').split('/').filter(Boolean).pop() || ''
  if (!name || name === '.' || name === '..') return ''
  return /^[^/\\:*?"<>|]+\.css$/i.test(name) ? name : ''
}
const normalizeConfig = (config) => {
  const safeConfig = isPlainObject(config) ? config : {}
  const normalizedVariable = {}

  for (const property of CONSTANTS.FEATURES.VARIABLE_LIST) {
    const value = safeConfig.variable?.[property]
    if (typeof value === 'string' && value.trim()) {
      normalizedVariable[property] = value.trim()
    }
  }
  const customBackground = isValidCustomBackgroundPath(safeConfig.customBackground) ? safeConfig.customBackground : ''
  /*
   * 记录 custom.css 的「文件名」，便于外部/宿主按主题配置定位自定义 CSS 文件。
   */
  const customCSSPath = normalizeCustomCSSPath(safeConfig.customCSSPath)
  // 删除历史 HTTPS 外链开关字段，避免继续持久化旧策略。
  const configWithoutLegacyExternalPolicy = { ...safeConfig }
  delete configWithoutLegacyExternalPolicy.allowExternalHttps
  return {
    ...configWithoutLegacyExternalPolicy,
    variable: normalizedVariable,
    backgroundIndex: normalizeBackgroundIndex(safeConfig.backgroundIndex),
    customBackground,
    customCSSPath
  }
}
const parseConfigText = (raw) => {
  if (typeof raw !== 'string' || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    return isPlainObject(parsed) ? normalizeConfig(parsed) : null
  } catch {
    return null
  }
}
let configCache = null
let configCacheTime = 0

const getCachedConfig = async () => {
  const now = Date.now()
  if (configCache && now - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache
  }

  try {
    const raw = await Plugins.ReadFile(THEME_FILE)
    const parsed = parseConfigText(raw)
    configCache = parsed || normalizeConfig(DEFAULT_CONFIG)
    configCacheTime = now
    return configCache
  } catch (error) {
    console.warn('[CustomTheme] 读取配置失败，使用缓存或默认:', error)
    return configCache || normalizeConfig(DEFAULT_CONFIG)
  }
}
const saveConfig = async (config) => {
  const content = JSON.stringify(config, null, 2)
  if (!parseConfigText(content)) {
    throw new Error('配置序列化校验失败')
  }
  await atomicWriteFile(THEME_FILE, content)
  configCache = config // 更新缓存
  configCacheTime = Date.now()
  return config
}
/*
 * 说明：GUI.for.SingBox 宿主并不提供 enqueueThemeOperation，这里自行实现一个自包含的
 * 「主题操作串行队列 + 取消令牌」，使插件不依赖任何外部运行时即可运行。
 * 取消语义由 runtimeGeneration / runtimeActive 驱动：
 *   - beginRuntime()      开启一个有效运行时（仅置 runtimeActive = true，不递增 generation）
 *   - invalidateRuntime() （cleanupRuntime 在禁用 / 关闭 / 卸载时调用）使所有旧任务立即失效
 *   - 每个操作在入队时捕获当前 generation，运行期通过 ctx.assertActive() / ctx.isActive() 校验
 */
const createCancelledError = () => {
  const error = new Error('OPERATION_CANCELLED')
  error.cancelled = true
  return error
}
// 统一的运行时检查函数
const checkRuntime = (context = 'Operation', generation = runtimeGeneration) => {
  if (!runtimeActive || generation !== runtimeGeneration) {
    console.warn(`[${context}] 运行时已失效`)
    throw createCancelledError()
  }
}
/*
 * 一次性迁移：把存量配置里遗留的「完整路径」改写成「文件名」。
 * normalizeConfig 只在读取时于内存里归一，不会回写磁盘，
 * 所以老配置（如 data/third/custom-singbox-theme/custom.css）
 * 必须显式改写一次，否则 singbox-themes.json 里会一直是完整路径。
 * 采用「原地改写 + 保留未知字段」，避免丢掉未来新增或宿主写入的其它键。
 */
let configMigrated = false
const migrateStoredConfig = async () => {
  if (configMigrated) return
  try {
    const raw = await Plugins.ReadFile(THEME_FILE)
    if (typeof raw !== 'string' || !raw.trim()) {
      configMigrated = true
      return
    }
    const parsed = JSON.parse(raw)
    if (!isPlainObject(parsed)) {
      configMigrated = true
      return
    }
    const normalizedCSSPath = normalizeCustomCSSPath(parsed.customCSSPath)
    if (parsed.customCSSPath === normalizedCSSPath) {
      configMigrated = true
      return
    }
    const next = {
      ...parsed,
      customCSSPath: normalizedCSSPath
    }
    await atomicWriteFile(THEME_FILE, JSON.stringify(next, null, 2))
    configMigrated = true
    console.log(`[CustomTheme] 已迁移主题配置：customCSSPath "${parsed.customCSSPath}" -> "${normalizedCSSPath}"`)
  } catch (error) {
    console.warn('[CustomTheme] 迁移主题配置失败（下次继续重试）:', error)
  }
}
const safeRemoveFile = async (path) => {
  try {
    await Plugins.RemoveFile(path)
    return true
  } catch (error) {
    console.warn('[CustomTheme] 删除文件失败:', path, error)
    return false
  }
}
const removeFileOrThrow = async (path) => {
  const ok = await safeRemoveFile(path)
  if (!ok) {
    throw new Error(`删除文件失败：${path}`)
  }
}
/* 使用宿主正式暴露的文件系统 API，不再维护旧版 ReadDir / Stat 兼容层。 */
const getDirEntries = async (dirPath) => {
  try {
    const entries = await Plugins.ReadDir(dirPath)
    return Array.isArray(entries) ? entries : []
  } catch {
    return []
  }
}
const fileExists = (path) => Plugins.FileExists(path)
const removeAllCustomBackgroundsStrict = async () => {
  for (const extension of FEATURES_IMAGE_FORMATS) {
    await removeFileOrThrow(`${CUSTOM_BG_PREFIX}${extension}`)
  }
}
const getTempFilePath = (prefix = 'temp') => {
  const timestamp = Date.now()
  const random = Math.random().toString(36).slice(2, 10)
  return `data/.cache/.custom-singbox-${prefix}_${timestamp}_${random}.tmp`
}
const cleanupPluginTempFiles = async () => {
  try {
    const cacheEntries = await getDirEntries('data/.cache')
    for (const entry of cacheEntries) {
      const name = entry.name
      if (typeof name !== 'string') continue
      if (name.startsWith('.custom-singbox-') && name.endsWith('.tmp')) {
        await safeRemoveFile(`data/.cache/${name}`)
      }
    }
    // atomicWriteFile 的 .new/.bak 与正式文件同目录，因此位于 PATH。
    // 这里只清理插件自己的两个正式文件；BackgroundTX 专用 .bak
    // 仍由 journal/recovery 管理，避免误删可恢复事务备份。
    const pluginEntries = await getDirEntries(PATH)
    for (const entry of pluginEntries) {
      const name = entry.name
      if (name === 'singbox-themes.json.new' || name === 'singbox-themes.json.bak' || name === `${CUSTOM_CSS_NAME}.new` || name === `${CUSTOM_CSS_NAME}.bak`) {
        await safeRemoveFile(`${PATH}/${name}`)
      }
    }
  } catch (error) {
    console.warn('[CustomTheme] 清理临时文件失败:', error)
  }
}
const getOwnedIconPaths = () => OWNED_ICON_NAMES.flatMap((name) => [`${ICON_CACHE_DIR}/${name}_dark${ICON_EXT}`, `${ICON_CACHE_DIR}/${name}_light${ICON_EXT}`])
const saveCustomCSSText = async (css) => {
  const normalized = typeof css === 'string' ? css : ''

  const currentConfig = await getCachedConfig()
  const nextCSSPath = normalized.trim() ? CUSTOM_CSS_NAME : ''
  const nextConfig = normalizeConfig({
    ...currentConfig,
    customCSSPath: nextCSSPath
  })

  // 在写入前保留旧 CSS；如果配置提交失败，尽量回滚 CSS，避免“CSS 已保存但策略仍旧”的不一致。
  let previousCSS = ''
  try {
    const rawPreviousCSS = await Plugins.ReadFile(CUSTOM_CSS_FILE)
    previousCSS = typeof rawPreviousCSS === 'string' ? rawPreviousCSS : ''
  } catch {}

  await atomicWriteFile(CUSTOM_CSS_FILE, normalized)
  /*
   * 把 custom.css 的「文件名」同步写回主题配置 singbox-themes.json，
   * 便于外部/宿主按配置定位自定义 CSS 文件（目录由插件 PATH 决定，不入配置）。
   * CSS 有内容时记录文件名，被清空时移除记录；同步失败不影响 CSS 已写入的结果。
   */
  try {
    await saveConfig(nextConfig)
  } catch (error) {
    try {
      await atomicWriteFile(CUSTOM_CSS_FILE, previousCSS)
    } catch (rollbackError) {
      console.error('[CustomTheme] CSS 回滚失败:', rollbackError)
    }
    throw error
  }
  return normalized
}
const cleanupIconTempFiles = async () => {
  try {
    const entries = await Plugins.ReadDir(ICON_CACHE_DIR)
    for (const entry of entries || []) {
      const name = entry?.name
      if (typeof name !== 'string') continue
      if (name.startsWith(ICON_TEMP_PREFIX) && (name.endsWith('.tmp') || name.endsWith('.next') || name.endsWith('.bak'))) {
        await safeRemoveFile(`${ICON_CACHE_DIR}/${name}`)
      }
    }
  } catch (error) {
    console.warn('[CustomIcon] 清理临时图标失败:', error)
  }
}
const getFactoryIconPath = (finalPath) => `${ICON_FACTORY_DIR}/${String(finalPath).split('/').pop()}`
const ensureFactoryIconBackup = async () => {
  let backed = 0
  for (const finalPath of getOwnedIconPaths()) {
    const backupPath = getFactoryIconPath(finalPath)
    if (await fileExists(backupPath)) continue
    if (!(await fileExists(finalPath))) continue
    try {
      await Plugins.CopyFile(finalPath, backupPath)
      backed++
    } catch (error) {
      console.warn('[CustomIcon] 原厂图标备份失败:', finalPath, error)
    }
  }
  return backed
}
const resetOwnedIcons = async () => {
  const restored = []
  const pending = []
  for (const finalPath of getOwnedIconPaths()) {
    const backupPath = getFactoryIconPath(finalPath)
    if (await fileExists(backupPath)) {
      try {
        await safeRemoveFile(finalPath)
        await Plugins.CopyFile(backupPath, finalPath)
        restored.push(finalPath)
        continue
      } catch (error) {
        console.error('[CustomIcon] 恢复原厂图标失败:', finalPath, error)
      }
    }
    await safeRemoveFile(finalPath)
    pending.push(finalPath)
  }
  return { restored, pending }
}
const getIconTransactionBackupPath = (finalPath, token) => {
  return `${ICON_CACHE_DIR}/${ICON_TEMP_PREFIX}${token}_${String(finalPath).split('/').pop()}.bak`
}
const installOwnedIcons = async (staged, token) => {
  const nextPaths = []
  const backups = []
  /*
   * --------------------------------------------------
   * 阶段 1：准备 .next
   * --------------------------------------------------
   */
  try {
    for (const item of staged) {
      for (const finalPath of [item.darkPath, item.lightPath]) {
        const nextPath = `${finalPath}.next`
        await safeRemoveFile(nextPath)
        await Plugins.CopyFile(item.sourceTemp, nextPath)
        nextPaths.push({
          finalPath,
          nextPath
        })
      }
    }
  } catch (error) {
    for (const item of nextPaths) {
      await safeRemoveFile(item.nextPath)
    }
    throw error
  }
  /*
   * --------------------------------------------------
   * 阶段 2：保存“当前状态”事务备份
   *
   * 注意：
   * 这里备份的是用户当前正在使用的图标，
   * 不是 factory。
   * --------------------------------------------------
   */
  try {
    for (const item of nextPaths) {
      const backupPath = getIconTransactionBackupPath(item.finalPath, token)
      await safeRemoveFile(backupPath)
      if (await fileExists(item.finalPath)) {
        await Plugins.CopyFile(item.finalPath, backupPath)
        backups.push({
          finalPath: item.finalPath,
          backupPath
        })
      } else {
        backups.push({
          finalPath: item.finalPath,
          backupPath: null
        })
      }
    }
  } catch (error) {
    for (const item of nextPaths) {
      await safeRemoveFile(item.nextPath)
    }
    for (const item of backups) {
      if (item.backupPath) {
        await safeRemoveFile(item.backupPath)
      }
    }
    throw error
  }
  /*
   * --------------------------------------------------
   * 阶段 3：正式提交
   * --------------------------------------------------
   */
  try {
    for (const item of nextPaths) {
      await atomicMoveFile(item.nextPath, item.finalPath)
    }
  } catch (error) {
    /*
     * ------------------------------------------------
     * 阶段 4：失败 → 恢复事务前状态
     * ------------------------------------------------
     */
    for (const item of backups) {
      try {
        if (item.backupPath && (await fileExists(item.backupPath))) {
          await safeRemoveFile(item.finalPath)
          await Plugins.CopyFile(item.backupPath, item.finalPath)
        } else {
          await safeRemoveFile(item.finalPath)
        }
      } catch (restoreError) {
        console.error('[CustomIcon] 事务回滚失败:', item.finalPath, restoreError)
      }
    }
    for (const item of nextPaths) {
      await safeRemoveFile(item.nextPath)
    }
    for (const item of backups) {
      if (item.backupPath) {
        await safeRemoveFile(item.backupPath)
      }
    }
    throw error
  }
  /*
   * --------------------------------------------------
   * 阶段 5：提交成功 → 删除事务备份
   * --------------------------------------------------
   */
  for (const item of backups) {
    if (item.backupPath) {
      await safeRemoveFile(item.backupPath)
    }
  }
  return staged.length
}
const purgeLegacyFiles = async () => {
  for (const extension of FEATURES_IMAGE_FORMATS) await safeRemoveFile(`${CUSTOM_BG_PREFIX}${extension}.bak`)
  try {
    const entries = await Plugins.ReadDir(PATH)
    for (const entry of entries || []) {
      const name = entry?.name
      if (typeof name !== 'string') continue
      // 替换原有的 name.includes('_transaction.json')
      // 改为精确匹配旧版本遗留的特定前缀文件
      if (/^\.?custom.*(background|icon)_transaction\.json$/.test(name) || /^custom_bg\.(jpe?g|png|webp|gif|avif)\.bak$/i.test(name)) {
        await safeRemoveFile(`${PATH}/${name}`)
      }
    }
  } catch {}
  try {
    const entries = await Plugins.ReadDir(ICON_CACHE_DIR)
    for (const entry of entries || []) {
      const name = entry?.name
      if (typeof name !== 'string') continue
      if (name.includes('_transaction.json') || /^tray_(normal|proxy|tun)_(dark|light)\.(ico|png)\.bak$/i.test(name)) {
        await safeRemoveFile(`${ICON_CACHE_DIR}/${name}`)
      }
    }
  } catch {}
}
const cleanupOrphanBackgroundTransactionFiles = async () => {
  try {
    const entries = await getDirEntries('data/.cache')
    const journalTokens = new Set()
    for (const entry of entries) {
      const name = entry.name
      if (typeof name === 'string' && name.startsWith(BACKGROUND_TX_PREFIX) && name.endsWith('.json')) {
        const token = name.slice(BACKGROUND_TX_PREFIX.length, -5)
        if (token) {
          journalTokens.add(token)
        }
      }
    }
    for (const entry of entries) {
      const name = entry.name
      if (typeof name !== 'string' || !name.startsWith(BACKGROUND_TX_PREFIX) || !name.endsWith('.bak')) {
        continue
      }
      const body = name.slice(BACKGROUND_TX_PREFIX.length, -4)
      const matchedToken = Array.from(journalTokens).some((token) => body === token || body.startsWith(`${token}_`))
      /*
       * 只有确定不存在对应 journal
       * 才允许删除 backup。
       */
      if (!matchedToken) {
        await safeRemoveFile(`data/.cache/${name}`)
      }
    }
  } catch (error) {
    console.warn('[BackgroundTX] 清理孤儿事务备份失败:', error)
  }
}
const ensurePluginDirectories = async () => {
  const directories = [CONSTANTS.PATHS.CACHE, PATH, ICON_REPO_DIR, ICON_FACTORY_DIR, ICON_CACHE_DIR]

  for (const dir of directories) {
    if (!(await Plugins.FileExists(dir))) {
      await Plugins.MakeDir(dir)
    }
  }
}
const startup = async () => {
  await ensurePluginDirectories()
  /*
   * 必须最先恢复未完成背景事务。
   *
   * 不能把 recovery 放到 purge 后面，
   * 否则未来 purge 规则可能误删事务文件。
   */
  await recoverBackgroundTransactions()
  await cleanupOrphanBackgroundTransactionFiles()
  await purgeLegacyFiles()
  await cleanupIconTempFiles()
  await cleanupPluginTempFiles()
}
const readFilePrefix = async (path, bytes = 128) => {
  const maxChars = Math.ceil(bytes / 3) * 4 + 8
  try {
    const text = await Plugins.ReadFile(path, { Mode: 'Binary', Range: `0-${bytes - 1}` })
    // 如果返回长度远超预期，说明宿主不支持 Range 且 fallback 到了全量读取
    // 此时直接截断或放弃，绝不处理 30MB 的字符串
    if (typeof text === 'string' && text.length > 0) {
      if (text.length <= maxChars) return text
      // 宿主不支持 Range，返回前 128 字符用于魔数检测即可
      return text.substring(0, bytes)
    }
  } catch {}
  return ''
}
const validateStoredBackgroundFile = async (path, knownSize = -1) => {
  try {
    const size = knownSize >= 0 ? knownSize : await getFileSize(path)
    if (size <= 0 || size > MAX_IMAGE_SIZE) return false
    const prefixBase64 = await readFilePrefix(path, 128)
    if (typeof prefixBase64 !== 'string' || !prefixBase64) return false
    return !!detectImageFormat(prefixBase64)
  } catch {
    return false
  }
}
const base64ByteSize = (base64) => {
  if (typeof base64 !== 'string' || !base64) return 0
  const normalized = base64.trim()
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return 0
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.floor(normalized.length / 4) * 3 - padding
}
const getFileSize = async (path) => {
  const separatorIndex = path.lastIndexOf('/')
  const dirPath = separatorIndex < 0 ? '.' : path.substring(0, separatorIndex)
  const fileName = path.substring(separatorIndex + 1)
  const entries = await getDirEntries(dirPath)
  const entry = entries.find((item) => item?.name === fileName)
  return typeof entry?.size === 'number' ? entry.size : FILE_SIZE_UNKNOWN
}
const getImageExtension = (file) => {
  if (!file) return ''
  const name = file.name || ''
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex >= 0) {
    const extension = name.substring(dotIndex).toLowerCase()
    if (FEATURES_IMAGE_FORMATS.includes(extension)) return extension
  }
  const mimeExtension = MIME_TO_EXTENSION[file.type]
  if (mimeExtension) return mimeExtension
  return ''
}
const validateImageFile = (file) => {
  if (!file) throw new Error('未选择图片')
  if (file.size <= 0) throw new Error('图片文件为空')
  if (file.size > MAX_IMAGE_SIZE) throw new Error(`图片不能大于 ${MAX_IMAGE_SIZE_MB}MB`)
  const extension = getImageExtension(file)
  if (!extension) throw new Error('仅支持 JPG、JPEG、PNG、WEBP、GIF、AVIF')
  return extension
}
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const result = reader.result
        if (typeof result !== 'string') {
          reject(new Error('图片读取失败'))
          return
        }
        const commaIndex = result.indexOf(',')
        if (commaIndex < 0) {
          reject(new Error('图片数据格式错误'))
          return
        }
        resolve(result.substring(commaIndex + 1))
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('FileReader 读取失败'))
    reader.readAsDataURL(file)
  })
}
/*
 * 【注意】atob 会生成与原 base64 等长的巨大字符串。
 * 对于 30MB 的图片，此处会有约 30MB 的瞬时内存峰值。
 * 在 WebView 环境中这是标准做法，但应避免在循环中并发调用此函数。
 */
const base64ToBlob = (base64, mimeType) => {
  try {
    if (typeof base64 !== 'string' || !base64) return null
    let cleanBase64 = base64
    if (/\s/.test(cleanBase64)) cleanBase64 = cleanBase64.replace(/\s/g, '')
    if (cleanBase64.length % 4 !== 0) return null
    const chunkSize = 0x8000 // 32KB，32KB % 4 === 0，分块边界天然对齐
    const chunks = []
    for (let i = 0; i < cleanBase64.length; i += chunkSize) {
      const binary = atob(cleanBase64.substring(i, Math.min(i + chunkSize, cleanBase64.length)))
      const bytes = new Uint8Array(binary.length)
      for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
      chunks.push(bytes)
    }
    return new Blob(chunks, { type: mimeType || 'application/octet-stream' })
  } catch (error) {
    console.error('[CustomTheme] Base64 转 Blob 失败:', error)
    return null
  }
}
const BASE64_PREFIX_CHARS = 128
const decodeBase64Prefix = (base64) => {
  if (typeof base64 !== 'string' || !base64) return new Uint8Array(0)
  try {
    let prefix = base64.substring(0, BASE64_PREFIX_CHARS)
    const mod = prefix.length % 4
    if (mod > 0) prefix += '='.repeat(4 - mod)
    const binary = atob(prefix)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch (error) {
    console.warn('[CustomTheme] Base64 前缀解码失败:', error)
    return new Uint8Array(0)
  }
}
const readAscii = (bytes, start, length) => {
  let result = ''
  for (let index = start; index < start + length && index < bytes.length; index++) result += String.fromCharCode(bytes[index])
  return result
}
const detectImageFormat = (base64) => {
  try {
    const bytes = decodeBase64Prefix(base64)
    if (bytes.length === 0) return null
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: '.jpg', mimeType: 'image/jpeg' }
    if (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
      return { extension: '.png', mimeType: 'image/png' }
    if (bytes.length >= 6 && (readAscii(bytes, 0, 6) === 'GIF87a' || readAscii(bytes, 0, 6) === 'GIF89a')) return { extension: '.gif', mimeType: 'image/gif' }
    if (bytes.length >= 12 && readAscii(bytes, 0, 4) === 'RIFF' && readAscii(bytes, 8, 4) === 'WEBP') return { extension: '.webp', mimeType: 'image/webp' }
    if (bytes.length >= 16 && readAscii(bytes, 4, 4) === 'ftyp') {
      const scanLength = Math.min(bytes.length, 64)
      for (let index = 8; index + 4 <= scanLength; index += 4) {
        if (index === 12) continue // 跳过 Minor Version (Offset 12-15)
        const brand = readAscii(bytes, index, 4)
        if (brand === 'avif' || brand === 'avis') return { extension: '.avif', mimeType: 'image/avif' }
      }
    }
    return null
  } catch (error) {
    console.warn('[CustomTheme] 图片格式检测失败:', error)
    return null
  }
}
let currentBgObjectUrl = null
let backgroundMutationVersion = 0
const markBackgroundMutation = () => {
  backgroundMutationVersion++
  return backgroundMutationVersion
}
const releaseBackgroundObjectUrl = () => {
  if (!currentBgObjectUrl) return
  try {
    URL.revokeObjectURL(currentBgObjectUrl)
  } catch (error) {
    console.warn('[CustomTheme] revokeObjectURL failed:', error)
  }
  currentBgObjectUrl = null
}
const applyBackgroundObjectUrl = (objectUrl) => {
  if (typeof objectUrl !== 'string' || !objectUrl) return false
  releaseBackgroundObjectUrl()
  currentBgObjectUrl = objectUrl
  return setTemporaryBackgroundImage(objectUrl)
}
/*
 * 预设背景只改变 backgroundColor / backgroundImage，
 * 其余背景属性必须清空：否则自定义图片留下的 cover / center 等设置会污染渐变背景。
 */
const resetBodySecondaryBackgroundProps = () => {
  document.body.style.backgroundSize = ''
  document.body.style.backgroundPosition = ''
  document.body.style.backgroundRepeat = ''
  document.body.style.backgroundAttachment = ''
}
const applyPresetBackgroundStyle = (index) => {
  const normalizedIndex = normalizeBackgroundIndex(index)
  const [color = '', gradientImage = ''] = BACKGROUND_VARIABLE_LIST[normalizedIndex] || BACKGROUND_VARIABLE_LIST[0]
  document.body.style.backgroundColor = color
  document.body.style.backgroundImage = gradientImage
  resetBodySecondaryBackgroundProps()
  markBackgroundMutation()
  return normalizedIndex
}
const applyPresetBackground = (index) => {
  releaseBackgroundObjectUrl()
  return applyPresetBackgroundStyle(index)
}
const previewPresetBackground = applyPresetBackgroundStyle
const clearBackgroundImage = () => {
  releaseBackgroundObjectUrl()
  document.body.style.backgroundColor = ''
  document.body.style.backgroundImage = ''
  resetBodySecondaryBackgroundProps()
  markBackgroundMutation()
}
const captureBackgroundState = () => {
  return {
    version: backgroundMutationVersion,
    styles: {
      backgroundColor: document.body.style.backgroundColor,
      backgroundImage: document.body.style.backgroundImage,
      backgroundSize: document.body.style.backgroundSize,
      backgroundPosition: document.body.style.backgroundPosition,
      backgroundRepeat: document.body.style.backgroundRepeat,
      backgroundAttachment: document.body.style.backgroundAttachment
    },
    objectUrl: currentBgObjectUrl
  }
}
const restoreBackgroundState = (state, expectedVersion = null) => {
  if (!state) {
    clearBackgroundImage()
    return true
  }
  if (expectedVersion !== null && backgroundMutationVersion !== expectedVersion) {
    return false
  }
  const previousCurrentUrl = currentBgObjectUrl
  const targetUrl = state.objectUrl || null
  if (previousCurrentUrl && previousCurrentUrl !== targetUrl) {
    try {
      URL.revokeObjectURL(previousCurrentUrl)
    } catch {}
  }
  Object.assign(document.body.style, state.styles)
  currentBgObjectUrl = targetUrl
  backgroundMutationVersion++
  return true
}
const setTemporaryBackgroundImage = (objectUrl) => {
  if (typeof objectUrl !== 'string' || !objectUrl) return false
  document.body.style.backgroundColor = 'transparent'
  document.body.style.backgroundImage = `url("${objectUrl}")`
  document.body.style.backgroundSize = 'cover'
  document.body.style.backgroundPosition = 'center center'
  document.body.style.backgroundRepeat = 'no-repeat'
  document.body.style.backgroundAttachment = 'fixed'
  markBackgroundMutation()
  return true
}
const loadCustomBackground = async (config) => {
  const relativePath = config?.customBackground
  if (!isValidCustomBackgroundPath(relativePath)) return null
  const filePath = `${PATH}/${relativePath}`
  const extension = relativePath.substring(relativePath.lastIndexOf('.')).toLowerCase()
  try {
    const base64 = await Plugins.ReadFile(filePath, { Mode: 'Binary' })
    if (typeof base64 !== 'string' || !base64) return null
    const detected = detectImageFormat(base64)
    if (!detected) return null
    if (detected.extension !== (extension === '.jpeg' ? '.jpg' : extension)) return null
    const blobSize = base64ByteSize(base64)
    if (blobSize <= 0 || blobSize > MAX_IMAGE_SIZE) return null
    const blob = base64ToBlob(base64, detected.mimeType)
    if (!blob || blob.size !== blobSize) return null
    const objectUrl = URL.createObjectURL(blob)
    return { objectUrl, filePath, extension, mimeType: detected.mimeType }
  } catch (error) {
    console.warn('[CustomTheme] 加载自定义背景失败:', error)
    return null
  }
}
const setBackground = async (config, ctx = null) => {
  ctx?.assertActive()
  const normalized = config // 直接使用配置，减少normalize调用
  if (normalized.customBackground) {
    const filePath = `${PATH}/${normalized.customBackground}`
    const loaded = await loadCustomBackground(normalized)
    if (ctx && !ctx.isActive()) {
      if (loaded?.objectUrl) {
        try {
          URL.revokeObjectURL(loaded.objectUrl)
        } catch {}
      }
      throw createCancelledError()
    }
    if (loaded?.objectUrl) {
      applyBackgroundObjectUrl(loaded.objectUrl)
      return true
    }
    if (!(await fileExists(filePath))) {
      const repaired = { ...normalized, customBackground: '' }
      try {
        await saveConfig(repaired)
      } catch (error) {
        console.warn('[CustomTheme] 清理缺失背景配置失败:', error)
        return false
      }
      applyPresetBackground(repaired.backgroundIndex)
      return true
    }
    console.warn('[CustomTheme] 自定义背景文件存在但无法加载，保持当前背景与配置不变')
    return false
  }
  ctx?.assertActive()
  applyPresetBackground(normalized.backgroundIndex)
  return true
}
/* 【P0 修复】可回滚文件写入：先写 .new，再备份 .bak，最后替换；优先 MoveFile，失败时降级 CopyFile。 */
const atomicWriteFile = async (targetPath, contentOrSource, isBinary = false) => {
  const newPath = `${targetPath}.new`
  const bakPath = `${targetPath}.bak`
  try {
    // 1. 写入临时 .new 文件
    if (isBinary) {
      await Plugins.WriteFile(newPath, contentOrSource, { Mode: 'Binary' })
    } else {
      await Plugins.WriteFile(newPath, contentOrSource)
    }
    // 2. 备份旧文件 (如果存在)
    if (await fileExists(targetPath)) {
      await Plugins.CopyFile(targetPath, bakPath)
    }
    // 3. 原子替换 (MoveFile 通常在同一文件系统下是原子的)
    // 如果宿主 MoveFile 不支持覆盖，这里可能会报错，需要捕获
    try {
      await Plugins.MoveFile(newPath, targetPath)
    } catch (moveErr) {
      // 如果 Move 失败，尝试 Copy + Remove
      await Plugins.CopyFile(newPath, targetPath)
    }
    // 4. 清理备份和临时文件
    await safeRemoveFile(bakPath)
    await safeRemoveFile(newPath)
    return true
  } catch (error) {
    console.error('[AtomicWrite] 失败，尝试回滚:', error)
    if (await fileExists(bakPath)) {
      try {
        await Plugins.CopyFile(bakPath, targetPath)
      } catch {}
    }
    await safeRemoveFile(newPath)
    await safeRemoveFile(bakPath)
    throw error
  }
}
/* 【P0 修复】可回滚文件替换 (用于图片保存)：优先 MoveFile，失败时降级 CopyFile。 */
const atomicMoveFile = async (sourcePath, targetPath) => {
  const bakPath = `${targetPath}.bak`
  try {
    if (await fileExists(targetPath)) {
      await Plugins.CopyFile(targetPath, bakPath)
    }
    try {
      await Plugins.MoveFile(sourcePath, targetPath)
    } catch {
      await Plugins.CopyFile(sourcePath, targetPath)
      // CopyFile 不是原子移动，成功后必须清理源文件，避免 .next/.tmp 残留。
      await safeRemoveFile(sourcePath)
    }
    await safeRemoveFile(bakPath)
    return true
  } catch (error) {
    if (await fileExists(bakPath)) {
      try {
        await Plugins.CopyFile(bakPath, targetPath)
      } catch {}
    }
    await safeRemoveFile(bakPath)
    throw error
  }
}
/* =========================================================
 * Background Transaction
 *
 * 负责：
 * 1. themes.json
 * 2. custom_bg.*
 *
 * 实现：
 * - snapshot：事务开始前备份旧状态
 * - journal：记录事务是否完成
 * - rollback：失败/异常恢复
 * - startup recovery：程序下次启动自动恢复未完成事务
 *
 * 注意：
 * 这是跨多个文件的“可恢复事务”，
 * 不是文件系统层面的真正 ACID 事务。
 * ========================================================= */
const BACKGROUND_TX_PREFIX = '.custom-singbox-bg-tx-'
const BACKGROUND_TX_VERSION = 1
const getBackgroundTransactionToken = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
const getBackgroundTransactionJournalPath = (token) => `data/.cache/${BACKGROUND_TX_PREFIX}${token}.json`
const getBackgroundTransactionBackupPath = (token, name) => `data/.cache/${BACKGROUND_TX_PREFIX}${token}_${name}.bak`
const getBackgroundSnapshotTargets = (extraTargets = []) => {
  const targets = [
    {
      path: THEME_FILE,
      name: 'singbox-themes.json'
    },
    ...FEATURES_IMAGE_FORMATS.map((extension) => ({
      path: `${CUSTOM_BG_PREFIX}${extension}`,
      name: `custom_bg${extension}`
    })),
    ...extraTargets
  ]
  const seen = new Set()
  return targets.filter((item) => {
    if (seen.has(item.path)) {
      return false
    }
    seen.add(item.path)
    return true
  })
}
const cleanupBackgroundTransactionFiles = async (transaction) => {
  if (!transaction) return
  try {
    if (transaction.journalPath) {
      await safeRemoveFile(transaction.journalPath)
    }
  } catch {}
  for (const item of transaction.targets || []) {
    if (item.backupPath) {
      await safeRemoveFile(item.backupPath)
    }
  }
  /*
   * 即使 targets 不完整，也根据 token 再做一次兜底清理。
   */
  if (transaction.token) {
    try {
      const entries = await getDirEntries('data/.cache')
      for (const entry of entries) {
        const name = entry.name
        if (typeof name === 'string' && name.startsWith(`${BACKGROUND_TX_PREFIX}${transaction.token}_`) && name.endsWith('.bak')) {
          await safeRemoveFile(`data/.cache/${name}`)
        }
      }
    } catch {}
  }
}
const snapshotBackgroundState = async (token, extraTargets = []) => {
  const targets = []
  const sourceTargets = getBackgroundSnapshotTargets(extraTargets)
  try {
    for (const target of sourceTargets) {
      const existed = await fileExists(target.path)
      const backupPath = existed ? getBackgroundTransactionBackupPath(token, target.name) : null
      if (existed) {
        await safeRemoveFile(backupPath)
        await Plugins.CopyFile(target.path, backupPath)
        /*
         * 备份后再次检查，避免 CopyFile 表面成功但结果异常。
         */
        if (!(await fileExists(backupPath))) {
          throw new Error(`事务备份失败：${target.path}`)
        }
      }
      targets.push({
        path: target.path,
        name: target.name,
        existed,
        backupPath
      })
    }
    return targets
  } catch (error) {
    /*
     * snapshot 阶段失败：
     * 事务尚未建立 journal，
     * 所以只需要清理已经生成的备份。
     */
    for (const item of targets) {
      if (item.backupPath) {
        await safeRemoveFile(item.backupPath)
      }
    }
    throw error
  }
}
const restoreBackgroundSnapshot = async (transaction) => {
  if (!transaction?.targets) {
    throw new Error('事务快照不存在')
  }
  const errors = []
  /*
   * 1. 先删除当前文件
   */
  for (const item of transaction.targets) {
    try {
      const removed = await safeRemoveFile(item.path)
      if (!removed && (await fileExists(item.path))) {
        errors.push(`${item.path}: 删除当前文件失败`)
      }
    } catch (error) {}
  }
  /*
   * 2. 恢复事务开始前的文件
   */
  for (const item of transaction.targets) {
    if (!item.existed || !item.backupPath) continue
    try {
      if (!(await fileExists(item.backupPath))) {
        throw new Error('事务备份文件不存在')
      }
      await Plugins.CopyFile(item.backupPath, item.path)
    } catch (error) {
      errors.push(`${item.path}: 恢复失败：${errText(error)}`)
    }
  }
  if (errors.length) {
    throw new Error(`背景事务回滚失败：\n${errors.join('\n')}`)
  }
  return true
}
const beginBackgroundTransaction = async (extraTargets = []) => {
  const token = getBackgroundTransactionToken()
  const journalPath = getBackgroundTransactionJournalPath(token)
  const targets = await snapshotBackgroundState(token, extraTargets)
  /*
   * 阶段 2：
   * 所有 backup 都成功以后，才建立 prepared journal。
   */
  const transaction = {
    version: BACKGROUND_TX_VERSION,
    token,
    journalPath,
    phase: 'prepared',
    targets
  }
  try {
    await atomicWriteFile(journalPath, JSON.stringify(transaction, null, 2))
  } catch (error) {
    await cleanupBackgroundTransactionFiles({
      ...transaction,
      targets
    })
    throw error
  }
  return transaction
}
const markBackgroundTransactionCommitted = async (transaction) => {
  const committed = {
    ...transaction,
    phase: 'committed'
  }
  await atomicWriteFile(transaction.journalPath, JSON.stringify(committed, null, 2))
  return committed
}
const executeBackgroundTransaction = async (mutate, options = {}) => {
  const transaction = await beginBackgroundTransaction(options.extraTargets || [])
  try {
    await mutate(transaction)
    const committed = await markBackgroundTransactionCommitted(transaction)
    await cleanupBackgroundTransactionFiles(committed)
    return true
  } catch (error) {
    let rollbackSucceeded = false
    try {
      await restoreBackgroundSnapshot(transaction)
      rollbackSucceeded = true
    } catch (rollbackError) {
      console.error('[BackgroundTX] 回滚失败，保留 journal 供下次启动继续恢复:', rollbackError)
    }
    if (rollbackSucceeded) {
      await cleanupBackgroundTransactionFiles(transaction)
    }
    throw error
  }
}
/*
 * ---------------------------------------------------------
 * 启动恢复
 *
 * prepared → 说明上次程序崩溃/异常中断：
 *              必须 rollback
 *
 * committed → 说明数据已经完整提交：
 *              只需要清理残留 backup/journal
 * ---------------------------------------------------------
 */
const recoverBackgroundTransactions = async () => {
  try {
    const entries = await getDirEntries('data/.cache')
    const journals = entries.filter((entry) => typeof entry.name === 'string' && entry.name.startsWith(BACKGROUND_TX_PREFIX) && entry.name.endsWith('.json'))
    for (const entry of journals) {
      const journalPath = `data/.cache/${entry.name}`
      try {
        const raw = await Plugins.ReadFile(journalPath)
        if (typeof raw !== 'string' || !raw.trim()) {
          await safeRemoveFile(journalPath)
          continue
        }
        const transaction = JSON.parse(raw)
        if (transaction?.version !== BACKGROUND_TX_VERSION || !transaction?.token || !Array.isArray(transaction.targets)) {
          console.warn('[BackgroundTX] 忽略未知版本事务:', journalPath)
          await safeRemoveFile(journalPath)
          continue
        }
        if (transaction.phase === 'prepared') {
          console.warn('[BackgroundTX] 发现未完成背景事务，开始回滚:', transaction.token)
          try {
            await restoreBackgroundSnapshot(transaction)
          } catch (rollbackError) {
            console.error('[BackgroundTX] 启动恢复失败:', rollbackError)
            /*
             * 不能在回滚失败后删除 journal，
             * 留给下一次启动再次尝试。
             */
            continue
          }
        }
        /*
         * committed 或 rollback 成功后，
         * 都可以删除事务文件。
         */
        await cleanupBackgroundTransactionFiles(transaction)
      } catch (error) {
        console.error('[BackgroundTX] 读取事务日志失败:', journalPath, error)
      }
    }
    /*
     * ------------------------------------------------------
     * 清理没有 journal 的孤儿 backup。
     *
     * 例如：
     * snapshot 已经开始
     * 程序马上崩溃
     * journal 还没成功写入
     *
     * 这种情况下无法恢复，但这些 backup 不应该一直残留。
     * ------------------------------------------------------
     */
    await cleanupOrphanBackgroundTransactionFiles()
  } catch (error) {
    console.error('[BackgroundTX] 启动事务恢复失败:', error)
  }
}
const saveImageBinary = async ({ base64 = '', extension = '', existingTempPath = '' }) => {
  const normalizeExt = (ext) => (ext === '.jpeg' ? '.jpg' : ext)
  const hasBase64 = typeof base64 === 'string' && !!base64
  const hasTempPath = typeof existingTempPath === 'string' && !!existingTempPath
  if (!hasBase64 && !hasTempPath) {
    throw new Error('图片数据为空')
  }
  let detected = null
  let expectedSize = 0
  /*
   * ------------------------------------------------------
   * 阶段 0：事务外完成输入验证
   *
   * 这些操作不会修改正式文件，
   * 所以没必要占用事务。
   * ------------------------------------------------------
   */
  if (hasBase64) {
    detected = detectImageFormat(base64)
    expectedSize = base64ByteSize(base64)
  } else {
    detected = detectImageFormat(await readFilePrefix(existingTempPath, 128))
    expectedSize = await getFileSize(existingTempPath)
  }
  if (!detected) {
    throw new Error('无法识别图片格式，文件可能已损坏')
  }
  const finalExtension = extension || detected.extension
  if (!FEATURES_IMAGE_FORMATS.includes(finalExtension)) {
    throw new Error('不支持的图片扩展名')
  }
  if (normalizeExt(finalExtension) !== normalizeExt(detected.extension)) {
    throw new Error('图片扩展名与真实图片格式不匹配')
  }
  if (expectedSize === FILE_SIZE_UNKNOWN) {
    throw new Error('临时图片文件不存在或无法读取大小')
  }
  if (expectedSize <= 0 || expectedSize > MAX_IMAGE_SIZE) {
    throw new Error(`图片不能大于 ${MAX_IMAGE_SIZE_MB}MB`)
  }
  const newRelativePath = `custom_bg${finalExtension}`
  const newPath = `${PATH}/${newRelativePath}`
  const isExternalTemp = !!existingTempPath
  const tempPath = existingTempPath || getTempFilePath('custom-bg')
  /*
   * ------------------------------------------------------
   * 阶段 0.5：
   * 如果调用者直接给 base64，
   * 先生成独立 temp。
   *
   * 仍然不碰正式文件。
   * ------------------------------------------------------
   */
  try {
    if (!isExternalTemp) {
      await Plugins.WriteFile(tempPath, base64, { Mode: 'Binary' })
      const tempSize = await getFileSize(tempPath)
      if (tempSize === FILE_SIZE_UNKNOWN) {
        throw new Error('临时图片文件写入失败：文件未生成')
      }
      if (tempSize !== expectedSize) {
        throw new Error(`临时图片文件写入失败：大小不一致（${tempSize} ≠ ${expectedSize}）`)
      }
    }
    if (!(await validateStoredBackgroundFile(tempPath))) {
      throw new Error('临时图片文件校验失败')
    }
    /*
     * ----------------------------------------------------
     * 阶段 1：
     * 真正开始事务
     *
     * snapshot：
     * - singbox-themes.json
     * - 所有 custom_bg.*
     * ----------------------------------------------------
     */
    await executeBackgroundTransaction(async () => {
      /*
       * 1. 提交新图片
       */
      await atomicMoveFile(tempPath, newPath)
      /*
       * 2. 删除旧扩展版本
       *
       * 事务 snapshot 已经保存，
       * 所以这里失败可以恢复。
       */
      for (const ext of FEATURES_IMAGE_FORMATS) {
        const stalePath = `${CUSTOM_BG_PREFIX}${ext}`
        if (stalePath === newPath) {
          continue
        }
        await removeFileOrThrow(stalePath)
      }
      /*
       * 3. 最后才修改配置
       *
       * 这样正常流程中：
       * 文件已经存在
       * ↓
       * 配置再指向它
       */
      const currentConfig = await getCachedConfig()
      const newConfig = {
        ...currentConfig,
        customBackground: isValidCustomBackgroundPath(newRelativePath) ? newRelativePath : ''
      } // ✅ 直接使用，无需再次归一化
      await saveConfig(newConfig)
    })
    return {
      config: await getCachedConfig(),
      relativePath: newRelativePath,
      extension: finalExtension,
      mimeType: detected.mimeType
    }
  } catch (error) {
    /*
     * 如果 atomicMoveFile 已经把 tempPath rename 掉，
     * 这里 RemoveFile 只是幂等清理。
     */
    await safeRemoveFile(tempPath)
    throw error
  } finally {
    /*
     * 外部 temp 也可能因为下载阶段异常残留。
     */
    if (isExternalTemp) {
      await safeRemoveFile(tempPath)
    }
  }
}
const commitBackgroundRemoval = async (newConfig) => {
  const normalized = newConfig // 直接使用配置
  return executeBackgroundTransaction(async () => {
    /*
     * 配置和图片删除必须属于同一个事务。
     *
     * 先写配置：
     * customBackground = ''
     *
     * 再删除图片。
     *
     * 中途任何一步失败，
     * transaction 会恢复完整旧状态。
     */
    await saveConfig(normalized)
    await removeAllCustomBackgroundsStrict()
  })
}
const activeFilePickerCancellers = new Set()
const openImageFilePicker = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].join(',')
  input.style.display = 'none'
  document.body.appendChild(input)
  return new Promise((resolve, reject) => {
    let finished = false
    let timer = null
    let focusTimer = null
    const cleanup = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (focusTimer) {
        clearTimeout(focusTimer)
        focusTimer = null
      }
      input.oncancel = null
      input.onchange = null
      input.onerror = null
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onDocumentVisibilityChange)
      activeFilePickerCancellers.delete(cancelPicker)
      try {
        input.remove()
      } catch {}
    }
    const settle = (fn, value) => {
      if (finished) return
      finished = true
      cleanup()
      try {
        fn(value)
      } catch {}
    }
    const checkPickerResult = () => {
      if (finished) return
      if (focusTimer) {
        clearTimeout(focusTimer)
      }
      focusTimer = setTimeout(() => {
        focusTimer = null
        if (finished) return
        /*
         * 文件选择器关闭后，Wails/WebView 的 visibility 状态
         * 可能比 focus 事件晚一步恢复。
         *
         * 因此这里不能简单地：
         *
         *   if (document.hidden) return
         *
         * 否则可能导致 Promise 一直挂起。
         */
        if (document.hidden || document.visibilityState !== 'visible') {
          return
        }
        const file = input.files?.[0]
        if (file) {
          settle(resolve, file)
          return
        }
        /*
         * 用户点取消、且宿主不派发 cancel 事件时（Chrome 113 以下），
         * files 会一直为空。这里必须收口，
         * 否则 Promise 只能等到超时才有结果。
         */
        settle(reject, new Error('USER_CANCELLED'))
      }, 250)
    }
    const onWindowFocus = checkPickerResult
    const onDocumentVisibilityChange = checkPickerResult
    const cancelPicker = () => {
      settle(reject, new Error('OPERATION_CANCELLED'))
    }
    input.oncancel = () => {
      settle(reject, new Error('USER_CANCELLED'))
    }
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        settle(reject, new Error('USER_CANCELLED'))
        return
      }
      settle(resolve, file)
    }
    input.onerror = () => {
      settle(reject, new Error('FILE_PICKER_ERROR'))
    }
    /*
     * 兜底超时。用户浏览目录挑图很容易超过 30 秒，超时后原生对话框还开着，
     * 选完文件也会被 finished 标记吞掉，等于白选，所以给足 1 分钟。
     */
    timer = setTimeout(() => {
      settle(reject, new Error('FILE_PICKER_TIMEOUT'))
    }, 30 * 1000)
    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onDocumentVisibilityChange)
    activeFilePickerCancellers.add(cancelPicker)
    /*
     * input.click() 必须在页面处于可见状态时执行。
     *
     * Wails/WebView 在窗口切换、最小化、关闭 Modal、
     * View Transition 等情况下可能处于 hidden 状态。
     */
    if (document.hidden || document.visibilityState !== 'visible') {
      settle(reject, new Error('FILE_PICKER_UNAVAILABLE'))
      return
    }
    try {
      input.click()
    } catch (error) {
      console.error('[CustomTheme] 打开文件选择器失败:', error)
      settle(reject, new Error('FILE_PICKER_UNAVAILABLE'))
    }
  })
}
const waitForDocumentVisible = () => {
  if (!document.hidden && document.visibilityState === 'visible') {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    let done = false
    let timer = null
    const cleanup = () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    const finish = () => {
      if (done) return
      done = true
      cleanup()
      resolve()
    }
    const check = () => {
      if (!document.hidden && document.visibilityState === 'visible') {
        /*
         * 再让浏览器完成一轮渲染，
         * 避免刚从 native file dialog 返回就立即触发 UI transition。
         */
        requestAnimationFrame(() => {
          requestAnimationFrame(finish)
        })
      }
    }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    /*
     * 防止异常情况下永久等待。
     */
    timer = setTimeout(() => {
      if (done) return
      done = true
      cleanup()
      reject(new Error('FILE_PICKER_UNAVAILABLE'))
    }, 1000)
    check()
  })
}
const SelectImage = async () => {
  const originalState = captureBackgroundState()
  let previewUrl = null
  let previewMutationVersion = null
  try {
    const pickerGeneration = runtimeGeneration
    const file = await openImageFilePicker()
    if (!runtimeActive || pickerGeneration !== runtimeGeneration) {
      throw createCancelledError()
    }
    /*
     * 文件选择器虽然已经返回，
     * 但 Wails/WebView 可能还没有完全恢复到 visible。
     */
    await waitForDocumentVisible()
    if (!runtimeActive || pickerGeneration !== runtimeGeneration) {
      throw createCancelledError()
    }
    const extension = validateImageFile(file)
    previewUrl = URL.createObjectURL(file)
    setTemporaryBackgroundImage(previewUrl)
    previewMutationVersion = backgroundMutationVersion
    await enqueueThemeOperation(
      async (ctx) => {
        ctx.assertActive()
        const base64 = await fileToBase64(file)
        ctx.assertActive()
        await saveImageBinary({
          base64,
          extension
        })
        if (ctx.isActive()) {
          /*
           * 正式接管 previewUrl。
           *
           * 这里必须使用 applyBackgroundObjectUrl，
           * 不能直接 currentBgObjectUrl = previewUrl，
           * 否则旧 Blob URL 不会被释放。
           */
          applyBackgroundObjectUrl(previewUrl)
          previewUrl = null
          return true
        }
        /*
         * 磁盘提交已经完成，但插件运行时已失效。
         * 不再修改 DOM。
         */
        if (previewUrl) {
          try {
            URL.revokeObjectURL(previewUrl)
          } catch {}
          previewUrl = null
        }
        return true
      },
      {
        label: 'select-image'
      }
    )
    Plugins.message.success('本地背景已设置', 1800)
    return true
  } catch (error) {
    const text = errText(error)
    if (
      text === 'USER_CANCELLED' ||
      text === 'FILE_PICKER_ERROR' ||
      text === 'FILE_PICKER_TIMEOUT' ||
      text === 'FILE_PICKER_UNAVAILABLE' ||
      text === 'OPERATION_CANCELLED'
    ) {
      /*
       * 只有当前 UI 仍然是这次 preview 时，
       * 才恢复旧状态。
       */
      if (previewMutationVersion !== null && backgroundMutationVersion === previewMutationVersion) {
        restoreBackgroundState(originalState, previewMutationVersion)
      }
      if (previewUrl) {
        try {
          URL.revokeObjectURL(previewUrl)
        } catch {}
        previewUrl = null
      }
      return false
    }
    console.error('[CustomTheme] SelectImage 失败:', error)
    if (previewMutationVersion !== null && backgroundMutationVersion === previewMutationVersion) {
      restoreBackgroundState(originalState, previewMutationVersion)
    }
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl)
      } catch {}
      previewUrl = null
    }
    Plugins.message.error(errText(error, '保存本地背景失败'))
    return false
  } finally {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl)
      } catch {}
      previewUrl = null
    }
  }
}
const isPrivateIPv4 = (ip) => {
  const matched = String(ip).match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (!matched) return true
  const [, aText, bText, cText, dText] = matched
  const a = Number(aText)
  const b = Number(bText)
  const c = Number(cText)
  const d = Number(dText)
  /*
   * 0.0.0.0/8
   */
  if (a === 0) return true
  /*
   * 10.0.0.0/8
   */
  if (a === 10) return true
  /*
   * 100.64.0.0/10 CGNAT
   */
  if (a === 100 && b >= 64 && b <= 127) return true
  /*
   * 127.0.0.0/8
   */
  if (a === 127) return true
  /*
   * 169.254.0.0/16 link-local
   */
  if (a === 169 && b === 254) return true
  /*
   * 172.16.0.0/12
   */
  if (a === 172 && b >= 16 && b <= 31) return true
  /*
   * 192.168.0.0/16
   */
  if (a === 192 && b === 168) return true
  /*
   * 192.0.0.0/24
   */
  if (a === 192 && b === 0 && c === 0) return true
  /*
   * 198.18.0.0/15 benchmark
   */
  if (a === 198 && b >= 18 && b <= 19) return true
  /*
   * 198.51.100.0/24 TEST-NET-2
   */
  if (a === 198 && b === 51 && c === 100) return true
  /*
   * 203.0.113.0/24 TEST-NET-3
   */
  if (a === 203 && b === 0 && c === 113) return true
  /*
   * multicast / reserved
   */
  if (a >= 224) return true
  return false
}
const parseIPv4Part = (part) => {
  if (typeof part !== 'string' || !part) return null
  let value
  if (/^0x[0-9a-f]+$/i.test(part)) {
    value = parseInt(part.slice(2), 16)
  } else if (/^0[0-7]+$/.test(part) && part.length > 1) {
    value = parseInt(part, 8)
  } else if (/^\d+$/.test(part)) {
    value = parseInt(part, 10)
  } else {
    return null
  }
  return Number.isFinite(value) && value >= 0 ? value : null
}
const parseIPv6Words = (host) => {
  let value = String(host || '')
    .trim()
    .toLowerCase()
  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.slice(1, -1)
  }
  if (!value || value.includes('%')) return null
  /*
   * IPv4 embedded form：
   * ::ffff:127.0.0.1
   */
  if (value.includes('.')) {
    const lastColon = value.lastIndexOf(':')
    if (lastColon < 0) return null
    const ipv4Text = value.slice(lastColon + 1)
    const ipv4 = normalizeIPv4Host(ipv4Text)
    if (!ipv4) return null
    const [a, b, c, d] = ipv4.split('.').map(Number)
    const high = (a << 8) | b
    const low = (c << 8) | d
    value = `${value.slice(0, lastColon)}:${high.toString(16)}:${low.toString(16)}`
  }
  const doubleIndex = value.indexOf('::')
  if (doubleIndex !== -1 && value.indexOf('::', doubleIndex + 2) !== -1) {
    return null
  }
  const leftText = doubleIndex === -1 ? value : value.slice(0, doubleIndex)
  const rightText = doubleIndex === -1 ? '' : value.slice(doubleIndex + 2)
  const parsePart = (text) => {
    if (!text) return []
    const parts = text.split(':')
    if (parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) {
      return null
    }
    return parts.map((part) => parseInt(part, 16))
  }
  const left = parsePart(leftText)
  const right = parsePart(rightText)
  if (!left || !right) return null
  if (doubleIndex === -1) {
    if (left.length !== 8) return null
    return left
  }
  if (left.length + right.length >= 8) {
    return null
  }
  const zeros = new Array(8 - left.length - right.length).fill(0)
  return [...left, ...zeros, ...right]
}
const isBlockedIPv6 = (host) => {
  const words = parseIPv6Words(host)
  if (!words || words.length !== 8) return true
  /*
   * :: / unspecified
   */
  if (words.every((value) => value === 0)) {
    return true
  }
  /*
   * ::1 / loopback
   */
  if (words.slice(0, 7).every((value) => value === 0) && words[7] === 1) {
    return true
  }
  /*
   * IPv4-mapped / IPv4-compatible
   */
  const mapped = words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0 && words[4] === 0 && (words[5] === 0 || words[5] === 0xffff)
  if (mapped) {
    const ipv4 = [(words[6] >>> 8) & 255, words[6] & 255, (words[7] >>> 8) & 255, words[7] & 255].join('.')
    if (isPrivateIPv4(ipv4)) return true
  }
  /*
   * fc00::/7 ULA
   */
  if ((words[0] & 0xfe00) === 0xfc00) {
    return true
  }
  /*
   * fe80::/10 link-local
   */
  if ((words[0] & 0xffc0) === 0xfe80) {
    return true
  }
  /*
   * ff00::/8 multicast
   */
  if ((words[0] & 0xff00) === 0xff00) {
    return true
  }
  return false
}
const normalizeIPv4Host = (host) => {
  const value = String(host || '')
    .trim()
    .toLowerCase()
  if (!value) return null
  /*
   * 单整数：
   * 2130706433 -> 127.0.0.1
   */
  if (/^\d+$/.test(value)) {
    const n = Number(value)
    if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) {
      return null
    }
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
  }
  /*
   * 十六进制整数：
   * 0x7f000001 -> 127.0.0.1
   */
  if (/^0x[0-9a-f]+$/i.test(value)) {
    const n = parseInt(value.slice(2), 16)
    if (!Number.isFinite(n) || n < 0 || n > 0xffffffff) {
      return null
    }
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
  }
  const parts = value.split('.')
  if (parts.length < 1 || parts.length > 4) {
    return null
  }
  const numbers = parts.map(parseIPv4Part)
  if (numbers.some((part) => part === null)) {
    return null
  }
  /*
   * 非标准 IPv4 表示法：
   *
   * 1 段：32 bit
   * 2 段：8 + 24 bit
   * 3 段：8 + 8 + 16 bit
   * 4 段：8 + 8 + 8 + 8 bit
   */
  if (numbers.length === 1) {
    const n = numbers[0]
    if (n > 0xffffffff) return null
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
  }
  if (numbers.length === 2) {
    const [a, b] = numbers
    if (a > 255 || b > 0xffffff) return null
    return [a, (b >>> 16) & 255, (b >>> 8) & 255, b & 255].join('.')
  }
  if (numbers.length === 3) {
    const [a, b, c] = numbers
    if (a > 255 || b > 255 || c > 0xffff) return null
    return [a, b, (c >>> 8) & 255, c & 255].join('.')
  }
  if (numbers.some((part) => part > 255)) {
    return null
  }
  return numbers.join('.')
}
const isBlockedHost = (hostname) => {
  let host = String(hostname || '')
    .trim()
    .toLowerCase()
  if (!host) return true
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }
  if (host.includes(':')) {
    return isBlockedIPv6(host)
  }
  const ipv4 = normalizeIPv4Host(host)
  if (ipv4) {
    return isPrivateIPv4(ipv4)
  }
  return false
}
const validateImageUrl = (value) => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error('请输入图片 URL')
  let url
  try {
    url = new URL(text)
  } catch {
    throw new Error('图片 URL 格式无效')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('只支持 HTTP / HTTPS 图片地址')
  if (isBlockedHost(url.hostname)) throw new Error('不允许访问本机或局域网地址')
  return url.href
}
const NETWORK_ERROR_RULES = [
  [/forcibly closed|connection reset by peer|connection was reset/i, '连接被远端强制中断'],
  [/no such host|lookup .*?( on |:).*?no such host|server misbehaving/i, '域名解析失败'],
  [/network is unreachable|no route to host/i, '网络不可达'],
  [/connection refused/i, '连接被拒绝'],
  [/i\/o timeout|context deadline exceeded|Client\.Timeout|exceeded while awaiting/i, '请求超时'],
  [/certificate|x509|tls: /i, 'TLS 证书校验失败'],
  [/too many redirects|stopped after \d+ redirects/i, '重定向次数过多']
]
const isRetriableNetworkError = (text) =>
  /forcibly closed|connection reset by peer|connection was reset|connection refused|network is unreachable|no route to host/i.test(text)
const getRequestProxyInfo = async () => {
  try {
    if (typeof Plugins.GetRequestProxy !== 'function') return null
    const proxy = await Plugins.GetRequestProxy()
    return typeof proxy === 'string' && proxy.trim() ? proxy.trim() : ''
  } catch {
    return null
  }
}
const describeNetworkError = async (error) => {
  const raw = errText(error)
  for (const [pattern, label] of NETWORK_ERROR_RULES) {
    if (!pattern.test(raw)) continue
    const proxy = await getRequestProxyInfo()
    const proxyHint = proxy === null ? '' : proxy ? `（当前请求代理：${proxy}）` : '（当前请求代理为空，导入会直连）'
    return `${label}${proxyHint}\n预览走浏览器网络，导入走宿主的「请求代理」，两者可以不一样 —— 请在「设置 → 网络设置 → 请求代理」中确认。`
  }
  return raw
}
/* 【P0 修复】下载在线图片：每次重试生成新临时文件，防止数据污染 */
const downloadOnlineImage = async (url, isCancelled = () => false) => {
  const attempt = async () => {
    // 【关键】每次 attempt 生成全新的 tempPath，避免重试时读写同一个损坏文件
    const tempPath = getTempFilePath('online_image')
    if (isCancelled()) throw new Error('ONLINE_IMPORT_CANCELLED')
    try {
      // 注意：Plugins.Download 默认不强制跟随重定向，由宿主请求策略控制。
      // 如果宿主支持禁用重定向 (如 { Redirect: 'manual' })，应加上。
      // 否则 JS 层无法拦截 302 到内网的 SSRF，只能依赖后端 TUN 或代理规则。
      const res = await Plugins.Download(url, tempPath, { Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' }, undefined, {
        Timeout: ONLINE_IMAGE_TIMEOUT_SECONDS
      })
      if (isCancelled()) throw new Error('ONLINE_IMPORT_CANCELLED')
      const status = res?.status
      if (typeof status === 'number' && (status < 200 || status >= 300)) {
        throw new Error(`下载失败：HTTP ${status}`)
      }
      const physicalSize = await getFileSize(tempPath)
      if (physicalSize === FILE_SIZE_UNKNOWN) throw new Error('下载失败：临时文件未生成或无法读取')
      if (physicalSize <= 0) throw new Error('下载内容为空')
      if (physicalSize > MAX_IMAGE_SIZE) throw new Error(`在线图片不能大于 ${MAX_IMAGE_SIZE_MB}MB`)
      const detected = detectImageFormat(await readFilePrefix(tempPath, 128))
      if (!detected) throw new Error('下载内容不是支持的图片格式')
      return { tempPath, extension: detected.extension, mimeType: detected.mimeType, size: physicalSize }
    } catch (error) {
      await safeRemoveFile(tempPath) // 失败必须清理当前 attempt 的临时文件
      throw error
    }
  }
  let lastError = null
  for (let i = 0; i < 2; i++) {
    // 最多重试 1 次
    try {
      return await attempt()
    } catch (error) {
      lastError = error
      if (isCancelled() || !isRetriableNetworkError(errText(error))) break
      console.warn(`[CustomTheme] 连接被重置，重试 ${i + 1}/1:`, errText(error))
      // 短暂延迟再重试
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw lastError || new Error('下载失败')
}
const importOnlineImage = async (url, isCancelled = () => false) => {
  // 阶段 1：下载 (可取消)
  const data = await downloadOnlineImage(url, isCancelled)
  if (isCancelled()) {
    await safeRemoveFile(data.tempPath)
    return { cancelled: true }
  }
  // 阶段 2：落盘 (不可取消，保证原子性)
  // 一旦进入 saveImageBinary，就忽略取消信号，确保文件系统状态一致
  try {
    const result = await saveImageBinary({
      extension: data.extension,
      existingTempPath: data.tempPath
    })
    // 落盘成功后只返回结果；DOM 预览由队列调用方在 ctx.isActive() 检查后执行。
    return { ...result, size: data.size }
  } catch (error) {
    // 落盘失败，清理临时文件
    await safeRemoveFile(data.tempPath)
    throw error
  }
}
const ensureThemeModalStyle = () => {
  let style = document.getElementById(THEME_MODAL_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = THEME_MODAL_STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `
    /* =====================================================================
     * CSS 编辑器：宿主 Plugins.modal + CodeEditor
     * 这些选择器不依赖插件旧的 [data-custom-theme-modal] 弹窗。
     * ===================================================================== */
    /* 统一 Modal Shell：宿主 Plugins.modal 负责窗口，插件只负责内容。 */
    .ctm-unified-modal-root[data-custom-theme-modal] {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      position: relative !important;
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    .gui-modal-modal-content:has(.ctm-unified-modal-root),
    .gui-modal-modal-scrollview:has(.ctm-unified-modal-root),
    .gui-modal-modal-body:has(.ctm-unified-modal-root) {
      min-height: 0 !important;
      height: 100% !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    .ctm-unified-modal-root .ctm-unified-modal-body {
      min-width: 0;
      min-height: 0;
      width: 100%;
      box-sizing: border-box;
    }
    .ctm-unified-modal-title {
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      overflow: hidden;
      line-height: 1.2;
    }
    .ctm-unified-modal-title-main {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ctm-unified-modal-title-subtitle {
      margin-top: 2px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ct-color-secondary);
      font-size: 11px;
      opacity: .7;
    }

    .ctm-css-plugin-root {
      overflow: hidden !important;
    }
    .gui-modal-modal:has(.ctm-css-plugin-root) {
      height: 92% !important;
    }
    .gui-modal-modal-content:has(.ctm-css-plugin-root),
    .gui-modal-modal-scrollview:has(.ctm-css-plugin-root),
    .gui-modal-modal-body:has(.ctm-css-plugin-root) {
      min-height: 0;
      height: 100%;
      overflow: hidden !important;
    }
    .ctm-css-plugin-root {
      width: 100%;
      height: 100%;
      max-height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: var(--ct-color-primary);
      background: transparent;
    }
    .ctm-css-plugin-toolbar {
      flex: 0 0 44px;
      min-height: 44px;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 12px;
      box-sizing: border-box;
      border-bottom: 1px solid var(--ct-border);
      background: color-mix(in srgb, var(--ct-surface-input) 22%, transparent);
      user-select: none;
    }
    .ctm-css-plugin-tool {
      height: 32px;
      padding: 0 9px;
      border: 1px solid transparent;
      border-radius: 6px;
      background: transparent;
      color: var(--ct-color-primary);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
      opacity: .9;
    }
    .ctm-css-plugin-tool:hover {
      background: var(--ct-button-bg);
      border-color: var(--ct-border);
      opacity: 1;
    }
    .ctm-css-plugin-tool:disabled {
      opacity: .4;
      cursor: default;
    }
    .ctm-css-plugin-toolbar-spacer {
      flex: 1 1 auto;
      min-width: 8px;
    }

    /* CodeEditor + 实时诊断 + 底部操作区：必须明确 flex 高度，避免底部按钮被编辑器挤出可视区域。 */
    .ctm-css-plugin-editor {
      position: relative;
      flex: 1 1 auto;
      min-width: 0;
      min-height: 245px;
      display: flex;
      overflow: hidden;
      border-bottom: 1px solid var(--ct-border);
      background: color-mix(in srgb, var(--ct-surface-input) 28%, transparent);
    }
    .ctm-css-plugin-editor > * {
      flex: 1 1 auto;
      min-width: 0;
      min-height: 0;
      width: 100%;
      height: 100%;
    }
    .ctm-css-plugin-editor .cm-editor {
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    .ctm-css-plugin-footer {
      flex: 0 0 54px;
      min-height: 54px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 12px;
      box-sizing: border-box;
      background: color-mix(in srgb, var(--ct-surface-input) 16%, transparent);
    }
    .ctm-css-plugin-footer-btn {
      min-width: 96px;
      height: 36px;
      padding: 0 14px;
      box-sizing: border-box;
      border: 1px solid var(--ct-border);
      border-radius: 8px;
      color: var(--ct-button-color);
      background: var(--ct-button-bg);
      font: inherit;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease, color .15s ease;
    }
    .ctm-css-plugin-footer-btn:hover:not(:disabled) {
      background: var(--ct-button-hover-bg);
      border-color: var(--ct-button-hover-border);
    }
    .ctm-css-plugin-footer-btn:active:not(:disabled),
    .ctm-css-plugin-footer-btn:focus-visible:not(:disabled) {
      filter: none !important;
      transform: none !important;
      box-shadow: none !important;
      outline: none;
    }
    .ctm-css-plugin-footer-btn:disabled {
      opacity: .5;
      cursor: default;
    }
    .ctm-css-plugin-footer-btn.is-primary {
      color: var(--ct-primary-color);
      background: var(--ct-primary-bg);
      border-color: var(--ct-primary-bg);
    }
    .ctm-css-plugin-footer-btn.is-primary:hover:not(:disabled) {
      color: var(--ct-primary-color);
      background: var(--ct-primary-hover-bg);
      border-color: var(--ct-primary-hover-bg);
    }
    .ctm-css-plugin-footer-btn.is-primary:active:not(:disabled),
    .ctm-css-plugin-footer-btn.is-primary:focus-visible:not(:disabled) {
      color: var(--ct-primary-color);
      background: var(--ct-primary-bg);
      border-color: var(--ct-primary-bg);
      filter: none !important;
      transform: none !important;
      box-shadow: none !important;
    }
    .ctm-css-plugin-preview-bar {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483000;
      min-height: 42px;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 6px 8px 6px 10px;
      border: 1px solid rgba(0,0,0,.16);
      border-radius: 12px;
      background: color-mix(in srgb, var(--ct-surface-elevated) 78%, transparent);
      color: #000000;
      box-shadow: 0 10px 28px rgba(0,0,0,.14);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      user-select: none;
      -webkit-user-select: none;
      transition: box-shadow .15s ease, border-color .15s ease;
    }
    .ctm-css-plugin-preview-bar.is-visible {
      display: flex;
    }
    .ctm-css-plugin-preview-bar.is-dragging {
      border-color: rgba(96,165,250,.72);
      box-shadow: 0 18px 46px rgba(0,0,0,.38), 0 0 0 1px rgba(96,165,250,.18);
    }
    .ctm-css-plugin-preview-dot {
      width: 8px;
      height: 8px;
      flex: 0 0 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 3px rgba(34,197,94,.14);
    }
    .ctm-css-plugin-preview-label {
      min-width: 52px;
      color: #000000;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      cursor: grab;
      touch-action: none;
    }
    .ctm-css-plugin-preview-bar.is-dragging .ctm-css-plugin-preview-label {
      cursor: grabbing;
    }
    .ctm-css-plugin-preview-btn {
      height: 30px;
      padding: 0 9px;
      border: 1px solid rgba(0,0,0,.16);
      border-radius: 7px;
      background: transparent;
      color: #000000;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .ctm-css-plugin-preview-btn:hover {
      background: rgba(0,0,0,.06);
      color: #000000;
    }
    :root {
      --ct-color-primary: var(--color, #222);
      --ct-color-secondary: var(--card-color, var(--color, #666));
      --ct-surface: var(--bg-color, #fff);
      --ct-surface-elevated: var(--modal-bg, var(--card-bg, #fff));
      --ct-surface-input: var(--input-bg, rgba(255,255,255,.55));
      --ct-border: var(--divider-color, rgba(0,0,0,.12));
      --ct-button-color: var(--btn-normal-color, var(--color, #222));
      --ct-button-bg: var(--btn-normal-bg, rgba(0,0,0,.05));
      --ct-button-hover-bg: var(--btn-normal-hover-bg, rgba(0,0,0,.09));
      --ct-button-hover-border: var(--btn-normal-hover-border-color, var(--divider-color, rgba(0,0,0,.18)));
      --ct-primary-color: var(--btn-primary-color, #fff);
      --ct-primary-bg: var(--btn-primary-bg, #3b82f6);
      --ct-primary-hover-bg: var(--btn-primary-hover-bg, var(--btn-primary-bg, #3b82f6));
      --ct-accent: var(--btn-primary-bg, #3b82f6);
      --ct-scroll-track: var(--scrollbar-track-bg, transparent);
      --ct-scroll-thumb: var(--scrollbar-thumb-bg, rgba(128,128,128,.26));
      --ct-table-odd: var(--table-tr-odd-bg, transparent);
      --ct-table-even: var(--table-tr-even-bg, transparent);
      --ct-overlay: var(--modal-mask-bg, rgba(0,0,0,.25));
    }
    body[theme-mode="light"] {
      --ct-color-primary: var(--color-light, var(--color, #222));
      --ct-color-secondary: var(--card-color-light, var(--card-color, var(--color, #666)));
      --ct-surface: var(--bg-color-light, var(--bg-color, #fff));
      --ct-surface-elevated: var(--modal-bg-light, var(--card-bg-light, var(--modal-bg, #fff)));
      --ct-surface-input: var(--input-bg-light, var(--input-bg, rgba(255,255,255,.55)));
      --ct-border: var(--divider-color-light, var(--divider-color, rgba(0,0,0,.12)));
      --ct-button-color: var(--btn-normal-color-light, var(--btn-normal-color, var(--color, #222)));
      --ct-button-bg: var(--btn-normal-bg-light, var(--btn-normal-bg, rgba(0,0,0,.05)));
      --ct-button-hover-bg: var(--btn-normal-hover-bg-light, var(--btn-normal-hover-bg, rgba(0,0,0,.09)));
      --ct-button-hover-border: var(--btn-normal-hover-border-color-light, var(--divider-color-light, var(--divider-color, rgba(0,0,0,.18))));
      --ct-primary-color: var(--btn-primary-color-light, var(--btn-primary-color, #fff));
      --ct-primary-bg: var(--btn-primary-bg-light, var(--btn-primary-bg, #3b82f6));
      --ct-primary-hover-bg: var(--btn-primary-hover-bg-light, var(--btn-primary-hover-bg, var(--ct-primary-bg)));
      --ct-scroll-track: var(--scrollbar-track-bg-light, var(--scrollbar-track-bg, transparent));
      --ct-scroll-thumb: var(--scrollbar-thumb-bg-light, var(--scrollbar-thumb-bg, rgba(128,128,128,.26)));
      --ct-table-odd: var(--table-tr-odd-bg-light, var(--table-tr-odd-bg, transparent));
      --ct-table-even: var(--table-tr-even-bg-light, var(--table-tr-even-bg, transparent));
      --ct-overlay: var(--modal-mask-bg-light, var(--modal-mask-bg, rgba(0,0,0,.25)));
    }
    body[theme-mode="dark"] {
      --ct-color-primary: var(--color-dark, var(--color, #eee));
      --ct-color-secondary: var(--card-color-dark, var(--card-color, var(--color, #aaa)));
      --ct-surface: var(--bg-color-dark, var(--bg-color, #111));
      --ct-surface-elevated: var(--modal-bg-dark, var(--card-bg-dark, var(--modal-bg, #111)));
      --ct-surface-input: var(--input-bg-dark, var(--input-bg, rgba(20,20,24,.72)));
      --ct-border: var(--divider-color-dark, var(--divider-color, rgba(255,255,255,.12)));
      --ct-button-color: var(--btn-normal-color-dark, var(--btn-normal-color, var(--color, #eee)));
      --ct-button-bg: var(--btn-normal-bg-dark, var(--btn-normal-bg, rgba(255,255,255,.06)));
      --ct-button-hover-bg: var(--btn-normal-hover-bg-dark, var(--btn-normal-hover-bg, rgba(255,255,255,.10)));
      --ct-button-hover-border: var(--btn-normal-hover-border-color-dark, var(--divider-color-dark, var(--divider-color, rgba(255,255,255,.20))));
      --ct-primary-color: var(--btn-primary-color-dark, var(--btn-primary-color, #fff));
      --ct-primary-bg: var(--btn-primary-bg-dark, var(--btn-primary-bg, #3b82f6));
      --ct-primary-hover-bg: var(--btn-primary-hover-bg-dark, var(--btn-primary-hover-bg, var(--ct-primary-bg)));
      --ct-scroll-track: var(--scrollbar-track-bg-dark, var(--scrollbar-track-bg, transparent));
      --ct-scroll-thumb: var(--scrollbar-thumb-bg-dark, var(--scrollbar-thumb-bg, rgba(128,128,128,.26)));
      --ct-table-odd: var(--table-tr-odd-bg-dark, var(--table-tr-odd-bg, transparent));
      --ct-table-even: var(--table-tr-even-bg-dark, var(--table-tr-even-bg, transparent));
      --ct-overlay: var(--modal-mask-bg-dark, var(--modal-mask-bg, rgba(0,0,0,.42)));
    }

    [data-custom-theme-modal-mask] { position: fixed; inset: 0; z-index: 2147483000; display: flex; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; background: var(--ct-overlay); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    [data-custom-theme-modal-mask].ctm-modal-mask-minimized { background: transparent !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; pointer-events: none; }
    [data-custom-theme-modal-mask].ctm-modal-mask-minimized [data-custom-theme-modal] { pointer-events: auto; }
    [data-ctm-preview-bar] { position: fixed; z-index: 2147483001; right: 24px; bottom: 24px; display: none; align-items: center; gap: 10px; padding: 10px 12px; box-sizing: border-box; color: #000000; background: color-mix(in srgb, var(--ct-surface-elevated) 78%, transparent); backdrop-filter: none; -webkit-backdrop-filter: none; border: 1px solid rgba(255,255,255,.22); border-radius: 12px; box-shadow: 0 14px 38px rgba(0,0,0,.34); font-size: 13px; font-family: inherit; user-select: none; -webkit-user-select: none; transition: box-shadow .15s ease, border-color .15s ease; }
    [data-ctm-preview-bar].ctm-visible { display: inline-flex; }
    [data-ctm-preview-bar].is-dragging { border-color: rgba(96,165,250,.72); box-shadow: 0 18px 46px rgba(0,0,0,.38), 0 0 0 1px rgba(96,165,250,.18); }
    [data-ctm-preview-bar] .ctm-preview-bar-label { display: inline-flex; align-items: center; gap: 7px; color: #000000; white-space: nowrap; cursor: grab; font-weight: 600; user-select: none; -webkit-user-select: none; touch-action: none; }
    [data-ctm-preview-bar].is-dragging .ctm-preview-bar-label { cursor: grabbing; }
    [data-ctm-preview-bar] .ctm-preview-bar-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.14); }
    [data-ctm-preview-bar] .ctm-preview-bar-btn { height: 30px; padding: 0 12px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.18); border-radius: 8px; color: #e5e7eb; background: rgba(255,255,255,.08); font-size: 13px; font-family: inherit; cursor: pointer; white-space: nowrap; transition: background .15s ease, border-color .15s ease, color .15s ease; }
    [data-ctm-preview-bar] .ctm-preview-bar-btn:hover { background: rgba(0,0,0,.06); border-color: rgba(0,0,0,.24); color: #000000; }
    [data-ctm-preview-bar] .ctm-preview-bar-btn.ctm-active { color: #000000; background: rgba(0,0,0,.08); border-color: rgba(0,0,0,.24); }
    [data-ctm-preview-bar] .ctm-preview-bar-btn.ctm-active:hover { background: rgba(0,0,0,.12); }
    [data-custom-theme-modal] { display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden; position: relative; min-width: 320px; min-height: 180px; color: var(--ct-color-primary); background: rgba(128,128,128,.45); background: color-mix(in srgb, var(--ct-surface-elevated) 65%, transparent); backdrop-filter: blur(18px) saturate(1.6); -webkit-backdrop-filter: blur(18px) saturate(1.6); border: 1px solid var(--ct-border); box-shadow: 0 24px 70px rgba(0,0,0,.28); border-radius: 12px; transition: background-color .2s ease, color .2s ease, border-color .2s ease, box-shadow .2s ease; }
    [data-custom-theme-modal].ctm-modal-minimized { min-width: 320px; min-height: 0; height: auto !important; max-height: none !important; }
    [data-custom-theme-modal].ctm-modal-minimized > :not(.ctm-header) { display: none !important; }
    [data-custom-theme-modal] .ctm-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 12px 14px 18px; border-bottom: 1px solid var(--ct-border); flex-shrink: 0; cursor: move; user-select: none; touch-action: none; }
    [data-custom-theme-modal].ctm-modal-minimized .ctm-header { border-bottom: 0; }
    [data-custom-theme-modal] .ctm-title { min-width: 0; flex: 1 1 auto; color: var(--ct-color-primary); font-size: 16px; font-weight: 600; line-height: 1.35; }
    [data-custom-theme-modal] .ctm-subtitle { margin-top: 4px; color: var(--ct-color-secondary); font-size: 12px; opacity: .68; }
    [data-custom-theme-modal] .ctm-window-controls { display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto; }
    [data-custom-theme-modal] .ctm-window-control { width: 30px; height: 30px; flex: 0 0 30px; padding: 0; border: 1px solid transparent; border-radius: 8px; color: var(--ct-button-color); background: transparent; font-size: 16px; line-height: 1; cursor: pointer; opacity: .68; transition: background .15s ease, opacity .15s ease, border-color .15s ease; }
    [data-custom-theme-modal] .ctm-window-control:hover { opacity: 1; background: var(--ct-button-bg); border-color: var(--ct-border); }
    [data-custom-theme-modal] .ctm-window-control.ctm-window-close:hover { background: color-mix(in srgb, #ef4444 18%, var(--ct-button-bg)); border-color: color-mix(in srgb, #ef4444 40%, var(--ct-border)); }
    [data-custom-theme-modal] .ctm-window-close { font-size: 20px; }
    [data-custom-theme-modal] .ctm-resize-handle { position: absolute; z-index: 20; pointer-events: auto; touch-action: none; user-select: none; }
    [data-custom-theme-modal] .ctm-resize-n { top: 0; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
    [data-custom-theme-modal] .ctm-resize-s { bottom: 0; left: 10px; right: 10px; height: 8px; cursor: ns-resize; }
    [data-custom-theme-modal] .ctm-resize-e { top: 10px; right: 0; bottom: 10px; width: 8px; cursor: ew-resize; }
    [data-custom-theme-modal] .ctm-resize-w { top: 10px; left: 0; bottom: 10px; width: 8px; cursor: ew-resize; }
    [data-custom-theme-modal] .ctm-resize-ne { top: 0; right: 0; width: 12px; height: 12px; cursor: nesw-resize; }
    [data-custom-theme-modal] .ctm-resize-nw { top: 0; left: 0; width: 12px; height: 12px; cursor: nwse-resize; }
    [data-custom-theme-modal] .ctm-resize-se { right: 0; bottom: 0; width: 12px; height: 12px; cursor: nwse-resize; }
    [data-custom-theme-modal] .ctm-resize-sw { left: 0; bottom: 0; width: 12px; height: 12px; cursor: nesw-resize; }
    [data-custom-theme-modal].ctm-modal-maximized .ctm-resize-handle,
    [data-custom-theme-modal].ctm-modal-minimized .ctm-resize-handle { display: none; }
    [data-custom-theme-modal] .ctm-close { width: 30px; height: 30px; flex: 0 0 30px; padding: 0; border: 1px solid transparent; border-radius: 8px; color: var(--ct-button-color); background: transparent; font-size: 20px; line-height: 1; cursor: pointer; opacity: .68; transition: background .15s ease, opacity .15s ease, border-color .15s ease; }
    [data-custom-theme-modal] .ctm-close:hover { opacity: 1; background: var(--ct-button-bg); border-color: var(--ct-border); }
    [data-custom-theme-modal] .ctm-button { min-width: 88px; height: 36px; padding: 0 15px; box-sizing: border-box; border: 1px solid var(--ct-border); border-radius: 8px; color: var(--ct-button-color); background: var(--ct-button-bg); font-size: 13px; cursor: pointer; transition: background .15s ease, border-color .15s ease, transform .15s ease; }
    [data-custom-theme-modal] .ctm-button:hover { background: var(--ct-button-hover-bg); border-color: var(--ct-button-hover-border); }
    [data-custom-theme-modal] .ctm-button:active { transform: translateY(1px); }
    [data-custom-theme-modal] .ctm-button:disabled { opacity: .45; cursor: default; transform: none; }
    [data-custom-theme-modal] .ctm-button.primary { color: var(--ct-primary-color); background: var(--ct-primary-bg); border-color: var(--ct-primary-bg); }
    [data-custom-theme-modal] .ctm-button.primary:hover { background: var(--ct-primary-hover-bg); border-color: var(--ct-primary-hover-bg); }
    [data-custom-theme-modal] .ctm-input { width: 100%; height: 40px; box-sizing: border-box; padding: 0 12px; outline: none; border: 1px solid var(--ct-border); border-radius: 8px; color: var(--ct-color-primary); background: color-mix(in srgb, var(--ct-surface-input) 60%, transparent); font-size: 13px; transition: border-color .15s ease, box-shadow .15s ease, background-color .2s ease; }
    [data-custom-theme-modal] .ctm-input::placeholder { color: var(--ct-color-secondary); opacity: .48; }
    [data-custom-theme-modal] .ctm-input:focus { border-color: var(--ct-accent); box-shadow: 0 0 0 2px color-mix(in srgb, var(--ct-accent) 18%, transparent); }
    [data-custom-theme-modal] .ctm-textarea { width: 100%; height: 100%; display: block; box-sizing: border-box; margin: 0; padding: 14px 16px; resize: none; outline: none; border: 0; color: var(--ct-color-primary); background: transparent; font-family: Consolas, "Cascadia Code", "JetBrains Mono", monospace; font-size: 13px; line-height: 1.5; white-space: pre; overflow: auto; tab-size: 2; transition: background-color .2s ease; }
    [data-custom-theme-modal] .ctm-textarea::selection { background: color-mix(in srgb, var(--ct-accent) 28%, transparent); }
    [data-custom-theme-modal] .ctm-textarea::-webkit-scrollbar { width: 10px; height: 10px; }
    [data-custom-theme-modal] .ctm-textarea::-webkit-scrollbar-track { background: var(--ct-scroll-track); }
    [data-custom-theme-modal] .ctm-textarea::-webkit-scrollbar-thumb { background: var(--ct-scroll-thumb); border-radius: 10px; }
    [data-custom-theme-modal] .ctm-label { margin-bottom: 7px; color: var(--ct-color-primary); font-size: 12px; font-weight: 500; opacity: .82; }
    [data-custom-theme-modal] .ctm-hint { color: var(--ct-color-secondary); font-size: 11px; line-height: 1.5; opacity: .62; }
    [data-custom-theme-modal] .ctm-footer { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; flex-shrink: 0; }
    [data-custom-theme-modal] .ctm-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-shrink: 0; }

    /* 自定义 CSS 工作区：标题栏 → 菜单栏 → 编辑器 → 状态栏 */
    [data-custom-theme-modal] .ctm-css-content { min-height: 0; flex: 1 1 auto; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
    [data-custom-theme-modal] .ctm-css-toolbar { position: relative; min-height: 44px; margin: 0; padding: 0 14px; box-sizing: border-box; border-bottom: 1px solid var(--ct-border); background: color-mix(in srgb, var(--ct-surface-input) 22%, transparent); }
    [data-custom-theme-modal] .ctm-css-menu-bar { width: 100%; min-height: 44px; display: flex; align-items: center; gap: 2px; box-sizing: border-box; }
    [data-custom-theme-modal] .ctm-css-menu-wrap { position: relative; display: inline-flex; align-items: center; height: 100%; }
    [data-custom-theme-modal] .ctm-css-menu-trigger { height: 32px; padding: 0 9px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--ct-color-primary); font: inherit; font-size: 13px; line-height: 1; cursor: pointer; opacity: .88; transition: background .15s ease, border-color .15s ease, opacity .15s ease; }
    [data-custom-theme-modal] .ctm-css-menu-trigger:hover,
    [data-custom-theme-modal] .ctm-css-menu-trigger[aria-expanded="true"] { opacity: 1; background: var(--ct-button-bg); border-color: var(--ct-border); }
    [data-custom-theme-modal] .ctm-css-menu-trigger:active { transform: translateY(1px); }
        [data-custom-theme-modal] .ctm-css-menu-trigger:disabled { opacity: .42; cursor: default; background: transparent; border-color: transparent; transform: none; }
    [data-custom-theme-modal] .ctm-css-menu-trigger.ctm-clear-armed { color: #ef4444; opacity: 1; border-color: color-mix(in srgb, #ef4444 40%, var(--ct-border)); background: color-mix(in srgb, #ef4444 12%, transparent); }
    [data-custom-theme-modal] .ctm-css-menu-panel { position: absolute; top: calc(100% - 2px); left: 0; z-index: 80; min-width: 148px; padding: 6px; box-sizing: border-box; border: 1px solid var(--ct-border); border-radius: 8px; background: color-mix(in srgb, var(--ct-surface-elevated) 90%, transparent); backdrop-filter: blur(14px) saturate(1.35); -webkit-backdrop-filter: blur(14px) saturate(1.35); box-shadow: 0 16px 36px rgba(0,0,0,.20); display: none; }
    [data-custom-theme-modal] .ctm-css-menu-wrap.open > .ctm-css-menu-panel { display: flex; flex-direction: column; gap: 2px; }
    [data-custom-theme-modal] .ctm-css-menu-item { width: 100%; min-width: 0; height: 32px; padding: 0 10px; box-sizing: border-box; display: flex; align-items: center; justify-content: flex-start; border: 1px solid transparent; border-radius: 6px; color: var(--ct-button-color); background: transparent; font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    [data-custom-theme-modal] .ctm-css-menu-item:hover { background: var(--ct-button-hover-bg); border-color: var(--ct-button-hover-border); }
    [data-custom-theme-modal] .ctm-css-menu-item:disabled { opacity: .45; cursor: default; }
    [data-custom-theme-modal] .ctm-css-menu-item.primary { color: var(--ct-primary-color); background: var(--ct-primary-bg); border-color: var(--ct-primary-bg); }
    [data-custom-theme-modal] .ctm-css-menu-item.primary:hover { background: var(--ct-primary-hover-bg); border-color: var(--ct-primary-hover-bg); }
    [data-custom-theme-modal] .ctm-css-menu-spacer { flex: 1 1 auto; min-width: 12px; }
        [data-custom-theme-modal] .ctm-css-bell { position: relative; height: 32px; padding: 0 9px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--ct-color-secondary); font: inherit; font-size: 15px; line-height: 1; cursor: pointer; opacity: .5; transition: background .15s ease, opacity .15s ease, color .15s ease; }
    [data-custom-theme-modal] .ctm-css-bell:hover { background: var(--ct-button-bg); opacity: 1; }
    [data-custom-theme-modal] .ctm-css-bell.has-warnings { color: #f59e0b; opacity: 1; }
    [data-custom-theme-modal] .ctm-css-bell-badge { position: absolute; top: 1px; right: 2px; min-width: 15px; height: 15px; padding: 0 3px; box-sizing: border-box; border-radius: 8px; background: #f59e0b; color: #fff; font-size: 10px; line-height: 15px; text-align: center; font-weight: 600; pointer-events: none; }
    [data-custom-theme-modal] .ctm-css-editor-shell { position: relative; min-height: 0; flex: 1 1 auto; display: flex; overflow: hidden; border-bottom: 1px solid var(--ct-border); background: color-mix(in srgb, var(--ct-surface-input) 28%, transparent); }
    [data-custom-theme-modal] .ctm-css-gutter { flex: 0 0 52px; width: 52px; min-width: 52px; box-sizing: border-box; overflow: hidden; padding: 14px 10px 14px 0; border-right: 1px solid var(--ct-border); color: var(--ct-color-secondary); background: color-mix(in srgb, var(--ct-surface-input) 45%, transparent); font-family: Consolas, "Cascadia Code", "JetBrains Mono", monospace; font-size: 13px; line-height: 1.65; text-align: right; user-select: none; }
    [data-custom-theme-modal] .ctm-css-line-numbers { min-height: 100%; white-space: pre; opacity: .62; }
    [data-custom-theme-modal] .ctm-css-editor-shell .ctm-textarea { flex: 1 1 auto; min-width: 0; height: 100%; background: transparent; border-radius: 0; }
    [data-custom-theme-modal] .ctm-css-hint { display: none; }
    [data-custom-theme-modal] .ctm-css-footer { min-height: 52px; margin: 0; padding: 8px 14px; box-sizing: border-box; align-items: center; justify-content: flex-start; gap: 10px; border-top: 0; background: color-mix(in srgb, var(--ct-surface-input) 16%, transparent); }
    [data-custom-theme-modal] .ctm-css-footer .ctm-status { margin-left: 4px; white-space: nowrap; }
    [data-custom-theme-modal] .ctm-css-footer-actions { margin-left: auto; display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex: 0 0 auto; }
    [data-custom-theme-modal] .ctm-css-footer-actions .ctm-button { min-width: 96px; }
    [data-custom-theme-modal] .ctm-warning-box { display: none; position: absolute; right: 12px; top: 8px; z-index: 20; width: clamp(240px, 40%, 520px); max-height: 200px; overflow: hidden; margin: 0; padding: 0; border: 1px solid color-mix(in srgb, #f59e0b 32%, var(--ct-border)); border-radius: 8px; background: color-mix(in srgb, var(--ct-surface-elevated) 96%, #f59e0b 4%); color: var(--ct-color-primary); font-size: 11px; line-height: 1.4; box-shadow: 0 8px 22px rgba(0,0,0,.18); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
    [data-custom-theme-modal] .ctm-warning-box.visible { display: flex; flex-direction: column; }
    [data-custom-theme-modal] .ctm-warning-header { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid color-mix(in srgb, #f59e0b 22%, var(--ct-border)); }
    [data-custom-theme-modal] .ctm-warning-title { flex: 1 1 auto; font-weight: 600; font-size: 11px; line-height: 15px; }
    [data-custom-theme-modal] .ctm-warning-btn { flex: 0 0 auto; height: 20px; padding: 0 8px; border: 1px solid color-mix(in srgb, #f59e0b 35%, var(--ct-border)); border-radius: 5px; background: transparent; color: var(--ct-color-secondary); font: inherit; font-size: 11px; line-height: 1; cursor: pointer; opacity: .92; transition: background .15s ease, opacity .15s ease; }
    [data-custom-theme-modal] .ctm-warning-btn:hover { background: color-mix(in srgb, #f59e0b 14%, transparent); opacity: 1; }
    [data-custom-theme-modal] .ctm-warning-items { flex: 1 1 auto; overflow: auto; padding: 6px 8px; user-select: text; -webkit-user-select: text; cursor: text; }
    [data-custom-theme-modal] .ctm-warning-item { margin-left: 10px; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; }
    [data-custom-theme-modal] .ctm-preview { display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--ct-border); border-radius: 10px; background: color-mix(in srgb, var(--ct-surface-input) 40%, transparent); transition: background-color .2s ease; }
    [data-custom-theme-modal] .ctm-preview img { max-width: 100%; max-height: 100%; display: none; object-fit: contain; }
    [data-custom-theme-modal] .ctm-preview-text { color: var(--ct-color-secondary); font-size: 13px; opacity: .55; }
  `
}
const $el = (tag, className, text, style) => {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined && text !== null) element.textContent = text
  if (style) element.style.cssText = style
  return element
}
let activeCSSModal = null
// 在文件顶部（modalStack 定义附近）添加全局监听器
let runtimeGeneration = 0
let runtimeActive = true
let themeOperationQueue = Promise.resolve()
const enqueueThemeOperation = (operation, { label } = {}) => {
  const generation = runtimeGeneration
  const run = themeOperationQueue.then(async () => {
    if (!runtimeActive || generation !== runtimeGeneration) {
      throw createCancelledError() // 全局检查
    }
    const ctx = {
      generation,
      isActive() {
        return runtimeActive && generation === runtimeGeneration
      },
      assertActive() {
        if (!this.isActive()) {
          throw createCancelledError()
        }
      }
    }
    try {
      console.debug(`[ThemeQueue] 开始：${label}`)
      return await operation(ctx)
    } finally {
      console.debug(`[ThemeQueue] 结束：${label}`)
    }
  })
  /*
   * 关键：
   * 1. 返回 run，让调用方能够收到真实异常
   * 2. queue 自己吞掉异常，保证下一个任务还能继续执行
   */
  themeOperationQueue = run.catch((error) => {
    if (!error?.cancelled) {
      console.error(`[ThemeQueue] ${label} 失败:`, error)
    }
    return undefined
  })

  return run
}
const beginRuntime = () => {
  runtimeActive = true
  return runtimeGeneration
}
const invalidateRuntime = () => {
  runtimeGeneration += 1
  runtimeActive = false
}
const createButton = (text, primary = false) => {
  const button = $el('button', primary ? 'ctm-button primary' : 'ctm-button', text)
  button.type = 'button'
  return button
}
/*
 * CSS 编辑器专用拖拽：
 * 1. 只在标题栏拖拽，不影响 textarea / checkbox / button；
 * 2. 第一次拖拽时将当前 flex 居中位置转换成 fixed 坐标；
 * 3. 限制弹窗至少保留少量可见区域，避免拖出屏幕后无法找回；
 * 4. 返回 cleanup，确保 Modal 销毁时不会残留 document 监听器。
 * Modal 通用窗口行为由宿主 Plugins.modal 负责：
 * 拖动 / 缩放 / 最大化 / 恢复 / 最小化 / 视口变化自适应均由公共层处理。
 * 下面的弹窗只负责自身业务内容和关闭/保存逻辑，不再各自实现窗口行为。
 */
/*
 * 统一 Modal Shell：在线图片、自定义图标、纯色背景、自定义 CSS 全部使用宿主 Plugins.modal。
 *
 * 这里仅统一“外壳”，不修改 CSS 编辑器 CodeMirror 6 组件内部逻辑。
 */
const activeUnifiedModals = new Set()
const createUnifiedDomContent = (body, name = 'CustomThemeDomModalContent') =>
  Vue.defineComponent({
    name,
    setup() {
      const host = Vue.ref(null)
      Vue.onMounted(() => {
        if (!host.value) return
        try {
          host.value.appendChild(body)
        } catch (error) {
          console.error('[CustomTheme] 挂载 Modal 内容失败:', error)
        }
      })
      Vue.onUnmounted(() => {
        try {
          body.remove()
        } catch {}
      })
      return () =>
        Vue.h('div', {
          ref: host,
          class: 'ctm-unified-modal-root',
          'data-custom-theme-modal': ''
        })
    }
  })

const createUnifiedModalTitle =
  (title, subtitle = '') =>
  () =>
    Vue.h('div', { class: 'ctm-unified-modal-title' }, [
      Vue.h('div', { class: 'ctm-unified-modal-title-main' }, title || ''),
      subtitle ? Vue.h('div', { class: 'ctm-unified-modal-title-subtitle' }, subtitle) : null
    ])

const createUnifiedModal = (options = {}, slots = {}) => {
  const modal = Plugins.modal(
    {
      footer: false,
      cancel: false,
      submit: false,
      maskClosable: false,
      destroyOnClose: false,
      ...options
    },
    slots
  )
  activeUnifiedModals.add(modal)
  return modal
}

const destroyUnifiedModals = () => {
  for (const modal of [...activeUnifiedModals]) {
    try {
      modal.destroy?.()
    } catch (error) {
      console.warn('[CustomTheme] 清理统一 Modal 失败:', error)
    }
  }
  activeUnifiedModals.clear()
}

const OnlineImage = () => {
  let closed = false
  let validateTimer = null
  let previewVersion = 0
  let importQueued = false

  const previewImage = $el('img')
  previewImage.alt = '图片预览'
  previewImage.referrerPolicy = 'no-referrer'

  const stopPreview = () => {
    previewImage.onload = null
    previewImage.onerror = null
    try {
      previewImage.removeAttribute('src')
    } catch {}
  }

  const content = $el('div', 'ctm-unified-modal-body', '', 'padding:18px 20px 20px; overflow:auto;')
  content.appendChild($el('div', 'ctm-label', '图片 URL'))
  const input = $el('input', 'ctm-input')
  input.type = 'url'
  input.placeholder = 'https://example.com/image.webp'
  input.autocomplete = 'off'
  input.spellcheck = false
  content.appendChild(input)

  const preview = $el('div', 'ctm-preview', '', 'height:225px; margin-top:13px;')
  const previewText = $el('div', 'ctm-preview-text', '输入 URL 后预览图片')
  preview.appendChild(previewImage)
  preview.appendChild(previewText)
  content.appendChild(preview)

  const info = $el('div', 'ctm-hint', '', 'min-height:20px; margin-top:9px; white-space: pre-line;')
  content.appendChild(info)

  const footer = $el('div', 'ctm-footer')
  const cancel = createButton('取消')
  const importButton = createButton('导入图片', true)
  footer.appendChild(cancel)
  footer.appendChild(importButton)
  content.appendChild(footer)

  const stopAndCleanup = () => {
    clearTimeout(validateTimer)
    validateTimer = null
    previewVersion++
    stopPreview()
    try {
      content.remove()
    } catch {}
  }

  let modal = null
  const close = () => {
    if (closed) return
    closed = true
    try {
      modal?.close?.()
    } catch {
      stopAndCleanup()
      try {
        modal?.destroy?.()
      } catch {}
    }
  }

  const showPreviewText = (text) => {
    previewImage.style.display = 'none'
    previewText.style.display = ''
    previewText.textContent = text
  }

  const updatePreview = () => {
    const url = input.value.trim()
    const version = ++previewVersion
    info.textContent = ''
    if (!url) {
      stopPreview()
      showPreviewText('输入 URL 后预览图片')
      return
    }
    try {
      validateImageUrl(url)
    } catch (error) {
      stopPreview()
      showPreviewText(errText(error))
      return
    }
    showPreviewText('正在加载预览...')
    previewImage.onload = () => {
      if (closed || version !== previewVersion) return
      previewImage.style.display = 'block'
      previewText.style.display = 'none'
      info.textContent = `${previewImage.naturalWidth} × ${previewImage.naturalHeight}`
    }
    previewImage.onerror = () => {
      if (closed || version !== previewVersion) return
      showPreviewText('无法加载此图片')
      info.textContent = ''
    }
    previewImage.src = url
  }

  input.oninput = () => {
    clearTimeout(validateTimer)
    validateTimer = setTimeout(updatePreview, 350)
  }

  importButton.onclick = () => {
    if (importQueued) return
    const rawUrl = input.value.trim()
    try {
      validateImageUrl(rawUrl)
    } catch (error) {
      info.textContent = errText(error)
      return
    }
    importQueued = true
    importButton.disabled = true
    cancel.disabled = true
    input.disabled = true
    importButton.textContent = '正在排队...'
    info.textContent = '正在等待主题操作队列...'
    const operation = enqueueThemeOperation(
      async (ctx) => {
        if (closed) throw createCancelledError()
        ctx.assertActive()
        const url = validateImageUrl(rawUrl)
        importButton.textContent = '正在导入...'
        info.textContent = '正在下载图片...'
        const result = await importOnlineImage(url, () => !ctx.isActive())
        if (result?.cancelled) return false
        info.textContent = '图片下载完成，正在应用背景...'
        if (!ctx.isActive() || closed) return true
        await applyThemeInternal(ctx)
        info.textContent = '正在完成导入...'
        close()
        const sizeKB = result.size / 1024
        Plugins.message.success(`在线图片已导入 · ${result.extension} · ${sizeKB.toFixed(2)} KB`, 2200)
        return true
      },
      { label: 'online-image-import' }
    )
    operation.catch(async (error) => {
      const text = errText(error)
      if (text === 'OPERATION_CANCELLED' || text === 'ONLINE_IMPORT_CANCELLED') return
      if (closed) return
      importQueued = false
      importButton.disabled = false
      cancel.disabled = false
      input.disabled = false
      importButton.textContent = '导入图片'
      const message = await describeNetworkError(error)
      info.textContent = message
      Plugins.message.error(message)
    })
  }

  cancel.onclick = () => close()

  const contentComponent = createUnifiedDomContent(content, 'CustomThemeOnlineImageContent')
  modal = createUnifiedModal(
    {
      title: '在线图片',
      width: '600',
      height: 'auto',
      afterClose: () => {
        activeUnifiedModals.delete(modal)
        stopAndCleanup()
        try {
          modal?.destroy?.()
        } catch {}
      }
    },
    {
      title: createUnifiedModalTitle('在线图片', '输入图片 URL，下载后保存到本地'),
      default: () => Vue.h(contentComponent)
    }
  )
  modal.open()
}
/*
 * 「请选择背景」与「请选择要使用的图标」两个选择器骨架完全一致：
 * 统一 Modal -> settled/finish 幂等收尾 -> 头部 -> 内容 -> 底部「取消/确认」。
 * 差异只有宽度、文案、内容构建与确认时取哪个值，故抽出公共骨架，避免两处样板各自漂移。
 * buildContent 需返回 { body, refresh, getSelection }。
 */
const openPickerModal = ({ width, title, subtitle, confirmText, footerStyle = '', height = 'auto' }, buildContent) =>
  new Promise((resolve) => {
    let settled = false
    let resultValue = null
    let confirmBtn = null
    let modal = null

    const content = $el('div', 'ctm-unified-modal-body')
    const finish = (value) => {
      if (settled) return
      settled = true
      resultValue = value
      try {
        modal?.close?.()
      } catch {
        try {
          modal?.destroy?.()
        } catch {}
        resolve(resultValue)
      }
    }

    const setConfirmEnabled = (enabled) => {
      if (confirmBtn) confirmBtn.disabled = !enabled
    }

    let built = {}
    try {
      built = buildContent({ finish, setConfirmEnabled }) || {}
    } catch (error) {
      console.error('[CustomTheme] Modal 内容构建失败:', error)
      resolve(null)
      return
    }

    if (built.body) content.appendChild(built.body)

    const footer = $el('div', 'ctm-footer', '', footerStyle)
    const cancelBtn = createButton('取消')
    cancelBtn.onclick = () => finish(null)
    confirmBtn = createButton(confirmText, true)
    confirmBtn.disabled = true
    confirmBtn.onclick = () => finish(built.getSelection ? built.getSelection() : null)
    footer.appendChild(cancelBtn)
    footer.appendChild(confirmBtn)
    content.appendChild(footer)

    const contentComponent = createUnifiedDomContent(content, `CustomTheme${String(title || 'Picker').replace(/[^a-zA-Z0-9_$-]/g, '')}Content`)
    modal = createUnifiedModal(
      {
        title: title || '',
        width: String(width || 520),
        height: String(height || 'auto'),
        afterClose: () => {
          activeUnifiedModals.delete(modal)
          try {
            content.remove()
          } catch {}
          try {
            modal?.destroy?.()
          } catch {}
          if (!settled) {
            settled = true
            resultValue = null
          }
          resolve(resultValue)
        }
      },
      {
        title: createUnifiedModalTitle(title, subtitle),
        default: () => Vue.h(contentComponent)
      }
    )

    modal.open()
    if (typeof built.refresh === 'function') built.refresh()
  })
const pickPresetBackground = () =>
  openPickerModal(
    {
      width: 520,
      title: '请选择背景',
      subtitle: '单击色块实时预览，双击或点击"应用"确认',
      confirmText: '应用',
      footerStyle: 'padding: 10px 16px 14px;'
    },
    ({ finish, setConfirmEnabled }) => {
      let selectedIndex = null
      const grid = $el(
        'div',
        '',
        '',
        'display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 10px; padding: 12px 16px; overflow: auto; max-height: min(52vh, 420px);'
      )
      const cells = []
      const refresh = () => {
        cells.forEach(({ cell, index }) => {
          if (index === selectedIndex) {
            cell.style.borderColor = 'var(--ct-accent)'
            cell.style.boxShadow = '0 0 0 2px color-mix(in srgb, var(--ct-accent) 30%, transparent)'
          } else {
            cell.style.borderColor = 'var(--ct-border)'
            cell.style.boxShadow = 'none'
          }
        })
        setConfirmEnabled(selectedIndex !== null)
      }
      BACKGROUND_VARIABLE_LIST.forEach(([color, gradient], index) => {
        const cell = $el(
          'div',
          '',
          '',
          `height: 52px; border-radius: 8px; cursor: pointer; border: 1px solid var(--ct-border); background-color: ${color}; background-image: ${gradient}; background-size: cover; background-position: center; transition: border-color .15s ease, box-shadow .15s ease;`
        )
        cell.title = `背景${index + 1}`
        cell.onclick = () => {
          selectedIndex = index
          previewPresetBackground(index)
          refresh()
        }
        cell.ondblclick = () => {
          selectedIndex = index
          previewPresetBackground(index)
          refresh()
          finish(index)
        }
        cells.push({ cell, index })
        grid.appendChild(cell)
      })
      return { body: grid, refresh, getSelection: () => selectedIndex }
    }
  )
/* ==
 * 预设背景
 * == */
const Select = async () => {
  const originalState = captureBackgroundState()
  const index = await pickPresetBackground()
  if (index === null || index === undefined || typeof index !== 'number' || index < 0 || index >= BACKGROUND_VARIABLE_LIST.length) {
    restoreBackgroundState(originalState)
    return false
  }
  const previewVersion = backgroundMutationVersion
  try {
    await enqueueThemeOperation(
      async (ctx) => {
        ctx.assertActive()
        const config = await getCachedConfig()
        ctx.assertActive()
        const newConfig = {
          ...config,
          backgroundIndex: typeof index === 'number' ? Math.max(0, Math.min(index, BACKGROUND_VARIABLE_LIST.length - 1)) : config.backgroundIndex,
          customBackground: ''
        }
        await commitBackgroundRemoval(newConfig)
        if (!ctx.isActive()) {
          return true
        }
        /*
         * commit 成功后正式应用。
         */
        applyPresetBackground(index)
        return true
      },
      {
        label: 'select-background'
      }
    )
    return true
  } catch (error) {
    if (error?.cancelled) {
      if (backgroundMutationVersion === previewVersion) {
        restoreBackgroundState(originalState, previewVersion)
      }
      return false
    }
    console.error('[CustomTheme] Select failed:', error)
    if (backgroundMutationVersion === previewVersion) {
      restoreBackgroundState(originalState, previewVersion)
    }
    Plugins.message.error(errText(error, '保存背景失败'))
    return false
  }
}
const ClearImage = () =>
  enqueueThemeOperation(
    async (ctx) => {
      ctx.assertActive()
      const originalState = captureBackgroundState()
      const config = await getCachedConfig()
      ctx.assertActive()
      const newConfig = { ...config, customBackground: '' }
      try {
        await commitBackgroundRemoval(newConfig)
        if (!ctx.isActive()) {
          return true
        }
        applyPresetBackground(newConfig.backgroundIndex)
        Plugins.message.success('已清除自定义图片背景', 1500)
        return true
      } catch (error) {
        if (ctx.isActive()) {
          restoreBackgroundState(originalState)
          Plugins.message.error(errText(error, '清除自定义图片背景失败'))
        }
        return false
      }
    },
    { label: 'clear-image' }
  )
const clearVariableStyle = () => {
  document.getElementById(VARIABLE_STYLE_ID)?.remove()
}
const clearThemeModalStyle = () => {
  document.getElementById(THEME_MODAL_STYLE_ID)?.remove()
}
const clearCustomStyle = () => {
  document.getElementById(CUSTOM_STYLE_ID)?.remove()
}
const setVariable = (config) => {
  let style = document.getElementById(VARIABLE_STYLE_ID)
  if (!style) {
    style = document.createElement('style')
    style.id = VARIABLE_STYLE_ID
    document.head.appendChild(style) // 必须 append，不能 prepend
  }
  const render = (list) =>
    list
      .map((property) => {
        const value = config?.variable?.[property]
        if (typeof value === 'string' && value.trim()) return `  ${property}: ${value.trim()};`
        return ''
      })
      .filter(Boolean)
      .join('\n')
  const light = render(CONSTANTS.FEATURES.VARIABLE_LIST.filter((property) => property.endsWith('-light')))
  const dark = render(CONSTANTS.FEATURES.VARIABLE_LIST.filter((property) => property.endsWith('-dark')))
  const plain = render(CONSTANTS.FEATURES.VARIABLE_LIST.filter((property) => !/-light$|-dark$/.test(property)))
  style.textContent = [
    light ? `body[theme-mode="light"] {\n${light}\n}` : '',
    dark ? `body[theme-mode="dark"] {\n${dark}\n}` : '',
    plain ? `:root, body {\n${plain}\n}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}
/* ==
 * Custom CSS
 * == */
const setCustomCSS = (css) => {
  let style = document.getElementById(CUSTOM_STYLE_ID)
  if (typeof css !== 'string' || !css.trim()) {
    if (style) style.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = CUSTOM_STYLE_ID
    style.type = 'text/css'
    // 【修复】更稳健的 DOM 插入逻辑，确保永远在变量表之后
    const variableStyle = document.getElementById(VARIABLE_STYLE_ID)
    if (variableStyle && variableStyle.parentNode) {
      // 尝试插在变量表后面
      if (variableStyle.nextSibling) {
        variableStyle.parentNode.insertBefore(style, variableStyle.nextSibling)
      } else {
        variableStyle.parentNode.appendChild(style)
      }
    } else {
      // 兜底：如果变量表还没创建，直接 append 到 head (后续 setVariable 会处理)
      document.head.appendChild(style)
    }
  }
  style.textContent = css
  // 确保自定义 CSS 位于 head 的最后，避免宿主主题/组件后续插入的 style 覆盖用户规则。
  try {
    if (style.parentNode === document.head) {
      document.head.appendChild(style)
    }
  } catch {}
}
const clearCustomCSS = () => {
  document.getElementById(CUSTOM_STYLE_ID)?.remove()
}
/* 【P0 修复】U+FFFD 必须用转义序列表示！
 * 字面字符 '' 在复制/传输中极易丢失变成空字符串，
 * 而 JS 中任何字符串 includes('') 恒为 true，
 * 会导致每次启动都误判“编码损坏”并清空 custom.css。 */
const readCustomCSS = async () => {
  try {
    const raw = await Plugins.ReadFile(CUSTOM_CSS_FILE)
    if (typeof raw !== 'string') return ''

    // 这里只负责读取原始 custom.css，不对 CSS 内容做任何校验。
    // CSS 语法由宿主 CodeEditor / CodeMirror / Prettier 负责处理。
    try {
      const config = await getCachedConfig()
      if (config.customCSSPath !== CUSTOM_CSS_NAME && raw.trim()) {
        config.customCSSPath = CUSTOM_CSS_NAME
        await saveConfig(config)
      }
    } catch (error) {
      console.warn('[CustomTheme] 回填 custom.css 路径到配置失败:', error)
    }

    return raw
  } catch {
    return ''
  }
}
/*
 * CSS 编辑器说明：
 * 插件不实现任何 CSS 语法、安全或格式校验器。
 * CSS 解析、语法诊断与格式化全部交给宿主 CodeEditor / CodeMirror / Prettier。
 */
/*
 * CSS 应用入口。
 */
const applyThemeInternal = async (ctx = null) => {
  ctx?.assertActive()
  ensureThemeModalStyle()
  await migrateStoredConfig()
  ctx?.assertActive()
  const config = await getCachedConfig()
  ctx?.assertActive()
  setVariable(config)
  ctx?.assertActive()
  await setBackground(config, ctx)
  ctx?.assertActive()
  const css = await readCustomCSS()
  ctx?.assertActive()
  setCustomCSS(css)
  return config
}
/*
 ==
 * CSS 编辑器
 * == */
/*
 * ============================================================================
 * CSS 编辑器（宿主 CodeEditor 版）
 *
 * 设计原则：
 * 1. 编辑能力完全交给宿主 CodeEditor / CodeMirror 6。
 * 2. CSS 语法解析与格式化完全交给宿主 CodeEditor / CodeMirror / Prettier。
 * 3. 插件只负责编辑状态、实时预览、文件持久化、保存事务与预览模式。
 * 4. 不在插件里重复实现 textarea / gutter / Tab / Shift+Tab / formatter。
 * 5. 使用 Plugins.modal + CodeMirror 6。
 * ============================================================================
 */
const CustomCSS = async () => {
  const generation = runtimeGeneration
  checkRuntime('CustomCSS', generation)
  ensureThemeModalStyle()
  checkRuntime('CustomCSS', generation)

  const originalCSS = await readCustomCSS()
  checkRuntime('CustomCSS', generation)

  let activeModal = null
  let previewBar = null
  let previewing = false
  let previewSnapshot = ''
  let comparingOriginal = false
  let finalized = false
  let finished = false
  let closingReason = 'none'
  let cleanupPreviewKeydown = null
  let previewKeydownHandler = null
  let cleanupPreviewDrag = null
  let requestEditorFormat = async () => false
  try {
    document.querySelectorAll('[data-ctm-preview-bar]').forEach((node) => node.remove())
  } catch {}

  const state = Vue.reactive({
    css: originalCSS,
    saving: false,
    closed: false
  })

  const cssComponent = Vue.defineComponent({
    name: 'CustomSingBoxCSSPluginEditor',
    setup() {
      const CodeEditor = Vue.resolveComponent('CodeEditor')
      const editorRef = Vue.ref(null)

      const clearCSS = () => {
        if (state.saving || state.closed) return
        state.css = ''
      }

      const restoreCSS = () => {
        if (state.saving || state.closed) return
        state.css = originalCSS
      }

      /*
       * 格式化完全调用宿主 CodeEditor 暴露的 format()。
       * 插件不再访问 CodeMirror DOM，也不模拟 Shift+Alt+F 键盘事件。
       */
      requestEditorFormat = async () => {
        if (state.closed) return false
        if (typeof editorRef.value?.format !== 'function') {
          Plugins.message.error('当前宿主 CodeEditor 不支持格式化接口')
          return false
        }

        try {
          await editorRef.value.format()
          return true
        } catch (error) {
          Plugins.message.error(errText(error, 'CSS 格式化失败'))
          return false
        }
      }

      const setupPreviewBarDrag = () => {
        if (!previewBar || cleanupPreviewDrag) return

        const handle = previewBar.querySelector('.ctm-css-plugin-preview-label')
        if (!handle) return

        let dragging = false
        let pointerId = null
        let offsetX = 0
        let offsetY = 0

        const clampPosition = () => {
          if (!previewBar) return
          const rect = previewBar.getBoundingClientRect()
          const maxLeft = Math.max(8, window.innerWidth - rect.width - 8)
          const maxTop = Math.max(8, window.innerHeight - rect.height - 8)
          const currentLeft = Number.parseFloat(previewBar.style.left)
          const currentTop = Number.parseFloat(previewBar.style.top)
          if (Number.isFinite(currentLeft) && Number.isFinite(currentTop)) {
            previewBar.style.left = `${Math.min(Math.max(currentLeft, 8), maxLeft)}px`
            previewBar.style.top = `${Math.min(Math.max(currentTop, 8), maxTop)}px`
            previewBar.style.right = 'auto'
            previewBar.style.bottom = 'auto'
          }
        }

        const onPointerDown = (event) => {
          if (!previewing || state.closed || event.button !== 0) return
          const rect = previewBar.getBoundingClientRect()
          offsetX = event.clientX - rect.left
          offsetY = event.clientY - rect.top
          dragging = true
          pointerId = event.pointerId
          previewBar.classList.add('is-dragging')
          try {
            handle.setPointerCapture?.(pointerId)
          } catch {}
          event.preventDefault()
          event.stopPropagation()
        }

        const onPointerMove = (event) => {
          if (!dragging || pointerId !== event.pointerId || !previewBar) return
          const rect = previewBar.getBoundingClientRect()
          const maxLeft = Math.max(8, window.innerWidth - rect.width - 8)
          const maxTop = Math.max(8, window.innerHeight - rect.height - 8)
          const left = Math.min(Math.max(event.clientX - offsetX, 8), maxLeft)
          const top = Math.min(Math.max(event.clientY - offsetY, 8), maxTop)
          previewBar.style.left = `${left}px`
          previewBar.style.top = `${top}px`
          previewBar.style.right = 'auto'
          previewBar.style.bottom = 'auto'
          event.preventDefault()
        }

        const stopDragging = (event) => {
          if (!dragging || (pointerId !== null && event.pointerId !== undefined && pointerId !== event.pointerId)) return
          dragging = false
          pointerId = null
          previewBar?.classList.remove('is-dragging')
        }

        const onResize = () => clampPosition()

        handle.addEventListener('pointerdown', onPointerDown)
        handle.addEventListener('pointermove', onPointerMove)
        handle.addEventListener('pointerup', stopDragging)
        handle.addEventListener('pointercancel', stopDragging)
        window.addEventListener('resize', onResize, { passive: true })

        cleanupPreviewDrag = () => {
          handle.removeEventListener('pointerdown', onPointerDown)
          handle.removeEventListener('pointermove', onPointerMove)
          handle.removeEventListener('pointerup', stopDragging)
          handle.removeEventListener('pointercancel', stopDragging)
          window.removeEventListener('resize', onResize)
          try {
            if (pointerId !== null && handle.hasPointerCapture?.(pointerId)) {
              handle.releasePointerCapture?.(pointerId)
            }
          } catch {}
          dragging = false
          pointerId = null
          previewBar?.classList.remove('is-dragging')
          cleanupPreviewDrag = null
        }
      }

      const enterPreviewMode = () => {
        if (state.saving || state.closed || previewing) return
        const cssSnapshot = state.css

        setCustomCSS(cssSnapshot)
        previewSnapshot = cssSnapshot
        comparingOriginal = false
        previewing = true

        if (!previewBar) {
          previewBar = document.createElement('div')
          previewBar.setAttribute('data-ctm-preview-bar', '')
          previewBar.className = 'ctm-css-plugin-preview-bar'
          previewBar.innerHTML = `
            <span class="ctm-css-plugin-preview-dot"></span>
            <span class="ctm-css-plugin-preview-label">预览中</span>
            <button type="button" class="ctm-css-plugin-preview-btn" data-preview-compare>对比原稿</button>
            <button type="button" class="ctm-css-plugin-preview-btn" data-preview-exit>退出预览 (Esc)</button>
          `
          document.body.appendChild(previewBar)
          previewBar.querySelector('[data-preview-compare]')?.addEventListener('click', () => {
            if (!previewing || state.closed) return
            comparingOriginal = !comparingOriginal
            const compareButton = previewBar.querySelector('[data-preview-compare]')
            const label = previewBar.querySelector('.ctm-css-plugin-preview-label')
            if (comparingOriginal) {
              setCustomCSS(originalCSS)
              if (compareButton) compareButton.textContent = '返回修改稿'
              if (label) label.textContent = '对比原稿中'
            } else {
              setCustomCSS(previewSnapshot)
              if (compareButton) compareButton.textContent = '对比原稿'
              if (label) label.textContent = '预览中'
            }
          })
          previewBar.querySelector('[data-preview-exit]')?.addEventListener('click', () => {
            exitPreviewMode()
          })
          setupPreviewBarDrag()
        }

        previewBar.classList.add('is-visible')
        closingReason = 'preview'
        activeModal?.close?.()
        cleanupPreviewKeydown = () => {
          if (previewKeydownHandler) {
            document.removeEventListener('keydown', previewKeydownHandler, true)
            previewKeydownHandler = null
          }
          cleanupPreviewKeydown = null
        }
        const handler = (event) => {
          if (!previewing || state.closed || event.key !== 'Escape') return
          event.preventDefault()
          event.stopPropagation()
          exitPreviewMode()
        }
        previewKeydownHandler = handler
        document.addEventListener('keydown', handler, true)
      }

      const exitPreviewMode = () => {
        if (!previewing) return
        previewing = false
        comparingOriginal = false
        previewBar?.classList.remove('is-visible')
        const compareButton = previewBar?.querySelector('[data-preview-compare]')
        const label = previewBar?.querySelector('.ctm-css-plugin-preview-label')
        if (compareButton) compareButton.textContent = '对比原稿'
        if (label) label.textContent = '预览中'
        if (cleanupPreviewKeydown) {
          cleanupPreviewKeydown()
        }
        try {
          activeModal?.open?.()
        } catch {}
        setCustomCSS(previewSnapshot)
      }

      Vue.onUnmounted(() => {
        finalized = true
        state.closed = true
        if (cleanupPreviewKeydown) {
          cleanupPreviewKeydown()
        }
        cleanupPreviewDrag?.()
        cleanupPreviewDrag = null
        previewBar?.remove()
        previewBar = null
      })

      return () =>
        Vue.h('div', { class: 'ctm-css-plugin-root' }, [
          Vue.h('div', { class: 'ctm-css-plugin-toolbar' }, [
            Vue.h(
              'button',
              {
                class: 'ctm-css-plugin-tool',
                type: 'button',
                disabled: state.saving,
                onClick: clearCSS
              },
              '清空'
            ),
            Vue.h(
              'button',
              {
                class: 'ctm-css-plugin-tool',
                type: 'button',
                disabled: state.saving,
                onClick: restoreCSS
              },
              '恢复'
            ),
            Vue.h(
              'button',
              {
                class: 'ctm-css-plugin-tool',
                type: 'button',
                disabled: state.saving,
                onClick: requestEditorFormat,
                title: 'Shift+Alt+F · 使用宿主 CodeEditor 格式化'
              },
              '格式化'
            ),
            Vue.h('span', { class: 'ctm-css-plugin-toolbar-spacer' }),
            Vue.h(
              'button',
              {
                class: 'ctm-css-plugin-tool',
                type: 'button',
                disabled: state.saving,
                onClick: enterPreviewMode
              },
              '预览'
            )
          ]),
          Vue.h(
            'div',
            {
              class: 'ctm-css-plugin-editor'
            },
            [
              Vue.h(CodeEditor, {
                ref: editorRef,
                modelValue: state.css,
                'aria-keyshortcuts': 'Shift+Alt+F',
                'onUpdate:modelValue': (value) => {
                  state.css = typeof value === 'string' ? value : ''
                },
                lang: 'css',
                editable: true,
                placeholder: '请输入自定义 CSS...'
              })
            ]
          ),
          Vue.h('div', { class: 'ctm-css-plugin-footer' }, [
            Vue.h(
              'button',
              {
                class: 'ctm-css-plugin-footer-btn is-cancel',
                type: 'button',
                disabled: state.saving,
                onClick: handleCancelAndClose
              },
              '取消'
            ),
            Vue.h(
              'button',
              {
                class: 'ctm-css-plugin-footer-btn is-primary',
                type: 'button',
                disabled: state.saving,
                onClick: handleApplyAndClose
              },
              state.saving ? '正在保存...' : '应用并保存'
            )
          ])
        ])
    }
  })

  const finish = () => {
    if (finished) return
    finished = true
    finalized = true
    state.closed = true
    if (cleanupPreviewKeydown) {
      cleanupPreviewKeydown()
    }
    try {
      previewBar?.remove()
    } catch {}
    previewBar = null
    if (activeCSSModal === activeModal) activeCSSModal = null
    activeModal = null
  }

  const restoreOnCancel = () => {
    previewing = false
    comparingOriginal = false
    setCustomCSS(originalCSS)
  }

  const saveCSS = async () => {
    if (finalized || state.saving) return false

    // 等待 CodeEditor 的 300ms change debounce，把最新编辑内容同步到 state。
    await new Promise((resolve) => setTimeout(resolve, 350))
    if (finalized || state.closed) return false

    const css = typeof state.css === 'string' ? state.css : ''
    state.saving = true

    try {
      const operation = enqueueThemeOperation(
        async (ctx) => {
          ctx.assertActive()

          // 语法确认已在进入持久化队列前交给宿主 CodeEditor 完成。
          await saveCustomCSSText(css)

          // 回读确认 I/O 完整性，不解析 CSS。
          let persistedCSS = ''
          try {
            const rawPersisted = await Plugins.ReadFile(CUSTOM_CSS_FILE)
            persistedCSS = typeof rawPersisted === 'string' ? rawPersisted : ''
          } catch (verifyError) {
            throw new Error(`CSS 已写入但回读失败：${errText(verifyError)}`)
          }
          if (persistedCSS !== css) {
            throw new Error('CSS 保存失败：磁盘内容与编辑器内容不一致')
          }

          try {
            const rawPersistedConfig = await Plugins.ReadFile(THEME_FILE)
            const persistedConfig = parseConfigText(rawPersistedConfig)
            if (!persistedConfig || persistedConfig.customCSSPath !== (css.trim() ? CUSTOM_CSS_NAME : '')) {
              throw new Error('主题配置保存失败：customCSSPath 未同步')
            }
          } catch (verifyConfigError) {
            throw new Error(`主题配置保存确认失败：${errText(verifyConfigError)}`)
          }

          setCustomCSS(persistedCSS)
          return true
        },
        { label: 'save-css' }
      )

      const result = await operation
      if (result !== true) throw new Error('CSS 保存操作未完成')

      state.saving = false
      Plugins.message.success('自定义 CSS 已保存', 1600)
      return true
    } catch (error) {
      state.saving = false
      if (error?.cancelled || errText(error) === 'OPERATION_CANCELLED') return false
      Plugins.message.error(errText(error, '保存 CSS 失败'))
      return false
    }
  }

  const handleApplyAndClose = async () => {
    if (state.saving || state.closed) return
    const saved = await saveCSS()
    if (!saved || state.closed) return
    // 保存成功后，再主动关闭 Modal；不再依赖 Plugins.modal 的 onOk 回调链。
    try {
      closingReason = 'save'
      await activeModal?.close?.()
    } catch (error) {
      console.error('[CustomTheme] 关闭 CSS Modal 失败:', error)
      finish()
    }
  }

  const handleCancelAndClose = async () => {
    if (state.saving || state.closed) return
    restoreOnCancel()
    try {
      closingReason = 'cancel'
      await activeModal?.close?.()
    } catch (error) {
      console.error('[CustomTheme] 关闭 CSS Modal 失败:', error)
      finish()
    }
  }

  try {
    activeModal = createUnifiedModal(
      {
        title: '自定义 CSS',
        width: '92',
        height: '92',
        maxWidth: '96',
        maxHeight: '92',
        minWidth: '70',
        minHeight: '65',
        px: 0,
        py: 0,
        afterClose: () => {
          const reason = closingReason
          closingReason = 'none'

          if (reason === 'preview') {
            return
          }

          if (reason !== 'save' && !state.saving && !finished) {
            restoreOnCancel()
          }

          activeUnifiedModals.delete(activeModal)
          try {
            activeModal?.destroy?.()
          } catch {}
          finish()
        }
      },
      {
        title: createUnifiedModalTitle('自定义 CSS'),
        default: () => Vue.h(cssComponent)
      }
    )

    activeCSSModal = activeModal
    activeModal.open()

    return activeModal
  } catch (error) {
    console.error('[CustomTheme] CodeEditor CSS Modal 创建失败:', error)
    try {
      restoreOnCancel()
    } catch {}
    finish()
    Plugins.message.error(errText(error, '打开 CSS 编辑器失败'))
    return null
  }
}

const applyTheme = () => {
  const operation = enqueueThemeOperation(
    async (ctx) => {
      ctx.assertActive()
      return await applyThemeInternal(ctx)
    },
    { label: 'apply-theme' }
  )
  operation.catch((error) => {
    if (error?.cancelled) return
    console.error('[CustomTheme] applyTheme failed:', error)
  })
  return operation
}
const cleanupRuntime = () => {
  /*
   * 让所有旧 generation 的异步任务立即失效。
   */
  invalidateRuntime()
  /*
   * 主动结束插件自己持有的文件选择器 Promise。
   * 无法保证立即关闭原生文件对话框，但 JS listener / Promise 会立即收口。
   */
  for (const cancelPicker of [...activeFilePickerCancellers]) {
    try {
      cancelPicker()
    } catch {}
  }
  activeFilePickerCancellers.clear()
  /*
   * 先关闭 Modal。
   */
  destroyUnifiedModals()
  if (activeCSSModal) {
    try {
      activeCSSModal.destroy?.()
    } catch {}
    activeCSSModal = null
  }
  /*
   * 清理 Blob URL。
   */
  releaseBackgroundObjectUrl()
  /*
   * 清理插件运行时样式。
   */
  clearVariableStyle()
  clearCustomStyle()
  clearThemeModalStyle()
  /*
   * 清理运行时背景。
   */
  clearBackgroundImage()
}
/* ==
 * Clear
 * == */
const Clear = () => {
  /*
   * 只清理插件运行时资源。
   *
   * 不删除 themes.json / custom.css / 图片。
   * 这是 disable / dispose 使用的。
   */
  clearVariableStyle()
  clearCustomStyle()
  clearThemeModalStyle() // 【修复】补全 Modal 样式清理
  clearBackgroundImage()
  /*
   * 防止 root 上存在旧变量。
   */
  const root = document.documentElement
  CONSTANTS.FEATURES.VARIABLE_LIST.forEach((property) => {
    try {
      root.style.removeProperty(property)
    } catch {}
  })
}
const resetThemeInternal = async () => {
  const config = { variable: {}, backgroundIndex: 0, customBackground: '' }
  await commitBackgroundRemoval(config)
  await saveCustomCSSText('')
  clearCustomCSS()
  return config
}
const Reset = async (isReset = true) => {
  if (isReset) {
    const confirmed = await confirmDialog('提示', '主题文件、背景图片和自定义 CSS 将恢复默认！')
    if (!confirmed) {
      Plugins.message.info('已取消重置', 1200)
      return false
    }
  }
  try {
    const result = await enqueueThemeOperation(
      async (ctx) => {
        ctx.assertActive()
        await resetThemeInternal()
        // commit 已完成后，不因为生命周期变化回滚磁盘状态
        if (!ctx.isActive()) {
          return true
        }
        await applyThemeInternal(ctx)
        Plugins.message.success('重置成功', 1200)
        return true
      },
      { label: 'reset-theme' }
    )
    return result === true
  } catch (error) {
    if (error?.cancelled) return false
    console.error('[CustomTheme] Reset failed:', error)
    Plugins.message.error(errText(error, '重置失败'))
    return false
  }
}
/* ==
 * 自定义图标
 * == */
const decodeIcoPrefix = (base64) => {
  const bytes = decodeBase64Prefix(base64)
  if (bytes.length < 6) return false
  if (bytes[0] !== 0x00 || bytes[1] !== 0x00 || bytes[2] !== 0x01 || bytes[3] !== 0x00) return false
  // 【修复】校验 ICO 目录中的图像数量 (Little Endian)，防止恶意构造的超大 count 导致内存溢出
  const imageCount = bytes[4] | (bytes[5] << 8)
  if (imageCount <= 0 || imageCount > 50) return false
  return true
}
/*
 * PNG / ICO 的校验流程完全一致（大小 -> 读前缀 -> 魔数比对），
 * 只有文件类型标签与魔数判定不同，这里抽成公共方法避免两处逻辑漂移。
 */
const validateIconFileByMagic = async (path, { label, match }) => {
  const size = await getFileSize(path)
  if (size === FILE_SIZE_UNKNOWN) {
    throw new Error(`${label} 图标文件不存在或无法读取`)
  }
  if (size <= 0 || size > ICON_MAX_FILE_SIZE) {
    throw new Error(`${label} 图标大小无效：${size} 字节（限制 ${ICON_MAX_FILE_SIZE}）`)
  }
  const base64 = await readFilePrefix(path, 32)
  if (typeof base64 !== 'string' || !base64) {
    throw new Error(`${label} 图标读取失败`)
  }
  if (!match(base64)) {
    throw new Error(`文件不是有效 ${label} 图标`)
  }
  return true
}
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const validatePngFile = (path) =>
  validateIconFileByMagic(path, {
    label: 'PNG',
    match: (base64) => {
      const bytes = decodeBase64Prefix(base64)
      return bytes.length >= PNG_MAGIC_BYTES.length && PNG_MAGIC_BYTES.every((byte, i) => bytes[i] === byte)
    }
  })
const validateIcoFile = (path) => validateIconFileByMagic(path, { label: 'ICO', match: decodeIcoPrefix })
/* 【P0-2】Linux 托盘只认 PNG，而 icon-hub 只提供 ICO，
 * 用浏览器 Canvas 做一次格式转换，否则 Linux 上该功能等于不存在。 */
const icoToPngBase64 = (base64) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      try {
        // 【修复】兼容 Linux 托盘高分辨率需求，防止 ICO 解析出极小尺寸
        let size = image.naturalWidth || 64
        if (size < 32) size = 64 // 强制保底 64x64，确保 Linux 托盘清晰度
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, size, size)
        ctx.imageSmoothingEnabled = true // 开启平滑
        ctx.imageSmoothingQuality = 'high' // 高质量缩放
        ctx.drawImage(image, 0, 0, size, size)
        const dataUrl = canvas.toDataURL('image/png')
        const commaIndex = dataUrl.indexOf(',')
        resolve(commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : '')
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => reject(new Error('图标格式无法解析或当前 WebView 不支持 ICO 渲染'))
    image.src = `data:image/x-icon;base64,${base64}`
  })
const pickIconOption = (entries) =>
  openPickerModal(
    {
      width: 420,
      title: '请选择要使用的图标',
      subtitle: '选中后点击"确定"开始下载并替换',
      confirmText: '确定',
      footerStyle: 'padding: 10px 14px 14px;'
    },
    ({ finish, setConfirmEnabled }) => {
      const maxIcons = Math.max(...entries.map((entry) => entry.icons.length))
      const zoneWidth = maxIcons * (ICON_PICK_SIZE + ICON_PICK_GAP) - ICON_PICK_GAP
      let selectedId = null
      const list = $el('div', '', '', 'display: flex; flex-direction: column; gap: 6px; padding: 10px 14px 4px; overflow: auto;')
      const rows = []
      const stripeOf = (index) => (index % 2 === 0 ? 'var(--ct-table-odd)' : 'var(--ct-table-even)')
      const refresh = () => {
        rows.forEach(({ row, id, index }) => {
          if (id === selectedId) {
            row.style.background = 'color-mix(in srgb, var(--ct-accent) 16%, transparent)'
            row.style.borderColor = 'var(--ct-accent)'
          } else {
            row.style.background = stripeOf(index)
            row.style.borderColor = 'transparent'
          }
        })
        setConfirmEnabled(selectedId !== null && selectedId !== undefined)
      }
      entries.forEach((entry, index) => {
        const row = $el(
          'div',
          '',
          '',
          `display: flex; align-items: center; gap: 12px; padding: 9px 12px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; background: ${stripeOf(index)}; transition: background .15s ease, border-color .15s ease;`
        )
        const iconBox = $el('div', '', '', `flex: 0 0 ${zoneWidth}px; display: flex; align-items: center; justify-content: center; gap: ${ICON_PICK_GAP}px;`)
        entry.icons.forEach(({ url }) => {
          const img = $el('img')
          img.src = url
          img.alt = ''
          img.style.cssText = `width: ${ICON_PICK_SIZE}px; height: ${ICON_PICK_SIZE}px; object-fit: contain;`
          img.onerror = () => {
            img.style.visibility = 'hidden'
          }
          iconBox.appendChild(img)
        })
        const title = $el(
          'div',
          '',
          entry.title,
          'flex: 1; min-width: 0; font-size: 13px; color: var(--ct-color-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
        )
        row.appendChild(iconBox)
        row.appendChild(title)
        row.onclick = () => {
          selectedId = entry.id
          refresh()
        }
        row.onmouseenter = () => {
          if (entry.id !== selectedId) row.style.background = 'var(--ct-button-hover-bg)'
        }
        row.onmouseleave = () => {
          if (entry.id !== selectedId) row.style.background = stripeOf(index)
        }
        rows.push({ row, id: entry.id, index })
        list.appendChild(row)
      })
      return { body: list, refresh, getSelection: () => selectedId }
    }
  )
const resolveIconRepoPath = (iconId, name) => {
  return `${ICON_REPO_DIR}/${iconId}/${name}.ico`
}
// 优化后的CustomIcon函数（关键部分）
const CustomIcon = async () => {
  const generation = runtimeGeneration
  checkRuntime('CustomIcon', generation)
  ensureThemeModalStyle()
  checkRuntime('CustomIcon', generation)
  const ALLOWED_ICON_HOSTS = CONSTANTS.FEATURES.ALLOWED_ICON_HOSTS
  const validateIconUrl = (url) => {
    try {
      const u = new URL(url)
      if (!['http:', 'https:'].includes(u.protocol)) {
        return false
      }
      return ALLOWED_ICON_HOSTS.some((host) => u.hostname === host || u.hostname.endsWith(`.${host}`))
    } catch {
      return false
    }
  }

  const ICON_BASE = 'https://github.com/clash-verge-rev/icon-hub/raw/main'
  const iconMap = {
    huorong: {
      title: 'huorong 火绒图标',
      icons: {
        tray_normal: `${ICON_BASE}/huorong/common.ico`,
        tray_proxy: `${ICON_BASE}/huorong/sysproxy.ico`,
        tray_tun: `${ICON_BASE}/huorong/tun.ico`
      }
    },
    vergeRevColorful: {
      title: 'ClashVergeRev 彩色',
      icons: {
        tray_normal: `${ICON_BASE}/official-cat/common.ico`,
        tray_proxy: `${ICON_BASE}/official-cat/sysproxy.ico`,
        tray_tun: `${ICON_BASE}/official-cat/tun.ico`
      }
    },
    vergeRevLight: {
      title: 'ClashVergeRev 亮色',
      icons: {
        tray_normal: `${ICON_BASE}/official-white/common.ico`,
        tray_proxy: `${ICON_BASE}/official-white/sysproxy.ico`,
        tray_tun: `${ICON_BASE}/official-white/tun.ico`
      }
    },
    vergeRevDark: {
      title: 'ClashVergeRev 暗色',
      icons: {
        tray_normal: `${ICON_BASE}/official-black/common.ico`,
        tray_proxy: `${ICON_BASE}/official-black/sysproxy.ico`,
        tray_tun: `${ICON_BASE}/official-black/tun.ico`
      }
    },
    [Plugins.APP_TITLE]: {
      title: Plugins.APP_TITLE,
      default: true,
      icons: {
        tray_normal: '/favicon.ico'
      }
    }
  }
  const resolvePreview = async (iconId, name, remoteUrl) => {
    if (iconId === Plugins.APP_TITLE) {
      return remoteUrl
    }
    const repoPath = resolveIconRepoPath(iconId, name)
    try {
      if (await fileExists(repoPath)) {
        const base64 = await Plugins.ReadFile(repoPath, { Mode: 'Binary' })
        if (typeof base64 === 'string' && base64) {
          return `data:image/x-icon;base64,${base64}`
        }
      }
    } catch {}
    return remoteUrl
  }
  /*
   * ------------------------------------------------------
   * 阶段 1：只构建 Modal，不进入 Queue
   * ------------------------------------------------------
   *
   * 这一阶段虽然不写磁盘，但会 await 文件读取；
   * 所以同样必须绑定当前 runtime generation，防止 dispose/reload 后再次创建 Modal。
   */
  const entries = []
  for (const [id, item] of Object.entries(iconMap)) {
    // 将 item.icons 的每一项转换为 Promise
    const iconPromises = Object.entries(item.icons).map(async ([name, url]) => {
      checkRuntime('resolvePreview', generation)
      const previewUrl = await resolvePreview(id, name, url)
      checkRuntime('resolvePreview', generation)
      return { name, url: previewUrl }
    })
    // 等待该组图标全部预加载完成
    const resolvedIcons = await Promise.all(iconPromises)
    entries.push({
      id,
      title: item.title,
      default: !!item.default,
      icons: resolvedIcons
    })
  }
  /*
   * Modal 在 Queue 外面。
   */
  // 显示选择界面
  checkRuntime('pickIconOption')
  const iconId = await pickIconOption(entries)
  checkRuntime('pickIconOption')

  if (iconId === null || iconId === undefined) {
    return false
  }
  if (!iconMap[iconId]) {
    Plugins.message.error(`无效的图标：${iconId}`)
    return false
  }
  /*
   * ------------------------------------------------------
   * 阶段 2：用户选完以后才进入 Queue
   * ------------------------------------------------------
   */
  const operation = enqueueThemeOperation(
    async (ctx) => {
      ctx.assertActive()
      await cleanupIconTempFiles()
      await purgeLegacyFiles()
      const selectedIcon = iconMap[iconId]
      if (selectedIcon.default) {
        const { restored, pending } = await resetOwnedIcons()
        if (pending.length) {
          Plugins.message.warn(`已恢复默认图标，但有 ${pending.length} 个文件缺少原厂备份，需重启客户端重建`, 2600)
        } else {
          Plugins.message.success(`已恢复默认图标（${restored.length} 个）`, 1500)
        }
        return {
          installed: true,
          refreshed: false
        }
      }
      const loading = Plugins.message.info('正在下载并验证全部图标...', 999999)
      const token = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const staged = []
      try {
        /*
         * 这里放你原来的下载、
         * 校验、ICO → PNG、stage 逻辑。
         *
         * 但是不再在这里创建选择 Modal。
         */
        for (const [name, url] of Object.entries(selectedIcon.icons)) {
          ctx.assertActive()
          const rawTemp = `${ICON_CACHE_DIR}/${ICON_TEMP_PREFIX}${token}_${name}.raw.tmp`
          const runtimeTemp = `${ICON_CACHE_DIR}/${ICON_TEMP_PREFIX}${token}_${name}.tmp`
          const darkPath = `${ICON_CACHE_DIR}/${name}_dark${ICON_EXT}`
          const lightPath = `${ICON_CACHE_DIR}/${name}_light${ICON_EXT}`
          const repoPath = `${ICON_REPO_DIR}/${iconId}/${name}.ico`
          await safeRemoveFile(rawTemp)
          await safeRemoveFile(runtimeTemp)
          let sourceIsLocal = false
          if (await fileExists(repoPath)) {
            try {
              await validateIcoFile(repoPath)
              await Plugins.CopyFile(repoPath, rawTemp)
              await validateIcoFile(rawTemp)
              sourceIsLocal = true
            } catch {
              await safeRemoveFile(rawTemp)
            }
          }
          if (!validateIconUrl(url)) {
            throw new Error(`图标源域名不受信任：${url}`)
          }
          if (!sourceIsLocal) {
            if (typeof Plugins.HttpHead === 'function') {
              try {
                const head = await Plugins.HttpHead(url)
                const headers = head?.headers || head || {}
                const len = Number(headers['content-length'] ?? headers['Content-Length'])
                if (Number.isFinite(len) && len > ICON_MAX_FILE_SIZE) {
                  throw new Error(`图标源过大（${len} 字节，限制 ${ICON_MAX_FILE_SIZE}）`)
                }
              } catch (headError) {
                if (headError instanceof Error && headError.message.includes('图标源过大')) throw headError
                console.warn('[CustomIcon] 图标大小预检失败，交由下载后校验兜底:', headError)
              }
            }
            const response = await Plugins.Download(url, rawTemp, undefined, undefined, { Timeout: ICON_DOWNLOAD_TIMEOUT_SECONDS })
            const status = response?.status
            if (typeof status === 'number' && (status < 200 || status >= 300)) {
              throw new Error(`图标下载失败：HTTP ${status}`)
            }
            await validateIcoFile(rawTemp)
            try {
              await Plugins.CopyFile(rawTemp, repoPath)
              console.log('[CustomIcon] 原始 ICO 已缓存:', repoPath)
            } catch (cacheError) {
              console.warn('[CustomIcon] 图标本地缓存失败:', cacheError)
            }
          }
          let sourceTemp = rawTemp
          if (ICON_ENV.isLinux) {
            const rawBase64 = await Plugins.ReadFile(rawTemp, { Mode: 'Binary' })
            const pngBase64 = await icoToPngBase64(rawBase64)
            await Plugins.WriteFile(runtimeTemp, pngBase64, { Mode: 'Binary' })
            sourceTemp = runtimeTemp
          }
          if (ICON_ENV.isLinux) {
            await validatePngFile(sourceTemp)
          } else {
            await validateIcoFile(sourceTemp)
          }
          staged.push({
            name,
            rawTemp,
            runtimeTemp,
            sourceTemp,
            darkPath,
            lightPath
          })
        }
        ctx.assertActive()
        const getOwnedIconTransactionTargets = () =>
          getOwnedIconPaths().map((path) => ({
            path,
            name: `icon-${String(path).split('/').pop()}`
          }))
        ctx.assertActive()
        await executeBackgroundTransaction(
          async () => {
            await installOwnedIcons(staged, token)
          },
          {
            extraTargets: getOwnedIconTransactionTargets()
          }
        )
        return {
          installed: true,
          refreshed: false,
          title: selectedIcon.title
        }
      } finally {
        await cleanupIconTempFiles()
        try {
          loading?.destroy?.()
        } catch {}
      }
    },
    {
      label: 'custom-icon'
    }
  )
  let result
  try {
    result = await operation
  } catch (error) {
    if (error?.cancelled || errText(error) === 'OPERATION_CANCELLED') {
      return false
    }
    console.error('[CustomIcon] 图标替换失败:', error)
    Plugins.message.error(errText(error, '图标替换失败'))
    return false
  }
  /*
   * ------------------------------------------------------
   * Queue 已释放
   * 现在才允许弹确认框
   * ------------------------------------------------------
   */
  if (!result?.installed) {
    return false
  }
  if (!runtimeActive) {
    return false
  }
  let refreshed = false
  try {
    await refreshTrayIcon()
    refreshed = true
  } catch (error) {
    console.warn('[CustomIcon] 实时刷新托盘失败:', error)
  }
  if (refreshed) {
    Plugins.message.success('托盘图标已刷新', 1500)
    return true
  }
  /*
   * 非常重要：
   * confirmDialog 绝不能处于 enqueueThemeOperation 内部。
   */
  try {
    const restart = await confirmDialog('操作完成', '图标已经替换完成，但当前宿主无法实时刷新托盘，是否立即重启客户端？')
    if (restart) {
      await Plugins.RestartApp()
    }
  } catch (error) {
    console.error('[CustomIcon] 重启客户端失败:', error)
    Plugins.message.error('重启客户端失败')
  }
  return true
}
const getCurrentThemeMode = () => {
  const mode = document.body?.getAttribute('theme-mode')
  return mode === 'dark' ? 'dark' : 'light'
}
const getCurrentTrayIconPath = () => {
  const mode = getCurrentThemeMode()
  return `${ICON_CACHE_DIR}/` + `tray_normal_${mode}${ICON_EXT}`
}
const refreshTrayIcon = async () => {
  const iconPath = getCurrentTrayIconPath()
  if (!(await fileExists(iconPath))) {
    throw new Error(`托盘图标不存在：${iconPath}`)
  }
  if (typeof Plugins.UpdateTray !== 'function') {
    throw new Error('宿主不支持 UpdateTray')
  }
  await Plugins.UpdateTray({
    icon: iconPath
  })
  return iconPath
}
const onInstall = () => {
  beginRuntime()
  enqueueThemeOperation(
    async (ctx) => {
      ctx.assertActive()
      ensureThemeModalStyle()
      await startup()
      ctx.assertActive()
      const exists = await fileExists(THEME_FILE)
      if (!exists) {
        await saveConfig(DEFAULT_CONFIG)
      }
      ctx.assertActive()
      await ensureFactoryIconBackup()
      ctx.assertActive()
      await applyThemeInternal(ctx)
      return 0
    },
    { label: 'onInstall' }
  ).catch((error) => {
    if (error?.cancelled) return
    console.error('[CustomTheme] onInstall failed:', error)
    Plugins.message.error(errText(error, '插件安装初始化失败'))
  })
  return 0
}
let uninstalling = false
const onUninstall = async () => {
  if (uninstalling) return 0
  const confirmed = await confirmDialog('提示', '卸载后，主题配置、自定义背景、自定义 CSS 以及本插件创建的图标缓存将被删除！')
  if (!confirmed) {
    Plugins.message.info('已取消卸载', 1200)
    return 0
  }
  uninstalling = true
  /*
   * 先让所有尚未开始的普通任务失效。
   */
  invalidateRuntime()
  /*
   * 关闭所有 UI。
   */
  destroyUnifiedModals()
  try {
    /*
     * 等待当前正在执行的 Queue 操作彻底结束。
     *
     * themeOperationQueue 自身已经通过 catch 保证不会 rejected，
     * 所以这里不会因为普通任务失败而中断卸载流程。
     */
    await themeOperationQueue
    /*
     * Queue 已经收口以后，再删除文件。
     */
    const removed = await runUninstallCleanup()
    if (removed) {
      Plugins.message.success('卸载清理完成', 1500)
    } else {
      Plugins.message.warn('插件运行时已清理，但插件目录删除失败，请稍后手动清理', 2600)
    }
    return 0
  } catch (error) {
    console.error('[CustomTheme] 卸载清理失败:', error)
    Plugins.message.error(errText(error, '卸载清理失败'))
    return 0
  } finally {
    uninstalling = false
  }
}
const runUninstallCleanup = async () => {
  try {
    await resetOwnedIcons()
  } catch (error) {
    console.error('[CustomTheme] 恢复默认图标失败:', error)
    throw error
  }
  await cleanupIconTempFiles()
  await cleanupPluginTempFiles()
  let removed = true
  try {
    await Plugins.RemoveFile(PATH)
  } catch (error) {
    removed = false
    console.warn('[CustomTheme] 删除插件目录失败:', error)
  }
  return removed
}
const onReady = () => {
  beginRuntime()
  enqueueThemeOperation(
    async (ctx) => {
      ctx.assertActive()
      await startup()
      ctx.assertActive()
      await applyThemeInternal(ctx)
      return 0
    },
    { label: 'onReady' }
  ).catch((error) => {
    if (error?.cancelled) return
    console.error('[CustomTheme] onReady failed:', error)
    Plugins.message.error(errText(error, '主题初始化失败'))
  })
  return 0
}
const onRun = () => {
  beginRuntime()
  enqueueThemeOperation(
    async (ctx) => {
      ctx.assertActive()
      await applyThemeInternal(ctx)
      if (ctx.isActive()) {
        Plugins.message.success('主题已生效', 1200)
      }
      return 0
    },
    { label: 'onRun' }
  ).catch((error) => {
    if (error?.cancelled) return
    console.error('[CustomTheme] onRun failed:', error)
    Plugins.message.error(errText(error, '主题应用失败'))
  })
  return 0
}
const handleLifecycleCleanup = (functionName) => {
  try {
    cleanupRuntime()
  } catch (error) {
    console.warn(`[CustomTheme] ${functionName} 清理失败:`, error)
  }
  return 0
}

const onDisabled = () => handleLifecycleCleanup('onDisabled')
const onDispose = () => handleLifecycleCleanup('onDispose')
const onReload = () => handleLifecycleCleanup('onReload')
const onConfigure = () => {
  ensureThemeModalStyle()
  try {
    console.log('[CustomTheme] 环境自检', {
      platform: ICON_ENV.isLinux ? 'linux' : 'windows/macos',
      iconDir: ICON_CACHE_DIR,
      iconExt: ICON_EXT,
      iconRepoDir: ICON_REPO_DIR,
      iconFactoryDir: ICON_FACTORY_DIR,
      hasHttpHead: typeof Plugins.HttpHead === 'function',
      hasCopyFile: typeof Plugins.CopyFile === 'function',
      hasUpdateTray: typeof Plugins.UpdateTray === 'function',
      hasRestartApp: typeof Plugins.RestartApp === 'function'
    })
    /*
     * onConfigure 不能改成 async（返回值是退出码），用 then 单独打一条。
     */
    getRequestProxyInfo()
      .then((proxy) => {
        console.log('[CustomTheme] 请求代理:', proxy === null ? '未知' : proxy || '空（图片下载会直连）')
      })
      .catch((error) => {
        console.warn('[CustomTheme] 请求代理自检失败:', error)
      })
  } catch {}
  return 0
}
