# sing-box-lx 核心与 XHTTP

适用于 GUI.for.SingBox。上游核心：<https://github.com/Leadaxe/sing-box-lx>。

## 本地试用

1. 在 GUI 的插件页面添加**文件类型**插件，选择本仓库的 `plugins/GFS/plugin-sing-box-lx.js`，或把该文件复制到 GUI 的 `data/plugins/plugin-sing-box-lx.js`。
2. 添加「手动触发」「APP 就绪后」「更新订阅时」「启动核心前」四个触发器。本地文件插件的 ID 可由 GUI 自动生成。未添加配置项时，代码默认使用正式版、启用 XHTTP 订阅适配、不在启动时检查更新；如需在配置界面切换，参照 `plugins/gfs.json` 中 `plugin-sing-box-lx` 的三个配置项添加。
3. 将插件拖到「节点转换」**之前**。停用「Xray 前置代理」，重新更新相关订阅；旧的本地 SOCKS 占位节点不能自动还原。
4. 运行插件，选择「安装 / 更新核心」。下载、版本和构建标签检查、配置检查完成后才替换核心；核心原本在运行时会停止并重新启动。
5. 也可以使用插件右键菜单。如果客户端手动添加文件插件时未配置菜单，运行按钮提供相同操作。

本地试用不要使用尚未合并的官方 raw URL。正式的目录项保留 `GUI-for-Cores/Plugin-Hub/main` URL，合并后才可由官方插件中心下载；发布前可改用自己 Fork 中对应文件的 raw URL。

## 核心管理

- 从 GitHub Releases 查询正式版，或按发布时间选择包含预发布的最新版本。使用完整 `-lx.*` 版本标识。
- 自动选择 Windows、Linux、macOS 对应架构的发布附件。不推测不存在的资源；Windows 32 位允许上游的 Windows 7 legacy 附件。
- 使用附件 digest 或 `SHA256SUMS` 验证下载文件；没有 SHA256 时拒绝安装。
- 检查 `sing-box version` 的版本、`with_xhttp` 和 `with_clash_api` 标签，并执行最小 XHTTP 配置与当前选中配置的 `sing-box check`。依赖文件检查以当前 GUI 数据目录为基准。
- Windows 包里的 `libcronet.dll` 与可执行文件一起备份、更新和恢复。
- 保留首次安装前的原文件和前一个 lx 版本。更新/回滚失败时恢复切换前的文件；恢复失败保留日志，阻止核心继续启动。
- 禁用、卸载或「恢复原核心」会停止核心并恢复首次备份，随后保持停止。原配置中的 XHTTP 和其他 lx 扩展应先移除或切换到兼容配置，再手动启动原核心。
- 同时只接管一个 GUI 分支。切换 main/alpha 后，XHTTP 配置必须使用已接管分支；如需接管另一分支，应先恢复原核心。Windows 两个分支共用核心目录中的 `libcronet.dll`，安装确认框会提示此事。
- GUI 设置页自带的更新按钮仍下载 SagerNet 官方核心；请通过本插件更新 lx。检测到文件被其他操作修改时，启动钩子会报错，要求重新安装或恢复。
- Linux/macOS 会设置执行权限；原有的 Linux capabilities 或 macOS root/setuid 授权不保证保留。需要 TUN 时，停止核心后通过插件的「授予 TUN 权限」重新授权；恢复原核心后则使用 GUI 设置页重新授权。Windows 使用 GUI 的管理员模式。
- 启动检查和计划任务只提示更新，不会自动替换核心或断开连接。

数据目录：

```text
data/third/sing-box-lx/
  state.json           当前版本、前一版本和原始备份记录
  transaction.json     仅切换期间存在的恢复日志
  original/            首次接管前的核心和 DLL
  rollback/            最近一次操作前的文件快照
  releases/            当前及上一 lx 版本的已校验文件
data/.cache/sing-box-lx/
                       下载、解压和配置检查临时文件
```

不要在处理失败时手动删除 `original` 或 `transaction.json`。重启 GUI 后运行「恢复中断操作」即可恢复切换前的文件和记录。如果日志或备份损坏，保留整个目录，再手动恢复。

## XHTTP 订阅适配

支持以下输入：

- GUI 已识别的 Base64 URI 订阅，其中的 VLESS、Trojan 标准 URI 和 VMess JSON/Base64 URI。
- VLESS 也支持 Shadowrocket 导出形式：Base64 编码的 `none:UUID@服务器:端口`，以及 `obfs=xhttp`、`tls=1`、`peer`、`obfsParam`、`fingerprint`、`remarks` 参数。转换时会分别还原 UUID、XHTTP、TLS/SNI、Host、uTLS 指纹与节点名称。
- Clash YAML 中 `network: xhttp` / `splithttp`，协议为 VLESS、VMess 或 Trojan。
- 原生 sing-box-lx JSON 出站节点，包括手动订阅。`splithttp` 会规范为 `xhttp`。

单条分享链接也可先由 GUI 或订阅源包装为 Base64，插件本身不绕过 GUI 的订阅格式识别流程。

普通节点通过现有「节点转换」的 `onSubscribe` 转换，随后和 XHTTP 节点组成统一的 sing-box 数组；不动态加载额外脚本。全 XHTTP 或原生 JSON 订阅不需要转换器。插件会保留节点名及可匹配的原始顺序，并校验转换器返回值。

