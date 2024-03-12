/* 获取UWP应用列表 */
const getUWPList = async () => {
  const pattern = /REG_SZ\s+(.+)/

  const res = await Plugins.Exec(
    'Reg',
    ['Query', 'HKCU\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppContainer\\Mappings'],
    true
  )

  const sids = res
    .split('\n')
    .filter((v) => v.startsWith('HKEY_CURRENT_USER'))
    .map((v) => v.trim('\r'))

  const list = []

  const promises = sids.map(async (sid) => {
    const detail = await Plugins.Exec('Reg', ['Query', sid, '/v', 'DisplayName', '/t', 'REG_SZ'], true)
    const match = detail.match(pattern)
    if (!match || !match[1]) return
    if (match[1].includes('ms-resource')) return
    list.push({ label: match[1], value: sid.split('\\').pop() })
  })

  await Promise.all(promises)

  return list.sort((a, b) => a.label.localeCompare(b.label))
}

/* 添加到解除列表 */
const addLoopbackExempt = async (sids) => {
  for (let i = 0; i < sids.length; i++) {
    await Plugins.Exec('CheckNetIsolation', ['LoopbackExempt', '-a', '-p=' + sids[i]], true)
  }
}

/* 从解除列表中移除 */
const removeLoopbackExempt = async (sids) => {
  for (let i = 0; i < sids.length; i++) {
    await Plugins.Exec('CheckNetIsolation', ['LoopbackExempt', '-d', '-p=' + sids[i]], true)
  }
}

const onRun = async () => {
  // 所有UWP列表
  const list = await getUWPList()

  // 已解除的列表
  const exemptList = await Plugins.Exec('CheckNetIsolation', ['LoopbackExempt', '-s'], true)
  const initialValue = list.filter((v) => exemptList.includes(v.value)).map((v) => v.value)
  console.log('已解除的列表：', initialValue)

  // 用户选择的UWP列表
  const selected = await Plugins.picker.multi('请选择要解除限制的UWP程序', list, initialValue)

  // 获取勾选的程序
  const tobeAdded = selected.filter((v) => !initialValue.includes(v))

  // 解除限制
  if (tobeAdded.length) {
    console.log('开始解除限制', tobeAdded)
    const res = await addLoopbackExempt(tobeAdded)
    Plugins.message.success('解除 【' + tobeAdded.length + '】 个UWP应用。')
  }

  // 获取取消勾选的的程序
  const canceled = initialValue.filter((v) => !selected.includes(v))

  // 取消解除限制
  if (canceled.length) {
    console.log('开始取消解除限制', canceled)
    const res = await removeLoopbackExempt(canceled)
    Plugins.message.success('取消解除 【' + canceled.length + '】 个UWP应用。')
  }
}
