# DishLens 交接文档 — 2026-06-25

> 接手对象：Claude Code  
> 当前状态：本地研发态，可继续在本地验证；不要直接发布线上  
> 本地预览：`http://localhost:3101/?recent-landmark-a=1&task-store-fix=1`  
> 项目目录：`/Users/julian/AI点菜/dishlens`

## 1. 项目目标

DishLens 是一个面向海外旅行、留学、商务出行用户的 H5/PWA AI 菜单翻译工具。

核心旅程：

1. 拍摄或从相册上传菜单。
2. AI 识别菜单、翻译菜品、生成点单建议。
3. 用智能分类/标签快速找到适合自己的菜。
4. 选择菜品和份数，生成给店员核对的点单页。
5. 保存到“点过”，后续可查看、评价、复用。

设计原则：

- 保持现网温馨、极简、插画感的 H5 风格。
- 不要大幅改动现有首页、结果页、详情页结构。
- 新功能只做增量入口和轻量组件。
- 禁止引入粗黑重 UI、强营销卡片、抽象图标、emoji 图标。

## 2. 当前工作区状态

当前工作区有大量未提交改动，属于持续本地研发态。不要随意 `git checkout`、`git reset`、覆盖文件。

关键事实：

- 本地服务已可访问：`http://localhost:3101/?recent-landmark-a=1&task-store-fix=1`
- 逻辑回归测试通过：`node --test tests/logic-regressions.test.mjs`，65/65 pass
- Lint 通过：`npm run lint`
- 线上环境未发布本轮改动，不要擅自发线上

## 3. 已完成的主要功能

### 3.1 本地翻译任务稳定性

问题：本地环境翻译完成后可能因为 Supabase tasks 写入失败导致任务查不到，表现为本地识别流程异常或翻译失败。

已完成：

- `src/lib/cache/task-store.ts`
  - 增加本地内存任务 fallback。
  - 本地允许 fallback 时，Supabase task insert 失败不再直接中断翻译。
  - 生产/非本地环境仍然 fail loudly，避免线上静默丢任务。
- `src/app/api/v1/translate/menu/route.ts`
  - 识别 localhost/127.0.0.1 请求，并允许本地 task memory fallback。

验证：

- 已用本地 API 跑通过翻译流程。
- 回归测试覆盖：`local translation tasks fall back to memory but production task creation fails loudly`。

### 3.2 菜单识别与结果质量

已完成：

- 两阶段识别思路：快速返回文字结果，再补充推荐/标签/分类等结构化信息。
- 上传图片服务端压缩，降低海外大图上传/识别超时风险。
- 菜单解析增强：
  - 避免菜单介绍和菜名混在一起。
  - 避免多道菜被合并成一道菜。
  - 修正细菜单/长描述场景的拆分逻辑。
- 菜源语言推断增强，避免语言标识错误影响 UI 和分享。

关键文件：

- `src/app/api/v1/translate/menu/route.ts`
- `src/lib/ai/qwen.ts`
- `src/lib/menu-analysis-normalization.ts`
- `src/lib/menu-source-language.ts`
- `src/lib/validators/translate.ts`

### 3.3 结果页智能分类与标签

已完成：

- 分类逻辑从固定分类改为按菜单规模自适应。
- 小菜单不强行塞满很多分类，避免生硬。
- 大菜单提供更丰富分类，但至少保留核心入口。
- 恢复并优化：
  - 全部
  - 本店必点
  - AI 推荐
  - 女生喜欢
  - 主菜/甜点/饮品等按菜品属性生成的分类
- 菜品标签优先显示 4 个，结合菜品特性、用户需求、菜系、口味、场景，而不是都显示“约会小聚/朋友聚餐”。
- 分类标签在列表页和详情页都可见，并保持原菜品标签样式。

关键文件：

- `src/lib/results-categories.ts`
- `src/lib/results-menu-tags.ts`
- `src/lib/dish-display-tags.ts`
- `src/components/results/CategoryTabs.tsx`
- `src/components/results/ResultsPage.tsx`
- `src/components/dish/DishDetailPage.tsx`

### 3.4 菜品价格展示

已完成：

- 价格从原文行里提取并在翻译后菜名区域固定显示。
- 支持价格待核对场景。
- 点单核对页显示份数、单价、合计参考价。

关键文件：

- `src/lib/dish-price-display.ts`
- `src/components/results/ResultsPage.tsx`
- `src/components/order/OrderConfirmPage.tsx`

### 3.5 点单与“点过”闭环

已完成：

- 结果列表页支持加菜/改份数。
- 菜品详情页支持加入/增减份数，并和列表页风格对齐。
- 给店员核对页：
  - 展示原文菜名。
  - 展示菜品图片。
  - 展示份数、价格、总价。
  - 支持备注快捷选择，如不要花生、不要香菜、不要葱花、少辣、不要乳制品等。
  - 备注分段展示，不挤在一起。
  - 图片支持后续扩展点击看大图。
