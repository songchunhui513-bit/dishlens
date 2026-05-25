# DishLens Codex 交接文档

> 日期：2026-05-23
> 交接方：Claude Code（Haiku 4.5）
> 接手方：Codex
> 项目路径：`/Users/julian/AI点菜/dishlens`

---

## 一、项目概述

DishLens 是一个 H5/PWA 移动端菜单翻译 App，面向海外旅行者。用户拍摄餐厅菜单，AI 自动翻译并展示菜品信息。

**技术栈**：Next.js 16 (App Router) + TypeScript + TailwindCSS 4 + Supabase
**设计规范**：v7 Warm Editorial（暖奶油底 + 鼠尾草绿主色 + 橙色强调色）
**原型参考**：`_temp/dishlens-v7-complete.html`（20 屏完整原型）
**PRD**：`../PRD.md`
**架构文档**：`../tech-architecture.md`

---

## 二、当前进展

### 2.1 已完成功能

| 功能 | 状态 | 备注 |
|------|------|------|
| 菜单拍摄 + AI 翻译 | ✅ 已上线 | 多页 OCR + Qwen 翻译 |
| 菜品详情页 | ✅ 已上线 | 展示食材/过敏原/风味/评价 |
| AI 图片生成 | ✅ 已上线 | Wan API 异步生图 + 轮询 |
| Supabase 持久化 | ✅ 已上线 | 翻译任务 + 评价 |
| 1022 道菜品数据库 | ✅ 内容全部生成 | `public/dish-knowledge-db.json` (1.2MB) |
| 100 道菜品图片 | ✅ 已生成 | `public/dishes/*.png` |
| 智能每日推荐（代码） | ✅ 已编写 | 未验证运行时效果 |
| 历史记录（代码） | ✅ 已编写 | 基于 localStorage |
| 收藏（代码） | ✅ 已编写 | 基于 localStorage |
| 设计文档 + 需求文档 + 技术文档 | ✅ 已生成 | `docs/` 目录 + Obsidian 已同步 |
| HTML 设计预览 | ✅ 已通过评审 | `_temp/dishlens-new-features-preview.html` |

### 2.2 本轮新增/修改文件

**新增文件：**

| 文件 | 用途 |
|------|------|
| `src/lib/local-storage.ts` | localStorage 封装（历史/收藏/缓存读写） |
| `src/lib/recommendation.ts` | 推荐引擎（纯客户端，从 JSON fetch 数据） |
| `src/lib/weather.ts` | Open-Meteo 天气 API + 地理定位 + 反向地理编码 |
| `src/hooks/useDailyRecommendation.ts` | 推荐 React Hook（缓存优先 → 天气+定位 → 推荐） |
| `public/dish-knowledge-db.json` | 1022 道菜品知识库（1.2MB JSON，运行时 fetch） |
| `docs/design-smart-features.md` | 设计文档 |
| `docs/requirements-smart-features.md` | 需求文档（US-011/012/013） |
| `docs/tech-smart-features.md` | 技术文档 |

**修改文件：**

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | 新增 `HistoryEntry`、`FavoriteDish` 类型 |
| `src/components/home/HomePage.tsx` | hero 卡片接受 `dailyDish` prop 动态渲染 |
| `src/components/history/HistoryPage.tsx` | 接受 `history` prop + 空状态 UI |
| `src/components/favorites/FavoritesPage.tsx` | 接受 `favorites`/`onRemoveFavorite` props |
| `src/components/dish/DishDetailPage.tsx` | 收藏按钮接受 `isFavorited`/`onToggleFavorite` props |
| `src/app/page.tsx` | 全局状态管理 + localStorage 读写 + 推荐 Hook 接入 |
| `scripts/generate-dish-content.mjs` | 输出改为 `public/dish-knowledge-db.json`（不再生成 TS） |

---

## 三、遗留问题（按优先级排序）

### P0：必须先修复，否则无法正常使用

#### 1. dev server 首次编译超慢/崩溃

**现象**：`npm run dev` 后首次访问 `localhost:3000`，Turbopack 编译耗时极长（60s+），甚至 OOM 崩溃。

