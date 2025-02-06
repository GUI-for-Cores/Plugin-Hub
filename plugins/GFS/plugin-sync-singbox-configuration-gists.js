const onRun = async () => {
  await updateGist()
}

const onTask = async () => {
  return updateGist();
};

const updateGist = async () => {
  if (!Plugin.GistId) throw '未配置GIST ID'
  const store = Plugins.useProfilesStore()
  let str = ''
  for (const profile of store.profiles)
  {
    const configJsonContent = await Plugins.generateConfig(profile)   
    const { id: messageId } = Plugins.message.info(`updating [ ${profile.name} ]`, 60 * 1000)
    try {
      const updatedGist = await updateGistFile(profile.name, Plugin.GistId, JSON.stringify(configJsonContent, null, 4))
      Plugins.message.update(messageId, `update [ ${profile.name} ] ${updatedGist}`, 'success')
      str += `update [ ${profile.name} ] ${updatedGist}. `
    } catch (error) {
      Plugins.message.update(messageId, `update [ ${profile.name} ] ${error}`, 'error')
      str += `update [ ${profile.name} ] ${error}. `
    } finally {
      await Plugins.sleep(1500).then(() => Plugins.message.destroy(messageId))
    }
  }
  return str
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
  return 'success'
}
