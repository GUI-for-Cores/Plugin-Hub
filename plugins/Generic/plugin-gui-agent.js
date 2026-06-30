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
  const onRun = async () => {
    /** @type ReturnType<typeof Plugins.modal> */
    let modal

    const component = {
      template: /* html */ `
    <div class="flex flex-col h-full pb-8">
      <div ref="chatBox" class="overflow-y-auto select-text flex flex-col gap-8 flex-1 pb-8 pr-8">
        <div v-if="chatHistory.length < 2" class="h-full flex flex-col items-center justify-center">
          <svg width="128" height="128" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" role="img">
            <defs>
              <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#e2e8f0" />
                <stop offset="55%" stop-color="#94a3b8" />
                <stop offset="100%" stop-color="#cbd5e1" />
              </linearGradient>

              <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#020617" />
                <stop offset="100%" stop-color="#111827" />
              </linearGradient>

              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="shadow" x="-25%" y="-25%" width="150%" height="150%">
                <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.35" />
              </filter>
            </defs>

            <!-- 天线 -->
            <line x1="232" y1="92" x2="232" y2="142" stroke="#cbd5e1" stroke-width="10" stroke-linecap="round" />
            <circle cx="232" cy="78" r="18" fill="#38bdf8" filter="url(#glow)">
              <animate attributeName="opacity" values="1;0.55;1" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="232" cy="78" r="7" fill="#ecfeff" />

            <!-- 耳朵 -->
            <rect x="92" y="220" width="42" height="90" rx="18" fill="#475569" />
            <rect x="378" y="220" width="42" height="90" rx="18" fill="#475569" />
            <rect x="102" y="236" width="7" height="58" rx="3.5" fill="#38bdf8" filter="url(#glow)" />
            <rect x="403" y="236" width="7" height="58" rx="3.5" fill="#38bdf8" filter="url(#glow)" />

            <!-- 头部 -->
            <g filter="url(#shadow)">
              <rect x="128" y="140" width="256" height="252" rx="58" fill="url(#metal)" />
              <rect x="152" y="174" width="208" height="172" rx="38" fill="url(#screen)" stroke="#38bdf8"
                stroke-opacity="0.45" stroke-width="2" />
            </g>

            <!-- 顶部和底部灯条 -->
            <g filter="url(#glow)">
              <rect x="232" y="158" width="48" height="6" rx="3" fill="#38bdf8" />
              <rect x="232" y="360" width="48" height="6" rx="3" fill="#38bdf8" />
            </g>

            <!-- 左眼：科技镜头 -->
            <g transform="translate(202 244)">
              <circle r="30" fill="#071226" stroke="#38bdf8" stroke-width="3" />
              <circle r="18" fill="none" stroke="#67e8f9" stroke-width="4" filter="url(#glow)" />
              <circle r="8" fill="#67e8f9" filter="url(#glow)" />
              <circle cx="3" cy="-3" r="3" fill="#ecfeff" />
            </g>

            <!-- 右眼：平滑眨眼，从睁开压缩到闭眼 -->
            <g transform="translate(310 244)">
              <g>
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  values="1 1; 1 1; 1 0.12; 1 1; 1 1"
                  keyTimes="0; 0.68; 0.76; 0.86; 1"
                  dur="3s"
                  repeatCount="indefinite" />

                <circle r="24" fill="#071226" stroke="#38bdf8" stroke-width="3" />
                <circle r="13" fill="none" stroke="#67e8f9" stroke-width="4" filter="url(#glow)" />
                <circle r="6" fill="#67e8f9" filter="url(#glow)" />
                <circle cx="3" cy="-3" r="2.5" fill="#ecfeff" />
              </g>
            </g>

            <!-- 嘴巴：简洁 LED 微笑 -->
            <path d="M214 320 Q256 348 298 320"
              fill="none"
              stroke="#67e8f9"
              stroke-width="8"
              stroke-linecap="round"
              filter="url(#glow)" />

            <!-- 脖子 -->
            <rect x="226" y="392" width="60" height="40" rx="14" fill="#475569" />
            <rect x="176" y="422" width="160" height="34" rx="17" fill="#64748b" />

            <!-- 胸口灯 -->
            <circle cx="256" cy="438" r="8" fill="#67e8f9" filter="url(#glow)">
              <animate attributeName="opacity" values="1;0.55;1" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
          <div class="text-14">开始新会话</div>
        </div>
        <div v-for="(item, index) in chatHistory" :key="index" class="text-14 break-all">
          <div v-if="item.role == 'user'" class="flex items-center justify-end">
            <div class="ml-24 rounded-8 p-8" style="background: var(--card-bg)">{{ item.content }}</div>
            <Dropdown placement="bottom">
              <Button icon="more" type="text" />
              <template #overlay="{ close }">
                <div class="flex flex-col gap-4 min-w-64 p-4">
                  <Button @click="onResend(index, close)" icon="refresh" type="text" size="small">重新生成</Button>
                  <Button @click="onDelete(index, close)" icon="delete" type="text" size="small">删除</Button>
                </div>
              </template>
            </Dropdown>
          </div>
          <div v-else-if="item.role == 'assistant' && item.content" class="flex items-center mr-24">
            <MarkdownViewer :content="item.content" class="flex-1" />
            <Dropdown placement="bottom">
              <Button icon="more" type="text" />
              <template #overlay="{ close }">
                <div class="flex flex-col gap-4 min-w-64 p-4">
                  <Button @click="onDelete(index, close)" icon="delete" type="text" size="small">删除</Button>
                </div>
              </template>
            </Dropdown>
          </div>
          <div v-for="tool in item.tool_calls || []" :title="tool.function.name" :key="tool.id">
            <details class="text-12 mr-24" style="color: var(--card-color)">
              <summary class="flex items-center">
                <div class="inline-flex items-center gap-8">
                  <Icon icon="sparkle" color="currentColor" />
                  <div class="line-clamp-1">工具调用: {{ tool.function.name }} {{ tool.function.arguments }}</div>
                  <Dropdown placement="bottom">
                    <Button icon="more" type="text" />
                    <template #overlay="{ close }">
                      <div class="flex flex-col gap-4 min-w-64 p-4">
                        <Button @click="onDelete(index, close)" icon="delete" type="text" size="small">删除</Button>
                      </div>
                    </template>
                  </Dropdown>
                </div>
              </summary>
              <Card class="mt-8">
                <Empty v-if="!toolResultMapping[tool.id]" description="工具未返回任何数据" />
                {{ toolResultMapping[tool.id] }}
              </Card>
            </details>
          </div>
        </div>
        <div v-if="loading" class="flex items-center gap-8"  style="color: var(--card-color)"><Icon icon="sparkle" /> Thinking... </div>
      </div>
      <div v-if="requestOperation">
        <Card title="Agent想要执行一个危险命令，是否允许？">
          <div class="flex items-center justify-end">
            <Button @click="onUserOperate(false)">拒绝</Button>
            <Button @click="onUserOperate(true)" type="primary">允许一次</Button>
          </div>
        </Card>
      </div>
      <div v-else class="flex flex-col gap-8 p-8 rounded-16" :style="permission.inputStyle">
        <textarea
          ref="textareaRef"
          v-model="input"
          placeholder="请输入..."
          @keydown.shift.tab.prevent="onChangePermission()"
          @keydown.enter.exact.prevent="onSend"
          @keydown.ctrl.enter.prevent="onInsertNewline"
          @keydown.shift.enter.prevent="onInsertNewline"
          @keydown.meta.enter.prevent="onInsertNewline"
          @input="onAutoResize"
          class="border-0 p-0 outline-none bg-transparent"
          style="resize: none; font-family: inherit; max-height: 200px; color: var(--color)"
        />
        <div class="flex items-center">
          <Dropdown placement="top">
            <Tag :color="permission.tagColor">
              {{ permission.text }}
            </Tag>
            <template #overlay="{ close }">
              <div class="flex flex-col gap-4 min-w-64 p-4">
                <Button :type="settings.permission == 'none' ? 'link' : 'text'" @click="onChangePermission('none', close)">
                  无权限<span class="text-10">（无任何权限，仅聊天）</span>
                </Button>
                <Button :type="settings.permission == 'normal' ? 'link' : 'text'" @click="onChangePermission('normal', close)">
                  只读权限<span class="text-10">（只可读取文件、目录）</span>
                </Button>
                <Button :type="settings.permission == 'full' ? 'link' : 'text'" @click="onChangePermission('full', close)">
                  完整权限<span class="text-10">（任意命令执行）</span>
                </Button>
              </div>
            </template>
          </Dropdown>
          <div class="text-10">Shift+Tab切换权限、Ctrl+Enter换行</div>
          <Button @click="onSend" type="primary" size="small" class="ml-auto">发送</Button>
        </div>
      </div>
    </div>
    `,
      setup(_, { expose }) {
        const { ref, reactive, h, computed, onMounted, onBeforeUnmount, nextTick } = Vue

        const chatBox = ref()
        const textareaRef = ref()
        const loading = ref(false)
        const input = ref('')
        /** @type { {value: { permission: 'none' | 'normal' | 'full' }} } */
        const settings = ref({ permission: 'normal' })

        const permission = computed(
          () =>
            ({
              none: {
                text: '无权限',
                tagColor: 'green',
                inputStyle: { border: '1px solid #389e0d' }
              },
              normal: {
                text: '只读权限',
                tagColor: 'default',
                inputStyle: { border: '1px solid #898989' }
              },
              full: {
                text: '完整权限',
                tagColor: 'red',
                inputStyle: { border: '1px solid #d52e3b' }
              }
            })[settings.value.permission]
        )

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
          Utils.focus(textareaRef.value)
          setTimeout(() => {
            Utils.scrollToBottom(chatBox.value)
          }, 200)
        })

        onBeforeUnmount(() => {
          saveSession()
        })

        const onDeleteSession = () => {
          chatHistory.value = []
        }

        const onClose = () => {
          modal.destroy()
        }

        const onUserOperate = (ok) => {
          userAuthorized?.(ok)
        }

        const onChangePermission = (s, close) => {
          if (s) {
            settings.value.permission = s
          } else {
            /** @type typeof settings.value.permission[] */
            const l = ['none', 'normal', 'full']
            const idx = (l.indexOf(settings.value.permission) + 1) % l.length
            settings.value.permission = l[idx]
          }
          close?.()
        }

        const askAI = async () => {
          loading.value = true
          /** @type {{ role: string, content: string, tool_calls?: any[] }} */
          const streamMessage = reactive({ role: 'assistant', content: '' })
          let pendingContent = ''
          const flushStreamContent = async () => {
            if (!pendingContent) return
            const shouldScrollToBottom = Utils.isNearBottom(chatBox.value)
            streamMessage.content += pendingContent
            pendingContent = ''
            await nextTick()
            if (shouldScrollToBottom) {
              Utils.scrollToBottom(chatBox.value, 'auto')
            }
          }
          const throttledFlushStreamContent = Plugins.throttle(flushStreamContent, 50)
          const appendStreamContent = (chunk) => {
            pendingContent += chunk
            throttledFlushStreamContent()
          }

          try {
            const res = await Plugins.Requests({
              url: Plugin.BaseUrl,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Plugin.ApiKey}`
              },
              body: {
                model: Plugin.Model,
                messages: chatHistory.value,
                temperature: 0.2,
                tools,
                stream: true
              },
              options: {
                Timeout: 60 * 20
              },
              async onStream(e) {
                console.log(e)

                if (e.type === 'response') {
                  appendMessage(streamMessage)
                  return
                }

                if (e.type === 'message' && e.event === 'message' && e.data !== '[DONE]') {
                  const body = JSON.parse(e.data || '')
                  const choice = body.choices?.[0]
                  if (!choice?.delta) return
                  const message = choice.delta

                  if (message.content) {
                    appendStreamContent(message.content)
                  }

                  mergeAssistantMessage(streamMessage, message)
                }
              }
            })
            await flushStreamContent()
            if (res.status !== 200) {
              Plugins.alert('错误', JSON.stringify(res.body, null, 2))
              return res
            }

            const finalToolCalls = streamMessage.tool_calls?.filter(Boolean) || []
            if (finalToolCalls.length) {
              streamMessage.tool_calls = finalToolCalls

              for (const toolCall of finalToolCalls) {
                await handleTool(toolCall)
              }

              return await askAI()
            }

            return res
          } finally {
            await flushStreamContent()
            loading.value = false
          }
        }

        const appendMessage = (msg) => {
          chatHistory.value.push(msg)
          if (Utils.isNearBottom(chatBox.value)) {
            Utils.scrollToBottom(chatBox.value)
          }
        }

        const mergeAssistantMessage = (target, delta) => {
          for (const [key, value] of Object.entries(delta)) {
            if (value === undefined || key === 'content' || key === 'tool_calls') continue
            target[key] = value
          }

          for (const chunk of delta.tool_calls || []) {
            const index = chunk.index ?? target.tool_calls?.length ?? 0
            target.tool_calls ||= []

            const toolCall = target.tool_calls[index] || (target.tool_calls[index] = {})
            const fn = toolCall.function || {}

            Object.assign(toolCall, chunk)

            if (chunk.function) {
              toolCall.function = {
                ...fn,
                ...chunk.function,
                name: (fn.name || '') + (chunk.function.name || ''),
                arguments: (fn.arguments || '') + (chunk.function.arguments || '')
              }
            }

            toolCall.type ||= 'function'
            toolCall.function ||= { name: '', arguments: '' }
          }
        }

        const handleTool = async (toolCall) => {
          const fnName = toolCall.function.name
          let result = ''
          try {
            const fnArgs = JSON.parse(toolCall.function.arguments || '{}')
            if (settings.value.permission === 'none') {
              throw new Error('用户未给任何权限，执行失败')
            }
            if (settings.value.permission === 'normal') {
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
          appendMessage({ role: 'tool', tool_call_id: toolCall.id, name: fnName, content: result })
        }

        const onInsertNewline = () => {
          Utils.insertNewline(textareaRef.value, input, nextTick)
        }

        const onAutoResize = () => {
          Utils.autoResize(textareaRef.value)
        }

        const onSend = async () => {
          if (input.value.trim().length == 0) {
            return
          }
          if (chatHistory.value.length === 0) {
            appendMessage({ role: 'system', content: system_prompt })
          }
          appendMessage({ role: 'user', content: input.value })
          input.value = ''
          Utils.focus(textareaRef.value)
          Utils.autoResize(textareaRef.value)
          Utils.scrollToBottom(chatBox.value)

          await askAI()
        }

        const onResend = (index, close) => {
          input.value = chatHistory.value[index].content
          chatHistory.value.splice(index)
          onSend()
          close()
        }

        const onDelete = (index, close) => {
          chatHistory.value.splice(index, 1)
          close()
        }

        expose({
          modalSlots: {
            title: () => [
              h({
                template: `
                <div class="flex items-center">
                  <div class="font-bold">${Plugin.name}</div>
                  <Tag color="purple">${Plugin.Model.toUpperCase()}</Tag>
                </div>
                `,
                setup() {
                  return { onDeleteSession }
                }
              })
            ],
            toolbar: () => [
              Vue.h(Vue.resolveComponent('Button'), { type: 'text', icon: 'add', onClick: () => onDeleteSession() }, () => '新会话'),
              Vue.h(Vue.resolveComponent('Button'), { type: 'text', icon: 'close', onClick: () => modal.close() })
            ]
          }
        })

        return {
          chatBox,
          textareaRef,
          input,
          loading,
          chatHistory,
          toolResultMapping,
          settings,
          permission,
          requestOperation,
          onDeleteSession,
          onChangePermission,
          onUserOperate,
          onInsertNewline,
          onAutoResize,
          onSend,
          onDelete,
          onResend,
          onClose
        }
      }
    }

    modal = Plugins.modal({
      title: Plugin.name,
      width: '90',
      height: '90',
      maskClosable: true,
      footer: false,
      afterClose() {
        modal.destroy()
      }
    })
    modal.setContent(component)
    modal.open()
  }

  return { onRun }
}

const Utils = {
  isNearBottom(container, threshold = 60) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  },
  scrollToBottom(container, behavior = 'smooth') {
    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior
      })
    })
  },
  focus(el) {
    el.focus()
  },
  async insertNewline(el, targetRef, nextTick) {
    const start = el.selectionStart
    const end = el.selectionEnd
    targetRef.value = targetRef.value.slice(0, start) + '\n' + targetRef.value.slice(end)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 1
    })
    await nextTick()
    Utils.autoResize(el)
  },
  autoResize(el) {
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
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
