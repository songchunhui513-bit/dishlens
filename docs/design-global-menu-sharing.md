# DishLens 全球菜单分享交互定稿

日期：2026-05-27

## 设计原则

分享不是一个“微信功能”，而是一条全球通用的传播路径。国内用户要能顺手发微信，海外用户要能顺手发 WhatsApp、Telegram、LINE、Facebook 或 X。界面应把“发给朋友”和“复制链接”作为稳定主路径，把具体社交渠道作为快捷入口。

## 入口

### 结果页

位置：识别结果摘要区域原有“分享菜单”按钮。

行为：点击后打开底部分享面板，不再直接调用单一 `navigator.share`。

### `/share/[id]`

位置：公开分享页顶部操作区“分享给朋友”。

行为：点击后打开同一底部分享面板，允许接收者继续转发。

## 分享面板

形态：移动端优先的底部 sheet，桌面端居中但保持同一内容结构。

内容结构：

1. 标题：分享这份菜单。
2. 菜单摘要：菜品数量、源语言、代表菜品。
3. 链接展示：显示 `/share/{id}`，方便用户确认分享的是公开页。
4. 主要操作：发给朋友、复制链接。
5. 渠道快捷入口：微信、WhatsApp、Telegram、LINE、Facebook、X。
6. 状态反馈：复制成功、打开失败、用户取消分享等。

## 渠道策略

### 发给朋友

优先调用 `navigator.share`。支持的平台会打开手机分享菜单，覆盖 AirDrop、Messages、WhatsApp、微信、Telegram 等已安装应用。

如果浏览器不支持，则自动复制链接并显示提示。

### 复制链接

优先使用 `navigator.clipboard.writeText`。不可用时使用隐藏 textarea fallback。复制内容为完整分享 URL。

### 微信

不使用私有 deep link。微信按钮执行“手机分享菜单优先，复制链接兜底”的策略，并提示用户可粘贴到微信好友或微信群。

### WhatsApp

使用 `https://wa.me/?text={encodedMessage}`，消息包含标题、摘要和分享 URL。

### Telegram

使用 `https://t.me/share/url?url={url}&text={text}`。

### LINE

使用 `https://social-plugins.line.me/lineit/share?url={url}`。

### Facebook

使用 `https://www.facebook.com/sharer/sharer.php?u={url}`。

### X

使用 `https://twitter.com/intent/tweet?text={text}&url={url}`。

## 文案

主标题：分享这份菜单

发给朋友：发给朋友

复制链接：复制链接

微信反馈：链接已复制，可粘贴到微信/微信群

复制成功：分享链接已复制

分享菜单不可用：已复制链接，可粘贴到任意聊天工具

## 空状态与异常

当没有 task id 时，不展示分享面板，保留按钮可见性由调用方控制。

当目标渠道无法生成链接时，使用手机分享菜单或复制链接兜底。

当用户取消分享时，不显示错误，只关闭原生面板。

## 可访问性

分享面板使用 `role="dialog"` 和 `aria-modal="true"`。

关闭按钮有明确 `aria-label`。

渠道支持文本通过 sr-only 暴露给辅助技术：微信、WhatsApp、Telegram、LINE、Facebook、X。
