/**
 * MMDB操作示例
 * Plugins.OpenMMDB(path, id)
 * Plugins.CloseMMDB(path, id)
 * Plugins.QueryMMDB(path, ip, type?)
 *      type可选值有：ASN|AnonymousIP|City|ConnectionType|Country|Domain|Enterprise
 *      默认为Country，其他类型则需要对应的数据库文件支持
 *
 * 可能性？
 * 1、配合Plugins.StartServer可开发出web查询api
 * 2、配合内核连接信息可做出可视化的流量飞线图
 */

const PATH = 'data/third/mmdb-example'
const DB = PATH + '/GeoLite2-Country.mmdb'

/* Trigger on::manual */
const onRun = async (isOpened = false) => {
  const action = await Plugins.picker.single(
    '请选择操作',
    [
      { label: '打开数据库', value: 'open' },
      { label: '查询数据库', value: 'query' },
      { label: '关闭数据库', value: 'close' }
    ],
    [isOpened ? 'query' : 'open']
  )

  if (action === 'open') {
    // 为何要传入Plugin.id？其实是需要传入唯一的标识符，正好Plugin.id符合。
    // 因为可能不止一个插件打开相同的数据库文件，得记录有哪些插件打开了同一个数据库文件
    await Plugins.OpenMMDB(DB, Plugin.id)
    Plugins.message.success('打开数据库成功')
    return await onRun(true)
  }

  if (action === 'query') {
    const ip = await Plugins.prompt('请输入要查询的IP', '', { placeholder: '8.8.8.8' })
    const info = await Plugins.QueryMMDB(DB, ip)
    await Plugins.alert('详情如下', info)
    return await onRun(true)
  }

  if (action === 'close') {
    // 为何要传入Plugin.id？其实是需要传入唯一的标识符，正好Plugin.id符合。
    // 因为得把这个插件从打开记录移除，如果此插件是最后一个引用数据库文件的，才需要真正关闭数据库文件
    await Plugins.CloseMMDB(DB, Plugin.id)
    Plugins.message.success('关闭数据库成功')
  }
}

/* Trigger Install */
const onInstall = async () => {
  const { destroy, success, error, update } = Plugins.message.info('下载GeoLite2-Country.mmdb...', 20 * 60 * 1000)
  await Plugins.Download('https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-Country.mmdb', DB, {}, (progress, total) => {
    update('下载GeoLite2-Country.mmdb... ' + ((progress / total) * 100).toFixed(2) + '%')
  })
    .then(() => {
      success('下载完成')
    })
    .catch((err) => {
      error('下载失败,原因：', err.message || err)
    })
    .finally(async () => {
      await Plugins.sleep(1000)
      destroy()
    })
  return 0
}

/* Trigger Uninstall */
const onUninstall = async () => {
  await Plugins.RemoveFile(PATH)
  return 0
}
