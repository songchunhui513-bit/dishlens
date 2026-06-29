# DishLens 交接文档 - 2026-06-08

> 接收方：Claude Code  
> 当前目标：继续本地研发与验证，暂不发布线上。  
> 重要约束：现网 H5 设计风格不能乱改，线上环境不要擅自部署。

## 1. 项目概况

DishLens 是一个面向旅行和跨语言点餐场景的 H5/PWA AI 菜单翻译工具。

核心用户：
- 海外旅行者：看不懂当地语言菜单，需要快速知道菜名、口味、价格和是否值得点。
- 留学生 / 商务出行用户：需要在陌生餐厅高效完成点餐。
- 有饮食偏好或过敏风险的用户：需要识别素食、乳制品、坚果、猪肉、辣味等风险。
- 多人聚餐用户：需要把菜单分享给朋友，国内主要是微信，海外是 WhatsApp、Telegram、LINE、Facebook、X 等。

核心体验闭环：
1. 首页今日推荐 / 拍摄菜单。
2. 上传图片并压缩。
3. AI 识别菜单并翻译。
4. 结果页展示餐厅洞察、智能分类、菜品卡片、标签、价格和图片。
5. 用户选择菜品。
6. 给店员核对原文菜名、图片、份数、价格和备注。
7. 保存到“点过”，后续可评价和复盘。

## 2. 技术栈与关键目录

技术栈：
- Next.js 16 App Router
- React 19 + TypeScript
- Tailwind CSS 4
- Qwen / DashScope：菜单 OCR、翻译、文本结构化
- Wan / DashScope：菜品图片生成
- Supabase：持久化与分享页数据
- localStorage：设置、历史、收藏、点过等本地状态

关键目录：
- `src/app/api/v1/translate/menu/route.ts`：菜单翻译 API 主流程
- `src/lib/ai/qwen.ts`：Qwen 菜单识别与翻译 prompt
- `src/lib/ai/image-gen.ts`：菜品图片生成 prompt、Wan 调用与图片队列
- `src/components/results/ResultsPage.tsx`：结果页
- `src/components/dish/DishDetailPage.tsx`：菜品详情页
- `src/components/order/`：点单 / 点过相关组件
- `src/lib/order-state.ts`：点单与点过本地状态
- `src/lib/results-categories.ts`：结果页智能分类
- `src/lib/dish-display-tags.ts`：菜品标签展示
- `src/lib/location-recommendation.ts`：位置推荐逻辑
- `tests/logic-regressions.test.mjs`：当前主要逻辑回归测试

## 3. 当前设计原则

设计风格：
- 温馨、极简、插画风。
- 背景以暖米色为主，卡片为浅杏色，行动色为绿色，推荐/提示用橙色。
- 不要引入粗重黑色模块、大面积高饱和色、强营销风组件。
- 不要乱改现网首页、列表页、详情页的视觉骨架。
- 新功能应作为轻量增量补充到现有页面。

关键设计约束：
- 首页底部功能入口应为：历史、收藏、点过、设置。
- 结果列表沿用现网卡片结构，只增加轻量选择按钮、标签、价格位置。
- 详情页沿用现网详情结构，只新增轻量点单模块。
- 给店员核对页以菜单原文、图片、份数、价格为核心，不要加多余解释。
- 点过页按餐厅聚合，点击卡片进入本次点过详情。

## 4. 近期已完成 / 本地已有能力

注意：以下大部分是本地研发状态，不代表已发布线上。

### 4.1 菜单识别与结果页

已实现或已本地集成：
- 两阶段识别：快速出文字结果，再补充推荐、标签、图片等。
- 翻译目标语言和界面语言设置。
- 结果页智能分类，支持按菜品数量自适应分类数量。
- 恢复并优化原有分类：全部、本店必点、AI 推荐、女生喜欢、主菜等。
- 继续扩展标签：素食、主食、稳妥选择、浓郁、清爽、辣味、海鲜、肉食、奶酪、适合分享等。
- 分类标签在列表和详情可见，样式应与原菜品标签一致。
- 价格应显示在翻译后的菜名旁边固定位置，而不是只出现在原文中。

