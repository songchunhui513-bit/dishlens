# DishLens 微信群分享设计交接 — 2026-05-27

## 本轮背景

用户希望在扫完菜单后，可以把翻译好的菜单分享到微信群。群友打开后能看到菜单列表和菜品详情。当前要求是先做设计方案，不直接研发落地。

## 已完成内容

### 1. 三版设计方案总览

文件：

- `public/prototypes/wechat-share-options.html`

访问：

- `http://localhost:3000/prototypes/wechat-share-options.html`
- `file:///Users/julian/AI点菜/dishlens/public/prototypes/wechat-share-options.html`

包含三版方案：

- A · 轻量分享版：保留现有结果页流程，强化分享入口、微信卡片和只读分享菜单。
- B · 微信群共看版：增加轻量“想吃”反馈，让群友一起看菜单。
- C · 餐桌决策版：加入投票、二维码、点菜清单和过敏提醒，适合多人聚餐决策。

当前建议方向：B 版作为产品主线更有微信群场景感，但用户随后要求先把方案一做成完整高保真交互原型。

### 2. 方案一完整交互高保真原型

文件：

- `public/prototypes/wechat-share-option-a-journey.html`

访问：

- `http://localhost:3000/prototypes/wechat-share-option-a-journey.html`
- `file:///Users/julian/AI点菜/dishlens/public/prototypes/wechat-share-option-a-journey.html`

已覆盖完整旅程：

1. 翻译完成页：用户看到“菜单翻译好了”和“发到微信群”入口。
2. 底部分享面板：展示微信、微信群、复制链接、更多，以及将要发出的菜单卡片。
3. 微信群卡片：模拟在微信群里发送 DishLens 菜单链接。
4. 群友打开：进入只读分享菜单列表。
5. 菜品详情：查看图片、风味特征、点单建议和注意事项。

可点击交互：

- 点击“发到微信群”打开分享面板。
- 点击“微信/微信群”进入微信群模拟页面。
- 点击微信群卡片进入分享菜单。
- 点击菜单卡片进入菜品详情。
- 左侧旅程步骤也可点击跳转。
- 复制链接/分享动作带 toast 和轻微情绪反馈。

## 设计原则

- 方案一保持轻量，不引入投票、登录、协作状态。
- 保持 DishLens 现有 Warm Editorial 视觉系统：暖奶油背景、浅橙卡片、绿色行动色、Source Serif 风格标题。
- 分享页优先保证“微信群里打开就能看懂”，不做说明书式页面。
- 列表与详情都采用真实菜图，避免空白或假内容破坏信任感。
- 微交互克制：底部面板、toast、轻微反馈和页面滑入，不做过度动画。

## 当前代码状态

- 新增目录：`public/prototypes/`
- 新增文件：
  - `public/prototypes/wechat-share-options.html`
  - `public/prototypes/wechat-share-option-a-journey.html`
- 当前这两个原型文件尚未提交到 Git。
- 已验证：
  - `http://localhost:3000/prototypes/wechat-share-option-a-journey.html` 返回 200。
  - 原型内图片路径检查无缺失。

## 后续落地建议

若用户确认采用方案一，研发可按以下顺序实现：

1. 优化现有 `handleShareMenu`：确保结果页、详情页均可触发同一个分享逻辑。
2. 强化 `/share/[id]`：按方案一的只读列表和详情样式调整，而不是继续保留现在较基础的分享页。
3. 增加分享 metadata：标题、描述、封面图，提升微信卡片可读性。
4. 分享失败兜底：`navigator.share` 不可用时复制链接，并显示明确 toast。
5. 增加链接状态页：任务不存在、过期、无菜品时给出温和反馈。
6. 完成后用真实扫描结果验证：从扫描结果页分享，复制链接，在新窗口打开 `/share/[id]`，点击列表和详情。

## 注意事项

- 方案一不需要新增数据库表。
- 分享链接仍然依赖现有 task/result 数据可读取。
- 如果后续希望支持“想吃/投票/共看人数”，应切换到方案 B 或 C，并新增轻量互动数据结构。
