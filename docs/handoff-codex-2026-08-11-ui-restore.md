# DishLens Codex 交接文档 - 2026-08-11 UI 精确还原

## 本轮目标

将产品视觉精确恢复到历史提交 `f677794` 的版本，核心识别特征为：识别过程中页面中央显示菜品动画、细进度条、状态文案、提示、百分比和取消按钮。同时保留之后完成的全部业务逻辑优化。

## 根因

上一轮 `f8f2d2f` 只近似恢复了首页、结果页和详情页的部分字号与间距，加载页仍保留 `53f70d3` 后引入的大标题、主进度卡和四阶段卡片，其他历史、收藏、点单、分享页面也仍使用放大后的视觉。因此线上/本地实际是两套视觉语言混用，并非完整历史版本。

## 已完成

### 1. 加载页

- 恢复 `f677794` 的中央 `FoodCharacters` 动画。
- 恢复 200px 细进度条、状态文字、菜品提示、大百分比和取消按钮。
- 删除可见的大标题“把照片变成可点菜清单”、说明段落和四阶段卡片。
- 保留快速/稳定轮询、180 秒超时、空结果保护、部分结果跳转、`clientStage` 状态和失败处理。

### 2. 全页面视觉

以下页面已按同一提交恢复紧凑布局、字号、间距、圆角、图片尺寸和表面样式：

- 首页、结果页、菜品详情
- 历史、收藏
- 点单确认、点过列表、点过详情
- 国际分享面板、公开共享菜单、全局 Toast
- 菜品图片加载容器和全局加载样式

### 3. 保留的业务能力

- Gemini -> Qwen 菜单识别备用链路
- 空菜单/全页失败防护和信息页识别
- 识别上传压缩、快速轮询、缓存和重复上传
- 本地图匹配、AI 图片队列、延迟生图、弱网预热、图片失败重试
- 60 道首批渲染与大菜单渐进展示
- 图片后台补齐状态和轮询仍保留为内部状态，但不再显示后来新增的横幅
- 收藏、历史、点单和菜品评价
- 微信、系统分享、WhatsApp、Telegram、LINE、Facebook、X 和复制链接
- 中英文界面文案及地区/语言分享渠道判断

## 关键文件

- `src/components/results/LoadingPage.tsx`
- `src/components/results/ResultsPage.tsx`
- `src/components/shared/DishImageWithLoading.tsx`
- `src/components/home/HomePage.tsx`
- `src/components/dish/DishDetailPage.tsx`
- `src/components/history/HistoryPage.tsx`
- `src/components/favorites/FavoritesPage.tsx`
- `src/components/order/OrderConfirmPage.tsx`
- `src/components/order/OrderedPage.tsx`
- `src/components/order/OrderedDetailPage.tsx`
- `src/components/share/ShareSheet.tsx`
- `src/components/share/SharedMenuPage.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `tests/logic-regressions.test.mjs`
- `docs/lessons.md`

## 验证结果

- `node --test --test-reporter=dot tests/logic-regressions.test.mjs`：178/178 通过。
- 定向 ESLint：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run build`：Next.js 生产构建通过。
- Sonnet `agent-browser` 在 `390x844` 视口上传真实法语菜单：约 25 秒返回 34 道菜。
- 加载页确认只有中央动画、细进度条、状态、提示、百分比和取消按钮。
- 结果页无 Runtime Error、无横向溢出、首屏图片无失效。

## QA 截图

- `/tmp/dishlens-ui-restore-loading.png`
- `/tmp/dishlens-ui-restore-results.png`

## 后续注意

- 后续若再次调整视觉，必须单独提交，不能与识别、缓存或图片逻辑混在同一提交。
- “恢复历史版本”必须先锁定 Git 提交并逐文件比对，不能按记忆做近似还原。
- `tests/logic-regressions.test.mjs` 已增加中央加载版的特征约束，并移除后来放大版 UI 的冲突断言。
