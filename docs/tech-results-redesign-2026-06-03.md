# DishLens 菜单结果页重设计 · 技术文档

> 日期：2026-06-03
> 工程：claude
> 范围：菜单结果页重构（前端 + AI prompt）

---

## 1. 总体架构

```
[Photo Upload]
     │
     ▼
[POST /api/v1/translate/menu]
     │
     ├── Qwen VL (扩展 prompt) ───► dishes[]
     │                          ──► metadata.restaurant
     │                          ──► metadata.insight
     │                          ──► metadata.signature
     │
     ▼
[Supabase / In-memory cache]
     │
     ▼
[Frontend: ResultsPage]
     ├── SummaryInsightCard
     ├── CategoryTabs（横滑导航）
     ├── DishList（过滤后菜品）
     └── FloatingBar
```

---

## 2. AI Prompt 扩展（核心改动）

### 文件：`src/lib/ai/qwen.ts`

在现有 `VL_SYSTEM_PROMPT_FULL` 之后追加菜单级元数据要求：

```typescript
// 在现有 dishes 输出之外，新增 menu_metadata 字段

const MENU_METADATA_INSTRUCTION = `
Additionally, after analyzing ALL dishes, generate menu_metadata:
{
  "restaurant": {
    "display_name": "餐厅名 + 类型，如「巴黎小馆 Le Petit Bistro」",
    "restaurant_type": "小馆 / 酒馆 / 街边店 / 米其林等",
    "rating_estimate": 0.0-5.0 基于菜品质量推断
  },
  "insight": {
    "summary": "30-60 字总结：本店料理风格 + 招牌特色 + 口味基调",
    "occasion_tags": ["约会小聚", "朋友聚餐", "配红酒", ...],  // 3-5 个
    "cuisine_style": "勃艮第料理 / 江浙菜 / 关东料理 等"
  },
  "signature": {
    "dish_indexes": [0, 2],  // 招牌菜的 dish 在 dishes 数组中的 index
    "reason": "10-25 字推荐理由"
  }
}

Output ONLY valid JSON with both dishes and menu_metadata at top level:
{
  "dishes": [...],
  "menu_metadata": {...},
  "page_label": "...",
  "page_type": "menu",
  "source_language": "..."
}
`;
```

### 类型定义新增

文件：`src/types/index.ts`

```typescript
export interface RestaurantMeta {
  display_name: string;
  restaurant_type: string;
  rating_estimate: number;
}

export interface MenuInsight {
  summary: string;
  occasion_tags: string[];
  cuisine_style: string;
}

export interface SignatureRecommendation {
  dish_ids: string[];  // 注意：后端将 indexes 转为 dish.id
  reason: string;
}

export interface TranslationResultMetadata {
  source_language: string;
  target_language?: string;
  total_dishes: number;
  cached: boolean;
  processing_time_ms?: number;
  enrichment_status?: string;
  enrichment_time_ms?: number;
  // 新增
  restaurant?: RestaurantMeta;
  insight?: MenuInsight;
  signature?: SignatureRecommendation;
}
```

### Index → dish_id 转换

`src/app/api/v1/translate/menu/route.ts` 在拿到 AI 输出后：

```typescript
const dishes = analysisResult.dishes;
const sigIndexes = analysisResult.menu_metadata?.signature?.dish_indexes || [];
const signature = {
  dish_ids: sigIndexes.map(i => dishes[i]?.id).filter(Boolean),
  reason: analysisResult.menu_metadata?.signature?.reason || ""
};
```

---

## 3. 分类逻辑实现

新建文件：`src/lib/results-categories.ts`

```typescript
import type { Dish, TranslationResult, SignatureRecommendation } from "@/types";
import { isVegetarianDish } from "@/lib/dish-presentation";

export type CategoryKey = 'all' | 'must_order' | 'ai_recommend' | 'girl_favorite'
  | 'appetizer' | 'main' | 'staple' | 'dessert' | 'drink';

export interface CategoryDef {
  key: CategoryKey;
  label: string;
  count: number;
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  all: '全部',
  must_order: '本店必点',
  ai_recommend: 'AI 推荐',
  girl_favorite: '女生喜欢',
  appetizer: '前菜',
  main: '主菜',
  staple: '主食',
  dessert: '甜点',
  drink: '饮品',
};

const STAPLE_CATEGORIES = new Set(['noodle', 'rice', 'pasta', 'stew']);

function isGirlFavorite(dish: Dish): boolean {
  const text = [
    dish.description?.zh || '',
    dish.description?.en || '',
    ...(dish.taste_profile || []),
  ].join(' ').toLowerCase();
  if (dish.category === 'dessert') return true;
  return /清爽|清淡|甜|温和|轻盈|清新|fresh|light|sweet|mild/.test(text);
}

function dishCategoryKey(category?: string): CategoryKey | null {
  if (!category) return null;
  if (category === 'appetizer') return 'appetizer';
  if (category === 'main') return 'main';
  if (STAPLE_CATEGORIES.has(category)) return 'staple';
  if (category === 'dessert') return 'dessert';
  if (category === 'drink') return 'drink';
  return null;
}

export function classifyDish(
  dish: Dish,
  signature?: SignatureRecommendation
): CategoryKey[] {
  const cats: CategoryKey[] = ['all'];

  if (signature?.dish_ids?.includes(dish.id)) cats.push('must_order');
  if ((dish.rating_avg || 0) >= 4.0) cats.push('ai_recommend');
  if (isGirlFavorite(dish)) cats.push('girl_favorite');

  const menuCat = dishCategoryKey(dish.category);
  if (menuCat) cats.push(menuCat);

  return cats;
}

export function buildCategoryList(result: TranslationResult | null): CategoryDef[] {
  if (!result) return [];
  const allDishes = (result.pages || []).flatMap(p => p.dishes || []);
  const signature = result.metadata?.signature;

  const counts: Record<CategoryKey, number> = {
    all: 0, must_order: 0, ai_recommend: 0, girl_favorite: 0,
    appetizer: 0, main: 0, staple: 0, dessert: 0, drink: 0,
  };

  for (const dish of allDishes) {
    const cats = classifyDish(dish, signature);
    for (const k of cats) counts[k]++;
  }

  // Order: all + smart filters + menu structure
  const order: CategoryKey[] = [
    'all', 'must_order', 'ai_recommend', 'girl_favorite',
    'appetizer', 'main', 'staple', 'dessert', 'drink',
  ];

  return order
    .filter(k => counts[k] > 0 || k === 'all')
    .map(k => ({ key: k, label: CATEGORY_LABELS[k], count: counts[k] }));
}

export function filterDishesByCategory(
  result: TranslationResult | null,
  selected: CategoryKey
): Dish[] {
  if (!result) return [];
  const allDishes = (result.pages || []).flatMap(p => p.dishes || []);
  const signature = result.metadata?.signature;
  if (selected === 'all') return allDishes;
  return allDishes.filter(d => classifyDish(d, signature).includes(selected));
}
```

