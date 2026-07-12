const STORAGE_PATH = `data/.cache/${Plugin.id}_repos.json`

/* 触发器 手动触发 */
const onRun = async () => {
  const component = {
    template: `
    <div class="flex flex-col h-full">
      <div class="flex gap-4 items-center">
        <Input
          v-model="input"
          class="flex-1 p-2"
          :border="false"
          @keydown.enter="handleAddRepo"
          placeholder="输入 owner/repo 或 owner/repo@branch（例如：vuejs/vue 或 vuejs/vue@main）进行添加">
        </Input>
        <Button @click="handleAddRepo" type="primary">添加</Button>
      </div>
  
      <div class="flex flex-wrap items-center gap-4 py-4">
        <Tag v-for="(repo, idx) in repos" :key="repo" @close="handleRemoveRepo(idx)" closeable size="small" class="flex items-center">
          <div @click="handleChange(repo)">{{ repo.name }}</div>
        </Tag>
      </div>

      <div class="flex-1 overflow-y-auto flex flex-col gap-8 p-8">
        <Empty v-if="repos.length === 0" description="暂无已添加的仓库" />
        <Button v-else-if="loading" loading />
        <Empty v-else-if="comments.length === 0" description="点击上方仓库获取提交记录" />
        <Card v-for="c in comments" :key="c.node_id" :subtitle="getMessage(c.commit.message)" :selected="c.selected">
          <template #title-suffix>
            <img :src="\`https://avatars.githubusercontent.com/u/\${c.author.id}?v=4&size=32\`" class="w-24 h-24 rounded-full mr-4" />
            {{ c.commit.author.name }} {{ formatTime(c.commit.committer.date) }}
          </template>
          <template #extra>
            <Button @click="handleView(c, c.html_url)" type="link" size="small">点击查看</Button>
          </template>
        </Card>
      </div>
    </div>
    `,
    setup() {
      const { ref, onMounted } = Vue

      const input = ref('')
      const loading = ref(false)
      const repos = ref([])
      const comments = ref([])

      async function loadRepos() {
        const content = await Plugins.ReadFile(STORAGE_PATH).catch(() => '')
        if (content) {
          try {
            repos.value = JSON.parse(content)
          } catch (e) {
            console.log(`[${Plugin.name}]`, '解析 repos.json 失败: ', e)
          }
        }
      }

      async function saveRepos() {
        try {
          await Plugins.WriteFile(STORAGE_PATH, JSON.stringify(repos.value, null, 2))
        } catch (e) {
          console.log(`[${Plugin.name}]`, '保存 repos.json 失败: ', e)
        }
      }

      async function fetchCommitsForRepo(repo) {
        // repo 可能是 "owner/repo" 或 "owner/repo@branch"
        const [fullRepo, branch = ''] = repo.split('@')
        const [owner, repoName] = fullRepo.split('/')

        const url = `https://api.github.com/repos/${owner}/${repoName}/commits?per_page=20${branch ? `&sha=${encodeURIComponent(branch)}` : ''}`
        const { status, body } = await Plugins.HttpGet(url, {
          Accept: 'application/vnd.github.v3+json',
          Authorization: Plugin.TOKEN_MODE === 'gui' ? Plugins.getGitHubApiAuthorization() : Plugin.TOKEN_MODE === 'plugin' ? `Bearer ${Plugin.TOKEN}` : ''
        })
        if (status < 200 || status >= 300) {
          throw new Error(`获取 ${repo} 提交失败，状态码 ${status}`)
        }
        return body
      }

      async function handleAddRepo() {
        const repo = input.value.trim()
        if (!repo) return
        repos.value.push({ name: repo, hash: '' })
        await saveRepos()
        input.value = ''
      }

      async function handleRemoveRepo(index) {
        repos.value.splice(index, 1)
        await saveRepos()
      }

      async function handleChange(repo) {
        comments.value = []
        loading.value = true
        try {
          const res = await fetchCommitsForRepo(repo.name)
          const lastHashIndex = res.findIndex((v) => v.sha === repo.hash)
          if (lastHashIndex !== -1) {
            res.forEach((comment, index) => {
              if (index >= lastHashIndex) {
                comment.selected = true
              }
            })
          }
          comments.value = res
          if (res[0]?.sha) {
            repo.hash = res[0]?.sha
            await saveRepos()
          }
        } catch (e) {
          Plugins.message.error(e.message || e)
        } finally {
          loading.value = false
        }
      }

      onMounted(() => loadRepos())

      return {
        loading,
        input,
        repos,
        comments,
        handleAddRepo,
        handleRemoveRepo,
        handleChange,
        formatTime(d) {
          return Plugins.formatRelativeTime(d)
        },
        handleView(c, url) {
          c.selected = true
          Plugins.BrowserOpenURL(url)
        },
        getMessage(msg) {
          return msg.split('\n')[0]
        }
      }
    }
  }

  const modal = Plugins.modal(
    {
      title: Plugin.name,
      maskClosable: true,
      submit: false,
      cancelText: 'common.close',
      width: '90',
      height: '90'
    },
    {
      default: () => Vue.h(component)
    }
  )

  modal.open()
}
