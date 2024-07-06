/* Trigger on::manual */
const onRun = async () => {
  const action = await Plugins.picker.single(
    Plugin.name,
    [
      { label: '切换为【普通配置】', value: 'Normal' },
      { label: '切换为【开发配置】', value: 'Development' },
      { label: '切换为【生产配置】', value: 'Production' }
    ],
    ['Normal']
  )

  const handler = {
    Normal,
    Development,
    Production
  }

  await handler[action]()
}

const Normal = async () => {
  if (!Plugin.NormalHosts) throw '普通hosts为空，请先配置'
  await Plugins.Writefile(getHostsFilePath(), Plugin.NormalHosts)
  Plugins.message.success('Hosts文件已切换为普通配置')
}

const Development = async () => {
  if (!Plugin.DevHosts) throw '开发hosts为空，请先配置'
  await Plugins.Writefile(getHostsFilePath(), Plugin.DevHosts)
  Plugins.message.success('Hosts文件已切换为开发配置')
}

const Production = async () => {
  if (!Plugin.ProdHosts) throw '生产hosts为空，请先配置'
  await Plugins.Writefile(getHostsFilePath(), Plugin.ProdHosts)
  Plugins.message.success('Hosts文件已切换为生产配置')
}

const getHostsFilePath = () => {
  const envStore = Plugins.useEnvStore()
  return envStore.env.os === 'windows' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts'
}
