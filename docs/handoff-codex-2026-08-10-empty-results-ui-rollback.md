# DishLens Codex 交接文档 - 2026-08-10

## 本轮目标

1. 修复识别失败后进入 `UNKNOWN -> 中文` 空菜单页的问题。
2. 将核心产品 UI 恢复到上一版更紧凑、安静的视觉风格。
3. 保留近期已经上线的长菜单识别、图片本地化、渐进补图和失效图片兜底能力。

## 根因与修复

### 空菜单页

根因位于 `src/components/results/LoadingPage.tsx`：

- JavaScript 中空数组 `[]` 为真值，旧逻辑只判断 `saved.pages` 是否存在，因此把 `pages: []` 当作可展示结果。
- `failed`、`partial`、`done` 共用一条完成分支；当所有页面失败时仍调用 `onComplete`，最终进入空 Results 页面。

修复方式：

- 新增纯函数 `classifyLoadingResult`：只有“至少一道菜”或明确的 `info/说明页` 才可展示；`pages: []` 和“菜单页存在但菜品为空”都按无效结果处理。
- 新增 `resolveLoadingTaskAction`，统一处理初始缓存响应、轮询响应和失败终态。
- `failed` 且没有有效内容时进入恢复/重试流程；如果失败任务保留了已识别菜品，则仍展示这些部分结果，不浪费用户已经等待到的数据。
- 超时读取本地任务结果时也使用相同的有效结果判断。

### UI 偏离上一版

近期版本把首页、菜单卡片和详情页整体放大，并加入点状背景、图片侧轨、编号胶囊和绿色推荐框，造成信息密度下降、页面显得笨重。

本轮仅回退视觉层：

- 首页恢复紧凑字号、推荐卡和操作区层级。
- 菜单卡恢复纯色表面、轻阴影、横向菜名和价格、普通编号与自然绿色推荐文字。
- 详情页恢复更克制的标题和正文层级，去掉推荐内容外层装饰卡。
- 保留 `FoodThumbnailFallback`、图片加载动画、图片重试、按需预热、长菜单分批渲染和点单功能。
- 保留 44px 主要触控热区，避免机械回退到不可用的小按钮。

## 变更文件

- `src/components/results/LoadingPage.tsx`
- `src/lib/loading-result-routing.ts`
- `src/app/page.tsx`
- `src/components/results/ResultsPage.tsx`
- `src/components/home/HomePage.tsx`
- `src/components/dish/DishDetailPage.tsx`
- `src/app/globals.css`
- `tests/logic-regressions.test.mjs`

## 验证结果

- `node --test tests/*.test.mjs`：177/177 通过。
- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过，Next.js 16.3.0 生产构建成功。
- Sonnet + `agent-browser`，390x844：
  - 首页无横向溢出、无重叠、首屏图片正常。
  - 上传真实法语菜单后识别 34 道菜，显示 `FR -> 中文`，结果和分类正常。
  - 上传非菜单应用图标后显示“非菜单页面”，未出现 `UNKNOWN` 空菜单。

浏览器验证截图：

- `/tmp/dishlens-qa-home.png`
- `/tmp/dishlens-qa-results.png`
- `/tmp/dishlens-qa-failure.png`

## 后续观察项

- 个别真实菜单的自动分类标签仍可能受 OCR 文本干扰，例如主菜被误标为饮品或甜点；不影响本轮识别成功率，但建议后续单独优化分类置信度和冲突规则。
- 菜单卡目前仍以整卡按钮承载详情跳转，后续可改善屏幕阅读器的可访问名称组织。
