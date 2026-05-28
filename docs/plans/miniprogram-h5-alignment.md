# 小程序 ↔ H5 1:1 对齐计划

> 日期：2026-05-28
> H5 基线：main 分支（成熟版本）
> 小程序分支：feature/wechat-miniprogram
> 目标：小程序每页功能、视觉、状态与 H5 完全一致

---

## 对齐方法论

**每个页面按以下 5 步执行：**

1. **读 H5 源文件** — 作为 UI 规格书和功能清单
2. **列功能矩阵** — H5 有什么，小程序缺什么
3. **对齐 WXML** — 每个 DOM 元素翻译为小程序组件
4. **对齐 WXSS** — 颜色/字体/间距/圆角/阴影/动画完全一致
5. **对齐 JS** — 状态管理、API 调用、事件处理、生命周期

**设计 token 来源：H5 的 `globals.css` `:root` 变量 + 各组件内的 inline style**

---

## 页面 1：首页（HomePage）

**H5 源**：`src/components/home/HomePage.tsx`（565 行）
**小程序**：`apps/wechat-miniprogram/miniprogram/pages/home/`（WXML 约 70 行）

### H5 功能清单

| 功能 | H5 实现 | 小程序对齐 |
|------|---------|-----------|
| Hero 卡片 | `dailyDish` 动态推荐：菜名(zh+en)、推荐理由、上下文标签（"今日阴雨适合暖食"） | 从 `/api/v1/translate/menu` 结果中缓存推荐，或调每日推荐 API |
| Hero 插图 | FoodCharacters SVG 动画（bowlFloat/plateFloat） | 用 WXML `<image>` + CSS animation 还原 SVG |
| 拍照按钮 | 主 CTA，蓝色/绿色大按钮，跳转 CameraPage | `<button open-type="chooseMedia">` 或页面跳转 |
| 近期翻译（8 条） | `historyEntries.slice(0,8)`.map → 缩略图 + 菜名(zh+en) + 日期 | 从缓存读取 + 渲染列表 |
| 近期翻译缩略图 | `getDishImageUrl(firstDish)` — 四层优先级 | 直接把 URL 给 `<image>`，懒加载 |
| 近期翻译点击 | `onRecentClick(id)` → 恢复 `result_summary` → 跳转结果页 | `wx.navigateTo` + 传递 task_id |
| 底部导航 | 历史/收藏/设置 三个入口 | 三个 `<view>` 卡片 |
| 空态 | 首次使用无历史 → 引导文案 + 拍照按钮 | 条件渲染 |
| 加载态 | mounted 检测，避免 SSR hydration | 小程序无 SSR，直接渲染 |
| 动画 | fadeSlideUp（卡片依次出现） | CSS animation，`animation-delay` 按 index |

### 对齐步骤

1. 读 H5 `HomePage.tsx` 完整代码
2. 读 H5 `page.tsx` 中 `historyEntries`/`dailyDish`/`onRecentClick` 相关代码
3. 重写 WXML：hero → 拍照 CTA → 近期翻译列表 → 底部导航
4. 重写 WXSS：匹配 v7 Warm Editorial token
5. 重写 JS：`onLoad` 拉取推荐 + 读本地历史缓存 + 绑事件
6. 对 H5 截图逐像素验证

---

## 页面 2：拍照页（CameraPage）

**H5 源**：`src/components/camera/CameraPage.tsx`（321 行）
**小程序**：`apps/wechat-miniprogram/miniprogram/pages/camera/`

### H5 功能清单

| 功能 | H5 实现 | 小程序对齐 |
|------|---------|-----------|
| 相机/相册切换 | 底部 sheet 切换 `camera` / `gallery` 模式 | `wx.chooseMedia` 内置切换 |
| 多图选择 | 最多 N 张，已选缩略图横向滚动 | `wx.chooseMedia` 的 `count` 参数 |
| 缩略图预览 | 横向 scroll，选中高亮，可删除 | `<scroll-view>` 横向 + `bindtap` 删除 |
| 拍照按钮 | 圆形大按钮，pulse 动画 | `<view>` + CSS animation |
| 相册按钮 | 小按钮在拍照旁 | `<view>` bindtap |
| 确认/分析按钮 | 选择照片后出现 | 条件渲染 |
| 返回按钮 | 左上角 X/← | 导航栏或自定义 |
| 空态 | 未选照片 → 仅显示拍照界面 | 条件渲染 |

