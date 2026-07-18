const DATA_PATH = 'data/third/plugin-skin-manager'
const CATALOG_FILE = 'themes.json'
const CATALOG_REVISION = 3
const STATE_FILE = 'state.json'
const FALLBACK_REMOTE_PATH = 'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-skin-manager'
const ATTRIBUTE_NAME = 'data-gui-skin'
const DEFAULT_THEME_ID = 'miku'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const styleId = Plugin.id + '-applied-style'
  const layerId = Plugin.id + '-motion-layer'
  const uiStyleId = Plugin.id + '-ui-style'
  let cleanupMotion
  let cleanupDecorations

  const getRemotePath = () => {
    try {
      const url = new URL(Plugin.url)
      const pathname = url.pathname.replace(/\/Generic\/[^/]+$/, `/Resources/${Plugin.id}`)
      if (pathname === url.pathname) return FALLBACK_REMOTE_PATH
      url.pathname = pathname
      url.search = ''
      url.hash = ''
      return url.href.replace(/\/$/, '')
    } catch {
      return FALLBACK_REMOTE_PATH
    }
  }

  const normalizeRelativePath = (value) => {
    const path = String(value || '')
      .replaceAll('\\', '/')
      .replace(/^\.\//, '')
    if (!path || path.startsWith('/') || path.includes('../') || !/^[a-z0-9_./-]+$/i.test(path)) {
      throw new Error(`皮肤资源路径无效: ${value}`)
    }
    return path
  }

  const localPath = (relativePath) => `${DATA_PATH}/${normalizeRelativePath(relativePath)}`
  const remoteUrl = (relativePath) => `${getRemotePath()}/${normalizeRelativePath(relativePath)}`
  const directoryOf = (relativePath) => normalizeRelativePath(relativePath).split('/').slice(0, -1).join('/')
  const resolveSibling = (baseFile, sibling) => [directoryOf(baseFile), normalizeRelativePath(sibling)].filter(Boolean).join('/')

  const readJson = async (relativePath) => JSON.parse(await Plugins.ReadFile(localPath(relativePath)))

  const validateCatalog = (catalog) => {
    if (catalog?.schemaVersion !== 1 || catalog.revision !== CATALOG_REVISION || !Array.isArray(catalog.themes) || catalog.themes.length === 0) {
      throw new Error('皮肤目录格式无效')
    }
    const ids = new Set()
    for (const item of catalog.themes) {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(item?.id || '') || ids.has(item.id)) throw new Error(`皮肤目录 ID 无效: ${item?.id}`)
      normalizeRelativePath(item.manifest)
      ids.add(item.id)
    }
    return catalog
  }

  const validateTheme = (theme, entry) => {
    if (
      theme?.schemaVersion !== 2 ||
      theme.id !== entry.id ||
      typeof theme.name !== 'string' ||
      !theme.name.trim() ||
      typeof theme.files?.stylesheet !== 'string' ||
      typeof theme.files?.background !== 'string' ||
      typeof theme.files?.backgroundMime !== 'string' ||
      !theme.files.backgroundMime.startsWith('image/') ||
      !theme.variables ||
      typeof theme.variables !== 'object' ||
      Array.isArray(theme.variables)
    ) {
      throw new Error(`皮肤配置格式无效: ${entry.id}`)
    }
    for (const [property, value] of Object.entries(theme.variables)) {
      if (!/^--[a-z0-9-]+$/.test(property) || typeof value !== 'string') throw new Error(`皮肤变量无效: ${entry.id}/${property}`)
    }
    if (theme.decorations !== undefined) {
      if (!Array.isArray(theme.decorations) || theme.decorations.length > 16) throw new Error(`皮肤装饰配置无效: ${entry.id}`)
      const decorationNames = new Set()
      for (const decoration of theme.decorations) {
        if (
          !/^[a-z0-9][a-z0-9-]*$/.test(decoration?.name || '') ||
          decorationNames.has(decoration.name) ||
          !/^\.[a-z][a-z0-9_-]*$/i.test(decoration?.selector || '') ||
          !Array.isArray(decoration.items) ||
          decoration.items.length > 32
        ) {
          throw new Error(`皮肤装饰配置无效: ${entry.id}/${decoration?.name || 'unknown'}`)
        }
        const itemNames = new Set()
        for (const item of decoration.items) {
          if (!/^[a-z0-9][a-z0-9-]*$/.test(item?.name || '') || itemNames.has(item.name) || typeof item.text !== 'string' || item.text.length > 8) {
            throw new Error(`皮肤装饰项无效: ${entry.id}/${decoration.name}`)
          }
          itemNames.add(item.name)
        }
        decorationNames.add(decoration.name)
      }
    }
    return theme
  }

  const readCatalog = async () => validateCatalog(await readJson(CATALOG_FILE))

  const readTheme = async (entry, includeContent = false) => {
    const theme = validateTheme(await readJson(entry.manifest), entry)
    const stylesheetPath = resolveSibling(entry.manifest, theme.files.stylesheet)
    const backgroundPath = resolveSibling(entry.manifest, theme.files.background)
    if (!includeContent) return { ...theme, entry, stylesheetPath, backgroundPath }
    const [stylesheet, background] = await Promise.all([
      Plugins.ReadFile(localPath(stylesheetPath)),
      Plugins.ReadFile(localPath(backgroundPath), { Mode: 'Binary' })
    ])
    if (!stylesheet.trim() || !background) throw new Error(`皮肤资源不完整: ${theme.name}`)
    return { ...theme, entry, stylesheetPath, backgroundPath, stylesheet, background }
  }

  const writeState = async (state) => {
    await Plugins.WriteFile(localPath(STATE_FILE), JSON.stringify(state, null, 2))
  }

  const readState = async () => {
    if (!(await Plugins.FileExists(localPath(STATE_FILE)))) {
      const state = { selectedThemeId: DEFAULT_THEME_ID, enabled: true }
      await writeState(state)
      return state
    }
    try {
      const state = await readJson(STATE_FILE)
      return {
        selectedThemeId: typeof state.selectedThemeId === 'string' ? state.selectedThemeId : DEFAULT_THEME_ID,
        enabled: state.enabled !== false
      }
    } catch {
      const state = { selectedThemeId: DEFAULT_THEME_ID, enabled: true }
      await writeState(state)
      return state
    }
  }

  const downloadFile = async (relativePath) => {
    const directory = directoryOf(relativePath)
    if (directory) await Plugins.MakeDir(`${DATA_PATH}/${directory}`)
    await Plugins.Download(remoteUrl(relativePath), localPath(relativePath))
  }

  const downloadAssets = async () => {
    await Plugins.MakeDir(DATA_PATH)
    await downloadFile(CATALOG_FILE)
    const catalog = await readCatalog()
    for (const entry of catalog.themes) {
      await downloadFile(entry.manifest)
      const theme = await readTheme(entry)
      await Promise.all([downloadFile(theme.stylesheetPath), downloadFile(theme.backgroundPath)])
    }
    const state = await readState()
    if (!catalog.themes.some((item) => item.id === state.selectedThemeId)) {
      await writeState({ selectedThemeId: catalog.themes[0].id, enabled: state.enabled })
    }
    return catalog
  }

  const ensureAssets = async () => {
    if (!(await Plugins.FileExists(localPath(CATALOG_FILE)))) return downloadAssets()
    try {
      const catalog = await readCatalog()
      for (const entry of catalog.themes) {
        if (!(await Plugins.FileExists(localPath(entry.manifest)))) return downloadAssets()
        const theme = await readTheme(entry)
        const checks = await Promise.all([Plugins.FileExists(localPath(theme.stylesheetPath)), Plugins.FileExists(localPath(theme.backgroundPath))])
        if (checks.some((exists) => !exists)) return downloadAssets()
      }
      return catalog
    } catch {
      return downloadAssets()
    }
  }

  const isReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true || document.body.getAttribute('feature-no-animation') === 'true'

  const clampInteger = (value, min, max, fallback = min) => (Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback)
  const clampNumber = (value, min, max, fallback) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback)

  const createMotionLayer = (theme) => {
    const motion = theme.motion
    if (!motion || isReducedMotion()) return undefined

    const layer = document.createElement('div')
    layer.id = layerId
    layer.setAttribute('data-skin-motion-layer', '')
    layer.setAttribute('data-skin-theme', theme.id)
    layer.setAttribute('aria-hidden', 'true')
    layer.inert = true

    const particles = Array.isArray(motion.particles) ? motion.particles.slice(0, 12) : []
    particles.forEach((group, groupIndex) => {
      const type = /^[a-z0-9-]+$/.test(group?.type || '') ? group.type : `particle-${groupIndex}`
      const count = clampInteger(group?.count, 0, 60, 0)
      const symbols = Array.isArray(group?.symbols) ? group.symbols.map(String).filter(Boolean).slice(0, 12) : []
      const xOffset = clampNumber(group?.xOffset, 0, 100, 11 + groupIndex * 13)
      const xStep = clampNumber(group?.xStep, 1, 100, 37)
      const yOffset = clampNumber(group?.yOffset, 0, 100, 7 + groupIndex * 17)
      const yStep = clampNumber(group?.yStep, 1, 100, 53)
      const sizeBase = clampNumber(group?.sizeBase, 1, 80, 3 + groupIndex * 3)
      const sizeStep = clampNumber(group?.sizeStep, 0, 20, 2)
      const sizeCycle = clampInteger(group?.sizeCycle, 1, 12, 4)
      const driftBase = clampNumber(group?.driftBase, 0, 120, 16)
      const driftStep = clampNumber(group?.driftStep, 0, 40, 8)
      const driftCycle = clampInteger(group?.driftCycle, 1, 12, 4)
      const delayStep = clampNumber(group?.delayStep, 0, 10, 0.72)
      const delayCycle = clampInteger(group?.delayCycle, 1, 20, 9)
      const durationBase = clampNumber(group?.durationBase, 0.2, 60, 4.2 + groupIndex * 2.8)
      const durationStep = clampNumber(group?.durationStep, 0, 10, 0.72)
      const durationCycle = clampInteger(group?.durationCycle, 1, 20, 5)
      for (let index = 0; index < count; index++) {
        const particle = document.createElement('span')
        particle.setAttribute('data-skin-particle', type)
        if (symbols.length) particle.textContent = symbols[index % symbols.length].slice(0, 3)
        particle.style.setProperty('--skin-index', index)
        particle.style.setProperty('--skin-x', `${(index * xStep + xOffset) % 97}%`)
        particle.style.setProperty('--skin-y', `${(index * yStep + yOffset) % 89}%`)
        particle.style.setProperty('--skin-size', `${sizeBase + (index % sizeCycle) * sizeStep}px`)
        particle.style.setProperty('--skin-drift', `${(index % 2 ? 1 : -1) * (driftBase + (index % driftCycle) * driftStep)}px`)
        particle.style.setProperty('--skin-delay', `${-(index % delayCycle) * delayStep}s`)
        particle.style.setProperty('--skin-duration', `${durationBase + (index % durationCycle) * durationStep}s`)
        layer.appendChild(particle)
      }
    })

    const equalizerCount = clampInteger(motion.equalizerBarCount, 0, 64, 0)
    if (equalizerCount) {
      const equalizer = document.createElement('div')
      equalizer.setAttribute('data-skin-equalizer', '')
      for (let index = 0; index < equalizerCount; index++) {
        const bar = document.createElement('span')
        bar.setAttribute('data-skin-equalizer-bar', '')
        bar.style.setProperty('--skin-delay', `${-(index % 11) * 0.09}s`)
        bar.style.setProperty('--skin-height', `${18 + ((index * 17) % 36)}px`)
        bar.style.setProperty('--skin-duration', `${0.72 + (index % 5) * 0.08}s`)
        equalizer.appendChild(bar)
      }
      layer.appendChild(equalizer)
    }

    document.body.insertBefore(layer, document.getElementById('app') || document.body.firstChild)
    let pointerFrame = 0
    const handlePointerMove = (event) => {
      if (pointerFrame) return
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0
        layer.style.setProperty('--skin-pointer-x', `${event.clientX}px`)
        layer.style.setProperty('--skin-pointer-y', `${event.clientY}px`)
      })
    }
    const handleClick = (event) => {
      const count = clampInteger(motion.clickBurstCount, 0, 20, 0)
      const symbols = Array.isArray(motion.clickBurstSymbols) && motion.clickBurstSymbols.length ? motion.clickBurstSymbols.map(String) : ['✦']
      for (let index = 0; index < count; index++) {
        const burst = document.createElement('span')
        const angle = (Math.PI * 2 * index) / count
        const distance = 22 + (index % 3) * 11
        burst.setAttribute('data-skin-burst', '')
        burst.textContent = symbols[index % symbols.length].slice(0, 3)
        burst.style.left = `${event.clientX}px`
        burst.style.top = `${event.clientY}px`
        burst.style.setProperty('--skin-dx', `${Math.cos(angle) * distance}px`)
        burst.style.setProperty('--skin-dy', `${Math.sin(angle) * distance}px`)
        burst.style.setProperty('--skin-delay', `${index * 0.018}s`)
        layer.appendChild(burst)
        burst.addEventListener('animationend', () => burst.remove(), { once: true })
      }
    }

    if (motion.interactiveGlow === true) document.addEventListener('pointermove', handlePointerMove, { passive: true })
    if (motion.clickBursts === true) document.addEventListener('click', handleClick, { passive: true })
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('click', handleClick)
      if (pointerFrame) cancelAnimationFrame(pointerFrame)
      layer.remove()
    }
  }

  const createDecorations = (theme) => {
    if (!Array.isArray(theme.decorations) || theme.decorations.length === 0) return undefined

    const created = new Set()
    let queued = false
    const decorate = () => {
      queued = false
      for (const decoration of theme.decorations) {
        document.querySelectorAll(decoration.selector).forEach((target) => {
          const existing = target.querySelector(`:scope > [data-skin-decoration='${decoration.name}'][data-skin-theme='${theme.id}']`)
          if (existing) return
          const container = document.createElement('div')
          container.setAttribute('data-skin-decoration', decoration.name)
          container.setAttribute('data-skin-theme', theme.id)
          container.setAttribute('aria-hidden', 'true')
          container.inert = true
          for (const item of decoration.items) {
            const element = document.createElement('span')
            element.setAttribute('data-skin-decoration-item', item.name)
            element.textContent = item.text
            container.appendChild(element)
          }
          target.appendChild(container)
          created.add(container)
        })
      }
    }
    const queueDecorate = () => {
      if (queued) return
      queued = true
      queueMicrotask(decorate)
    }
    decorate()
    const observer = new MutationObserver(queueDecorate)
    observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      created.forEach((element) => element.remove())
      created.clear()
    }
  }

  const removeAppliedTheme = () => {
    cleanupDecorations?.()
    cleanupDecorations = undefined
    cleanupMotion?.()
    cleanupMotion = undefined
    document.getElementById(layerId)?.remove()
    document.getElementById(styleId)?.remove()
    document.body.removeAttribute(ATTRIBUTE_NAME)
  }

  const getRuntime = () => {
    if (!window[Plugin.id]) {
      window[Plugin.id] = {
        themes: Vue.ref([]),
        activeId: Vue.ref(''),
        enabled: Vue.ref(false),
        loading: Vue.ref(false),
        error: Vue.ref('')
      }
    }
    return window[Plugin.id]
  }

  const syncRuntimeState = (state) => {
    const runtime = getRuntime()
    runtime.activeId.value = state.selectedThemeId
    runtime.enabled.value = state.enabled
  }

  const Apply = async (themeId, silent = false) => {
    const catalog = await ensureAssets()
    const state = await readState()
    const selectedId = themeId || state.selectedThemeId || catalog.themes[0].id
    const entry = catalog.themes.find((item) => item.id === selectedId)
    if (!entry) throw new Error(`未找到皮肤: ${selectedId}`)
    const theme = await readTheme(entry, true)
    const variables = Object.entries(theme.variables)
      .map(([property, value]) => `  ${property}: ${value} !important;`)
      .join('\n')
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `body[${ATTRIBUTE_NAME}='${theme.id}'] {\n${variables}\n  --skin-manager-background: url("data:${theme.files.backgroundMime};base64,${theme.background}") !important;\n}\n${theme.stylesheet}`
    removeAppliedTheme()
    document.head.appendChild(style)
    document.body.setAttribute(ATTRIBUTE_NAME, theme.id)
    cleanupMotion = createMotionLayer(theme)
    cleanupDecorations = createDecorations(theme)
    const nextState = { selectedThemeId: theme.id, enabled: true }
    await writeState(nextState)
    syncRuntimeState(nextState)
    if (!silent) Plugins.message.success(`已切换到 ${theme.name}`)
  }

  const ApplySelected = async () => Apply((await readState()).selectedThemeId)

  const Clear = async (silent = false) => {
    const state = await readState()
    removeAppliedTheme()
    const nextState = { selectedThemeId: state.selectedThemeId, enabled: false }
    await writeState(nextState)
    syncRuntimeState(nextState)
    if (!silent) Plugins.message.success('已关闭皮肤')
  }

  const loadThemeCards = async () => {
    const catalog = await ensureAssets()
    const themes = []
    for (const entry of catalog.themes) {
      const theme = await readTheme(entry, true)
      themes.push({
        id: theme.id,
        name: theme.name,
        description: theme.description || '',
        author: theme.author || '',
        tags: Array.isArray(theme.tags) ? theme.tags : [],
        accent: theme.ui?.accent || '#14b8a6',
        accentSecondary: theme.ui?.accentSecondary || '#ec4899',
        previewPosition: theme.ui?.previewPosition || 'center',
        preview: `data:${theme.files.backgroundMime};base64,${theme.background}`
      })
    }
    return themes
  }

  const refreshRuntime = async () => {
    const runtime = getRuntime()
    runtime.themes.value = await loadThemeCards()
    syncRuntimeState(await readState())
  }

  const injectUiStyle = () => {
    if (document.getElementById(uiStyleId)) return
    const style = document.createElement('style')
    style.id = uiStyleId
    style.textContent = `
.skin-manager-ui { color: var(--color-light); }
[theme-mode='dark'] .skin-manager-ui { color: var(--color-dark); }
.skin-manager-hero { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px 20px; margin-bottom: 16px; border: 1px solid rgba(20, 184, 166, .22); border-radius: 18px; background: linear-gradient(115deg, rgba(20, 184, 166, .14), rgba(255, 255, 255, .62), rgba(236, 72, 153, .12)); }
.skin-manager-hero-copy { min-width: 0; }
.skin-manager-title { font-size: 18px; font-weight: 760; }
.skin-manager-subtitle { margin-top: 5px; opacity: .7; }
.skin-manager-status { flex: 0 0 auto; padding: 7px 11px; border-radius: 999px; color: #087f78; background: rgba(45, 212, 191, .16); }
.skin-manager-status.is-off { color: #64748b; background: rgba(148, 163, 184, .15); }
[theme-mode='dark'] .skin-manager-hero { background: linear-gradient(115deg, rgba(13, 148, 136, .2), rgba(15, 53, 65, .82), rgba(190, 24, 93, .18)); }
[theme-mode='dark'] .skin-manager-status { color: #c7fffb; background: rgba(0, 207, 196, .2); }
[theme-mode='dark'] .skin-manager-status.is-off { color: #d5e2e8; background: rgba(148, 163, 184, .2); }
.skin-manager-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 16px; padding: 2px 4px 16px 0; }
.skin-manager-card { overflow: hidden; border: 1px solid rgba(100, 116, 139, .2); border-radius: 18px; background: var(--card-bg-light, rgba(255, 255, 255, .88)); box-shadow: 0 10px 28px rgba(15, 118, 110, .08); transition: border-color 180ms ease, box-shadow 180ms ease; }
[theme-mode='dark'] .skin-manager-card { background: var(--card-bg-dark, rgba(15, 23, 42, .88)); }
.skin-manager-card.is-active { border-color: var(--skin-card-accent); box-shadow: 0 12px 30px color-mix(in srgb, var(--skin-card-accent) 22%, transparent); }
.skin-manager-preview { position: relative; height: 150px; background-position: var(--skin-preview-position); background-size: cover; }
.skin-manager-preview::after { content: ''; position: absolute; inset: auto 0 0; height: 44%; background: linear-gradient(transparent, rgba(8, 47, 56, .28)); pointer-events: none; }
.skin-manager-badge { position: absolute; z-index: 1; top: 12px; right: 12px; padding: 5px 9px; border-radius: 999px; color: #fff; background: linear-gradient(90deg, var(--skin-card-accent), var(--skin-card-accent-secondary)); box-shadow: 0 5px 14px rgba(0, 0, 0, .12); }
.skin-manager-card-body { padding: 14px 15px 15px; }
.skin-manager-card-head { display: flex; align-items: start; justify-content: space-between; gap: 12px; }
.skin-manager-card-title { font-size: 15px; font-weight: 760; }
.skin-manager-card-author { margin-top: 3px; opacity: .62; }
.skin-manager-description { min-height: 40px; margin-top: 10px; opacity: .76; }
.skin-manager-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.skin-manager-tag { padding: 3px 7px; border-radius: 999px; color: var(--skin-card-accent); background: color-mix(in srgb, var(--skin-card-accent) 12%, transparent); }
[theme-mode='dark'] .skin-manager-tag { color: color-mix(in srgb, var(--skin-card-accent) 68%, white); background: color-mix(in srgb, var(--skin-card-accent) 18%, transparent); }
.skin-manager-actions { display: flex; justify-content: flex-end; margin-top: 13px; }
@media (max-width: 680px) { .skin-manager-hero { align-items: flex-start; flex-direction: column; } .skin-manager-grid { grid-template-columns: 1fr; } }
@media (max-height: 650px) {
  .skin-manager-hero { padding: 11px 15px; margin-bottom: 10px; }
  .skin-manager-title { font-size: 16px; }
  .skin-manager-subtitle { margin-top: 2px; }
  .skin-manager-grid { grid-template-columns: 1fr; gap: 10px; padding-bottom: 8px; }
  .skin-manager-card { display: grid; grid-template-columns: minmax(190px, 42%) minmax(0, 1fr); }
  .skin-manager-preview { height: 100%; min-height: 188px; }
  .skin-manager-card-body { padding: 10px 12px 11px; }
  .skin-manager-description { min-height: 0; margin-top: 6px; }
  .skin-manager-tags { margin-top: 6px; }
  .skin-manager-actions { margin-top: 8px; }
}
@media (max-width: 620px) and (max-height: 650px) {
  .skin-manager-card { display: block; }
  .skin-manager-preview { height: 100px; min-height: 0; }
}
`
    document.head.appendChild(style)
  }

  const Open = async () => {
    const runtime = getRuntime()
    runtime.loading.value = true
    runtime.error.value = ''
    try {
      await refreshRuntime()
    } catch (error) {
      runtime.error.value = error instanceof Error ? error.message : String(error)
    } finally {
      runtime.loading.value = false
    }
    injectUiStyle()
    const { h, defineComponent, computed, resolveComponent } = Vue
    const component = defineComponent({
      template: /* html */ `
        <div class="skin-manager-ui">
          <section class="skin-manager-hero">
            <div class="skin-manager-hero-copy">
              <div class="skin-manager-title">选择皮肤</div>
              <div class="skin-manager-subtitle">挑选喜欢的界面风格，一键应用，并自动记住当前选择。</div>
            </div>
            <div class="skin-manager-status" :class="{ 'is-off': !enabled }">{{ enabled ? '当前：' + activeName : '皮肤已关闭' }}</div>
          </section>
          <div v-if="error" class="skin-manager-hero">{{ error }}</div>
          <div v-else-if="loading" class="skin-manager-hero">正在读取皮肤资源…</div>
          <Empty v-else-if="themes.length === 0" description="暂无可用皮肤" />
          <section v-else class="skin-manager-grid">
            <article
              v-for="theme in themes"
              :key="theme.id"
              class="skin-manager-card"
              :class="{ 'is-active': enabled && activeId === theme.id }"
              :style="{ '--skin-card-accent': theme.accent, '--skin-card-accent-secondary': theme.accentSecondary }"
            >
              <div class="skin-manager-preview" :style="{ backgroundImage: 'url(' + theme.preview + ')', '--skin-preview-position': theme.previewPosition }">
                <span v-if="enabled && activeId === theme.id" class="skin-manager-badge">使用中</span>
              </div>
              <div class="skin-manager-card-body">
                <div class="skin-manager-card-head">
                  <div><div class="skin-manager-card-title">{{ theme.name }}</div><div class="skin-manager-card-author">{{ theme.author }}</div></div>
                </div>
                <div class="skin-manager-description">{{ theme.description }}</div>
                <div class="skin-manager-tags"><span v-for="tag in theme.tags" :key="tag" class="skin-manager-tag">{{ tag }}</span></div>
                <div class="skin-manager-actions">
                  <Button :type="enabled && activeId === theme.id ? 'default' : 'primary'" :disabled="loading" @click="applyTheme(theme.id)">
                    {{ enabled && activeId === theme.id ? '重新应用' : '应用皮肤' }}
                  </Button>
                </div>
              </div>
            </article>
          </section>
        </div>
      `,
      setup() {
        return {
          themes: runtime.themes,
          activeId: runtime.activeId,
          enabled: runtime.enabled,
          loading: runtime.loading,
          error: runtime.error,
          activeName: computed(() => runtime.themes.value.find((theme) => theme.id === runtime.activeId.value)?.name || '未知皮肤'),
          async applyTheme(themeId) {
            runtime.loading.value = true
            try {
              await Apply(themeId)
            } finally {
              runtime.loading.value = false
            }
          }
        }
      }
    })
    const modal = Plugins.modal(
      { title: Plugin.name, width: '88', height: '86', submit: false, maskClosable: true, cancelText: '关闭' },
      {
        toolbar: () => [
          h(resolveComponent('Button'), { type: 'text', icon: 'refresh', loading: runtime.loading.value, onClick: () => Update(true) }, () => '更新资源'),
          h(resolveComponent('Button'), { type: 'text', disabled: !runtime.enabled.value, onClick: () => Clear() }, () => '关闭皮肤')
        ],
        default: () => h(component)
      }
    )
    modal.open()
  }

  const Update = async (fromUi = false) => {
    const runtime = getRuntime()
    runtime.loading.value = true
    const { destroy } = Plugins.message.info('正在更新皮肤资源…', 9999)
    try {
      await downloadAssets()
      const state = await readState()
      if (state.enabled) await Apply(state.selectedThemeId, true)
      if (fromUi) await refreshRuntime()
      Plugins.message.success('皮肤资源已更新')
    } finally {
      runtime.loading.value = false
      destroy()
    }
  }

  const onRun = Open
  const onReady = async () => {
    await ensureAssets()
    const state = await readState()
    syncRuntimeState(state)
    if (state.enabled) await Apply(state.selectedThemeId, true)
  }
  const onEnabled = onReady
  const onInstall = async () => {
    await downloadAssets()
    await writeState({ selectedThemeId: DEFAULT_THEME_ID, enabled: true })
    await Apply(DEFAULT_THEME_ID, true)
    Plugins.message.success('皮肤中心安装完成')
  }
  const onDispose = () => {
    removeAppliedTheme()
    document.getElementById(uiStyleId)?.remove()
    delete window[Plugin.id]
  }
  const onUninstall = async () => {
    onDispose()
    await Plugins.RemoveFile(DATA_PATH)
  }

  return { onRun, onReady, onEnabled, onInstall, onDispose, onUninstall, Open, ApplySelected, Clear, Update }
}
