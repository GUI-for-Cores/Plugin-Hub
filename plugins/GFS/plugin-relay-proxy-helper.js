window[Plugin.id] = window[Plugin.id] || {}
window[Plugin.id].selectedProfileId = null
window[Plugin.id].outbounds = []

/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  window[Plugin.id].outbounds = await selectProfile()
  home().open()
  return 0
}

const selectProfile = async () => {
  const profilesStore = Plugins.useProfilesStore()
  let profile = null
  if (profilesStore.profiles.length === 1) {
    profile = profilesStore.profiles[0]
  } else {
    profile = await Plugins.picker.single(
      '请选择要添加代理链的配置',
      profilesStore.profiles.map((v) => ({
        label: v.name,
        value: v
      })),
      [profilesStore.profiles[0]]
    )
  }
  window[Plugin.id].selectedProfileId = profile.id
  const outTags = getOutTags(profile)
  return outTags
}

const addRelayProxy = async (profile) => {
  window[Plugin.id].selectedProfileId = profile.id
  window[Plugin.id].outbounds = await getOutTags(profile)
  home().open()
}

const getOutTags = async (profile) => {
  const config = await Plugins.generateConfig(profile)
  const outTags = config.outbounds
    .map((out) => {
      if (!['direct', 'block'].includes(out.type) && out.tag !== 'GLOBAL') {
        return out.tag
      }
      return null
    })
    .filter(Boolean)
  return outTags
}

