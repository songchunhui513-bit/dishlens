# DishLens ResultsPage 交接文档

> **日期**: 2026-06-04
> **交接给**: Codex
> **当前状态**: 多轮迭代后仍有视觉和数据问题未解决

---

## 1. 项目概览

DishLens 是一款 H5/PWA 移动端 AI 菜单翻译应用。核心技术栈：

- **Next.js 16** (App Router) + TypeScript strict
- **TailwindCSS 4** + 自定义 CSS 变量
- **Qwen VL** (DashScope) 做菜单 OCR + 翻译
- **Wan AI** (DashScope) 做菜品图片生成
- **Supabase** 做数据持久化
- **localStorage** 做客户端缓存（历史/收藏）

### 设计系统

```css
--bg: #FFF5E9; --card: #FEE6CB; --card-alt: #FFF0DD;
--ink: #2D2D2D; --ink-soft: #4A4A4A;
--primary: #4CAF50; --accent: #FF9F1C; --muted: #8A8A8A;
--rule: #E8D5C0; --veg-bg: rgba(76,175,80,.08);
--allergen-bg: rgba(255,159,28,.08);
--shadow: 0 2px 16px rgba(0,0,0,.05);

--font-display: "Source Serif 4", Georgia, serif;   /* 品牌/菜名 */
--font-body: "Poppins", -apple-system, sans-serif;     /* UI/按钮 */
--font-ui: "Inter", -apple-system, sans-serif;          /* 标签/说明 */

--radius-sm: 12px; --radius: 18px; --radius-lg: 24px;
```

**视口**: 393×852 (iPhone 15 Pro 尺寸)

---

## 2. 目标原型

**权威参考原型**（按优先级排列）:

| 文件 | 用途 |
|------|------|
| `_temp/results-c-compact-enriched.html` | **主原型** — 含 Insight Card + Category Tabs + Dish Cards + 招牌推荐 |
| `_temp/results-c-final.html` | 备用参考 — 不同布局变体（含数据行） |
| `_temp/results-c-additions-v3.html` | 备选 — 含更多交互细节 |

原型可在浏览器直接打开预览：`open _temp/results-c-compact-enriched.html`

### 原型关键设计要素

1. **Insight Card**（顶部统一卡片）:
   - 36×36 SVG 料理插画（圆角方形容器 + 边框）
   - 餐厅名：`"巴黎小馆 Le Petit Bistro"` 格式（城市+小馆 + 英文名）
   - ★ 评分徽章（accent 色）
   - 页数/菜品统计行
   - AI 洞察文字（30-60 字料理风格总结）
   - 场景标签（约会小聚/朋友聚餐/配红酒 等）
   - **招牌推荐行**：绿色底 + "招牌推荐" 标签 + 推荐菜名 — 理由

2. **Category Tabs**（横向滚动分类栏）:
   - 9个分类：全部/本店必点/AI推荐/女生喜欢/前菜/主菜/主食/甜点/饮品
   - 全部=64px、长标签=68px、短标签=60px 宽度
   - 选中态：veg-bg 底 + primary 色文字
   - 带数量徽章

3. **Dish Cards**（菜品列表卡片）:
   - 120×120 菜品图片（圆角 18px）
   - 序号（01, 02...）+ ★ 评分徽章（可选）
   - 中文翻译菜名（14px serif 800）
   - 原文菜名（8px italic）
   - AI 描述（8px UI 字体）
   - 标签行（食材/过敏原）
   - 价格（13px body 900）
   - 右下角 ＋ 按钮（30×30 圆形，absolute 定位，right:12/bottom:13）

4. **Floating Bar**（浮动已选栏）:
   - 右下角，半透明卡片底
   - 显示已选数量 + 总价

---

## 3. 核心文件清单

### 前端组件

| 文件 | 职责 |
|------|------|
| `src/components/results/ResultsPage.tsx` | **主结果页** — 整体布局、卡片渲染、分类切换 |
| `src/components/results/SummaryInsightCard.tsx` | **洞察卡片** — 餐厅信息+AI洞察+招牌推荐 |
| `src/components/results/CategoryTabs.tsx` | **分类标签栏** — 横向滚动分类选择 |
| `src/components/shared/CuisineIllustration.tsx` | **料理插画** — 9语种 SVG 插画 |
| `src/components/shared/DishImageWithLoading.tsx` | **菜品图片** — 带加载态的图片组件 |
| `src/components/order/OrderQuantityControl.tsx` | **数量控件** — 加减按钮（compact 模式=30×30） |
| `src/components/dish/DishDetailPage.tsx` | **菜品详情页** — 完整菜品信息 |

