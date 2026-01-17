/* 触发器 手动触发 */
const onRun = async () => {
  openUI()
}

const openUI = () => {
  const content = {
    template: /* html */ `
    <div class="flex flex-col pb-12">
        <template v-if="isRegistered">
            <h3>
              已注册，现在你可以使用机场的一键导入订阅功能！
            </h3>
            <Button @click="handleDelete" class="min-h-42" type="text">从注册表移除</Button>
        </template>
        <template v-else>
            <Button @click="handleImport" class="min-h-64" type="primary">添加到注册表</Button>
        </template>
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
        handleDelete,
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      footer: false,
      maskClosable: true,
      afterClose() {
        modal.destroy()
      }
    },
    {
      default: () => Vue.h(content)
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
