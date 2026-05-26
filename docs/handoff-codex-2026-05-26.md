# DishLens Codex 交接文档

> 日期：2026-05-26
> 上一版交接：docs/handoff-codex-2026-05-25.md
> 仓库：https://github.com/songchunhui513-bit/dishlens
> 线上地址：https://dishlens.wukongmkt.com

---

## 当前状态总览

核心翻译功能完整可用。AI 翻译链路稳定。首页推荐、历史记录、收藏、每日推荐均已实现。本地知识库 1022 道菜已全部有内容，其中 450 道有本地图片。图片持久化三层链路（本地文件 + Supabase Storage + dishes 表）已完整配置 SERVICE_ROLE_KEY。菜单翻译缓存（内存 LRU）已修复，重复上传秒出。AI 生图进度百分比已实现。

---

## 本轮修复/新增清单（2026-05-25 ~ 05-26）

| # | 类别 | 问题 | 根因/修复 | 涉及文件 |
|---|------|------|----------|----------|
| 1 | 图片匹配 | 布里塔奶酪图片重复 | burrata alias 太宽 → 缩小别名 | `dish-image-match.ts` |
| 2 | UI | 首页 badge/标签重叠 | hero padding 不够 → paddingTop: 18 | `HomePage.tsx` |
| 3 | 内容 | 口味描述太简短 | fallback 文案加长到 40-70 字 | `dish-presentation.ts` |
| 4 | 交互 | 最近翻译点不动 | 无 onClick → 加 onRecentClick prop | `HomePage.tsx` + `page.tsx` |
| 5 | SSR | Hydration mismatch | localStorage SSR 不可用 → mounted 检查 | `page.tsx` |
| 6 | 路由 | 说明页显示"未识别到" | 没处理 page_type=info → 三路渲染 | `ResultsPage.tsx` |
| 7 | AI | Qwen prompt 输出太短 | 字数要求加长到 40-70/25-40/25-40 | `qwen.ts` |
| 8 | 缓存 | 菜单缓存不生效 | user_id NOT NULL + RLS 静默拒绝 → 内存 LRU | `route.ts` |
| 9 | 图片 | 咖啡显示错图错推荐 | 无 isDrink 分类 → 新增 isDrink + imageRules | `dish-presentation.ts` |
| 10 | 图片 | 奶酪显示牛排图 | Supabase 缓存 AI 图优先于本地图 → localMatch 优先 | `route.ts` |
| 11 | 图片 | 火腿/香肠显沙拉/牛排 | DIRECT_ALIASES 错误映射 → 重新映射到正确 ID | `dish-image-match.ts` |
| 12 | 图片 | 知识库图片空白 | 724 张 Pollinations 动态 URL 不稳定 → isLocalImageUrl 只接受 /dishes/ | `dish-image-match.ts` |
| 13 | 持久化 | 新菜品图片不保存 | temp- ID 不写 dishes 表 → INSERT 新菜品 | `route.ts` |
| 14 | 生图 | AI prompt 不精确 | 中文太泛 → 英文 + 菜名 + 食材 + 摄影参数 | `image-gen.ts` |
| 15 | 加载 | AI 图片加载态用真实食物照 | 误导用户 → 10 类手绘 SVG loading 动画 | `DishImageWithLoading.tsx` |
| 16 | 缓存 | 翻译缓存存的是无图旧数据 | 缓存存于生图之前 → 生图完成后更新缓存 | `route.ts` |
| 17 | 历史 | 首页缩略图不更新 | saveToHistory 时机过早 → 轮询检测到新图后同步更新 | `page.tsx` |
| 18 | 缓存 | 历史记录恢复后 loading 不消失 | 轮询 5 秒后首次发射 → 改为立即发射 | `page.tsx` |
| 19 | UI | 首页近期翻译只显示 3 条 | .slice(0,3) → .slice(0,8) | `page.tsx` |
| 20 | history | localStorage 无上限 | MAX_HISTORY 100 → 50 | `local-storage.ts` |
| 21 | PWA | 缺 manifest 和图标 | 新建 manifest.json + SVG 图标 | `public/` |
| 22 | 生图 | 汉堡/卷饼生成 paneer tikka | 只有 4 类 → 扩展 burger/wrap/sandwich/salad/pizza 7 类 | `image-gen.ts` |
| 23 | UX | 生图无进度反馈 | 缺进度显示 → Hero 显示"AI 正在生成图片 · 50%" | `DishImageWithLoading.tsx` + `page.tsx` |
| 24 | 基础设施 | SERVICE_ROLE_KEY 缺失 | 手动从 Supabase Dashboard 获取并写入 ECS .env | `.env.production` |