### 业务逻辑

| 文件 | 职责 |
|------|------|
| `src/lib/results-categories.ts` | **分类引擎** — classifyDish()/buildCategoryList()/filterDishesByCategory() |
| `src/lib/results-insight-fallback.ts` | **元数据提取** — extractRestaurantMeta/extractMenuInsight/extractSignature |
| `src/lib/dish-presentation.ts` | **内容呈现** — getDishText/getDishInsight/getDishImageUrl/isVegetarianDish |
| `src/lib/order-state.ts` | **点单逻辑** — parseDishPrice/extractPriceFromText/buildOrderItems |
| `src/lib/ai/qwen.ts` | **AI 调用** — Qwen VL prompt + API 封装 |

### API 路由

| 文件 | 职责 |
|------|------|
| `src/app/api/v1/translate/menu/route.ts` | **翻译 API** — 接收图片、调 AI、存缓存、返回结果 |

### 类型定义

| 文件 | 关键类型 |
|------|------|
| `src/types/index.ts` | `Dish`, `TranslationResult`, `RestaurantMeta`, `MenuInsight`, `SignatureRecommendation` |

---

## 4. 已识别的所有问题及根因

### 问题 1: 招牌推荐不显示 🔴

**现象**: SummaryInsightCard 底部的绿色"招牌推荐"区域不出现。

**根因链路**:
1. AI 返回的 `menu_metadata.signature` 在 API route 中被丢弃
   - `results[i]` 赋值时没有保留 `raw.menu_metadata`
2. `extractSignature()` 得不到 AI 数据 → 走 3 级 fallback
3. Fallback 需要 dish 有 `rating_avg >= 4.0` → 如果 AI 没给评分 → 取前2道
4. `SummaryInsightCard.hasSignature` 条件过严：`!!(sigDishes && signature?.reason)`
   - 即使有菜名，没有 AI reason 也不显示

**已做修复**: 
- `route.ts` 三处 `results[i]` 赋值都加上了 `menu_metadata`
- `SummaryInsightCard` 改为 `hasSignature = !!sigDishes`，reason 用 "值得一试" 兜底

**为什么可能还是不显示**:
- 旧缓存数据没有 `menu_metadata` → 必须用全新照片 + 清 localStorage

### 问题 2: AI 不输出菜品的 category 字段 🔴

**现象**: 分类标签（前菜/主菜/主食/甜点/饮品）完全靠前端硬编码规则 `classifyDish()`，不准确。

**根因**: 旧版 AI prompt 没有要求输出 `category` 字段。

**已做修复**:
- `MenuDishAnalysis` 接口加 `category?: string`
- AI prompt 加 `category` 指令（`appetizer/main/staple/dessert/drink`）
- `dishCategoryKey()` 加了模糊中文匹配兜底（如 "前菜/开胃/starter"）

**为什么可能还是不生效**:
- AI 需要新 prompt → 必须用全新照片触发新 AI 调用
- 旧缓存数据中的 dish 没有 category 字段

### 问题 3: 图片匹配错误 — 奶酪/酒类 🟡

**现象**: "意大利奶酪拼盘" 显示酒的图片（Unsplash 酒类通用图）。

**根因**: `dish-presentation.ts` 的 `imageRules` 中：
- 没有奶酪/冷切拼盘的专用规则
- `["酒", "alcohol", "liquor", ...]` 规则太宽，AI 描述 "适合佐酒" 就会命中

**已做修复**:
- 在酒规则前插入奶酪/冷切拼盘专用规则（含 20+ 关键词）
- 将酒规则的 `"酒"` 裸通配替换为具体酒类名称

### 问题 4: 排版溢出/卡片无边距 🟡

**现象**: 卡片横向溢出、挨着屏幕边缘没有留白。

**根因**:
- 滚动容器用 `overflow-auto` 允许横向滚动
- 卡片直接渲染在 scroll div 里，没有 `margin: 0 16px` 包裹
- 分区标题 `margin: "8px 0 6px"` 缺少水平边距

**已做修复**:
- 滚动容器: `overflow-y-auto` + `overflowX: hidden`
- 卡片列表包裹在 `<div style="margin:0 16px">` 里
- 分区标题: `margin: "10px 16px 6px"`