### 对齐步骤

1. 用 `wx.chooseMedia` 替代自定义相机 UI（微信强制要求）
2. 或保留 H5 完整 UI，用 `<camera>` 组件模拟
3. 已选照片用 `<scroll-view>` + `<image>` 展示
4. JS：管理 `selectedPhotos[]` 数组，增删改查

---

## 页面 3：加载页（LoadingPage）

**H5 源**：`src/components/results/LoadingPage.tsx`（388 行）
**小程序**：`apps/wechat-miniprogram/miniprogram/pages/loading/`（WXML 约 17 行）

### H5 功能清单

| 功能 | H5 实现 | 小程序对齐 |
|------|---------|-----------|
| FoodCharacters 动画 | 碗/盘子/星星 SVG 动画（steamA/bowlFloat/sparkleA 等） | 用 WXML `<image>` 或 `<svg>` 还原 |
| 进度条 | animated progress bar，OCR 完成后跳 100% | `<progress>` 组件 + 绑定数据 |
| 分阶段文案 | "正在识别菜单文字..." / "AI 翻译中..." / "生成图片中..." | `setData` 按秒更新文案 |
| 轮询 | `pollTask(taskId)` 每 3-5 秒查 `/api/v1/task/{id}` | `setInterval` → `wx.request` |
| 取消按钮 | 取消加载，返回首页 | `<button>` bindtap |
| 失败处理 | OCR 失败 → 错误信息 + 重试/返回 | 条件渲染错误态 |
| 模拟数据 fallback | `useMock` 时跳过 OCR | 开发模式用 mock |

### 对齐步骤

1. 读 H5 `LoadingPage.tsx` + `FoodCharacters.tsx`
2. 还原所有 CSS keyframes（steamA1-3, bowlFloat, sparkleA, plateFloat 等）
3. 轮询逻辑：`setInterval` + `wx.request` → `wx.navigateTo` results
4. 进度计算：`progress = completedPages / totalPages`
5. 分阶段文案时间线对齐 H5

---

## 页面 4：结果页（ResultsPage）

**H5 源**：`src/components/results/ResultsPage.tsx`（347 行）
**小程序**：`apps/wechat-miniprogram/miniprogram/pages/results/`（WXML 约 31 行）

### H5 功能清单

| 功能 | H5 实现 | 小程序对齐 |
|------|---------|-----------|
| Header | ← 返回 + 语言标签（"法语 → 中文"）+ 分享按钮 | WXML header |
| 过敏原提示条 | `showAllergens` 时显示橙色提示条 + 脉冲圆点 | 条件渲染 |
| 菜品卡片列表 | 圆角卡片：序号 + 图片 + 菜名(zh+en) + 标签 | `<view wx:for>` |
| 图片容器 | `DishImageWithLoading` — pending 显示 SVG loading，完成显示真实图 | 两张 `<image>`：loading SVG + 真实图，条件切换 |
| 图片 onError | 真实图加载失败回退 loading | `binderror` 事件 |
| 卡片标签 | 素食、辛辣、AI 推荐参考 等 pill | `<view>` pill 样式 |
| 骨架屏 | 加载中显示 skeleton shimmer | `<view>` 骨架 + CSS shimmer |
| 生图进度 | `imageGenProgress` → "AI 正在生成图片 · 50%" | 在 header 或列表顶部显示 |
| 空态 | 说明页（page_type=info）→ 渲染说明文字 | 条件渲染 |
| 失败态 | 全部页面 OCR 失败 → 错误页 | ErrorPage |
| 点击进详情 | `onDishDetail(dish)` → 跳转 DishDetailPage | `wx.navigateTo` detail |
| 动画 | fadeSlideUp 卡片依次出现 | CSS animation-delay 按 index |
| 轮询更新 | 每 5 秒轮询更新 AI 图片 | `setInterval` + `setData` |

