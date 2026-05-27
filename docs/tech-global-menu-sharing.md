# DishLens 全球菜单分享技术文档

日期：2026-05-27

## 代码范围

新增：

- `src/lib/share-menu.ts`
- `src/components/share/ShareSheet.tsx`

修改：

- `src/app/page.tsx`
- `src/components/share/SharedMenuPage.tsx`
- `src/app/share/[id]/page.tsx`
- `src/app/layout.tsx`
- `src/app/icon.svg`
- `public/icons/icon-192.svg`
- `public/icons/icon-512.svg`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/apple-touch-icon.png`
- `public/apple-touch-icon.png`
- `public/icons/share-preview-20260527.png`
- `src/app/favicon.ico`
- `tests/logic-regressions.test.mjs`

## 分享领域模型

`src/lib/share-menu.ts` 负责生成跨页面可复用的分享数据。

核心导出：

- `SHARE_TARGETS`：渠道配置，顺序为 native、copy、wechat、whatsapp、telegram、line、facebook、x。
- `buildShareMenuMeta(result, origin, taskId)`：从识别结果生成分享标题、摘要、URL、代表菜品、语言等。
- `buildShareMessage(meta)`：生成可放入聊天工具的文本。
- `buildShareHref(targetId, meta)`：生成渠道 URL。native、copy、wechat 返回 `null`，由 UI 分别走原生分享、复制链接和微信复制路径。
- `appShareOrigin()`：统一读取 `NEXT_PUBLIC_APP_URL`，默认 `https://dishlens.wukongmkt.com`。

## UI 组件

`ShareSheet` 是客户端组件，接收：

- `open`
- `meta`
- `onClose`
- `onStatus`

组件职责：

1. 展示分享摘要和公开链接。
2. 调用 `navigator.share`。
3. 调用 Clipboard API，并在 350ms 未返回时切换到 textarea fallback。
4. 打开 WhatsApp、Telegram、LINE、Facebook、X 外链。
5. 微信入口固定复制链接，避开 iOS 微信分享扩展卡住。

## 图标定稿

最终采用方案 C「一起看菜」。

落地文件：

- `src/app/icon.svg`：Next app icon 和浏览器 SVG icon。
- `public/icons/icon-192.svg`、`public/icons/icon-512.svg`：manifest SVG icon。
- `public/icons/icon-192.png`、`public/icons/icon-512.png`、`public/icons/apple-touch-icon.png`：PWA 和 Apple touch icon。
- `public/apple-touch-icon.png`：root Apple touch icon，覆盖 iOS 分享面板和桌面添加入口对默认路径的探测。
- `public/icons/share-preview-20260527.png`：1200×630 分享预览图，用于 Open Graph、Twitter card 和 iOS 原生分享面板预览。
- `src/app/favicon.ico`：16/32/48 多尺寸 ICO。

图形结构：两个聊天气泡 + 餐碗 + 橙色星点 + 少量绿色线条。禁止回退到黑色箭头、放大镜、`DL` 文本、系统分享图标或大面积平台品牌色。

## 结果页接入

`src/app/page.tsx` 在有 `shareUrl` 和识别结果时构造 `shareMeta`。点击“分享菜单”只负责打开 `ShareSheet`，成功/失败反馈沿用页面 toast。

## 公开分享页接入

`src/components/share/SharedMenuPage.tsx` 复用 `ShareSheet`。接收者打开 `/share/[id]` 后可继续分享同一公开 URL。

## 动态元数据

`src/app/share/[id]/page.tsx` 新增 `generateMetadata`：

- 正常结果：基于菜单摘要生成 title、description、canonical、openGraph、twitter summary 和 `share-preview-20260527.png`。
- 不可用结果：返回稳定的失效标题、说明和同一分享预览图。

`src/app/layout.tsx` 新增 `metadataBase`，避免相对 Open Graph URL 在构建期不稳定。

`src/app/layout.tsx` 同时声明：

- `icons.apple`：`/apple-touch-icon.png?v=20260527` 与 `/icons/apple-touch-icon.png?v=20260527`，用版本参数帮助 iOS 脱离旧缓存。
- `openGraph.images` 和 `twitter.images`：指向 `/icons/share-preview-20260527.png`，避免系统分享面板回退到灰色罗盘。

## iOS 微信分享问题说明

截图中的页面是 iOS 原生分享面板，不是 DishLens 自定义分享面板。点击其中的“微信”后，链路会交给微信 App 的 iOS Share Extension，普通网页无法控制其加载过程，也无法拿到稳定错误回调。卡住常见原因包括微信扩展状态异常、登录态异常、iOS 缓存、系统分享扩展 bug 或微信未能处理当前 URL 预览。

因此本期修复不再让 DishLens 自定义微信入口调用 `navigator.share`。用户点击 DishLens 面板里的“微信”时，直接复制 `/share/{id}` 链接并提示打开微信粘贴。`发给朋友` 仍保留原生分享，服务 AirDrop、Messages、WhatsApp 等系统渠道；但产品文案引导微信用户走复制路径。

## 测试策略

`tests/logic-regressions.test.mjs` 新增覆盖：

1. 分享渠道链接生成：WhatsApp、Telegram、LINE、Facebook、X。
2. 微信不生成私有 deep link。
3. 结果页和公开分享页都接入 `ShareSheet`。
4. `/share/[id]` 有 `generateMetadata`、`openGraph`、`metadataBase`。
5. UI 文案包含国内和海外渠道。
6. 客户端能力包含 `navigator.share` 和 `clipboard.writeText`。
7. 方案 C 定稿图标包含聊天气泡和餐碗路径，并排除旧放大镜/纸飞机路径。
8. 分享面板文案包含“朋友不用登录”“聊天里粘贴链接”，并排除“系统分享”“短信”“邮件”等旧表达。
9. iOS 分享预览必须有 root Apple touch icon、Open Graph 预览图，微信分支不能调用 `navigator.share`。
10. 复制链路包含 Clipboard API 超时兜底，避免权限环境导致点击后无反馈。

## 已验证命令

```bash
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

以上命令均已通过。

## 后续建议

1. 上线后补充分享渠道点击埋点。
2. 如果要做微信内优化，再单独引入微信 JS-SDK，并在服务端处理签名。
3. 增加分享页菜品筛选和“我想吃”轻量协作能力，承接群内讨论。
