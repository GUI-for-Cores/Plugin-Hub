/**
 * 本插件由Google Gemini强力驱动！
 */

const PATH = 'data/third/gemini-ai'
const SystemInstructionPath = PATH + '/system_instruction.md'
const FunctionCallPath = PATH + '/mcp_function_call.json'

const askHistory = []
const chatHistory = []

/**
 * 在此开发更多的MCP协议工具，需和FunctionCallPath中定义的保持一致
 */
const McpFunctionMap = {
  listProfile: () => {
    const profilesStore = Plugins.useProfilesStore()
    // 只返回给AI些许字段
    return profilesStore.profiles.map((v) => ({ name: v.name, id: v.id }))
  },
  updateAllSubscription: async () => {
    const subscribeStore = Plugins.useSubscribesStore()
    return await subscribeStore.updateSubscribes()
  },
  updateSubscription: async ({ keywords }) => {
    const subscribeStore = Plugins.useSubscribesStore()
    const subs = subscribeStore.subscribes.filter((v) => keywords.some((name) => v.name.includes(name))).map((v) => ({ name: v.name, id: v.id }))
    return await Plugins.asyncPool(5, subs, async ({ id, name }) => {
      const result = []
      try {
        await subscribeStore.updateSubscribe(id)
        result.push({ name, result: '更新成功' })
      } catch (error) {
        result.push({ name, result: '更新失败，因为：' + (error.message || error) })
      }
      return result
    })
  },
  updateAllRulesets: async () => {
    const rulesetStore = Plugins.useRulesetsStore()
    return rulesetStore.updateRulesets()
  },
  listRuleset: async ({ keywords }) => {
    const rulesetsStore = Plugins.useRulesetsStore()
    let rulesets = rulesetsStore.rulesets
    if (keywords) {
      rulesets = rulesets.filter((v) => keywords.some((keyword) => (v.tag || v.name).includes(keyword)))
    }
    return rulesets
  },
  listRulesetHub: async ({ keywords }) => {
    // TODO: 等待客户端把规则集中心改到store里
    const { list } = JSON.parse(await Plugins.Readfile('data/.cache/ruleset-list.json').catch(() => '{"list": []}'))
    const filtered = list.filter((v) => keywords.some((keyword) => v.name.includes(keyword)))
    if (filtered.length === 0) {
      return '没有找到符合条件的规则集'
    }
    return (
      `查询结果如下，格式为：名称,类型,数量，其中类型0是geosite,1是geoip，请使用markdown表格来展示：` +
      filtered.map((v) => `${v.name},${v.type === 'geosite' ? 0 : 1},${v.count}`).join('\n')
    )
  },
  exitApp: () => {
    Plugins.exitApp()
  }
}

const onRun = async () => {
  await initAi()
  const systemInstruction = (await Plugins.Readfile(SystemInstructionPath)).replace('${APP_TITLE}', Plugins.APP_TITLE)
  const functionDeclarations = JSON.parse(await Plugins.Readfile(FunctionCallPath))
  while (await Ask(systemInstruction, functionDeclarations)) {}
}

/**
 * 菜单项 - 开始提问
 */
const Ask = async (systemInstruction, functionDeclarations) => {
  const input = await Plugins.prompt(Plugin.name, '', { placeholder: '有什么能够帮你的？' })
  askHistory.push({ role: 'user', parts: [{ text: input }] })

  const requestBody = {
    system_instruction: {
      parts: {
        text: systemInstruction
      }
    },
    tools: [
      {
        functionDeclarations
      }
    ],
    contents: askHistory
  }

  const parts = await generateContent(requestBody)
  askHistory.push({ role: 'model', parts })
  let responseText = ''
  const awaitAIsummary = async () => {
    const parts = await generateContent(requestBody)
    askHistory.push({ role: 'model', parts })
    responseText += parts[0]?.text
  }
  for (const part of parts) {
    const { text, functionCall } = part
    if (text) {
      responseText += text + '\n'
      continue
    }
    if (functionCall) {
      const { name, args } = functionCall
      try {
        const res = await McpFunctionMap[name]?.(args)
        // 如果有返回值，发送给AI进行总结
        if (res) {
          askHistory.push({
            role: 'user',
            parts: [
              { text: `[Calling tool {${name}} with args {${JSON.stringify(args)}} successful! Please summarize the returned results: ${JSON.stringify(res)}]` }
            ]
          })
          await awaitAIsummary()
        } else {
          responseText += '已完成！'
        }
      } catch (error) {
        askHistory.push({
          role: 'user',
          parts: [{ text: `[Calling tool {${name}} with args {${JSON.stringify(args)}} failed! Please summarize the reasons: ${JSON.stringify(error)}]` }]
        })
        await awaitAIsummary()
      }
    }
  }
  await Plugins.confirm(Plugin.name, responseText, { type: 'markdown' })
  return true
}

/**
 * 菜单项 - 随意对话
 */
const Chat = async () => {
  await initAi()
  const input = await Plugins.prompt(Plugin.name, '', { placeholder: '有什么能够帮你的？' })
  chatHistory.push({ role: 'user', parts: [{ text: input }] })
  const requestBody = { contents: chatHistory }
  const parts = await generateContent(requestBody)
  chatHistory.push({ role: 'model', parts })
  await Plugins.confirm(Plugin.name, parts[0]?.text, { type: 'markdown' })
  return await Chat()
}

const initAi = async () => {
  if (!Plugin.API_KEY) {
    Plugins.alert(Plugin.name, '请通过下列网站注册API_KEY，并填入插件配置：\n\nhttps://aistudio.google.com/app/apikey')
    throw '需要API_KEY'
  }
  const versionFile = PATH + '/version.txt'
  const version = await Plugins.Readfile(versionFile).catch(() => '')
  // 如果插件升级了，则总是获取最新资源文件
  const shouldFetch = Plugin.version !== version
  if (shouldFetch) {
    await Promise.all([
      // 下载系统提示词
      Plugins.Download(
        'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-gemini-ai/system_instruction.md',
        SystemInstructionPath
      ),
      // 下载MCP协议工具
      Plugins.Download(
        'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-gemini-ai/mcp_function_call.json',
        FunctionCallPath
      )
    ])
    await Plugins.Writefile(versionFile, Plugin.version)
  }
}

const generateContent = async (requestBody) => {
  console.log(`[${Plugin.name}] generateContent req => `, requestBody)

  const { status, body } = await Plugins.HttpPost(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${Plugin.API_KEY}`,
    { 'Content-Type': 'application/json' },
    requestBody,
    {
      Timeout: 30
    }
  )

  console.log(`[${Plugin.name}] generateContent res => `, body)

  if (status !== 200) {
    const ErrorMap = {
      FAILED_PRECONDITION: '请更换支持Gemini服务的代理'
    }
    throw ErrorMap[body.error.status] || body.error.message
  }

  return body.candidates[0].content?.parts
}