### 对齐步骤

1. 读 H5 `ResultsPage.tsx` + `DishImageWithLoading.tsx` 完整代码
2. 卡片列表还原：圆角、间距、阴影、排版
3. 图片容器双态切换（loading SVG / 真实 `<image>`）
4. 轮询逻辑 — 结果页也持续拉取 AI 图片更新
5. 标签 pill 系统对齐 H5 的 Pill 组件
6. 骨架屏适配小程序 `<view>` + shimmer animation

---

## 页面 5：详情页（DishDetailPage）

**H5 源**：`src/components/dish/DishDetailPage.tsx`（256 行）
**小程序**：`apps/wechat-miniprogram/miniprogram/pages/detail/`（WXML 约 37 行）

### H5 功能清单

| 功能 | H5 实现 | 小程序对齐 |
|------|---------|-----------|
| Header | ← 返回 + "菜品详情" + 分享 + 收藏心形 | WXML header |
| Hero 图片 | `DishImageWithLoading` size="hero" — 200px 高，loading SVG 或真实图 | `<image>` 双态 |
| Hero 进度 | `AI 正在生成图片 · 50%` | 条件渲染 text |
| 菜名 | 中文(serif 700) + 原文(italic) | `<text>` + class |
| AI 标签 | "AI 推荐参考" pill | `<view>` pill |
| 过敏原 | 橙色高亮条 | 条件渲染 |
| 风味特征 | `insight.recommendation`（AI 优先 → 模板 fallback） | 同 H5 逻辑 |
| 点单建议 | `insight.goodFor` | 同上 |
| 注意事项 | `insight.caution` | 同上 |
| 食材标签 | ingredients 列表 → 绿色 pill | `<view wx:for>` |
| 评价列表 | 3 条最新评价（头像+用户名+评分+内容） | `<view wx:for>` |
| 收藏按钮 | ❤️ 心形 toggle + heartbeat 动画 | `<image>` + CSS animation |
| 写评价按钮 | 底部 CTA | `<button>` |

### 对齐步骤

1. 读 H5 `DishDetailPage.tsx` + `dish-presentation.ts` 的 `getDishInsight`
2. 还原 Hero loading SVG（12 种动画 variant — burger/wrap/drink 等）
3. 还原风味/推荐/注意三栏排版
4. 收藏心形：`wx.setStorage` + heartbeat animation
5. 评价区域：拉取 API `/api/v1/dish/{id}/reviews`

---

## 页面 6：分享页（Share-Menu）

**H5 源**：微信内分享使用原生 API，H5 外使用 Web Share API
**小程序**：`apps/wechat-miniprogram/miniprogram/pages/share-menu/`

### H5 功能清单

| 功能 | H5 实现 | 小程序对齐 |
|------|---------|-----------|
| 分享卡片预览 | 缩略图 + 餐厅名 + 菜品数 | Canvas 生成分享图 |
| 发送给朋友 | `wx.shareFileMessage` / `navigator.share` | `<button open-type="share">` |
| 复制链接 | `navigator.clipboard.writeText` | `wx.setClipboardData` |
| 生成海报 | Canvas 合成（菜品图 + QR code + 品牌） | `wx.createOffscreenCanvas` |
| 保存图片 | 下载图片到相册 | `wx.saveImageToPhotosAlbum` |

### 对齐步骤

1. 分享卡片 Canvas 渲染：dish 缩略图 + 品牌 + QR 码
2. 原生分享按钮触发 `onShareAppMessage`
3. 复制链接：`wx.setClipboardData({ data: url })`

---

## 页面 7：个人中心（Profile）

**H5 源**：无独立 Profile 页，功能分布在 SettingsPage + HistoryPage + FavoritesPage
**小程序**：`apps/wechat-miniprogram/miniprogram/pages/profile/`

### H5 功能清单（合并 Settings + History + Favorites）

