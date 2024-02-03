const onRun = () => {
  const profilesStore = Plugins.useProfilesStore()
  for (let i = 0; i < profilesStore.profiles.length; i++) {
    const profile = profilesStore.profiles[i]
    if (!profile.dnsConfig['nameserver-policy']) {
      profile.dnsConfig['nameserver-policy'] = {}
      profilesStore.editProfile(profile.id, profile)
      Plugins.message.success('修复配置文件: ' + profile.name + ' 成功')
    } else {
      Plugins.message.info('配置文件: ' + profile.name + ' 无需修复')
    }
  }
}
