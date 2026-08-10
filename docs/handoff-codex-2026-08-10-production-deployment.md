# DishLens 生产部署交接 — 2026-08-10

## 当前状态

- 生产入口：`https://dishlens.wukongmkt.com`
- 主机：Google Cloud `dishlens-global`，`us-central1-a`，公网 IP `35.255.147.40`
- 代码目录：`/opt/dishlens-global`
- PM2 应用：`dishlens`，单进程 `fork`，Next.js `16.3.0`
- 已发布提交：`651d366`（包含发布候选、部署预检和大菜单稳定性修复）
- 阿里云 `8.133.168.91` 仍为备用机，本次没有修改。

部署时发现 PM2 仍以旧目录 `/opt/dishlens` 为工作目录，导致构建已更新但线上继续运行 Next.js 16.2.6。已删除旧 PM2 进程，并从 `/opt/dishlens-global` 重新创建、保存进程；当前 `exec cwd` 已核实正确。

## 本次修复

1. 不再缓存 `partial` 菜单结果。
   - 四页菜单有一页超时时，旧实现会把 3/4 页结果写入内存和文件缓存，重复上传会在约 1 秒内持续返回缺页结果。
   - `isCacheableTranslationResult()` 现在同时拒绝 `failed` 和 `partial`。
2. 大菜单 fast first-pass 默认并发从 4 调整为 3，上限仍为 4。
   - 线上四并发实测触发一页 `qwen-vl-plus` 和 `qwen-vl-max` 连续 30 秒超时。
   - 三并发重新测试后 4/4 页完整返回。

## 约 50 道菜线上 Benchmark

样本为四张真实法文菜单照片，实际识别 49 道菜。

| 指标 | 结果 |
|---|---:|
| 上传响应 | 2.731 秒 |
| 首个可见结果 | 20.389 秒 |
| 4 页文字全部完成 | 36.371 秒 |
| 页面 | 4/4 |
| 菜品 | 49 |
| 首次本地/稳定图片命中 | 34/49 |
| 待后台补图 | 15/49 |
| 相同四页重复上传 | 1.834 秒 |

四页模型耗时分别为 `17.101s / 13.123s / 12.706s / 10.828s`。首屏主要瓶颈仍是云端视觉模型，不是上传或本地结果构建。

## 浏览器验收

使用 Sonnet 子代理通过 `agent-browser` 在生产站完成真实流程：

- 一次选择四张菜单照片并自动进入识别。
- 最终显示 49 道菜，列表从 41 道渐进补全到 49 道。
- 菜品卡片正文可进入详情，返回后列表状态保留。
- 所有滚入视口的实际图片均有有效像素；没有 `complete=true && naturalWidth=0` 的坏图。
- 控制台零 error、零 warning，无 Next.js Runtime Error overlay。

## 验证

- `node --test tests/*.test.mjs`：176/176 通过。
- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：本地和生产主机均通过。
- 生产首页、生成缓存图和知识库图片均返回 HTTP 200。

## 已知基础设施问题

生产 Supabase 项目域名当前 DNS 返回 `ENOTFOUND`。因此：

- 任务与翻译结果由内存和 Google 主机文件缓存兜底，当前识别及重复上传可用。
- AI 新图能下载并写入主机 `public/generated-dishes/`，但生产策略不会把单机路径标记为跨部署稳定 URL。
- 线上会明确保留“图片生成中/暂无图片”占位，不会发布会过期的临时模型 URL，也不会显示坏图。

要让 15 道新图跨重启、跨部署、分享稳定可用，必须配置阿里云 OSS 或其他持久对象存储。代码已优先支持 OSS，但生产尚缺 `ALIYUN_OSS_*` 凭据，无法在本轮完成远端持久化验收。

## 下一步

1. 在新加坡创建 OSS bucket，配置公开读/CDN/CORS，并注入 `ALIYUN_OSS_REGION`、`ALIYUN_OSS_BUCKET`、`ALIYUN_OSS_ACCESS_KEY_ID`、`ALIYUN_OSS_ACCESS_KEY_SECRET`、`ALIYUN_OSS_PUBLIC_BASE_URL`。
2. 运行 Storage 诊断和一份含新菜菜单，验证首次生成、OSS 写入、PM2 重启后命中、分享页访问四个环节。
3. 创建新加坡 Model Studio Workspace/API key，启用 `z-image-turbo` 与 `wan2.7-image` 分类路由。
4. 继续压缩首次 49 道文字完成的 36 秒，优先 A/B 更快视觉模型和菜单区域裁切，不降低密集小字识别完整性。

