/**
 * 本插件参考项目：https://github.com/mrabit/aliyundriveDailyCheck/blob/master/autoSignin.js
 */

const UA =
  'Mozilla/5.0 (iPhone; U; CPU iPhone OS 4_3_3 like Mac OS X; en-us) AppleWebKit/533.17.9 (KHTML, like Gecko) Version/5.0.2 Mobile/8J2 Safari/6533.18.5'

// 使用 refresh_token 更新 access_token
async function updateAccesssToken(refreshToken) {
  const { body } = await Plugins.HttpPost(
    'https://auth.aliyundrive.com/v2/account/token',
    {
      'User-Agent': UA,
      'Content-Type': 'application/json'
    },
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }
  )
  console.log('updateAccesssToken =>', body)
  const { code, message, nick_name, refresh_token, access_token } = body
  if (code) {
    if (code === 'RefreshTokenExpired' || code === 'InvalidParameter.RefreshToken') {
      throw 'refresh_token 已过期或无效'
    } else {
      throw message
    }
  }
  return { nick_name, refresh_token, access_token }
}

//签到列表
async function sign_in(access_token) {
  const { body } = await Plugins.HttpPost(
    'https://member.aliyundrive.com/v1/activity/sign_in_list?_rx-s=mobile',
    {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      Authorization: access_token
    },
    {
      isReward: false
    }
  )

  console.log('sign_in =>', body)

  if (!body.success) {
    throw body.message
  }

  const { signInLogs, signInCount } = body.result
  const currentSignInfo = signInLogs[signInCount - 1] // 当天签到信息

  console.log(`本月累计签到 ${signInCount} 天`)

  // 未领取奖励列表
  const rewards = signInLogs.filter((v) => v.status === 'normal' && !v.isReward)

  for await (reward of rewards) {
    const signInDay = reward.day
    try {
      const rewardInfo = await getReward(access_token, signInDay)
      console.log(`第${signInDay}天奖励领取成功: 获得${rewardInfo.name || ''}${rewardInfo.description || ''}`)
    } catch (e) {
      console.log(`第${signInDay}天奖励领取失败:`, e)
    }
  }

  if (currentSignInfo.isReward) {
    const msg = `今日签到奖励：
${currentSignInfo.calendarChinese}(${currentSignInfo.calendarMonth}${currentSignInfo.calendarDay})
${currentSignInfo.reward.name}
${currentSignInfo.reward.subNotice}
`
  }
}

// 领取奖励
async function getReward(access_token, signInDay) {
  const { body } = await Plugins.HttpPost(
    'https://member.aliyundrive.com/v1/activity/sign_in_reward?_rx-s=mobile',
    {
      'User-Agent': UA,
      'Content-Type': 'application/json',
      authorization: access_token
    },
    {
      signInDay
    }
  )

  if (!body.success) {
    throw body.message
  }
}

const SignIn = async () => {
  if (!Plugin.RefreshTokenList) throw '未提供任何账号'
  const res = []
  for (let i = 0; i < Plugin.RefreshTokenList.length; i++) {
    const refreshToken = Plugin.RefreshTokenList[i]
    try {
      // TODO: 保存 refresh_token 和 access_token 和过期时间
      const { nick_name, refresh_token, access_token } = await updateAccesssToken(refreshToken)
      await sign_in(access_token)
      res.push(`账号【${nick_name}】签到成功`)
    } catch (e) {
      console.log(e)
      res.push(`账号【${nick_name}】签到失败`)
    }
  }
}

const onRun = async () => {
  await SignIn()
}

const onTask = async () => {
  try {
    const res = await SignIn()
    return res.join('\n')
  } catch (error) {
    return error
  }
}