- “点过”页：
  - 首页底部入口已增加“点过”。
  - 按一次餐厅用餐聚合。
  - 餐厅名优先使用识别到的餐厅名称；未识别时使用“城市 + 小馆”。
  - 点过列表图标与最近翻译/地区地标体系对齐。
  - 图标白边问题已修复：去掉双层浅色容器，地标图标保持单层温暖底托。

关键文件：

- `src/lib/order-state.ts`
- `src/lib/local-storage.ts`
- `src/components/order/`
- `src/app/page.tsx`
- `src/types/index.ts`

### 3.6 最近翻译与地区地标图标

已完成：

- 最近翻译从“单道菜卡片”调整为“餐厅/菜单记录”。
- 展示内容包含：
  - 餐厅/菜单名称
  - 源语言 → 目标语言
  - 菜品数量
  - 日期
  - 菜品缩略图摘要
- 地区图标改为暖棕线描 PNG 地标图标。
- 当前覆盖：
  - 法国、意大利、日本、中国、韩国、泰国、德国、西班牙、美国/英语区、印度、墨西哥、越南、土耳其、希腊、巴西、国际兜底。
- 修复了“点过”页地标图标白边：根因是图标组件底托和点过卡片额外图标容器叠加，已改成单层。

关键文件：

- `src/lib/recent-menu-records.ts`
- `src/lib/region-landmarks.ts`
- `src/components/shared/RegionLandmarkIcon.tsx`
- `src/components/shared/CuisineIllustration.tsx`
- `public/icons/landmarks/*.png`
- `src/components/home/HomePage.tsx`
- `src/components/order/OrderedPage.tsx`

### 3.7 菜品图片生成与提示词

已完成：

- 图片生成 prompt 从通用菜品照，优化为更强调真实菜品身份。
- 强化高风险菜品的视觉描述，避免：
  - 披萨被当饮品。
  - 饮品被当主菜。
  - 多个套餐共用同一张图。
  - 菜品描述混淆导致图像错误。
- 套餐类菜品增加包含内容字段，列表显示“套餐包含”，并要求生图 prompt 尽量体现主餐、薯条、饮品等组合。
- 图片生成队列逻辑已从固定前 16 道限制，调整为可继续有序生成，避免后面的菜长期卡在 pending/88%。
- 图片 pending UI 避免永久百分比误导。

关键文件：

- `src/lib/ai/image-gen.ts`
- `src/lib/dish-image-match.ts`
- `src/lib/dish-presentation.ts`
- `src/components/shared/DishImageWithLoading.tsx`
- `src/app/api/v1/dish/[id]/generate-image/route.ts`

### 3.8 今日推荐与位置推荐本地骨架

已完成本地骨架：

- 今日推荐保留原有推荐逻辑，不让地理位置污染“今日推荐理由”文案。
- 可选增强：如用户授权地理位置并配置地图 API key，则推荐附近好餐厅里的好菜。
- 支持 Amap/Google provider 抽象：
  - 中国大陆/港澳台：高德 Amap。
  - 海外：Google Places。
- 距离策略：
  - 优先 2km、5km、10km、20km、50km。
  - 小于 2km 显示 `<2km`。
  - 大于 50km 不显示地理属性。
- 详情页支持餐厅卡片和导航 URL。

关键文件：

- `src/lib/location-recommendation.ts`
- `src/app/api/v1/recommendations/location/route.ts`
- `src/hooks/useDailyRecommendation.ts`
- `src/components/home/HomePage.tsx`
- `src/components/dish/DishDetailPage.tsx`

仍待配置：

- `GOOGLE_PLACES_API_KEY`
- `AMAP_WEB_SERVICE_KEY`

没有 key 时应静默回退到现有今日推荐。

## 4. 已验证内容

最近一次验证时间：2026-06-25。

命令：

```bash
cd /Users/julian/AI点菜/dishlens
node --test tests/logic-regressions.test.mjs
npm run lint
```

结果：

- 65/65 tests pass。
- ESLint pass。
- 本地 `localhost:3101` 返回 200。

浏览器验证：

- 当前本地地址：`http://localhost:3101/?recent-landmark-a=1&task-store-fix=1`
- 首页可见：
  - 今日推荐
  - 拍摄菜单
  - 从相册选择
  - 最近翻译
  - 底部历史/收藏/点过/设置
- 点过页可见：
  - 纽约小馆 New York Bistro
  - 巴黎小馆 Le Petit Bistro
  - 地标图标白边已修复

## 5. 当前未完成 / 待 Claude Code 优先处理

### P0：不要破坏现网风格

任何后续实现都要先对照现网：

- 首页不要重排，只能在底部入口或现有卡片内做轻量增量。
- 结果列表沿用现有卡片层级。
- 详情页只加点单模块，不要重做视觉。
- 点过页列表要复用翻译列表的排版语言。

### P1：完成本地功能验收

1. 完整跑一遍：
   - 首页上传菜单。
   - 翻译完成。
   - 分类/标签展示。
   - 列表加菜。
   - 详情加菜和改份数。
   - 给店员核对。
   - 保存到点过。
   - 点过列表进入详情。
   - 已点菜评价。