### 问题 5: 价格符号硬编码 € 🔴

**现象**: 所有菜单都显示欧元符号，日元菜单也显示 €。

**根因**: `ResultsPage.tsx:370` 写死了 `€`:
```typescript
const price = dish.name_original?.match(/[\d,.]+/);
return price ? `${price[0]}€` : "";
```

**已做修复**: 改用 `parseDishPrice(dish)` 从 order-state.ts 导入，自动识别 ¥/€/$/円。

### 问题 6: CategoryTab 宽度不匹配原型 🟢

**已做修复**: `CategoryTabs.tsx` 加了 `WIDE_LABELS` 集合和 `minWidth` 逻辑（64/68/60）。

### 问题 7: ＋ 按钮尺寸不匹配原型 🟢

**已做修复**: `OrderQuantityControl.tsx` compact 模式改为 30×30、`borderRadius: 999`、`＋` 全角字符。

### 问题 8: AI 洞察 fallback 太简单 🟡

**已做修复**: `SummaryInsightCard.tsx` 加了 `CUISINE_INSIGHT` 9语种专属洞察模板。

---

## 5. 当前实际状态 vs 原型差距

### SummaryInsightCard 差距

| 元素 | 原型 | 当前实现 |
|------|------|----------|
| 整体结构 | 插图+名字+评分在一行 | ✅ 已匹配 |
| 餐厅名格式 | "巴黎小馆 Le Petit Bistro" | ✅ `CITY_NAMES` fallback |
| AI 洞察文字 | 30-60字料理风格描述 | ⚠️ 依赖 AI 数据，fallback 已改进 |
| 场景标签 | 3-5个胶囊标签 | ✅ `PREDEFINED_TAGS` 按语言 |
| 招牌推荐行 | 绿色底+推荐菜名+理由 | ⚠️ 修复了但需要新数据验证 |
| 插图容器 | 36×36 圆角方框+边框 | ✅ `fr-illus` 样式已匹配 |

### CategoryTabs 差距

| 元素 | 原型 | 当前实现 |
|------|------|----------|
| 分类数量 | 9个（含主食） | ✅ 始终显示全部9个 |
| 宽度差异化 | 64/68/60px | ✅ 已匹配 |
| 数量徽章 | 每个标签下有数字 | ✅ |
| 分类标签名 | 本店必点/AI推荐/女生喜欢 | ⚠️ 需要 AI 提供 category 数据来准确计数 |

### Dish Card 差距

| 元素 | 原型 | 当前实现 |
|------|------|----------|
| 图片尺寸 | 120×120 | ✅ |
| 序号样式 | 01, 02... primary 色 | ✅ |
| ★ 评分徽章 | 评级 ≥ 4.0 时显示 | ✅ |
| 菜名 | 14px serif 800 | ✅ |
| 原文 | 8px italic | ✅ |
| 描述 | 8px UI 字体 | ✅ |
| 标签 | 食材+过敏原 | ✅ |
| 价格 | 13px body 900 | ⚠️ 已修复 parseDishPrice |
| ＋ 按钮 | 30×30 右下角 | ✅ |
| 卡片边距 | margin: 0 16px | ✅ 已加 wrapper |

### 全局布局差距

| 元素 | 原型 | 当前实现 |
|------|------|----------|
| 横向溢出 | hidden | ✅ |
| 底部留白 | 70px | ✅ |
| 浮动已选栏 | 右下角半透明 | ✅ |
| 分区标题 | margin: 10px 16px 6px | ✅ |

---

## 6. 为什么多轮修改后用户仍说"没改"

### 核心原因: 数据缓存链

```
用户拍照 → API 接收 → 检查内存缓存(30min TTL) → 命中即返回旧数据
                                              → 未命中 → 调 AI(新prompt) → 存缓存
```

旧数据的特点：
- 没有 `dish.category` → 分类全走前端规则
- 没有 `page.menu_metadata` → 招牌推荐无法提取
- `metadata.signature` 为 undefined → SummaryInsightCard 不显示
- `metadata.insight` 为 undefined → 使用 fallback 文本

### 验证代码修改是否生效的方法

