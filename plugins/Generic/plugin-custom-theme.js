const PATH = 'data/third/custom-theme'
const THEME_FILE = PATH + '/themes.json'

const VariableList = [
  // 主色
  '--primary-color',
  // 次色
  '--secondary-color',
  // 文字颜色
  '--color-light',
  '--color-dark',
  // 背景颜色
  '--bg-color-light',
  '--bg-color-dark',
  // 滚动条颜色
  '--scrollbar-track-bg-light',
  '--scrollbar-thumb-bg-light',
  '--scrollbar-track-bg-dark',
  '--scrollbar-thumb-bg-dark',
  // 普通按钮颜色
  '--btn-normal-color-light',
  '--btn-normal-bg-light',
  '--btn-normal-hover-color-light',
  '--btn-normal-hover-border-color-light',
  '--btn-normal-active-color-light',
  '--btn-normal-active-border-color-light',
  '--btn-normal-color-dark',
  '--btn-normal-bg-dark',
  '--btn-normal-hover-color-dark',
  '--btn-normal-hover-border-color-dark',
  '--btn-normal-active-color-dark',
  '--btn-normal-active-border-color-dark',
  // 主要按钮颜色
  '--btn-primary-color-light',
  '--btn-primary-bg-light',
  '--btn-primary-hover-bg-light',
  '--btn-primary-active-bg-light',
  '--btn-primary-color-dark',
  '--btn-primary-bg-dark',
  '--btn-primary-hover-bg-dark',
  '--btn-primary-active-bg-dark',
  // 链接按钮颜色
  '--btn-link-color-light',
  '--btn-link-bg-light',
  '--btn-link-hover-color-light',
  '--btn-link-active-color-light',
  '--btn-link-color-dark',
  '--btn-link-bg-dark',
  '--btn-link-hover-color-dark',
  '--btn-link-active-color-dark',
  // 文本按钮颜色
  '--btn-text-color-light',
  '--btn-text-bg-light',
  '--btn-text-hover-bg-light',
  '--btn-text-active-bg-light',
  '--btn-text-color-dark',
  '--btn-text-bg-dark',
  '--btn-text-hoer-color-dark',
  '--btn-text-hover-bg-dark',
  '--btn-text-active-color-dark',
  '--btn-text-active-bg-dark',
  // 单选
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
  // 卡片
  '--card-color-light',
  '--card-bg-light',
  '--card-hover-bg-light',
  '--card-active-bg-light',
  '--card-color-dark',
  '--card-bg-dark',
  '--card-hover-bg-dark',
  '--card-active-bg-dark',
  // 进度条
  '--progress-bg-light',
  '--progress-inner-bg-light',
  '--progress-bg-dark',
  '--progress-inner-bg-dark',
  // 下拉
  '--dropdown-bg-light',
  '--dropdown-bg-dark',
  // 模态框
  '--modal-bg-light',
  '--modal-mask-bg-light',
  '--modal-bg-dark',
  '--modal-mask-bg-dark',
  // 开关
  '--switch-on-bg-light',
  '--switch-on-dot-bg-light',
  '--switch-on-bg-dark',
  '--switch-on-dot-bg-dark',
  '--switch-off-bg-light',
  '--switch-off-dot-bg-light',
  '--switch-off-bg-dark',
  '--switch-off-dot-bg-dark',
  // 输入框
  '--input-color-light',
  '--input-bg-light',
  '--input-color-dark',
  '--input-bg-dark',
  // 分割线
  '--divider-color-light',
  '--divider-color-dark',
  // 选择框
  '--select-color-light',
  '--select-bg-light',
  '--select-option-bg-light',
  '--select-color-dark',
  '--select-bg-dark',
  '--select-option-bg-dark',
  // 提示
  '--toast-bg-light',
  '--toast-bg-dark',
  // 菜单
  '--menu-bg-light',
  '--menu-item-hover-light',
  '--menu-bg-dark',
  '--menu-item-hover-dark',
  // 表格
  '--table-tr-odd-bg-light',
  '--table-tr-even-bg-light',
  '--table-tr-odd-hover-bg-light',
  '--table-tr-even-hover-bg-light',
  '--table-tr-odd-bg-dark',
  '--table-tr-even-bg-dark',
  '--table-tr-odd-hover-bg-dark',
  '--table-tr-even-hover-bg-dark',
  // 延迟颜色
  '--level-0-color',
  '--level-1-color',
  '--level-2-color',
  '--level-3-color',
  '--level-4-color'
]

