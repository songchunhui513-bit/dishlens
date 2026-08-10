# DishLens 上线交接文档 — 2026-07-01

> 交接对象：Claude Code
> 目标：接手当前本地改动，完成上线前验证、提交、部署与线上回归。
> 重要约束：不要擅自重写现网 H5 设计，不要提交 API Key，不要直接清理未理解的本地改动。
---

## 1. 当前状态

当前工作目录：

```bash
cd /Users/julian/AI点菜/dishlens
```

当前分支：`main`

本轮本地工作主要分两类：

1. **产品介绍 HTML 更新**
   - 文件：`_temp/dishlens-product-introduction-2026-07-01.html`
   - 本地预览：`http://127.0.0.1:4184/_temp/dishlens-product-introduction-2026-07-01.html?clean=20260701b`
   - 已完成内容：
     - 去掉“老板评审版”字样，改为对外产品介绍口径。
     - 增加真实菜品图片、修复部分图片不显示。
     - 增加两个菜单样本下载入口。
     - 增加“本地图库与图片复用”说明，当前对外口径为“图库规模约 2000 张”。
     - Roadmap 区域拆分为 P0 / P1 / P2，突出 UI 视觉优化、位置能力、餐厅推荐。
     - AI 提示词区域增加完整提示词示例、图片示例和本地图库逻辑。

2. **H5 本地代码有少量未提交改动**
   - `src/app/page.tsx`
   - `src/components/home/HomePage.tsx`
   - `tests/logic-regressions.test.mjs`
   - `public/sample-menus/`
   - `docs/handoff-codex-2026-07-01.md`
   - `docs/project-summary-2026-06-29.md`

接手后第一步务必运行：

```bash
git status --short
git diff --stat
git diff -- src/app/page.tsx src/components/home/HomePage.tsx tests/logic-regressions.test.mjs
```

不要直接 `git add -A`，先确认哪些文件需要进入本次上线。

---

## 2. 目前已知本地代码改动

### 2.1 `src/app/page.tsx`

改动目的：避免首页最近翻译在 SSR/首屏阶段因 localStorage 历史记录导致水合不一致。

关键变化：

```tsx
recentHistory={mounted ? buildRecentMenuRecords(historyEntries, { targetLang: settings.targetLang }) : undefined}
```

验证重点：

- 首页首屏不白屏。
- 最近翻译记录在客户端 mounted 后正常出现。
- 没有最近翻译时，布局不跳动。

### 2.2 `src/components/home/HomePage.tsx`

改动目的：最近翻译标题右侧“查看全部”在空状态时隐藏但保留布局占位，避免标题区域跳动。

关键变化：

- 空状态时 `visibility: hidden`
- 空状态时 `pointerEvents: none`
- 非空状态点击仍进入历史页。

验证重点：

- 首页没有最近翻译时，不显示“查看全部”，且标题区域排版稳定。
- 有最近翻译时，“查看全部”可点击。

### 2.3 `tests/logic-regressions.test.mjs`

新增断言：

- `recentHistory` 必须等 `mounted` 后再构造。
- `HomePage` 空状态不再用 `{!isEmpty && (...)}` 条件渲染，而是用 `visibility` 隐藏。

上线前必须跑：

```bash
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

---

## 3. 样例菜单文件

新增目录：

```bash
public/sample-menus/
```

当前样例：

```bash
public/sample-menus/english-menu-snacks-meat-sea.jpg
public/sample-menus/english-menu-large-plates-dessert.jpg
```

用途：

- 产品介绍页提供下载。
- 用户可边看介绍页边下载菜单样本，再去 H5 上传识别。

验证：

```bash
ls -lh public/sample-menus/
open http://127.0.0.1:4184/_temp/dishlens-product-introduction-2026-07-01.html?clean=20260701b
```

在页面点击两个下载入口，确认图片可打开或下载。

---

## 4. 部署环境

| 环境 | 地址 | 说明 |
|---|---|---|
| 线上 H5 | `https://dishlens.wukongmkt.com` | 当前主入口 |
| Google Cloud | `35.255.147.40` | 当前主生产机器，PM2 + nginx |
| 阿里云 ECS | `8.133.168.91` | 备用环境 |
| 本地 H5 | `http://localhost:3101` | `npm run dev -- -p 3101` |
| 产品介绍页本地 | `http://127.0.0.1:4184/_temp/dishlens-product-introduction-2026-07-01.html?clean=20260701b` | 本地静态评审页 |

线上部署前确认：

```bash
git remote -v
git branch --show-current
git status --short
```

---

## 5. 推荐上线流程

### Step 1：本地验证

