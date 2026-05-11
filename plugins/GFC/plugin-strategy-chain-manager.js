const PATH = 'data/third/strategy-chain-manager'

/* 触发器 生成配置时 */
const onGenerate = async (config, profile) => {
  const context = await buildClashChainContext(config, profile)
  const filePath = `${PATH}/${profile.id}.json`
  const chainConfig = normalizeChainConfig(
    await Plugins.ReadFile(filePath)
      .then((res) => JSON.parse(res))
      .catch(() => ({})),
    context
  )
  const conflict = findAnySourceConflict(chainConfig.rules, context, { includeDisabled: false })
  if (conflict) {
    const message = renderSourceConflictMessage(conflict)
    if (Plugins.alert) await Plugins.alert('链式代理配置冲突', message)
    throw message
  }

  const dialerByName = buildDialerMap(chainConfig.rules, context)
  if (dialerByName.size === 0) return config

  const proxiesMap = new Map()
  ;[...(config.proxies || []), ...context.providerProxies].forEach((proxy) => {
    if (!proxy?.name) return
    const dialerProxyName = dialerByName.get(proxy.name)
    if (dialerProxyName && dialerProxyName !== proxy.name) {
      proxy['dialer-proxy'] = dialerProxyName
    }
    proxiesMap.set(proxy.name, proxy)
  })

  config.proxies = [...proxiesMap.values()]
  inlineResolvedProviderGroups(config, context)

  return config
}

/* 触发器 手动触发 */
const onRun = async () => {
  const profilesStore = Plugins.useProfilesStore()
  if (profilesStore.profiles.length === 0) throw '请先创建一个配置'

  const profile =
    profilesStore.profiles.length === 1
      ? profilesStore.profiles[0]
      : await Plugins.picker.single(
          '请选择一个配置',
          profilesStore.profiles.map((v) => ({
            label: v.name,
            value: v
          })),
          [profilesStore.profiles[0]]
        )

  if (!profile) return
  await showUI(profile)
}

