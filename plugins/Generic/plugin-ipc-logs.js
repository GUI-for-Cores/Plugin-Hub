window[Plugin.id] = window[Plugin.id] || {
  logs: Vue.ref([])
}

/* 触发器 手动触发 */
const onRun = async () => {
  openUI()
}

/* 触发器 APP就绪后 */
const onReady = async () => {
  hookWailsIPC()
}

const openUI = () => {
  const component = {
    template: `
    <Empty v-if="dataSource.length === 0" />
    <div v-else class="flex flex-col gap-4 pr-8 pb-8">
      <Card v-for="item in dataSource" :key="item.id">
        <div class="flex items-center py-8" @click="toggleExpanded(item.id)">
          <div class="text-14 font-bold">
            【{{ item.id }}】
          </div>
          <div class="flex items-center gap-8">
            <span class="text-16 font-bold">{{ item.name }}</span>
            <span :style="{color: item.success ? 'green' : 'red'}" class="text-12">{{ item.duration }}ms</span>
          </div>
          <div class="text-12 ml-auto">{{ formatTime(item.time) }}</div>
        </div>
        <div v-if="expandAll || expandedMap[item.id]" class="p-4 pt-0 select-text">
          <div class="flex items-center font-bold text-12 py-4">
            传参
            <Button @click="handleViewArgs(item)" class="ml-auto" size="small" type="link">查看</Button>
          </div>
          <div class="text-12">{{ JSON.stringify(item.args, null, 2) ?? '无' }}</div>
          <div class="flex items-center font-bold text-12 py-4">
            结果
            <Button @click="handleViewResult(item)" class="ml-auto" size="small" type="link">查看</Button>
          </div>
          <div class="text-12">{{ JSON.stringify(item.result, null, 2) ?? '无' }}</div>
        </div>
      </Card>
    </div>
    `,
    setup(_, { expose }) {
      const { ref, h, resolveComponent } = Vue

      const expandedMap = ref({})
      const expandAll = ref(false)
      const dataSource = window[Plugin.id].logs

      expose({
        modalSlots: {
          toolbar: () => [
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: () => {
                  expandAll.value = !expandAll.value
                  if (expandAll.value) {
                    dataSource.value.forEach((item) => {
                      expandedMap.value[item.id] = true
                    })
                  } else {
                    expandedMap.value = {}
                  }
                }
              },
              () => (expandAll.value ? '收起' : '展开')
            ),
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: () => {
                  dataSource.value.splice(0)
                  expandedMap.value = {}
                }
              },
              () => '清空日志'
            ),
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: () => {
                  const content = JSON.stringify(dataSource.value, null, 2)
                  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${Plugins.APP_TITLE}_${Plugins.APP_VERSION}_${Plugins.formatDate(Date.now(), 'YYYYMMDDHHmmss')}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }
              },
              () => '导出日志'
            )
          ],
          action: () => h('div', { class: 'mr-auto text-12' }, '注：日志包含敏感信息，请勿随意分享！')
        }
      })

      return {
        dataSource,
        expandAll,
        expandedMap,
        formatTime(time) {
          return Plugins.formatDate(time, 'YYYY-MM-DD HH:mm:ss')
        },
        handleViewArgs(record) {
          Plugins.alert('参数', record.args)
        },
        handleViewResult(record) {
          Plugins.alert('结果', record.result)
        },
        toggleExpanded(id) {
          expandedMap.value[id] = !expandedMap.value[id]
        }
      }
    }
  }

  const modal = Plugins.modal({
    title: Plugin.name,
    submit: false,
    cancelText: 'common.close',
    width: '90',
    height: '90',
    maskClosable: true,
    afterClose() {
      modal.destroy()
    }
  })

  modal.setContent(component)
  modal.open()
}

const hookWailsIPC = async () => {
  const originalInvoke = window.WailsInvoke
  window.WailsInvoke = (e) => {
    originalInvoke(e)
    if (e.startsWith('C')) {
      const { name, args, callbackID } = JSON.parse(e.slice(1))
      const log = {
        id: window[Plugin.id].logs.value.length,
        name,
        args,
        time: Date.now(),
        duration: 0,
        success: true,
        result: 'Loading...'
      }
      window[Plugin.id].logs.value.unshift(log)
      const { resolve, reject } = wails.callbacks[callbackID]
      wails.callbacks[callbackID].resolve = (e) => {
        log.result = e
        log.duration = Date.now() - log.time
        log.success = e?.flag ?? true
        resolve(e)
      }
      wails.callbacks[callbackID].reject = (e) => {
        log.result = e
        log.duration = Date.now() - log.time
        log.success = false
        reject(e)
      }
    }
  }
}
