# DishLens Codex 交接文档 — 2026-07-17

## 本轮目标

排查并修复线上/本地出现的菜品图片失效、Supabase 诊断缺 key、上传识别流程可用性问题，并验证图片本地化/持久化闭环。

## 关键结论

1. 图片大面积失效的第一根因是 Supabase 项目 `gbkallzbksmaahzvxezq` 处于 paused 状态，导致 `gbkallzbksmaahzvxezq.supabase.co` DNS 一度返回 `NXDOMAIN`，Storage 与 DB 都不可用。
2. 本地诊断缺 `SUPABASE_SERVICE_ROLE_KEY` 已修复：从生产环境安全同步到本地 `.env.local`，未在终端或对话中泄露明文。
3. Supabase 项目已在 Dashboard 执行 Resume，并恢复可用。`scripts/diagnose-supabase-storage.mjs` 已验证 bucket、上传、公开 URL、清理全链路通过。
4. 代码层面发现第二根因：缓存和本地生成图复用路径仍可能把 `/generated-dishes/...` 作为稳定图片返回。该路径是机器本地文件，跨部署/换机器会失效。

## 已完成修复

### Supabase 配置兼容

- `src/lib/db/supabase.ts`
  - 支持 `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY`。
- `.env.example`
  - 补充服务端 key 说明。
- `scripts/diagnose-supabase-storage.mjs`
  - 可读取 `.env.local`，输出脱敏诊断，验证 `dishes` bucket 上传与公开访问。

### AI 图片持久化

- `src/lib/storage/supabase-storage.ts`
  - AI 生成图片先本地优化为 webp，再上传 Supabase Storage。
  - 本机已有 `/public/generated-dishes` 文件时，会尝试同步到 Supabase，成功返回 Supabase URL，失败才作为临时兜底。

### 防止本机生成图进入稳定缓存

- `src/app/api/v1/translate/menu/route.ts`
  - `getCachedDishImageUrl()` 返回值必须是 Supabase Storage URL 才能作为 AI 缓存图复用。
  - AI 生图只有成功持久化到 Supabase Storage 才算 `done`。
  - 缓存命中后，如果发现本机生成图被剥离或菜品仍缺图，会启动后台补图。
- `src/lib/server/sanitize-translation-result.ts`
  - 所有 `/generated-dishes/...` 都视为 machine-local artifact，从缓存/任务响应中剥离，避免跨部署坏图。

## 验证结果

### 自动化

- `node --test tests/logic-regressions.test.mjs`：90/90 通过。
- `npm run lint`：通过。
- `npm run build`：通过。

### Supabase Storage

- `node scripts/diagnose-supabase-storage.mjs`：通过。
- 验证项：config、bucket public、upload/upsert、public URL HEAD 200、cleanup 全部 OK。

### 本地真实流程

服务：`http://localhost:3010`

样例菜单：`public/sample-menus/english-menu-snacks-meat-sea.jpg`

结果：
- 首次/缓存流程均可返回菜单结果。
- 最终图片分布：8 张 Supabase Storage + 2 张本地知识库 `/dishes` + 0 张 `/generated-dishes`。
- 8 张 Supabase 图片逐一 HEAD 检查均为 200。

## 当前仍需注意

1. 本轮代码已本地验证通过，但是否已同步到生产需单独执行部署流程。
2. 当前文档历史里显示 `dishlens.wukongmkt.com` 后续曾迁到 Google Cloud 主入口，阿里云 ECS 是备用；部署前需确认要部署到 Google、阿里云，还是两边都部署。
3. Supabase Storage 刚恢复后偶发 `fetch failed`，代码现在不会再把这种失败写成稳定图片，但建议继续观察线上日志。

## 推荐下一步

1. 确认生产目标：Google Cloud 主站、阿里云备用，或二者都更新。
2. 部署后用同一张样例菜单验证线上：
   - 上传命中缓存应在 1-2 秒返回。
   - 图片分布不应出现 `/generated-dishes`。
   - Supabase 图片 HEAD 应返回 200。
3. 可增加一个后台清理脚本，把历史缓存/DB 中残留的 `/generated-dishes` 记录主动刷新为 Supabase URL。