---

## 4. 插画组件

新建文件：`src/components/shared/CuisineIllustration.tsx`

按 source_lang 切换 SVG，size 可配置。复用已有的 SVG 路径。

```typescript
type Lang = 'fr' | 'ja' | 'it' | 'ko' | 'th' | 'es' | 'zh' | 'de' | string;

interface Props {
  lang: Lang;
  size?: number; // 32 / 42
}

export default function CuisineIllustration({ lang, size = 32 }: Props) {
  // 渲染对应国家的 SVG
}
```

法国插画（截图采用版本）：椭圆盘 + 5 彩蔬菜 + 法棍。

---

## 5. ResultsPage 改造

### 新增 props
```typescript
// 已存在的 props 不变
selectedCategory?: CategoryKey;
onCategoryChange?: (cat: CategoryKey) => void;
```

### 内部新增 useState
```typescript
const [selectedCat, setSelectedCat] = useState<CategoryKey>('all');
```

### 新增子组件
- `SummaryInsightCard` — 摘要+洞察合并卡片
- `CategoryTabs` — 横滑分类
- 菜品列表用 `filterDishesByCategory(result, selectedCat)` 过滤

---

## 6. AI Fallback 策略

如果 AI 输出没有 `menu_metadata`（老缓存或 AI 失败）：

```typescript
function buildFallbackInsight(result: TranslationResult): MenuInsight {
  const lang = result.metadata?.source_language || 'en';
  const langName = sourceLanguageName(lang);
  return {
    summary: `这是一份${langName}菜单，包含 ${result.metadata.total_dishes} 道菜品。`,
    occasion_tags: [],  // 空标签优于错误标签
    cuisine_style: langName,
  };
}

function buildFallbackSignature(result: TranslationResult): SignatureRecommendation {
  const all = (result.pages || []).flatMap(p => p.dishes || []);
  // Take top 2 by rating
  const top = [...all]
    .sort((a,b) => (b.rating_avg || 0) - (a.rating_avg || 0))
    .slice(0, 2);
  return {
    dish_ids: top.map(d => d.id),
    reason: '基于食客评分推荐',
  };
}
```

---

## 7. 性能优化

- AI 调用 vs 翻译：currently sequential（翻译 → 菜品标记 → 元数据）。本期把元数据合并到主翻译 prompt 中，**单次调用解决**。
- 缓存策略：metadata 跟随 dishes 缓存在 Supabase 的 task 行中
- 客户端：useMemo 包装 `buildCategoryList` 和 `filterDishesByCategory`

---

## 8. 测试计划

### 单元
- `classifyDish` 各种 category 情况
- `filterDishesByCategory` 各分类过滤
- `buildCategoryList` 数量统计

### 集成
- 用真实法语/日语菜单测试，验证 AI 输出包含 menu_metadata
- 切换分类 → 列表过滤
- 没有 metadata 的旧菜单 → fallback 显示

### 端到端
- 拍照 → 翻译 → 结果页显示插画 + 摘要 + 招牌 + 标签
- 切换分类 → 列表过滤
- 加菜 → 浮动条 → 给店员核对

---

## 9. 风险

| 风险 | 缓解 |
|------|------|
| AI 输出 occasion_tags 不符合预期 | 设置 5 个常见模板 + AI 选择 |
| 招牌推荐选 0 道菜 | fallback 用 rating_avg top 2 |
| 老菜单缓存没有 metadata | fallback 函数生成 |
| Prompt 变长可能影响 token 成本 | 评估增加约 200 tokens，可接受 |

---

## 10. 文件改动清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/types/index.ts` | 修改 | 新增 RestaurantMeta / MenuInsight / SignatureRecommendation |
| `src/lib/ai/qwen.ts` | 修改 | Prompt 扩展，添加 menu_metadata 输出 |
| `src/app/api/v1/translate/menu/route.ts` | 修改 | 解析 menu_metadata，转 indexes → ids |
| `src/lib/results-categories.ts` | 新增 | 分类逻辑 |
| `src/lib/results-insight-fallback.ts` | 新增 | AI 失败时的 fallback |
| `src/components/shared/CuisineIllustration.tsx` | 新增 | 多语言插画 |
| `src/components/results/SummaryInsightCard.tsx` | 新增 | 摘要+洞察卡片 |
| `src/components/results/CategoryTabs.tsx` | 新增 | 横滑分类 |
| `src/components/results/ResultsPage.tsx` | 修改 | 整合新组件 |

预计代码量：约 600 行新增 + 80 行修改。
