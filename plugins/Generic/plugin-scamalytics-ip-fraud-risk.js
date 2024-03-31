const checkIpFraudRisk = async (ip) => {
  const url = `https://${Plugin.hostname}/${Plugin.username}/?ip=${ip}&key=${Plugin.key}&test=0`
  const { header, body } = await Plugins.HttpGet(url)

  let status = body.status
  let error = body.error

  let score = body.score
  let risk = body.risk

  if (status === 'error') {
    const text1 = `💥 ${error} 💥`

    const message = `
                      ${text1}`

    Plugins.alert('Error❗❗❗', message)
  } else {
    let scoreemoji = '🔢'
    let levelemoji = '🌟'
    let riskemoji
    if (risk === 'very high') {
      riskemoji = '🔴' // 代表非常高风险
    } else if (risk === 'high') {
      riskemoji = '🟠' // 代表高风险
    } else if (risk === 'medium') {
      riskemoji = '🟡' // 代表中等风险
    } else if (risk === 'low') {
      riskemoji = '🟢' // 代表低风险
    }

    const text1 = `🌐 IP: ${ip}`
    const text2 = `${scoreemoji} Risk score: ${score}`
    const text3 = `${riskemoji} Discrete risk level: ${risk}`

    const message = `
    ${text1}
    ${text2}
    ${text3}`

    Plugins.alert('Scamalytics IP 欺诈风险', message)
  }
}

const getip = async () => {
  const { header, body } = await Plugins.HttpGet('https://ipapi.co/json')
  // 将 json 中的值赋给不同的变量
  let ip = body.ip
  return ip
}

const onRun = async () => {
  if (!Plugin.hostname || !Plugin.username || !Plugin.key) {
    throw '请先【配置插件】'
  }
  await getip()
  const ip = await getip()
  await checkIpFraudRisk(ip)
}

const manual = async () => {
  if (!Plugin.hostname || !Plugin.username || !Plugin.key) {
    throw '请先【配置插件】'
  }
  const ip = await Plugins.prompt('请输入需要查询的 IP 地址', '' /* 'initialValue' */, {
    placeholder: 'IP 地址，例如: 1.1.1.1'
  })
  await checkIpFraudRisk(ip)
}
