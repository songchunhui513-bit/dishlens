# DishLens 智能推荐 + 历史 + 收藏 — 设计文档

> 版本：v1.0 | 日期：2026-05-23
> 设计规范：v7 Warm Editorial
> 平台：H5 网页版（393×852 viewport）
> 存储：localStorage（无用户登录体系）

---

## 一、设计目标

将首页「今日推荐」、翻译历史、菜品收藏从 mock/硬编码状态升级为真实数据驱动：

| 功能 | 当前状态 | 目标状态 |
|------|---------|---------|
| 今日推荐 | 硬编码 Boeuf Bourguignon | 基于时间/天气/地区智能推荐，每天自动换 |
| 翻译历史 | 4 条 mock 数据 | localStorage 存储真实翻译记录 |
| 菜品收藏 | 3 条 mock 数据 | localStorage 收藏，详情页心形联动 |
| 最近翻译 | 3 条硬编码 | 从历史记录取最近 3 条 |

---

## 二、功能设计

### 2.1 智能每日推荐

**推荐因子与权重：**

| 因子 | 数据来源 | 逻辑 | 优先级 |
|------|---------|------|--------|
| 时段 | `new Date().getHours()` | 6-10 早餐，11-14 主菜/汤，15-17 甜品/小吃，18-23 主菜/汤 | 必选 |
| 星期 | `new Date().getDay()` | 周末推高热量/甜品，工作日推轻食/沙拉 | 必选 |
| 天气 | Open-Meteo（免费，CORS 友好） | <10°C 推汤/炖，>28°C 推沙拉/甜品 | 可选，降级 |
| 地区 | `navigator.geolocation` → 反向查询 | 法国推法餐，日本推日料 | 可选，降级 |

**稳定性**：同一天看到同一道菜，次日换菜。

```
种子 = hash(日期字符串)
推荐池 = 按时段 + 天气 + 地区过滤 dishKnowledgeDb
最终推荐 = 推荐池[种子 % 推荐池.length]
```

**降级链**：天气获取失败 → 纯时间+随机；定位失败 → 不限菜系。

**缓存策略**：
- 推荐结果缓存到 localStorage `dishlens_daily_rec_{YYYY-MM-DD}`
- 天气缓存到 localStorage `dishlens_weather_{YYYY-MM-DD}`
- 当天重复打开直接读缓存

### 2.2 翻译历史

**数据结构**：
```ts
interface HistoryEntry {
  id: string;              // 翻译任务 ID
  restaurant_name: string;
  city: string;
  dish_count: number;
  page_count: number;
  date: string;            // ISO 日期
  thumbnail: string;       // 第一道菜的图片 URL
  source_lang: string;
  target_lang: string;
}
```

**存储**：localStorage `dishlens_history`，最多保留 100 条。

**展示**：
- 按月分组（与当前 mock 渲染逻辑一致）
- 每条记录显示：缩略图 + 餐厅名 + 城市名 + 菜品数 + 日期
- 空状态：显示引导文案「拍摄第一份菜单开始吧」

**写入时机**：翻译完成（`status === "done"`）时自动存入。

### 2.3 菜品收藏

**数据结构**：
```ts
interface FavoriteDish {
  id: string;
  name_original: string;
  name_zh: string;
  cuisine: string;
  image_url?: string;
  saved_at: string;        // 收藏时间
}
```

**存储**：localStorage `dishlens_favorites`，不设上限。

**交互**：
- 菜品详情页心形按钮：点击切换收藏状态（实心/空心）
- 收藏页：卡片列表，点击进入详情；长按/点击心形移除
- 空状态：显示引导文案「翻译菜单时收藏感兴趣的菜品」

---

## 三、UI 改动范围

**硬约束：不改 UI 组件的视觉设计（CSS/布局/动画）。只改数据源。**

| 组件 | 改动 |
|------|------|
| `HomePage.tsx` | hero 区文本/图片从 `dailyDish` prop 读取 |
| `HistoryPage.tsx` | 数据从 localStorage 读取，去掉 mock |
| `FavoritesPage.tsx` | 数据从 localStorage 读取，去掉 mock |
| `DishDetailPage.tsx` | 收藏状态从 prop 控制，去掉本地 useState |
| `page.tsx` | 全局状态管理 + localStorage 读写 |

---

## 四、HTML 设计稿

已完成并通过评审：`_temp/dishlens-new-features-preview.html`

包含 5 个屏幕：
1. 首页（智能推荐 hero 卡片 + 最近翻译 + 拍摄按钮）
2. 历史页（按月分组，缩略图）
3. 收藏页（菜品卡片列表）
4. 菜品详情页（收藏心形联动）
5. 设置页（饮食偏好标签）
