/**
 * X 博主精选画廊（女菩萨 · X-Archive Curation Vault）
 *
 * 数据通过配置的 ArchiveUrl 远程拉取并写入本地缓存，离线时回退到缓存或内置示例数据。
 * 界面完全由宿主全局组件（Card / Button / Input / Select / Tag / Pagination / Empty / Modal）
 * 与宿主内置工具类构成，仅保留搜索、分类筛选、排序、分页列表与博主档案详情等核心能力。
 * 运行于宿主 WebView 环境，所有 I/O 均通过 Plugins.* 完成。
 */

const DEFAULT_ARCHIVE_URL = 'https://img.boomboom.nyc.mn/data/archive.json'
const DEFAULT_MEDIA_BASE = 'https://img.boomboom.nyc.mn'
const DEFAULT_AVATAR = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_400x400.png'
const CACHE_LABEL = '本地缓存'
const ONLINE_LABEL = '在线数据'
const SAMPLE_LABEL = '内置示例'
const PAGE_SIZE = 12

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'verified', label: '蓝标认证' },
  { key: 'top', label: 'Top 头部 (50万+)' },
  { key: '100k', label: '知名创作者 (10万+)' },
  { key: 'recent', label: '最新归档 (7天)' },
  { key: 'lost', label: '赛博坟场' }
]

const SORT_OPTIONS = [
  { label: '粉丝数从高到低', value: 'followers-desc' },
  { label: '粉丝数从低到高', value: 'followers-asc' },
  { label: '热度从高到低', value: 'clicks-desc' },
  { label: '热度从低到高', value: 'clicks-asc' },
  { label: '博主名称 A → Z', value: 'name-asc' },
  { label: '归档时间最近', value: 'recent' }
]

let pluginRef = null
let pluginId = 'plugin-x-archive-viewer'
let cacheDir = `data/.cache/${pluginId}`
let cachePath = `${cacheDir}/archive.json`
let mediaBase = DEFAULT_MEDIA_BASE
let viewerApi = undefined
let detailApi = undefined

const SAMPLE_DATA = [
  {
    id: '1280938963541221376',
    screen_name: 'afukadou7',
    name: '阿芙卡豆',
    avatar_url: 'https://pbs.twimg.com/profile_images/2033912326085349377/WEkPM9t7_400x400.jpg',
    cover_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    followers_count: 102939,
    description: '阿芙卡豆 | 官方指路 💓 分享日常与数码生活。https://fansone.co/afuka',
    verified: true,
    backed_up_at: '2026-08-11T15:21:30.336Z'
  },
  {
    id: '15354924',
    screen_name: 'sama',
    name: 'Sam Altman',
    avatar_url: 'https://pbs.twimg.com/profile_images/1605336338520281088/8p7c1m-b_400x400.jpg',
    cover_url: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&auto=format&fit=crop&q=80',
    followers_count: 3240000,
    description: 'CEO at OpenAI. Working on AGI to benefit all of humanity. https://openai.com',
    verified: true,
    backed_up_at: '2026-08-11T16:00:00.000Z',
    total_clicks: 128
  },
  {
    id: '33838201',
    screen_name: 'karpathy',
    name: 'Andrej Karpathy',
    avatar_url: 'https://pbs.twimg.com/profile_images/1799516629949603840/z0HquzC__400x400.jpg',
    cover_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    followers_count: 1120000,
    description: 'Building Eureka Labs. Formerly OpenAI and Tesla AI lead. Passionate about LLMs and deep learning. https://eurekalabs.ai',
    verified: true,
    backed_up_at: '2026-08-11T16:05:00.000Z',
    total_clicks: 96
  },
  {
    id: '1157097323',
    screen_name: 'levelsio',
    name: 'Pieter Levels',
    avatar_url: 'https://pbs.twimg.com/profile_images/1783777553942007808/3Z__tM50_400x400.jpg',
    cover_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
    followers_count: 542000,
    description: 'Indie hacker. Building Nomad List, Remote OK, PhotoAI, and Interior AI. https://levels.io',
    verified: true,
    backed_up_at: '2026-08-11T16:10:00.000Z',
    total_clicks: 64
  },
  {
    id: '14499829',
    screen_name: 'ylecun',
    name: 'Yann LeCun',
    avatar_url: 'https://pbs.twimg.com/profile_images/1498642738902507523/wU2a74cE_400x400.jpg',
    cover_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80',
    followers_count: 890000,
    description: 'Chief AI Scientist at Meta. Professor at NYU. Turing Award Laureate. https://yann.lecun.com',
    verified: true,
    backed_up_at: '2026-08-11T16:15:00.000Z'
  },
  {
    id: '96135824',
    screen_name: 'gregkamradt',
    name: 'Greg Kamradt',
    avatar_url: 'https://pbs.twimg.com/profile_images/1614761011884392451/7fHlO12T_400x400.jpg',
    cover_url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80',
    followers_count: 185000,
    description: 'Building AI data tools & benchmarks. Needle in a Haystack evaluation creator.',
    verified: false,
    backed_up_at: '2026-08-11T16:20:00.000Z'
  },
  {
    id: '2054603840',
    screen_name: 'ghost_archive',
    name: '已沉寂的博主',
    avatar_url: '',
    cover_url: '',
    followers_count: 42000,
    description: '该账号已不可访问，档案由本画廊冷备份留存。',
    verified: false,
    is_suspended: 2,
    backed_up_at: '2026-07-01T08:00:00.000Z'
  }
]

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

