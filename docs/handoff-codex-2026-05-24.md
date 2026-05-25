# DishLens Codex 交接文档 — 2026-05-24

工作目录：`/Users/julian/AI点菜/dishlens`
状态：`npm run build` ✓ | `npm run lint` ✓ | Hydration warning ✓ 已修复

---

## 一、项目概况

DishLens 是一个 H5/PWA 移动端应用，帮助全球旅行者通过 AI 翻译餐厅菜单。
用户拍照上传菜单 → AI OCR 识别 → 翻译成中文 → 展示菜品详情（图片、风味、点单建议）。

- **技术栈**：Next.js 16 (App Router) + TypeScript + TailwindCSS 4 + Supabase + Cloudflare R2
- **AI 服务**：Qwen VL (qwen-vl-max 菜单 OCR) + Qwen Text (qwen-plus 翻译润色) + 通义万相 (wanx2.1-t2i-turbo 菜品图片生成)
- **设计系统**：v7 Warm Editorial — 暖奶油底 + 鼠尾草绿主色 + 橙色点缀
- **线上地址**：https://dishlens.vercel.app

---

## 二、当前已完成功能

### 核心翻译流程
- [x] 拍照/相册上传菜单
- [x] Qwen VL 多页 OCR 识别（支持法语/意大利语/日语/韩语等 15+ 语言）
- [x] 菜品翻译成中文（name_translated / description / recommendation / good_for / caution）
- [x] 翻译结果卡片列表展示（图片、菜名、配料标签、过敏原、风味标签）
- [x] 菜品详情页（大图、完整描述、点单建议、注意事项、营养信息）
- [x] 说明页/品牌页智能识别（page_type: "info"，展示有意义的描述而非"未识别到"）

### 菜品图片系统
- [x] 本地知识库图片匹配（`dish-image-match.ts`，别名+模糊匹配两阶段）
- [x**] 同批翻译图片去重（同一知识库图片只允许使用一次）
- [x] 通义万相异步生图（wanx2.1-t2i-turbo，¥0.04/张）
- [x] Supabase Storage 图片持久化 + CDN
- [x] 前端图片 fallback 链：已有图 → 本地知识库 → Unsplash 关键词 → Hash 多样化

### 首页智能推荐
- [x] 每日推荐引擎（基于时间/天气/地理位置，纯客户端）
- [x] 天气 API 集成（Open-Meteo + Nominatim 反向地理编码）
- [x] 推荐理由文案（面向食客，非研发视角）
- [x] 食客视角推荐理由（buildReason 函数，含菜名+风味+场景）

### 历史与收藏
- [x] 翻译结果自动存入 localStorage（`dishlens_history`）
- [x] 历史页完整展示（缩略图、菜名、时间）
- [x] 收藏功能（心形按钮联动 localStorage `dishlens_favorites`）
- [x] 首页最近翻译点击跳转到翻译结果
- [x] 过滤掉未成功翻译的记录（0 道菜不存入历史）

### 知识库
- [x] 1022 道菜知识库（`public/dish-knowledge-db.json`，1.2MB）
- [x] 覆盖 29 个菜系，每条含 names/description/recommendation/good_for/caution/ingredients/allergens/taste_profile
- [x] 批量内容生成脚本（`scripts/generate-dish-content.mjs`）
- [x] 批量图片生成脚本（同脚本 `--images-only` 参数）
- [x] Wikimedia 图片下载脚本（`scripts/materialize-dish-images.mjs`）

---

## 三、本轮（2026-05-23/24）修复清单

| # | 问题 | 修复方案 | 文件 |
|---|------|---------|------|
| 1 | 4 道 Burrata 菜用同一张图 | 缩窄 burrata alias 为精确匹配 `"burrata con pomodorini"` | `src/lib/dish-image-match.ts` |
| 2 | "今日推荐"标签和菜系标签重叠 | Hero 卡片内容区加 `paddingTop: 18` | `src/components/home/HomePage.tsx` |
| 3 | 风味特征/点单建议太简短 | 所有 fallback 文案从 1 句扩展到 2-3 句 | `src/lib/dish-presentation.ts` |
| 4 | 最近翻译无法点击 | 新增 `onRecentClick` prop + 跳转到 results 页 | `HomePage.tsx` + `page.tsx` |
| 5 | 推荐理由是研发视角 | 改为食客视角"正在为你挑选今日好菜…" + buildReason | `useDailyRecommendation.ts` |
| 6 | Hydration mismatch 警告 | `mounted` state 延迟渲染，SSR 只输出空壳 | `src/app/page.tsx` |
| 7 | 说明页显示"没有识别到菜品" | 区分 info page 和真正失败，展示有意义描述 | `ResultsPage.tsx` + `qwen.ts` |
| 8 | 同批翻译多菜重复图片 | API route 新增 `usedImageIds` 去重集合 | `src/app/api/v1/translate/menu/route.ts` |
| 9 | 最近翻译显示任务ID和语言代码 | 改为显示第一道菜的真实菜名 | `src/app/page.tsx` |
| 10 | Qwen prompt 输出太短 | recommendation 40-70字，good_for 25-40字，caution 25-40字 | `src/lib/ai/qwen.ts` |
| 11 | 未成功翻译仍存入历史 | 新增 `totalDishes === 0` 检查阻止保存 | `src/app/page.tsx` |

