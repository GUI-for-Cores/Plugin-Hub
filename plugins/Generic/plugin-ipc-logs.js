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

/* 右键 - 清空日志 */
const ClearHistory = () => {
  window[Plugin.id].logs.value.splice(0)
  Plugins.message.success('common.success')
}

/* 右键 - 导出日志 */
const ExportLogs = () => {
  const content = JSON.stringify(window[Plugin.id].logs.value, null, 2)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${Plugins.APP_TITLE}_${Plugins.APP_VERSION}_${Plugins.formatDate(Date.now(), 'YYYYMMDDHHmmss')}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

const SecurelyExportLogs = () => {
  const list = Plugins.deepClone(window[Plugin.id].logs.value)
  const maskedLogs = []
  list.forEach((item) => {
    const { name, args } = item
    switch (name) {
      case 'bridge.App.ProcessMemory': {
        return
      }
      case 'bridge.App.ReadFile': {
        const [file] = args
        if (file === 'data/sing-box/config.json' || file === 'data/mihomo/config.yaml') {
          if (item.result.flag) {
            item.result.data = '【核心运行配置】已脱敏'
          }
        }
        if (file.startsWith('data/subscribes')) {
          if (item.result.flag) {
            item.result.data = '【订阅文件】已脱敏'
          }
        }
        break
      }
      case 'bridge.App.WriteFile': {
        const [file] = args
        if (file === 'data/user.yaml') {
          item.args[1] = '【用户设置】已脱敏'
        }
        if (file === 'data/profiles.yaml') {
          item.args[1] = '【配置索引】已忽略'
        }
        if (file === 'data/scheduledtasks.yaml') {
          item.args[1] = '【计划任务索引】已忽略'
        }
        if (file === 'data/plugins.yaml') {
          item.args[1] = '【插件索引】已忽略'
        }
        if (file === 'data/subscribes.yaml') {
          item.args[1] = '【订阅索引】已忽略'
        }
        if (file === 'data/rulesets.yaml') {
          item.args[1] = '【规则集索引】已忽略'
        }
        if (file.startsWith('data/.cache/tmp_subscription')) {
          item.args[1] = '【订阅缓存文件】已忽略'
        }
        if (file === 'data/sing-box/config.json' || file === 'data/mihomo/config.yaml') {
          item.args[1] = '【核心运行配置】已脱敏'
        }
        if (file.startsWith('data/subscribes')) {
          item.args[1] = '【订阅文件】已脱敏'
        }
        if (file.startsWith('data/plugins/plugin')) {
          item.args[1] = '【插件源码】已忽略'
        }
        break
      }
      case 'bridge.App.Requests': {
        const [method, url, header] = item.args
        const { subscribes } = Plugins.useSubscribesStore()
        if (subscribes.some((s) => s.url === url)) {
          item.args[1] = '【订阅链接】已脱敏'
          if (item.result.flag && item.result.status === 200) {
            item.result.body = '【订阅内容】已脱敏'
          }
        } else if (item.result.status >= 200 && item.result.status <= 299) {
          if (header['Authorization'] !== undefined) {
            header['Authorization'] = '【TOKEN】已忽略'
          }
          item.result.body = '【请求结果】已忽略'
        }
        break
      }
      case 'bridge.App.UpdateTrayAndMenus': {
        item.args[0] = '【托盘图标】已忽略'
        item.args[1] = '【托盘菜单】已忽略'
        break
      }
      case 'bridge.App.UpdateTrayMenus': {
        item.args[0] = '【托盘菜单项】已忽略'
        break
      }
    }
    maskedLogs.push(item)
  })
  const content = JSON.stringify(maskedLogs, null, 2)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${Plugins.APP_TITLE}_${Plugins.APP_VERSION}_${Plugins.formatDate(Date.now(), 'YYYYMMDDHHmmss')}-desensitized.txt`
  a.click()
  URL.revokeObjectURL(url)
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
            <span class="text-12">{{ item.description }}</span>
          </div>
          <div class="text-12 ml-auto">{{ formatTime(item.time) }}</div>
        </div>
        <div v-if="expandAll || expandedMap[item.id]" class="p-4 pt-0 select-text">
          <div class="flex items-center font-bold text-12 py-4">
            传参
            <Button @click="handleViewArgs(item)" class="ml-auto" size="small" type="link">查看</Button>
          </div>
          <div class="text-12 break-all">{{ JSON.stringify(item.args, null, 2) ?? '无' }}</div>
          <div class="flex items-center font-bold text-12 py-4">
            结果
            <Button @click="handleViewResult(item)" class="ml-auto" size="small" type="link">查看</Button>
          </div>
          <div class="text-12 break-all">{{ JSON.stringify(item.result, null, 2) ?? '无' }}</div>
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
                  ExportLogs()
                }
              },
              () => '完整导出'
            ),
            h(
              resolveComponent('Button'),
              {
                type: 'link',
                onClick: () => {
                  SecurelyExportLogs()
                }
              },
              () => '简洁导出(开发中)'
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

const getIPCDescription = (name, args) => {
  switch (name) {
    case 'bridge.App.Requests': {
      const [method, url] = args
      if (url === 'https://github.com/GUI-for-Cores/Ruleset-Hub/releases/download/latest/meta-full.json') {
        return '请求规则集中心列表'
      }
      if (url === 'https://github.com/GUI-for-Cores/Ruleset-Hub/releases/download/latest/sing-full.json') {
        return '请求规则集中心列表'
      }
      if (url === 'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/gfc.json') {
        return '请求插件中心【专用插件】列表'
      }
      if (url === 'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/gfs.json') {
        return '请求插件中心【专用插件】列表'
      }
      if (url === 'https://raw.githubusercontent.com/GUI-for-Cores/Plugin-Hub/main/plugins/generic.json') {
        return '请求插件中心【通用插件】列表'
      }
      if (url === 'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt') {
        return '请求测试版核心是否有更新'
      }
      if (url.startsWith('https://api.github.com/repos/SagerNet/sing-box/releases')) {
        return '请求测试版核心是否有更新'
      }
      if (url === 'https://api.github.com/repos/MetaCubeX/mihomo/releases/latest') {
        return '请求稳定版核心是否有更新'
      }
      if (url === 'https://api.github.com/repos/SagerNet/sing-box/releases/latest') {
        return '请求稳定版核心是否有更新'
      }
      const { subscribes } = Plugins.useSubscribesStore()
      const sub = subscribes.find((sub) => sub.url === url)
      if (sub) {
        return '请求更新订阅: ' + sub.name
      }
      return
    }
    case 'bridge.App.Download': {
      const [method, url] = args
      if (method === 'GET' && url.startsWith('https://github.com/SagerNet/sing-box/releases/download')) {
        return '下载核心压缩包'
      }
      if (method === 'GET' && url.startsWith('https://github.com/MetaCubeX/mihomo/releases/download')) {
        return '下载核心压缩包'
      }
      return
    }
    case 'bridge.App.ProcessInfo': {
      const [pid] = args
      return '获取进程名: ' + pid
    }
    case 'bridge.App.KillProcess': {
      const [pid] = args
      return '杀死进程: ' + pid
    }
    case 'bridge.App.FileExists': {
      const [file] = args
      if (file === 'data/mihomo/mihomo-alpha.exe.bak') {
        return '检测测试版核心是否有上一版本备份'
      }
      if (file === 'data/sing-box/sing-box-latest.exe.bak') {
        return '检测测试版核心是否有上一版本备份'
      }
      if (file === 'data/mihomo/mihomo.exe.bak') {
        return '检测稳定版核心是否有上一版本备份'
      }
      if (file === 'data/sing-box/sing-box.exe.bak') {
        return '检测稳定版核心是否有上一版本备份'
      }
      return
    }
    case 'bridge.App.AbsolutePath': {
      const [file] = args
      if (file === 'data/.cache/tasksch.xml') {
        return '获取自启动计划任务xml文件绝对路径'
      }
      return
    }
    case 'bridge.App.RemoveFile': {
      const [file] = args
      if (file === 'data/mihomo/cache.db') {
        return '删除核心缓存文件'
      }
      if (file === 'data/sing-box/cache.db') {
        return '删除核心缓存文件'
      }
      if (file === 'data/mihomo/pid.txt') {
        return '删除核心PID文件'
      }
      if (file === 'data/sing-box/pid.txt') {
        return '删除核心PID文件'
      }
      if (file === 'data/.cache/tasksch.xml') {
        return '创建自启动计划任务xml文件'
      }
      if (file.startsWith('data/plugins/plugin-')) {
        return '删除插件源码文件'
      }
      return
    }
    case 'bridge.App.ReadFile': {
      const [file] = args
      if (file === 'data/mihomo/pid.txt') {
        return '读取核心PID文件'
      }
      if (file === 'data/sing-box/pid.txt') {
        return '读取核心PID文件'
      }
      if (file === 'data/mihomo/config.yaml') {
        return '读取核心运行时配置'
      }
      if (file === 'data/sing-box/config.json') {
        return '读取核心运行时配置'
      }
      if (file.startsWith('data/subscribes/')) {
        return '读取订阅节点内容'
      }
      return
    }
    case 'bridge.App.WriteFile': {
      const [file, content] = args
      if (file === 'data/user.yaml') {
        return '保存用户设置'
      }
      if (file === 'data/profiles.yaml') {
        return '保存配置信息'
      }
      if (file === 'data/subscribes.yaml') {
        return '保存订阅信息'
      }
      if (file === 'data/rulesets.yaml') {
        return '保存规则集信息'
      }
      if (file === 'data/plugins.yaml') {
        return '保存插件信息'
      }
      if (file === 'data/scheduledtasks.yaml') {
        return '保存计划任务信息'
      }
      if (file === 'data/.cache/ruleset-list.json') {
        return '保存规则集中心列表'
      }
      if (file === 'data/.cache/plugin-list.json') {
        return '保存插件中心列表'
      }
      if (file === 'data/mihomo/config.yaml') {
        return '写入核心运行时配置'
      }
      if (file === 'data/sing-box/config.json') {
        return '写入核心运行时配置'
      }
      if (file === 'data/.cache/tasksch.xml') {
        return '保存自启动计划任务文件'
      }
      if (file.startsWith('data/plugins/plugin-')) {
        return '保存插件源码'
      }
      if (file.startsWith('data/subscribes/')) {
        return '保存订阅节点内容'
      }
      return
    }
    case 'bridge.App.MoveFile': {
      const [source, target] = args
      if (/^data\/(sing-box|mihomo)\/(sing-box-latest|mihomo-alpha)(\.exe)?\.bak$/.test(target)) {
        return '备份测试版核心'
      }
      if (/^data\/(sing-box|mihomo)\/(sing-box|mihomo)(\.exe)?\.bak$/.test(target)) {
        return '备份稳定版核心'
      }
      return
    }
    case 'bridge.App.UnzipZIPFile': {
      const [source] = args
      if (/^data\/\.cache\/(sing-box|mihomo)$/.test(source)) {
        return '解压核心压缩包到临时目录'
      }
      return
    }
    case 'bridge.App.RemoveFile': {
      const [path] = args
      if (/^\/\.cache\/(sing-box|mihomo)-(.*)\.(zip|tar\.gz|\.gz)/.test(path)) {
        return '删除更新核心时下载的压缩包'
      }
      if (/^data\/\.cache\/(sing-box|alpha)/.test(path)) {
        return '删除更新核心时的临时解压目录'
      }
      return
    }
    case 'bridge.App.MakrDir': {
      const [path] = args
      if (/^data\/(sing-box|mihomo)$/.test(path)) {
        return '创建核心工作目录'
      }
      return
    }
    case 'bridge.App.GetInterfaces': {
      return '获取本地网络接口列表'
    }
    case 'bridge.App.UpdateTrayAndMenus': {
      return '更新托盘图标和菜单'
    }
    case 'bridge.App.Exec': {
      const [cmd, [arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8]] = args
      if (cmd === 'reg') {
        if (arg1 === 'add') {
          if (arg2 === 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings') {
            if (arg4 === 'ProxyOverride') {
              return '设置系统代理忽略列表'
            }
            if (arg4 === 'ProxyServer') {
              if (arg6 === '') {
                return '清除系统代理服务器'
              }
              return '设置系统代理服务器'
            }
            if (arg4 === 'ProxyEnable') {
              if (arg8 === '0') {
                return '关闭系统代理'
              }
              return '开启系统代理'
            }
          }
        }
        if (arg1 === 'query') {
          if (arg2 === 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings') {
            if (arg4 === 'ProxyEnable') {
              return '查询系统代理开启状态'
            }
          }
          if (arg2 === 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers') {
            if (arg4.includes(Plugins.APP_TITLE)) {
              return '查询是否配置了以管理员身份运行'
            }
          }
        }
      }
      if (cmd === 'SchTasks' || cmd === 'Schtasks') {
        if (arg1 === '/Create') {
          return '创建自启动计划任务: ' + arg4
        }
        if (arg1 === '/Delete') {
          return '删除自启动计划任务: ' + arg4
        }
        if (arg1 === '/Query') {
          return '查询自启动计划任务: ' + arg3
        }
      }
      if (cmd === 'data/sing-box/sing-box-latest.exe') {
        if (arg1 === 'version') {
          return '查询本地测试版核心版本号'
        }
      }
      if (cmd === 'data/sing-box/sing-box.exe') {
        if (arg1 === 'version') {
          return '查询本地稳定版核心版本号'
        }
      }
      if (cmd === 'data/mihomo/mihomo.exe') {
        if (arg1 === '-v') {
          return '查询本地稳定版核心版本号'
        }
      }
      if (cmd === 'data/mihomo/mihomo-alpha.exe') {
        if (arg1 === '-v') {
          return '查询本地测试版核心版本号'
        }
      }
      return
    }
    case 'bridge.App.ExecBackground': {
      const [cmd, [arg1, arg2]] = args
      if (cmd === 'data/sing-box/sing-box-latest.exe') {
        if (arg1 === 'run') {
          return '运行内测版核心'
        }
      }
      if (cmd === 'data/sing-box/sing-box.exe') {
        if (arg1 === 'run') {
          return '运行稳定版核心'
        }
      }
      if (cmd === 'data/mihomo/mihomo.exe') {
        return '运行稳定版核心'
      }
      if (cmd === 'data/mihomo/mihomo-alpha.exe') {
        return '运行测试版核心'
      }
      return
    }
  }
}

const hookWailsIPC = async () => {
  const originalInvoke = window.WailsInvoke
  const blacklist = [':wails:WindowIsMaximised', ':wails:WindowIsMinimised']
  window.WailsInvoke = (e) => {
    originalInvoke(e)
    if (e.startsWith('C')) {
      const { name, args, callbackID } = JSON.parse(e.slice(1))
      if (blacklist.includes(name)) {
        return
      }
      const log = {
        id: window[Plugin.id].logs.value.length,
        name,
        args,
        description: getIPCDescription(name, args),
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
