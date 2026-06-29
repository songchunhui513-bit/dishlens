# DishLens 菜单结果页重设计 · PRD

> 日期：2026-06-03
> 产品经理：sch
> 范围：扫描菜单 → 翻译结果页
> 版本：v2.0

---

## 1. 背景

DishLens 当前的菜单结果页是一个单纯的菜品列表，AI 输出的 `recommendation` / `good_for` / `caution` 只在详情页展示。用户在结果页缺乏决策依据：
- 不知道这家店主打什么
- 不知道哪几道是必点
- 不知道菜单适合什么场景
- 不知道有没有自己能吃的

v2 目标是把 AI 上下文价值前置到结果页，让用户**不进详情页**就能完成关键决策。

---

## 2. 用户

| 用户 | 场景 | 决策点 |
|------|------|--------|
| 海外旅行者 | 在异国餐厅菜单前 | 点哪些不会踩雷 |
| 留学生 | 跟朋友聚餐 | 适合分享的菜 |
| 商务出差 | 单人快餐 | 性价比 / 招牌 |
| 素食/过敏人群 | 任何场合 | 我能吃什么 |

---

## 3. 功能需求

### US-001 餐厅画像识别

**As a** 旅行者
**I want to** 一眼看出这是什么餐厅
**So that** 我能判断这家店是不是符合我的期待

**验收**：
- AI 识别餐厅类型（小馆、酒馆、街边店、米其林等）
- AI 用 30-60 字总结这份菜单的特色
- AI 内容**必须基于实际菜品**生成，不能写死，不能用 fallback 模板套话

### US-002 智能分类筛选

**As a** 用户
**I want to** 按个性化维度筛选菜品
**So that** 我不用一道一道看完所有菜

**验收**：
- 横滑分类导航包含：全部 / 本店必点 / AI推荐 / 女生喜欢 / 前菜 / 主菜 / 主食 / 甜点 / 饮品
- 默认选中「全部」
- 每个分类显示真实数量统计
- 切换分类时，下方菜品列表实时过滤
- 分类判定逻辑全部基于 AI 字段，不能硬编码菜名

### US-003 招牌推荐

**As a** 第一次来这家餐厅
**I want to** 知道老板的招牌菜是哪几道
**So that** 我能体验最有特色的菜品

**验收**：
- AI 从全部菜品中挑选 1-3 道招牌
- 招牌判定依据：rating_avg + AI 关键词识别
- 招牌推荐文字由 AI 生成，包含推荐理由（10-25 字）
- 不能写死「勃艮第蜗牛、帕尔马火腿」这类示例

### US-004 场景化标签

**As a** 计划用餐场景的用户
**I want to** 知道这家菜单适合什么场合
**So that** 我能判断要不要约朋友来

**验收**：
- AI 输出 3-5 个场景标签（约会小聚 / 朋友聚餐 / 商务宴请 / 配红酒 / 配啤酒 等）
- 标签内容必须**基于实际菜品** AI 推断
- 标签样式使用现有 `tw` 暖灰色 pill

### US-005 多语言文化插画

**As a** 用户
**I want to** 通过插画快速感知餐厅所在国家
**So that** 文化符号给我即时上下文

**验收**：
- 法语菜单 → 炖菜 + 法棍
- 日语菜单 → 寿司三贯
- 意大利语 → 意面盘
- 中文 → 蒸笼
- 其他语言可降级到通用盘子图标

### US-006 菜品卡片图片放大

**As a** 浏览菜品的用户
**I want to** 看清菜品的样子
**So that** 我可以根据外观决定要不要点

**验收**：
- 卡片图片从 68×68 增大到 120×120
- 文字区相应紧凑
- 总卡片高度不超过 170px

---

## 4. 非目标

- 不做用户画像学习（女生喜欢用规则即可）
- 不做菜单价格预算计算
- 不接餐厅评价系统
- 不接外部数据源（如大众点评）
- 不在本期增加分享/收藏入口（已有）

---

## 5. 数据策略

### AI 必须新增输出字段

```typescript
interface RestaurantMeta {
  display_name: string;        // 餐厅显示名（基于 OCR 推断或语种）
  restaurant_type: string;     // 餐厅类型：小馆/酒馆/快餐店
  rating_estimate: number;     // 0-5 评分（基于菜品质量推断）
}

interface MenuInsight {
  summary: string;             // 30-60 字菜单概览
  occasion_tags: string[];     // 3-5 个场景标签
  cuisine_style: string;       // 主菜系
}

interface SignatureRecommendation {
  dish_ids: string[];          // 招牌菜 dish_id 数组
  reason: string;              // 10-25 字推荐理由
}
```

### 字段写入 TranslationResult.metadata

```typescript
interface TranslationResultMetadata {
  source_language: string;
  target_language?: string;
  total_dishes: number;
  // 新增
  restaurant?: RestaurantMeta;
  insight?: MenuInsight;
  signature?: SignatureRecommendation;
}
```

### 分类判定逻辑（无硬编码）

```typescript
type CategoryKey = 'all' | 'must_order' | 'ai_recommend' | 'girl_favorite'
  | 'appetizer' | 'main' | 'staple' | 'dessert' | 'drink';

function classifyDish(dish: Dish, signature: SignatureRecommendation): CategoryKey[] {
  const cats: CategoryKey[] = ['all'];
  if (signature.dish_ids.includes(dish.id)) cats.push('must_order');
  if ((dish.rating_avg || 0) >= 4.0) cats.push('ai_recommend');
  if (isGirlFavorite(dish)) cats.push('girl_favorite');
  cats.push(mapCategory(dish.category));
  return cats;
}

function isGirlFavorite(dish: Dish): boolean {
  const text = [dish.description?.zh, ...dish.taste_profile].join(' ');
  return /清爽|清淡|甜|温和|轻盈/.test(text) || dish.category === 'dessert';
}
```

---

## 6. 兼容性

- 旧菜单没有 metadata.restaurant/insight/signature → fallback 到本地推断
- AI 失败时显示 skeleton 占位，不卡住整个页面
- 离线/网络差时不阻塞菜单展示，洞察区可以延迟出现

---

## 7. 性能要求

- 摘要+洞察 AI 调用应**和翻译同时进行**（不要串行）
- AI 输出超时 5s 仍未返回 → 显示 fallback 模板（不要让用户等）
- 整体页面加载（首屏）≤ 2s

---

## 8. 验收清单

| # | 验收点 | 状态 |
|---|--------|------|
| 1 | 顶部摘要卡片显示餐厅名 + 评分 + 插画 | |
| 2 | 法语菜单显示炖菜+法棍插画 | |
| 3 | 日语菜单显示寿司插画 | |
| 4 | AI 洞察文字基于实际菜单内容（不写死） | |
| 5 | 场景标签 3-5 个（AI 生成） | |
| 6 | 招牌推荐由 AI 从评分高的菜中挑选 | |
| 7 | 分类导航 9 个，全部默认选中 | |
| 8 | 切换分类，列表实时过滤 | |
| 9 | 「全部菜品」标签随选中分类同步 | |
| 10 | 菜品图片 120×120 | |
| 11 | 浮动已选条仍正常工作 | |
| 12 | 中文/英文菜单可正确降级 | |

---

## 9. 上线节奏

- 本周：本地开发 + 自检
- 等用户验收完毕后再决定是否上生产
- 严禁直接发布到生产环境