**根因**：`dish-knowledge-db.ts`（1.6MB / 54649 行）仍存在于 `src/lib/` 下，虽然已改为 JSON fetch，但 Turbopack 扫描目录时仍会尝试解析它。

**修复方案**：
```bash
# 删除旧的 TS 文件（已不再被任何代码 import）
rm src/lib/dish-knowledge-db.ts
```

如果还有其他大文件导致编译慢，检查 `src/lib/dish-image-db.ts` 是否也被 drag 进来。

#### 2. 首页推荐功能运行时未验证

**现象**：代码已编写完成，`npx tsc --noEmit` 和 `npm run build` 均通过，但因 dev server 编译问题，**尚未在浏览器中实际验证**。

**需要验证的流程**：
1. 打开 `http://localhost:3000` → 首页 hero 卡片应显示推荐菜品（非硬编码的 Boeuf Bourguignon）
2. 推荐菜品名/图片/标签应来自知识库
3. 同一天刷新页面应看到同一道菜
4. 翻译完成 → 切换到历史页 → 应显示记录
5. 菜品详情页 → 点击心形 → 切到收藏页 → 应显示收藏

---

### P1：功能完善

#### 3. 剩余 922 道菜图片生成

**当前状态**：1022 道内容全部生成，图片仅 100 道。

**启动命令**：
```bash
cd /Users/julian/AI点菜/dishlens
node scripts/generate-dish-content.mjs --images-only
```

**注意事项**：
- 并发必须 = 1（`IMAGE_CONCURRENCY = 1`），否则 Wan API 429 限流
- 每张图约 15s，922 张 ≈ 3-4 小时
- 费用：922 × ¥0.04 ≈ ¥37
- 完成后需重新运行脚本更新 `public/dish-knowledge-db.json`

#### 4. 翻译历史记录缺少缩略图

**问题**：`saveToHistory()` 在 `page.tsx` 中提取缩略图时，`thumbnail` 字段取的是 `firstDish?.ai_image_url || firstDish?.image_url`，但新翻译的菜品可能还没有 AI 图片。

**修复方向**：如果无图片 URL，使用 `getDishImageUrl(dish)` 工具函数（已有，在 `src/lib/dish-presentation.ts`）获取 Unsplash 回退图。

#### 5. 历史记录点击应能恢复翻译结果

**当前状态**：历史页点击条目后，只在 `translationResult` 里查找菜品。但历史来自 localStorage，之前翻译的结果已不在内存中。

**修复方向**：
- 方案 A：点击历史条目显示简单的菜品列表（从 localStorage 存 result 摘要）
- 方案 B：跳转到「翻译结果重新加载」状态（需后端支持）
- 建议：短期用方案 A，在 localStorage 中多存一份 `result_summary`

---

### P2：优化项

#### 6. 知识库 JSON 按需分片加载

**问题**：`public/dish-knowledge-db.json` 当前 1.2MB（100 道有图片），扩展到 1022 道有图片后会更大。推荐引擎每次都 fetch 全量。

**优化方向**：
- 按菜系分片：`public/dishes-db/french.json`、`public/dishes-db/japanese.json` 等
- 推荐引擎只 fetch 需要的菜系
- 或按 category 分：`main.json`、`dessert.json` 等

#### 7. 推荐算法缺少图片过滤

**问题**：当前推荐可能选中没有图片的菜品（922 道缺图片），hero 卡片会显示空白图。

**临时修复**：在推荐引擎过滤池中，优先选有 `card` 或 `hero` 字段的菜品：
```ts
// src/lib/recommendation.ts 中 pool 过滤后
const withImage = pool.filter(d => d.card || d.hero);
if (withImage.length >= 5) pool = withImage;
```

#### 8. `dish-knowledge-db.ts` 已废弃但未删除

**位置**：`src/lib/dish-knowledge-db.ts`（1.6MB）
**说明**：数据已迁移到 `public/dish-knowledge-db.json`，TS 文件不再被任何代码 import。但生成脚本 `scripts/generate-dish-content.mjs` 还引用了 `DB_OUT` 常量指向它。

**修复**：删除 `src/lib/dish-knowledge-db.ts`，确认脚本只输出 JSON。