const showUI = async (profile) => {
  const { h, ref, computed, watch, nextTick } = Vue
  const config = await Plugins.generateConfig(profile)
  const context = await buildClashChainContext(config, profile)
  const filePath = `${PATH}/${profile.id}.json`
  const chainConfig = normalizeChainConfig(
    await Plugins.ReadFile(filePath)
      .then((res) => JSON.parse(res))
      .catch(() => ({})),
    context
  )

  const proxyOptions = toOptions([...context.proxyByName.keys()])
  const groupOptions = toOptions([...context.groupByName.keys()])
  const initialRules = chainConfig.rules.map((rule) => normalizeRule(rule, proxyOptions, groupOptions, context))
  const rules = ref(initialRules.map(cloneRule))
  const previewKeyword = ref('')
  const primaryButtonStyle =
    'height: 28px; padding: 0 12px; border: 1px solid var(--primary-color, #1677ff); border-radius: 4px; background: var(--primary-color, #1677ff); color: #ffffff; font-weight: 600; cursor: pointer;'
  const secondaryButtonStyle =
    'height: 26px; padding: 0 10px; border: 1px solid #94a3b8; border-radius: 4px; background: #f8fafc; color: #334155; cursor: pointer;'
  const dangerButtonStyle =
    'height: 26px; padding: 0 10px; border: 1px solid #dc2626; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: 600; cursor: pointer;'
  const entityButtonStyle =
    'width: 100%; min-height: 30px; padding: 0 10px; border: 1px solid #94a3b8; border-radius: 4px; background: #f8fafc; color: #334155; cursor: pointer; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
  const optionButtonStyle =
    'width: 100%; min-height: 30px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: #eef2f7; color: #334155; cursor: pointer; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
  const disabledOptionButtonStyle =
    'width: 100%; min-height: 30px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: #e2e8f0; color: #64748b; cursor: not-allowed; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
  const searchInputStyle =
    'width: 220px; max-width: 100%; height: 28px; padding: 0 10px; border: 1px solid #94a3b8; border-radius: 4px; background: #f8fafc; color: #0f172a; outline: none;'
  const previewProxyNodeStyle =
    'flex: 0 1 auto; min-width: 44px; max-width: min(520px, 45vw); padding: 4px 8px; border: 1px solid #64748b; border-radius: 4px; background: #f8fafc; color: #0f172a; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'
  const previewGroupNodeStyle =
    'flex: 0 1 auto; min-width: 44px; max-width: min(520px, 45vw); padding: 4px 8px; border: 1px solid #b45309; border-radius: 4px; background: #fef3c7; color: #78350f; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;'

  const component = {
    template: `
    <div class="flex flex-col gap-8 pb-8 pr-8" style="width: min(820px, 100%); margin: 0 auto;">
      <div class="grid items-center gap-8" style="grid-template-columns: minmax(0, 1fr) auto;">
        <div class="font-bold text-16">链式配置</div>
        <button type="button" class="text-12" :style="primaryButtonStyle" @click="openRuleEditor()">+ 添加配置</button>
      </div>

      <Card>
        <div v-if="rules.length === 0" class="flex items-center justify-center min-h-[120px] border border-dashed rounded-4">
          <div class="text-12" style="color: #334155;">暂无链式配置</div>
        </div>
        <div v-else class="flex flex-col gap-8">
          <div
            v-for="(rule, index) in rules"
            :key="rule.id"
            class="flex flex-col gap-8 rounded-4 p-8"
            :style="getRuleCardStyle(rule)"
          >
            <div class="grid items-center gap-8" style="grid-template-columns: minmax(0, 1fr) auto;">
              <div class="min-w-0">
                <div class="font-bold text-13" style="color: #0f172a;">链式配置 {{ index + 1 }}</div>
                <div class="text-12 break-all" style="color: #1e293b;">{{ renderRuleSummary(rule) }}</div>
                <div class="text-12" style="color: #334155;">{{ renderRuleMatchSummary(rule) }}</div>
                <div v-for="message in getRuleStatusDetails(rule)" :key="message" class="text-12 break-all" style="color: #92400e;">提示：{{ message }}</div>
              </div>
              <div class="flex items-center gap-8">
                <Switch v-model="rule.enabled">启用</Switch>
                <button type="button" class="text-12" :style="secondaryButtonStyle" @click="openRuleEditor(index)">编辑</button>
                <button type="button" class="text-12" :style="dangerButtonStyle" @click="removeRule(index)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div class="grid items-center gap-8" style="grid-template-columns: minmax(0, 1fr) auto;">
        <div class="font-bold text-16">生效预览（{{ previewItems.length }} / {{ allPreviewItems.length }} 条）</div>
        <input v-model="previewKeyword" class="text-12" :style="searchInputStyle" placeholder="搜索链路、节点或规则" />
      </div>
      <Card>
        <div v-if="allPreviewItems.length === 0" class="flex items-center justify-center min-h-[120px] border border-dashed rounded-4">
          <div class="text-12" style="color: #334155;">暂无生效链路</div>
        </div>
        <div v-else-if="previewItems.length === 0" class="flex items-center justify-center min-h-[120px] border border-dashed rounded-4">
          <div class="text-12" style="color: #334155;">无匹配链路</div>
        </div>
        <div v-else class="flex flex-col gap-8" style="max-height: 320px; overflow: auto;">
          <div
            v-for="item in previewItems"
            :key="item.source"
            class="strategy-chain-preview-row flex flex-col gap-6 rounded-4 p-8"
            style="min-height: 58px; border: 1px solid #94a3b8; background: #e8eef6;"
            @mouseenter="showPreviewTooltip(item, $event)"
            @mousemove="movePreviewTooltip($event)"
            @mouseleave="hidePreviewTooltip"
          >
            <div class="flex items-center gap-6">
              <div class="flex flex-col items-center justify-center shrink-0 text-12" style="width: 48px; color: #1e293b;">
                <div class="flex items-center justify-center" style="width: 28px; height: 28px; border-radius: 999px; border: 1px solid #2563eb; background: #dbeafe; color: #1d4ed8; font-size: 17px; line-height: 17px; font-weight: 700;">⌂</div>
                <div style="margin-top: 2px; font-weight: 600;">本机</div>
              </div>
              <div class="flex items-center min-w-0 flex-1" style="padding: 2px 0;">
                <template v-for="(part, index) in item.parts" :key="part.name + '-' + index">
                  <div style="flex: 1 1 40px; min-width: 28px; height: 16px;">
                    <svg width="100%" height="16" viewBox="0 0 64 16" preserveAspectRatio="none" aria-hidden="true">
                      <line x1="0" y1="8" x2="58" y2="8" stroke="#2563eb" stroke-width="2" stroke-dasharray="5 4" />
                      <polygon points="58,4 64,8 58,12" fill="#2563eb" />
                      <circle cy="8" r="3" fill="#1d4ed8">
                        <animate attributeName="cx" from="3" to="56" dur="1.25s" repeatCount="indefinite" :begin="(index * 0.16) + 's'" />
                        <animate attributeName="opacity" values="0;1;1;0" dur="1.25s" repeatCount="indefinite" :begin="(index * 0.16) + 's'" />
                      </circle>
                    </svg>
                  </div>
                  <div class="text-12" :title="part.name" :style="part.type === 'group' ? previewGroupNodeStyle : previewProxyNodeStyle">
                    <span v-if="part.type === 'group'" style="display: inline-block; margin-right: 4px; padding: 0 4px; border-radius: 3px; background: #92400e; color: #ffffff; font-size: 10px; line-height: 14px;">组</span>
                    {{ part.name }}
                  </div>
                </template>
                <div style="flex: 1 1 40px; min-width: 28px; height: 16px;">
                  <svg width="100%" height="16" viewBox="0 0 64 16" preserveAspectRatio="none" aria-hidden="true">
                    <line x1="0" y1="8" x2="58" y2="8" stroke="#2563eb" stroke-width="2" stroke-dasharray="5 4" />
                    <polygon points="58,4 64,8 58,12" fill="#2563eb" />
                    <circle cy="8" r="3" fill="#1d4ed8">
                      <animate attributeName="cx" from="3" to="56" dur="1.25s" repeatCount="indefinite" :begin="(item.parts.length * 0.16) + 's'" />
                      <animate attributeName="opacity" values="0;1;1;0" dur="1.25s" repeatCount="indefinite" :begin="(item.parts.length * 0.16) + 's'" />
                    </circle>
                  </svg>
                </div>
              </div>
              <div class="flex flex-col items-center justify-center shrink-0 text-12" style="width: 56px; color: #1e293b;">
                <div class="flex items-center justify-center" style="width: 28px; height: 28px; border-radius: 999px; border: 1px solid #059669; background: #d1fae5; color: #047857; font-size: 17px; line-height: 17px; font-weight: 700;">◎</div>
                <div style="margin-top: 2px; font-weight: 600;">互联网</div>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <div v-if="hoveredPreviewItem" ref="previewTooltipRef" class="text-12" :style="previewTooltipStyle">
        <div class="break-all"><span style="font-weight: 700;">完整链路：</span>{{ hoveredPreviewItem.chainText }}</div>
        <div class="flex flex-col gap-4" style="margin-top: 6px;">
          <div style="font-weight: 700;">命中规则：</div>
          <div v-for="rule in hoveredPreviewItem.matchedRules" :key="rule.id" class="break-all" style="padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; color: #1e293b;">
            {{ rule.label }}：{{ rule.summary }}
          </div>
          <div v-if="hoveredPreviewItem.matchedRules.length === 0" style="color: #475569;">未匹配到规则</div>
        </div>
      </div>
    </div>
    `,
    setup() {
      const allPreviewItems = computed(() => buildPreviewItems(rules.value, context))
      const previewItems = computed(() => filterPreviewItems(allPreviewItems.value, previewKeyword.value))
      const hoveredPreviewItem = ref(null)
      const previewTooltipRef = ref(null)
      const previewTooltipPosition = ref({ left: 12, top: 12 })
      const previewTooltipStyle = computed(() => {
        return [
          'position: fixed',
          `left: ${previewTooltipPosition.value.left}px`,
          `top: ${previewTooltipPosition.value.top}px`,
          'z-index: 9999',
          'width: min(460px, calc(100vw - 24px))',
          'padding: 8px',
          'border: 1px solid #64748b',
          'border-radius: 4px',
          'background: #f8fafc',
          'color: #0f172a',
          'box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22)',
          'pointer-events: none'
        ].join(';')
      })

      let previewTooltipFrame = 0
      let latestPreviewTooltipPoint = null
      const schedulePreviewTooltipUpdate = (callback) => {
        if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback)
        return setTimeout(callback, 16)
      }

      const updatePreviewTooltipPosition = (event) => {
        if (!event) return
        latestPreviewTooltipPoint = {
          clientX: event.clientX,
          clientY: event.clientY
        }
        if (previewTooltipFrame) return

        previewTooltipFrame = schedulePreviewTooltipUpdate(() => {
          previewTooltipFrame = 0
          if (!latestPreviewTooltipPoint) return

          const margin = 12
          const gap = 14
          let left = latestPreviewTooltipPoint.clientX + gap
          let top = latestPreviewTooltipPoint.clientY + gap

          previewTooltipPosition.value = {
            left: Math.max(margin, left),
            top: Math.max(margin, top)
          }

          nextTick(() => {
            const rect = previewTooltipRef.value?.getBoundingClientRect?.()
            if (!rect) return

            let nextLeft = left
            let nextTop = top
            if (rect.right + margin > window.innerWidth) {
              nextLeft = window.innerWidth - rect.width - margin
            }
            if (rect.bottom + margin > window.innerHeight) {
              nextTop = window.innerHeight - rect.height - margin
            }

            previewTooltipPosition.value = {
              left: Math.max(margin, nextLeft),
              top: Math.max(margin, nextTop)
            }
          })
        })
      }

      const showPreviewTooltip = (item, event) => {
        hoveredPreviewItem.value = item
        updatePreviewTooltipPosition(event)
      }

      const movePreviewTooltip = (event) => {
        if (!hoveredPreviewItem.value) return
        updatePreviewTooltipPosition(event)
      }

      const hidePreviewTooltip = () => {
        hoveredPreviewItem.value = null
        latestPreviewTooltipPoint = null
      }

      watch(
        rules,
        (items) => {
          items.forEach((rule) => ensureRuleSelection(rule, proxyOptions, groupOptions, context))
        },
        { deep: true }
      )

      const openRuleEditor = (index) => {
        const isEdit = Number.isInteger(index)
        const draft = ref(cloneRule(isEdit ? rules.value[index] : createRule(proxyOptions, groupOptions, context)))

        const editorComponent = {
          template: `
          <div class="flex flex-col gap-8" style="width: min(560px, 100%); margin: 0 auto;">
            <div class="grid items-center gap-8" style="grid-template-columns: 84px minmax(0, 420px); justify-content: space-between;">
              <div class="text-12 text-gray-500">来源</div>
              <div class="min-w-0">
                <button type="button" :style="entityButtonStyle" @click="openEntityPicker('source')">{{ renderEntityLabel(draft.sourceType, draft.sourceName) }}</button>
              </div>
            </div>
            <div class="grid items-center gap-8" style="grid-template-columns: 84px minmax(0, 420px); justify-content: space-between;">
              <div class="text-12 text-gray-500">上游</div>
              <div class="min-w-0">
                <button type="button" :style="entityButtonStyle" @click="openEntityPicker('target')">{{ renderEntityLabel(draft.targetType, draft.targetName) }}</button>
              </div>
            </div>
            <div v-if="draft.sourceType === 'group'" class="grid items-center gap-8" style="grid-template-columns: 84px minmax(0, 420px); justify-content: space-between;">
              <div class="text-12 text-gray-500">展开</div>
              <div class="flex justify-end min-w-0">
                <div style="width: 96px; max-width: 100%;">
                  <Switch v-model="draft.recursive">递归子组</Switch>
                </div>
              </div>
            </div>
          </div>
          `,
          setup() {
            watch(
              draft,
              () => {
                ensureRuleSelection(draft.value, proxyOptions, groupOptions, context)
              },
              { deep: true }
            )

            const openEntityPicker = (field) => {
              const keyword = ref('')
              const groupList = computed(() => filterEntityOptions(groupOptions, keyword.value))
              const proxyList = computed(() => filterEntityOptions(proxyOptions, keyword.value))

              const pickerComponent = {
                template: `
                <div class="flex flex-col gap-8" style="width: min(520px, 100%); margin: 0 auto; padding: 8px; border-radius: 4px; background: #f8fafc;">
                  <input v-model="keyword" placeholder="搜索策略组或节点" style="height: 30px; padding: 0 10px; border: 1px solid #cbd5e1; border-radius: 4px; background: #ffffff; outline: none;" />
                  <div class="flex flex-col gap-10" style="max-height: 360px; overflow: auto;">
                    <div class="flex flex-col gap-6">
                      <div class="font-bold text-13">策略组</div>
                      <div v-if="groupList.length === 0" class="text-12 text-gray-500">无匹配策略组</div>
                      <button v-for="item in groupList" :key="'group-' + item.value" type="button" :title="getEntityOptionTitle('group', item.value)" :style="getEntityOptionStyle('group', item.value)" @click="chooseEntity('group', item.value)">
                        {{ item.label }}
                      </button>
                    </div>
                    <div class="flex flex-col gap-6">
                      <div class="font-bold text-13">节点</div>
                      <div v-if="proxyList.length === 0" class="text-12 text-gray-500">无匹配节点</div>
                      <button v-for="item in proxyList" :key="'proxy-' + item.value" type="button" :title="getEntityOptionTitle('proxy', item.value)" :style="getEntityOptionStyle('proxy', item.value)" @click="chooseEntity('proxy', item.value)">
                        {{ item.label }}
                      </button>
                    </div>
                  </div>
                </div>
                `,
                setup() {
                  const choose = (type, name) => {
                    if (field === 'source') {
                      draft.value.sourceType = type
                      draft.value.sourceName = name
                      draft.value.recursive = type === 'group' ? draft.value.recursive !== false : false
                    } else {
                      draft.value.targetType = type
                      draft.value.targetName = name
                    }
                    pickerModal.close()
                  }

                  const getSourceBlocker = (type, name) => {
                    if (field !== 'source') return null
                    return findSourceEntityBlocker(type, name, rules.value, context, isEdit ? index : -1)
                  }

                  const chooseEntity = (type, name) => {
                    const blocker = getSourceBlocker(type, name)
                    if (blocker) {
                      Plugins.message.info(blocker.message)
                      return
                    }
                    choose(type, name)
                  }

                  const getEntityOptionStyle = (type, name) => {
                    return getSourceBlocker(type, name) ? disabledOptionButtonStyle : optionButtonStyle
                  }

                  const getEntityOptionTitle = (type, name) => {
                    const blocker = getSourceBlocker(type, name)
                    return blocker ? blocker.message : name
                  }

                  return {
                    keyword,
                    groupList,
                    proxyList,
                    optionButtonStyle,
                    disabledOptionButtonStyle,
                    chooseEntity,
                    getEntityOptionStyle,
                    getEntityOptionTitle
                  }
                }
              }

              const pickerModal = Plugins.modal(
                {
                  title: field === 'source' ? '选择来源' : '选择上游',
                  width: '580px',
                  height: '520px',
                  maskClosable: true,
                  footer: false,
                  afterClose() {
                    pickerModal.destroy()
                  }
                },
                {
                  default: () => h(pickerComponent)
                }
              )
              pickerModal.open()
            }

            return {
              draft,
              proxyOptions,
              groupOptions,
              entityButtonStyle,
              renderEntityLabel,
              openEntityPicker
            }
          }
        }

        const editorModal = Plugins.modal(
          {
            title: isEdit ? '编辑链式配置' : '添加链式配置',
            width: '640px',
            height: '360px',
            maskClosable: true,
            async onOk() {
              const normalized = normalizeRule(draft.value, proxyOptions, groupOptions, context)
              if (!isValidRule(normalized, context)) {
                Plugins.message.info('请选择有效的来源和上游')
                return false
              }
              const conflict = findRuleSourceConflict(normalized, rules.value, context, isEdit ? index : -1)
              if (conflict) {
                Plugins.message.info(renderSourceConflictMessage(conflict))
                return false
              }
              if (isEdit) {
                rules.value.splice(index, 1, normalized)
              } else {
                rules.value.push(normalized)
              }
            },
            afterClose() {
              editorModal.destroy()
            }
          },
          {
            default: () => h(editorComponent)
          }
        )
        editorModal.open()
      }

      const removeRule = async (index) => {
        const ok = await Plugins.confirm('删除链式配置', '确定删除这条链式配置吗？').catch(() => false)
        if (ok) rules.value.splice(index, 1)
      }

      const getRuleCardStyle = () => {
        return 'border: 1px solid #94a3b8; background: #e8eef6; color: #0f172a;'
      }

      const renderRuleMatchSummary = (rule) => {
        if (rule.enabled === false) return '已停用'
        const normalized = normalizeRule(rule, proxyOptions, groupOptions, context)
        const conflict = findRuleSourceConflict(normalized, rules.value, context, rules.value.indexOf(rule))
        if (conflict) return renderSourceConflictMessage(conflict)
        const count = resolveRuleSources(normalized, context).length
        return count > 0 ? `命中 ${count} 个节点` : '未命中现有节点'
      }

      const getRuleStatusDetails = (rule) => {
        return getRuleStatusMessages(rule, context)
      }

      return {
        rules,
        previewKeyword,
        allPreviewItems,
        previewItems,
        hoveredPreviewItem,
        previewTooltipRef,
        proxyOptions,
        groupOptions,
        openRuleEditor,
        removeRule,
        showPreviewTooltip,
        movePreviewTooltip,
        hidePreviewTooltip,
        getRuleCardStyle,
        renderRuleSummary,
        renderRuleMatchSummary,
        getRuleStatusDetails,
        primaryButtonStyle,
        secondaryButtonStyle,
        dangerButtonStyle,
        searchInputStyle,
        previewProxyNodeStyle,
        previewGroupNodeStyle,
        previewTooltipStyle
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      width: '90',
      height: '90',
      async onOk() {
        const normalizedRules = rules.value.map((rule) => normalizeRule(rule, proxyOptions, groupOptions, context)).filter((rule) => isValidRule(rule, context))
        const conflict = findAnySourceConflict(normalizedRules, context)
        if (conflict) {
          Plugins.message.info(renderSourceConflictMessage(conflict))
          return false
        }
        const saveSummary = buildSaveSummary(
          initialRules.filter((rule) => isValidRule(rule, context)),
          normalizedRules,
          context
        )
        if (saveSummary.hasChanges) {
          const ok = await Plugins.confirm('保存链式配置', renderSaveSummary(saveSummary)).catch(() => false)
          if (!ok) return false
        }

        await writeChainConfig(filePath, {
          rules: normalizedRules.map(serializeRule)
        })
        Plugins.message.success('保存成功，重启核心后生效')
      },
      afterClose() {
        modal.destroy()
      }
    },
    {
      default: () => h(component)
    }
  )
  modal.open()
}