```bash
cd /Users/julian/AI点菜/dishlens

node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

如果 build 因本地 `.next` 或缓存异常失败，可先记录错误，不要直接删除大目录；确认后再执行：

```bash
rm -rf .next
npm run build
```

### Step 2：本地 H5 冒烟

```bash
npm run dev -- -p 3101
```

打开：

```text
http://localhost:3101/?recent-landmark-a=1&task-store-fix=1
```

至少验证：

- 首页正常加载。
- 最近翻译区域空/非空状态排版正常。
- 历史、收藏、点过、设置入口正常。
- 上传菜单能创建任务。
- 结果页列表、详情页、点单核对页不出现明显视觉回退。

### Step 3：产品介绍页验证

如果 4184 服务未启动，可用任意静态服务启动，例如：

```bash
python3 -m http.server 4184
```

然后打开：

```text
http://127.0.0.1:4184/_temp/dishlens-product-introduction-2026-07-01.html?clean=20260701b
```

检查：

- 页面无“老板评审版”字样。
- Hero 文案简洁。
- 菜品图片正常显示。
- 两个菜单下载按钮可用。
- AI 提示词区域有两个完整中英文示例和生成图片。
- Roadmap 区域 P0 / P1 / P2 不拥挤，P0 信息突出。
- “本地图库与图片复用”显示约 2000 张。

### Step 4：提交

确认本次要上线的文件后再提交。

建议把“产品介绍页/样例菜单”和“H5 小修复”拆成两个提交：

```bash
git add public/sample-menus docs/handoff-claude-deploy-2026-07-01.md
git add _temp/dishlens-product-introduction-2026-07-01.html
git commit -m "docs: update DishLens product introduction handoff"

git add src/app/page.tsx src/components/home/HomePage.tsx tests/logic-regressions.test.mjs
git commit -m "fix: stabilize home recent translations hydration"
```

注意：`_temp/` 可能被 `.gitignore` 忽略。如果产品介绍页需要部署到静态站，请确认实际部署仓库/路径，不要误以为提交到了 H5 生产包。

### Step 5：推送

```bash
git push origin main
```

### Step 6：服务器部署

生产主环境以当前项目文档为准。历史交接里记录的 Google Cloud 部署方式：

```bash
gcloud compute ssh dishlens-global --zone us-central1-a
cd /opt/dishlens
git pull
npm run build
set -a && source .env.production && set +a
pm2 restart dishlens --update-env
pm2 logs dishlens --lines 80 --nostream
```

备用阿里云环境：

```bash
ssh root@8.133.168.91
cd /opt/dishlens
git pull
npm run build
set -a && source .env.production && set +a
pm2 restart dishlens --update-env
pm2 logs dishlens --lines 80 --nostream
```

注意：

- 不要把 `.env.local`、`.env.production`、API Key 写入 Git。
- 若 Google Cloud 构建遇到 `lightningcss`/原生依赖兼容问题，先按现有文档确认服务器 Node、包管理器和构建流程，不要盲目升级依赖。

---

## 6. 线上回归清单

部署后访问：

```text
https://dishlens.wukongmkt.com
```

必须验证：

1. 首页能打开，HTTP 200。
2. 上传样例菜单能进入识别流程。
3. 任务不会一直卡在“翻译失败/等待超时”。
4. 结果页能展示餐厅摘要、分类、菜品列表。
5. 菜品图片缺失时有占位，不阻塞理解。
6. 菜品详情页打开正常。
7. 点单加减、店员核对、点过页面逻辑正常。
8. 最近翻译回到首页后展示正常。
9. 微信内 H5 打开不出现底部按钮遮挡关键 CTA。

建议用两个菜单样本做回归：

```text
public/sample-menus/english-menu-snacks-meat-sea.jpg
public/sample-menus/english-menu-large-plates-dessert.jpg
```

---

## 7. 已知风险

### 7.1 产品介绍页与 H5 部署不是同一件事

`_temp/dishlens-product-introduction-2026-07-01.html` 是本地评审页，不一定在 H5 生产站自动可访问。若要对外展示，需要确认：

- 是放到 Vercel 展示站？
- 还是放到 H5 public 静态目录？
- 是否需要独立 URL？

### 7.2 本地图库 2000 张是对外口径

当前本地文件可直接统计到：

- `public/dishes`：约 538 张知识库图。
- `public/generated-dishes`：约 178 张本地生成缓存。

产品介绍页按用户要求使用“当前图库规模约 2000 张”的展示口径，含本地知识库、已生成缓存、云端复用素材与规划口径。若后续要精确披露，需要用生产权限统计 Supabase Storage / 生产机缓存。

### 7.3 线上图片生成仍需重点回归

历史问题：

- Wan/DashScope 生图偶发失败或慢。
- 图片生成状态曾卡在 88%。
- 套餐、饮品、披萨、鱼类、红鲻鱼等高风险菜品容易误生成。

上线后要重点观察 PM2 日志中的翻译任务、生图任务和失败重试。

### 7.4 位置推荐还未接入真实 Key

产品介绍页已描述后续“位置与餐厅推荐”，但 H5 生产逻辑仍需接入：

- 海外：Google Places API
- 国内：高德地图 API

不要在本次部署中临时硬编码 Key。

---

## 8. Claude Code 接手建议

优先级：

1. 先跑本地测试、lint、build。
2. 明确本次是否只上线 H5 修复，还是也要发布产品介绍页。
3. 检查 `_temp/` 是否被 Git 忽略，决定产品介绍页的正式承载位置。
4. 使用样例菜单做本地完整流程测试。
5. 用户确认后再部署生产。
6. 部署后记录线上验证结果和 PM2 日志摘要。

不要做：

- 不要重构首页、结果页、详情页视觉。
- 不要删除 `public/generated-dishes` 或 `public/dishes`。
- 不要改环境变量名。
- 不要把 API Key 写入文档。
- 不要为了修部署问题直接升级 Next/React/Tailwind 主版本。