| 功能 | H5 实现 | 小程序对齐 |
|------|---------|-----------|
| 用户头像/昵称 | `wx.getUserProfile` / `open-data` | `<open-data>` |
| 翻译历史 | `HistoryPage` — 列表 + 点击跳转 | `<view wx:for>` + `wx.navigateTo` |
| 收藏列表 | `FavoritesPage` — 网格/列表 + 点击跳转 | 同上 |
| 设置 | 目标语言、过敏原显示、素食标记 | `<switch>` / `<picker>` |
| 关于 | 版本号、反馈入口 | `<view>` |

---

## 全局对齐

### 设计 Token（取自 `globals.css`）

| Token | 值 | 小程序变量 |
|-------|-----|-----------|
| `--bg` | #FFF5E9 | page bg |
| `--card` | #FFFBF5 | card bg |
| `--ink` | #2D2D2D | 主文字色 |
| `--ink-soft` | #8B7355 | 副文字色 |
| `--primary` | #4CAF50 | 主色(绿) |
| `--accent` | #FF9F1C | 强调色(橙) |
| `--stroke` | #D4A574 | 描边(棕) |
| `--radius` | 18px | 圆角 |
| `--radius-lg` | 24px | 大圆角 |
| `--font-display` | Source Serif 4 / Georgia | 菜名/标题 |
| `--font-body` | Poppins / -apple-system | UI/按钮 |
| `--font-ui` | Inter / PingFang SC | 标签/设置 |

### 动画

| 动画 | H5 keyframe | 小程序实现 |
|------|-----------|-----------|
| 卡片入场 | `fadeSlideUp 0.35s ease-out` | `animation: fadeSlideUp 0.35s ease-out` |
| 碗浮动 | `bowlFloat 3s ease-in-out infinite` | 同上 |
| 星星闪烁 | `sparkleA 2.2s` | 同上 |
| 心形跳动 | `heartbeat 0.6s ease-out` | 同上 |
| 呼吸灯 | `breathe 2s infinite` | 同上 |

### API 复用

所有小程序页面直接调用 H5 已有的 API 端点：

| API | 用途 |
|-----|------|
| `POST /api/v1/translate/menu` | 上传菜单翻译 |
| `GET /api/v1/task/{id}` | 轮询任务状态和结果 |
| `POST /api/v1/wechat/session` | 微信登录换 token |
| `GET /api/v1/dish/{id}/reviews` | 获取菜品评价 |
| `POST /api/v1/dish/{id}/review` | 提交评价 |
| `GET /api/v1/favorites` | 获取收藏 |
| `GET /api/v1/history` | 获取历史 |
| `GET /api/v1/user/profile` | 获取用户信息 |

---

## 执行顺序

建议 3 轮迭代：

**Round 1 · 核心链路（2-3 天）**
- 首页 → 拍照 → 加载 → 结果 → 详情
- 目标：单张菜单翻译从头到尾可用

**Round 2 · 图片体验（1-2 天）**
- DishImageWithLoading 完整还原（12 种 SVG loading + progress + onError）
- 轮询更新 AI 图片
- 设计 token 全部对齐

**Round 3 · 周边功能（1-2 天）**
- 分享 → Profile → 历史 → 收藏 → 设置
- iPhone 设备预览截图验证

---

## 执行命令（给 Codex）

```
# 切换到小程序分支
git checkout feature/wechat-miniprogram

# 对齐单个页面（示例：首页）
1. Read src/components/home/HomePage.tsx（完整）
2. Read src/app/page.tsx 中 historyEntries/dailyDish 相关代码
3. Read apps/wechat-miniprogram/miniprogram/pages/home/index.wxml
4. Read apps/wechat-miniprogram/miniprogram/pages/home/index.wxss
5. Read apps/wechat-miniprogram/miniprogram/pages/home/index.js
6. 重写 WXML/WXSS/JS，确保与 H5 1:1
7. 每个页面完成后标记为 done，提交

# 验证
node scripts/check-miniprogram.mjs
```
