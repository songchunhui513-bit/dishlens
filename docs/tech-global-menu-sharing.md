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
- `buildShareHref(targetId, meta)`：生成渠道 URL。native、copy、wechat 返回 `null`，由 UI 分别走原生分享、复制链接和原生分享兜底路径。
- `appShareOrigin()`：统一读取 `NEXT_PUBLIC_APP_URL`，默认 `https://dishlens.wukongmkt.com`。

## UI 组件

`ShareSheet` 是客户端组件，接收：

- `open`
- `meta`
- `onClose`
- `onStatus`

组件职责：

1. 展示分享摘要和公开链接。
2. 微信按钮和“发给朋友”统一调用 `navigator.share` 打开原生分享页，且 `text` 使用 `buildShareMessage(meta)`，确保摘要和完整 URL 同时进入分享文本。
3. 调用 Clipboard API，并在 350ms 未返回时切换到 textarea fallback；如果浏览器权限连 fallback 也失败，中央 toast 明确提示“已显示链接，请长按上方链接复制”。
4. 打开 WhatsApp、Telegram、LINE、Facebook、X 外链，通过 `window.location.assign(href)` 触发 App 或分享页跳转。
5. 微信不使用私有 URL scheme，也不主动调用微信桥接；原生分享不可用时复制链接兜底。
6. 在面板中央展示强 toast，覆盖复制成功、原生分享失败兜底和 App 打开中状态。

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

分享面板顶部摘要卡使用独立菜单插画，避免与下方微信渠道图标重复；微信渠道图标保留双气泡特征。

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

真实微信内置浏览器验证后，直接调用微信桥接会出现返回失败并触发复制兜底的情况，无法稳定打开用户预期的原生分享页。因此当前策略调整为：

1. “发给朋友”和“微信”按钮都调用 `navigator.share`。
2. 分享 payload 同时传入 `title`、`text` 和 `url`。
3. `text` 使用 `buildShareMessage(meta)`，把菜单摘要和完整 URL 放在同一段文字里，避免“分享到其他”只带文字不带链接。
4. 如果 `navigator.share` 不存在、失败或目标 App 没有接住，则复制 `/share/{id}` 完整 URL，并在中央 toast 明确提示。
5. 不再主动使用 `WeixinJSBridge` 或微信私有 URL scheme，避免真实设备上出现“微信分享未完成，链接已复制”的误导提示。

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
9. iOS 分享预览必须有 root Apple touch icon、Open Graph 预览图，微信分支必须调用 `shareNative`，由原生分享页接管。
10. 复制链路包含 Clipboard API 超时兜底，避免权限环境导致点击后无反馈。
11. 微信入口不包含 `WeixinJSBridge`、`sendAppMessage`，原生分享文本包含 `buildShareMessage(meta)`。
12. 顶部摘要卡使用 `targetId="menu"`，复制反馈通过 `role="status"` 与 `aria-live="polite"` 暴露。

## 已验证命令

```bash
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

以上命令均已通过。

## 后续建议

1. 上线后补充分享渠道点击埋点。
2. 如果后续要做微信内更深度的分享控制，再单独评估微信 JS-SDK 能力、服务端签名和真实设备兼容性；不要直接恢复未验证的桥接调用。
3. 增加分享页菜品筛选和“我想吃”轻量协作能力，承接群内讨论。
