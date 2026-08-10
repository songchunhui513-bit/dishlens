# DishLens 图片稳定性、识别速度与发布收口实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前本地已经验证的图片本地化、菜单识别缓存、加载体验和分享稳定性改动整理成可审计提交，发布到阿里云，并用真实菜单证明首次识别、重复上传和图片持久化闭环可用。

**Architecture:** 保持现有 Next.js 16 单体架构。稳定图片优先来自 `public/dishes` 与人工审核的 `public/dishes/generated-cache`；新生成图优先同步阿里 OSS，Supabase Storage 仅作兼容回退。海外生图使用新加坡 Model Studio：普通菜品先走 `z-image-turbo`，饮品、汤、海鲜、套餐先走 `wan2.7-image`，并在可重试错误时只回退一次。首次识别继续使用轻量 first pass，重复上传通过 client hash/cache probe 秒回。发布使用 Git 推送后由阿里云 ECS `git pull --ff-only`、构建、PM2 重启完成。

**Tech Stack:** Next.js 16、React 19、TypeScript、Supabase Storage/Postgres、阿里云 ECS、PM2、Node.js benchmark scripts。

---

### Task 1: 收口工作区与提交边界

**Files:**
- Modify: `.gitignore`（仅当临时目录未被忽略）
- Modify: `docs/codex-tasks.md`
- Create: `docs/superpowers/plans/2026-08-10-release-image-speed.md`

- [ ] **Step 1: 检查 staged/unstaged 重叠与临时文件**

Run:
```bash
git status --short
comm -12 <(git diff --cached --name-only | sort) <(git diff --name-only | sort)
git ls-files --others --exclude-standard | sort
```

Expected: 明确图片资产、业务代码、文档和临时文件四组；`.cache/` 不进入提交。

- [ ] **Step 2: 将已有改动按职责加入暂存区**

Run:
```bash
git add public/dish-knowledge-db.json public/dishes public/generated-dish-local-index.json
git add src scripts tests docs
```

Expected: 所有本轮产品代码、诊断脚本、测试、样例菜单和交接文档进入暂存区，秘密文件与 `.cache/` 不进入暂存区。

- [ ] **Step 3: 检查暂存内容不包含密钥或运行时缓存**

Run:
```bash
git diff --cached --name-only | rg '(\.env|public/generated-dishes|^\.cache/)' || true
git diff --cached --check
```

Expected: 不输出 `.env*`、`public/generated-dishes` 或 `.cache/`；`git diff --cached --check` 退出 0。

### Task 2: 本地发布门禁与代码审查

**Files:**
- Test: `tests/logic-regressions.test.mjs`
- Inspect: `scripts/diagnose-dish-images.mjs`

- [ ] **Step 1: 运行图片部署门禁**

Run:
```bash
node scripts/diagnose-dish-images.mjs --summary --fail-on-deploy-risk
```

Expected: `local_image_assets_missing=0`、`local_image_assets_untracked=0`、`local_image_assets_deploy_ready=true`。

- [ ] **Step 2: 运行完整验证**

