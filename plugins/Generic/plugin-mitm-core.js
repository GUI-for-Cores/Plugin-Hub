/**
 * 本插件使用暂未开源的项目【MITM-Core】，请前往交流群手动下载MITM-Core.exe文件，并放入data/third/mitm-core文件夹。
 */

const PATH = 'data/third/mitm-core'
const CORE_PATH = PATH + '/MITM-Core.exe'
const RULES_PATH = PATH + '/rules'
const PID_PATH = PATH + '/pid.txt'
const GUI_RULES_PATH = RULES_PATH + '/gui.rules'

/** @type {EsmPlugin} */
export default (Plugin) => {
  const onInstall = async () => {
    if (!(await checkCore())) {
      Plugins.alert('提示', '请前往TG交流群下载【MITM-Core.exe】文件并放入此文件夹中：\n\n' + CORE_PATH)
    }
  }

  const onRun = async () => {
    console.log(`[${Plugin.name}]`, { ...Plugin })
    if (!(await checkCore())) {
      Plugins.message.info('请前往TG交流群下载【MITM-Core.exe】。')
      return
    }
    showUI()
  }

  /* 触发器 核心启动后 */
  const onCoreStarted = async () => {
    await startService()
    Plugins.alert('提示', '插件暂未完善，请手动将系统代理设置为mitm-core的监听地址: ' + Plugin.AddrAndPort)
    return 1
  }

  /* 触发器 核心停止后 */
  const onCoreStopped = async () => {
    await stopService()
    return 2
  }

  const showUI = () => {
    const component = {}
    const modal = Plugins.modal(
      {
        title: Plugin.name,
        width: '90',
        height: '90'
      },
      {
        default: () => Vue.h(component)
      }
    )
    modal.open()
  }

  /** 右键 - 编辑规则 */
  const EditRules = async () => {
    const { ref, onMounted } = Vue
    const rules = ref('')

    const component = {
      template: `
      <div>
        <CodeEditor v-model="rules" lang="yaml" editable placeholder="<URL_Regex> -> <Action> [key:value key:value ...] -> <Action> ..." />
      </div>`,
      setup() {
        const initRules = async () => {
          const txt = await Plugins.ReadFile(GUI_RULES_PATH).catch(() => `https://(www\.)?baidu\.com -> redirect url:https://google.com`)
          rules.value = txt
        }
        onMounted(() => initRules())
        return { rules }
      }
    }
    const modal = Plugins.modal(
      {
        title: '编辑规则',
        width: '90',
        height: '90',
        async onOk() {
          await Plugins.WriteFile(GUI_RULES_PATH, rules.value)
          await stopService()
          await startService()
        }
      },
      {
        default: () => Vue.h(component)
      }
    )
    modal.open()
  }

  return { onInstall, onRun, EditRules, onCoreStarted, onCoreStopped }
}

const checkCore = async () => {
  return await Plugins.FileExists(CORE_PATH)
}

const startService = async () => {
  const proxy = await Plugins.GetRequestProxy('kernel')
  if (!proxy) {
    Plugins.message.info('请添加至少一个http/socks/mixed入站作为mitm-core的上游代理')
    return 2
  }
  await Plugins.ExecBackground(
    await Plugins.AbsolutePath(CORE_PATH),
    ['-addr', Plugin.AddrAndPort, '-rules-dir', await Plugins.AbsolutePath(RULES_PATH), '-upstream-proxy-url', proxy],
    (out) => {
      console.log(`[${Plugin.name}]`, out)
    },
    (end) => {
      console.log(`[${Plugin.name}]`, end)
    },
    {
      PidFile: PID_PATH,
      WorkingDirectory: await Plugins.AbsolutePath(PATH)
    }
  )
}

const stopService = async () => {
  const pid = await Plugins.ReadFile(PID_PATH).catch(() => '')
  if (pid) {
    await Plugins.KillProcess(Number(pid)).catch((e) => {
      console.log(`[${Plugin.name}]`, e)
    })
  }
}