---

## 图片系统架构（核心理解）

### 四层图片优先级（后端 route.ts）

```
1. 本地知识库图片（/dishes/*.png，450 张本地）
   └─ matchDishKnowledgeImage() → DIRECT_ALIASES → token 模糊匹配
   └─ 最可靠，优先级最高

2. ECS 本地生成图缓存（/generated-dishes/<storageId>.png）
   └─ getCachedDishImageUrl() → existsSync 检查本地文件
   └─ 确定性路径（去价格、去货币符号），同名菜稳定命中

3. Supabase dishes 表缓存（ai_image_url 字段）
   └─ findExistingDishImage() → 按 name_original 查询
   └─ 跨服务器持久化，SERVICE_ROLE_KEY 已配置

4. AI 生图（Wan API → 保存本地 + Supabase Storage + dishes 表）
   └─ generateImagesForDishes() → 并发 2 张，每张 20-60 秒
   └─ 完成后 INSERT/UPDATE dishes 表 + 保存本地文件
```

**关键代码位置 route.ts line 275-279：**
```typescript
const imageUrl = localMatch?.card || cachedGeneratedImageUrl || existingImageUrl || null;
```

### 前端展示链路（getDishImageUrl in dish-presentation.ts）

```
1. image_source === "user" → 用户上传图
2. matchLocalImage() → 本地知识库图（/dishes/*.png）
3. existingImage (ai_image_url) → 任意稳定 URL（/generated-dishes/ 或 Supabase Storage）
4. imageRules (Unsplash) → 临时占位（前端 isDishImagePending 会拦截）
5. diverseFallbacks → 随机食物图（同上，会被拦截）
```

### isDishImagePending 判定逻辑

```typescript
// 以下 URL 被视作"不可信/不稳定"，标记为 pending → 显示 loading 动画
- images.unsplash.com
- image.pollinations.ai
- dashscope-result.*.aliyuncs.com（DashScope 临时签名 URL，会过期）
- null / undefined（还没生成）

// 以下 URL 被视作"稳定"，直接显示
- /dishes/*.png（本地知识库）
- /generated-dishes/*.png（本地生成缓存）
- Supabase Storage 公开 URL
```

### isLocalImageUrl 约束（铁律）

**只接受 `/dishes/` 开头的本地路径**。知识库中还有 ~570 条 Pollinations 动态 URL 不能用。

---

## 图片持久化完整链路（已配置 SERVICE_ROLE_KEY）

1. `generateDishImage()` → Wen API 返回 DashScope 临时 URL
2. `uploadDishImage(storageId, tempUrl)`:
   - `fetchImageBuffer(tempUrl)` 下载图片
   - `saveLocalDishImage()` 写 `public/generated-dishes/<id>.png`
   - `supabase.storage.from("dishes").upload()` 写 Supabase Storage
3. `getSupabaseAdminClient()` （用 SERVICE_ROLE_KEY）向 `dishes` 表 INSERT/UPDATE
4. 下次翻译到同名菜 → `findExistingDishImage()` 直接返回 DB 中的 URL

**验证方法**：上传含新菜品的菜单 → 等待生图完成 → 检查 `public/generated-dishes/` 有新文件 → 再次上传同一菜单 → 秒出图片无需等待。

---

## 菜单翻译缓存

- **方案**：内存 LRU Map（`translationCache`），最多 50 条，TTL 30 分钟
- **Key**：`filename:size` 的哈希（跨编码稳定）
- **位置**：`route.ts` 顶部
- **生图后更新**：`generateImagesInBackground` 完成后更新缓存，确保缓存中的结果包含已生成的图片

---

## 关键文件速查

