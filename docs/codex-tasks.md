# Codex 执行清单

> 更新时间：2026-08-10
> 仓库：https://github.com/songchunhui513-bit/dishlens
> 分支：`main`
> 线上地址：https://dishlens.wukongmkt.com
> 详细状态：`docs/handoff-codex-2026-08-05-image-speed-state.md`
> 发布计划：`docs/superpowers/plans/2026-08-10-release-image-speed.md`

## P0：本地版本收口与 Google Cloud 主站发布

- [x] 将当前图片资产、识别缓存、加载体验、分享和诊断改动纳入可审计提交 `e5c1762`。
- [x] 运行 `node scripts/diagnose-dish-images.mjs --summary --fail-on-deploy-risk`。
- [x] 在无 `.env.local` 的干净目录运行 `npm ci`、176 项逻辑回归、lint、TypeScript 和生产构建。
- [ ] 推送 GitHub `main`。
- [ ] Google Cloud 主站执行 `git pull --ff-only && npm run build && pm2 restart dishlens --update-env`。
- [ ] 检查 PM2 日志和线上 HTTP 200。

当前说明：

- GitHub `main` 基线为 `61c0edd`。
- 公网 DNS 当前指向 Google Cloud `35.255.147.40`；主站目录为 `/opt/dishlens-global`，部署基线为 `61c0edd`，工作区干净。
- 主站 `.env.production` 已确认存在 Qwen、Supabase URL 和服务端密钥；禁止输出密钥值。
- 阿里云 `8.133.168.91` 是备用机，不得先发布到备用机后误判主站已更新。

## P0：图片本地化与稳定复用

- [x] 知识库共 1022 项。
- [x] 本地知识图片 887 项。
- [x] 人工审核生成缓存 110 项，其中 99 项提供新增稳定覆盖。
- [x] 稳定本地覆盖率 97.6%，去重后 96.5%。
- [x] 被引用本地图片缺失数为 0。
- [x] 被引用但未进入 Git 的图片数为 0。
- [x] 套餐、饮品、汤、甜点分类与图片 prompt 完成基础纠偏。
- [ ] 将剩余 135 个 Pollinations 远程条目转为稳定本地 WebP。
- [ ] 人工目检 125 张未提升 runtime 生成图，合格则 promote，不合格则 reject。
- [ ] 优先补齐 34 道菜法国小馆样本中首次结果缺失的 18 张图。

图片优先级：

1. `public/dishes` 本地知识图。
2. `public/dishes/generated-cache` 人工审核生成图。
3. 阿里 OSS 中已持久化图片。
4. Supabase Storage 中的兼容缓存。
5. AI 后台生成并优先同步阿里 OSS。

`public/generated-dishes` 仅是机器本地运行时缓存，不得作为跨部署、分享或数据库稳定 URL。

## P0：首次识别与重复上传速度

- [x] 首屏 first pass 与完整 enrichment 分离。
- [x] 前 20 秒 LoadingPage 使用 700ms 快速轮询，随后恢复 1500ms。
- [x] client hash/cache probe 支持重复上传命中服务端持久缓存，并为每次结果签发有效的新任务 ID。
- [x] 干净缓存命中可在读取服务端原始图片前直接返回。
- [x] 大菜单图片队列限流、deferred 语义和 60+40 渐进渲染已实现。
- [x] 旧浏览器直返路径实测约 53–148ms；为避免任务授权过期，现改为服务端验证缓存，需发布后重新建立重复上传基线。
- [ ] 用 5–10 张真实菜单建立线上冷启动与重复上传基线。
- [ ] 比较 fast first-pass 视觉模型、菜单裁切/透视矫正和更轻量首屏字段策略。

当前瓶颈：首次识别主要耗在云端视觉模型，真实样本约 6–28 秒；上传、结果构建和重复缓存不是主瓶颈。

## P0：海外快速生图链路

