# DishLens Codex 交接文档 — 菜单识别、本地图、首页还原

日期：2026-05-23  
工作目录：`/Users/julian/AI点菜/dishlens`

## 本轮目标

1. 分析并修复两张 La Pecoranegra 菜单图片翻译不成功/体验慢的问题。
2. 菜品图片改为本地图库优先，避免常见菜每次翻译都调用模型现生成。
3. 首页智能推荐、历史、收藏继续按定稿 HTML 和需求文档还原。

## 已完成

- 菜单识别：
  - 复现两图上传：点单页能识别 8 道菜，说明页应为 0 道菜。
  - 根因：代码把“说明页 0 道菜”也当成失败重试，导致整组任务被拖慢。
  - 新增 `src/lib/menu-analysis-utils.ts`，说明页/品牌页/故事页空结果不再重试。
  - 强化 Qwen 菜单识别 prompt，要求输出 `page_type`，说明页标记为 `info`。

- 本地图片优先：
  - 新增 `src/lib/dish-image-match.ts`，前后端共用本地知识库图片匹配。
  - 翻译接口在进入后台生图前先尝试命中本地知识库图片。
  - `getDishImageUrl()` 改为优先使用本地知识库匹配，不再依赖空的 `dish-image-db.ts`。
  - `src/lib/ai/image-gen.ts` 默认改为 `wan`，免费 Pollinations 失败时不再返回坏 URL。
  - 为本次菜单关键命中项生成/落地本地图：
    - `/dishes/burrata-con-pomodorini.png`
    - `/dishes/vitello-tonnato.png`
    - `/dishes/carpaccio-de-boeuf.png`
    - `/dishes/pizza-marinara.png`
    - `/dishes/pizza-margherita.png`
    - `/dishes/pizza-diavola.png`
    - `/dishes/salade-nicoise.png`
    - `/dishes/salade-chez-louis.png`
  - 当前知识库统计：1022 entries，其中 108 个已指向本地图片，914 个仍是远程旧 URL。

- 批量图片脚本：
  - 新增 `scripts/materialize-dish-images.mjs`，用于把远程/开放图库图片下载到 `public/dishes` 并回写 JSON。
  - `scripts/generate-dish-content.mjs` 增加 `--ids` 参数，可用现有通义万相模型定向补图。
  - 发现 Pollinations 当前返回 `402 Payment Required`，不能作为稳定免费批量生成方案。
  - Wikimedia 可作为免费开放图库补充，但批量时会遇到 429/超时，脚本已加重试和超时保护。

- 首页/历史/收藏：
  - 首页补回定稿中的天气/时段标签、今日推荐理由、hero 点击进详情。
  - 每日推荐来自 1022 知识库，并优先选择已有本地图的菜。
  - 历史保存修复：遇到说明页/空菜页时，改为查找第一道真实菜，不再读 `dishes[0]` 报错。
  - 历史页、收藏页补了本地存储 badge 和更接近定稿的头部/列表样式。

## 验证结果

- `node --test tests/logic-regressions.test.mjs` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。
- API 复测两张菜单：
  - 识别结果：点单页 8 道菜，说明页 0 道菜。
  - 本次关键菜命中本地图片：Burrata、Vitello Tonnato、Carpaccio、两道沙拉、三道披萨别名规则已覆盖。
- 浏览器验收：
  - 首页显示“按当前时段推荐”和“今日推荐理由”。
  - 点击首页推荐菜可进入菜品详情页。
  - 浏览器截图接口在当前环境超时，但 DOM 与交互验证通过。

## 剩余风险

- “1000 张本地图覆盖 90% 场景”尚未完全跑完，目前只有 108/1022 张本地图。
- 免费 Pollinations 已不可用，Wikimedia 批量稳定性一般。若要真正完成 90% 本地高质量图，建议：
  - 使用现有通义万相按批次续跑：
    `node scripts/generate-dish-content.mjs --images-only --ids <comma-separated ids>`
  - 或按 cuisine 分批跑，避免长任务中断：
    `node scripts/generate-dish-content.mjs --images-only --cuisine italian`
  - 每批跑完确认 `public/dish-knowledge-db.json` 中 local 数量上升。

## 关键文件

- `src/lib/menu-analysis-utils.ts`
- `src/lib/dish-image-match.ts`
- `src/lib/ai/qwen.ts`
- `src/lib/ai/image-gen.ts`
- `src/app/api/v1/translate/menu/route.ts`
- `src/components/home/HomePage.tsx`
- `src/hooks/useDailyRecommendation.ts`
- `scripts/materialize-dish-images.mjs`
- `scripts/generate-dish-content.mjs`
- `tests/logic-regressions.test.mjs`