const buildClashChainContext = async (config, profile) => {
  const subscribesStore = Plugins.useSubscribesStore()
  const providerProxies = []
  const providerProxiesById = new Map()
  const proxyByName = new Map()
  const groupByName = new Map()
  const nameById = new Map()

  const registerAlias = (name, id) => {
    if (!name || !id) return
    nameById.set(id, name)
  }

  const registerProxy = (proxy) => {
    if (!proxy?.name) return
    proxyByName.set(proxy.name, proxy)
    registerAlias(proxy.name, proxy.id)
  }

  const registerGroup = (group) => {
    if (!group?.name) return
    groupByName.set(group.name, normalizeGroupMembers(group, nameById, providerProxiesById))
    registerAlias(group.name, group.id)
  }

  for (const group of profile.proxyGroupsConfig || []) {
    registerAlias(group.name, group.id)
  }

  for (const proxy of config.proxies || []) {
    registerProxy(proxy)
  }

  for (const subId in config['proxy-providers'] || {}) {
    const sub = subscribesStore.getSubscribeById(subId)
    if (!sub) continue

    for (const proxy of sub.proxies || []) {
      registerAlias(proxy.name, proxy.id)
    }

    const providerConfig = Plugins.YAML.parse(await Plugins.ReadFile(sub.path).catch(() => '{"proxies": []}')) || {}
    const { proxies = [] } = providerConfig
    providerProxies.push(...proxies)
    providerProxiesById.set(subId, proxies)
    providerProxiesById.set(sub.name, proxies)

    for (const proxy of proxies) {
      registerProxy(proxy)
    }
  }

  for (const group of config['proxy-groups'] || []) {
    registerGroup(group)
  }

  return {
    providerProxies,
    providerProxiesById,
    proxyByName,
    groupByName,
    nameById
  }
}