2. 重点检查移动端触控：
   - 加号/减号按钮是否足够大。
   - 底部浮层是否遮挡详情按钮。
   - 微信 H5 内是否可正常操作。

3. 重点检查文案：
   - “确认已点”已改为“我已点好，保存到点过”。
   - 店员核对页需保持简洁，不要多余说明。

### P1：真实菜单识别回归

用户近期反馈过真实菜单问题：

- 菜名和介绍混淆。
- 多个菜品被合并。
- 第一个菜图不符合真实菜品。
- fine dining 菜单长英文描述容易被当成菜名。

建议 Claude Code 用用户给过的图片样本继续跑本地验证，并把失败样例固化为测试。

### P1：图片生成可靠性

需要继续排查：

- 阿里 Wan 生图失败/长时间 pending 的真实原因。
- 是否是 API rate limit、轮询状态没处理、任务失败没落库、还是前端未刷新。
- 当前没有备用生图方案，不能只靠 fallback 插画。

建议：

- 增加 image generation job 状态日志。
- 对 pending 超时设置明确 failed/retry 状态。
- 每道菜生成失败要有可重试入口。
- 套餐生图 prompt 必须要求画出套餐组合，而不只靠标签显示套餐内容。

### P1：位置推荐接入真实 key

待用户/运维提供：

- Google Places API key。
- 高德 Web Service key。

需要验证：

- 国内高德附近餐厅搜索是否返回可导航坐标。
- 海外 Google Places 是否返回餐厅名、评分、地址、坐标。
- 没 key 或用户拒绝定位时，今日推荐完全回退，不影响现有体验。

### P2：线上发布前 Checklist

发布前必须做：

```bash
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

并手动验证：

- 首页。
- 上传/拍摄。
- 结果列表。
- 详情页。
- 点单核对。
- 点过页。
- 分享页 `/share/[id]`。
- 微信 H5 内操作。

不要擅自发布，需用户评审通过后再部署。

## 6. Claude Code 接手建议

建议顺序：

1. 先打开本地：

```bash
cd /Users/julian/AI点菜/dishlens
npm run dev -- -p 3101
```

2. 看当前页面：

```text
http://localhost:3101/?recent-landmark-a=1&task-store-fix=1
```

3. 先不要改大 UI，先做冒烟测试。

4. 如果要继续修 bug，优先从测试覆盖开始：

```bash
node --test tests/logic-regressions.test.mjs --test-name-pattern "对应功能关键词"
```

5. 修改代码后跑：

```bash
node --test tests/logic-regressions.test.mjs
npm run lint
```

6. 如涉及 UI，务必截图对比现网设计，不要凭感觉重做。

## 7. 重要文件索引

### 入口和状态

- `src/app/page.tsx`
- `src/types/index.ts`
- `src/lib/local-storage.ts`

### 菜单识别

- `src/app/api/v1/translate/menu/route.ts`
- `src/lib/ai/qwen.ts`
- `src/lib/menu-analysis-normalization.ts`
- `src/lib/menu-source-language.ts`
- `src/lib/cache/task-store.ts`

### 结果页

- `src/components/results/ResultsPage.tsx`
- `src/components/results/CategoryTabs.tsx`
- `src/components/results/SummaryInsightCard.tsx`
- `src/lib/results-categories.ts`
- `src/lib/results-menu-tags.ts`
- `src/lib/dish-display-tags.ts`
- `src/lib/dish-price-display.ts`

### 菜品详情与点单

- `src/components/dish/DishDetailPage.tsx`
- `src/components/order/`
- `src/lib/order-state.ts`

### 最近翻译/地标图标

- `src/components/home/HomePage.tsx`
- `src/lib/recent-menu-records.ts`
- `src/lib/region-landmarks.ts`
- `src/components/shared/RegionLandmarkIcon.tsx`
- `public/icons/landmarks/`

### 图片生成

- `src/lib/ai/image-gen.ts`
- `src/lib/dish-image-match.ts`
- `src/lib/dish-presentation.ts`
- `src/components/shared/DishImageWithLoading.tsx`
- `src/app/api/v1/dish/[id]/generate-image/route.ts`

### 位置推荐

- `src/lib/location-recommendation.ts`
- `src/app/api/v1/recommendations/location/route.ts`
- `src/hooks/useDailyRecommendation.ts`

### 文档

- `docs/handoff-codex-2026-06-08-v2.md`
- `docs/plans/location-daily-recommendation-local-2026-06-05.md`
- `docs/plans/order-ordered-local-implementation-2026-06-03.md`
- `docs/order-feature-design-guardrails-2026-06-03.md`
- `docs/handoff-codex-2026-06-25.md`

## 8. 给 Claude Code 的注意事项

- 当前是本地研发态，不是干净分支。
- 不要清理用户/前序 agent 的改动。
- 不要直接部署线上。
- 不要重写首页、结果页、详情页视觉。
- 不要把 API key 写入文档或提交。
- 地标图标白边刚修复，别再给 `RegionLandmarkIcon` 外层套浅色图标容器。
- 图片生成、菜单识别、分类标签是用户最关注的问题，优先保证真实菜单准确性和体验闭环。
