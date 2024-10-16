const onRun = async () => {
  await updateGist();
};

const onTask = async () => {
  await updateGist();
  return '更新 Gist.'
};

const updateGist = async () => {
  if (!Plugin.GistId) throw '未配置GIST ID';
  const { id: messageId } = Plugins.message.info('正在更新 Gist...', 60 * 60 * 1000);

  try {
    const configJsonContent = await Plugins.Readfile('data/sing-box/config.json');
    if (!configJsonContent) throw 'config.json 文件不存在';

    const updatedGist = await updateGistFile(Plugin.GistId, configJsonContent);
    Plugins.message.update(messageId, `Gist 更新成功: ${updatedGist}`, 'success');
  } catch (error) {
    Plugins.message.update(messageId, `Gist 更新失败: ${error}`, 'error');
  } finally {
    await Plugins.sleep(1500).then(() => Plugins.message.destroy(messageId));
  }
};


async function updateGistFile(gistId, configJsonContent) {
  if (!Plugin.Authorization) throw '未配置TOKEN';

  const { body } = await Plugins.HttpPatch(`https://api.github.com/gists/${gistId}`, {
      'User-Agent': 'GUI.for.Cores',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: 'application/vnd.github+json',
      Connection: 'close',
      Authorization: 'Bearer ' + Plugin.Authorization
    }, {
      files: {
        'config.json': {
          content: configJsonContent
        }
      }
    });
  if (body.message) {
    throw body.message
  }
  return 'ok'
}