const normalizeGroupMembers = (group, nameById, providerProxiesById = new Map()) => {
  const directProxyNames = (group.proxies || []).map((name) => nameById.get(name) || name).filter(Boolean)
  const providerResult = collectProviderProxyNames(group, providerProxiesById)

  return {
    ...group,
    proxies: [...new Set([...directProxyNames, ...providerResult.names])],
    use: group.use || [],
    providerUseResolved: providerResult.resolved,
    providerUseStatus: providerResult.status,
    providerUseMatchedCount: providerResult.names.length,
    providerUseMissingIds: providerResult.missingIds || [],
    providerUseInvalidField: providerResult.invalidField || ''
  }
}

const collectProviderProxyNames = (group, providerProxiesById) => {
  const use = group.use || []
  if (use.length === 0) return { names: [], resolved: true, status: 'none' }

  const includeReg = createOptionalRegExp(group.filter)
  const excludeReg = createOptionalRegExp(group['exclude-filter'])
  if (includeReg === undefined) return { names: [], resolved: false, status: 'invalid-regexp', invalidField: 'filter' }
  if (excludeReg === undefined) return { names: [], resolved: false, status: 'invalid-regexp', invalidField: 'exclude-filter' }

  const names = []
  const missingIds = []
  for (const providerId of use) {
    if (!providerProxiesById.has(providerId)) {
      missingIds.push(providerId)
      continue
    }
    const proxies = providerProxiesById.get(providerId) || []
    for (const proxy of proxies) {
      if (!proxy?.name) continue
      if (includeReg && !includeReg.test(proxy.name)) continue
      if (excludeReg && excludeReg.test(proxy.name)) continue
      names.push(proxy.name)
    }
  }

  if (missingIds.length > 0) return { names: [], resolved: false, status: 'missing-provider', missingIds }

  return { names, resolved: true, status: names.length > 0 ? 'resolved' : 'empty' }
}