### 4.2 点单 / 点过闭环

已本地实现方向：
- 列表页和详情页支持增加菜品份数。
- 详情页“已选”与“加入/加份”应分成两个组件：
  - 加份组件：用于当前菜品数量操作。
  - 已选组件：展示总已选份数和总价，支持查看点单。
- 给店员核对页展示：
  - 菜品图片
  - 原文菜名
  - 中文名称
  - 原菜单序号
  - 单独字段展示份数
  - 价格
  - 备注分段显示
- 核对页图片应支持点击看大图。
- 确认按钮文案：`我已点好，保存到点过`。
- 点过页和收藏逻辑分开。
- 点过页菜单名逻辑：
  - 如果识别到餐厅名称，优先用餐厅名。
  - 如果没识别到，使用“所在城市 + 小馆”。
  - 名称展示逻辑应和列表页餐厅卡片对齐。

### 4.3 分享

已做过的方向：
- 分享入口接入现有结果页和 `/share/[id]`。
- 支持原生系统分享、复制链接、微信、WhatsApp、Telegram、LINE、Facebook、X。
- 微信无法从普通 H5 直接拉起私有“转发给朋友”页面，主要依赖原生 share sheet 或复制链接。
- iOS 原生分享图标、页面 OG 信息和分享图标曾做过多轮优化。

### 4.4 海外上传与全球部署

已形成方案：
- 国内服务器可能导致海外图片上传慢或卡死。
- 根治方向是增加 Google VM 全球入口，例如 `global.dishlens.wukongmkt.com`。
- 需要按地区验证：
  - 美国
  - 欧洲，例如意大利 / 德国 / 荷兰
  - 日本 / 新加坡
  - 泰国
  - 澳大利亚
- 每个地区记录：上传耗时、首屏耗时、失败率、识别准确率。

相关文档：
- `docs/handoff-global-google-server-2026-06-02.md`

### 4.5 位置今日推荐

用户希望首页今日推荐结合地理位置：
- 推荐附近好吃餐馆里的好吃菜。
- 优先推荐小于 5km 的餐厅。
- 小于 2km 可显示 `<2km`。
- 如果推荐距离大于 50km，不展示地理位置属性。
- 国内接口使用高德，海外接口使用 Google Places。
- 今日推荐理由不要被地理位置污染，仍沿用原有推荐逻辑。
- 今日推荐支持多张卡片横滑。
- 如果获取到餐厅信息，应尽量推荐不同餐厅的菜，不要同一个餐厅占多个推荐卡片。
- 详情页支持点击餐厅导航，给导航软件坐标。

相关文档：
- `docs/plans/location-daily-recommendation-local-2026-06-05.md`

## 5. 2026-06-08 本轮 Codex 变更

本轮主要处理用户反馈：“当前图片生成提示词和真实菜品有差异，尤其红鲻鱼生成成通用大型烤鱼”。

### 5.1 修改文件

本轮明确修改：
- `src/lib/ai/image-gen.ts`
- `tests/logic-regressions.test.mjs`

本轮新增 HTML 说明：
- `_temp/boss-review-dishlens-2026-06-08.html`
- `_temp/dish-image-prompt-logic-2026-06-08.html`

### 5.2 生图 prompt 优化内容

修改位置：
- `src/lib/ai/image-gen.ts`

主要变化：
- 新增 `RED_MULLET_PATTERN`：
  - `rouget barbet`
  - `red mullet`
  - `rouget`
  - `红鲻鱼`
  - `红鲻`
  - `鲻鱼`
- 新增 `buildDishVisualProfile(...)`：
  - 在通用分类模板之外，为具体菜品补充视觉身份。
  - 目前重点处理红鲻鱼。
- Prompt 开头新增视觉优先级：
  - 先匹配确切菜品身份和烹饪形态。
  - 分类模板只是次要指导。
