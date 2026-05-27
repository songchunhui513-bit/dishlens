# DishLens 微信小程序 PRD

日期：2026-05-27
分支：feature/wechat-miniprogram
状态：M1 研发启动

## 1. Executive Summary

DishLens 将新增一个原生微信小程序，用于让国内微信用户以更低摩擦完成拍菜单、翻译、查看菜品详情、保存与分享。小程序复用现有 H5 后端 API 与业务模型，H5 线上页面继续作为全球公开访问与海外分享兜底，不因为小程序研发改变现有部署链路。

## 2. Problem Statement

当前 H5 已经可以识别菜单并生成公开分享页，但微信场景存在两个结构性限制：

- 微信内 H5 依赖浏览器能力时，转发给朋友、系统分享、剪贴板反馈容易受微信 WebView 限制影响。
- 国内用户希望直接把菜单卡片转发到微信聊天，小程序分享体验更自然。
- 海外用户不用微信，仍需要能通过 WhatsApp、Telegram、LINE、Facebook、X 或普通链接打开公开 H5 页面。

因此小程序不是替换 H5，而是补齐微信生态内的原生入口。

## 3. Target Users & Personas

主要用户：

- 国内旅行者：在海外餐厅拍外文菜单，希望快速翻译成中文，并直接发微信群让同行一起看。
- 国内微信用户：习惯在微信聊天、收藏、朋友圈内保存和传播内容。
- 海外同行或非微信用户：收到链接后无需安装微信，能从 H5 公网页面打开菜单。

Jobs-to-be-done：

- 当我拿到一份外文菜单时，我想拍照并快速得到中文菜品列表，以便决定点什么。
- 当我和朋友一起吃饭时，我想把翻译好的菜单发到群里，以便大家不用登录也能查看。
- 当朋友不在微信环境时，我想复制一个公开链接，以便任何浏览器都能打开。

## 4. Strategic Context

产品策略：

- 国内增长：微信小程序承接微信内自然分享，提高转发成功率和打开率。
- 全球可达：H5 公开分享页保留为跨平台统一 URL，覆盖海外社交工具。
- 技术隔离：小程序代码独立在 `apps/wechat-miniprogram`，避免影响当前 H5 发布。

## 5. Solution Overview

采用原生微信小程序 + 复用现有后端 API/业务模型。

核心范围：

- 首页：复刻当前 H5 的 DishLens 品牌质感和主要入口。
- 拍菜单：调用微信原生相机/相册能力选择菜单图片。
- 翻译进度：复用任务轮询模型，展示加载插画和进度。
- 结果页：展示菜品卡片、菜品详情、推荐/提醒信息。
- 小程序分享页：通过 `pages/share-menu/index?taskId=...` 打开同一份菜单。
- 账号体系：静默登录获取微信身份，需要头像昵称时再请求用户完善。
- H5 兜底：菜单仍生成 `https://dishlens.wukongmkt.com/share/{taskId}` 公开链接。

## 6. Login Strategy Decision

推荐方案：静默登录 + 需要时完善头像昵称。

对比：

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 静默登录 + 按需完善头像昵称 | 首次使用无打断；可用 OpenID 绑定历史、收藏、分享身份；符合微信隐私交互趋势 | 需要服务端维护微信 session；头像昵称不是一开始就有 | 采用 |
| 强制授权登录 | 账号资料较早完整 | 用户刚想拍菜单就被打断，转化损耗大；微信头像昵称也不能静默拿 | 不采用 |
| 完全匿名本地 | 开发最快，无账号依赖 | 无法跨设备同步；收藏/历史/分享身份弱；后续迁移成本高 | 仅作为登录失败兜底 |

登录行为：

- App 启动时调用 `wx.login()` 获取 code。
- 小程序把 code 发给后端 `/api/v1/wechat/session`。
- 后端调用微信 `code2Session`，只在服务端处理 AppSecret 和 session_key。
- 后端返回自定义 session token，小程序本地保存。
- 当用户进入个人资料、需要展示分享人身份、云端收藏/历史时，再通过 `chooseAvatar` 和 `type="nickname"` 完善资料。