const createOptionalRegExp = (pattern) => {
  const text = String(pattern || '').trim()
  if (!text) return null

  try {
    return new RegExp(text)
  } catch {
    return undefined
  }
}

const inlineResolvedProviderGroups = (config, context) => {
  for (const group of config['proxy-groups'] || []) {
    if (!Array.isArray(group.use) || group.use.length === 0) continue

    const normalizedGroup = context.groupByName.get(group.name)
    if (!normalizedGroup?.providerUseResolved || normalizedGroup.proxies.length === 0) continue

    group.proxies = normalizedGroup.proxies
    delete group.use
    delete group.filter
    delete group['exclude-filter']
  }

  removeUnusedProxyProviders(config)
}

const removeUnusedProxyProviders = (config) => {
  const proxyProviders = config['proxy-providers']
  if (!proxyProviders) return

  const usedProviders = new Set()
  for (const group of config['proxy-groups'] || []) {
    for (const providerId of group.use || []) {
      usedProviders.add(providerId)
    }
  }

  for (const providerId of Object.keys(proxyProviders)) {
    if (!usedProviders.has(providerId)) delete proxyProviders[providerId]
  }

  if (Object.keys(proxyProviders).length === 0) {
    delete config['proxy-providers']
  }
}

const normalizeChainConfig = (config, context) => {
  const rules = Array.isArray(config?.rules) ? config.rules.map((rule) => normalizeStoredRule(rule, context)) : []
  return { rules: rules.filter((rule) => rule.sourceName && rule.targetName) }
}

const normalizeStoredRule = (rule = {}, context) => {
  const sourceRaw = rule.sourceName
  const targetRaw = rule.targetName
  const sourceType = normalizeType(rule.sourceType) || inferEntityType(sourceRaw, context, 'group')
  const targetType = normalizeType(rule.targetType) || inferEntityType(targetRaw, context, 'proxy')

  return {
    id: rule.id || Plugins.sampleID(),
    enabled: rule.enabled !== false,
    sourceType,
    sourceName: resolveEntityName(sourceRaw, sourceType, context),
    targetType,
    targetName: resolveEntityName(targetRaw, targetType, context),
    recursive: rule.recursive !== false
  }
}

const normalizeRule = (rule = {}, proxyOptions, groupOptions, context) => {
  const sourceType = normalizeType(rule.sourceType) || inferEntityType(rule.sourceName, context, 'group')
  const targetType = normalizeType(rule.targetType) || inferEntityType(rule.targetName, context, 'proxy')
  const sourceName = resolveEntityName(rule.sourceName, sourceType, context) || getDefaultName(sourceType, proxyOptions, groupOptions)
  const targetName = resolveEntityName(rule.targetName, targetType, context) || getDefaultName(targetType, proxyOptions, groupOptions)

  return {
    id: rule.id || Plugins.sampleID(),
    enabled: rule.enabled !== false,
    sourceType,
    sourceName,
    targetType,
    targetName,
    recursive: sourceType === 'group' ? rule.recursive !== false : false
  }
}

const createRule = (proxyOptions, groupOptions, context) => {
  const sourceType = groupOptions.length > 0 ? 'group' : 'proxy'
  const targetType = proxyOptions.length > 0 ? 'proxy' : 'group'
  return normalizeRule({ sourceType, targetType }, proxyOptions, groupOptions, context)
}

const cloneRule = (rule) => {
  return JSON.parse(JSON.stringify(rule || {}))
}

const renderRuleSummary = (rule) => {
  const sourceType = rule.sourceType === 'proxy' ? '节点' : '策略组'
  const targetType = rule.targetType === 'proxy' ? '节点' : '策略组'
  const recursive = rule.sourceType === 'group' && rule.recursive !== false ? '，递归子组' : ''
  return `上游（${targetType}）: ${rule.targetName || '-'} -> 来源（${sourceType}）: ${rule.sourceName || '-'}${recursive}`
}

const renderEntityLabel = (type, name) => {
  if (!name) return '请选择'
  return `${type === 'proxy' ? '节点' : '策略组'}: ${name}`
}

const filterEntityOptions = (options, keyword) => {
  const text = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!text) return options
  return options.filter((option) => option.label.toLowerCase().includes(text))
}

const filterPreviewItems = (items, keyword) => {
  const text = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!text) return items

  return items.filter((item) => {
    const ruleText = item.matchedRules.map((rule) => `${rule.label} ${rule.summary}`).join(' ')
    const content = [item.source, item.chainText, ruleText, ...item.parts.map((part) => part.name)].join(' ').toLowerCase()
    return content.includes(text)
  })
}

