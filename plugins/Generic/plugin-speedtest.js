const onRun = async () => {
  const starttime = Date.now()

  // 将 YAML 中的值赋给不同的变量
  const mb = Plugin.testFileSize

  const bytes = mb * 1024 * 1024
  const url = `https://speed.cloudflare.com/__down?bytes=${bytes}`
  const path = 'data/.cache/speedtest.file'

  const pingurl = 'http://connectivitycheck.gstatic.com/generate_204'

  const { id } = Plugins.message.info('延迟测试中，请稍后...', 200_000)

  let pingduration // 在共同作用域内声明变量

  const pingstart = Date.now()

  try {
    await Plugins.HttpGet(pingurl)

    const pingend = Date.now()
    const pingDuration = pingend - pingstart

    if (pingDuration > 10000) {
      Exists = false

      pingduration = 'Error'
      Plugins.message.update(id, '延迟测试失败')
    } else {
      pingduration = pingDuration.toFixed(2) + ' ms  ' // 保留两位小数

      Exists = true
      Plugins.message.update(id, '延迟测试成功')
    }
  } catch (error) {
    Exists = false

    pingduration = 'Error'
    Plugins.message.destroy(arch)
    Plugins.message.update(id, '延迟测试失败')
  }

  await Plugins.sleep(1_000)
  Plugins.message.update(id, '下行速度测试中，请稍后...', 20000_000)

  let end
  let speed
  let duration

  const start = Date.now()

  try {
    await Plugins.Download(url, path)
    end = Date.now()

    FileExists = true
  } catch (error) {
    FileExists = false

    speed = 'Error'
    duration = 'Error'

    Plugins.message.update(id, '下行速度测试失败', 1_000)
  }

  if (FileExists) {
    Plugins.message.update(id, '下行速度测试完成', 1_000)

    const Duration = (end - start) / 1000
    const Speed = mb / Duration

    duration = Duration.toFixed(2) + ' s  ' // 保留两位小数
    speed = Speed.toFixed(2) + ' MB/s  ' // 保留两位小数

    Plugins.Removefile(path)
  }

  await Plugins.sleep(1_000)
  Plugins.message.destroy(id)

  const endtime = Date.now()
  const Time = ((endtime - starttime) / 1000).toFixed(2) + ' s  ' // 保留两位小数

  const text0 = `⚡ 延迟: ${pingduration} `
  const text1 = `💨 下行速度: ${speed} `
  const text2 = `⏳ 测试耗时：${Time} `

  const message = `
    ${text0}
    ${text1}
    ${text2}`

  Plugins.alert('测速结果', message)
}
