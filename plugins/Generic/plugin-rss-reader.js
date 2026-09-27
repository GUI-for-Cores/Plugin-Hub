import Parser from 'https://esm.sh/rss-parser@3.13.0'

const PATH = 'data/third/rss-reader'
const SUB_PATH = PATH + '/subs.json'
const READ_PATH = PATH + '/read_ids.json'

/** @type { EsmPlugin } */
export default (Plugin) => {
  const onRun = async () => {
    openUI()
  }

  const openUI = () => {
    const { ref, resolveComponent, onMounted } = Vue
    const subs = ref([])
    const readIds = ref(new Set())

    const component = {
      template: /*template*/ `
      <div class="flex h-full">
        <div style="width: 40%" class="h-full flex flex-col">
          <!-- 导航 -->
          <div class="flex gap-8 overflow-x-auto shrink-0 pt-8">
            <Button
              v-for="sub in subs" :key="sub.title"
              @click="fetchSub(sub)"
              size="small"
              :type="active === sub ? 'primary' : 'normal'"
              >
              {{ sub.title }}
            </Button>
          </div>
          <!-- 文章列表 -->
          <div class="flex flex-col gap-8 flex-1 overflow-y-auto py-8 pr-8">
            <Empty v-if="!active.items?.length" description="文章列表为空" />
            <Button
              v-for="item in active.items"
              @click="preview(item)"
              :key="item.id"
              :type="item == article ? 'link' : isRead(item) ? 'text' : 'normal'"
              class="whitespace-pre-wrap"
            >
              {{ item.title }}
            </Button>
          </div>
        </div>

        <div style="width: 60%; border-left: 1px solid var(--divider-color)" class="px-8 overflow-y-auto h-full">
          <Empty v-if="!article" description="请选择一篇文章" />
          <div v-else class="leading-relaxed">
            <div class="text-14 font-bold py-8">{{ article.title }}</div>
            <div class="flex items-center justify-end">
              <Button @click="viewOriginal" type="link" icon="preview">查看原文</Button>
              <Button @click="jumpOriginal" type="link" icon="link">跳转原文</Button>
            </div>
            <MarkdownViewer :content="article.contentSnippet" />
            <Divider>没有更多内容了</Divider>
          </div>
        </div>
      </div>`,
      setup() {
        const active = ref({
          items: []
        })
        const article = ref()

        const fetchSub = async (sub) => {
          active.value = sub

          const res = await Plugins.HttpGet(sub.feedUrl)
          const parser = new Parser()
          const feed = await parser.parseString(res.body)
          Object.assign(sub, feed)
        }

        const preview = async (a) => {
          article.value = a

          readIds.value.add(a.id)
        }

        const viewOriginal = () => {
          openWebUI(article.value.link)
        }
        
        const jumpOriginal = () => {
          Plugins.OpenURI(article.value.link)
        }

        const isRead = (item) => {
          return readIds.value.has(item.id)
        }

        onMounted(() => {
          Plugins.ReadFile(SUB_PATH).then((txt) => {
            subs.value = JSON.parse(txt || '[]')
            if (subs.value[0]) {
              active.value = subs.value[0]
            }
          })
          Plugins.ReadFile(READ_PATH).then((txt) => {
            readIds.value = new Set(JSON.parse(txt || '[]'))
          })
        })

        return {
          subs,
          active,
          article,
          fetchSub,
          preview,
          isRead,
          readIds,
          viewOriginal,
          jumpOriginal
        }
      }
    }

    const m = Plugins.modal(
      {
        title: Plugin.name,
        width: '90',
        height: '90',
        py: 0,
        submit: false,
        maskClosable: true,
        cancelText: 'common.close',
        async beforeClose() {
          await Plugins.WriteFile(READ_PATH, JSON.stringify([...readIds.value]))
        }
      },
      {
        default: () => Vue.h(component),
        toolbar: () => [
          Vue.h(
            resolveComponent('Button'),
            {
              type: 'text',
              onClick: () => {
                openSubsUI(subs)
              }
            },
            () => '订阅源'
          )
        ]
      }
    )
    m.open()
  }

  const openSubsUI = (subs) => {
    const { ref } = Vue
    const list = ref(Plugins.deepClone(subs.value))

    const component = {
      template: /*template*/ `
      <div class="flex flex-col gap-8">
        <Empty v-if="!list.length" />
        <Card v-for="(item, index) in list" :key="item.id">
          <template #title-suffix>
            <Input v-model="item.title" editable placeholder="请输入名称" />
          </template>
          <template #extra>
            <Button @click="onDel(index)" icon="delete" type="text" />
          </template>
          <Input v-model="item.feedUrl" class="flex-1" placeholder="请输入链接" />
        </Card>
        <Button @click="onAdd" type="primary" icon="add">新 增</Button>
      </div>
      `,
      setup() {
        const onAdd = () => {
          list.value.push({
            title: '',
            feedUrl: '',
            items: []
          })
        }
        const onDel = (i) => {
          list.value.splice(i, 1)
        }
        return {
          list,
          onAdd,
          onDel
        }
      }
    }
    const m = Plugins.modal(
      {
        title: '订阅源管理',
        async onOk() {
          subs.value = list.value
          await Plugins.WriteFile(SUB_PATH, JSON.stringify(subs.value, null, 2))
        }
      },
      {
        default: () => Vue.h(component)
      }
    )
    m.open()
  }

  const openWebUI = (link) => {
    const component = {
      template: /*template*/ `
      <div class="h-full">
        <iframe
          src="${link}"
          allow="clipboard-read; clipboard-write"
          referrerpolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin"
          class="w-full h-full border-0"
          style="height: calc(100% - 6px)"
        />
      </div>
      `
    }
    const m = Plugins.modal(
      {
        title: '原文预览',
        width: '90',
        height: '90',
        maskClosable: true,
        submit: false,
        px: 0,
        py: 0,
        cancelText: 'common.close'
      },
      {
        default: () => Vue.h(component)
      }
    )
    m.open()
  }

  return { onRun }
}
