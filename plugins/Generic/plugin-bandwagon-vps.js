var currentVPS = null

const onRun = async () => {
  if (!currentVPS) {
    await chooseVPS()
  }

  const options = [
    { label: '基本信息', value: 'getServiceInfo' },
    { label: '创建快照', value: 'snapshot' },
    { label: '开机', value: 'start' },
    { label: '重启', value: 'restart' },
    { label: '关机', value: 'stop' },
    { label: '强制关机', value: 'kill' },
    { label: '重装系统', value: 'reinstallOS' },
    { label: '重置root密码', value: 'resetRootPassword' },
    { label: '查看审核日志', value: 'getAuditLog' }
  ]

  const action = await Plugins.picker.single('请选择操作', options, ['getServiceInfo'])

  const handler = {
    getServiceInfo: async () => {
      const res = await httpGet('/getServiceInfo')
      await Plugins.alert(
        res.hostname,
        `
分配的IP: ${res.ip_addresses.join('、')}
物理位置: ${res.node_location}
IPv6支持: ${res.location_ipv6_ready ? '支持' : '不支持'}
磁盘总计: ${res.plan_disk / 1024 / 1024 / 1024} GB
内存总计: ${res.plan_ram / 1024 / 1024 / 1024} GB
操作系统: ${res.os}
月流量配额: ${(res.data_counter / 1024 / 1024 / 1024) * res.monthly_data_multiplier} / ${(res.plan_monthly_data / 1024 / 1024 / 1024) * res.monthly_data_multiplier} GB
流量下次重置日期: ${new Date(res.data_next_reset * 1000).toLocaleString()}
流量计费系数: ${res.monthly_data_multiplier}
      `
      )
    },
    snapshot: async () => {
      const description = await Plugins.prompt('请输入快照描述')
      if (!description) return
      const { notificationEmail } = await httpGet('/snapshot/create', { description })
      Plugins.message.success('创建快照成功，已通知邮箱：' + notificationEmail)
    },
    start: async () => {
      await httpGet('/start')
      Plugins.message.success('开机成功')
    },
    restart: async () => {
      await httpGet('/restart')
      Plugins.message.success('重启成功')
    },
    stop: async () => {
      await httpGet('/stop')
      Plugins.message.success('关机成功')
    },
    kill: async () => {
      await httpGet('/kill')
      Plugins.message.success('强制关机成功')
    },
    reinstallOS: async () => {
      const { installed, templates } = await httpGet('/getAvailableOS')
      const os = await Plugins.picker.single(
        '请选择要重装的操作系统',
        templates.map((v) => ({ label: v, value: v })),
        [installed]
      )
      await Plugins.confirm('警告', `确定要重装系统吗，所有资料将被清空！\n\n改变如下：\n\n${installed}  =>  ${os}`)
      await httpGet('/reinstallOS', { os })
    },
    resetRootPassword: async () => {
      await Plugins.confirm('提示', '确定要重置root密码吗？')
      const { password } = await httpGet('/resetRootPassword')
      await Plugins.alert('重置密码成功', '新密码：' + password)
    },
    getAuditLog: async () => {
      const { log_entries } = await httpGet('/getAuditLog')
      const logs = log_entries.map(({ timestamp, summary }) => {
        return new Date(Number(timestamp + '000')).toLocaleString() + ' => ' + summary
      })
      await Plugins.alert('审核日志', logs.join('\n'))
    }
  }

  await handler[action]()
}

const chooseVPS = async () => {
  if (Plugin.VPS_LIST.length === 0) throw '请先配置VPS信息'
  let vps
  if (Plugin.VPS_LIST.length === 1) {
    vps = Plugin.VPS_LIST[0]
  } else {
    vps = await Plugins.picker.single(
      '请选择要操作的VPS',
      Plugin.VPS_LIST.map((v) => ({ label: v.split(',')[0], value: v })),
      []
    )
  }

  currentVPS = vps.split(',')
  if (currentVPS.length !== 3) throw '这台VPS信息配置有误，请重新配置'
}

const httpGet = async (url, params) => {
  params = { ...params, veid: currentVPS[1], api_key: currentVPS[2] }
  const query = new URLSearchParams(params).toString()
  const { body } = await Plugins.HttpGet(`https://api.64clouds.com/v1${url}?${query}`)
  const json = JSON.parse(body)
  console.log(json)
  if (json.error !== 0) throw '出现错误'
  return json
}
