/**
 * 插件钩子 - 点击运行按钮时
 */
const onRun = async () => {
  home().open()
  return 0
}

const home = () => {
  const { ref, h, defineComponent } = Vue
  const component = defineComponent({
    template: `
    <div>
      <Card class="mt-8">
        <div style="display: flex; justify-content: center;">
          <InputList v-model="relayList" placeholder="Proxy" style="width: 100%;" />
        </div>
        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
          <p>请按顺序输入你想要包含在代理链中的节点名称，<br />流量去向从上而下，节点上游可以是代理分组，<br />但代理分组不能设置上游</p>
          <Button @click="relayConfigGenerate">生成</Button>
        </div>
      </Card>
    </div>
    `,
    setup() {
      const relayList = ref([])

      const relayConfigGenerate = async () => {
        const relayListArr = [...relayList.value]
        if (relayListArr.length < 2) {
          Plugins.message.error('请输入至少两个节点名称')
          throw '不是有效的代理链'
        }
        const listReversed = handleRelayList(relayListArr)
        const configScript = configScriptGenerate(listReversed)
        displayConfigScript(configScript).open()
      }

      const handleRelayList = (rawList) => {
        return rawList
          .map((v) => v.trim())
          .slice()
          .reverse()
      }

      const configScriptGenerate = (relayList) => {
        let configScript = ``
        const relayListStr = `[${relayList.map((v) => `'${v}'`).join(', ')}]`
        if (Plugins.APP_TITLE.includes('SingBox')) {
          configScript = `const relayList = ${relayListStr}
  const excludeReg = /selector|urltest/
  const outsMap = Object.fromEntries(config.outbounds.map((out) => [out.tag, out]))
  relayList.forEach((tag, i, arr) => {
    if (i === arr.length - 1) return
    const out = outsMap[tag]
    const upStream = arr[i + 1]
    if (!out) throw \`错误：当前配置内未找到节点 \${tag}\`
    if (excludeReg.test(out.type)) {
      throw '错误：出站分组不能设置上游代理'
    }
    out.detour = upStream
  })`
        } else {
          configScript = `const relayList = ${relayListStr}
  if (config.proxies.length < 1) {
    throw '错误：配置文件内未包含有效节点，请在策略组设置内手动选择需要包含到代理链的节点，而不是订阅'
  }
  const proxiesMap = Object.fromEntries(config.proxies.map((proxy) => [proxy.name, proxy]))
  relayList.forEach((name, i, arr) => {
    if (i === arr.length - 1) return
    const proxy = proxiesMap[name]
    const upStream = arr[i + 1]
    if (!proxy) throw \`错误：当前配置内未找到节点 \${name}\`
    proxy['dialer-proxy'] = upStream
  })`
        }
        return `const onGenerate = async (config) => {
  ${configScript}
  return config
}`.replace(/^\s*$(?:\r\n?|\n)/gm, '')
      }

      const displayConfigScript = (configScript) => {
        const previewComponent = defineComponent({
          template: `
          <div>
            <Card class="mt-8">
              <CodeViewer
                v-model="code"
                editable
                lang="javascript"
              />
            </Card>
          </div>
          `,
          setup() {
            return {
              code: ref(configScript)
            }
          }
        })
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

      return { relayList, relayConfigGenerate, handleRelayList, configScriptGenerate, displayConfigScript }
    }
  })

  const modal = Plugins.modal({
    title: '链式代理列表',
    submit: false,
    cancelText: '关闭',
    component: h(component),
    afterClose: () => {
      modal.destroy()
    }
  })

  return modal
}