const getRuleStatusMessages = (rule, context) => {
  const normalized = normalizeStoredRule(rule, context)
  if (normalized.enabled === false) return []
  if (!isValidRule(normalized, context)) return ['来源或上游不存在']
  if (normalized.sourceType !== 'group') return []
  return getGroupProviderStatusMessages(normalized.sourceName, context, normalized.recursive !== false)
}

const getGroupProviderStatusMessages = (groupName, context, recursive = true, seen = new Set()) => {
  const resolvedGroupName = resolveEntityName(groupName, 'group', context)
  if (!resolvedGroupName || seen.has(resolvedGroupName)) return []
  seen.add(resolvedGroupName)

  const group = context.groupByName.get(resolvedGroupName)
  if (!group) return []

  const messages = []
  if ((group.use || []).length > 0) {
    if (group.providerUseStatus === 'invalid-regexp') {
      messages.push(`策略组「${resolvedGroupName}」${group.providerUseInvalidField} 正则无效，无法解析订阅节点`)
    } else if (group.providerUseStatus === 'missing-provider') {
      messages.push(`策略组「${resolvedGroupName}」订阅缓存未解析：${group.providerUseMissingIds.join(', ')}`)
    } else if (group.providerUseStatus === 'empty') {
      messages.push(`策略组「${resolvedGroupName}」订阅过滤后无节点`)
    }
  }

  if (recursive) {
    for (const name of group.proxies || []) {
      const childName = resolveAnyEntityName(name, context)
      if (context.groupByName.has(childName)) {
        messages.push(...getGroupProviderStatusMessages(childName, context, recursive, new Set(seen)))
      }
    }
  }

  return [...new Set(messages)]
}

const ensureRuleSelection = (rule, proxyOptions, groupOptions, context) => {
  rule.sourceType = normalizeType(rule.sourceType) || 'group'
  rule.targetType = normalizeType(rule.targetType) || 'proxy'
  rule.sourceName = resolveEntityName(rule.sourceName, rule.sourceType, context)
  rule.targetName = resolveEntityName(rule.targetName, rule.targetType, context)

  if (!hasOption(rule.sourceName, getOptions(rule.sourceType, proxyOptions, groupOptions))) {
    rule.sourceName = getDefaultName(rule.sourceType, proxyOptions, groupOptions)
  }
  if (!hasOption(rule.targetName, getOptions(rule.targetType, proxyOptions, groupOptions))) {
    rule.targetName = getDefaultName(rule.targetType, proxyOptions, groupOptions)
  }
  if (rule.sourceType === 'proxy') {
    rule.recursive = false
  }
}

const getDefaultName = (type, proxyOptions, groupOptions) => {
  return type === 'group' ? groupOptions[0]?.value : proxyOptions[0]?.value
}

const getOptions = (type, proxyOptions, groupOptions) => {
  return type === 'group' ? groupOptions : proxyOptions
}

const hasOption = (value, options) => {
  return options.some((option) => option.value === value)
}

const isValidRule = (rule, context) => {
  return (
    rule.sourceName && rule.targetName && entityExists(rule.sourceType, rule.sourceName, context) && entityExists(rule.targetType, rule.targetName, context)
  )
}

const getRuleSourceKey = (rule) => {
  const type = normalizeType(rule.sourceType)
  if (!type || !rule.sourceName) return ''
  return `${type}:${rule.sourceName}`
}

const buildSourceUsage = (rules, context, options = {}) => {
  const { skipIndex = -1, includeDisabled = true } = options
  const nodeOwners = new Map()
  const sourceKeyOwners = new Map()

  for (const [index, rule] of (rules || []).entries()) {
    if (index === skipIndex) continue

    const normalized = normalizeStoredRule(rule, context)
    if (!isValidRule(normalized, context)) continue
    if (!includeDisabled && normalized.enabled === false) continue

    const owner = {
      index,
      rule: normalized,
      label: `规则 ${index + 1}`
    }

    const key = getRuleSourceKey(normalized)
    if (key) pushMapArray(sourceKeyOwners, key, owner)

    for (const nodeName of resolveRuleSources(normalized, context)) {
      pushMapArray(nodeOwners, nodeName, owner)
    }
  }

  return {
    nodeOwners,
    sourceKeyOwners
  }
}

const pushMapArray = (map, key, value) => {
  const items = map.get(key) || []
  items.push(value)
  map.set(key, items)
}

const findRuleSourceConflict = (rule, rules, context, currentIndex = -1, options = {}) => {
  const normalized = normalizeStoredRule(rule, context)
  if (!isValidRule(normalized, context)) return null

  const usage = buildSourceUsage(rules, context, { ...options, skipIndex: currentIndex })
  const key = getRuleSourceKey(normalized)
  const keyOwner = key ? usage.sourceKeyOwners.get(key)?.[0] : null
  if (keyOwner) return buildSourceConflict(normalized, keyOwner)

  const sourceNodes = resolveRuleSources(normalized, context)
  for (const nodeName of sourceNodes) {
    const nodeOwner = usage.nodeOwners.get(nodeName)?.[0]
    if (nodeOwner) return buildSourceConflict(normalized, nodeOwner, nodeName)
  }

  return null
}

const findSourceEntityBlocker = (type, name, rules, context, currentIndex = -1) => {
  const sourceName = resolveEntityName(name, type, context)
  const usage = buildSourceUsage(rules, context, { skipIndex: currentIndex })
  const keyOwner = usage.sourceKeyOwners.get(`${type}:${sourceName}`)?.[0]
  if (keyOwner) return buildSourceBlocker(keyOwner)

  const nodes = type === 'group' ? collectLeafProxyNames(sourceName, context, true) : [sourceName]
  for (const nodeName of nodes) {
    const nodeOwner = usage.nodeOwners.get(nodeName)?.[0]
    if (nodeOwner) return buildSourceBlocker(nodeOwner, type === 'group' ? nodeName : '')
  }

  return null
}

const findAnySourceConflict = (rules, context, options = {}) => {
  const usage = buildSourceUsage(rules, context, options)

  for (const owners of usage.sourceKeyOwners.values()) {
    if (owners.length > 1) return buildSourceConflict(owners[1].rule, owners[0])
  }

  for (const [nodeName, owners] of usage.nodeOwners.entries()) {
    if (owners.length > 1) return buildSourceConflict(owners[1].rule, owners[0], nodeName)
  }

  return null
}

