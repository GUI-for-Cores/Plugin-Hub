const PATH = 'data/third/' + Plugin.id
const TemplateFile = PATH + '/plugin-ui-template.html'
const Headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*'
}

/* 触发器 手动触发 */
const onRun = async () => {
  if (!(await Plugins.FileExists(TemplateFile))) {
    await Plugins.Download(
      'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/Resources/plugin-ui-dev-helper/plugin-ui-template.html',
      TemplateFile
    )
    Plugins.message.success('已下载插件UI开发模板文件至：' + TemplateFile)
  }
  createUIModal().open()
}

const createUIModal = () => {
  const component = {
    template: `
    <div style="font-family: 'Helvetica Neue', sans-serif; padding: 24px; color: #333;">
      <div v-if="loading" style="font-size: 18px; text-align: center;">
        启动中...
      </div>
    
      <div v-else-if="isRunning" style="max-width: 600px; margin: 0 auto;">
        <h2 style="font-size: 24px; margin-bottom: 12px; color: #2c3e50;">开发服务器运行中...</h2>
        <h4 style="font-size: 18px; margin-bottom: 8px;">使用步骤：</h4>
        <ol style="padding-left: 20px; line-height: 1.6;">
          <li>使用 VSCode 扩展 Live Server 启动插件模板文件</li>
          <li>使用浏览器打开模板文件预览地址（挂后台）</li>
          <li>修改模板文件并保存，查看此处 UI 更新</li>
        </ol>
        <Button 
          @click="handleStopDevServer" 
          style="margin-top: 20px; padding: 10px 20px; font-size: 16px; background-color: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer;"
        >
          停止开发服务器
        </Button>
      </div>
    
      <div v-else style="text-align: center;">
        <Button 
          @click="handleStartDevServer" 
          style="padding: 12px 24px; font-size: 18px; background-color: #2ecc71; color: white; border: none; border-radius: 6px; cursor: pointer;"
        >
          启动开发服务器
        </Button>
      </div>
    </div>
    `,
    setup() {
      const { ref, onMounted, onUnmounted } = Vue
      const loading = ref(false)
      const isRunning = ref(false)

      let previewModal
      /*
       * 启动开发服务器
       */
      const handleStartDevServer = async () => {
        if (!Plugin.Token) {
          Plugins.message.warn('请先配置开发Token，并填入开发模板文件内')
          return
        }
        loading.value = true
        try {
          await Plugins.StartServer('127.0.0.1:28888', Plugin.id, (req, res) => {
            console.log(`[${Plugin.name}]`, req)
            if (req.method === 'OPTIONS') {
              return res.end(200, Headers, 'okk')
            }
            if (req.headers.Authorization !== Plugin.Token) {
              Plugins.message.info('热更新请求鉴权失败，请检测Token配置！')
              return res.end(401, Headers, '鉴权失败')
            }
            if (req.url === '/api/render' && req.method === 'POST') {
              const { template, script } = JSON.parse(Plugins.base64Decode(req.body))
              const setup = new Function(`${script}; return setup`)
              const component = { template, setup: setup() }
              previewModal.open()
              previewModal.setComponent(Vue.h(component))
              res.end(200, Headers, '热更新成功')
            }
            res.end(200, Headers, '插件UI开发助手运行中...')
          })
          isRunning.value = true
          previewModal = Plugins.modal({
            title: 'UI预览',
            submit: false,
            cancelText: '关闭',
            maskClosable: true,
            component: Vue.h(component)
          })
        } catch (error) {
          isRunning.value = false
        }
        loading.value = false
      }

      /*
       * 停止开发服务器
       */
      const handleStopDevServer = async () => {
        await Plugins.StopServer(Plugin.id).catch(() => {})
        isRunning.value = false
        previewModal?.destroy()
      }

      onMounted(async () => {
        const list = await Plugins.ListServer()
        isRunning.value = list.includes(Plugin.id)
      })

      onUnmounted(() => {
        handleStopDevServer()
      })

      return {
        loading,
        isRunning,
        handleStartDevServer,
        handleStopDevServer
      }
    }
  }

  const modal = Plugins.modal({
    title: Plugin.name,
    submit: false,
    cancelText: '关闭',
    maskClosable: false,
    component: Vue.h(component),
    afterClose: () => {
      modal.destroy()
    }
  })

  return modal
}