const home = () => {
  const { ref, h, computed, watch } = Vue
  const component = {
    template: `
    <div class="pr-8">
      <div class="py-8 flex items-center gap-4">
        快速添加：向
        <Select v-model="targetChainIndex" :options="chainOptions" />
        添加出站
        <Select v-model="globalOutSelected" :options="outList" placeholder="选择出站标签" />
        <Button @click="addOutToTargetChain" type="link">立即执行</Button>
        <Button @click="relayConfigGenerate" type="primary" class="ml-auto">生成最终脚本</Button>
      </div>

      <!-- 多条链区域 -->
      <div class="flex flex-col gap-8 mt-8">
        <Card v-for="(chain, idx) in relayChains" :key="idx" :title="'第 ' + (idx+1) + ' 条代理链'">
          <template #title-suffix>
            <div v-if="relayChains[idx].length < 2" class="text-12 px-8" style="color: #ff6b6b">至少需要 2 个出站</div>
          </template>
          <template #extra>
            <Button @click="() => removeChain(idx)" v-if="relayChains.length > 1" type="text" size="small">删除</Button>
          </template>
          <InputList v-model="relayChains[idx]" placeholder="Outbound" class="w-full" />
        </Card>
      </div>

      <div class="mt-8">
        <Button @click="addChain" type="text" class="w-full" icon="add">添加代理链</Button>
      </div>

      <div class="text-12 flex flex-col gap-4 py-16" style="color: #5c5c5c">
        <div>请添加你想要包含在代理链中的出站或分组，流量走向从上而下。</div>
        <div>如果为分组指定上游，将会为分组内包含的所有非分组出站添加上游。</div>
        <div>如果需要添加多个代理链，请使用上方的“添加代理链”按钮，每条链为一组。</div>
      </div>
    </div>
    `,
    setup() {
      // 每条链是数组
      const relayChains = ref([[]])
      const outList = window[Plugin.id].outbounds.map((v) => ({ label: v, value: v }))

      // 全局 select
      const globalOutSelected = ref(outList[0]?.value ?? null)
      // 目标链索引（选择插入到哪条链）
      const targetChainIndex = ref(0)

      // 生成链下拉选项：链 1, 链 2, ...
      const chainOptions = computed(() =>
        relayChains.value.map((_, i) => ({
          label: `第 ${i + 1} 条代理链`,
          value: i
        }))
      )

      // 当链数变化时，确保 targetChainIndex 在有效范围
      watch(
        relayChains,
        () => {
          if (targetChainIndex.value >= relayChains.value.length) {
            targetChainIndex.value = relayChains.value.length - 1
          }
        },
        { deep: true }
      )

      const addChain = () => {
        relayChains.value.push([])
        // 自动把 target 设为最后一条（便于快速添加）
        targetChainIndex.value = relayChains.value.length - 1
      }

      const removeChain = (idx) => {
        if (relayChains.value.length <= 1) return
        relayChains.value.splice(idx, 1)
        if (targetChainIndex.value >= relayChains.value.length) {
          targetChainIndex.value = relayChains.value.length - 1
        }
      }

      // 将全局选中的出站插入到目标链（尾部）
      const addOutToTargetChain = () => {
        if (!globalOutSelected.value) return
        const idx = Number(targetChainIndex.value || 0)
        if (idx < 0 || idx >= relayChains.value.length) return
        relayChains.value[idx].push(globalOutSelected.value)
      }

      // 规范化每条链
      const normalizeChains = (chains) => chains.map((chain) => (chain || []).map((v) => (typeof v === 'string' ? v.trim() : v)).filter(Boolean))

      // 对每条链反转
      const handleRelayChains = (chains) => chains.map((c) => c.slice().reverse())

      // 生成逻辑：对每条链单独校验最少出站
      const relayConfigGenerate = async () => {
        const normalized = normalizeChains(relayChains.value)

        // 每条链单独校验
        for (let i = 0; i < normalized.length; i++) {
          if (normalized[i].length < 2) {
            Plugins.message.error(`第 ${i + 1} 条链至少需要 2 个出站（当前 ${normalized[i].length} 个）`)
            throw `第 ${i + 1} 条链出站不足`
          }
        }

        const reversedChains = handleRelayChains(normalized)
        const configScript = configScriptGenerate(reversedChains)
        displayConfigScript(configScript).open()
      }

      const configScriptGenerate = (relayChainsArg) => {
        const escape = (s) => String(s).replace(/'/g, "\\'")
        const relayChainsStr = '[' + relayChainsArg.map((chain) => '[' + chain.map((v) => `'${escape(v)}'`).join(', ') + ']').join(', ') + ']'

        // 支持为分组内实际 outbounds 添加上游
        const configScript = `  const relayChains = ${relayChainsStr}; // 代理链定义
  const excludeReg = /selector|urltest/; // 排除分组类型
  const outsMap = Object.fromEntries(config.outbounds.map((out) => [out.tag, out])); // 将所有出站转换为以 tag 为键的映射

  // 识别分组中包含的实际出站成员
  const groupMembers = {};
  for (const out of Object.values(outsMap)) {
    // 仅处理有效的且是分组类型的出站
    if (!out?.tag || !excludeReg.test(out.type)) continue;

    const membersSet = new Set();
    for (const candidate of Object.values(outsMap)) {
      // 仅处理有效的且非自身出站
      if (!candidate?.tag || candidate.tag === out.tag) continue;
      try {
        // 通过 JSON 字符串包含关系判断是否为分组成员
        if (JSON.stringify(out).includes('"' + candidate.tag + '"')) {
          membersSet.add(candidate.tag);
        }
      } catch (e) {
        // 忽略序列化错误，不影响逻辑
      }
    }
    groupMembers[out.tag] = Array.from(membersSet);
  }

  // 遍历代理链并设置上游出站
  relayChains.forEach((chain) => {
    chain.forEach((tag, i, arr) => {
      // 链的最后一个出站不需要设置上游
      if (i === arr.length - 1) return;

      const out = outsMap[tag];
      const upStream = arr[i + 1]; // 下一个出站作为当前出站的上游

      if (!out) {
        throw \`错误：当前配置内未找到出站 \${tag}\`;
      }

      // 根据出站类型进行处理
      if (excludeReg.test(out.type)) { // 如果是分组类型（selector 或 urltest）
        const members = groupMembers[tag] || [];
        // 检查分组是否有识别到的成员
        if (!members.length) {
          throw \`错误：分组 \${tag} 未识别到可用成员，请检查配置\`;
        }
        members.forEach((mTag) => {
          // 如果成员自身就是上游，则跳过，避免自循环 
          if (mTag === upStream) {
            Plugins.message.warn(\`警告：分组 \${tag} 的成员 \${mTag} 上游与其自身一致，已跳过设置。\`);
            return;
          }

          const mOut = outsMap[mTag];
          if (!mOut) {
            throw \`错误：当前配置内未找到出站 \${mTag}（属于分组 \${tag}）\`;
          }
          // 仅为非分组且非 direct/block 类型的成员设置上游
          if (!excludeReg.test(mOut.type) && !['direct', 'block'].includes(mOut.type)) {
            mOut.detour = upStream;
          }
        });
      } else { // 如果是普通出站类型
        // 排除 direct/block 类型，它们不可设置上游
        if (['direct', 'block'].includes(out.type)) {
          throw \`错误：出站 \${out.tag} 类型不可设置上游\`;
        }
        // 普通出站的上游不能是自身
        if (tag === upStream) {
          throw \`错误：出站 \${out.tag} 的上游不能是自身，请检查代理链配置。\`;
        }
        out.detour = upStream;
      }
    });
  });`

        return `const onGenerate = async (config) => {
${configScript}
  return config
}`.replace(/^\s*$(?:\r\n?|\n)/gm, '')
      }

      const displayConfigScript = (configScript) => {
        const previewComponent = {
          template: `
          <div class="pr-8">
            <Card>
              <div class="flex justify-between items-start gap-12 rounded px-12 py-8">
                <div
                  class="flex-1"
                  style="line-height: 1.5"
                >
                  你可以点击右侧的 <b>复制脚本</b> 按钮将脚本复制到剪贴板，然后到对应配置的
                  “设置 → 混入和脚本 → 脚本操作”中粘贴使用，或点击右侧的
                  <b>覆盖写入</b> 按钮直接将脚本覆盖到当前配置。
                </div>
                <div style="flex:0 0 auto; display:flex; flex-direction:column; gap:6px;">
                  <Button 
                    @click="onCopy" 
                    type="primary"
                    title="将脚本复制到剪贴板"
                  >
                    复制脚本
                  </Button>
                  <Button 
                    @click="onOverWrite" 
                    type="link"
                    title="点击后代理链脚本将直接覆盖当前配置的脚本"
                  >
                    覆盖写入
                  </Button>
                </div>
              </div>
              <CodeViewer
                v-model="code"
                lang="javascript"
                style="min-height:320px; width:100%; border-radius:6px; overflow:hidden;"
              />
            </Card>
          </div>
          `,
          setup() {
            const code = ref(configScript)

            const onOverWrite = async () => {
              const profilesStore = Plugins.useProfilesStore()
              const profile = profilesStore.getProfileById(window[Plugin.id].selectedProfileId)
              profile.script.code = configScript
              profilesStore.editProfile(profile.id, profile)
              Plugins.message.info('代理链脚本已成功写入当前配置')
            }

            const onCopy = async () => {
              await Plugins.ClipboardSetText(code.value)
              Plugins.message.info('脚本已复制到剪贴板')
            }

            return {
              code,
              onOverWrite,
              onCopy
            }
          }
        }

        const modal = Plugins.modal({
          title: '配置脚本预览',
          submit: false,
          cancelText: '关闭',
          component: h(previewComponent),
          afterClose: () => {
            modal.destroy()
          }
        })
        return modal
      }

      if (relayChains.value.length > 0) targetChainIndex.value = 0

      return {
        relayChains,
        outList,
        globalOutSelected,
        targetChainIndex,
        chainOptions,
        addChain,
        removeChain,
        addOutToTargetChain,
        relayConfigGenerate,
        configScriptGenerate,
        displayConfigScript
      }
    }
  }

  const modal = Plugins.modal({
    title: '链式代理列表',
    submit: false,
    width: '90',
    cancelText: '关闭',
    component: h(component),
    afterClose: () => {
      modal.destroy()
    }
  })

  return modal
}
