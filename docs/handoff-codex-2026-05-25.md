# DishLens Codex 交接文档

> 日期：2026-05-25
> 上一版交接：docs/handoff-2025-05-22.md
> 仓库：https://github.com/songchunhui513-bit/dishlens
> 线上地址：https://dishlens.wukongmkt.com

---

## 当前状态总览

核心翻译功能完整可用，AI 翻译链路稳定。首页推荐、历史记录、收藏、每日推荐均已实现。本地知识库 1022 道菜已全部有内容，其中 298 道有本地图片。菜单翻译缓存（内存 LRU）已修复，重复上传同一菜单秒出结果。

---

## 本轮修复清单（2026-05-25）

### 已完成

| # | 问题 | 根因 | 修复 | 文件 |
|---|------|------|------|------|
| 1 | 布里塔奶酪图片重复 | dish-image-match.ts 中 burrata alias 太宽 | 缩小 alias 到具体菜名 | `src/lib/dish-image-match.ts` |
| 2 | 首页 badge/标签重叠 | hero 卡片内边距不够 | paddingTop: 18 | `src/components/home/HomePage.tsx` |
| 3 | 口味描述太简短 | dish-presentation.ts fallback 文案不够丰富 | 加长到 40-70 字，新增 isDrink/isFried 等分类 | `src/lib/dish-presentation.ts` |
| 4 | 最近翻译点不动 | HomePage 没有 onClick 处理 | 加 onRecentClick prop | `src/components/home/HomePage.tsx` + `src/app/page.tsx` |
| 5 | Hydration mismatch | localStorage 在 SSR 时不可用 | mounted 状态 + typeof window 检查 | `src/app/page.tsx` |
| 6 | 说明页显示"未识别到" | ResultsPage 没有处理 page_type=info | 三路渲染：菜品/说明页/失败 | `src/components/results/ResultsPage.tsx` |
| 7 | Qwen prompt 输出太短 | prompt 对字段字数要求不够 | 加长到 40-70/25-40/25-40 字 | `src/lib/ai/qwen.ts` |
| 8 | 菜单缓存不生效 | Supabase translations 插入被 user_id NOT NULL + RLS 静默拒绝 | 改用内存 LRU 缓存 | `route.ts` |
| 9 | 咖啡显示错图错推荐 | 无 isDrink 分类 + isHearty 误匹配 | 新增 isDrink + 修复 isHearty + drink imageRules | `dish-presentation.ts` |
| 10 | 奶酪显示牛排图 | Supabase 缓存 AI 图优先级高于正确本地图 | localMatch 优先于 existing.ai_image_url | `route.ts` |
| 11 | 火腿/香肠显沙拉/牛排 | "jambon de parme" 错误映射到 salade-chez-louis | 修复 ALIASES，映射到 charcuterie-francaise | `dish-image-match.ts` |
| 12 | 知识库图片空白 | 724 张 Pollinations 动态 URL 浏览器加载不稳定 | isLocalImageUrl 只接受 /dishes/ 本地路径 | `dish-image-match.ts` |
| 13 | 图片持久化不工作 | 新菜品（temp- ID）生成图片后不写 dishes 表 | 新菜品 INSERT、已有菜品 UPDATE | `route.ts` |
| 14 | AI 生图 prompt 不精确 | 中文 prompt 太泛 | 改英文 prompt + 菜名 + 食材 + 摄影参数 | `image-gen.ts` |
| 15 | AI 生图等待时显示真实占位图 | 前端无“图片生成中”状态，直接走 Unsplash fallback | 新增 `DishImageWithLoading`，按甜点/汤/饮品/面/主菜显示品牌 SVG 动画 | `src/components/shared/DishImageWithLoading.tsx` |
| 16 | 生成图复用不稳 | Supabase `dishes` 表 RLS 可能拦截匿名写入，且只按 `name_original` 精确查 | 先查本地知识库，再查确定性本地生成图缓存，再查 DB；生成后写入 `public/generated-dishes/`，有 service role 时同步 Supabase | `route.ts` + `supabase-storage.ts` |
| 17 | 饮品/汤类生图不准 | prompt 固定要求“白瓷盘摆拍” | 新增 `classifyDishImageKind`，饮品用杯/玻璃杯构图，汤类用碗/汤面构图，甜点单独构图 | `src/lib/ai/image-gen.ts` |
| 18 | 详情页打开后收不到后台生图更新 | 轮询只在 results 页运行 | results/detail 都轮询，并同步更新 `selectedDish` | `src/app/page.tsx` |

---

