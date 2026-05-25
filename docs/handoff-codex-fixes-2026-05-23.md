# DishLens Codex 修复交接文档

> 日期：2026-05-23  
> 接手方：Codex  
> 项目路径：`/Users/julian/AI点菜/dishlens`  
> 本轮目标：修复 Warp/dev server 崩溃、升级后 App 打不开、菜品图片缺失、菜单拍照无法识别菜品，并完成本地验证。

---

## 一、当前结论

本轮核心问题已经处理完：

1. Warp 多次崩溃的主要原因不是 Warp 本身，而是 Next 16/Turbopack 的项目 root 推断过大，加上废弃大 TS 数据文件和 `.next/dev` 大缓存导致 dev server 负担过重。
2. App 升级后无法打开，主要由运行时状态时序和空图片 URL 触发。已修复。
3. 菜品图片未全部生成，已采用免费 Pollinations 图片 URL 作为兜底方案；已有 Wan 本地图片继续优先使用。
4. 用户上传的法文菜单样式此前容易被当成说明文字，已优化 Qwen 视觉识别提示词，明确识别带价格/点线/描述的可点单菜品行。

---

## 二、已完成修复

### 1. Warp/dev server 崩溃

**根因**

- Next 16 检测到多个 `package-lock.json`，把 workspace root 推断到了 `/Users/julian/AI点菜`，而不是 `/Users/julian/AI点菜/dishlens`。
- `src/lib/dish-knowledge-db.ts` 是 1.5MB、5 万多行的废弃 TS 数据文件，已迁移到 JSON，但还留在 `src/lib` 下，被 Turbopack 扫描。
- `.next/dev` 缓存膨胀到约 385MB。

**修复**

- `next.config.ts` 增加：
  - `turbopack.root = projectRoot`
  - `images.remotePatterns` 增加 `image.pollinations.ai`
- 删除废弃文件：`src/lib/dish-knowledge-db.ts`
- 清理 `.next/dev` 缓存；清理后 `.next` 约 13MB。

**验证**

- `npm run dev` 启动时间：约 177ms Ready。
- Next root 推断警告已消失。

### 2. App 升级后无法打开

**发现的问题**

- `src/app/page.tsx` 在 `useEffect` 内同步 `setState` 触发 React/Next 新 lint 规则。
- 历史记录/最近翻译可能传入空图片 URL，导致 Next Image 运行时出错。
- LoadingPage 收到最终结果后，`onResult` 和 `onComplete` 连续触发，`saveToHistory()` 可能读到旧的 `{ task_id, status }` 初始对象，从而访问不存在的 `pages[0]`。

**修复**

- localStorage 初始化改为 `useState(() => getStoredHistory())` / `useState(() => getStoredFavorites())`。
- 历史记录缩略图使用 `getDishImageUrl(firstDish)` 兜底。
- 首页最近记录、历史页图片增加 fallback。
- `page.tsx` 增加 `latestResultRef`，保证保存历史时使用最新完整结果。
- `saveToHistory()` 增加 `result.pages?.length` 防御判断。
- 历史记录增加 `result_summary`，点击历史可恢复翻译结果页。

### 3. 图片生成未完成

**当前策略**

- 继续保留已有 Wan 本地图片。
- 对缺图菜品使用 Pollinations 免费图片 URL 兜底。
- 线上翻译新菜品时，默认 `IMAGE_PROVIDER=pollinations`，无需额外 API key。
- 如果后续要切回 Wan，可设置 `IMAGE_PROVIDER=wan`，继续使用 `QWEN_API_KEY`。

**相关文件**

- `src/lib/ai/image-gen.ts`
- `scripts/generate-dish-content.mjs`
- `public/dish-knowledge-db.json`

**当前数据状态**

- 知识库总数：1022 道。
- 本地 Wan 图片：100 道。
- Pollinations 免费生成 URL：922 道。
- 所有 1022 道都有 `card/hero` 图片字段。

**验证**

- Pollinations 测试 URL 返回 `200 image/jpeg`。
- 本地 `/dishes/apple-pie.png` 存在并可用。

### 4. 拍照菜单无法识别菜品

**根因**

用户上传的菜单包含：

- 法文品牌/说明页。
- 法文菜名 + 英文解释 + 价格。
- 倾斜拍摄、暖色灯光、装饰插画。

