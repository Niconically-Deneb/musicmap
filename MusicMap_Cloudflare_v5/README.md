# Music Map v5.0（Cloudflare Pages + D1）

保留原项目的地图、多点选择、节点生成、连接理由、历史记录和整图交换码。在线层使用 Cloudflare Pages Functions + D1；不使用 CloudBase/Supabase，也不需要在前端填写数据库密钥。

## 目录

- `public/index.html`：网页
- `functions/api/[[path]].js`：地图 API
- `schema.sql`：D1 数据表
- `wrangler.toml`：Cloudflare Pages / D1 绑定配置

## 部署步骤

1. 将本目录上传到一个 GitHub 仓库。
2. 在 Cloudflare Dashboard 创建 D1 数据库，名称设为 `music-map-db`。
3. 在 D1 Console 执行 `schema.sql` 中的 SQL。
4. 在 Cloudflare Pages 创建项目并连接该 GitHub 仓库；Build command 留空，Build output directory 填 `public`。
5. 在 Pages 项目 Settings → Functions → D1 database bindings 中新增绑定：Variable name 填 `DB`，选择 `music-map-db`。
6. 若使用 Wrangler，先把 `wrangler.toml` 的 `database_id` 换成控制台显示的真实 ID。
7. 重新部署。部署完成后使用平台提供的 `*.pages.dev` 地址打开。

## 使用方式

- 本地模式：未创建在线地图时，数据保存在当前浏览器。
- 创建在线地图：选择“公开地图”或“私人地图”后创建。
- 浏览链接：公开地图任何拿到 ID 的人都能浏览；私人地图必须带浏览密钥。
- 协作编辑链接：包含编辑权限密钥，获得该链接的人都能修改地图。不要公开发布这个链接。
- 地图编辑每 8 秒轮询一次；并发保存采用版本号检测和自动合并，复杂的同一节点同时修改仍需人工检查。
- 原有整图交换码继续可用。

## 重要限制

- Cloudflare 免费计划有用量上限；D1 免费额度和 Workers/Pages Functions 的限制请以官方最新价格页为准。
- 海外托管不需要把网站放在中国大陆服务器，但不能保证中国大陆每个运营商、地区和时段都稳定访问。Cloudflare 官方说明全球网络不在中国大陆部署节点；要获得其中国大陆网络加速服务需符合 ICP 要求。因此，本方案满足“不办理 ICP、尽量免费”的优先级，但无法同时保证大陆访问稳定性。
- 私人地图的浏览密钥和协作编辑密钥属于访问凭证。丢失编辑密钥后无法恢复编辑权限；清理浏览器数据前请导出交换码备份。
- 当前采用轮询同步，不是 WebSocket 实时推送。对于小规模协作足够轻量。
- 本项目没有账号系统。编辑权限通过随机密钥授予，适合小型熟人协作，不适合承载高度敏感内容。