## 图片系统架构（重点理解）

### 三层图片优先级（后端 route.ts 分配）

```
1. 本地知识库图片（/dishes/*.png，298 张）
   └─ matchDishKnowledgeImage() → DIRECT_ALIASES → token 模糊匹配
   └─ 最可靠，优先级最高

2. Supabase dishes 表缓存的 AI 图片
   └─ 同名菜品（name_original）已有 ai_image_url → 直接复用
   └─ 避免重复生图

3. AI 生图（Wan API / Pollinations）
   └─ 仅对没有本地图也没有缓存图的菜品触发生图
   └─ 生成后先写 ECS 本地 public/generated-dishes，再尝试 INSERT/UPDATE dishes 表，下次复用
```

代码位置 `route.ts` line 230：
```typescript
const imageUrl = localMatch?.card || existing?.ai_image_url || null;
```

### 前端展示链路（getDishImageUrl in dish-presentation.ts）

```
1. image_source === "user" → 用户上传图
2. matchLocalImage() → 本地知识库图
3. existingImage (ai_image_url) → Supabase 缓存图
4. imageRules (Unsplash) → 临时占位图
5. diverseFallbacks → 随机食物图
```

### isLocalImageUrl 约束（铁律）

**只接受 `/dishes/` 开头的本地路径**。知识库中 724 条 Pollinations 动态 URL 不能用——浏览器加载不稳定、URL 过长（500+ chars）、可能生成失败。这 724 张需要下载为本地文件。

### 关键文件

| 文件 | 职责 |
|------|------|
| `src/lib/dish-image-match.ts` | 知识库图片匹配（DIRECT_ALIASES + token 模糊匹配） |
| `src/lib/dish-presentation.ts` | 前端图片 URL 解析 + 菜品洞察文案 + imageRules |
| `src/lib/ai/image-gen.ts` | AI 图片生成（Wan API + Pollinations fallback） |
| `src/app/api/v1/translate/menu/route.ts` | 翻译 API 主流程 + 图片分配 + 后台生图 + 缓存 |
| `src/lib/dish-image-persistence.ts` | storageId 生成 |
| `src/lib/storage/supabase-storage.ts` | Supabase Storage 上传 |

---

## 菜单翻译缓存

- **方案**：内存 LRU Map（`translationCache`），最多 50 条，TTL 30 分钟
- **Key**：`filename:size` 的哈希（跨编码稳定，不受 base64 变化影响）
- **位置**：`route.ts` 顶部定义
- **原 Supabase translations 表失败原因**：`user_id NOT NULL` + RLS 要求 `auth.uid() = user_id`，无登录态时 INSERT 失败且错误被 `.then(() => {}, () => {})` 静默吞掉

---

## ⚠️ P0 重点遗留：AI 生图加载状态

### 状态：已完成

已实现 `src/components/shared/DishImageWithLoading.tsx`：
- 列表卡片 68×68 与详情页 200px Hero 都使用同一组件。
- `isDishImagePending()` 判断没有本地图/稳定 AI 图时显示加载动画，不再显示 Unsplash 假食物图。
- 动画按 `dessert` / `soup` / `drink` / `pasta` / `main` 分类选不同手绘 SVG。
- AI 图片轮询回来后组件自然 fade in 真实图。

### 原问题描述

当菜品没有本地图片也没有缓存图片时，前端显示 imageRules 的 Unsplash 占位图（真实食物照片）。这会**误导用户以为是菜品实际图片**。AI 生图在后台完成后通过前端轮询替换，但初始展示不准确。

### 需求规格

1. 没有图片的菜品，初始应显示**加载状态动画**（不是真实食物照片）
2. 加载动画风格必须与识别页食物角色动画（`FoodCharacters.tsx`）一致：暖奶油底色 `#FFF5E9` + 棕色描边 `#D4A574` + 橙色星星 `#FF9F1C` + 手绘 SVG + 柔和微浮动
3. **不能用 shimmer/骨架屏**（太 generic，没有品牌感）
4. **不能用真实食物图片**（误导）
5. AI 图片生成完成后，fade out 加载动画 → fade in 真实图片
6. 原型文件参考：`_temp/dish-ai-loading-prototype.html`（已做但用户不满意，需重新设计）

### 涉及两个位置

- **列表卡片**：68×68 图片区域（`ResultsPage.tsx` line 224）
- **详情页 Hero**：全宽 200px 高（`DishDetailPage.tsx` line 138）

### 实现步骤

