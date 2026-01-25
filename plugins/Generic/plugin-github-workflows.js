/* 触发器 手动触发 */
const onRun = async () => {
  await openUI()
}

const openUI = () => {
  const component = {
    template: `
    <div class="flex flex-col gap-8 pb-8">
      <Empty v-if="repos.length === 0" description="请先配置插件，添加需要管理的仓库" />
      <Card v-for="repo in repos" :key="repo.repo" :title="repo.repo">
        <Empty v-if="repo.workflows.length === 0" />
        <template #extra>
          <Button :loading="repo.loading" type="link" size="small" icon="refresh" @click="refreshRepo(repo)" />
        </template>
        <div v-for="workflow in repo.workflows" :key="workflow.id" class="flex gap-4 items-center justify-between">
          <div class="flex items-center gap-8 ml-16">
            <div>-</div>
            <div class="w-8 h-8 rounded-full" :style="{ background: workflow.state === 'active' ? 'green' : 'red' }"></div>
            <div class="font-bold">{{ workflow.name }}</div>
          </div>
          <Button
            v-if="workflow.state === 'active'"
            :loading="loadingMap[workflow.id + '0']"
            size="small"
            @click="handleToggleWorkflow(0, repo, workflow.id)"
          >
            禁用
          </Button>
          <Button
            v-else
            :loading="loadingMap[workflow.id + '1']"
            size="small"
            @click="handleToggleWorkflow(1, repo, workflow.id)"
          >
            启用
          </Button>
        </div>
      </Card>
    </div>
    `,
    setup() {
      const { ref } = Vue
      const loadingMap = ref({})
      const repos = ref(Plugin.RepoList.map((repo) => ({ repo, workflows: [], loading: false })))

      const refreshRepo = async (repo) => {
        repo.loading = true
        try {
          repo.workflows = await fetchRepoWorkflows(repo.repo)
        } catch (error) {
          Plugins.message.error(error.message || error)
        }
        repo.loading = false
      }

      // 加载所有仓库工作流列表
      repos.value.forEach((repo) => {
        refreshRepo(repo)
      })

      return {
        loadingMap,
        repos,
        refreshRepo,
        async handleToggleWorkflow(action, repo, workflowId) {
          loadingMap.value[`${workflowId}${action}`] = true
          try {
            if (action === 1) {
              await enableWorkflow(repo.repo, workflowId)
            } else {
              await disableWorkflow(repo.repo, workflowId)
            }
            await refreshRepo(repo)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[`${workflowId}${action}`] = false
        }
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      submit: false,
      maskClosable: true,
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

const fetchRepoWorkflows = async (repo) => {
  const res = await Plugins.HttpGet(`https://api.github.com/repos/${repo}/actions/workflows`, {
    Authorization: Plugin.Token ? `Bearer ${Plugin.Token}` : undefined,
    'Content-Type': 'application/json'
  })
  if (res.status !== 200) {
    throw res.body.message
  }
  return res.body.workflows
}

const enableWorkflow = async (repo, workflowId) => {
  const res = await Plugins.HttpPut(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/enable`, {
    Authorization: `Bearer ${Plugin.Token}`,
    'Content-Type': 'application/json'
  })
  if (res.status !== 204) {
    throw res.body.message
  }
}

const disableWorkflow = async (repo, workflowId) => {
  const res = await Plugins.HttpPut(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/disable`, {
    Authorization: `Bearer ${Plugin.Token}`,
    'Content-Type': 'application/json'
  })
  if (res.status !== 204) {
    throw res.body.message
  }
}
