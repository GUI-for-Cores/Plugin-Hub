import Parser from 'https://esm.sh/rss-parser@3.13.0'

const PATH = 'data/third/rss-reader'
const SUB_PATH = PATH + '/subs.json'

/** @type { EsmPlugin } */
export default (Plugin) => {
  const onRun = async () => {
    openUI()
  }

  const openUI = () => {
    const { ref, resolveComponent, onMounted } = Vue
    const subs = ref([])

    const component = {
      template: /*template*/ `
      <div class="flex h-full">
        <div style="width: 40%" class="h-full flex flex-col">
          <!-- 导航 -->
          <div class="flex gap-8 overflow-x-auto shrink-0">
            <Button
              v-for="sub in subs" :key="sub.title"
              @click="fetchSub(sub)"
              :type="active === sub ? 'link' : 'text'"
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
              class="whitespace-pre-wrap"
            >
              {{ item.title }}
            </Button>
          </div>
        </div>

        <div style="width: 60%; border-left: 1px solid var(--divider-color)" class="px-8 overflow-y-auto h-full">
          <Empty v-if="!article" description="请选择一篇文章" />
          <div v-else class="leading-relaxed">
            <div class="text-18 font-bold py-8">{{ article.title }}</div>
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
        }

        onMounted(() => {
          Plugins.ReadFile(SUB_PATH).then((txt) => {
            subs.value = JSON.parse(txt || '[]')
          })
        })

        return {
          subs,
          active,
          article,
          fetchSub,
          preview
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
        cancelText: 'common.close'
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
        <Card v-for="(item, index) in list" :key="item.id">
          <template #title-suffix>
            <Input v-model="item.title" editable />
          </template>
          <template #extra>
            <Button @click="onDel(index)" icon="delete" type="text" />
          </template>
          <Input v-model="item.feedUrl" class="flex-1" />
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
        width: '90',
        height: '90',
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

  return { onRun }
}
