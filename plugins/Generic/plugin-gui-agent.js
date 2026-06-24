const PATH = 'data/third/gui-agent'

const envStore = Plugins.useEnvStore()

const system_prompt = `
# Role / 角色
你是 GUI.for.Cores 专属 Agent，擅长使用工具帮用户操作 GUI。

# Goal / 目标
像一个真正的人在GUI里工作：先观察当前状态，再计划，再执行工具，再观察结果，必要时重新规划，直到完成用户的任务，最后简洁汇报。

# Context / 背景
当前工作目录: ${envStore.env.basePath}
程序路径：${envStore.env.appPath}
程序版本：${envStore.env.appVersion}
平台：${envStore.env.os}/${envStore.env.arch}

# Workflow / 工作流程
请按以下步骤执行：
1. 理解用户意图
2. 判断是否需要更多信息
3. 如需工具，请先调用工具
4. 分析结果
5. 给出最终答案

# Constraints / 约束
- 不要编造信息
- 不确定时说明不确定
- 遵守安全边界
`.trim()

/** @type { EsmPlugin } */
export default (Plugin) => {
  const Model = Plugin.Model
  const BaseURL = Plugin.BaseUrl
  const Token = Plugin.ApiKey

  const onRun = async () => {
    /** @type ReturnType<typeof Plugins.modal> */
    let modal

    const component = {
      template: /* html */ `
    <div class="flex flex-col h-full pb-8">
      <div class="flex items-center">
        <Tag color="cyan">${Model}</Tag>
        <Button @click="onDeleteSession" icon="delete" size="small" class="ml-auto">清空会话</Button>
      </div>
      <div class="overflow-y-auto flex flex-col gap-8 flex-1 pb-8 pr-8">
        <Empty v-if="chatHistory.length == 0" icon="sparkle" description="开始新的会话" />
        <div v-for="(item, index) in chatHistory" :key="index" class="">
          <Card v-if="item.role == 'assistant' || item.role == 'user'">
            <div class="flex items-center text-14" :class="{'justify-end': item.role == 'user'}">
              <MarkdownViewer :content="item.content" />
              <Button v-if="item.role == 'user'" @click="onResend(index)" size="small">重新发送</Button>
            </div>
            <div v-for="tool in item.tool_calls || []" :title="tool.function.name" :key="tool.id">
              <div>
                工具调用: {{ tool.function.name }} {{ tool.function.arguments }}
              </div>
            </div>
          </Card>
        </div>
      </div>
      <div>
        <div v-if="requestOperation">
          <Card title="Agent想要执行一个危险命令，是否允许？">
            <div class="flex items-center justify-end">
              <Button @click="onUserOperate(false)">拒绝</Button>
              <Button @click="onUserOperate(true)" type="primary">允许一次</Button>
            </div>
          </Card>
        </div>
        <div v-else class="flex gap-8">
          <Input v-model="input" placeholder="请输入..." @keydown.enter="onSend" class="flex-1">
            <template #prefix>
              <Dropdown placement="top">
                <Tag :color="{none: 'green', normal: 'default', full: 'red'}[permission]">
                  {{ {none: '无权限', normal: '只读权限', full: '完整权限'}[permission] }}
                </Tag>
                <template #overlay="{ close }">
                  <div class="flex flex-col gap-4 min-w-64 p-4">
                    <Button :type="permission == 'none' ? 'link' : 'text'" @click="onChangePermission('none', close)">无权限</Button>
                    <Button :type="permission == 'normal' ? 'link' : 'text'" @click="onChangePermission('normal', close)">只读权限</Button>
                    <Button :type="permission == 'full' ? 'link' : 'text'" @click="onChangePermission('full', close)">完整权限</Button>
                  </div>
                </template>
              </Dropdown>
              <Button loading v-show="loading" size="small" type="text">Thinking......</Button>
            </template>
          </Input>
          <Button @click="onSend" type="primary" :disabled="!input">发送</Button>
          <Button @click="onClose">关闭</Button>
        </div>
      </div>
    </div>
    `,
      setup() {
        const { ref, computed, onMounted, onBeforeUnmount } = Vue

        const loading = ref(false)
        const input = ref('')
        /** @type { {value: 'none' | 'normal' | 'full'} } */
        const permission = ref('normal')

        /** @type { {value: Promise<boolean> | undefined} } */
        const requestOperation = ref()
        /** @type (v: boolean) => void */
        let userAuthorized

        /** @type { {value: {role: 'system' | 'user' | 'assistant' | 'tool', content: string, tool_calls?: any, tool_call_id?: string, name?: string}[]} } */
        const chatHistory = ref([])
        const toolResultMapping = computed(() =>
          chatHistory.value
            .filter((v) => v.role === 'tool')
            .reduce((p, c) => {
              if (c.tool_call_id) {
                p[c.tool_call_id] = c.content
              }
              return p
            }, {})
        )

        const loadSession = async () => {
          chatHistory.value = JSON.parse(await Plugins.ReadFile(PATH + '/session.json').catch(() => '[]'))
        }

        const saveSession = async () => {
          await Plugins.WriteFile(PATH + '/session.json', JSON.stringify(chatHistory.value))
        }

        onMounted(() => {
          loadSession()
        })

        onBeforeUnmount(() => {
          saveSession()
        })

        const onDeleteSession = () => {
          chatHistory.value = []
          saveSession()
        }

        const onClose = () => {
          modal.destroy()
        }

        const onUserOperate = (ok) => {
          userAuthorized?.(ok)
        }

        const onChangePermission = (s, close) => {
          permission.value = s
          close()
        }

        const askAI = async () => {
          loading.value = true
          const res = await Plugins.Requests({
            url: BaseURL,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${Token}`
            },
            body: {
              model: Model,
              messages: chatHistory.value,
              temperature: 0.2,
              tools
            }
          })
          loading.value = false
          return res
        }

        const handleTool = async (toolCall) => {
          const fnName = toolCall.function.name
          let result = ''
          try {
            const fnArgs = JSON.parse(toolCall.function.arguments || '{}')
            if (permission.value === 'none') {
              throw new Error('用户未给任何权限，执行失败')
            }
            if (permission.value === 'normal') {
              const allowList = ['ReadFile', 'ReadDir']
              if (!allowList.includes(fnName)) {
                throw new Error('只读权限下只能使用：' + allowList.join(''))
              }
            }

            const dangerousList = ['RemoveFile']
            if (dangerousList.includes(fnName)) {
              requestOperation.value = new Promise((r) => (userAuthorized = r))
              const ok = await requestOperation.value
              requestOperation.value = undefined
              if (!ok) throw new Error('危险命令，用户拒绝执行')
            }

            const handler = toolHandlers[fnName]
            if (!handler) {
              result = `Tool not found: ${fnName}`
            } else {
              result = await handler(fnArgs)
              result = result === undefined ? '' : typeof result === 'string' ? result : JSON.stringify(result)
            }
          } catch (error) {
            result = error.message || error
          }
          chatHistory.value.push({ role: 'tool', tool_call_id: toolCall.id, name: fnName, content: result })
        }

        const handleMessage = async (res) => {
          const message = res.body.choices[0].message

          if (!message.tool_calls || message.tool_calls.length === 0) {
            chatHistory.value.push({ role: 'assistant', content: message.content })
            return
          }

          chatHistory.value.push(message)

          for (const toolCall of message.tool_calls) {
            await handleTool(toolCall)
          }

          const toolSummary = await askAI()

          await handleMessage(toolSummary)
        }

        const onSend = async () => {
          if (chatHistory.value.length === 0) {
            chatHistory.value.push({ role: 'system', content: system_prompt })
          }
          chatHistory.value.push({ role: 'user', content: input.value })
          input.value = ''

          const res = await askAI()

          await handleMessage(res)
        }

        const onResend = (index) => {
          input.value = chatHistory.value[index].content
          chatHistory.value.splice(index)
          onSend()
        }

        return {
          input,
          loading,
          chatHistory,
          toolResultMapping,
          permission,
          requestOperation,
          onDeleteSession,
          onChangePermission,
          onUserOperate,
          onSend,
          onResend,
          onClose
        }
      }
    }

    modal = Plugins.modal(
      {
        title: Plugin.name,
        width: '90',
        height: '90',
        maskClosable: true,
        footer: false,
        afterClose() {
          modal.destroy()
        }
      },
      {
        default: () => Vue.h(component)
      }
    )

    modal.open()
  }

  return { onRun }
}

const appStoreTools = {
  checkForUpdates: (args) => Plugins.useAppStore().checkForUpdates(args.showTips),
  downloadApp: () => Plugins.useAppStore().downloadApp()
}

const envStoreTools = {
  setSystemProxy: () => Plugins.useEnvStore().setSystemProxy(),
  clearSystemProxy: () => Plugins.useEnvStore().clearSystemProxy()
}

const kernelApiStoreTools = {
  startCore: () => Plugins.useKernelApiStore().startCore(),
  stopCore: () => Plugins.useKernelApiStore().stopCore(),
  restartCore: () => Plugins.useKernelApiStore().restartCore()
}

const pluginsStoreTools = {
  addPlugin: (args) => Plugins.usePluginsStore().addPlugin(args.plugin),
  editPlugin: (args) => Plugins.usePluginsStore().editPlugin(args.id, args.newPlugin),
  deletePlugin: (args) => Plugins.usePluginsStore().deletePlugin(args.id),
  updatePlugin: (args) => Plugins.usePluginsStore().updatePlugin(args.id),
  updatePlugins: () => Plugins.usePluginsStore().updatePlugins(),
  updatePluginHub: () => Plugins.usePluginsStore().updatePluginHub()
}

const profilesStoreTools = {
  addProfile: (args) => Plugins.useProfilesStore().addProfile(args.profile),
  editProfile: (args) => Plugins.useProfilesStore().editProfile(args.id, args.profile),
  deleteProfile: (args) => Plugins.useProfilesStore().deleteProfile(args.id),
  getProfileTemplate: (args) => Plugins.useProfilesStore().getProfileTemplate(args.name)
}

const subscribesStoreTools = {
  addSubscribe: (args) => Plugins.useSubscribesStore().addSubscribe(args.subscription),
  editSubscribe: (args) => Plugins.useSubscribesStore().editSubscribe(args.id, args.subscription),
  deleteSubscribe: (args) => Plugins.useSubscribesStore().deleteSubscribe(args.id),
  updateSubscribe: (args) => Plugins.useSubscribesStore().updateSubscribe(args.id, args.options),
  updateSubscribes: () => Plugins.useSubscribesStore().updateSubscribes(),
  importSubscribe: (args) => Plugins.useSubscribesStore().importSubscribe(args.name, args.url),
  getSubscribeTemplate: (args) => Plugins.useSubscribesStore().getSubscribeTemplate(args.name, args.options)
}

const rulesetsStoreTools = {
  addRuleset: (args) => Plugins.useRulesetsStore().addRuleset(args.ruleset),
  editRuleset: (args) => Plugins.useRulesetsStore().editRuleset(args.id, args.ruleset),
  deleteRuleset: (args) => Plugins.useRulesetsStore().deleteRuleset(args.id),
  updateRuleset: (args) => Plugins.useRulesetsStore().updateRuleset(args.id),
  updateRulesets: () => Plugins.useRulesetsStore().updateRulesets(),
  updateRulesetHub: () => Plugins.useRulesetsStore().updateRulesetHub()
}

const scheduledTasksStoreTools = {
  addScheduledTask: (args) => Plugins.useScheduledTasksStore().addScheduledTask(args.scheduledTask),
  editScheduledTask: (args) => Plugins.useScheduledTasksStore().editScheduledTask(args.id, args.scheduledTask),
  deleteScheduledTask: (args) => Plugins.useScheduledTasksStore().deleteScheduledTask(args.id)
}

const bridgeTools = {
  Exec: (args) => Plugins.Exec(args.path, args.args, args.options),
  WriteFile: (args) => Plugins.WriteFile(args.path, args.content, args.options),
  ReadFile: (args) => Plugins.ReadFile(args.path, args.options),
  MoveFile: (args) => Plugins.MoveFile(args.source, args.target),
  RemoveFile: (args) => Plugins.RemoveFile(args.path),
  CopyFile: (args) => Plugins.CopyFile(args.source, args.target),
  FileExists: (args) => Plugins.FileExists(args.path),
  FileSHA256: (args) => Plugins.FileSHA256(args.path),
  AbsolutePath: (args) => Plugins.AbsolutePath(args.path),
  MakeDir: (args) => Plugins.MakeDir(args.path),
  ReadDir: (args) => Plugins.ReadDir(args.path),
  Requests: (args) => Plugins.Requests(args),
  Download: (args) => Plugins.Download(args.url, args.path, args.headers, undefined, args.options),
  HttpCancel: (args) => Plugins.HttpCancel(args.cancelId),
  TcpPing: (args) => Plugins.TcpPing(args.address, args.options),
  TcpRequest: (args) => Plugins.TcpRequest(args.address, args.payload, args.options),
  UdpRequest: (args) => Plugins.UdpRequest(args.address, args.payload, args.options)
}

const toolHandlers = {
  ...bridgeTools,
  ...appStoreTools,
  ...envStoreTools,
  ...kernelApiStoreTools,
  ...pluginsStoreTools,
  ...profilesStoreTools,
  ...subscribesStoreTools,
  ...rulesetsStoreTools,
  ...scheduledTasksStoreTools
}

// prettier-ignore
const tools = [{"type":"function","function":{"name":"Exec","description":"Execute a command and return its output.","parameters":{"type":"object","properties":{"path":{"type":"string","description":"Executable path."},"args":{"type":"array","items":{"type":"string"}},"options":{"type":"object","properties":{"PidFile":{"type":"string"},"LogFile":{"type":"string"},"Convert":{"type":"boolean"},"Env":{"type":"object","additionalProperties":true},"StopOutputKeyword":{"type":"string"},"WorkingDirectory":{"type":"string"},"convert":{"type":"boolean"},"env":{"type":"object","additionalProperties":true},"stopOutputKeyword":{"type":"string"}},"additionalProperties":false}},"required":["path","args"]}}},{"type":"function","function":{"name":"WriteFile","description":"Write text or binary content to a file.","parameters":{"type":"object","properties":{"path":{"type":"string"},"content":{"type":"string"},"options":{"type":"object","properties":{"Mode":{"type":"string","enum":["Binary","Text"],"default":"Text"},"Range":{"type":"string","default":""}},"additionalProperties":false}},"required":["path","content"]}}},{"type":"function","function":{"name":"ReadFile","description":"Read text or binary content from a file.","parameters":{"type":"object","properties":{"path":{"type":"string"},"options":{"type":"object","properties":{"Mode":{"type":"string","enum":["Binary","Text"],"default":"Text"},"Range":{"type":"string","default":""}},"additionalProperties":false}},"required":["path"]}}},{"type":"function","function":{"name":"MoveFile","description":"Move or rename a file or directory.","parameters":{"type":"object","properties":{"source":{"type":"string"},"target":{"type":"string"}},"required":["source","target"]}}},{"type":"function","function":{"name":"RemoveFile","description":"Remove a file or directory.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},{"type":"function","function":{"name":"CopyFile","description":"Copy a file or directory.","parameters":{"type":"object","properties":{"source":{"type":"string"},"target":{"type":"string"}},"required":["source","target"]}}},{"type":"function","function":{"name":"FileExists","description":"Check whether a file or directory exists.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},{"type":"function","function":{"name":"FileSHA256","description":"Calculate the SHA-256 hash of a file.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},{"type":"function","function":{"name":"AbsolutePath","description":"Resolve a path to an absolute path.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},{"type":"function","function":{"name":"MakeDir","description":"Create a directory.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},{"type":"function","function":{"name":"ReadDir","description":"Read directory entries.","parameters":{"type":"object","properties":{"path":{"type":"string"}},"required":["path"]}}},{"type":"function","function":{"name":"Requests","description":"Send an HTTP request.","parameters":{"type":"object","properties":{"method":{"type":"string"},"url":{"type":"string"},"headers":{"type":"object","additionalProperties":{"type":"string"}},"body":{"description":"Request body. JSON and form bodies are transformed based on Content-Type."},"options":{"type":"object","properties":{"Proxy":{"type":"string"},"Insecure":{"type":"boolean"},"Redirect":{"type":"boolean"},"Timeout":{"type":"number"},"CancelId":{"type":"string"},"FileField":{"type":"string"},"Sha256":{"type":"string"}},"additionalProperties":false},"autoTransformBody":{"type":"boolean","default":true}},"required":["url"]}}},{"type":"function","function":{"name":"Download","description":"Download a URL to a file path.","parameters":{"type":"object","properties":{"url":{"type":"string"},"path":{"type":"string"},"headers":{"type":"object","additionalProperties":{"type":"string"}},"options":{"type":"object","properties":{"Method":{"type":"string"},"Proxy":{"type":"string"},"Insecure":{"type":"boolean"},"Redirect":{"type":"boolean"},"Timeout":{"type":"number"},"CancelId":{"type":"string"},"FileField":{"type":"string"},"Sha256":{"type":"string"}},"additionalProperties":false}},"required":["url","path"]}}},{"type":"function","function":{"name":"HttpCancel","description":"Cancel an HTTP request by cancel id.","parameters":{"type":"object","properties":{"cancelId":{"type":"string"}},"required":["cancelId"]}}},{"type":"function","function":{"name":"TcpPing","description":"Measure TCP connectivity latency to an address.","parameters":{"type":"object","properties":{"address":{"type":"string"},"options":{"type":"object","properties":{"Mode":{"type":"string","enum":["Binary","Text"],"default":"Text"},"Timeout":{"type":"number","default":15}},"additionalProperties":false}},"required":["address"]}}},{"type":"function","function":{"name":"TcpRequest","description":"Send a TCP payload to an address and return the response.","parameters":{"type":"object","properties":{"address":{"type":"string"},"payload":{"type":"string"},"options":{"type":"object","properties":{"Mode":{"type":"string","enum":["Binary","Text"],"default":"Text"},"Timeout":{"type":"number","default":15}},"additionalProperties":false}},"required":["address","payload"]}}},{"type":"function","function":{"name":"UdpRequest","description":"Send a UDP payload to an address and return the response.","parameters":{"type":"object","properties":{"address":{"type":"string"},"payload":{"type":"string"},"options":{"type":"object","properties":{"Mode":{"type":"string","enum":["Binary","Text"],"default":"Text"},"Timeout":{"type":"number","default":15}},"additionalProperties":false}},"required":["address","payload"]}}},{"type":"function","function":{"name":"checkForUpdates","description":"Check for app updates.","parameters":{"type":"object","properties":{"showTips":{"type":"boolean","default":false}},"required":[]}}},{"type":"function","function":{"name":"downloadApp","description":"Download the app update.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"setSystemProxy","description":"Enable system proxy.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"clearSystemProxy","description":"Disable system proxy.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"startCore","description":"Start the core.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"stopCore","description":"Stop the core.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"restartCore","description":"Restart the core.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"addPlugin","description":"Add a plugin.","parameters":{"type":"object","properties":{"plugin":{"type":"object","description":"Plugin object.","additionalProperties":true}},"required":["plugin"]}}},{"type":"function","function":{"name":"editPlugin","description":"Edit a plugin.","parameters":{"type":"object","properties":{"id":{"type":"string"},"newPlugin":{"type":"object","description":"Updated plugin object.","additionalProperties":true}},"required":["id","newPlugin"]}}},{"type":"function","function":{"name":"deletePlugin","description":"Delete a plugin.","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}},{"type":"function","function":{"name":"updatePlugin","description":"Update a plugin.","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}},{"type":"function","function":{"name":"updatePlugins","description":"Update all plugins.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"updatePluginHub","description":"Update Plugin Hub.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"addProfile","description":"Add a profile.","parameters":{"type":"object","properties":{"profile":{"type":"object","description":"Profile object.","additionalProperties":true}},"required":["profile"]}}},{"type":"function","function":{"name":"editProfile","description":"Edit a profile.","parameters":{"type":"object","properties":{"id":{"type":"string"},"profile":{"type":"object","description":"Profile object.","additionalProperties":true}},"required":["id","profile"]}}},{"type":"function","function":{"name":"deleteProfile","description":"Delete a profile.","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}},{"type":"function","function":{"name":"getProfileTemplate","description":"Get a profile template.","parameters":{"type":"object","properties":{"name":{"type":"string","default":""}},"required":[]}}},{"type":"function","function":{"name":"addSubscribe","description":"Add a subscription.","parameters":{"type":"object","properties":{"subscription":{"type":"object","description":"Subscription object.","additionalProperties":true}},"required":["subscription"]}}},{"type":"function","function":{"name":"editSubscribe","description":"Edit a subscription.","parameters":{"type":"object","properties":{"id":{"type":"string"},"subscription":{"type":"object","description":"Subscription object.","additionalProperties":true}},"required":["id","subscription"]}}},{"type":"function","function":{"name":"deleteSubscribe","description":"Delete a subscription.","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}},{"type":"function","function":{"name":"updateSubscribe","description":"Update a subscription.","parameters":{"type":"object","properties":{"id":{"type":"string"},"options":{"type":"object","description":"Partial subscription options overriding the stored subscription during update.","additionalProperties":true}},"required":["id"]}}},{"type":"function","function":{"name":"updateSubscribes","description":"Update all subscriptions.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"importSubscribe","description":"Import a subscription.","parameters":{"type":"object","properties":{"name":{"type":"string"},"url":{"type":"string"}},"required":["name","url"]}}},{"type":"function","function":{"name":"getSubscribeTemplate","description":"Get a subscription template.","parameters":{"type":"object","properties":{"name":{"type":"string","default":""},"options":{"type":"object","properties":{"url":{"type":"string"}},"additionalProperties":false}},"required":[]}}},{"type":"function","function":{"name":"addRuleset","description":"Add a ruleset.","parameters":{"type":"object","properties":{"ruleset":{"type":"object","description":"Rule-set object.","additionalProperties":true}},"required":["ruleset"]}}},{"type":"function","function":{"name":"editRuleset","description":"Edit a ruleset.","parameters":{"type":"object","properties":{"id":{"type":"string"},"ruleset":{"type":"object","description":"Rule-set object.","additionalProperties":true}},"required":["id","ruleset"]}}},{"type":"function","function":{"name":"deleteRuleset","description":"Delete a ruleset.","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}},{"type":"function","function":{"name":"updateRuleset","description":"Update a ruleset.","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}},{"type":"function","function":{"name":"updateRulesets","description":"Update all rulesets.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"updateRulesetHub","description":"Update Ruleset Hub.","parameters":{"type":"object","properties":{},"required":[]}}},{"type":"function","function":{"name":"addScheduledTask","description":"Add a scheduled task.","parameters":{"type":"object","properties":{"scheduledTask":{"type":"object","description":"Scheduled task object.","additionalProperties":true}},"required":["scheduledTask"]}}},{"type":"function","function":{"name":"editScheduledTask","description":"Edit a scheduled task.","parameters":{"type":"object","properties":{"id":{"type":"string"},"scheduledTask":{"type":"object","description":"Scheduled task object.","additionalProperties":true}},"required":["id","scheduledTask"]}}},{"type":"function","function":{"name":"deleteScheduledTask","description":"Delete a scheduled task.","parameters":{"type":"object","properties":{"id":{"type":"string"}},"required":["id"]}}}]
