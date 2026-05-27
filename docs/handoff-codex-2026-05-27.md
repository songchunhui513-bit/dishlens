# DishLens Codex 交接文档 — 2026-05-27

## 当前进展

- 线上已部署提交 `cf0b41e Fix repeated dish recommendation fallbacks`。
- 修复绿色推荐文案重复问题：`src/lib/dish-presentation.ts` 不再只按饮品/甜品/海鲜等大类套固定话术，而是基于菜名、描述、食材生成逐菜推荐。
- 修复误分类：`鲜甜` 不再触发甜品推荐；含 `花雕酒` 的蟹类菜不再触发饮品推荐。
- 已新增回归测试：`tests/logic-regressions.test.mjs` 覆盖豆酱焗斗仑、椒盐油膳、陈年花雕焗膏蟹、橄榄油炒杂菜、樱花虾拌马家沟有机芹菜，保证 5 道菜得到 5 条不同推荐。

## 验证结果

- `node --test tests/logic-regressions.test.mjs`：通过，17/17。
- `npm run lint`：通过。
- `npm run build`：通过。
- ECS 已执行 `git pull --ff-only && npm run build && pm2 restart dishlens`，PM2 `dishlens` 状态 online。
- 线上首页 `https://dishlens.wukongmkt.com/` 返回 200。

## 当前模型与依赖

- 本地能力：知识库图片匹配、ECS 本地已生成图缓存、前端展示文案 fallback、历史/分享页展示逻辑。没有本地大模型在生产环境承担核心 OCR 或生图。
- 云端能力：OCR/翻译优先级为 Qwen > DeepSeek > Gemini > Ollama；线上同时配置了 Qwen、DeepSeek、Gemini，因此实际优先走 Qwen。
- AI 生图：阿里 DashScope Wan，当前模型 `wanx2.1-t2i-turbo`。
- 数据与持久化：Supabase Storage + Supabase 表；ECS `public/generated-dishes/` 保存本地生成图缓存。
- 用户自己的主机离线不会影响线上产品；ECS、Qwen/DashScope、Supabase 任一不可用会影响对应功能。

## 遗留事项

- 本地知识库图片仍需继续补齐。上一版文档记录为 534/1022，越接近 100% 上传后等待时间越短。
- `public/dishes/` 新下载图片需要持续检查并纳入 Git，避免本地和线上图库漂移。
- AI 生图仍是最慢链路。当前已做缓存复用，但首次遇到本地图库没有的新菜仍需等待 Wan 生成。
- ECS `public/generated-dishes/` 会持续增长，需要监控磁盘；多实例部署时要迁移到共享存储或完全依赖对象存储。
- 绿色推荐现在是本地规则增强版；若要更像真正“美食顾问”，下一步可以让 OCR/翻译富模式稳定产出 per-dish `recommendation/good_for/caution`，前端只在缺失时 fallback。
- DeepSeek provider 已接入，但当前 provider 优先级下线上不会使用它，除非移除或禁用 Qwen API Key。

## 下一步建议

1. 继续跑 `scripts/download-knowledge-images.mjs` 补齐知识库图片。
2. 用同一批真实菜单重复上传测试，记录每道菜命中的图片层级：本地图库、ECS 缓存、Supabase、AI 生图。
3. 针对中文海鲜、粤菜、饮品、汤类继续补 `buildSpecificRecommendation()` 和 `classifyDishImageKind()` 的规则样本。
4. 做一个面向运营的图片诊断页，把每道菜为什么用这张图、是否待生成、缓存键是什么直接展示出来。