const BackgroundList = [
  ['#4158D0', 'linear-gradient(43deg, #4158D0 0%, #C850C0 46%, #FFCC70 100%)'],
  ['#0093E9', 'linear-gradient(160deg, #0093E9 0%, #80D0C7 100%)'],
  ['#8EC5FC', 'linear-gradient(62deg, #8EC5FC 0%, #E0C3FC 100%)'],
  ['#D9AFD9', 'linear-gradient(0deg, #D9AFD9 0%, #97D9E1 100%)'],
  ['#FFFFFF', 'linear-gradient(180deg, #FFFFFF 0%, #6284FF 50%, #FF0000 100%)'],
  ['#00DBDE', 'linear-gradient(90deg, #00DBDE 0%, #FC00FF 100%)'],
  ['#FBAB7E', 'linear-gradient(62deg, #FBAB7E 0%, #F7CE68 100%)'],
  ['#85FFBD', 'linear-gradient(45deg, #85FFBD 0%, #FFFB7D 100%)'],
  ['#8BC6EC', 'linear-gradient(135deg, #8BC6EC 0%, #9599E2 100%)'],
  ['#FFDEE9', 'linear-gradient(0deg, #FFDEE9 0%, #B5FFFC 100%)'],
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
]

const onInstall = async () => {
  await Reset(false)
  await onReady()
  Plugins.message.success('安装完成')
}

const onUninstall = async () => {
  await Plugins.confirm('提示', '卸载后，主题文件将被删除！')
  await Plugins.Removefile(PATH)
  Clear()
}

const onReady = async () => {
  const config = JSON.parse(await Plugins.Readfile(THEME_FILE))
  await setVariable(config)
  await setBackground(config)
}

const onRun = async () => {
  const config = JSON.parse(await Plugins.Readfile(THEME_FILE))
  await setVariable(config)
  await setBackground(config)
  Plugins.message.success('主题已生效')
}

/**
 * 插件钩子 - 右键：下个背景
 */
const Next = async () => {
  const config = JSON.parse(await Plugins.Readfile(THEME_FILE))

  if (config.backgroundIndex++ >= BackgroundList.length - 1) {
    config.backgroundIndex = 0
  }

  await Plugins.Writefile(THEME_FILE, JSON.stringify(config, null, 2))

  await setBackground(config)
}

/**
 * 插件钩子 - 右键：清除主题
 */
const Clear = () => {
  VariableList.forEach((property) => {
    document.body.style.removeProperty(property)
  })
  document.body.style.backgroundColor = ''
  document.body.style.backgroundImage = ''
}

/**
 * 插件钩子 - 右键：重置配置
 */
const Reset = async (isReset = true) => {
  isReset && (await Plugins.confirm('提示', '主题文件将被替换为默认！'))

  const config = { variable: {}, backgroundIndex: 9 }

  const theme = getComputedStyle(document.documentElement)
  VariableList.forEach((property) => {
    config.variable[property] = theme.getPropertyValue(property)
  })

  await Plugins.Writefile(THEME_FILE, JSON.stringify(config, null, 2))

  isReset && Plugins.message.success('重置成功')

  isReset && onReady()
}

/**
 * 设置自定义CSS颜色
 */
const setVariable = async (config) => {
  Object.entries(config.variable).forEach(([property, value]) => {
    document.body.style.setProperty(property, value)
  })
  Plugin.PrimaryColor && document.body.style.setProperty('--primary-color', Plugin.PrimaryColor)
  Plugin.SecondaryColor && document.body.style.setProperty('--secondary-color', Plugin.SecondaryColor)
}

/**
 * 设置背景
 */
const setBackground = async (config) => {
  if (Plugin.EnableBgImage) {
    if (!Plugin.BgImagePath) {
      console.log(`[${Plugin.name}]`, '未提供背景图片地址，跳过。')
      return
    }

    const isFromNetwork = Plugin.BgImagePath.startsWith('http') || Plugin.BgImagePath.startsWith('//:')
    if (isFromNetwork) {
      document.body.style.backgroundImage = `url(${Plugin.BgImagePath})`
      document.body.style.backgroundSize = '100% 100%'
      return
    }

    const base64 = await Plugins.ignoredError(Plugins.Readfile, Plugin.BgImagePath, { Mode: 'Binary' })
    if (!base64) {
      console.log(`[${Plugin.name}]`, '读取背景图片失败，跳过。')
      return
    }

    const suffix = Plugin.BgImagePath.split('.').pop() || 'jpg'
    document.body.style.backgroundImage = `url(data:image/${suffix};base64,${base64})`
    return
  }

  const [color, gradientImage] = BackgroundList[config.backgroundIndex]
  document.body.style.backgroundColor = color
  document.body.style.backgroundImage = gradientImage
}
