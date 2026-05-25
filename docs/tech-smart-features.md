# DishLens 智能推荐 + 历史 + 收藏 — 技术设计文档

> 版本：v1.0 | 日期：2026-05-23
> 平台：H5 网页版（浏览器 Web API）
> 前端框架：Next.js 16 + React 19 + TypeScript
> 存储：localStorage（无后端依赖）

---

## 一、架构概览

```
┌──────────────────────────────────────────────────┐
│                   page.tsx (状态中心)              │
│  screen state + localStorage 读写 + props 分发     │
├──────────┬──────────┬──────────┬─────────────────┤
│ HomePage │HistoryPage│FavoritesPage│DishDetailPage │
│(推荐+最近)│(翻译历史) │(收藏列表)  │(收藏按钮)     │
├──────────┴──────────┴──────────┴─────────────────┤
│              localStorage 封装层                   │
│  dishlens_history / dishlens_favorites / 缓存      │
├───────────────────────────────────────────────────┤
│          useDailyRecommendation (Hook)             │
│  推荐引擎 ← 天气 API ← 地理位置                    │
├───────────────────────────────────────────────────┤
│          dishKnowledgeDb (100→1022 道)             │
└───────────────────────────────────────────────────┘
```

---

## 二、新增模块

### 2.1 `src/lib/local-storage.ts` — 存储层

```ts
// 统一 localStorage 读写，带 JSON 序列化 + 容量保护
export function getHistory(): HistoryEntry[]
export function addHistory(entry: HistoryEntry): void
export function getFavorites(): FavoriteDish[]
export function addFavorite(dish: FavoriteDish): void
export function removeFavorite(dishId: string): void
export function isFavorited(dishId: string): boolean
export function getCachedRecommendation(date: string): DailyDish | null
export function setCachedRecommendation(date: string, dish: DailyDish): void
export function getCachedWeather(date: string): WeatherData | null
export function setCachedWeather(date: string, weather: WeatherData): void
```

**容量保护**：历史超过 100 条自动淘汰最旧的。写入失败（localStorage 满）静默清理最旧数据。

### 2.2 `src/lib/recommendation.ts` — 推荐引擎

纯函数，无副作用，可独立测试。

```ts
interface RecommendationContext {
  hour: number;           // 0-23
  dayOfWeek: number;      // 0-6
  dateStr: string;        // YYYY-MM-DD
  temperature?: number;   // °C
  country?: string;       // ISO 国家代码
}

function getDailyRecommendation(ctx: RecommendationContext): DishKnowledgeEntry
```

**算法流程**：

1. 从 `dishKnowledgeDb` 构建候选池
2. 按时段过滤 category：
   - 6-10: `["breakfast", "appetizer", "soup", "bread"]`
   - 11-14: `["main", "soup", "noodle", "rice"]`
   - 15-17: `["dessert", "snack", "drink", "appetizer"]`
   - 18-23: `["main", "soup", "noodle", "rice"]`
3. 按星期调整：周末加权高热量/甜品，工作日加权轻食
4. 按天气调整：冷天加权汤/炖，热天加权沙拉/甜品
5. 按地区过滤：有国家代码时优先对应菜系
6. 用 `hash(dateStr) % pool.length` 选出最终菜品（同一天稳定）

**降级链**：country 缺失 → 不限菜系；temperature 缺失 → 不限温度；仅 hour+dayOfWeek 必选。

### 2.3 `src/lib/weather.ts` — 天气 API

```ts
interface WeatherData {
  temperature: number;   // °C
  weatherCode: number;   // WMO 天气代码
}

async function getWeather(lat: number, lon: number): Promise<WeatherData | null>
```

**实现**：调用 Open-Meteo API（`https://api.open-meteo.com/v1/forecast`）

- 免费，无需 API key
- 支持 CORS（浏览器直接 fetch）
- 3 秒超时，失败返回 null
- 结果缓存到 localStorage，当天有效

### 2.4 `src/hooks/useDailyRecommendation.ts` — React Hook

```ts
function useDailyRecommendation(): {
  dish: DishKnowledgeEntry | null;
  loading: boolean;
}
```