---

## 四、待办事项（按优先级排序）

### P0 — 核心体验

#### 4.1 菜品图片本地化（914/1022 未完成）

这是当前最大的缺口。没有本地图的菜会走 AI 生图（慢、贵）或 Unsplash fallback（不够准确）。

**当前进度：**

| 菜系 | 总数 | 本地图 | 缺图 |
|------|------|--------|------|
| french | 122 | 3 | 119 |
| italian | 95 | 5 | 90 |
| Japanese | 81 | 0 | 81 |
| chinese | 65 | 0 | 65 |
| Indian | 61 | 0 | 61 |
| Korean | 56 | 0 | 56 |
| thai | 55 | 0 | 55 |
| turkish | 37 | 0 | 37 |
| Mexican | 32 | 0 | 32 |
| spanish | 32 | 0 | 32 |
| brazilian | 27 | 27 | 0 ✅ |
| singaporean | 27 | 0 | 27 |
| american | 26 | 26 | 0 ✅ |
| middle-eastern | 26 | 0 | 26 |
| Vietnamese | 26 | 0 | 26 |
| moroccan | 24 | 0 | 24 |
| caribbean | 22 | 16 | 6 |
| german | 22 | 0 | 22 |
| british | 20 | 20 | 0 ✅ |
| 其余 10 个菜系 | 94 | 11 | 83 |

**执行方法：**

```bash
# 按菜系分批跑，每批完成后确认 JSON 中 local 数量上升
# 预估：每张 ¥0.04，914 张 ≈ ¥37，并发=1，需 4-5 小时
# 建议按缺图量从大到小跑：

node scripts/generate-dish-content.mjs --images-only --cuisine french      # 119张
node scripts/generate-dish-content.mjs --images-only --cuisine italian     # 90张
node scripts/generate-dish-content.mjs --images-only --cuisine Japanese    # 81张
node scripts/generate-dish-content.mjs --images-only --cuisine chinese     # 65张
node scripts/generate-dish-content.mjs --images-only --cuisine Indian      # 61张
node scripts/generate-dish-content.mjs --images-only --cuisine Korean      # 56张
node scripts/generate-dish-content.mjs --images-only --cuisine thai        # 55张

# 之后继续跑其余菜系...
# 中断后重跑是安全的，脚本会跳过已有本地图的条目
```

**注意事项：**
- 通义万相 API 并发=1，跑太快会 429
- 每张图生成后脚本自动回写 `public/dish-knowledge-db.json`（card/hero 字段改为 `/dishes/xxx.png`）
- 如果中途断掉，重跑同一菜系命令即可，已有图不会重复生成
- 需要确认 `.env.local` 中 `QWEN_API_KEY` 有效且有足够余额

**验证：** 跑完后执行：
```bash
cat public/dish-knowledge-db.json | python3 -c "
import json, sys
db = json.load(sys.stdin)
local = sum(1 for d in db if d.get('card','').startswith('/'))
print(f'本地图: {local}/1022 ({local/len(db)*100:.1f}%)')
"
```

#### 4.2 知识库内容质量校验（recommendation 字段偏短）

**现状：** 1022 条知识库的 recommendation 平均长度 28 字，prompt 已改为要求 40-70 字，但知识库是之前用旧 prompt 生成的。

**解决方案 A（推荐）：** 用新 prompt 重新生成 recommendation/good_for/caution 字段：
```bash
# 只重新生成文字内容，不动图片
node scripts/generate-dish-content.mjs --content-only
```
⚠️ 这会覆盖所有 1022 条的文字内容，建议先备份：
```bash
cp public/dish-knowledge-db.json public/dish-knowledge-db.json.bak
```

**解决方案 B（低成本）：** 只重新生成缺图菜的文字内容（生图时会自动用新 prompt）：
```bash
# 生图的同时会重新生成 content（新 prompt）
node scripts/generate-dish-content.mjs --cuisine french  # 不加 --images-only，content+image 一起
```

### P1 — 体验优化

#### 4.3 菜品详情页内容展示

`src/components/dish/DishDetailPage.tsx` 需要确认：
- recommendation/good_for/caution 的展示位置和样式是否充分
- 当 AI 生成的 recommendation 仍然偏短时（旧数据），fallback 到 `dish-presentation.ts` 的丰富文案
- 当前 fallback 文案已更新为 2-3 句的丰富内容

#### 4.4 首页推荐理由 buildReason 优化

`src/hooks/useDailyRecommendation.ts` 的 `buildReason` 函数：
- 当前已用菜名+风味+场景生成食客视角理由
- 天气/下午茶场景有特殊理由
- 默认 fallback 用 `dish.recommendation.zh`（来自知识库）
- 当知识库的 recommendation 更新到 40-70 字后，理由会更丰富