const sanitizeUrl = (url) => {
  if (!url) {
    return ''
  }
  const trimmed = url.trim()
  if (/^(https?:\/\/|\/|data:image\/)/i.test(trimmed)) {
    if (/javascript:/i.test(trimmed)) {
      return ''
    }
    return trimmed
  }
  return ''
}

const normalizeBase = (domain) => {
  if (!domain) {
    return ''
  }
  let clean = domain.trim().replace(/\/+$/, '')
  if (!clean || clean === 'none' || clean === 'false') {
    return ''
  }
  if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`
  }
  return clean
}

const configValue = (key, fallback = '') => {
  const raw = pluginRef?.[key]
  if (typeof raw === 'string') {
    return raw.trim() || fallback
  }
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw).trim() || fallback
  }
  return fallback
}

const resolveMediaUrl = (url) => {
  const safe = sanitizeUrl(url)
  if (!safe) {
    return ''
  }
  if (mediaBase && safe.includes('/api/media') && safe.includes('key=')) {
    try {
      const key = new URL(safe, globalThis.location.origin).searchParams.get('key')
      if (key) {
        return `${mediaBase}/${key.replace(/^\/+/, '')}`
      }
    } catch {
      /* Ignore */
    }
  }
  return safe
}

const avatarFor = (user) => resolveMediaUrl(user.avatar_url) || DEFAULT_AVATAR

const isTombstone = (user) => user.is_suspended === 1 || user.is_suspended === 2

const isVerified = (user) => Boolean(user.verified)

const handleOf = (user) => user.screen_name ?? ''

const displayName = (user) => user.name ?? user.screen_name ?? '未知博主'

const platformUrl = (user) => `https://x.com/${encodeURIComponent(handleOf(user))}`

const formatFollowers = (num) => {
  const n = Number(num) || 0
  if (n <= 0) {
    return '0'
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`
  }
  return n.toString()
}

const formatDate = (date) => {
  const d = date ? new Date(date) : new Date()
  if (!Number.isFinite(d.getTime())) {
    return '已收录'
  }
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const daysSince = (date) => {
  const t = date ? new Date(date).getTime() : Number.NaN
  if (!Number.isFinite(t)) {
    return 1
  }
  return Math.max(1, Math.floor((Date.now() - t) / 86_400_000))
}

const vaultNo = (user) => {
  const base = String(user.id ?? user.screen_name ?? '0')
    .slice(-5)
    .toUpperCase()
    .padStart(5, '0')
  return `VAULT-${base}`
}

const withinDays = (date, days) => {
  if (!date) {
    return false
  }
  const t = new Date(date).getTime()
  return Number.isFinite(t) && Date.now() - t <= days * 86_400_000
}

const parseBio = (text) => {
  if (!text) {
    return [{ text: '暂无个人简介' }]
  }
  const parts = []
  const re = /(https?:\/\/[^\s<"'`]+)/g
  let last = 0
  let match = null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ text: text.slice(last, match.index) })
    }
    const url = sanitizeUrl(match[1])
    parts.push(url ? { text: match[1], url } : { text: match[1] })
    last = match.index + match[1].length
  }
  if (last < text.length) {
    parts.push({ text: text.slice(last) })
  }
  return parts.length > 0 ? parts : [{ text }]
}