- 红鲻鱼增加视觉身份：
  - 小型地中海 red mullet。
  - 红橙色鱼皮。
  - 细长、中小型鱼身。
  - 细嫩白色鱼肉。
  - 法式小馆摆盘。
  - 可整鱼轻烤/煎，也可在描述暗示鱼柳时生成小鱼柳。
- 红鲻鱼增加反向排除：
  - 不是 sea bass。
  - 不是 salmon。
  - 不是 tuna。
  - 不是 cod。
  - 不是大型通用烤鱼。
  - 不是炸鱼。
  - 不是 fish and chips。
- 增加证据规则：
  - 只能根据菜名、原文、描述、食材、套餐内容生成。
  - 不要发明与证据冲突的鱼种、菜系、配菜、装饰、酱汁或器皿。

### 5.3 测试

新增测试：
- `dish image prompts prioritize real dish identity over generic category framing`

测试覆盖：
- `Rouget Barbet / 红鲻鱼` 仍然分类为 `seafood`。
- Prompt 必须包含：
  - `small Mediterranean red mullet`
  - `red-orange skin`
  - `not sea bass`
  - `not salmon`
  - `not a large generic grilled fish`

已执行：

```bash
node --test tests/logic-regressions.test.mjs
```

结果：
- 58 个测试全部通过。

## 6. 当前 HTML 演示页

### 6.1 老板评审项目介绍

文件：
- `_temp/boss-review-dishlens-2026-06-08.html`

本地访问：
- `http://127.0.0.1:4181/boss-review-dishlens-2026-06-08.html`

内容：
- 项目定位
- 目标用户
- 需求与痛点
- 用户旅程
- 当前能力
- 设计风格
- AI 识别与生图逻辑
- 风险
- 后续路线

### 6.2 菜品图片生成 Prompt 中文说明

文件：
- `_temp/dish-image-prompt-logic-2026-06-08.html`

本地访问：
- `http://127.0.0.1:4182/dish-image-prompt-logic-2026-06-08.html`

内容：
- 当前生图链路
- 分类规则
- 原问题分析
- 本次 prompt 优化
- 红鲻鱼示例
- 后续建议

注意：这两个端口是本地临时静态服务，不是项目生产服务。

## 7. 当前工作区状态注意事项

当前 `git status --short` 显示大量修改和新增文件。

重要提醒：
- 不要把所有 dirty 文件都归因于 2026-06-08 这次 Codex 变更。
- 不要随意回滚用户或其他 agent 已经做过的修改。
- 如果要继续研发，先读对应文件再改。
- 如果要发版，必须先让用户确认。

当前有大量历史本地改动涉及：
- 结果页重构
- 点单 / 点过功能
- 分享功能
- 设置持久化
- 海外上传优化
- 位置推荐
- 图片生成队列
- 分类与标签逻辑

Claude Code 接手后建议先执行：

```bash
cd /Users/julian/AI点菜/dishlens
git status --short
node --test tests/logic-regressions.test.mjs
npm run lint
```

如果 `npm run lint` 因历史改动失败，不要直接大范围修复，先定位是否与当前任务相关。

## 8. 待办优先级

### P0：继续保证菜品识别和图片生成准确性

当前风险：
- 菜名和描述仍可能混淆。
- 多个菜品可能被合并。
- 套餐内容可能识别不全。
- 图片生成可能长期 pending 或失败。
- 图片可能和真实菜品形态不一致。

建议下一步：
1. 扩展 `buildDishVisualProfile` 为可维护字典，而不是只写红鲻鱼。
2. 高风险菜品优先加入 visual profile：
   - Rouget Barbet / red mullet
   - foie gras
   - scallop
   - escargots
   - burrata
   - pizza variants
   - burger / wrap meals
   - dessert drinks / alcohol desserts
3. 生图后用视觉模型做轻量自检：
   - 是否为披萨
   - 是否为饮品
   - 是否展示套餐所有组成
   - 是否为目标鱼类/海鲜形态
4. 失败或不匹配时重试或降级插画。

### P0：图片有序生成与状态闭环

用户明确要求：
- 列表页不应限制只生成前 16 道。
- 图片应在列表页慢慢有序生成。
- 不能长期卡在 88% 或 pending。