const buildSourceConflict = (rule, owner, nodeName = '') => {
  return {
    rule,
    owner,
    nodeName,
    message: nodeName ? `来源冲突：节点「${nodeName}」已被${owner.label}命中` : `来源冲突：该来源已被${owner.label}使用`
  }
}

const buildSourceBlocker = (owner, nodeName = '') => {
  return {
    owner,
    nodeName,
    message: nodeName ? `不可选择：组内节点「${nodeName}」已被${owner.label}命中` : `不可选择：已被${owner.label}作为来源`
  }
}

const renderSourceConflictMessage = (conflict) => {
  return conflict?.message || '同一个节点只能配置一个上游'
}

const entityExists = (type, name, context) => {
  const resolvedName = resolveEntityName(name, type, context)
  return type === 'group' ? context.groupByName.has(resolvedName) : context.proxyByName.has(resolvedName)
}

const normalizeType = (type) => {
  return type === 'group' || type === 'proxy' ? type : null
}

const inferEntityType = (value, context, fallback) => {
  const name = resolveAnyEntityName(value, context)
  if (context.groupByName.has(name)) return 'group'
  if (context.proxyByName.has(name)) return 'proxy'
  return fallback
}

const resolveEntityName = (value, type, context) => {
  const name = resolveAnyEntityName(value, context)
  if (!name) return name
  if (type === 'group' && context.groupByName.has(name)) return name
  if (type === 'proxy' && context.proxyByName.has(name)) return name
  return name
}

const resolveAnyEntityName = (value, context) => {
  if (!value) return value
  return context.nameById.get(value) || value
}

const toOptions = (names) => {
  return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN')).map((name) => ({ label: name, value: name }))
}

const buildDialerMap = (rules, context) => {
  return buildDialerContext(rules, context).dialerMap
}

const buildDialerContext = (rules, context) => {
  const result = new Map()
  const resultRuleIds = new Map()
  const previewResult = new Map()
  const previewRuleIds = new Map()

  for (const rule of rules || []) {
    const normalizedRule = normalizeStoredRule(rule, context)
    if (!isValidRule(normalizedRule, context)) continue
    if (normalizedRule.enabled === false) continue

    const targetName = normalizedRule.targetName
    if (!targetName) continue

    const sources = resolveRuleSources(normalizedRule, context)
    for (const sourceName of sources) {
      if (!sourceName || sourceName === targetName) continue
      if (setChainLink(result, resultRuleIds, sourceName, targetName, normalizedRule.id)) {
        setChainLink(previewResult, previewRuleIds, sourceName, targetName, normalizedRule.id)
      }
    }

    if (normalizedRule.sourceType === 'group' && sources.length > 0 && normalizedRule.sourceName !== targetName) {
      setChainLink(previewResult, previewRuleIds, normalizedRule.sourceName, targetName, normalizedRule.id)
    }
  }

  return {
    dialerMap: result,
    dialerRuleIds: resultRuleIds,
    previewMap: previewResult,
    previewRuleIds
  }
}

const setChainLink = (links, ruleIds, sourceName, targetName, ruleId) => {
  const previousTarget = links.get(sourceName)
  const previousRuleId = ruleIds.get(sourceName)

  links.set(sourceName, targetName)
  ruleIds.set(sourceName, ruleId)

  if (!hasDialerCycle(sourceName, links)) return true

  if (previousTarget) {
    links.set(sourceName, previousTarget)
  } else {
    links.delete(sourceName)
  }

  if (previousRuleId) {
    ruleIds.set(sourceName, previousRuleId)
  } else {
    ruleIds.delete(sourceName)
  }

  return false
}

const buildPreviewItems = (rules, context) => {
  const { dialerMap, previewMap, previewRuleIds } = buildDialerContext(rules, context)
  const ruleMetaById = new Map()
  ;(rules || []).forEach((rule, index) => {
    const normalizedRule = normalizeStoredRule(rule, context)
    if (!isValidRule(normalizedRule, context)) return
    if (normalizedRule.enabled === false) return
    ruleMetaById.set(normalizedRule.id, {
      id: normalizedRule.id,
      label: `规则 ${index + 1}`,
      summary: renderRuleSummary(normalizedRule)
    })
  })

  return [...dialerMap.keys()]
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((source) => {
      const chain = getChainPartsWithRules(source, previewMap, previewRuleIds)
      const displayParts = [...chain.parts].reverse().map((name) => ({
        name,
        type: context.groupByName.has(name) ? 'group' : 'proxy'
      }))
      const matchedRules = [...chain.ruleIds]
        .reverse()
        .map((ruleId) => ruleMetaById.get(ruleId))
        .filter(Boolean)

      return {
        source,
        parts: displayParts,
        ruleIds: chain.ruleIds,
        chainText: ['本机', ...displayParts.map((part) => part.name), '互联网'].join(' -> '),
        matchedRules
      }
    })
}

const serializeRule = (rule) => {
  return {
    id: rule.id || Plugins.sampleID(),
    enabled: rule.enabled !== false,
    sourceType: rule.sourceType,
    sourceName: rule.sourceName,
    targetType: rule.targetType,
    targetName: rule.targetName,
    recursive: rule.sourceType === 'group' ? rule.recursive !== false : false
  }
}

const getRuleSignature = (rule) => {
  return JSON.stringify(serializeRule(rule))
}

const buildSaveSummary = (previousRules, currentRules, context) => {
  const previousRuleMap = new Map()
  const currentRuleMap = new Map()

  ;(previousRules || []).forEach((rule, index) => {
    previousRuleMap.set(rule.id, { rule, index, signature: getRuleSignature(rule) })
  })
  ;(currentRules || []).forEach((rule, index) => {
    currentRuleMap.set(rule.id, { rule, index, signature: getRuleSignature(rule) })
  })

  const addedRules = []
  const removedRules = []
  const modifiedRules = []

  for (const item of currentRuleMap.values()) {
    const previous = previousRuleMap.get(item.rule.id)
    if (!previous) {
      addedRules.push(item)
    } else if (previous.signature !== item.signature) {
      modifiedRules.push({ before: previous, after: item })
    }
  }

  for (const item of previousRuleMap.values()) {
    if (!currentRuleMap.has(item.rule.id)) removedRules.push(item)
  }

  const linkDiff = buildPreviewDiff(previousRules, currentRules, context)

  return {
    addedRules,
    removedRules,
    modifiedRules,
    linkDiff,
    hasChanges:
      addedRules.length > 0 ||
      removedRules.length > 0 ||
      modifiedRules.length > 0 ||
      linkDiff.added.length > 0 ||
      linkDiff.removed.length > 0 ||
      linkDiff.modified.length > 0
  }
}