```bash
# 1. 确认源码改动
grep -n "category.*appetizer\|main\|staple" src/lib/ai/qwen.ts
grep -n "menu_metadata.*raw" src/app/api/v1/translate/menu/route.ts
grep -n "parseDishPrice" src/components/results/ResultsPage.tsx

# 2. 确认编译产物
grep -rl "parseDishPrice" .next/

# 3. 确认服务运行
curl -s -o /dev/null -w "%{http_code}" http://localhost:3101

# 4. 确认无编译错误
npm run build 2>&1 | grep -i "error\|fail"
```

### 正确测试流程

```
1. 浏览器: DevTools → Application → Clear site data（清 localStorage）
2. 重启 dev server: lsof -ti:3101 | xargs kill -9 && npm run dev -- -p 3101
3. 用一张全新的菜单照片（从未在 DishLens 用过）
4. 等待 AI 翻译完成（30-60秒）
5. 查看结果页
```

---

## 7. 关键数据流

### AI Prompt → Dish 字段映射

```
AI 输出 (qwen.ts MenuDishAnalysis)     →  Dish 类型 (types/index.ts)
─────────────────────────────────────────────────────────────────
name_original                          →  name_original
name_translated                        →  name_translated (localized)
description                            →  description (localized)
recommendation                         →  recommendation (localized)
good_for                               →  good_for (localized)
caution                                →  caution (localized)
category (NEW)                         →  category
ingredients[]                          →  ingredients[]
allergens[]                            →  allergens[]
taste_profile[]                        →  taste_profile[]
confidence                             →  (not stored on Dish)
```

### AI menu_metadata → ResultMetadata 映射

```
AI 输出                                    →  ResultMetadata
──────────────────────────────────────────────────────────
menu_metadata.restaurant.display_name      →  restaurant.display_name
menu_metadata.restaurant.restaurant_type   →  restaurant.restaurant_type
menu_metadata.restaurant.rating_estimate   →  restaurant.rating_estimate
menu_metadata.insight.summary              →  insight.summary
menu_metadata.insight.occasion_tags[]      →  insight.occasion_tags[]
menu_metadata.insight.cuisine_style        →  insight.cuisine_style
menu_metadata.signature.dish_indexes[]     →  signature.dish_ids[] (按 index 转 id)
menu_metadata.signature.reason             →  signature.reason
```

**关键问题**: `menu_metadata` 在 `route.ts` 中通过 `(raw as unknown as Record<string, unknown>).menu_metadata` 传递，需要在三处 `results[i]` 赋值中都保留。

### 分类数据流

```
dish.category (from AI) → dishCategoryKey() → classifyDish() → CategoryKey Set
                          ↓
              "appetizer" → "appetizer"
              "main"      → "main"
              "staple"    → "staple"
              "dessert"   → "dessert"
              "drink"     → "drink"
              (fuzzy match 中文兜底)
```

---

## 8. 未完成的潜在工作

1. **Supabase 旧数据清理**: `dishes` 表中可能有旧 AI 生成的错误图片（如炭烤牛排显示酒杯图）
2. **在内存缓存加版本号**: 当前缓存无版本机制，代码更新后旧缓存仍然返回
3. **AI prompt 验证**: 确认 Qwen 是否真的开始输出 `category` 字段
4. **端到端测试**: 用一张全新法餐/意餐/日餐菜单完整走一遍流程
5. **响应式/边界情况**: 长菜名截断、无图片时的 placeholder、加载态骨架屏
6. **线上阿里云 Key 暂不更换**: 2026-06-04 已验证新阿里云 Key 支持 `qwen-plus`、`qwen-vl-max`、`wanx2.1-t2i-turbo`，并已仅替换本地 `.env.local`。线上环境变量先保持不变，待用户确认发布/切换窗口后再更新。

---

## 9. 快速启动命令

```bash
# 开发
cd /Users/julian/AI点菜/dishlens
npm run dev -- -p 3101

# 清理重建
rm -rf .next && npm run build

# 完全重置
lsof -ti:3101 | xargs kill -9
rm -rf .next
npm run build && npm run dev -- -p 3101

# 查看原型
open _temp/results-c-compact-enriched.html
open _temp/results-c-final.html
```

---

## 10. 联系人

- **产品/设计决策**: sch（用户）
- **项目路径**: `/Users/julian/AI点菜/dishlens`
- **原型路径**: `/Users/julian/AI点菜/dishlens/_temp/`
- **设计文档**: `/Users/julian/AI点菜/dishlens/docs/`
- **AGENTS.md**: 项目开发规范（设计 token、字体、禁止 emoji 等）