#### 4.5 历史记录展示优化

当前 `recentHistory` 传给首页的数据：
- `zh`：第一道菜的中文译名
- `en`：第一道菜的原始名
- `img`：第一道菜的缩略图

可能需要增加：
- 餐厅名或菜系标签
- 翻译时间（如"2小时前"）
- 菜品总数（如"识别了 8 道菜"）

### P2 — 长期维护

#### 4.6 知识库准确性校对

1022 条内容是 AI 批量生成的，可能存在：
- 某些菜的描述不够准确（如地域变体描述错误）
- allergens 标签不完整
- taste_profile 分类不一致

建议逐步人工校对高频菜品（french/italian/japanese 前 100 道）。

#### 4.7 线上部署同步

本地所有修复完成后需要重新部署：
```bash
git add -A && git commit -m "fix: image dedup, info page display, hydration, content enrichment"
git push origin main
# Vercel 自动部署
```

确认线上环境变量是否齐全：
- `QWEN_API_KEY` — 通义千问 API Key
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — Supabase 连接
- 其他见 `.env.local`

---

## 五、关键文件索引

### 核心业务逻辑
| 文件 | 用途 |
|------|------|
| `src/app/page.tsx` | 全局状态管理 + 路由 + localStorage |
| `src/app/api/v1/translate/menu/route.ts` | 菜单翻译 API（OCR → 翻译 → 图片匹配 → 存储） |
| `src/lib/ai/qwen.ts` | Qwen VL/Text API 封装（菜单识别 prompt 已更新） |
| `src/lib/ai/image-gen.ts` | 通义万相异步生图 |
| `src/lib/dish-image-match.ts` | 本地知识库图片匹配（别名+模糊） |
| `src/lib/dish-presentation.ts` | 菜品展示文案（getDishInsight/getDishImageUrl） |
| `src/lib/recommendation.ts` | 每日推荐引擎（纯客户端） |

### 组件
| 文件 | 用途 |
|------|------|
| `src/components/home/HomePage.tsx` | 首页（推荐+相机+最近翻译） |
| `src/components/results/ResultsPage.tsx` | 翻译结果列表（含说明页/空状态区分） |
| `src/components/dish/DishDetailPage.tsx` | 菜品详情页 |
| `src/components/history/HistoryPage.tsx` | 历史记录页 |
| `src/components/favorites/FavoritesPage.tsx` | 收藏页 |

### 基础设施
| 文件 | 用途 |
|------|------|
| `src/lib/local-storage.ts` | localStorage 封装（历史/收藏/缓存） |
| `src/lib/weather.ts` | Open-Meteo 天气 API |
| `src/lib/menu-analysis-utils.ts` | 菜单分析工具（说明页检测、重试逻辑） |
| `src/hooks/useDailyRecommendation.ts` | 推荐 Hook（含食客视角理由生成） |
| `src/types/index.ts` | TypeScript 类型定义 |

### 数据与脚本
| 文件 | 用途 |
|------|------|
| `public/dish-knowledge-db.json` | 1022 道菜知识库（1.2MB） |
| `public/dishes/` | 本地菜品图片目录（237 个文件，108 道菜） |
| `scripts/generate-dish-content.mjs` | 批量内容+图片生成 |
| `scripts/materialize-dish-images.mjs` | Wikimedia 图片下载脚本 |
| `.dish-gen-progress.json` | 生图进度记录 |

### 文档
| 文件 | 用途 |
|------|------|
| `docs/handoff-codex-menu-images-home-2026-05-23.md` | 上次 Codex 交接 |
| `docs/handoff-codex-2026-05-23.md` | 更早的交接 |
| `AGENTS.md` | 项目开发规范 |

---

## 六、已知风险与限制

1. **通义万相费用**：914 张图 × ¥0.04 ≈ ¥37。需确认 API 余额充足。
2. **Pollinations 已不可用**：返回 `402 Payment Required`，不能作为免费图片生成方案。
3. **Wikimedia 批量不稳定**：频繁 429/超时，只适合小批量补充。
4. **知识库 JSON 体积**：1.2MB 通过 `fetch()` 加载，首次加载约 1-2 秒。后续版本考虑分片或 CDN。
5. **无用户登录体系**：历史/收藏全部基于 localStorage，换设备/清缓存会丢失。未来版本需加用户认证。
6. **知识库内容是旧 prompt 生成的**：recommendation 平均 28 字，新 prompt 要求 40-70 字。需要重新生成。

---

## 七、Codex 接手建议

1. **先跑图片**（P0）：按菜系分批跑 `--images-only`，从缺图最多的 french 开始
2. **再跑内容**（P0）：图片跑完后用 `--content-only` 重新生成 1022 条文字内容
3. **验证**：每批跑完后 build + lint + 浏览器截图验证
4. **部署**：全部完成后 git push 到 main，Vercel 自动部署
5. **注意**：生图脚本需要 QWEN_API_KEY，确保 `.env.local` 配置正确