建议：
- 可视区域优先。
- 后台队列继续生成后续菜品。
- 每道菜有 `pending / succeeded / failed / retrying` 状态。
- 超时后标记 failed，不要永久 pending。
- failed 支持单项重试。

### P1：点单 / 点过功能继续验收

要重点检查：
- 首页底部入口是否为：历史、收藏、点过、设置。
- 列表页选择按钮是否符合移动端触控。
- 详情页加份组件是否太大、是否遮挡。
- 已选组件和加入组件是否分开。
- 给店员核对页图片、份数、价格、备注是否清晰。
- 点过页列表是否和翻译列表风格一致。

### P1：位置今日推荐

待完善：
- Google Places Key 和高德 Key 需要用户提供，不能自动获取。
- 今日推荐应支持多张卡片横滑。
- 不要把地理位置写进“今日推荐理由”造成文案污染。
- 如果有餐厅信息，推荐不同餐厅的菜。
- 详情页餐厅卡点击导航。

### P1：海外上传真实验证

继续验证：
- 意大利
- 日本
- 泰国
- 新加坡
- 澳大利亚

每组记录：
- 上传耗时
- 首屏可用耗时
- 总识别耗时
- 图片生成耗时
- 失败率
- 识别准确率

### P2：微信小程序独立项目

用户之前要求：
- 原生微信小程序。
- 新分支：`feature/wechat-miniprogram`。
- 独立目录：`/Users/julian/DishLens-WeChat-MiniProgram`。
- 不影响 `/Users/julian/AI点菜/dishlens` H5 项目。
- 登录策略推荐：静默登录 + 需要时完善头像昵称。
- 分享页：小程序内页面为主，可考虑跳 H5 公开页。

这件事当前不是本轮主线，接手前要再确认用户是否继续推进。

## 9. 环境和 Key 注意事项

本地 `.env.local` 已经存在，用户曾提供新的阿里云 key 并要求：
- 先更换本地 key。
- 线上环境先不更换。
- 记录线上 key 替换为待办。

不要在文档、代码或回复里暴露完整 API key。

常见环境变量：
- `QWEN_API_KEY`
- `QWEN_BASE_URL`
- `QWEN_VL_MODEL`
- `QWEN_TEXT_MODEL`
- `WAN_MODEL`
- `IMAGE_PROVIDER`
- `MENU_IMAGE_GENERATION_RETRIES`
- `MENU_IMAGE_GENERATION_CONCURRENCY`
- Google / Amap 位置推荐相关 Key，需按当前代码确认具体变量名。

## 10. 建议 Claude Code 接手步骤

1. 先读本文档和最近相关文档：
   - `docs/handoff-codex-2026-06-08.md`
   - `docs/handoff-codex-2026-06-04.md`
   - `docs/handoff-global-google-server-2026-06-02.md`
   - `docs/plans/location-daily-recommendation-local-2026-06-05.md`
   - `docs/requirements-ordering-ordered-2026-06-03.md`
2. 执行测试：
   ```bash
   node --test tests/logic-regressions.test.mjs
   ```
3. 如继续 prompt 优化：
   - 优先扩展 `buildDishVisualProfile`。
   - 先写测试，再改代码。
4. 如继续 UI：
   - 必须对照现网风格。
   - 不要重做页面。
   - 不要新增粗重组件。
5. 如准备上线：
   - 先本地跑通。
   - 让用户评审。
   - 用户明确同意后再部署。

## 11. 本轮完成状态

已完成：
- 分析当前菜品图片生成提示词问题。
- 优化本地生图 prompt。
- 增加红鲻鱼回归测试。
- 跑通 58 个逻辑测试。
- 生成老板评审 HTML。
- 生成菜品图片 Prompt 中文说明 HTML。
- 输出本交接文档。

未完成：
- 没有重新生成红鲻鱼图片。
- 没有部署线上。
- 没有扩展完整 visual profile 菜品知识库。
- 没有接入图片生成结果自检。
- 没有完成 Google / 高德真实 Key 配置。
