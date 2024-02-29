const onRun = async () => {
  const pluginsStore = Plugins.usePluginsStore()
  for(const plugin of pluginsStore.plugins) {
    if(plugin.configuration == undefined) {
      plugin.configuration = []
      await pluginsStore.editPlugin(plugin.id, plugin)
      Plugins.message.success('插件[' + plugin.name + ']修复成功')
    }else {
      Plugins.message.info('插件[' + plugin.name + ']无需修复')
    }
  }
}
