# DishLens Codex 交接文档 — 2026-05-25

工作目录：`/Users/julian/AI点菜/dishlens`
本轮重点：修复运行时崩溃、降低批量识别假死风险、继续推进菜品图片本地化。

## 已完成

### 1. Runtime Error 崩溃修复

根因：
- 后台通义万相生图返回的是 DashScope 临时 OSS 地址。
- `next/image` 未配置该动态域名，例如 `dashscope-result-wlcb-acdr-1.oss-cn-wulanchabu-acdr-1.aliyuncs.com`。
- 临时菜品没有数据库 ID，旧逻辑不会上传到 Supabase Storage，页面直接使用临时地址，导致开发态 Runtime Error。

修复：
- `next.config.ts` 增加 `**.aliyuncs.com` 远程图片白名单，避免 DashScope 临时地址直接崩溃。
- 新增 `src/lib/dish-image-persistence.ts`，为临时菜品生成稳定 storage id。
- `src/app/api/v1/translate/menu/route.ts` 后台生图现在会尝试把临时菜品图片也上传到 Supabase Storage，优先使用持久化 URL。

### 2. 批量识别稳定性

修复：
- 上传上限从 10 张提升到 20 张，覆盖当前测试集 15 张菜单图。
- 新增 `src/lib/image-input.ts`，统一识别 JPEG/PNG/WebP MIME 类型。
- 客户端上传 WebP 时会转成 JPEG，避免浏览器 canvas/WebP/模型 data URL 不一致。
- 服务端传给 Qwen VL 时保留正确 MIME，不再把所有图片伪装成 JPEG。
- OCR 并发默认降为 1，避免多张菜单同时打视觉模型导致任务假死或服务崩溃。
- 大于 4 页的批量上传默认使用 simple prompt，减少长菜单超时概率。
- Qwen VL 单次超时从 120s 降到 75s，内部重试从 2 次降到 1 次，避免单页拖数分钟。

### 3. 图片本地化进度

本轮补齐 12 张高频本地图，覆盖当前菜单样本常见项：
- `pasta-al-pesto`
- `thon-mijote`
- `tiramisu`
- `panna-cotta`
- `affogato`
- `focaccia-italiana`
- `carbonara`
- `ragu-alla-bolognese`
- `minestrone`
- `cannoli-siciliani`
- `gelato-italiano`
- `paneer-tikka`

当前知识库图片统计：
- 总数：1022
- 本地图：120
- 未本地化：902

同时扩展了 `src/lib/dish-image-match.ts` 的直接别名匹配，让当前菜单中的青酱意面、Carbonara、Bolognese、Minestrone、Tiramisu、Panna Cotta、Affogato、Cannoli、Gelato、Focaccia、Paneer 等能优先命中本地图。

### 4. 质量验证

已通过：
```bash
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

浏览器验证：
- `http://localhost:3000/` 已重新加载。
- Runtime Error 消失。
- 首页正常渲染，本地推荐图正常显示。

## 仍需继续

### P0：继续完成 90% 图片本地化

当前仍有 902 张未本地化。建议下一步按菜系分批跑：
```bash
node scripts/generate-dish-content.mjs --images-only --cuisine french
node scripts/generate-dish-content.mjs --images-only --cuisine italian
node scripts/generate-dish-content.mjs --images-only --cuisine Japanese
node scripts/generate-dish-content.mjs --images-only --cuisine chinese
node scripts/generate-dish-content.mjs --images-only --cuisine Indian
```

注意：
- 通义万相并发保持 1。
- 每张图约 0.04 元。
- 900 张约 36 元，预计需要数小时。
- 脚本支持断点续跑，已生成图片会跳过。

### P1：继续压测 15 张样本菜单

本轮已修掉上传上限、MIME、并发、超时问题。建议下一轮用用户提供的 15 张菜单分 3-5 张一组跑完整识别，重点记录：
- 哪些图仍识别慢。
- 哪些图返回 0 菜品。
- 哪些菜没有命中本地图。

## 关键文件

- `next.config.ts`
- `src/app/api/v1/translate/menu/route.ts`
- `src/lib/ai/qwen.ts`
- `src/lib/image-input.ts`
- `src/lib/dish-image-persistence.ts`
- `src/lib/dish-image-match.ts`
- `src/lib/api-client.ts`
- `public/dish-knowledge-db.json`
- `public/dishes/`
- `tests/logic-regressions.test.mjs`

---

## 2026-05-25 追加：重复图与全量本地化

### 重复图修复

用户反馈 La Reine / La Genovese / La Trois Fromages 连续 3 个披萨卡片显示同一张图。

根因：
- 这些披萨变体没有命中本地知识库图片时，会落入少量通用 Unsplash fallback，视觉上容易重复。
- `La Genovese` 旧别名容易被当成 `pasta-al-pesto`，菜品类型错误。
- 前端 `getDishImageUrl` 旧逻辑优先使用旧任务里的 `ai_image_url`，会盖过后续补齐的本地图。

修复：
- `src/lib/dish-image-match.ts` 新增披萨本地图 override：
  - `LA REINE` → `/dishes/pizza-prosciutto-funghi.png`
  - `LA GENOVESE` → `/dishes/pizza-genovese.png`
  - `LA TROIS FROMAGES` → `/dishes/pizza-quattro-formaggi.png`
- `src/lib/dish-presentation.ts` 调整取图优先级：用户真实图 > 本地知识库 > 远程 AI 图 > fallback。
- 新增测试保证这 3 个披萨不会再坍缩到同一张通用图。

### 图片质量规范

`scripts/generate-dish-content.mjs` 已增加统一生图规范：
- realistic restaurant food photography
- accurate ingredients and plating
- single finished dish as main subject
- 45-degree overhead angle
- warm natural light
- no text / logo / watermark / hands / people / menu
- negative_prompt 排除文字、Logo、水印、人物、菜单、错误食材、重复盘子等。

### 已补本地图

本轮额外补齐：
- `pizza-genovese.png`
- `pizza-prosciutto-funghi.png`
- `pizza-quattro-formaggi.png`
- `pizza-capricciosa.png`
- `pizza-quattro-stagioni.png`

当前 `public/dish-knowledge-db.json` 本地图：124/1022。
`.dish-gen-progress.json` 已记录本地图：152/1022。

### 全量本地化后台任务

已用 `screen` 启动全量补图任务：
```bash
screen -ls
screen -r dishlens_images_20260525
tail -f _temp/dish-image-generation-2026-05-25.log
```

任务命令：
```bash
node scripts/generate-dish-content.mjs --images-only
```

完成后脚本会自动把进度回写到 `public/dish-knowledge-db.json`。