| 文件 | 职责 |
|------|------|
| `src/app/api/v1/translate/menu/route.ts` | 翻译 API 主流程 + 图片分配 + 缓存 + 后台生图 + 持久化 |
| `src/lib/ai/image-gen.ts` | AI 图片生成（Wan API + Pollinations fallback + 7 类 prompt） |
| `src/lib/dish-image-match.ts` | 知识库图片匹配（DIRECT_ALIASES + token 模糊匹配） |
| `src/lib/dish-presentation.ts` | 前端图片 URL 解析 + 菜品洞察文案 + imageRules + isDishImagePending |
| `src/lib/dish-image-persistence.ts` | storageId 生成（去价格、去货币符号） |
| `src/lib/storage/supabase-storage.ts` | Supabase Storage 上传 + 本地文件缓存 |
| `src/lib/db/supabase.ts` | Supabase client（含 admin client） |
| `src/lib/local-storage.ts` | localStorage 封装（历史/收藏/推荐/天气） |
| `src/lib/cache/task-store.ts` | Supabase tasks 表 CRUD（翻译任务持久化） |
| `src/components/shared/DishImageWithLoading.tsx` | 图片容器（loading 动画 + 生图进度 + onError 回退） |
| `src/components/results/ResultsPage.tsx` | 翻译结果列表 |
| `src/components/dish/DishDetailPage.tsx` | 菜品详情页 |
| `src/app/page.tsx` | 全局状态管理（路由/轮询/history/favorites） |

---

## 设计约束（绝对不要做）

1. 不要改 UI 组件的视觉设计（颜色、字体、间距、圆角、动画参数）
2. 不要删 Nginx default 配置（服务于 wukongmkt.com 主域名）
3. 不要修改 globals.css 设计 token
4. isLocalImageUrl 只接受 `/dishes/` 路径
5. 不要用 shimmer/骨架屏做加载态
6. 不要用真实食物照片做 AI 生图占位

---

## 待处理事项

### P1

| 事项 | 说明 |
|------|------|
| 知识库图片继续下载 | 脚本在 `scripts/download-knowledge-images.mjs`，450/1022 已完成，Pollinations API 限速，需继续运行 |
| 下载的新图片加入 Git | `public/dishes/` 中约 20 张新下载图片未 commit |
| generated-dishes 目录 | `public/generated-dishes/` 包含 20 张 AI 生成图（本地），20 张在 ECS 线上 |
| 验证持久化链路 | 上传菜单 → 等生图 → 检查 Supabase dishes 表有记录 → 再上传同一菜单 → 秒出 |

### P2

| 事项 | 说明 |
|------|------|
| 用户认证 UI | AuthModal.tsx 未创建，收藏/历史需登录才能持久化到云端（当前 localStorage） |
| 错误监控 | 无 Sentry |
| ECS generated-dishes 体积 | 线上 86MB/65 张图，需要监控磁盘 |
| 生图并发调优 | 当前默认 2，可设 `MENU_IMAGE_GENERATION_CONCURRENCY`（最高 3）|

### P3

| 事项 | 说明 |
|------|------|
| 多实例部署 | generated-dishes 是本地文件，多实例需挂载共享盘或改用纯对象存储 |
| 生图失败重试 | Wan API 返回 FAILED 时仅有 Pollinations fallback，无自动重试 |
| 菜品去重 | 同一道菜可能被 OCR 识别为略有不同的名称 → 生成多份图 |

---

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 (App Router), TypeScript strict |
| 样式 | TailwindCSS 4 + CSS 变量（v7 Warm Editorial tokens） |
| 数据库 | Supabase (PostgreSQL, Singapore) |
| AI OCR | Qwen VL Max (qwen-vl-max) |
| AI 文本 | Qwen Plus (qwen-plus) |
| AI 生图 | Wan (wanx2.1-t2i-turbo) + Pollinations fallback |
| 部署 | 阿里云 ECS (8.133.168.91), PM2, Nginx, Let's Encrypt |

---

## 部署命令

```bash
# 本地开发
npm run dev

# 部署到线上
ssh root@8.133.168.91
cd /opt/dishlens && git pull && npm run build && pm2 restart dishlens
pm2 logs dishlens --lines 50

# 验证线上
curl -I https://dishlens.wukongmkt.com/
```

## 环境变量

线上 `.env.production` 当前配置：
```
QWEN_API_KEY=<server>
SUPABASE_URL=https://gbkallzbksmaahzvxezq.supabase.co
SUPABASE_ANON_KEY=sb_publishable_rEDFDKwNNVJM9u-W4CWkOA_Jdec3qzS
SUPABASE_SERVICE_ROLE_KEY=<已配置>
NEXT_PUBLIC_SUPABASE_URL=https://gbkallzbksmaahzvxezq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_rEDFDKwNNVJM9u-W4CWkOA_Jdec3qzS
NEXT_PUBLIC_APP_URL=https://dishlens.wukongmkt.com
AI_PROVIDER=qwen
```