const renderSaveSummary = (summary) => {
  const lines = [
    `本次规则更改：新增 ${summary.addedRules.length} 条，修改 ${summary.modifiedRules.length} 条，删除 ${summary.removedRules.length} 条。`,
    `本次链路变化：新增 ${summary.linkDiff.added.length} 条，修改 ${summary.linkDiff.modified.length} 条，移除 ${summary.linkDiff.removed.length} 条。`
  ]

  if (summary.addedRules.length > 0) {
    lines.push('', '新增规则：')
    lines.push(...summary.addedRules.map((item) => `+ ${renderIndexedRule(item)}`))
  }
  if (summary.modifiedRules.length > 0) {
    lines.push('', '修改规则：')
    for (const item of summary.modifiedRules) {
      lines.push(`* 规则 ${item.after.index + 1}`)
      lines.push(`  原：${renderRuleForDiff(item.before.rule)}`)
      lines.push(`  新：${renderRuleForDiff(item.after.rule)}`)
    }
  }
  if (summary.removedRules.length > 0) {
    lines.push('', '删除规则：')
    lines.push(...summary.removedRules.map((item) => `- 原规则 ${item.index + 1}：${renderRuleForDiff(item.rule)}`))
  }

  if (summary.linkDiff.added.length > 0) {
    lines.push('', '新增链路：')
    lines.push(...summary.linkDiff.added.map((item) => `+ ${item.chainText}`))
  }
  if (summary.linkDiff.modified.length > 0) {
    lines.push('', '修改链路：')
    for (const item of summary.linkDiff.modified) {
      lines.push(`* ${item.source}`)
      lines.push(`  原：${item.before.chainText}`)
      lines.push(`  新：${item.after.chainText}`)
    }
  }
  if (summary.linkDiff.removed.length > 0) {
    lines.push('', '移除链路：')
    lines.push(...summary.linkDiff.removed.map((item) => `- ${item.chainText}`))
  }

  lines.push('确定保存吗？')
  return lines.join('\n')
}

const buildPreviewDiff = (previousRules, currentRules, context) => {
  const previousMap = new Map(buildPreviewItems(previousRules, context).map((item) => [item.source, item]))
  const currentMap = new Map(buildPreviewItems(currentRules, context).map((item) => [item.source, item]))
  const added = []
  const removed = []
  const modified = []

  for (const item of currentMap.values()) {
    const previous = previousMap.get(item.source)
    if (!previous) {
      added.push(item)
    } else if (previous.chainText !== item.chainText) {
      modified.push({ source: item.source, before: previous, after: item })
    }
  }

  for (const item of previousMap.values()) {
    if (!currentMap.has(item.source)) removed.push(item)
  }

  return { added, removed, modified }
}

const renderIndexedRule = (item) => {
  return `规则 ${item.index + 1}：${renderRuleForDiff(item.rule)}`
}

const renderRuleForDiff = (rule) => {
  return `${rule.enabled === false ? '已停用' : '已启用'}；${renderRuleSummary(rule)}`
}

const resolveRuleSources = (rule, context) => {
  if (rule.sourceType === 'proxy') {
    const sourceName = resolveEntityName(rule.sourceName, 'proxy', context)
    return context.proxyByName.has(sourceName) ? [sourceName] : []
  }
  return collectLeafProxyNames(rule.sourceName, context, rule.recursive !== false)
}

const collectLeafProxyNames = (groupName, context, recursive = true, seen = new Set()) => {
  const resolvedGroupName = resolveEntityName(groupName, 'group', context)
  if (seen.has(resolvedGroupName)) return []
  seen.add(resolvedGroupName)

  const group = context.groupByName.get(resolvedGroupName)
  if (!group) return context.proxyByName.has(resolvedGroupName) ? [resolvedGroupName] : []

  const result = []
  for (const name of group.proxies || []) {
    const resolvedName = resolveAnyEntityName(name, context)
    if (context.proxyByName.has(resolvedName)) {
      result.push(resolvedName)
    } else if (recursive && context.groupByName.has(resolvedName)) {
      result.push(...collectLeafProxyNames(resolvedName, context, recursive, new Set(seen)))
    }
  }

  return [...new Set(result)]
}

const hasDialerCycle = (source, dialerMap) => {
  const seen = new Set()
  let current = source

  while (dialerMap.has(current)) {
    if (seen.has(current)) return true
    seen.add(current)
    current = dialerMap.get(current)
  }

  return false
}

const renderChain = (source, dialerMap) => {
  return getChainParts(source, dialerMap).join(' -> ')
}

const getChainParts = (source, dialerMap) => {
  const parts = [source]
  const seen = new Set([source])
  let current = source

  while (dialerMap.has(current)) {
    current = dialerMap.get(current)
    parts.push(current)
    if (seen.has(current)) {
      parts.push('循环引用')
      break
    }
    seen.add(current)
  }

  return parts
}

const getChainPartsWithRules = (source, links, ruleIds) => {
  const parts = [source]
  const relatedRuleIds = []
  const seen = new Set([source])
  let current = source

  while (links.has(current)) {
    const ruleId = ruleIds.get(current)
    if (ruleId) relatedRuleIds.push(ruleId)

    current = links.get(current)
    parts.push(current)
    if (seen.has(current)) {
      parts.push('循环引用')
      break
    }
    seen.add(current)
  }

  return {
    parts,
    ruleIds: [...new Set(relatedRuleIds)]
  }
}

const writeChainConfig = async (filePath, config) => {
  if (!(await Plugins.FileExists('data/third'))) await Plugins.MakeDir('data/third')
  if (!(await Plugins.FileExists(PATH))) await Plugins.MakeDir(PATH)
  await Plugins.WriteFile(filePath, JSON.stringify(config, null, 2))
}
