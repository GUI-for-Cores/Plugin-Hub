const onRun = async () => {
  await updateGist()
}

const onTask = async () => {
  await updateGist();
  return '更新配置config.json到Gist.'
};

const updateGist = async () => {
  if (!Plugin.GistId) throw '未配置GIST ID'
  const store = Plugins.useProfilesStore()
  for (const profile of store.profiles)
  {
    const configJsonContent = await Plugins.generateConfig(profile)   
    const { id: messageId } = Plugins.message.info(`正在更新 [ ${profile.name} ]`, 60 * 1000)
    try {
      const updatedGist = await updateGistFile(profile.name, Plugin.GistId, JSON.stringify(configJsonContent, null, 4))
      Plugins.message.update(messageId, `更新 [ ${profile.name} ] ${updatedGist}`, 'success')
    } catch (error) {
      Plugins.message.update(messageId, `更新 [ ${profile.name} ] ${error}`, 'error')
    } finally {
      await Plugins.sleep(1500).then(() => Plugins.message.destroy(messageId))
    }
  }
}

async function updateGistFile(name, gistId, configJsonContent) {
  if (!Plugin.Authorization) throw '未配置TOKEN'
  let jsonName = name + '.json'
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
        [jsonName]: {
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
