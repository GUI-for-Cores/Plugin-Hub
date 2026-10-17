const TRACE_TARGETS = [
  {
    id: 'claude-com',
    label: 'claude.com',
    url: 'https://claude.com/cdn-cgi/trace'
  },
  {
    id: 'claude-ai',
    label: 'claude.ai',
    url: 'https://claude.ai/cdn-cgi/trace'
  }
]

/** 中国大陆常用时区，命中任一即视为国内系统时区 */
const MAINLAND_TIMEZONES = new Set(['Asia/Shanghai', 'Asia/Urumqi', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Kashgar', 'Asia/Chungking', 'Asia/PRC'])

/** 国内高频、非中文环境较少预装的字体 */
const CN_FONTS = [
  { name: 'DengXian', label: '等线 DengXian' },
  { name: 'FangSong', label: '仿宋 FangSong' },
  { name: 'KaiTi', label: '楷体 KaiTi' },
  { name: 'SimSun', label: '宋体 SimSun' },
  { name: 'SimHei', label: '黑体 SimHei' },
  { name: 'Microsoft YaHei', label: '微软雅黑 Microsoft YaHei' },
  { name: 'HarmonyOS Sans SC', label: '鸿蒙 HarmonyOS Sans' },
  { name: 'Alibaba PuHuiTi', label: '阿里普惠体 Alibaba PuHuiTi' },
  { name: 'MiSans', label: 'MiSans' },
  { name: 'WenQuanYi Micro Hei', label: '文泉驿微米黑' }
]

const STATUS_META = {
  risk: { color: 'red', text: '风险' },
  pass: { color: 'green', text: '通过' },
  unknown: { color: 'default', text: '未知' }
}

const FLAG_FONT = '32px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
const FONT_PROBE_TEXT = '中文测试 mmm'
const FALLBACK_FONTS = ['monospace', 'sans-serif', 'serif']
const CANVAS_SIZE = 72
const COLOR_THRESHOLD = 24
const LETTER_MISMATCH_THRESHOLD = 0.5

/** @type {EsmPlugin} */
export default (Plugin) => {
  let closePanel = undefined

  /* 触发器 手动触发 */
  const onRun = () => {
    openPanel()
  }

  /* 菜单 打开面板 */
  const openPanel = () => {
    const { computed, defineComponent, onMounted, ref } = Vue

    const panelTemplate = /* html */ `
      <div class="flex flex-col gap-8">
        <div class="flex items-center justify-between px-8">
          <div class="flex items-center gap-8">
            <Tag :color="verdict.color">{{ verdict.text }}</Tag>
            <span class="text-12">{{ verdict.hint }}</span>
          </div>
          <Button icon="refresh" :loading="loading" @click="runChecks">重新检测</Button>
        </div>

        <Card title="网络出口（Claude 视角）">
          <div
            v-for="item in network"
            :key="item.id"
            class="px-8 py-12 flex items-center justify-between"
          >
            <div class="text-16 font-bold">{{ item.label }}</div>
            <div class="flex items-center gap-8">
              <span class="text-12 break-all">{{ item.detail }}</span>
              <Tag v-if="item.tag" size="small" :color="item.status === 'risk' ? 'red' : 'green'">
                {{ item.tag }}
              </Tag>
            </div>
          </div>
        </Card>

        <Card title="中文环境特征">
          <div
            v-for="item in features"
            :key="item.id"
            class="px-8 py-12 flex items-center justify-between gap-8"
          >
            <div class="text-16 font-bold shrink-0">{{ item.label }}</div>
            <div class="flex items-center gap-8">
              <span class="text-12 text-right break-all">{{ item.detail }}</span>
              <Tag size="small" :color="statusMeta[item.status].color">
                {{ statusMeta[item.status].text }}
              </Tag>
            </div>
          </div>
        </Card>

        <div class="px-8 text-12 leading-relaxed">
          建议：将系统时区改为 Asia/Singapore 等 UTC+8 服务区内时区，并改用 TUN／软路由的透明代理，避免本机代理与中继被识别。
        </div>
      </div>
    `

    const panelSetup = (_props, context) => {
      const loading = ref(false)

      const network = ref(
        TRACE_TARGETS.map((target) => ({
          id: target.id,
          label: target.label,
          detail: '等待检测',
          status: 'unknown'
        }))
      )

      const features = ref([])

      const verdict = computed(() => {
        if (loading.value) {
          return {
            color: 'default',
            text: '检测中',
            hint: '正在检测当前环境，请稍候…'
          }
        }
        const risks = [...network.value, ...features.value].filter((item) => item.status === 'risk')
        if (risks.length === 0) {
          return {
            color: 'green',
            text: '安全',
            hint: '未发现明显的中国用户特征'
          }
        }
        const hint = `命中 ${risks.length} 项中国用户特征`
        if (risks.length <= 2) {
          return { color: 'orange', text: '可疑', hint }
        }
        return { color: 'red', text: '高风险', hint }
      })

      const formatError = (error) => {
        if (typeof error === 'string') {
          return error
        }
        if (error instanceof Error) {
          return error.message
        }
        return '未知错误'
      }

      const parseTrace = (text) => {
        const ip = /(?:^|\n)ip=([^\n]+)/.exec(text)?.[1]?.trim() ?? ''
        const loc = /(?:^|\n)loc=([^\n]+)/.exec(text)?.[1]?.trim().toUpperCase() ?? ''
        return { ip, loc }
      }

      const checkNetwork = async () => {
        await Promise.all(
          TRACE_TARGETS.map(async (target) => {
            const item = network.value.find((entry) => entry.id === target.id)
            if (!item) {
              return
            }
            try {
              const { body } = await Plugins.HttpGet(target.url, {}, { Timeout: 8 })
              const text = typeof body === 'string' ? body : JSON.stringify(body)
              const { ip, loc } = parseTrace(text)
              if (!ip) {
                item.detail = '未能解析出口地址'
                item.status = 'unknown'
                return
              }
              item.detail = `${ip}（${loc || '未知地区'}）`
              item.tag = loc || '未知'
              item.status = loc === 'CN' ? 'risk' : 'pass'
            } catch (error) {
              item.detail = `检测失败：${formatError(error)}`
              item.status = 'unknown'
            }
          })
        )
      }

      const checkLanguage = () => {
        const languages = navigator.languages.length > 0 ? [...navigator.languages] : [navigator.language]
        const zh = languages.filter((lang) => /^zh/i.test(lang))
        const item = {
          id: 'language',
          label: '浏览器语言',
          detail: languages.join(', '),
          status: zh.length > 0 ? 'risk' : 'pass'
        }
        if (zh.length > 0) {
          item.detail = `${languages.join(', ')}（含 ${zh.join('、')}）`
        }
        return item
      }

      const checkTimezone = () => {
        const { timeZone } = Intl.DateTimeFormat().resolvedOptions()
        return {
          id: 'timezone',
          label: '系统时区',
          detail: timeZone || '未知时区',
          status: MAINLAND_TIMEZONES.has(timeZone) ? 'risk' : 'pass'
        }
      }

      const hasColor = (data) => {
        for (let i = 0; i < data.length; i += 4) {
          const red = data[i] ?? 0
          const green = data[i + 1] ?? 0
          const blue = data[i + 2] ?? 0
          const alpha = data[i + 3] ?? 0
          const saturation = Math.max(red, green, blue) - Math.min(red, green, blue)
          if (alpha > 0 && saturation > COLOR_THRESHOLD) {
            return true
          }
        }
        return false
      }

      const mismatchRatio = (a, b) => {
        let counted = 0
        let diff = 0
        for (let i = 0; i < a.length; i += 4) {
          const alphaA = a[i + 3] ?? 0
          const alphaB = b[i + 3] ?? 0
          if (alphaA === 0 && alphaB === 0) {
            continue
          }
          counted += 1
          if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || alphaA !== alphaB) {
            diff += 1
          }
        }
        return counted === 0 ? 1 : diff / counted
      }

      const checkFlagEmoji = () => {
        const item = {
          id: 'flag',
          label: '国旗 Emoji',
          detail: '未检测',
          status: 'unknown'
        }
        const canvas = document.createElement('canvas')
        canvas.width = CANVAS_SIZE
        canvas.height = CANVAS_SIZE
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
          item.detail = '当前环境不支持 Canvas 检测'
          return item
        }
        const draw = (text) => {
          ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
          ctx.textBaseline = 'top'
          ctx.font = FLAG_FONT
          ctx.fillText(text, 0, 0)
          return ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data
        }
        const flag = draw('\u{1F1E8}\u{1F1F3}')
        const letters = draw('CN')
        if (hasColor(flag)) {
          item.detail = '国旗以彩色渲染'
          item.status = 'pass'
          return item
        }
        if (mismatchRatio(flag, letters) < LETTER_MISMATCH_THRESHOLD) {
          item.detail = '国旗被降级渲染为字母 CN'
          item.status = 'risk'
          return item
        }
        item.detail = '国旗为单色渲染，未能确认'
        return item
      }

      const checkFonts = () => {
        const item = {
          id: 'font',
          label: '中文字体',
          detail: '未检测',
          status: 'unknown'
        }
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          item.detail = '当前环境不支持 Canvas 检测'
          return item
        }
        const measure = (font) => {
          ctx.font = font
          return ctx.measureText(FONT_PROBE_TEXT).width
        }
        const baseWidths = FALLBACK_FONTS.map((font) => measure(`72px ${font}`))
        const found = CN_FONTS.filter((font) => {
          const width = measure(`72px "${font.name}", monospace`)
          return baseWidths.every((baseWidth) => Math.abs(width - baseWidth) > 0.1)
        })
        if (found.length === 0) {
          item.detail = '未检测到国内特有字体'
          item.status = 'pass'
          return item
        }
        item.detail = `检测到：${found.map((font) => font.label).join('、')}`
        item.status = 'risk'
        return item
      }

      const buildFeatures = () => [checkLanguage(), checkTimezone(), checkFlagEmoji(), checkFonts()]

      const runChecks = async () => {
        loading.value = true
        network.value = TRACE_TARGETS.map((target) => ({
          id: target.id,
          label: target.label,
          detail: '检测中…',
          status: 'unknown'
        }))
        features.value = buildFeatures()
        await checkNetwork()
        loading.value = false
      }

      onMounted(runChecks)

      /* 声明显示在模态框底栏左侧 */
      context?.expose({
        modalSlots: {
          action: () => Vue.h('div', { class: 'mr-auto text-12' }, '测试结果仅供参考，请以实际使用情况为准')
        }
      })

      return {
        loading,
        network,
        features,
        verdict,
        runChecks,
        statusMeta: STATUS_META
      }
    }

    const component = defineComponent({
      template: panelTemplate,
      setup: panelSetup
    })

    const modal = Plugins.modal({
      title: Plugin.name,
      submit: false,
      cancelText: '关闭',
      width: '90',
      height: '90'
    })
    modal.setContent(component)
    modal.open()
    closePanel = () => modal.destroy()
  }

  /* 触发器 插件销毁时 */
  const onDispose = () => {
    closePanel?.()
    closePanel = undefined
  }

  return { onRun, onDispose }
}
