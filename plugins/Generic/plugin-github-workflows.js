/* 触发器 手动触发 */
const onRun = async () => {
  await openUI()
}

const openUI = () => {
  injectStyle()
  const component = {
    template: `
    <div class="flex flex-col gap-8 pb-8">
      <Empty v-if="repos.length === 0" description="请先配置插件，添加需要管理的仓库" />
      <Card v-for="repo in repos" :key="repo.repo" :title="repo.repo">
        <template #extra>
          <Button :loading="repo.loading" type="link" size="small" icon="refresh" @click="refreshRepo(repo)" />
        </template>
        <div class="flex gap-8 mb-8">
          <Button size="small" :type="repo.activeTab === 'workflows' ? 'primary' : 'default'" @click="handleTabChange(repo, 'workflows')">工作流</Button>
          <Button size="small" :type="repo.activeTab === 'runs' ? 'primary' : 'default'" @click="handleTabChange(repo, 'runs')">Runs</Button>
          <Button size="small" :type="repo.activeTab === 'artifacts' ? 'primary' : 'default'" @click="handleTabChange(repo, 'artifacts')">Artifacts</Button>
          <Button size="small" :type="repo.activeTab === 'releases' ? 'primary' : 'default'" @click="handleTabChange(repo, 'releases')">Release</Button>
          <Button size="small" :type="repo.activeTab === 'tags' ? 'primary' : 'default'" @click="handleTabChange(repo, 'tags')">Tag</Button>
        </div>

        <template v-if="repo.activeTab === 'workflows'">
          <div v-if="repo.tabLoading.workflows" class="text-12 mb-8">加载中...</div>
          <Empty v-if="repo.workflows.length === 0" />
          <div v-for="workflow in repo.workflows" :key="workflow.id" class="flex gap-4 items-center justify-between">
            <div class="flex items-center gap-8 ml-16">
              <div>-</div>
              <div class="w-8 h-8 rounded-full" :style="{ background: workflow.state === 'active' ? 'green' : 'red' }"></div>
              <div class="font-bold">{{ workflow.name }}</div>
            </div>
            <Button
              v-if="workflow.state === 'active'"
              :loading="loadingMap[repo.repo + ':workflow:' + workflow.id + ':0']"
              size="small"
              @click="handleToggleWorkflow(0, repo, workflow.id)"
            >
              禁用
            </Button>
            <Button
              v-else
              :loading="loadingMap[repo.repo + ':workflow:' + workflow.id + ':1']"
              size="small"
              @click="handleToggleWorkflow(1, repo, workflow.id)"
            >
              启用
            </Button>
          </div>
        </template>

        <template v-else-if="repo.activeTab === 'runs'">
          <div v-if="repo.tabLoading.runs" class="text-12 mb-8">加载中...</div>
          <div class="flex gap-8 items-center mb-8">
            <Button size="small" @click="selectAllRuns(repo)">全选</Button>
            <Button size="small" @click="clearRunSelection(repo)">清空</Button>
            <Button size="small" :loading="loadingMap[repo.repo + ':runs:batch']" @click="handleBatchDeleteRuns(repo)">
              批量删除
            </Button>
            <Tag size="small">{{ repo.selectedRunIds.length }} 项</Tag>
          </div>
          <Empty v-if="repo.runs.length === 0" />
          <div v-for="run in repo.runs" :key="run.id" class="flex gap-4 items-center justify-between">
            <div class="flex items-start gap-8 ml-16">
              <label class="repo-check">
                <input
                  type="checkbox"
                  :checked="repo.selectedRunIds.includes(run.id)"
                  @change="toggleRunSelection(repo, run.id, $event.target.checked)"
                />
                <span class="repo-check-box"></span>
              </label>
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-8">
                  <div>-</div>
                  <div class="font-bold">{{ run.displayTitle }}</div>
                  <Tag size="small" :color="getRunStatusColor(run)">{{ run.statusLabel }}</Tag>
                  <Tag v-if="run.conclusion" size="small">{{ run.conclusion }}</Tag>
                </div>
                <div class="text-12">
                  #{{ run.run_number }} {{ run.head_branch || '-' }} {{ run.event || '-' }} {{ formatTime(run.created_at) }}
                </div>
                <div class="text-12">
                  {{ run.name || '-' }} {{ run.head_sha ? run.head_sha.slice(0, 7) : '-' }}
                </div>
              </div>
            </div>
            <div class="flex gap-4">
              <Button size="small" @click="openUrl(run.html_url)">查看</Button>
              <Button
                size="small"
                :loading="loadingMap[repo.repo + ':run:' + run.id]"
                @click="handleDeleteRun(repo, run)"
              >
                删除
              </Button>
            </div>
          </div>
        </template>

        <template v-else-if="repo.activeTab === 'artifacts'">
          <div v-if="repo.tabLoading.artifacts" class="text-12 mb-8">加载中...</div>
          <div class="flex gap-8 items-center mb-8">
            <Button size="small" @click="selectAllArtifacts(repo)">全选</Button>
            <Button size="small" @click="clearArtifactSelection(repo)">清空</Button>
            <Button size="small" :loading="loadingMap[repo.repo + ':artifacts:batch']" @click="handleBatchDeleteArtifacts(repo)">
              批量删除
            </Button>
            <Tag size="small">{{ repo.selectedArtifactIds.length }} 项</Tag>
          </div>
          <Empty v-if="repo.artifacts.length === 0" />
          <div v-for="artifact in repo.artifacts" :key="artifact.id" class="flex gap-4 items-center justify-between">
            <div class="flex items-start gap-8 ml-16">
              <label class="repo-check">
                <input
                  type="checkbox"
                  :checked="repo.selectedArtifactIds.includes(artifact.id)"
                  @change="toggleArtifactSelection(repo, artifact.id, $event.target.checked)"
                />
                <span class="repo-check-box"></span>
              </label>
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-8">
                  <div>-</div>
                  <div class="font-bold">{{ artifact.name || ('Artifact #' + artifact.id) }}</div>
                  <Tag v-if="artifact.expired" size="small">Expired</Tag>
                </div>
                <div class="text-12">
                  {{ formatBytes(artifact.size_in_bytes) }} {{ formatTime(artifact.created_at) }} {{ artifact.workflow_run && artifact.workflow_run.head_branch ? artifact.workflow_run.head_branch : '-' }}
                </div>
                <div class="text-12">
                  Run #{{ artifact.workflow_run && artifact.workflow_run.id ? artifact.workflow_run.id : '-' }}
                </div>
              </div>
            </div>
            <div class="flex gap-4">
              <Button v-if="artifact.run_html_url" size="small" @click="openUrl(artifact.run_html_url)">关联 Run</Button>
              <Button
                size="small"
                :loading="loadingMap[repo.repo + ':artifact:' + artifact.id]"
                @click="handleDeleteArtifact(repo, artifact)"
              >
                删除
              </Button>
            </div>
          </div>
        </template>

        <template v-else-if="repo.activeTab === 'releases'">
          <div v-if="repo.tabLoading.releases" class="text-12 mb-8">加载中...</div>
          <div class="flex gap-8 items-center mb-8">
            <Button size="small" @click="selectAllReleases(repo)">全选</Button>
            <Button size="small" @click="clearReleaseSelection(repo)">清空</Button>
            <Button size="small" :loading="loadingMap[repo.repo + ':releases:batch']" @click="handleBatchDeleteReleases(repo)">
              批量删除
            </Button>
            <Tag size="small">{{ repo.selectedReleaseIds.length }} 项</Tag>
          </div>
          <Empty v-if="repo.releases.length === 0" />
          <div v-for="release in repo.releases" :key="release.id" class="flex gap-4 items-center justify-between">
            <div class="flex items-start gap-8 ml-16">
              <label class="repo-check">
                <input
                  type="checkbox"
                  :checked="repo.selectedReleaseIds.includes(release.id)"
                  @change="toggleReleaseSelection(repo, release.id, $event.target.checked)"
                />
                <span class="repo-check-box"></span>
              </label>
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-8">
                  <div>-</div>
                  <div class="font-bold">{{ release.name || release.tag_name }}</div>
                  <Tag v-if="release.draft">Draft</Tag>
                  <Tag v-if="release.prerelease">Prerelease</Tag>
                </div>
                <div class="text-12">{{ release.tag_name }} {{ formatTime(release.published_at || release.created_at) }}</div>
              </div>
            </div>
            <div class="flex gap-4">
              <Button size="small" @click="openUrl(release.html_url)">查看</Button>
              <Button
                size="small"
                :loading="loadingMap[repo.repo + ':release:' + release.id]"
                @click="handleDeleteRelease(repo, release)"
              >
                删除
              </Button>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-if="repo.tabLoading.tags" class="text-12 mb-8">加载中...</div>
          <div class="flex gap-8 items-center mb-8">
            <Button size="small" @click="selectAllTags(repo)">全选</Button>
            <Button size="small" @click="clearTagSelection(repo)">清空</Button>
            <Button size="small" :loading="loadingMap[repo.repo + ':tags:batch']" @click="handleBatchDeleteTags(repo)">
              批量删除
            </Button>
            <Tag size="small">{{ repo.selectedTagNames.length }} 项</Tag>
          </div>
          <Empty v-if="repo.tags.length === 0" />
          <div v-for="tag in repo.tags" :key="tag.name" class="flex gap-4 items-center justify-between">
            <div class="flex items-start gap-8 ml-16">
              <label class="repo-check">
                <input
                  type="checkbox"
                  :checked="repo.selectedTagNames.includes(tag.name)"
                  @change="toggleTagSelection(repo, tag.name, $event.target.checked)"
                />
                <span class="repo-check-box"></span>
              </label>
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-8">
                  <div>-</div>
                  <div class="font-bold">{{ tag.name }}</div>
                </div>
                <div class="text-12">{{ tag.commit && tag.commit.sha }}</div>
              </div>
            </div>
            <div class="flex gap-4">
              <Button size="small" @click="openUrl(tag.html_url)">查看</Button>
              <Button
                size="small"
                :loading="loadingMap[repo.repo + ':tag:' + tag.name]"
                @click="handleDeleteTag(repo, tag)"
              >
                删除
              </Button>
            </div>
          </div>
        </template>
      </Card>
    </div>
    `,
    setup() {
      const { ref } = Vue
      const loadingMap = ref({})
      const repos = ref(
        Plugin.RepoList.map((repo) => ({
          repo,
          activeTab: 'workflows',
          workflows: [],
          runs: [],
          artifacts: [],
          releases: [],
          tags: [],
          loadedTabs: {
            workflows: false,
            runs: false,
            artifacts: false,
            releases: false,
            tags: false
          },
          tabLoading: {
            workflows: false,
            runs: false,
            artifacts: false,
            releases: false,
            tags: false
          },
          selectedRunIds: [],
          selectedArtifactIds: [],
          selectedReleaseIds: [],
          selectedTagNames: [],
          loading: false
        }))
      )

      const refreshRepo = async (repo) => {
        repo.loading = true
        try {
          await loadTabData(repo, repo.activeTab, true)
        } catch (error) {
          Plugins.message.error(error.message || error)
        }
        repo.loading = false
      }

      repos.value.forEach((repo) => {
        loadTabData(repo, repo.activeTab).catch((error) => {
          Plugins.message.error(error.message || error)
        })
      })

      return {
        loadingMap,
        repos,
        refreshRepo,
        formatTime,
        formatBytes,
        openUrl(url) {
          url && Plugins.BrowserOpenURL(url)
        },
        getRunStatusColor,
        async handleTabChange(repo, tab) {
          repo.activeTab = tab
          try {
            await loadTabData(repo, tab)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
        },
        toggleRunSelection(repo, runId, checked) {
          repo.selectedRunIds = checked ? uniqueValues([...repo.selectedRunIds, runId]) : repo.selectedRunIds.filter((id) => id !== runId)
        },
        selectAllRuns(repo) {
          repo.selectedRunIds = repo.runs.map((run) => run.id)
        },
        clearRunSelection(repo) {
          repo.selectedRunIds = []
        },
        toggleArtifactSelection(repo, artifactId, checked) {
          repo.selectedArtifactIds = checked
            ? uniqueValues([...repo.selectedArtifactIds, artifactId])
            : repo.selectedArtifactIds.filter((id) => id !== artifactId)
        },
        selectAllArtifacts(repo) {
          repo.selectedArtifactIds = repo.artifacts.map((artifact) => artifact.id)
        },
        clearArtifactSelection(repo) {
          repo.selectedArtifactIds = []
        },
        toggleReleaseSelection(repo, releaseId, checked) {
          repo.selectedReleaseIds = checked ? uniqueValues([...repo.selectedReleaseIds, releaseId]) : repo.selectedReleaseIds.filter((id) => id !== releaseId)
        },
        toggleTagSelection(repo, tagName, checked) {
          repo.selectedTagNames = checked ? uniqueValues([...repo.selectedTagNames, tagName]) : repo.selectedTagNames.filter((name) => name !== tagName)
        },
        selectAllReleases(repo) {
          repo.selectedReleaseIds = repo.releases.map((release) => release.id)
        },
        clearReleaseSelection(repo) {
          repo.selectedReleaseIds = []
        },
        selectAllTags(repo) {
          repo.selectedTagNames = repo.tags.map((tag) => tag.name)
        },
        clearTagSelection(repo) {
          repo.selectedTagNames = []
        },
        async handleToggleWorkflow(action, repo, workflowId) {
          const loadingKey = `${repo.repo}:workflow:${workflowId}:${action}`
          loadingMap.value[loadingKey] = true
          try {
            if (action === 1) {
              await enableWorkflow(repo.repo, workflowId)
            } else {
              await disableWorkflow(repo.repo, workflowId)
            }
            await loadTabData(repo, 'workflows', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleBatchDeleteRuns(repo) {
          if (repo.selectedRunIds.length === 0) {
            Plugins.message.error('请先选择要删除的 Run')
            return
          }
          const ok = await Plugins.confirm('批量删除 Runs', `确定要删除 ${repo.repo} 中选中的 ${repo.selectedRunIds.length} 条运行记录吗？`).catch(() => false)
          if (!ok) return
          const loadingKey = `${repo.repo}:runs:batch`
          loadingMap.value[loadingKey] = true
          try {
            const results = await batchDeleteRuns(repo.repo, repo.selectedRunIds)
            repo.selectedRunIds = []
            Plugins.message.success(buildBatchResultMessage('Runs', results))
            await loadTabData(repo, 'runs', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleDeleteRun(repo, run) {
          const ok = await Plugins.confirm('删除 Run', `确定要删除 ${repo.repo} 的运行记录「#${run.run_number} ${run.displayTitle}」吗？`).catch(() => false)
          if (!ok) return
          const loadingKey = `${repo.repo}:run:${run.id}`
          loadingMap.value[loadingKey] = true
          try {
            await deleteRun(repo.repo, run.id)
            Plugins.message.success('Run 删除成功')
            await loadTabData(repo, 'runs', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleBatchDeleteArtifacts(repo) {
          if (repo.selectedArtifactIds.length === 0) {
            Plugins.message.error('请先选择要删除的 Artifact')
            return
          }
          const ok = await Plugins.confirm('批量删除 Artifacts', `确定要删除 ${repo.repo} 中选中的 ${repo.selectedArtifactIds.length} 个 Artifact 吗？`).catch(
            () => false
          )
          if (!ok) return
          const loadingKey = `${repo.repo}:artifacts:batch`
          loadingMap.value[loadingKey] = true
          try {
            const results = await batchDeleteArtifacts(repo.repo, repo.selectedArtifactIds)
            repo.selectedArtifactIds = []
            Plugins.message.success(buildBatchResultMessage('Artifacts', results))
            await loadTabData(repo, 'artifacts', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleDeleteArtifact(repo, artifact) {
          const ok = await Plugins.confirm('删除 Artifact', `确定要删除 ${repo.repo} 的 Artifact「${artifact.name || artifact.id}」吗？`).catch(() => false)
          if (!ok) return
          const loadingKey = `${repo.repo}:artifact:${artifact.id}`
          loadingMap.value[loadingKey] = true
          try {
            await deleteArtifact(repo.repo, artifact.id)
            Plugins.message.success('Artifact 删除成功')
            await loadTabData(repo, 'artifacts', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleBatchDeleteReleases(repo) {
          if (repo.selectedReleaseIds.length === 0) {
            Plugins.message.error('请先选择要删除的 Release')
            return
          }
          const ok = await Plugins.confirm('批量删除 Release', `确定要删除 ${repo.repo} 中选中的 ${repo.selectedReleaseIds.length} 个 Release 吗？`).catch(
            () => false
          )
          if (!ok) return
          const loadingKey = `${repo.repo}:releases:batch`
          loadingMap.value[loadingKey] = true
          try {
            const results = await batchDeleteReleases(repo.repo, repo.selectedReleaseIds)
            repo.selectedReleaseIds = []
            Plugins.message.success(buildBatchResultMessage('Release', results))
            await loadTabData(repo, 'releases', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleDeleteRelease(repo, release) {
          const ok = await Plugins.confirm('删除 Release', `确定要删除 ${repo.repo} 的 Release「${release.name || release.tag_name}」吗？`).catch(() => false)
          if (!ok) return
          const loadingKey = `${repo.repo}:release:${release.id}`
          loadingMap.value[loadingKey] = true
          try {
            await deleteRelease(repo.repo, release.id)
            Plugins.message.success('Release 删除成功')
            await loadTabData(repo, 'releases', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleBatchDeleteTags(repo) {
          if (repo.selectedTagNames.length === 0) {
            Plugins.message.error('请先选择要删除的 Tag')
            return
          }
          const ok = await Plugins.confirm('批量删除 Tag', `确定要删除 ${repo.repo} 中选中的 ${repo.selectedTagNames.length} 个 Tag 吗？`).catch(() => false)
          if (!ok) return
          const loadingKey = `${repo.repo}:tags:batch`
          loadingMap.value[loadingKey] = true
          try {
            const results = await batchDeleteTags(repo.repo, repo.selectedTagNames)
            repo.selectedTagNames = []
            Plugins.message.success(buildBatchResultMessage('Tag', results))
            await loadTabData(repo, 'tags', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
        },
        async handleDeleteTag(repo, tag) {
          const ok = await Plugins.confirm('删除 Tag', `确定要删除 ${repo.repo} 的 Tag「${tag.name}」吗？`).catch(() => false)
          if (!ok) return
          const loadingKey = `${repo.repo}:tag:${tag.name}`
          loadingMap.value[loadingKey] = true
          try {
            await deleteTag(repo.repo, tag.name)
            Plugins.message.success('Tag 删除成功')
            await loadTabData(repo, 'tags', true)
          } catch (error) {
            Plugins.message.error(error.message || error)
          }
          loadingMap.value[loadingKey] = false
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

const injectStyle = () => {
  const styleId = 'plugin-github-workflows-style'
  if (document.getElementById(styleId)) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .repo-check {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-top: 1px;
      cursor: pointer;
      flex: 0 0 auto;
    }

    .repo-check input {
      position: absolute;
      opacity: 0;
      inset: 0;
      margin: 0;
      cursor: pointer;
    }

    .repo-check-box {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid #b8c1cc;
      background: #fff;
      box-sizing: border-box;
      transition: all 0.15s ease;
      position: relative;
    }

    .repo-check input:hover + .repo-check-box {
      border-color: #4b89ff;
      box-shadow: 0 0 0 3px rgba(75, 137, 255, 0.12);
    }

    .repo-check input:checked + .repo-check-box {
      background: #4b89ff;
      border-color: #4b89ff;
    }

    .repo-check input:checked + .repo-check-box::after {
      content: '';
      position: absolute;
      left: 4px;
      top: 1px;
      width: 4px;
      height: 8px;
      border: solid #fff;
      border-width: 0 2px 2px 0;
      transform: rotate(45deg);
    }
  `
  document.head.appendChild(style)
}

const getHeaders = () => ({
  Authorization: Plugin.Token ? `Bearer ${Plugin.Token}` : undefined,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json'
})

const assertGithubStatus = (res, expectedStatus) => {
  if (res.status !== expectedStatus) {
    throw res.body?.message || `GitHub API 请求失败：${res.status}`
  }
}

const formatTime = (value) => {
  if (!value) return ''
  return Plugins.formatRelativeTime(value)
}

const formatBytes = (value) => {
  if (!value && value !== 0) return '-'
  return Plugins.formatBytes(value)
}

const formatRunItem = (run) => ({
  ...run,
  displayTitle: run.display_title || run.name || `Run #${run.run_number}`,
  statusLabel: run.status || 'unknown'
})

const formatArtifactItem = (repo, artifact) => ({
  ...artifact,
  run_html_url: artifact.workflow_run?.id ? `https://github.com/${repo}/actions/runs/${artifact.workflow_run.id}` : ''
})

const uniqueValues = (values) => [...new Set(values)]

const encodePath = (value) => value.split('/').map(encodeURIComponent).join('/')

const getRunStatusColor = (run) => {
  if (run.conclusion === 'success') return 'green'
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'cancelled') return 'red'
  if (run.status === 'in_progress' || run.status === 'queued' || run.status === 'requested' || run.status === 'waiting') return 'cyan'
  return 'primary'
}

const buildBatchResultMessage = (label, results) => {
  const success = results.filter((item) => item.ok).length
  const failure = results.length - success
  return failure === 0 ? `${label} 批量删除成功，共 ${success} 项` : `${label} 批量删除完成，成功 ${success}，失败 ${failure}`
}

const applyTabData = (repo, tab, data) => {
  if (tab === 'workflows') {
    repo.workflows = data
    return
  }
  if (tab === 'runs') {
    repo.runs = data
    repo.selectedRunIds = repo.selectedRunIds.filter((id) => data.some((run) => run.id === id))
    return
  }
  if (tab === 'artifacts') {
    repo.artifacts = data
    repo.selectedArtifactIds = repo.selectedArtifactIds.filter((id) => data.some((artifact) => artifact.id === id))
    return
  }
  if (tab === 'releases') {
    repo.releases = data
    repo.selectedReleaseIds = repo.selectedReleaseIds.filter((id) => data.some((release) => release.id === id))
    return
  }
  repo.tags = data
  repo.selectedTagNames = repo.selectedTagNames.filter((name) => data.some((tag) => tag.name === name))
}

const loadTabData = async (repo, tab, force = false) => {
  if (!force && repo.loadedTabs[tab]) return
  if (repo.tabLoading[tab]) return
  repo.tabLoading[tab] = true
  try {
    const data = await TAB_FETCHERS[tab](repo.repo)
    applyTabData(repo, tab, data)
    repo.loadedTabs[tab] = true
  } finally {
    repo.tabLoading[tab] = false
  }
}

const fetchRepoWorkflows = async (repo) => {
  const res = await Plugins.HttpGet(`https://api.github.com/repos/${repo}/actions/workflows`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 200)
  return res.body.workflows
}

const fetchRepoReleases = async (repo) => {
  const res = await Plugins.HttpGet(`https://api.github.com/repos/${repo}/releases?per_page=100`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 200)
  return res.body
}

const fetchRepoRuns = async (repo) => {
  const res = await Plugins.HttpGet(`https://api.github.com/repos/${repo}/actions/runs?per_page=100`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 200)
  return (res.body.workflow_runs || []).map(formatRunItem)
}

const fetchRepoArtifacts = async (repo) => {
  const res = await Plugins.HttpGet(`https://api.github.com/repos/${repo}/actions/artifacts?per_page=100`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 200)
  return (res.body.artifacts || []).map((artifact) => formatArtifactItem(repo, artifact))
}

const fetchRepoTags = async (repo) => {
  const res = await Plugins.HttpGet(`https://api.github.com/repos/${repo}/tags?per_page=100`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 200)
  return res.body.map((tag) => ({
    ...tag,
    html_url: `https://github.com/${repo}/tree/${encodePath(tag.name)}`
  }))
}

const enableWorkflow = async (repo, workflowId) => {
  const res = await Plugins.HttpPut(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/enable`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 204)
}

const disableWorkflow = async (repo, workflowId) => {
  const res = await Plugins.HttpPut(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/disable`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 204)
}

const deleteRun = async (repo, runId) => {
  const res = await Plugins.HttpDelete(`https://api.github.com/repos/${repo}/actions/runs/${runId}`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 204)
}

const deleteArtifact = async (repo, artifactId) => {
  const res = await Plugins.HttpDelete(`https://api.github.com/repos/${repo}/actions/artifacts/${artifactId}`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 204)
}

const deleteRelease = async (repo, releaseId) => {
  const res = await Plugins.HttpDelete(`https://api.github.com/repos/${repo}/releases/${releaseId}`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 204)
}

const deleteTag = async (repo, tagName) => {
  const res = await Plugins.HttpDelete(`https://api.github.com/repos/${repo}/git/refs/tags/${encodePath(tagName)}`, {
    ...getHeaders()
  })
  assertGithubStatus(res, 204)
}

const runBatchDelete = async (items, deleter, keyName) => {
  const settled = await Plugins.asyncPool(10, items, async (item) => {
    try {
      await deleter(item)
      return { [keyName]: item, ok: true }
    } catch (error) {
      return { [keyName]: item, ok: false, error }
    }
  })

  return settled
}

const batchDeleteReleases = async (repo, releaseIds) => runBatchDelete(releaseIds, (releaseId) => deleteRelease(repo, releaseId), 'id')

const batchDeleteRuns = async (repo, runIds) => runBatchDelete(runIds, (runId) => deleteRun(repo, runId), 'id')

const batchDeleteArtifacts = async (repo, artifactIds) => runBatchDelete(artifactIds, (artifactId) => deleteArtifact(repo, artifactId), 'id')

const batchDeleteTags = async (repo, tagNames) => runBatchDelete(tagNames, (tagName) => deleteTag(repo, tagName), 'name')

const TAB_FETCHERS = {
  workflows: fetchRepoWorkflows,
  runs: fetchRepoRuns,
  artifacts: fetchRepoArtifacts,
  releases: fetchRepoReleases,
  tags: fetchRepoTags
}
