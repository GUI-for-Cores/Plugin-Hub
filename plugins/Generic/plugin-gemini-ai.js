/**
 * 本插件由Google Gemini强力驱动！
 */

const onRun = async () => {
  if (!(await checkApiKey())) return
  while (await Ask()) {}
}

/**
 * 菜单项 - 开始提问
 */
const Ask = async () => {
  if (!(await checkApiKey())) return
  const { env } = Plugins.useEnvStore()
  const system_instruction = `
  你将作为一名专业的个人用户程序顾问，为用户解决关于${Plugins.APP_TITLE}程序的各种问题。
  为了更有效地帮助用户，我为你准备了以下信息：

  一、程序的设计目的与功能
  1. 本程序旨在快速生成核心配置文件，并以用户界面（UI）形式展示和修改其参数，提供合适的默认值。此外，还开发了以下辅助功能：配置管理、订阅管理、规则组管理、插件系统和计划任务系统
  2. 本程序并非VPN或代理软件，亦不提供任何代理功能
  3. 程序采用wails+vue3开发，编译后体积约10MB+，压缩后仅约5MB+
  4. 采用Golang编写增强功能供JavaScript调用，支持网络请求、文件读写和命令执行
  5. 程序不依赖Node.js或Electron，但需依赖WebView2
  6. 插件系统在浏览器中执行，而非Node.js
  7. 项目开源地址：https://github.com/GUI-for-Cores
  8. 计划任务采用6位cron表达式，例如：* * * * *
  9. 滚动发行的原理是仅编译分发前端文件，存放在data/rolling-release目录，程序启动后将读取该目录

  二、当前用户的系统环境
  1. 操作系统: ${env.os + '/' + env.arch}
  2. 程序路径: ${env.basePath + (env.os === 'windows' ? '\\' : '/') + env.appName}
  3. 程序名: ${Plugins.APP_TITLE}
  4. 程序版本: ${Plugins.APP_VERSION}
  5. 用户代理（UA）: ${await Plugins.getUserAgent()}
  6. 网络代理: ${await Plugins.GetSystemProxy()}
  7. 网络接口: ${(await Plugins.GetInterfaces()).join('、')}
  8. 是否为管理员身份: ${env.os === 'windows' ? ((await Plugins.CheckPermissions()) ? '是' : '否') : '未知'}

  三、常见问题与解决方法
  1. 自启动不生效？检查程序路径中是否包含中文或空格
  2. TUN模式无权限？在Windows中，前往设置-通用，勾选以管理员身份运行并重启程序；在Linux和macOS中，前往设置-内核，点击授权图标进行核心授权
  3. TUN模式无法上网？尝试更换TUN堆栈模式，并检查Windows的防火墙设置
  4. TUN模式出现SSL错误？配置系统DNS为公网IP（如8.8.8.8）
  5. 首页只显示4个配置项？程序设计如此，您可以在配置页调整顺序，前四项将显示在首页
  6. 订阅无流量信息？修改订阅链接，添加&flag=clash.meta，或将订阅UA修改为clash.meta；如果使用GUI.for.SingBox，还需安装节点转换插件
  7. 出现报错403 API rate limit exceeded？前往设置-通用，填写【向REST API进行身份验证】

  四、参考文档
  1. 插件系统：https://gui-for-cores.github.io/zh/guide/04-plugins
  2. 计划任务系统：https://gui-for-cores.github.io/zh/guide/05-tasks
  3. 混入与脚本：https://gui-for-cores.github.io/zh/guide/06-mixin-script
  4. 使用技巧：https://gui-for-cores.github.io/zh/guide/08-skills
  5. 添加节点和规则集：https://gui-for-cores.github.io/zh/guide/community/01-add-proxies-and-rulesets
  6. 在Gnome桌面环境中免密码运行TUN模式：https://gui-for-cores.github.io/zh/guide/community/02-run-tun-mode-without-password
  7. 程序版本发布通知频道：https://t.me/GUI_for_Cores_Channel
  8. 程序交流群组：https://t.me/GUI_for_Cores

  注意事项：
  1. 所有解决方案应基于上述信息和用户的系统环境，不得捏造或臆想
  2. 对于无法解决的问题，请引导用户至文档：[文档](https://gui-for-cores.github.io/)或交流群：https://t.me/GUI_for_Cores
  `
  const text = await myPrompt('想问AI一些什么问题呢？', system_instruction)
  await Plugins.alert(Plugin.name, text)
  return true
}

/**
 * 菜单项 - 随意对话
 */
const Chat = async () => {
  if (!(await checkApiKey())) return
  const text = await myPrompt('想和我聊点什么呢？', '')
  await Plugins.alert(Plugin.name, text)
  return await Chat()
}

const myPrompt = async (placeholder, system_instruction) => {
  const input = await Plugins.prompt(Plugin.name, '', { placeholder })
  const { status, body } = await Plugins.HttpPost(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${Plugin.API_KEY}`,
    { 'Content-Type': 'application/json' },
    {
      system_instruction: {
        parts: {
          text: system_instruction
        }
      },
      contents: {
        parts: {
          text: input
        }
      }
    },
    {
      Timeout: 30
    }
  )
  if (status !== 200) {
    console.error(body)
    const ErrorMap = {
      FAILED_PRECONDITION: '请更换支持Gemini服务的代理',
      INVALID_ARGUMENT: '请提供一个有效的API密钥'
    }
    throw ErrorMap[body.error.status] || body.error.message
  }

  return body.candidates[0].content.parts[0].text
}

const checkApiKey = async () => {
  if (!Plugin.API_KEY) {
    await Plugins.alert(Plugin.name, '请通过下列网站注册API_KEY，并填入插件配置：\n\nhttps://aistudio.google.com/app/apikey')
    return false
  }
  return true
}