**执行流程**：
1. 检查 localStorage 缓存（当天 key）
2. 有缓存 → 直接返回
3. 无缓存 → 并行获取天气 + 定位
4. 定位成功 → 调 Open-Meteo 获取天气
5. 组装 context → 调推荐引擎
6. 写入缓存 → 返回结果
7. 任何步骤失败 → 降级继续

---

## 三、数据流

### 3.1 推荐数据流

```
useDailyRecommendation()
  → localStorage 缓存检查
  → navigator.geolocation.getCurrentPosition() (5s timeout)
  → fetch Open-Meteo (3s timeout)
  → getDailyRecommendation(context)
  → localStorage 缓存写入
  → 返回 dish → page.tsx → HomePage (dailyDish prop)
```

### 3.2 历史数据流

```
翻译完成 (page.tsx handleAnalyze)
  → TranslationResult 提取 HistoryEntry
  → addHistory(entry) 写入 localStorage
  → 切换到 history 屏时
  → getHistory() 从 localStorage 读取
  → 传入 HistoryPage props
  → 首页 recentHistory = history.slice(0, 3)
```

### 3.3 收藏数据流

```
DishDetailPage 心形按钮点击
  → onToggleFavorite(dishId, !isFavorited) callback
  → page.tsx 调用 addFavorite()/removeFavorite()
  → localStorage 更新
  → 重新读取 favorites → 同步到所有页面
  → FavoritesPage 从 props 接收 favorites
```

---

## 四、类型定义（新增到 `src/types/index.ts`）

```ts
// localStorage 历史记录
export interface HistoryEntry {
  id: string;
  restaurant_name: string;
  city: string;
  dish_count: number;
  page_count: number;
  date: string;
  thumbnail: string;
  source_lang: string;
  target_lang: string;
}

// localStorage 收藏菜品
export interface FavoriteDish {
  id: string;
  name_original: string;
  name_zh: string;
  cuisine: string;
  image_url?: string;
  saved_at: string;
}
```

---

## 五、修改文件清单

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | 新增 HistoryEntry、FavoriteDish 类型 |
| `src/lib/local-storage.ts` | **新建** — localStorage 读写封装 |
| `src/lib/recommendation.ts` | **新建** — 推荐引擎纯函数 |
| `src/lib/weather.ts` | **新建** — Open-Meteo 天气 API |
| `src/hooks/useDailyRecommendation.ts` | **新建** — 推荐 React Hook |
| `src/components/home/HomePage.tsx` | hero 区数据从 `dailyDish` prop 读取 |
| `src/components/history/HistoryPage.tsx` | 去掉 mock，数据从 props 读取 |
| `src/components/favorites/FavoritesPage.tsx` | 去掉 mock，数据从 props 读取 |
| `src/components/dish/DishDetailPage.tsx` | 收藏状态从 props 控制 |
| `src/app/page.tsx` | 全局状态管理 + localStorage 读写 |

---

## 六、性能考量

| 项 | 说明 |
|------|------|
| 推荐计算 | < 1ms（遍历 1022 条 + 过滤，纯内存操作） |
| localStorage 读取 | < 1ms（JSON.parse 约 50KB） |
| 天气 API | 3s 超时 + 当天缓存，每天最多 1 次请求 |
| 地理位置 | 5s 超时 + 浏览器缓存，每次打开 app 最多 1 次 |
| 知识库体积 | 1022 条约 500KB JS，已在 bundle 中（静态 import） |

---

## 七、实施顺序

```
Phase 1: 基础设施
  ├─ src/lib/local-storage.ts
  ├─ src/lib/recommendation.ts
  ├─ src/lib/weather.ts
  ├─ src/hooks/useDailyRecommendation.ts
  └─ src/types/index.ts (新增类型)

Phase 2: 历史记录
  ├─ HistoryPage.tsx (接 localStorage)
  └─ page.tsx (历史状态管理 + 翻译后写入)

Phase 3: 收藏
  ├─ FavoritesPage.tsx (接 localStorage)
  ├─ DishDetailPage.tsx (心形联动)
  └─ page.tsx (收藏状态管理)

Phase 4: 每日推荐
  ├─ HomePage.tsx (hero 动态化)
  └─ page.tsx (接入 Hook)

Phase 5: 验证
  └─ build + lint + 完整流程测试
```