参考微信官方文档：

- [小程序登录](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- [auth.code2Session](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)
- [头像昵称填写能力](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)

## 7. Share Strategy Decision

推荐方案：小程序内分享为主，H5 公开页兜底。

对比：

| 方案 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- |
| 只做小程序内分享页 | 微信聊天体验最好；可用原生分享卡片；打开速度快 | 非微信/海外用户不可达；普通浏览器无法打开 | 不单独采用 |
| 只跳 H5 公开页 | 全球通用；现有链路成熟 | 微信内分享体验受 WebView 限制；不像原生小程序卡片 | 不单独采用 |
| 小程序分享页 + H5 公开页兜底 | 微信内原生、海外可打开；同一 taskId，同一业务模型 | 需要维护两个前端壳层 | 采用 |

分享行为：

- 小程序内“分享给朋友”使用 `onShareAppMessage`，路径为 `/pages/share-menu/index?taskId={taskId}`。
- 小程序内“复制公开链接”复制 `https://dishlens.wukongmkt.com/share/{taskId}`。
- 海外社交工具仍通过 H5 分享页承接。
- 如果对方没有微信或不在微信环境，公开 H5 链接仍能打开。

## 8. Success Metrics

M1 可用性指标：

- 小程序可在微信开发者工具打开并完成基础页面导航。
- 成功静默登录后能拿到自定义 session token。
- 单张菜单图片能创建翻译任务并轮询到结果。
- 小程序分享卡片能打开分享页并展示同一 taskId 结果。
- H5 现有 build/lint 不因小程序新增代码失败。

后续增长指标：

- 微信转发菜单点击打开率。
- 小程序拍菜单到结果页完成率。
- 分享页二次打开率。
- 收藏/历史登录绑定率。

## 9. User Stories & Requirements

### 拍菜单翻译

- 作为微信用户，我可以从首页进入拍菜单页。
- 作为微信用户，我可以用相机或相册选择菜单图片。
- 作为微信用户，我可以看到识别进度和失败提示。
- 作为微信用户，我可以在结果页看到菜品中文名、原文名、描述、推荐和提醒。

### 微信账号

- 作为首次用户，我打开小程序不需要先授权头像昵称。
- 作为需要保存记录的用户，我可以在需要时完善头像昵称。
- 作为服务端，不能把 AppSecret 或 session_key 暴露给小程序。

### 分享菜单

- 作为微信用户，我可以把翻译好的菜单作为小程序卡片转发给朋友。
- 作为收到分享的人，我点击小程序卡片能直接看到菜单内容。
- 作为海外或非微信用户，我可以通过公开 H5 链接打开菜单。

## 10. Out of Scope

M1 暂不做：

- 独立重写 OCR/AI 菜单识别后端。
- 迁移或替换当前 H5 页面。
- 支付、会员、商家后台。
- 完整 IM 群协作编辑。
- 小程序内 WebView 承载 H5 作为主体验。

## 11. Dependencies & Risks

依赖：

- 微信小程序 AppID 与 AppSecret。
- 微信后台配置 request/uploadFile/downloadFile 合法域名。
- 现有 `/api/v1/translate/menu`、`/api/v1/task/[id]` 稳定可用。
- Supabase tasks 表保持现有结构。

风险与应对：

- 多图上传：微信 `uploadFile` 原生接口更适合单文件上传，M1 先跑通单图，随后补小程序专用多图上传适配端点。
- 登录数据落库：当前 H5 Supabase 用户体系基于 Web Auth，小程序先签发微信 session token，后续新增微信用户表映射。
- 海外打开：小程序卡片不适合海外社交传播，因此必须保留 H5 公开链接。
- 审核合规：头像昵称只能由用户主动填写，不能静默读取。

## 12. Open Questions

- 小程序正式 AppID 是否已经注册，是否需要测试号先联调。
- 微信用户数据是否需要和未来邮箱/Apple/Google 登录做 UnionID 统一账号。
- 分享图是否使用现有插画图标，还是为小程序卡片单独导出 5:4 分享封面。