---

## 四、关键文件索引

```
dishlens/
├── src/
│   ├── app/page.tsx                    # 全局状态管理（SPA 路由中心）
│   ├── components/
│   │   ├── home/HomePage.tsx            # 首页（推荐 + 最近翻译 + 拍摄按钮）
│   │   ├── history/HistoryPage.tsx      # 历史记录页
│   │   ├── favorites/FavoritesPage.tsx  # 收藏页
│   │   ├── dish/DishDetailPage.tsx      # 菜品详情页（含收藏按钮）
│   │   ├── camera/CameraPage.tsx        # 拍摄页
│   │   ├── results/
│   │   │   ├── LoadingPage.tsx          # 翻译加载页
│   │   │   └── ResultsPage.tsx          # 翻译结果页
│   │   └── settings/SettingsPage.tsx    # 设置页
│   ├── lib/
│   │   ├── recommendation.ts           # 推荐引擎（NEW）
│   │   ├── weather.ts                  # 天气 API（NEW）
│   │   ├── local-storage.ts            # localStorage 封装（NEW）
│   │   ├── api-client.ts               # API 客户端（翻译/评价/历史/收藏）
│   │   ├── dish-presentation.ts        # 菜品展示工具（图片/文本/洞察）
│   │   └── dish-knowledge-types.ts     # 知识库类型定义
│   ├── hooks/
│   │   └── useDailyRecommendation.ts   # 推荐 Hook（NEW）
│   └── types/index.ts                  # 全局类型定义
├── public/
│   ├── dish-knowledge-db.json          # 1022 道菜品知识库（NEW）
│   └── dishes/                         # AI 生成的菜品图片（100 张）
├── scripts/
│   ├── dish-database.mjs              # 1022 道菜原始数据
│   └── generate-dish-content.mjs      # 批量生成脚本
├── docs/
│   ├── design-smart-features.md       # 设计文档
│   ├── requirements-smart-features.md # 需求文档
│   └── tech-smart-features.md         # 技术文档
├── _temp/
│   ├── dishlens-v7-complete.html      # v7 设计原型（20 屏）
│   └── dishlens-new-features-preview.html  # 新功能 HTML 预览
├── PRD.md                              # 产品需求文档
├── tech-architecture.md               # 技术架构文档
└── AGENTS.md                           # 项目开发规范（必读）
```

---

## 五、环境与依赖

| 项 | 值 |
|------|------|
| Node.js | v22.22.2 |
| Next.js | 16.2.6 (Turbopack) |
| API Key | `.env.local` 中的 `QWEN_API_KEY`（DashScope） |
| Supabase | 项目已配置，auth + translations + reviews |
| 图片存储 | 本地 `public/dishes/` + AI 生成 |
| 部署 | 阿里云 ECS（已部署旧版，新版需重新部署） |

---

## 六、建议 Codex 工作顺序

```
Step 1: 删除 src/lib/dish-knowledge-db.ts（解决编译崩溃）
Step 2: 启动 dev server，验证首页推荐显示正常
Step 3: 修复推荐引擎优先选有图片的菜品（P2 #7）
Step 4: 验证完整流程：推荐 → 拍摄 → 翻译 → 历史 → 收藏
Step 5: 后台启动图片生成：node scripts/generate-dish-content.mjs --images-only
Step 6: 修复历史记录缩略图问题（P1 #4）
Step 7: 修复历史记录点击恢复问题（P1 #5）
Step 8: npm run build 验证生产构建
Step 9: 部署到阿里云 ECS
```

---

## 七、设计约束（必须遵守）

1. **绝对不改 UI 组件的视觉设计**（CSS/布局/动画），只改数据源
2. **v7 设计规范**：`--bg: #FFF5E9`、`--card: #FEE6CB`、`--primary: #4CAF50`、`--accent: #FF9F1C`
3. **无用户登录体系**，所有历史/收藏基于 localStorage
4. **"use client"** 必须加在所有交互组件上
5. **移动端优先**：393×852 viewport
6. 详见 `AGENTS.md` 和 `_temp/dishlens-v7-complete.html`