const openExternal = (url) => {
  const safe = sanitizeUrl(url)
  if (!safe) {
    return
  }
  void Plugins.OpenURI(safe).catch(() => {})
}

const onAvatarError = (e) => {
  const img = e.target
  if (!img || img.dataset['fallback']) {
    return
  }
  img.dataset['fallback'] = '1'
  img.src = DEFAULT_AVATAR
}

const copyHandle = (user) => {
  void Plugins.ClipboardSetText(`@${handleOf(user)}`)
    .then(() => Plugins.message.success(`已复制 @${handleOf(user)} 到剪贴板`))
    .catch(() => Plugins.message.error('复制失败'))
}

const copyMarkdown = (user) => {
  const md = [
    `### ${displayName(user)} (@${handleOf(user)})`,
    '',
    `- **粉丝数**：${formatFollowers(user.followers_count)}`,
    `- **认证状态**：${isVerified(user) ? '已蓝标认证' : '未认证'}`,
    `- **归档编号**：${vaultNo(user)}`,
    `- **首次收录**：${formatDate(user.backed_up_at)}`,
    `- **已留存**：${daysSince(user.backed_up_at)} 天`,
    `- **个人简介**：${user.description ?? '暂无简介'}`,
    `- **主页链接**：${platformUrl(user)}`
  ].join('\n')
  void Plugins.ClipboardSetText(md)
    .then(() => Plugins.message.success('已复制博主 Markdown 档案卡到剪贴板'))
    .catch(() => Plugins.message.error('复制失败'))
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

const ROOT_TEMPLATE = /* template */ `
<div class="flex flex-col gap-12">
  <div class="flex flex-wrap items-center gap-8">
    <Input
      v-model="search"
      class="flex-1"
      clearable
      placeholder="搜索昵称 / @用户名 / 简介"
      style="min-width: 240px"
    />
    <Select v-model="sort" :options="SORT_OPTIONS" style="width: 190px" />
    <Button type="text" icon="reset" @click="resetFilters">重置</Button>
  </div>

  <div class="flex flex-wrap items-center gap-8">
    <Button
      v-for="item in FILTERS"
      :key="item.key"
      :type="filter === item.key ? 'primary' : 'normal'"
      size="small"
      @click="setFilter(item.key)"
    >
      {{ item.label }}（{{ badgeFor(item.key) }}）
    </Button>
    <span class="ml-auto text-12">{{ dataSource }} · 共 {{ counts.total }} 份档案</span>
  </div>

  <div v-if="loadError && !loading && sorted.length > 0" class="text-12">
    在线数据刷新失败：{{ loadError }}（当前数据来源：{{ dataSource }}）
  </div>

  <div v-if="loading" class="flex items-center justify-center gap-8 py-32">
    <Icon icon="loading" class="rotation" />
    <span class="text-12">正在加载归档数据...</span>
  </div>

  <template v-else-if="sorted.length > 0">
    <div class="grid grid-cols-3 gap-8">
      <Card
        v-for="u in paged"
        :key="keyOf(u)"
        class="cursor-pointer"
        @click="openDetail(u)"
      >
        <div class="flex flex-col gap-8 py-8">
          <div class="flex items-center gap-8">
            <img
              :src="avatarFor(u)"
              :alt="displayName(u)"
              class="w-40 h-40 rounded-full overflow-hidden shrink-0"
              style="object-fit: cover"
              @error="onAvatarError"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-4">
                <span class="text-14 font-bold line-clamp-1">{{ displayName(u) }}</span>
                <Tag v-if="isTombstone(u)" color="red" size="small">封存</Tag>
                <Tag v-else-if="isVerified(u)" color="blue" size="small">蓝标</Tag>
              </div>
              <div class="text-12 line-clamp-1">
                @{{ handleOf(u) }} · {{ formatFollowers(u.followers_count) }} 关注者
              </div>
            </div>
          </div>

          <div class="text-12 leading-relaxed line-clamp-2">{{ u.description || '暂无简介' }}</div>

          <div class="flex items-center gap-8 text-12">
            <span>归档于 {{ formatDate(u.backed_up_at) }}</span>
            <div class="ml-auto flex shrink-0 gap-4">
              <Button size="small" type="text" icon="copy" @click.stop="copyHandle(u)">复制</Button>
              <Button size="small" type="text" icon="link" @click.stop="openExternal(platformUrl(u))">访问 X</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <div v-if="sorted.length > PAGE_SIZE" class="flex justify-center">
      <Pagination v-model:current="page" :total="sorted.length" :pageSize="PAGE_SIZE" />
    </div>
  </template>

  <div v-else class="py-16">
    <Empty>
      <template #description>
        <div class="flex flex-col items-center gap-8">
          <div class="text-12">{{ emptyText }}</div>
          <Button v-if="loadError" icon="refresh" @click="reloadData">重新加载</Button>
          <Button v-else icon="reset" @click="resetFilters">重置筛选</Button>
        </div>
      </template>
    </Empty>
  </div>
</div>
`

const DETAIL_TEMPLATE = /* template */`
<div class="flex flex-col gap-16">
  <div class="flex items-center gap-12">
    <img
      :src="avatarFor(user)"
      :alt="displayName(user)"
      class="w-64 h-64 rounded-full overflow-hidden shrink-0"
      style="object-fit: cover"
      @error="onAvatarError"
    />
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-4">
        <span class="text-18 font-bold break-all">{{ displayName(user) }}</span>
        <Tag v-if="isTombstone(user)" color="red" size="small">赛博坟场</Tag>
        <Tag v-else-if="isVerified(user)" color="blue" size="small">蓝标认证</Tag>
      </div>
      <div class="text-12 mt-4 break-all">@{{ handleOf(user) }}</div>
    </div>
  </div>

  <div class="flex flex-wrap gap-4">
    <Tag color="cyan" size="small">粉丝 {{ formatFollowers(user.followers_count) }}</Tag>
    <Tag color="green" size="small">归档于 {{ formatDate(user.backed_up_at) }}</Tag>
    <Tag size="small">已留存 {{ daysSince(user.backed_up_at) }} 天</Tag>
    <Tag v-if="user.total_clicks" color="orange" size="small">热度 {{ user.total_clicks }}</Tag>
    <Tag color="purple" size="small">{{ vaultNo(user) }}</Tag>
  </div>

  <div>
    <div class="text-12 mb-4">个人简介</div>
    <div class="text-14 leading-relaxed break-all">
      <template v-for="(seg, i) in bio" :key="i">
        <span
          v-if="seg.url"
          class="cursor-pointer"
          style="color: var(--primary-color)"
          @click="openExternal(seg.url)"
        >{{ seg.text }}</span>
        <span v-else>{{ seg.text }}</span>
      </template>
    </div>
  </div>

  <div class="flex flex-wrap gap-8 pt-16" style="border-top: 1px solid var(--divider-color)">
    <Button type="primary" icon="link" @click="openExternal(platformUrl(user))">访问 X 主页</Button>
    <Button icon="copy" @click="copyHandle(user)">复制 @{{ handleOf(user) }}</Button>
    <Button icon="copy" @click="copyMarkdown(user)">复制档案卡</Button>
  </div>
</div>
`

/* ------------------------------------------------------------------ */
/* Blogger detail modal                                                */
/* ------------------------------------------------------------------ */

const openDetail = (user) => {
  detailApi?.destroy()
  const Detail = Vue.defineComponent({
    name: 'XavDetail',
    template: DETAIL_TEMPLATE,
    setup: () => {
      const bio = Vue.computed(() => parseBio(user.description))
      return {
        user,
        bio,
        avatarFor,
        displayName,
        handleOf,
        isTombstone,
        isVerified,
        formatFollowers,
        formatDate,
        daysSince,
        vaultNo,
        platformUrl,
        copyHandle,
        copyMarkdown,
        openExternal,
        onAvatarError
      }
    }
  })
  const api = Plugins.modal(
    {
      title: `档案 · @${handleOf(user)}`,
      width: '60',
      submit: false,
      cancelText: '关闭',
      afterDestroy: () => {
        if (detailApi === api) {
          detailApi = undefined
        }
      }
    },
    { default: () => Vue.h(Detail) }
  )
  detailApi = api
  api.open()
}

/* ------------------------------------------------------------------ */
/* Root viewer component                                               */
/* ------------------------------------------------------------------ */

const createRootComponent = () => {
  const { ref, shallowRef, computed, onMounted, watch } = Vue

  return Vue.defineComponent({
    name: 'XArchiveViewer',
    template: ROOT_TEMPLATE,
    setup(_props, { expose }) {
      const users = shallowRef([])
      const loading = ref(true)
      const loadError = ref('')
      const dataSource = ref('')
      const search = ref('')
      const filter = ref('all')
      const sort = ref('followers-desc')
      const page = ref(1)

      /* ---------------- derived data ---------------- */

      const counts = computed(() => {
        const all = users.value
        const alive = all.filter((u) => !isTombstone(u))
        return {
          total: all.length,
          alive: alive.length,
          verified: alive.filter((u) => isVerified(u)).length,
          top: alive.filter((u) => (u.followers_count ?? 0) >= 500000).length,
          mid: alive.filter((u) => (u.followers_count ?? 0) >= 100000).length,
          recent: alive.filter((u) => withinDays(u.backed_up_at, 7)).length,
          lost: all.filter((u) => isTombstone(u)).length
        }
      })

      const filtered = computed(() => {
        const q = search.value.trim().toLowerCase()
        return users.value.filter((u) => {
          const lost = isTombstone(u)
          if (filter.value === 'lost') {
            if (!lost) {
              return false
            }
          } else if (lost) {
            return false
          }
          const matchesQuery =
            !q || handleOf(u).toLowerCase().includes(q) || displayName(u).toLowerCase().includes(q) || (u.description ?? '').toLowerCase().includes(q)
          let matchesFilter = true
          if (filter.value === 'verified') {
            matchesFilter = isVerified(u)
          } else if (filter.value === 'top') {
            matchesFilter = (u.followers_count ?? 0) >= 500000
          } else if (filter.value === '100k') {
            matchesFilter = (u.followers_count ?? 0) >= 100000
          } else if (filter.value === 'recent') {
            matchesFilter = withinDays(u.backed_up_at, 7)
          }
          return matchesQuery && matchesFilter
        })
      })

      const sorted = computed(() => {
        const arr = [...filtered.value]
        arr.sort((a, b) => {
          if (sort.value === 'clicks-desc') {
            const d = (b.total_clicks ?? 0) - (a.total_clicks ?? 0)
            return d !== 0 ? d : (b.followers_count ?? 0) - (a.followers_count ?? 0)
          }
          if (sort.value === 'clicks-asc') {
            const d = (a.total_clicks ?? 0) - (b.total_clicks ?? 0)
            return d !== 0 ? d : (a.followers_count ?? 0) - (b.followers_count ?? 0)
          }
          if (sort.value === 'recent') {
            const ta = a.backed_up_at ? new Date(a.backed_up_at).getTime() : 0
            const tb = b.backed_up_at ? new Date(b.backed_up_at).getTime() : 0
            const va = Number.isFinite(ta) ? ta : 0
            const vb = Number.isFinite(tb) ? tb : 0
            if (va !== vb) {
              return vb - va
            }
            return String(b.id ?? '').localeCompare(String(a.id ?? ''))
          }
          if (sort.value === 'followers-desc') {
            return (b.followers_count ?? 0) - (a.followers_count ?? 0)
          }
          if (sort.value === 'followers-asc') {
            return (a.followers_count ?? 0) - (b.followers_count ?? 0)
          }
          if (sort.value === 'name-asc') {
            return displayName(a).localeCompare(displayName(b))
          }
          return 0
        })
        return arr
      })

      const paged = computed(() => {
        const start = (page.value - 1) * PAGE_SIZE
        return sorted.value.slice(start, start + PAGE_SIZE)
      })

      const emptyText = computed(() => (loadError.value ? `加载失败：${loadError.value}` : '没有符合条件的博主'))

      /* ---------------- interactions ---------------- */

      const badgeFor = (kind) => {
        const c = counts.value
        switch (kind) {
          case 'all': {
            return c.alive
          }
          case 'verified': {
            return c.verified
          }
          case 'top': {
            return c.top
          }
          case '100k': {
            return c.mid
          }
          case 'recent': {
            return c.recent
          }
          case 'lost': {
            return c.lost
          }
          default: {
            return 0
          }
        }
      }

      const keyOf = (user) => String(user.id ?? user.screen_name ?? '')

      const setFilter = (key) => {
        filter.value = key
      }

      const resetFilters = () => {
        search.value = ''
        filter.value = 'all'
        sort.value = 'followers-desc'
        page.value = 1
        Plugins.message.info('已重置所有筛选条件')
      }

      /* ---------------- data loading ---------------- */

      const readCache = async () => {
        try {
          const text = await Plugins.ReadFile(cachePath)
          const data = JSON.parse(text)
          return Array.isArray(data) ? data : null
        } catch {
          return null
        }
      }

      const writeCache = async (data) => {
        try {
          await Plugins.MakeDir(cacheDir)
          await Plugins.WriteFile(cachePath, JSON.stringify(data))
        } catch {
          /* Ignore */
        }
      }

      const fetchArchive = async () => {
        const url = configValue('ArchiveUrl', DEFAULT_ARCHIVE_URL)
        const res = await Plugins.HttpGet(url, {}, { Timeout: 30 })
        if (res.status && (res.status < 200 || res.status >= 300)) {
          throw new Error(`HTTP ${res.status}`)
        }
        const body = res?.body
        const data = typeof body === 'string' ? JSON.parse(body) : body
        if (!Array.isArray(data)) {
          throw new Error('返回数据不是有效数组')
        }
        return data
      }

      const loadData = async (silent = false) => {
        if (!silent) {
          loading.value = true
        }
        loadError.value = ''
        try {
          const cached = await readCache()
          if (cached && cached.length > 0) {
            users.value = cached
            dataSource.value = CACHE_LABEL
            loading.value = false
          }
        } catch {
          /* Ignore */
        }
        let gotRemote = false
        try {
          const remote = await fetchArchive()
          gotRemote = true
          users.value = remote
          dataSource.value = ONLINE_LABEL
          if (remote.length > 0) {
            await writeCache(remote)
          }
        } catch (err) {
          loadError.value = err instanceof Error ? err.message : String(err)
        }
        if (!gotRemote && users.value.length === 0) {
          users.value = SAMPLE_DATA
          dataSource.value = SAMPLE_LABEL
          loadError.value = ''
        }
        loading.value = false
        if (!gotRemote && users.value.length > 0 && dataSource.value !== SAMPLE_LABEL) {
          Plugins.message.warn('在线数据刷新失败，已使用本地缓存')
        }
      }

      const reloadData = async () => {
        await loadData(false)
        Plugins.message.info('画廊数据已重新加载')
      }

      /* ---------------- lifecycle ---------------- */

      watch([filter, search, sort], () => {
        page.value = 1
      })

      watch(sorted, (list) => {
        const maxPage = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
        if (page.value > maxPage) {
          page.value = maxPage
        }
      })

      onMounted(() => {
        void loadData(false)
      })

      expose({ reload: () => loadData(false) })

      return {
        // State
        loading,
        loadError,
        dataSource,
        search,
        filter,
        sort,
        page,
        // Derived
        counts,
        sorted,
        paged,
        emptyText,
        // Constants
        FILTERS,
        SORT_OPTIONS,
        PAGE_SIZE,
        // Helpers
        badgeFor,
        keyOf,
        setFilter,
        resetFilters,
        reloadData,
        openDetail,
        copyHandle,
        avatarFor,
        displayName,
        handleOf,
        formatFollowers,
        formatDate,
        isTombstone,
        isVerified,
        platformUrl,
        openExternal,
        onAvatarError
      }
    }
  })
}

/* ------------------------------------------------------------------ */
/* Plugin entry                                                        */
/* ------------------------------------------------------------------ */

/** @type {EsmPlugin} */
export default (Plugin) => {
  pluginRef = Plugin
  pluginId = Plugin.id
  cacheDir = `data/.cache/${pluginId}`
  cachePath = `${cacheDir}/archive.json`
  mediaBase = normalizeBase(configValue('MediaBase', DEFAULT_MEDIA_BASE))

  const onRun = () => {
    openViewer()
    return 0
  }

  const onInstall = async () => {
    try {
      await Plugins.MakeDir(cacheDir)
    } catch {
      /* Ignore */
    }
    return 0
  }

  const onUninstall = async () => {
    try {
      await Plugins.RemoveFile(cacheDir)
    } catch {
      /* Ignore */
    }
    return 0
  }

  const onDispose = () => {
    try {
      detailApi?.destroy()
      viewerApi?.destroy()
    } catch {
      /* Ignore */
    }
    detailApi = undefined
    viewerApi = undefined
    return 0
  }

  return { onRun, onInstall, onUninstall, onDispose }
}

const openViewer = () => {
  if (viewerApi) {
    viewerApi.open()
    return
  }
  const Root = createRootComponent()
  const rootRef = Vue.ref(null)
  const { h } = Vue
  viewerApi = Plugins.modal(
    {
      title: 'X 博主精选画廊',
      width: '90',
      height: '90',
      submit: false,
      maskClosable: false,
      cancelText: '关闭',
      afterDestroy: () => {
        viewerApi = undefined
      }
    },
    {
      toolbar: () => [
        h(
          Vue.resolveComponent('Button'),
          {
            type: 'text',
            icon: 'folder',
            onClick: () => {
              void Plugins.OpenDir(cacheDir).catch(() => {})
            }
          },
          () => '数据目录'
        ),
        h(
          Vue.resolveComponent('Button'),
          {
            type: 'text',
            icon: 'refresh',
            onClick: () => rootRef.value?.reload?.()
          },
          () => '刷新数据'
        )
      ],
      default: () => h(Root, { ref: rootRef })
    }
  )
  viewerApi.open()
}
