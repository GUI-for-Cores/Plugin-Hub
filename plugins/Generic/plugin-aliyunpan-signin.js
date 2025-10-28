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
  const { code, message, refresh_token, access_token } = body
  if (code) {
    throw message
  }
  return { refresh_token, access_token }
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

  if (body.code) {
    throw body.message
  }

  const { signInLogs, signInCount } = body.result

  // 未领取奖励列表
  // const rewards = signInLogs.filter((v) => v.status === 'normal' && !v.isReward)

  // for await (reward of rewards) {
  //   await getReward(access_token, reward.day).catch((err) => {
  //     console.log('领取奖励失败：', err)
  //   })
  // }

  return `累计签到${signInCount}天。`
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
  if (!Plugin.RefreshTokenList?.length) throw '未提供任何账号'

  const TOKEN_CONFIG = 'data/third/aliyunpan-signin/config.json'

  const tokenConfig = (await Plugins.ignoredError(Plugins.ReadFile, TOKEN_CONFIG)) || '{}'
  const TokenMap = JSON.parse(tokenConfig)

  async function refreshAccessToken(token, refreshToken) {
    const { refresh_token, access_token } = await updateAccesssToken(refreshToken)
    TokenMap[token] = {
      refresh_token,
      access_token
    }
  }

  const res = []

  for (let i = 0; i < Plugin.RefreshTokenList.length; i++) {
    const token = Plugin.RefreshTokenList[i]
    const { refresh_token: latestRefreshToken = token, access_token: latestAccessToken } = TokenMap[token] || {}

    try {
      if (!latestAccessToken) {
        await refreshAccessToken(token, latestRefreshToken)
      }
      if (TokenMap[token]?.access_token) {
        try {
          const days = await sign_in(TokenMap[token].access_token)
          res.push(`账号【${token.slice(0, 8)}】签到成功，` + days)
        } catch (error) {
          await refreshAccessToken(token, TokenMap[token]?.refresh_token || token)
          const days = await sign_in(TokenMap[token].access_token)
          res.push(`账号【${token.slice(0, 8)}】签到成功，` + days)
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  await Plugins.WriteFile(TOKEN_CONFIG, JSON.stringify(TokenMap, null, 2))

  return res
}

const onRun = async () => {
  const res = await SignIn()
  Plugins.alert('签到信息', res.join('\n'))
}

const onTask = async () => {
  try {
    const res = await SignIn()
    return res.join('\n')
  } catch (error) {
    return error
  }
}
