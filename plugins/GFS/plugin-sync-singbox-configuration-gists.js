const onRun = async () => {
  await updateGist()
}

const onTask = async () => {
  await updateGist();
  return '更新 Gist.'
};

const updateGist = async () => {
  if (!Plugin.GistId) throw '未配置GIST ID'
  const store = Plugins.useProfilesStore()
  let profile = null
  if (!Plugin.ProfileName) {
    profile = await Plugins.picker.single(
      '请选择要同步的配置',
      store.profiles.map((v) => ({
        label: v.name,
        value: v
      })),
      []
    )
  } else {
    profile = store.profiles.find(item => item.name === Plugin.ProfileName)
    if (!profile)
      throw "未找到配置：" + Plugin.ProfileName
  }
  const configJsonContent = await Plugins.generateConfig(profile)
  const { id: messageId } = Plugins.message.info('正在更新 Gist...', 60 * 1000)

  try {
    const updatedGist = await updateGistFile(Plugin.GistId, JSON.stringify(configJsonContent, null, 4))
    Plugins.message.update(messageId, `Gist 更新成功: ${updatedGist}`, 'success')
  } catch (error) {
    Plugins.message.update(messageId, `Gist 更新失败: ${error}`, 'error')
  } finally {
    await Plugins.sleep(1500).then(() => Plugins.message.destroy(messageId))
  }
}

async function updateGistFile(gistId, configJsonContent) {
  if (!Plugin.Authorization) throw '未配置TOKEN'

  const { body } = await Plugins.HttpPatch(
    `https://api.github.com/gists/${gistId}`,
    {
      'User-Agent': 'GUI.for.Cores',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      Connection: 'close',
      Authorization: 'Bearer ' + Plugin.Authorization
    },
    {
      files: {
        'config.json': {
          content: configJsonContent
        }
      }
    }
  )
  if (body.message) {
    throw body.message
  }
  return 'ok'
}