1. **新增判断函数** `src/lib/dish-presentation.ts`：
   ```typescript
   export function isPlaceholderImage(dish: Dish): boolean {
     // 本地图和 Supabase 缓存图都不是占位图
     const localImage = matchLocalImage(dish);
     if (localImage) return false;
     const existingImage = dish.ai_image_url || (dish as any).image_url;
     if (existingImage && !existingImage.includes("unsplash.com")) return false;
     return true;
   }
   ```

2. **新建组件** `src/components/shared/DishImageWithLoading.tsx`：
   - 接收 `dish` + `size` ("card" | "hero")
   - 内部调用 `isPlaceholderImage(dish)` 判断是否显示加载态
   - 加载态：暖奶油底色 + 手绘 SVG 画盘动画（参考 FoodCharacters 风格）
   - 正常态：`next/image` 显示真实图片
   - 过渡：AI 图片到达后 fade out 加载态 → fade in 图片

3. **替换 ResultsPage.tsx** line 224 的 Image 标签为 DishImageWithLoading

4. **替换 DishDetailPage.tsx** line 138 的 Image 标签为 DishImageWithLoading

5. **新增 CSS 动画** `src/app/globals.css`：画笔描边、色彩渐现、星星闪烁等 keyframes

### 设计参考

- 食物角色动画：`src/components/results/FoodCharacters.tsx`
- CSS keyframes：`src/app/globals.css` line 111-132（steamA、bowlFloat、sparkleA 等）
- v7 设计 token：`globals.css` :root 变量
- 动画参数：duration 150-400ms，无 bouncy/overshoot easings

---

## P1 遗留事项

### 1. 图片持久化验证
- 已新增 ECS 本地确定性缓存：`public/generated-dishes/<storageId>.png`
- `getCachedDishImageUrl()` 会先查本地文件，再查 Supabase Storage
- 仍建议后续补齐 `SUPABASE_SERVICE_ROLE_KEY`，让 DB 行也能稳定写入

### 2. 知识库图片本地化（724 张）
- 724/1022 道菜只有 Pollinations URL，需下载为 `/dishes/*.png`
- 写脚本批量下载 → 更新 `public/dish-knowledge-db.json` 的 card/hero 字段
- 下载后 `isLocalImageUrl` 就能匹配更多菜

### 3. Supabase dishes 表 RLS
- 当前 INSERT 可能被 RLS 阻止（匿名用户无 auth.uid）
- 解决方案：用 service_role client 或调整 RLS 策略允许匿名 INSERT
- 检查文件：`supabase/schema.sql` line 263

### 4. dishes 表脏数据清理
- 之前错误生成的图片（牛排配给了博洛尼亚香肠等）仍在表中
- SQL 清理：`DELETE FROM dishes WHERE image_source = 'ai' AND ai_image_url LIKE '%unsplash%'`

### 5. AI 生图质量验证
- prompt 已改为英文，需验证 Wan API 对英文 prompt 效果
- 对常见菜类（蛋/粥/汤/面包）做 10 道 A/B 测试

---

## P2 遗留事项

| 事项 | 说明 |
|------|------|
| 用户认证 UI | AuthModal.tsx 未创建，收藏/历史需登录才能持久化到云端 |
| localStorage 历史上限 | 无上限，建议限制 50 条 |
| 每日推荐降级 | Open-Meteo 需地理位置权限，拒绝时已降级 |
| PWA manifest | 缺 manifest.json，无法"添加到主屏幕" |
| 错误监控 | 无 Sentry，建议接入 |

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
ssh root@8.133.168.91
cd /opt/dishlens && git pull && npm run build && pm2 restart dishlens
pm2 logs dishlens --lines 50
```

## 环境变量

```
QWEN_API_KEY=<server>
GEMINI_API_KEY=<server>
SUPABASE_URL=https://gbkallzbksmaahzvxezq.supabase.co
SUPABASE_ANON_KEY=sb_publishable_rEDFDKwNNVJM9u-W4CWkOA_Jdec3qzS
NEXT_PUBLIC_SUPABASE_URL=https://gbkallzbksmaahzvxezvxezq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_rEDFDKwNNVJM9u-W4CWkOA_Jdec3qzS
NEXT_PUBLIC_APP_URL=https://dishlens.wukongmkt.com
AI_PROVIDER=qwen
```

## 绝对不能做

1. **不要改 UI 组件的视觉设计**（颜色、字体、间距、圆角、动画参数）
2. **不要删 Nginx default 配置**（服务于 wukongmkt.com 主域名）
3. **不要修改 globals.css 设计 token**
4. **isLocalImageUrl 只接受 `/dishes/` 路径**
