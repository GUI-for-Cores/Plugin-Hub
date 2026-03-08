const onRun = async () => {
  const component = {
    template: `
    <div class="pr-8">
      <Tabs v-model:active-key="currentKey" :items="tabs" tabPosition="top">
        <template #1>
          <Card title="Go环境" :selected="!!go_version">
            <div>
              sing-box采用Go语言编写，此环境必不可少。
            </div>
            <div v-if="go_version">
              已检测到: {{ go_version }}
            </div>
            <div v-else class="flex flex-col p-8">
              <div class="flex items-center gap-8">
                <Button @click="recheckGoVersion(true)" type="link" class="ml-auto">
                  重新检测环境
                </Button>
                <Button @click="goUrl" type="link">
                  点击去安装
                </Button>
              </div>
            </div>
          </Card>
        </template>
        <template #2>
          <Card title="下载源码">
            <div class="flex flex-col">
              <div>注：此插件目前只支持稳定版分支编译。</div>
              <div v-if="source_code">
                <div>你已下载源码文件，点击下方按钮可重新下载最新源码</div>
              </div>
              <div class="flex flex-col p-8">
                <Button @click="downloadMain" type="link">
                  {{ source_code_status || '下载源码' }}
                </Button>
              </div>
            </div>
          </Card>
        </template>
        <template #3>
          <Card title="版本号">
            <Input v-model="compile_version" placeholder="x.y.z" class="w-full" />
          </Card>
          <Card title="特性支持" class="mt-8">
            <div class="flex flex-col gap-4">
              <div v-for="tag in singbox_tags" :key="tag.value" class="flex items-center">
                <div>
                  <div class="text-18">{{ tag.value }}</div>
                  <div class="text-12">{{ tag.label }}</div>
                </div>
                <div class="ml-auto">
                  <Switch :modelValue="enabled_tags.has(tag.value)" @change="v => v ? enabled_tags.add(tag.value) : enabled_tags.delete(tag.value)" />
                </div>
              </div>
            </div>
          </Card>
          <Card title="编译优化" class="mt-8">
            <div class="flex items-center">
              <div>
                <div class="text-18">-trimpath</div>
                <div class="text-12">删除本地路径</div>
              </div>
              <div class="ml-auto">
                <Switch v-model="compile_option_trimpath" />
              </div>
            </div>
            <div class="flex items-center mt-8">
              <div>
                <div class="text-18">-ldflags "-s -w"</div>
                <div class="text-12">去掉symbol table与DWARF调试信息，减少二进制体积</div>
              </div>
              <div class="ml-auto">
                <Switch v-model="compile_option_ldflags" />
              </div>
            </div>
            <div class="flex items-center mt-8">
              <div>
                <div class="text-18">CGO_ENABLED=1</div>
                <div class="text-12">启用CGO</div>
              </div>
              <div class="ml-auto">
                <Switch v-model="compile_option_cgo_enabled" />
              </div>
            </div>
          </Card>
        </template>
        <template #4>
          <Button @click="startCompile" type="primary" class="w-full">
            {{ compile_running ? '编译中...' : '开始编译' }}
          </Button>
          <Card class="mt-8">
            <Empty v-if="compile_output.length === 0" />
            <div v-else class="flex flex-col text-12 overflow-auto" style="height: 300px">
              <div v-for="out in compile_output" :key="out">{{ out }}</div>
            </div>
          </Card>
        </template>
      </Tabs>
    </div>
    `,
    setup() {
      const { ref, computed, onMounted } = Vue

      const currentKey = ref('1')
      const tabs = [
        { key: '1', tab: '1.编译环境' },
        { key: '2', tab: '2.源码下载' },
        { key: '3', tab: '3.核心定制' },
        { key: '4', tab: '4.开始编译' }
      ]

      const enabled_tags = ref(new Set(['with_gvisor', 'with_quic', 'with_utls', 'with_clash_api']))
      const singbox_tags = [
        {
          label: '启用 gVisor 网络栈（用户态 TCP/IP），用于 TUN 模式隔离与增强兼容性',
          value: 'with_gvisor'
        },
        {
          label: '启用 QUIC 协议支持（HTTP/3、Hysteria、TUIC 等依赖）',
          value: 'with_quic'
        },
        {
          label: '启用 DHCP 支持，用于 TUN 自动获取网络配置',
          value: 'with_dhcp'
        },
        {
          label: '启用 WireGuard 协议支持，可作为 inbound 或 outbound',
          value: 'with_wireguard'
        },
        {
          label: '启用 uTLS（模仿真实浏览器 TLS 指纹以绕过检测）',
          value: 'with_utls'
        },
        {
          label: '启用 ACME 自动证书申请（Let’s Encrypt 自动 TLS）',
          value: 'with_acme'
        },
        {
          label: '启用 Clash API 兼容接口（供 Clash Dashboard / 面板控制）',
          value: 'with_clash_api'
        },
        {
          label: '启用 Tailscale 集成（基于 WireGuard 的 mesh VPN 网络）',
          value: 'with_tailscale'
        },
        {
          label: '启用 CCM（Common Certificate Manager 证书管理模块）',
          value: 'with_ccm'
        },
        {
          label: '启用 OCM（Outbound Connection Manager 出站连接管理模块）',
          value: 'with_ocm'
        },
        {
          label: '启用 NaiveProxy outbound（支持 naiveproxy 协议出站）',
          value: 'with_naive_outbound'
        },
        {
          label: '使用 purego 实现（纯 Go 调用系统库，减少 CGO 依赖）',
          value: 'with_purego'
        }
      ]

      const compile_running = ref(false)
      const compile_output = ref([])
      const compile_args = computed(() => {
        const args = []
        if (compile_option_trimpath.value) {
          args.push('-trimpath')
        }
        const tags = Array.from(enabled_tags.value)
        if (tags.length) {
          args.push('-tags')
          args.push(tags.join(','))
        }
        args.push('-ldflags')
        args.push(`-X github.com/sagernet/sing-box/constant.Version=${compile_version.value || ' '}${compile_option_ldflags.value ? ' -s -w -buildid=' : ''}`)
        return args
      })
      const compile_version = ref('')
      const compile_option_trimpath = ref(true)
      const compile_option_ldflags = ref(true)
      const compile_option_cgo_enabled = ref(false)

      const source_code = ref()
      const source_code_status = ref()

      function recheckSourceCode() {
        Plugins.FileExists('data/.cache/sing-box-source-code.zip').then((res) => {
          source_code.value = res
        })
      }

      const go_version = ref()
      function recheckGoVersion(showTips) {
        Plugins.Exec('go', ['version'])
          .then((v) => {
            go_version.value = v
          })
          .catch(() => {
            if (showTips) {
              Plugins.alert('提示', '如果你已安装，但是无法检测到环境，请重启此程序')
            }
          })
      }

      onMounted(() => {
        recheckGoVersion()
        recheckSourceCode()
      })

      return {
        currentKey,
        tabs,
        go_version,
        recheckGoVersion,
        source_code,
        source_code_status,
        singbox_tags,
        enabled_tags,
        compile_args,
        compile_version,
        compile_option_trimpath,
        compile_option_ldflags,
        compile_option_cgo_enabled,
        compile_output,
        compile_running,
        goUrl() {
          Plugins.OpenURI('https://go.dev/dl/')
        },
        async downloadMain() {
          if (source_code_status.value) return
          source_code_status.value = '下载中...'
          await Plugins.Download('https://github.com/SagerNet/sing-box/archive/refs/heads/main.zip', 'data/.cache/sing-box-source-code.zip', undefined, (p) => {
            source_code_status.value = Plugins.formatBytes(p)
          }).finally(() => {
            source_code_status.value = ''
            recheckSourceCode()
          })
          await Plugins.RemoveFile('data/.cache/sing-box-main')
          Plugins.UnzipZIPFile('data/.cache/sing-box-source-code.zip', 'data/.cache')
        },
        async startCompile() {
          if (compile_running.value) return
          compile_running.value = true
          await Plugins.sleep(1000)
          const abs_path = await Plugins.AbsolutePath('data/.cache/sing-box-main')
          await Plugins.ExecBackground(
            'go',
            ['build', '-v', ...compile_args.value, './cmd/sing-box'],
            (out) => {
              compile_output.value.unshift(out)
            },
            async () => {
              const dir = await Plugins.ReadDir('data/.cache/sing-box-main')
              if (dir.some((file) => file.name.startsWith('sing-box'))) {
                compile_output.value.unshift('-'.repeat(120))
                compile_output.value.unshift('编译完成，核心文件路径：' + 'data/.cache/sing-box-main/sing-box*')
                compile_output.value.unshift('-'.repeat(120))
              }
            },
            {
              Env: {
                CGO_ENABLED: compile_option_cgo_enabled.value ? '1' : '0'
              },
              Convert: true,
              WorkingDirectory: abs_path
            }
          )
            .catch((err) => {
              compile_output.value.unshift(err.message || err)
            })
            .finally(() => {
              compile_running.value = false
            })
        }
      }
    }
  }
  const modal = Plugins.modal(
    {
      title: Plugin.name,
      submit: false,
      width: '90',
      height: '90',
      cancelText: 'common.close',
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
