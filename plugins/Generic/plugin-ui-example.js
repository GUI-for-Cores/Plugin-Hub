const onRun = async () => {
  const ui = createUIModal()
  ui.open()
}

const createUIModal = () => {
  const { ref, h, defineComponent } = Vue

  const component = defineComponent({
    template: /* html */ `
    <div>
      <Card title="图标">
        <div class="flex" style="flex-wrap: wrap">
          <Icon v-for="icon in icons" :key="icon" :icon="icon" :size="24" />
        </div>
      </Card>
    
      <Card title="按钮" class="mt-8">
        <Button type="primary">主要按钮</Button>
        <Button>普通按钮</Button>
        <Button type="link">链接按钮</Button>
        <Button type="text">文本按钮</Button>
        <Button icon="refresh">图标按钮</Button>
        <Button size="small">小按钮</Button>
        <Button size="large">大按钮</Button>
      </Card>
    
      <Card title="标签" class="mt-8">
        <Tag>default</Tag>
        <Tag color="cyan">cyan</Tag>
        <Tag color="green">green</Tag>
        <Tag color="red">red</Tag>
        <Tag color="primary">primary</Tag>
        <Tag size="small">小标签</Tag>
      </Card>
    
      <Card title="其他组件" class="mt-8">
        <div class="flex items-center">
          多选：
          <CheckBox v-model="val1" :options="options" />
          单选：
          <Radio v-model="val2" :options="options" />
          <Dropdown :trigger="['hover']">
            <Button type="text">下拉菜单</Button>
            <template #overlay>
              <div><Button type="link">菜单1</Button></div>
              <div><Button type="link">菜单2</Button></div>
              <div><Button type="link">菜单3</Button></div>
            </template>
          </Dropdown>
        </div>
        <div class="flex items-center">
          下拉：
          <Select v-model="val7" :options="options" />
          开关：
          <Switch v-model="val8" />
          <Switch v-model="val9" border="square">另一种形态</Switch>
        </div>
      </Card>
    
      <Card title="输入" class="mt-8">
        <div class="flex items-center">
          输入框：
          <Input v-model="val3" placeholder="输入框" />
          输入列表：
          <InputList v-model="val4" placeholder="请输入" />
        </div>
        长文本输入：
        <CodeViewer
          v-model="val5"
          lang="javascript"
          editable
          placeholder="代码查看器，可通过editable属性设置为可编辑"
        />
        键值对输入：
        <KeyValueEditor v-model="val6" />
      </Card>
    
      <Card title="表格" class="mt-8">
        <Table :data-source="dataSource" :columns="columns" />
      </Card>
    </div>
    `,
    setup() {
      return {
        icons: [
          'link',
          'loading',
          'selected',
          'disabled',
          'pin',
          'pinFill',
          'minimize',
          'maximize',
          'maximize2',
          'close',
          'arrowLeft',
          'arrowDown',
          'arrowRight',
          'speedTest',
          'empty',
          'github',
          'forbidden',
          'telegram',
          'expand',
          'collapse',
          'refresh',
          'error',
          'reset',
          'folder',
          'restartApp',
          'log',
          'settings',
          'stop',
          'restart',
          'messageSuccess',
          'messageError',
          'messageWarn',
          'messageInfo',
          'pause',
          'play',
          'clear',
          'clear2',
          'drag',
          'more',
          'add',
          'filter',
          'edit',
          'delete',
          'file',
          'code',
          'overview',
          'profiles',
          'subscriptions',
          'rulesets',
          'plugins',
          'scheduledTasks',
          'settings2',
          'grant',
          'preview',
          'rollback'
        ],
        val1: ref(['1', '3']),
        val2: ref('1'),
        val3: ref(''),
        val4: ref(['输入值1', '输入值2']),
        val5: ref(''),
        val7: ref('1'),
        val8: ref(true),
        val9: ref(false),
        val6: ref({ plugin_name: Plugin.name, plugin_version: Plugin.version }),
        options: [
          { label: '选项1', value: '1' },
          { label: '选项2', value: '2' },
          { label: '选项3', value: '3' }
        ],
        columns: [
          { key: 'name', title: '插件名' },
          { key: 'version', title: '版本' },
          { key: 'downloads', title: '下载量' }
        ],
        dataSource: [
          { name: '插件1', version: 'v1.0.0', downloads: '99+' },
          { name: '插件2', version: 'v2.0.0', downloads: '99+' },
          { name: '插件3', version: 'v3.0.0', downloads: '99+' }
        ]
      }
    }
  })

  const modal = Plugins.modal({
    title: '自定义UI使用示例',
    component: h(component),
    afterClose: () => {
      modal.destroy()
    }
  })

  return modal
}
