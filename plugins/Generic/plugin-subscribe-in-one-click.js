/* 触发器 手动触发 */
const onRun = async () => {
  openUI()
}

const openUI = () => {
  const content = {
    template: /* html */ `
    <div class="flex items- justify-center pb-32">
      <Button v-if="isRegistered" @click="handleDelete" class="w-128 h-128 rounded-full shadow" type="text">
        <span class="font-bold text-24">移除</span>
      </Button>
      <Button v-else @click="handleImport" class="w-128 h-128 rounded-full shadow" type="primary">
        <span class="font-bold text-24">注册</span>
      </Button>
    </div>`,
    setup() {
      const { ref } = Vue
      const protocol = {
        'GUI.for.SingBox': 'sing-box',
        'GUI.for.Clash': 'clash'
      }[Plugins.APP_TITLE]
      const regKey = `HKEY_CURRENT_USER\\Software\\Classes\\${protocol}`

      const isRegistered = ref(false)

      const refreshStatus = () => {
        regExists(regKey).then((res) => (isRegistered.value = res))
      }

      refreshStatus()

      const handleImport = async () => {
        if (!protocol) {
          Plugins.message.error('暂未适配此客户端')
          return
        }
        const envStore = Plugins.useEnvStore()
        const path = envStore.env.appPath.replaceAll('\\', '\\\\')
        const file = 'data/.cache/register_protocol.reg'
        const reg = `Windows Registry Editor Version 5.00
[${regKey}]
"URL Protocol"="${path}"
@="${envStore.env.appName}"
[${regKey}\\shell\\open\\command]
@="\\"${path}\\" \\"%1\\""`

        await Plugins.WriteFile(file, reg)
        const abs_file = await Plugins.AbsolutePath(file)
        await Plugins.Exec('reg', ['import', abs_file], { Convert: true })
        Plugins.message.success('注册完成')
        refreshStatus()
      }

      const handleDelete = async () => {
        if (!protocol) {
          Plugins.message.error('暂未适配此客户端')
          return
        }
        await Plugins.Exec('reg', ['delete', regKey, '/f'], { Convert: true })
        Plugins.message.success('移除完成')
        refreshStatus()
      }
      return {
        isRegistered,
        handleImport,
        handleDelete
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      submit: false,
      cancel: false,
      maskClosable: true,
      afterClose() {
        modal.destroy()
      }
    },
    {
      default: () => Vue.h(content),
      action: () => Vue.h('div', { class: 'mr-auto text-12' }, '注：此功能使用系统注册表，注册后同类型软件的导入功能将失效。')
    }
  )

  modal.open()
}

// 检测注册表项是否存在
const regExists = async (key) => {
  const res = await Plugins.Exec('reg', ['query', key], { Convert: true }).catch(() => '')
  if (res.includes(key)) {
    return true
  }
  return false
}