旧提示词只说“Extract ALL dishes”，模型容易把第一页故事页和菜单页混在一起，或把说明文字当作非菜单内容。

**修复**

`src/lib/ai/qwen.ts` 中增强 Qwen 视觉 prompt：

- 明确“priced menu lines / dotted leaders / ingredient descriptions” 是可点单菜品。
- 明确披萨、burrata、salad、carpaccio、veal 等都应识别为菜品。
- 明确忽略品牌、故事、sourcing notes、社交账号、税费说明。
- 如果页面只有品牌故事且没有可点单项目，返回空数组并标注 `说明页`。
- 对有价格的菜单页，要求不能返回空。

**验证**

用本地模拟的法文披萨菜单测试接口，成功识别 5 道：

- `LA MARINARA 11,50€`
- `LA MARGHERITA 13,50€`
- `LA JARDIN 16,00€`
- `LA CETARA 17,50€`
- `LA DIAVOLA 16,00€`

并且 5 道均拿到 Pollinations 图片 URL。

---

## 三、验证记录

已运行：

```bash
npm run lint
npm run build
npm run dev
```

结果：

- lint 通过。
- build 通过。
- dev server Ready 约 177ms。
- 浏览器打开 `http://localhost:3000/` 成功。
- 首页显示动态每日推荐，例如 `Lobster Roll / 龙虾卷`。
- 首页图片加载正常。
- 历史页、收藏页可打开。
- 法文菜单 API 测试可识别菜品并补图片 URL。

浏览器截图：

- `/tmp/dishlens-home-restarted.png`

---

## 四、重要改动文件

### 配置/性能

- `next.config.ts`
  - 固定 Turbopack root。
  - 允许 `image.pollinations.ai`。

- `src/lib/dish-knowledge-db.ts`
  - 已删除。不要恢复。

### 页面状态与本地数据

- `src/app/page.tsx`
  - localStorage 初始化修复。
  - 历史记录缩略图兜底。
  - 历史结果恢复。
  - `latestResultRef` 修复加载完成时序问题。

- `src/types/index.ts`
  - `HistoryEntry` 增加 `result_summary?: TranslationResult`。

- `src/components/home/HomePage.tsx`
- `src/components/history/HistoryPage.tsx`
- `src/components/favorites/FavoritesPage.tsx`
  - 空图片/无收藏状态修复，不改变视觉设计。

### AI/图片

- `src/lib/ai/qwen.ts`
  - 优化菜单识别 prompt。

- `src/lib/ai/image-gen.ts`
  - 默认 Pollinations 免费生图 URL。
  - Wan 作为可切换后备。

- `scripts/generate-dish-content.mjs`
  - 不再输出 TS 数据库。
  - 缺图菜品补 Pollinations URL。

- `public/dish-knowledge-db.json`
  - 重新生成，1022 道均有图片字段。

### 后端翻译任务

- `src/app/api/v1/translate/menu/route.ts`
  - 没有数据库 id 的新菜品生成临时 id。
  - 临时 id 菜品也会回填图片 URL。
  - 可持久化的数据库菜品继续上传/更新 Supabase。

---

## 五、剩余注意事项

1. 当前 Pollinations 是免费兜底 URL，不是本地落图文件；首次加载会由远端生成/返回图片。
2. 如果要全部本地化图片，可继续跑 Wan 批量生成，但会产生费用和耗时。
3. `public/dishes/` 目前约 155MB，包含已有本地图片与历史素材。
4. `docs/`、`scripts/`、`public/dishes/`、`.dish-gen-progress.json` 等多为本轮前后生成内容，提交前请确认仓库期望是否包含这些大文件。
5. 本轮没有部署到阿里云 ECS；只完成本地修复和验证。

---

## 六、下一步建议

1. 用用户真实三张菜单图在前端完整走一遍上传流程，确认视觉结果和本地模拟接口一致。
2. 给菜单识别结果增加“说明页”提示，避免用户误以为第一页识别失败。
3. 如果 Pollinations 稳定性满足要求，保留免费兜底；否则再启用 Wan 批量补本地图片。
4. 提交前单独评估 `public/dishes/` 是否需要 Git LFS 或外部存储。
