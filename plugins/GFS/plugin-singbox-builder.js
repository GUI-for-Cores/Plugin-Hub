const SourceCodePath = 'data/.cache/sing-box-main'

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
            <Input v-model="compile_version" placeholder="例如: 1.14.0" class="w-full" />
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
                <div class="text-12">删除本地路径（提高安全性与一致性）</div>
              </div>
              <div class="ml-auto">
                <Switch v-model="compile_option_trimpath" />
              </div>
            </div>
            <div class="flex items-center mt-8">
              <div>
                <div class="text-18">-ldflags "-s -w"</div>
                <div class="text-12">去掉符号表与调试信息，显著减小体积</div>
              </div>
              <div class="ml-auto">
                <Switch v-model="compile_option_ldflags" />
              </div>
            </div>
            <div class="flex items-center mt-8">
              <div>
                <div class="text-18">CGO_ENABLED=1</div>
                <div class="text-12">启用CGO（某些特定功能可能需要）</div>
              </div>
              <div class="ml-auto">
                <Switch v-model="compile_option_cgo_enabled" />
              </div>
            </div>
          </Card>
        </template>
        <template #4>
          <div class="flex items-center gap-8">
            <Button @click="startCompile(true)">
              重新编译
            </Button>
            <Button @click="startCompile()" type="primary" class="flex-1">
              {{ compile_running ? '编译中...' : '开始编译' }}
            </Button>
            <Button @click="openDist">
              打开目录
            </Button>
          </div>
          <Card class="mt-8">
            <Empty v-if="compile_output.length === 0" class="py-32" />
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

      const enabled_tags = ref(
        new Set([
          // 'with_quic',
          // 'with_dhcp',
          // 'with_wireguard',
          'with_utls',
          // 'with_acme',
          'with_clash_api',
          'with_gvisor'
          // 'with_tailscale',
          // 'with_ccm',
          // 'with_ocm',
          // 'with_naive_outbound',
          // 'badlinkname',
          // 'tfogo_checklinkname0',
        ])
      )
      const singbox_tags = [
        {
          label: '启用 QUIC 支持（用于 Hysteria、TUIC、HTTP3 DNS、Naive 入站等）',
          value: 'with_quic'
        },
        {
          label: '启用标准 gRPC 支持（用于 V2Ray 传输等）',
          value: 'with_grpc'
        },
        {
          label: '启用 DHCP 支持（用于 DHCP DNS 传输）',
          value: 'with_dhcp'
        },
        {
          label: '启用 WireGuard 协议支持',
          value: 'with_wireguard'
        },
        {
          label: '启用 uTLS 支持（用于 TLS 出站指纹模拟）',
          value: 'with_utls'
        },
        {
          label: '启用 ACME 证书申请支持（用于自动化 TLS）',
          value: 'with_acme'
        },
        {
          label: '启用 Clash API 支持（用于支持外部控制面板）',
          value: 'with_clash_api'
        },
        {
          label: '启用 V2Ray API 支持（实验性功能）',
          value: 'with_v2ray_api'
        },
        {
          label: '启用 gVisor 支持（用于 Tun 入站和 WireGuard 出站的网络栈）',
          value: 'with_gvisor'
        },
        {
          label: '启用内置 Tor 支持（需要 CGO 环境）',
          value: 'with_embedded_tor'
        },
        {
          label: '启用 Tailscale 支持（作为 Tailscale 端点使用）',
          value: 'with_tailscale'
        },
        {
          label: '启用 Claude Code Multiplexer (CCM) 服务支持',
          value: 'with_ccm'
        },
        {
          label: '启用 OpenAI Codex Multiplexer (OCM) 服务支持',
          value: 'with_ocm'
        },
        {
          label: '启用 NaiveProxy 出站支持',
          value: 'with_naive_outbound'
        },
        {
          label: '启用 badlinkname（允许访问内部标准库函数，用于 kTLS 等底层操作）',
          value: 'badlinkname'
        },
        {
          label: '启用 tfogo_checklinkname0（用于绕过 Go 1.23+ 的 linkname 限制）',
          value: 'tfogo_checklinkname0'
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

        // 1. 添加 trimpath
        if (compile_option_trimpath.value) {
          args.push('-trimpath')
        }

        // 2. 处理 Tags
        const tags = Array.from(enabled_tags.value)
        if (tags.length) {
          args.push('-tags', tags.join(','))
        }

        // 3. 构建 ldflags
        let ldflagsParts = []
        if (compile_option_ldflags.value) {
          ldflagsParts.push('-s', '-w', '-buildid=')
        }
        // 注入版本号
        ldflagsParts.push(`-X github.com/sagernet/sing-box/constant.Version=${compile_version.value || 'unknown'}`)

        args.push('-ldflags', ldflagsParts.join(' '))

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
          await Plugins.RemoveFile(SourceCodePath)
          Plugins.UnzipZIPFile('data/.cache/sing-box-source-code.zip', 'data/.cache')
        },
        openDist() {
          Plugins.OpenDir(SourceCodePath)
        },
        async startCompile(force) {
          if (compile_running.value) return
          compile_running.value = true
          await Plugins.sleep(1000)
          const abs_path = await Plugins.AbsolutePath(SourceCodePath)
          await Plugins.ExecBackground(
            'go',
            ['build', '-v', ...(force ? ['-a'] : []), ...compile_args.value, './cmd/sing-box'],
            (out) => {
              compile_output.value.unshift(out)
            },
            async () => {
              const dir = await Plugins.ReadDir(SourceCodePath)
              if (dir.some((file) => file.name.startsWith('sing-box'))) {
                compile_output.value.unshift('-'.repeat(120))
                compile_output.value.unshift('编译完成，核心文件路径：' + SourceCodePath + '/sing-box*')
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