保留 TLS、REALITY 公钥/short ID/指纹、ALPN、VLESS encryption 等参数。Xray 的 camelCase、Clash 的 kebab-case XHTTP 参数转换为 lx 的 snake_case，包括范围字段、XMUX、headers 和 session/seq 等参数。`extra` 中未知或 lx 未支持的字段会明确报错，而不是丢弃设置后继续连接。

Clash XHTTP 节点支持 `ech-opts`：`enable` 转换为 `tls.ech.enabled`；`config` 的 Base64 ECHConfigList 包装为 sing-box 所需的 `ECH CONFIGS` PEM；`query-server-name` 转换为 `tls.ech.query_server_name`，不改变原 TLS SNI。省略或留空 `config` 时由核心通过 DNS HTTPS 记录获取 ECH 配置；省略 `enable` 时默认关闭，与 Mihomo 一致。显式关闭 ECH 时忽略其配置内容。

```yaml
tls: true
servername: inner.example.com
ech-opts:
  enable: true
  query-server-name: ech.example.com
  # config: "订阅提供的 Base64 ECHConfigList" # 可选；有值时优先使用静态配置
```

ECH 需要 TLS，不能与 REALITY 同时启用；无效的 Base64、字段类型或未知 ECH 字段会报错。更新插件后需重新加载插件或重启 GUI，再更新订阅，已有节点不会自动重建。字段依据：[Mihomo ECHOptions](https://github.com/MetaCubeX/mihomo/blob/Meta/adapter/outbound/ech.go)、[lx ECH 解析](https://github.com/Leadaxe/sing-box-lx/blob/lx/common/tls/ech.go)。

限制：

- 不支持 Xray `downloadSettings`、REALITY `pqv` / `spiderX` 等 lx 未支持的特性。含这些必需参数的节点应使用其他实现。
- Clash 的 `smux`、`dialer-proxy`、`ip-version`、`interface-name`、`routing-mark` 暂不自动映射到 lx 出站字段；请改用原生 JSON。
- URI 的 ECH、证书固定参数，以及 Clash 的证书指纹、自定义 CA、客户端证书尚未映射，遇到时会报错。避免丢失 TLS 校验要求，请使用原生 JSON。
- URI 的其他协议和非标准 VMess 分享格式不由本插件扩展解析。
- 核心更新不等于 GUI 的节点编辑界面新增 XHTTP 专用表单；请通过订阅或原生 JSON 管理这些字段。

### 节点导入后 UUID 为空或缺少 XHTTP

如果源链接使用 `obfs=xhttp` 和 Base64 编码的完整连接信息，v1.0.0 的转换器无法识别这种 Shadowrocket 导出格式，可能交由普通转换器生成缺少 UUID 和 transport 的节点。v1.0.1 已补充解析。

更新本地插件脚本后，需要重新加载插件或重启 GUI，再更新原来的文件订阅。确认本插件启用了「更新订阅时」触发器，并位于「节点转换」之前。旧订阅结果不会仅因更新插件而自动重建。

重新生成后，节点应包含非空的 `uuid`、`transport.type: "xhttp"` 及源链接中的 path、Host、TLS 参数；随后重启核心并重新测试延迟。本次仅修复订阅解析，已安装 lx 核心时无须重新下载核心。配置检查通过只说明核心接受配置，远程节点是否连通仍需实际测试。

## 验证

```powershell
pnpm install --frozen-lockfile
pnpm exec prettier --check plugins/GFS/plugin-sing-box-lx.js plugins/gfs.json
node --check plugins/GFS/plugin-sing-box-lx.js
node --test tests/plugin-sing-box-lx.test.mjs
```

自动化测试使用内存文件系统与模拟 host API，不会下载或替换真实 GUI 核心。

如已下载并校验官方 Release，可额外使用真实核心检查生成的 VLESS、VMess、Trojan 配置和四种 XHTTP mode：

```powershell
$env:SING_BOX_LX_BINARY='C:\path\to\sing-box.exe'
node --test tests/plugin-sing-box-lx.test.mjs
```

该检查仅在临时目录执行 `version` 和 `check`，不启动代理或连接远程节点；未设置环境变量时跳过。

提交前还需在真实 GUI 验证：

1. Windows amd64 的首次安装、Release 更新和回滚；核对 EXE 与 DLL 同步切换。
2. 核心停止、运行、启动中时的菜单操作；取消确认和并发操作。
3. 原生 JSON、纯 XHTTP URI、混合 Base64、Clash YAML；普通节点与策略组引用保持正确。
4. VLESS + TLS / REALITY 的真实连接，以及 VMess/Trojan XHTTP 节点；测试四种 mode 和实际需要的 extra 参数。
5. 下载失败、SHA256 不符、配置检查失败、文件被占用和启动失败后的恢复。
6. 模拟中断后重启 GUI，验证恢复入口及启动拦截。
7. 使用 GUI 官方核心更新覆盖 lx 后的提示，以及禁用、卸载时恢复原文件。
8. Linux/macOS 解压、执行权限、TUN 重新授权；未验证的平台不得视为已通过。