Run:
```bash
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

Expected: 176 项回归全部通过，lint、TypeScript 与生产构建退出 0。

### Task 2A: 海外快速生图与稳定持久化

**Files:**
- Modify: `src/lib/ai/image-gen.ts`
- Modify: `src/app/api/v1/dish/[id]/generate-image/route.ts`
- Modify: `src/lib/storage/supabase-storage.ts`
- Modify: `next.config.ts`
- Test: `tests/logic-regressions.test.mjs`

- [x] **Step 1: 接入新加坡 Model Studio 快速/高质量双模型路由**

普通菜使用 `z-image-turbo`；饮品、汤、海鲜、套餐优先 `wan2.7-image`；超时、429、5xx 才允许单次回退，401/403/内容安全等终止错误不回退。

- [x] **Step 2: 详情页先缓存后付费生成**

使用确定性 storage id 依次查询本机运行时缓存、OSS 和兼容 Supabase 缓存。临时模型 URL 只有持久化成功后才进入任务结果。

- [x] **Step 3: 加固并验证**

增加全局请求起始间隔、模型超时、结果 URL 重定向白名单、下载大小限制和自定义 CDN host；按需接口要求任务归属、限制请求预算并合并同菜并发；176 项回归、lint、TypeScript、图片部署门禁和生产构建全部通过。

- [ ] **Step 4: 新加坡生产激活**

创建同区域 Workspace/API Key 并注入生产环境，随后执行 20 道菜冷启动、困难品类准确率和重复缓存命中 benchmark。当前中国节点实测仅作为链路基线，不替代新加坡验收。

- [ ] **Step 3: 审查相对 `origin/main` 的完整差异**

Run:
```bash
git diff --cached --stat
git diff --cached --check
git diff --cached -- src/app/api/v1/translate/menu/route.ts src/lib/ai/image-gen.ts src/lib/dish-image-match.ts src/lib/storage/supabase-storage.ts
```

Expected: 无秘密、无调试短路、无临时外链图片回写；图片优先级和缓存语义与交接文档一致。

### Task 3: 提交与推送

**Files:**
- Commit: 图片资产与索引
- Commit: 菜单识别、图片持久化和体验代码
- Commit: benchmark、测试与文档

- [ ] **Step 1: 创建可回滚提交**

Run:
```bash
git commit -m "Localize stable dish image library"
```

Expected: 提交包含所有已验证改动；若暂存内容需要拆分，先按路径重新分组后分别提交，保持每个提交可构建。

- [ ] **Step 2: 推送 main**

Run:
```bash
git push origin main
```

Expected: `origin/main` 与本地 `HEAD` 相同。

### Task 4: Supabase 持久化验证

**Files:**
- Inspect: `scripts/diagnose-supabase-storage.mjs`
- Inspect: `scripts/sync-generated-dish-images.mjs`
- Inspect: `src/lib/storage/supabase-storage.ts`

- [ ] **Step 1: 本地验证 Storage 全链路**

Run:
```bash
node scripts/diagnose-supabase-storage.mjs
```

Expected: bucket 可访问、测试图可上传、公开 URL 可读、测试对象可清理；命令不打印 service role key。

- [ ] **Step 2: 检查生产环境变量存在性**

Run:
```bash
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359 --command "cd /opt/dishlens-global && test -n \"\$SUPABASE_SERVICE_ROLE_KEY\" -o -n \"\$SUPABASE_SECRET_KEY\"; echo supabase_secret_present=\$?"
```

Expected: 返回状态表明生产密钥已配置；不输出密钥内容。

### Task 5: Google Cloud 主站发布

**Files:**
- Deploy: `/opt/dishlens-global` on Google Cloud `dishlens-global` (`35.255.147.40`)

- [ ] **Step 1: 发布前记录远端状态**

Run:
```bash
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359 --command "cd /opt/dishlens-global && git status --short && git rev-parse HEAD && pm2 status"
```

Expected: 远端代码目录无阻塞性修改，`dishlens` 进程在线。

- [ ] **Step 2: 拉取、构建和重启**

Run:
```bash
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359 --command "cd /opt/dishlens-global && git pull --ff-only && npm run build && pm2 restart dishlens --update-env && pm2 status"
```

Expected: 构建成功，`dishlens` 状态为 online。

- [ ] **Step 3: 检查日志与健康状态**

Run:
```bash
CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11 gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359 --command "pm2 logs dishlens --lines 100 --nostream"
curl -fsS -I https://dishlens.wukongmkt.com/
```

Expected: 无启动异常，首页返回 HTTP 200。

### Task 6: 真实菜单 benchmark 与浏览器旅程验收

**Files:**
- Run: `scripts/benchmark-menu-suite.mjs`
- Sample: `public/sample-menus/`
- Sample: `/Users/julian/Documents/菜单/`

- [ ] **Step 1: 冷启动 benchmark**

Run:
```bash
node scripts/benchmark-menu-suite.mjs --base-url https://dishlens.wukongmkt.com --cache-bust --continue-on-error --timeout-ms 180000 --image-timeout-ms 0 public/sample-menus/english-menu-snacks-meat-sea.jpg public/sample-menus/english-menu-large-plates-dessert.jpg /Users/julian/Documents/菜单/2024-06-17-22-53-48-749-1024x768.jpg /Users/julian/Documents/菜单/mcdonalds-menu-india-v0-KkUsZ3rzQnPYm7aCxR4uep-Qc-u3DCbmdiymE8OG_J4.webp
```

Expected: 所有样本返回菜单结果；记录 `first_result_ms`、`first_pass_model_ms`、菜品数和缺图数。

- [ ] **Step 2: 重复上传 benchmark**

Run:
```bash
node scripts/benchmark-menu-suite.mjs --base-url https://dishlens.wukongmkt.com --repeat 2 --cache-probe --no-cache-bust --continue-on-error --timeout-ms 180000 --image-timeout-ms 0 public/sample-menus/english-menu-snacks-meat-sea.jpg public/sample-menus/english-menu-large-plates-dessert.jpg
```

Expected: 第二次命中缓存，`first_result_ms` 接近百毫秒级，优先出现 `cache_hit_without_raw_read`。

- [ ] **Step 3: 用 Sonnet 子代理运行 agent-browser**

Run:
```bash
agent-browser open https://dishlens.wukongmkt.com/
agent-browser snapshot -i
```

Expected: 完成上传、识别、结果列表、菜品详情、分享链接打开和重复上传旅程；无破图、运行时错误或不可操作控件。

### Task 7: 图片 backlog 与首次识别速度下一轮

**Files:**
- Run: `scripts/plan-knowledge-image-backfill.mjs`
- Run: `scripts/promote-generated-dish-images.mjs`
- Run: `scripts/benchmark-fast-first-pass-models.mjs`
- Update: `docs/handoff-codex-2026-08-10-release.md`

- [ ] **Step 1: 生成下一批图片本地化清单**

Run:
```bash
node scripts/plan-knowledge-image-backfill.mjs --limit=20
node scripts/promote-generated-dish-images.mjs --verbose
```

Expected: 输出 20 个远程图片候选和可人工目检的 runtime 图片，不自动提升未审核图片。

- [ ] **Step 2: 记录首次识别瓶颈和下一轮 A/B**

Run:
```bash
node scripts/benchmark-fast-first-pass-models.mjs --models qwen-vl-plus,qwen-vl-max --target-lang zh --repeat 2 --image-timeout-ms 0 --timeout-ms 120000 /Users/julian/Documents/菜单/20260522-184232.jpg /Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg
```

Expected: 每次 repeat 使用隔离图片，避免缓存污染；按模型记录 `firstPassModelMs` 和识别菜品数。

- [ ] **Step 3: 更新交接文档**

Create `docs/handoff-codex-2026-08-10-release.md`，记录提交 SHA、部署 SHA、Supabase 诊断、冷启动和重复上传 benchmark、浏览器验收、剩余远程图片与下一步目标。
