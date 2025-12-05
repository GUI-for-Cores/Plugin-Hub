/* 触发器 手动触发 */
const onRun = async () => {
  openUI()
}

const openUI = () => {
  const content = {
    template: /* html */ `
    <div class="flex flex-col">
        <template v-if="isRegistered">
            <h3>
              ✨已注册，现在你可以使用机场的一键导入订阅功能！
            </h3>
            <Button @click="handleDelete" class="min-h-42" type="text">从注册表移除</Button>
        </template>
        <template v-else>
            <Button @click="handleImport" class="min-h-64" type="primary">添加到注册表</Button>
        </template>
        <div class="flex items-center text-12 py-12">
            注：如果你之前运行过【注册xx协议到注册表】插件，请点击此处<Button @click="handleDeleteLegacy" :loading="deleteLegacyLoading" type="link">移除</Button>老的注册表。
        </div>
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

        if (await regExists(regKey)) {
          Plugins.message.info('已注册过，无需重复注册')
          return
        }

        const envStore = Plugins.useEnvStore()
        const path = envStore.env.appPath.replaceAll('/', '\\\\')
        const file = 'data/.cache/register_protocol.reg'
        const reg = `Windows Registry Editor Version 5.00
[${regKey}]
"URL Protocol"="${path}"
@="${envStore.env.appName}"
[${regKey}\\shell\\open\\command]
@="\\"${path}\\" \\"%1\\""`

        await Plugins.WriteFile(file, reg)
        await Plugins.Exec('reg', ['import', file])
        Plugins.message.success('注册完成')
        refreshStatus()
      }

      const handleDelete = async () => {
        if (!protocol) {
          Plugins.message.error('暂未适配此客户端')
          return
        }
        if (!(await regExists(regKey))) {
          Plugins.message.info('未发现注册表项，无需移除')
          return
        }
        await Plugins.Exec('reg', ['delete', regKey, '/f'])
        Plugins.message.success('移除完成')
        refreshStatus()
      }

      const deleteLegacyLoading = ref(false)
      const handleDeleteLegacy = async () => {
        if (!protocol) {
          Plugins.message.error('暂未适配此客户端')
          return
        }

        deleteLegacyLoading.value = true

        try {
          const oldRegKey = `HKEY_CLASSES_ROOT\\${protocol}`
          const oldRegistryDetected = await regExists(oldRegKey)
          if (!oldRegistryDetected) {
            Plugins.message.info('未发现旧的注册表项目')
            return
          }
          await Plugins.Exec('reg', ['delete', oldRegKey, '/f']).catch(() => 0)
          await Plugins.sleep(500)
          if (await regExists(oldRegKey)) {
            Plugins.message.error('移除旧的注册表失败，请尝试以管理员身份重启应用')
          } else {
            Plugins.message.success('旧的注册表项目已移除')
          }
        } finally {
          deleteLegacyLoading.value = false
        }
      }
      return {
        isRegistered,
        handleImport,
        handleDelete,
        handleDeleteLegacy,
        deleteLegacyLoading
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
const regExists = (key) => {
  return new Promise((resolve) => {
    Plugins.ExecBackground(
      'reg',
      ['query', key],
      (o) => {
        if (o.includes(key)) {
          resolve(true)
        }
      },
      () => {
        resolve(false)
      }
    )
  })
}
