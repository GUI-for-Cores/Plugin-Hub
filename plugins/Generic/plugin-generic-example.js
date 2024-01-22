const appSettings = Plugins.useAppSettingsStore()

const step1 = async () => {
  const messages = [
    ['欢迎运行GUI.for.Cores示例插件', 5000],
    ['让我分别向你展示插件具有的能力吧。', 5000],
    ['首先是APP设置相关的操作。', 5000],
    ['切换颜色到深色模式。', 5000, () => {
      appSettings.app.theme = 'dark'
    }],
    ['再切换为浅色模式', 3000, () => {
      appSettings.app.theme = 'light'
    }],
    ['将你的APP语言设置为英文', 3000, () => {
      appSettings.app.lang = 'en'
    }],
    ['再设置为中文', 3000, () => {
      appSettings.app.lang = 'zh'
    }],
    ['甚至是颜色的切换，默认颜色', 1500, () => {
      appSettings.app.color = 'default'
    }],
    ['橘色', 1500, () => {
      appSettings.app.color = 'orange'
    }],
    ['粉色', 1500, () => {
      appSettings.app.color = 'pink'
    }],
    ['天蓝色', 1500, () => {
      appSettings.app.color = 'skyblue'
    }],
    ['或是字体的切换', 1500, () => {
      appSettings.app['font-family'] = '宋体'
    }],
    ['黑体', 1500, () => {
      appSettings.app['font-family'] = '黑体'
    }],
    ['楷体', 1500, () => {
      appSettings.app['font-family'] = '楷体'
    }],
    ['隶书', 1500, () => {
      appSettings.app['font-family'] = '隶书'
    }],
    ['APP设置相关的API演示结束，具体的使用示例请查看源码。', 5000],
    ['本示例不定期更新，可点击更新按钮获取最新示例。', 5000],
    ['不用担心，所有的更改将会还原。', 5000],
  ]
  for (let i = 0; i < messages.length; i++) {
    Plugins.message.info(messages[i][0], messages[i][1])
    messages[i][2]?.()
    await Plugins.sleep(messages[i][1])
  }
}

const onRun = async () => {
  const backup = JSON.parse(JSON.stringify(appSettings.app))

  await step1()

  appSettings.app = backup
}