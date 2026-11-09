# 配置模板中心 — 模板贡献指南

## 这是什么

本目录是「配置模板中心」插件的模板仓库。每个模板是一份**可直接运行的最终配置**
（GUI.for.SingBox 用 sing-box JSON，GUI.for.Clash 用 mihomo YAML）。
用户在插件里点「导入」，即可把模板转换成应用的托管配置，无需手动逐段抄写。

## 如何贡献一个模板（5 步）

1. **Fork 本仓库**（GUI-for-Cores/Plugin-Hub）。
2. **放置模板文件**：
   - sing-box 模板（JSON）放到 `gfs/` 目录，文件名即模板 ID，如 `gfs/config-my-template.json`；
   - mihomo 模板（YAML）放到 `gfc/` 目录，如 `gfc/config-my-template.yaml`。
3. **登记清单**：在对应清单 `gfs.json` / `gfc.json` 里照抄下面片段并填写：
   ```json
   {
     "id": "config-my-template",
     "name": "我的模板",
     "description": "一句话说明模板用途与特点（列表页展示，悬停显示全文）",
     "author": "你的 GitHub ID 或昵称",
     "version": "v1.0.0",
     "tags": ["入门", "TUN"],
     "group": "推荐",
     "homepage": "https://github.com/you/your-repo",
     "updatedAt": "2026-01-01",
     "notes": "导入注意事项（可省略）"
   }
   ```
   必填字段：`id`、`name`、`description`、`author`；其余建议填写。
   `id` 必须与文件名一致，kebab-case，建议 `config-` 前缀，在清单内唯一。
4. **本地自测**：
   - sing-box：`sing-box check -c gfs/config-my-template.json` 通过，且导入 GUI 后能正常出站；
   - mihomo：`mihomo -t -f gfc/config-my-template.yaml` 通过。
5. **提交 PR**，描述模板的用途与特点，等待维护者评审合并。

## 硬性要求

- 模板必须是**完整、可直接运行的最终配置**（内核配置，不是应用托管配置，
  也不是应用「配置编辑器」的导出格式）。
- **不含任何真实隐私**：订阅链接、Token、服务器地址、个人域名等一律不得出现。
  如需演示节点，请使用明显虚构的占位数据。
- 省略会与应用冲突的字段：
  - sing-box：省略 `experimental.clash_api.external_controller` 与 `secret`；
  - mihomo：省略 `external-controller` 与 `secret`。
- 不内嵌真实节点。出站分组通过 `tag` 引用节点，导入时由插件按 tag 与用户订阅匹配；
  未匹配到的引用会丢失，属正常现象，请在 `notes` 里说明。
- 文件编码 UTF-8；JSON 不带注释；YAML 可带简短注释。

## 提交后会发生什么

维护者评审合并后，用户在插件里点「刷新」即可看到新模板。
后续修改模板内容时请递增 `version`（如 `v1.0.0` → `v1.1.0`）并更新 `updatedAt`，
已导入的用户会收到更新提示。
