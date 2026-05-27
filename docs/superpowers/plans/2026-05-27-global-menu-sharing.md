# 全球菜单分享落地计划

日期：2026-05-27

## 目标

把方案 A 分享原型接入真实结果页和 `/share/[id]`，同时从微信群扩展到全球分享场景。

## 步骤

1. 梳理需求、交互和技术方案。
2. 先写回归测试，锁定分享链接生成、UI 接线和 metadata 行为。
3. 抽象分享元数据和渠道链接生成模块。
4. 实现统一分享面板。
5. 接入首页结果页。
6. 接入 `/share/[id]` 公开页。
7. 增加动态 Open Graph metadata。
8. 运行测试、lint、build。
9. 使用浏览器验证真实交互。
10. 同步文档到 Obsidian。

## 状态

已完成。

## 验证结果

- `node --test tests/logic-regressions.test.mjs`：通过。
- `npm run lint`：通过。
- `npm run build`：通过。
- 浏览器验证：结果页点击“分享菜单”可打开全球分享面板，面板包含发给朋友、复制链接、微信、WhatsApp、Telegram、LINE、Facebook、X。