- [x] 接入新加坡 Model Studio 同步生图接口。
- [x] 普通菜品默认使用 `z-image-turbo`，失败时仅回退一次 `wan2.7-image`。
- [x] 饮品、汤、海鲜、套餐默认使用 `wan2.7-image` 保证结构准确，失败时回退快速模型。
- [x] 详情页生图前使用稳定 storage id 查询本地/OSS/Supabase 缓存，避免同菜重复付费生图。
- [x] 新模型临时 URL 必须持久化成功后才返回给页面。
- [x] 按需付费生图必须携带有效任务 ID，且菜品必须属于该任务结果。
- [x] 按需生图增加客户端/任务/全局预算与同菜并发合并；当前单 PM2 进程下生效。
- [x] 生产环境只把 HTTPS OSS/Supabase/CDN 地址视为稳定完成；本地 URL 仅限开发测试。
- [x] 增加 2 RPS 请求间隔、模型超时、终止错误分类和结果下载域名/大小/超时校验。
- [x] `NEXT_PUBLIC_DISH_IMAGE_CDN_HOST` 可配置 OSS 自定义 CDN 域名，避免 Next Image 运行时崩溃。
- [x] 当前中国节点实测：`z-image-turbo` 约 4.0 秒，`wan2.7-image` 约 16.1 秒；仅作模型链路基线。
- [ ] 创建新加坡 Model Studio Workspace/API Key，并在生产配置 `ALIBABA_MODEL_STUDIO_WORKSPACE_ID`、`ALIBABA_MODEL_STUDIO_API_KEY`。
- [ ] 在新加坡 ECS/OSS 环境运行 20 道菜冷启动与重复命中 benchmark，再决定困难品类集合和超时值。
- [ ] 扩展到多 PM2 worker 或多 ECS 前，把生图预算与同菜锁迁移到 Redis。

启用原则：Workspace endpoint 与 API key 必须属于同一新加坡区域。未配置新加坡 Workspace 时继续使用旧 `wanx2.1` 链路；不得用北京 `QWEN_API_KEY` 代替新加坡 key。

## P1：图片持久化

- [x] 服务端支持 `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY`。
- [x] 生成图优先同步阿里 OSS，Supabase Storage 作为兼容回退；机器本地 URL 不进入稳定缓存响应。
- [x] 本地和阿里云均确认配置存在，不在日志中输出密钥。
- [ ] 从阿里云运行 Storage 诊断，验证 bucket、上传、公开 URL、清理全链路。
- [ ] 用一份含新菜的真实菜单验证首次生成后写入 Supabase、服务器重启后仍命中。
- [ ] 为失败上传增加可观测的后台补同步队列或重试机制。

## P1：真实产品流程验收

- [ ] 上传英文、法文、意大利文、弱光、倾斜、密集和快餐菜单。
- [ ] 验证首次识别、重复上传、图片渐进补齐、菜品详情。
- [ ] 验证分享面板、微信/系统分享、WhatsApp、Telegram 和复制链接。
- [ ] 在新会话打开 `/share/[id]`，确认列表、详情和图片不依赖原设备缓存。
- [ ] 验证 100–200 道菜的渐进渲染与 deferred 图片体验。

## P2：后续产品建设

- [ ] 用户认证 UI。
- [ ] localStorage 历史记录上限与迁移策略。
- [ ] PWA manifest 与安装体验。
- [ ] 错误监控与性能观测。
- [ ] 图片系统诊断页，将本地、审核缓存、Supabase、AI pending 分层展示。

## 发布命令

```bash
git push origin main
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359 --command "cd /opt/dishlens-global && git pull --ff-only && npm run build && pm2 restart dishlens --update-env"
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359 --command "pm2 logs dishlens --lines 100 --nostream"
```

## 发布禁区

1. 不提交 `.env*`、密钥或 Supabase service role 片段。
2. 不提交 `.cache/` 或 `public/generated-dishes/`。
3. 不把 DashScope signed URL、Pollinations URL、Unsplash URL 或机器本地生成图写入稳定分享数据。
4. 不删除 Nginx default 配置，不执行破坏性 Git 命令。
5. 未通过图片部署 gate、回归、lint 和 build 时不得发布。
