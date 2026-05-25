# DishLens 交接文档 — 2026-05-25 图片加载动画与生图缓存二次修复

## 本轮目标

本轮针对线上反馈继续修复菜品图片体验：

1. 不同菜品需要更细分的 loading 动画，列表态不能像白色破图块。
2. 详情页图片 loading 需要稳定居中。
3. 图片失效时不能直接露出破图。
4. AI 生图质量需要更细，尤其饮品、汤、甜点等类别。
5. 已生成图片必须保存，后续同名菜直接复用。
6. 详情和列表生图慢，需要分析并优化。

## 根因分析

### 1. 破图原因

前端 `isDishImagePending()` 之前只把 Unsplash / Pollinations 当作占位或不稳定图片，没有把 DashScope 临时结果域名 `dashscope-result...aliyuncs.com` 当作临时地址。  
这些 URL 带签名和过期时间，过期后仍被 `<Image>` 渲染，就会出现破图和 alt 文本。

本轮修复：DashScope 临时 Aliyun URL 统一视为 pending，不再直接当稳定图片展示；同时 `DishImageWithLoading` 增加 `onError` 回退，真实图片加载失败后立刻切回生成中动画。

### 2. LA JARDIN 没命中本地图

`LA JARDIN` / 花园披萨没有本地 alias，导致它走 AI 生图队列。用户看到的既慢，又容易出现临时图过期。

本轮修复：新增 `LA JARDIN / seasonal vegetables / 蔬菜披萨` 到 `pizza-quattro-stagioni` 的本地映射。

### 3. 生图慢的主要原因

慢不只是模型耗时：

- 初始结果阶段会对每个缺图菜品尝试远程 Storage HEAD 检查，一张菜单十几道菜时会产生多次网络请求。
- 后台生图被固定为并发 1。
- 生成图缓存 key 保留价格，例如 `LA MARINARA 11,50€` 与 `LA MARINARA` 会生成不同缓存文件名，降低复用率。

本轮修复：

- 远程 Storage HEAD 默认关闭，只查 ECS 本地文件缓存；远程 URL 主要靠 DB 行复用。
- 后台生图并发改为可配置，默认 2，最高 3：`MENU_IMAGE_GENERATION_CONCURRENCY`。
- 生图缓存 key 去掉价格和币种，提升同名菜复用率。

## 已完成改动

### 前端动画

文件：

- `src/components/shared/DishImageWithLoading.tsx`
- `src/app/globals.css`

新增/优化：

- 预制 10 类 loading 动画：
  - `pizza`
  - `seafood`
  - `meat`
  - `salad`
  - `breakfast`
  - `dessert`
  - `soup`
  - `drink`
  - `pasta`
  - `main`
- 列表图 loading 使用细边框、轻透明背景，不再是一块白底。
- 详情 hero 图 loading 使用居中构图和更柔和的径向背景。
- 图片加载失败时通过 `onError` 回退到 loading 动画。

### 本地匹配与缓存

文件：

- `src/lib/dish-image-match.ts`
- `src/lib/dish-presentation.ts`
- `src/lib/dish-image-persistence.ts`
- `src/lib/storage/supabase-storage.ts`
- `src/app/api/v1/translate/menu/route.ts`

新增/优化：

- `LA JARDIN` 直接命中 `/dishes/pizza-quattro-stagioni.png`。
- DashScope 临时 Aliyun 图片视为 pending。
- 本地生成图缓存路径仍为 `public/generated-dishes/<stable-id>.png`。
- `stable-id` 去掉价格，避免同菜名不同价格重复生成。
- Storage 远程 HEAD 检查改为 opt-in：`ENABLE_REMOTE_IMAGE_CACHE_HEAD=true` 才启用。
- 后台 AI 生图默认并发 2，可通过 `MENU_IMAGE_GENERATION_CONCURRENCY` 调整，最高 3。

### 生图 prompt

文件：

- `src/lib/ai/image-gen.ts`

优化：

- 饮品 prompt 明确杯型、泡沫、冰、蒸汽、冷凝水、液体颜色，不再默认盘子。
- 汤类 prompt 明确碗、汤面、可见食材、油花、蒸汽和汤体深度。
- 甜点 prompt 明确酥皮层次、奶油、果酱、糖霜、巧克力或冰淇淋质地。
- 主菜 prompt 明确烹饪纹理、酱汁位置、食材分离和摆盘细节。

## 验证

已执行：

```bash
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build
```

结果：

- 逻辑回归测试：12/12 通过
- ESLint：通过
- Next 生产构建：通过

## 部署说明

部署时需要：

```bash
git pull --ff-only
npm run build
pm2 restart dishlens
```

部署后检查：

```bash
curl -I https://dishlens.wukongmkt.com/
pm2 list
```

## 已知风险与后续建议

1. 阿里云 `.env.production` 仍缺 `SUPABASE_SERVICE_ROLE_KEY`，DB 行写入可能被 RLS 拦住；本轮 ECS 本地缓存能兜底复用，但跨机器/重装后仍依赖 DB 或对象存储。
2. `public/generated-dishes` 当前是运行时生成目录，不在 Git 中；如后续多实例部署，需要挂载持久盘或迁移到对象存储。
3. AI 生图仍受 DashScope 队列速度影响；本轮减少了前置阻塞和重复生成，但单张新图的模型耗时无法完全消除。
4. 如果追求更快的首次可见图片，可继续扩充 `public/dishes` 本地图库和 `dish-knowledge-db.json` 的本地路径覆盖率。
