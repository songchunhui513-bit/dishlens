# DishLens Codex 交接 — 2026-08-05 图片速度与稳定性

## 本轮目标

继续推进“识别更快、系统更稳、图片生成更快、体验更像美食 App”的长期目标。本轮聚焦图片本地化命中与错图修正，因为这直接影响结果页速度、AI 生图次数和用户对菜品推荐的信任。

## 已完成

1. 验证当前图片系统覆盖：
   - 知识库总数：1022
   - 本地知识图：621
   - 已提升稳定生成缓存：18
   - 仍依赖远程/AI：401
   - 稳定本地覆盖率：62.5%

2. 修复已有本地图但仍走 AI 的别名缺口：
   - `Dorayaki` 现在命中 `dorayaki`
   - `Omurice` 现在命中 `omurice`
   - 同步修复生产匹配器与诊断脚本，避免后续排障误判。

3. 修复 `Calzone` 错图：
   - 原 `public/dishes/calzone.webp` 实际是圆形披萨切片，不是半月形封口 calzone。
   - 已替换为合格的半月形封口 calzone 图片，并保留 768x768 webp 规格。

4. 增加回归保护：
   - `tests/logic-regressions.test.mjs` 中加入 `Dorayaki` 和 `Omurice` 本地命中断言。

5. 继续本地化 4 道高优先级菜：
   - `beyti-kebab`
   - `bo-la-lot`
   - `bossam`
   - `onigiri`

6. 补齐常见罗马字别名：
   - `Bossam` 现在命中 `bossam`
   - `Onigiri` 现在命中 `onigiri`

7. 增强 AI 生图 prompt 的菜品身份保护：
   - `Beyti Kebab` 明确为 lavash 包裹烤肉切段，禁止生成披萨、pide、卷饼或普通烤串。
   - `Bò Lá Lốt` 明确为越南蒌叶包牛肉小卷，禁止生成粽子、蒸叶包、dolma 或卷饼。
   - `Bossam` 明确为韩式水煮五花肉切片配包菜/紫苏/泡菜/ssamjang，禁止生成卷饼、三明治或烤五花肉。
   - `Onigiri` 明确为日式三角饭团配海苔，禁止生成炸饭团、寿司卷或西式肉丸。

8. 针对上述 4 道菜加入回归测试，避免后续 prompt 调整再次把跨文化菜名拉向相邻品类。

9. 优化重复上传/缓存命中的速度：
   - `/api/v1/translate/menu/cache` 过去遇到“文字缓存命中但图片缺失/旧本地图被清洗”会直接返回 `hit:false`，前端只能重新上传图片并进入完整 OCR 流程。
   - 现在改为：只要文字缓存命中，就立即返回可展示的菜单结果；缺图菜品标记为 `pending`，`metadata.image_generation_status` 标记为 `processing`，并在后台复用现有 AI 生图、上传、任务更新和文件缓存写回逻辑。
   - 这样同一菜单二次上传时，首屏不再被图片补齐阻塞，用户先看到翻译结果；图片通过结果页轮询渐进补齐。

10. 校准真实速度 benchmark：
   - `scripts/benchmark-menu-flow.mjs` 现在和前端一致，会同时计算 server-normalized hash 与 raw client hash，并通过 `hash_sets` 一次性探测缓存。
   - 正式上传时也会附带 `client_hash_sets`，避免 benchmark 与真实前端行为不一致。
   - 本地 dev server 当前跑在 `http://localhost:3011`（已有 Next dev server 占用，3000 未启动）。

11. 本轮真实菜单速度基线：
   - 样本：`/Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg`
   - 首次无 cache-probe 上传：`upload_response_ms=81ms`，`first_result_ms=19811ms`，`firstPageMs=18499ms`，`firstPassMs=18500ms`。
   - 识别结果：1 页、17 道菜，首屏文字完成时 5 张图 ready，12 张进入后台图片生成。
   - 同图二次 cache-probe：`cache_probe_ms=30ms`，`first_result_ms=112ms`，命中 `server-normalized+client-raw`。
   - 结论：重复上传优化已验证有效；首次识别瓶颈主要在首轮 OCR/视觉模型调用，不在上传或图片补齐。

12. 增强首轮识别耗时观测：
   - `metadata.timings` 现在记录 `firstPassModelMs`、`firstPassBuildMs`，把视觉模型耗时和菜品记录构建耗时拆开。
   - `metadata.timings` 现在记录 `firstPassInputOptimizeMs`、`firstPassOriginalBytes`、`firstPassModelBytes`，可以判断首轮压缩输入是否真正影响模型延迟。
   - 首轮 fast pass 使用较小的模型输入图；缓存 key 与后台 enrichment 仍使用完整 server-normalized 图片，避免因压缩策略变化破坏重复上传命中。

13. 真实菜单复测结论：
   - 样本：`/Users/julian/Documents/菜单/20260522-184232.jpg`
   - 目标语言 `ja`：`first_result_ms=19718ms`，`firstPassModelMs=19097ms`，`firstPassBuildMs=99ms`。
   - 目标语言 `en`：`first_result_ms=24271ms`，`firstPassModelMs=22782ms`，`firstPassBuildMs=85ms`。
   - `en` 这轮输入优化数据：`firstPassInputOptimizeMs=70ms`，`firstPassOriginalBytes=232770`，`firstPassModelBytes=137623`。
   - 结论：首轮压缩输入约减少 41% 字节，但模型仍耗 19-23 秒；下一步不能只靠继续小幅压图，应优先验证更快视觉 provider、更短 prompt、菜单分区裁剪/透视矫正，或更激进的“粗结果先展示、完整结构后台补齐”策略。

14. Fast first pass prompt 进一步瘦身：
   - `QWEN` fast prompt 现在明确只输出 first-paint fields：`name_original`、`name_translated`、`category`、`confidence`，`description` 仅在菜单上可见时才输出。
   - fast prompt 明确禁止输出 `ingredients`、`allergens`、`taste_profile`、`recommendation`、`good_for`、`caution`、`menu_metadata`。
   - `MENU_FAST_FIRST_PASS_MAX_TOKENS` 默认值从 `4096` 降到 `3072`，上限从 `8192` 降到 `4096`。
   - fast pass 的 target language instruction 也改为短指令，只要求翻译 `name_translated` 和 `page_label`，避免把 full/enrichment 字段要求带进首轮模型调用。

15. Prompt 瘦身后的真实 benchmark：
   - 样本：`/Users/julian/Documents/菜单/20260522-184308.jpg`，目标语言 `ko`：`first_result_ms=16719ms`，`firstPassModelMs=15002ms`。
   - 同规格样本：`/Users/julian/Documents/菜单/20260522-184232.jpg`，目标语言 `ko`：`first_result_ms=25811ms`，`firstPassModelMs=24972ms`。
   - 同图缓存复测：`cache_probe_ms=28ms`，`first_result_ms=124ms`，15/15 图片 ready。
   - 结论：prompt 瘦身可能降低部分请求耗时，但模型端波动仍然很大，不足以稳定解决首次识别慢；重复上传/缓存路径已经足够快，应继续把优化重点放在首次识别的 provider/策略级方案上。

16. Fast first pass 模型候选与观测增强：
   - 新增 `QWEN_FAST_FIRST_PASS_MODELS`，可用逗号配置多个首轮视觉模型候选；未配置时保持旧行为：`QWEN_FAST_VL_MODEL || qwen-vl-plus`，再 fallback 到 `QWEN_VL_MODEL || qwen-vl-max`。
   - `analyzeWithPrompt` 会在返回结果上附带内部字段 `_model`，记录本次实际使用的模型。
   - `/api/v1/translate/menu` 会把首轮实际模型写入 `metadata.timings.firstPassModelName`，并在 `translate:page_first_pass_finished` 日志里输出 `modelName`。
   - 多页菜单额外写入 `metadata.timings.firstPassModelNames`，按 page index 保存每页实际使用模型，避免并发完成时 `firstPassModelName` 只保留最后一页。
   - `scripts/benchmark-menu-flow.mjs` 的 `summary` 现在会直接输出 `first_pass_model_name` 与 `first_pass_model_names`，不用再手动展开 `metadata.timings`。
   - 价值：后续可以在不改代码的情况下做真实 A/B，例如 `QWEN_FAST_FIRST_PASS_MODELS=model-a,model-b`，再用 benchmark 直接比较 `firstPassModelName` 与 `firstPassModelMs`。

17. Fast first pass 单模型超时保护：
   - 新增 `MENU_FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS`，默认 `30000ms`，范围被限制在 `5000ms` 到全局 `API_TIMEOUT`。
   - 每个 fast first pass 候选模型都会包一层 `Promise.race` 超时保护；单个模型卡住时，当前 attempt 会失败并进入下一个候选，不再一直拖到全局 120 秒。
   - 默认 30 秒基于两张真实菜单 A/B 调整：`qwen-vl-plus` 当前每页约 15 秒，`qwen-vl-max` 约 27-28 秒；30 秒仍给正常请求留缓冲，但能更早切走卡住的候选。
   - 注意：当前实现是应用层超时回退，不主动中断底层 HTTP 请求；但 `Promise.race` 已接管 rejected path，不会因被忽略请求导致未处理异常。后续如需更强控制，可再接入 OpenAI request option 的 abort signal。

18. 多页菜单逐页耗时观测：
   - `metadata.timings` 新增 `firstPassModelMsByPage` 与 `firstPassBuildMsByPage`。
   - 多页并行识别时，每页 fast first pass 完成后会按 page index 写入模型耗时和结果构建耗时。
   - `scripts/benchmark-menu-flow.mjs` 的 `summary` 顶层同步输出：
     - `first_pass_model_ms_by_page`
     - `first_pass_build_ms_by_page`
   - 价值：后续测试 20 页、200 道菜菜单时，不只看总耗时，可以直接定位“哪一页/哪个模型”拖慢首屏。

19. 修正 benchmark 重复上传缓存验证：
   - 发现：用 `scripts/benchmark-menu-flow.mjs` 先跑一次无 `--cache-probe`，再跑一次 `--cache-probe` 时，第二次仍可能 miss 并重新调用视觉模型。
   - 原因：旧 benchmark 首次上传时没有携带 `client_hashes/client_hash_sets`，不像真实前端；服务端只能写入自身归一化 cache key，后续 probe 用 raw/server-normalized 组合时容易误判缓存未命中。
   - 修复：新增 `buildBenchmarkClientHashSets()`，benchmark 现在无论是否启用 `--cache-probe`，都会预先构建 `server-normalized + client-raw` hash sets，并在上传时附带给 `/api/v1/translate/menu`。
   - 价值：benchmark 现在能真实验证“首次识别后，重复上传是否秒回”，避免把测速脚本问题误判成产品缓存问题。

20. 大菜单图片生成队列元数据：
   - `generateImagesInBackground()` 现在会在 `metadata` 中写入：
     - `image_generation_queue_total`：去重后的真实 AI 生图代表菜数量。
     - `image_generation_active_total`：当前可并发生成的活跃队列规模，取 `IMAGE_GENERATION_CONCURRENCY` 与真实队列长度的较小值。
     - `image_generation_queued_total`：仍在排队等待生成的代表菜数量。
   - 这些字段使用 `representativeDishesForGeneration` 计算，不会把重复菜名或同义菜重复算进真实生成队列。
   - 价值：对 100-200 道菜的大菜单，前端和诊断脚本可以区分“正在生成前几张”和“大量图片排队中”，后续可据此做更像 App 的渐进提示、后台补图状态、以及大菜单图片策略调优。

21. 结果页接入大菜单图片队列体验：
   - `TranslationResult.metadata` 类型已声明图片队列字段，避免前端访问隐式 any。
   - `buildResultSyncSignature()` 已纳入 `image_generation_queue_total`、`image_generation_active_total`、`image_generation_queued_total`，轮询拿到队列状态变化时会触发 UI 更新。
   - `ResultsPage` 顶部图片补齐提示现在会在大菜单场景显示类似“3 张正在生成 · 47 张排队，先看翻译和推荐”。
   - `DishImageWithLoading` 支持 `pendingActiveTotal`、`pendingQueuedTotal`，卡片占位图会显示“生成中”或“排队中”的小状态胶囊；长时间未完成仍回落到“图片生成较慢，先用示意图”。
   - 价值：对海外弱网和 100-200 道菜菜单，用户能理解图片是后台渐进补齐，不会把 pending 图误认为坏图或排版错误。

## 图片质量备注

`scripts/backfill-knowledge-images-with-wan.mjs` 本轮生成 4 张图约 50 秒完成，但其中 3 张初稿不合格：

- `beyti-kebab` 初稿被生成成肉末披萨。
- `bo-la-lot` 初稿更像蒸叶包，不像越南蒌叶牛肉卷。
- `bossam` 初稿被生成成卷饼。

已用更严格的菜品身份 prompt 重新生成并替换为合格版本。结论：本地图库扩展可以批量跑，但必须人工目检；尤其是跨文化菜名，模型很容易把它们拉向相邻品类。

## 修改文件

- `src/lib/dish-image-match.ts`
- `scripts/diagnose-dish-images.mjs`
- `tests/logic-regressions.test.mjs`
- `public/dishes/calzone.webp`
- `public/dishes/beyti-kebab.webp`
- `public/dishes/bo-la-lot.webp`
- `public/dishes/bossam.webp`
- `public/dishes/onigiri.webp`
- `src/app/api/v1/translate/menu/cache/route.ts`
- `src/app/api/v1/translate/menu/route.ts`
- `src/lib/ai/qwen.ts`
- `scripts/benchmark-menu-flow.mjs`
- `docs/handoff-codex-2026-08-05-image-speed-state.md`

## 验证结果

- `node --test tests/logic-regressions.test.mjs`：128/128 通过
- `npm run lint`：通过
- `npm run build`：通过
- `node scripts/diagnose-dish-images.mjs "Dorayaki" "Omurice" "Calzone" "Arepas" --json`：四者均命中 `local_knowledge`
- `node scripts/diagnose-dish-images.mjs "Beyti Kebab" "Bo La Lot" "Bossam" "Onigiri" --json`：四者均命中 `local_knowledge`

## 2026-08-06 图片本地化与匹配优先级补充

本轮继续推进生成图本地化闭环，新增 `scripts/promote-generated-dish-images.mjs --reviewed-ids=...`，用于把人工目检通过的 runtime 生成图明确提升到 `public/dishes/generated-cache/` 与 `public/generated-dish-local-index.json`。这条路径会跳过泛化名称、已 block 的错图和缺少人工确认的 hashed storage id，避免把错误图固化为全局图库。

已人工目检并提升 13 张稳定图：

- `generated-pan-fried-japanese-hokkaido-sea-scallops`
- `generated-pan-seared-salmon`
- `generated-panko-crumbed-calamari`
- `generated-pepperoni`
- `generated-portuguese-chicken-breast`
- `generated-prawn-soup`
- `generated-pugliese`
- `generated-rice-balls`
- `generated-roasted-baby-vegetables`
- `generated-roasted-lamb-rack`
- `generated-sicilian`
- `generated-smoked-chicken`
- `generated-smoked-mushroom`

图片诊断结果从：

- `promoted_generated_cache`: 77
- `stable_local_with_promoted_coverage_percent`: 87
- `generated_local_unstable_unpromoted`: 133

提升到：

- `promoted_generated_cache`: 90
- `stable_local_with_promoted_coverage_percent`: 88.3
- `generated_local_unstable_unpromoted`: 120

同时修复了两个匹配稳定性问题：

- `matchGeneratedLocalIndex()` 不再按索引顺序“先命中先返回”，而是按精确名称和 id 精确度选最佳匹配，避免 `Pan Seared Salmon` 被旧的 `generated-grilled-salmon` 抢走。
- `scripts/diagnose-dish-images.mjs` 同步使用最佳匹配，保证诊断结果和生产匹配逻辑一致。
- 为 `ANGELACHU/ANGELOCHU ANCHOVY`、`MISO CHICKPEA VL/V.L` 补 OCR 变体别名，避免回退到不稳定 runtime 图。

验证结果：

- `node scripts/diagnose-dish-images.mjs "MISO CHICKPEA V.L" "Angelochu Anchovy" "Pan Seared Salmon" --json`：三者均命中 `promoted_generated_cache`，其中 `Pan Seared Salmon` 命中精确 `generated-pan-seared-salmon.webp`。
- `node scripts/promote-generated-dish-images.mjs --reviewed-ids=generated-pan-seared-salmon,generated-panko-crumbed-calamari --verbose`：只返回 2 个 reviewed candidates，均为 `already_indexed`，可重复验证。
- `node --test tests/logic-regressions.test.mjs`：146/146 通过。
- `npm run lint`：通过。
- `npm run build`：通过。

## 2026-08-06 第二批人工目检生成图本地化

继续使用 `.cache/generated-review-candidates-2026-08-06-b.png` 进行人工目检。本批只提升可跨菜单复用、菜品身份清晰的图片；继续避开品牌/章节/泛化标签，例如 `Banksia`、`Set`、`S228`、`Special Combo`、`Water`、`Sauces`、泛化 `Salads/Pasta` 等，避免把菜单上下文图误固化成全局图库。

新增提升 13 张：

- `generated-funghetto`
- `generated-mungindi-rib-eye`
- `generated-pappardelle-boscaiola`
- `generated-pappardelle`
- `generated-seared-kangaroo`
- `generated-soup-of-the-day`
- `generated-spaghetti`
- `generated-spinach-salad`
- `generated-tassie-salmon`
- `generated-tatin-tart`
- `generated-teriyaki-rare-beef-salad`
- `generated-vanilla-ice-cream`
- `generated-vegetable-curry`

覆盖率变化：

- `promoted_generated_cache`: 90 -> 103
- `stable_local_with_promoted_coverage_percent`: 88.3 -> 89.5
- `generated_local_unstable_unpromoted`: 120 -> 107

验证结果：

- `node scripts/diagnose-dish-images.mjs "Funghetto" "Pappardelle Boscaiola" "Soup Of The Day" "Spinach Salad" "Tatin Tart" "Vegetable Curry" --json`：全部命中 `promoted_generated_cache`。
- `node --test tests/logic-regressions.test.mjs`：146/146 通过。
- `npm run lint`：通过。
- `npm run build`：通过。

下一步建议：

1. 继续处理剩余 `generated_local_unstable_unpromoted=107`，但优先恢复 hashed `generated-dish-*` 的任务证据，避免盲目按图猜菜名。
2. 对剩余 `pollinations_remote=210` 的知识库条目继续做本地化，优先高频海外菜单品类：饮品、汤、甜点、披萨/意面、早餐。
3. 用 `scripts/benchmark-menu-flow.mjs` 对至少 5 张真实菜单做首次识别速度基线，下一轮重点比较 fast first-pass provider 和更激进首屏策略。

## 2026-08-06 第三批知识库本地图回填

继续推进“本地有图优先，本地没有再 AI 生成”的目标。本轮不再从 runtime 生成缓存里盲目提升，而是用 `scripts/plan-knowledge-image-backfill.mjs` 找出仍依赖 Pollinations 远程图的知识库条目，然后用生产同源 Wan prompt 栈提前生成稳定本地图。

先运行：

```bash
node scripts/download-knowledge-images.mjs --existing-only --limit=80
```

结果：前 80 个远程条目没有可复用本地文件，全部 skipped。因此继续走稳定生图。

生成命令：

```bash
node scripts/backfill-knowledge-images-with-wan.mjs --ids=nasi-uduk,nasu-dengaku,okonomiyaki,pa-tong-ko,paccheri-al-ragu,pad-prik-king,pad-see-ew,pajeon,paletas,pastilla,patbingsu,penne-alla-vodka --apply --item-timeout-ms=120000 --delay-ms=800
```

生成 12/12 成功，平均约 11-13 秒一张。新增本地图：

- `public/dishes/nasi-uduk.webp`
- `public/dishes/nasu-dengaku.webp`
- `public/dishes/okonomiyaki.webp`
- `public/dishes/pa-tong-ko.webp`
- `public/dishes/paccheri-al-ragu.webp`
- `public/dishes/pad-prik-king.webp`
- `public/dishes/pad-see-ew.webp`
- `public/dishes/pajeon.webp`
- `public/dishes/paletas.webp`
- `public/dishes/pastilla.webp`
- `public/dishes/patbingsu.webp`
- `public/dishes/penne-alla-vodka.webp`

目检 contact sheet：`.cache/knowledge-backfill-2026-08-06-a.png`。整体可用；`patbingsu` 更像杯装红豆刨冰/甜品杯，后续有更好图时建议替换，但当前不会造成完全错菜。

发现并修复一个别名缺口：`nasu-dengaku`、`okonomiyaki`、`pajeon` 的知识库名称只有本地文字/英文解释，菜单上常见罗马字 `Nasu Dengaku`、`Okonomiyaki`、`Pajeon` 会绕过本地图进入 AI pending。已补入 `public/dish-knowledge-db.json` 并加回归测试。

诊断结果：

```json
{
  "local_knowledge": 824,
  "pollinations_remote": 198,
  "stable_local_with_promoted_coverage_percent": 91.2,
  "stable_local_deduped_coverage_percent": 90.1
}
```

关键变化：

- `local_knowledge`: 812 -> 824
- `pollinations_remote`: 210 -> 198
- `stable_local_with_promoted_coverage_percent`: 90.0 -> 91.2
- `stable_local_deduped_coverage_percent`: 88.9 -> 90.1

验证结果：

- `node scripts/diagnose-dish-images.mjs Nasu\ Dengaku Okonomiyaki Pajeon --json`：三者均命中 `local_knowledge`
- `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names"`：150/150 通过（当前 Node 环境仍会运行全量文件）
- `npm run lint`：通过
- `npm run build`：通过

2026-08-05 补充验证：

- `node --test tests/logic-regressions.test.mjs`：129/129 通过
- `npm run lint`：通过
- `npm run build`：通过

2026-08-05 速度优化补充验证：

- RED：新增缓存命中缺图场景测试后，旧实现按预期失败，因为 cache probe 仍会把 unstable images 返回为 miss。
- GREEN：实现 cache probe 缺图后台回填后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "cached menu results refresh"` 通过。
- 全量：`node --test tests/logic-regressions.test.mjs`：129/129 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 首轮模型输入观测补充：

- RED：新增 `firstPassInputOptimizeMs`、`firstPassOriginalBytes`、`firstPassModelBytes` 回归断言后，旧实现按预期失败。
- GREEN：实现首轮输入优化耗时和压缩前后字节数记录后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "smaller model image"` 通过。
- 全量：`node --test tests/logic-regressions.test.mjs`：131/131 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。
- 本地 benchmark：
  - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --target-lang ja --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184232.jpg'`
  - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --target-lang en --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184232.jpg'`

2026-08-05 fast prompt 瘦身补充：

- RED：新增 fast prompt 只输出首屏字段、禁止富字段、默认 token 降到 3072 的断言后，旧实现按预期失败。
- GREEN：更新 `src/lib/ai/qwen.ts` fast prompt 与 target language instruction 后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "fast first paint|lightweight first result|result-page AI fields"` 通过。
- 全量：`node --test tests/logic-regressions.test.mjs`：131/131 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。
- 本地 benchmark：
  - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --target-lang ko --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184308.jpg'`
  - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --target-lang ko --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184232.jpg'`
  - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --target-lang ko --cache-probe --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184232.jpg'`

2026-08-05 benchmark 补充验证：

- RED：新增 benchmark `hash_sets` 断言后，旧脚本按预期失败，因为只测单组 hash。
- GREEN：脚本改为 raw + server-normalized 双 hash_sets 后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "menu flow benchmark"` 通过。
- 本地真实菜单 benchmark：
  - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg'`
  - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --cache-probe --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg'`
- 全量：`node --test tests/logic-regressions.test.mjs`：129/129 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 fast 模型候选观测补充：

- RED：新增 `QWEN_FAST_FIRST_PASS_MODELS`、`parseFastFirstPassModels()`、`_model`、`firstPassModelName` 回归断言后，旧实现按预期失败。
- GREEN：实现 fast first pass 候选模型列表和实际模型名写入后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "fast overseas recognition|fast first-pass timing|fast first paint"` 通过。
- 全量：`node --test tests/logic-regressions.test.mjs --test-name-pattern "fast overseas recognition|fast first-pass timing|fast first paint"` 实际跑完 131 条回归，131/131 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 fast 单模型超时保护补充：

- RED：新增 `MENU_FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS`、`withFastFirstPassAttemptTimeout()`、`Promise.race` 回归断言后，旧实现按预期失败。
- GREEN：实现单候选模型超时回退后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "fast overseas recognition"` 通过。
- 全量：上述命令当前实际跑完 131 条回归，131/131 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 多页模型观测补充：

- RED：新增 `firstPassModelNames?: string[]`、`timings.firstPassModelNames[i] = raw._model` 回归断言后，旧实现按预期失败。
- GREEN：在 `TranslationTimings` 中加入 `firstPassModelNames`，每页 fast first pass 完成时按页索引写入模型名。
- 全量：`node --test tests/logic-regressions.test.mjs --test-name-pattern "fast first-pass timing"` 当前实际跑完 131 条回归，131/131 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 benchmark 模型摘要补充：

- RED：新增 benchmark 摘要字段断言后，旧脚本按预期失败，因为 `summarizeResult()` 只暴露完整 `timings`。
- GREEN：`scripts/benchmark-menu-flow.mjs` 现在在 `summary` 顶层输出：
  - `first_pass_model_name`
  - `first_pass_model_names`
  - `timings`
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "menu flow benchmark"` 当前实际跑完 131 条回归，131/131 通过。
- 验证：`node --check scripts/benchmark-menu-flow.mjs` 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 benchmark 逐页耗时摘要补充：

- RED：新增 `first_pass_model_ms_by_page`、`first_pass_build_ms_by_page` 摘要字段断言后，旧脚本按预期失败，因为 benchmark 只输出了完整 `timings`。
- GREEN：`/api/v1/translate/menu` 已按页写入 `firstPassModelMsByPage`、`firstPassBuildMsByPage`，`scripts/benchmark-menu-flow.mjs` 已把它们提升到 summary 顶层。
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "menu flow benchmark|fast first-pass timing"` 当前实际跑完 131 条回归，131/131 通过。
- 验证：`node --check scripts/benchmark-menu-flow.mjs` 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 benchmark 缓存播种修复补充：

- RED：新增 `buildBenchmarkClientHashSets()` 与无 cache-probe 上传也携带 hash sets 的回归断言后，旧脚本按预期失败。
- GREEN：`scripts/benchmark-menu-flow.mjs` 现在首次上传也会发送 `client_hashes/client_hash_sets`，与真实前端的缓存播种路径保持一致。
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "menu flow benchmark"` 当前实际跑完 131 条回归，131/131 通过。
- 验证：`node --check scripts/benchmark-menu-flow.mjs` 通过。
- 真实菜单复测：
  - 首次：`node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3011 --target-lang sv --image-timeout-ms 0 --timeout-ms 180000 '/Users/julian/Documents/菜单/20260522-184232.jpg'`
  - 结果：`first_result_ms=15347ms`，`firstPassModelMs=14956ms`，`firstPassBuildMs=96ms`，模型 `qwen-vl-plus`。
  - 二次：同图加 `--cache-probe`
  - 结果：`cache_probe_hit=true`，`cache_probe_ms=28ms`，`first_result_ms=125ms`，15/15 图片 ready。
  - 结论：重复上传路径是快的；首次识别慢仍集中在首轮视觉模型调用。

2026-08-05 大菜单图片队列元数据补充：

- RED：新增 `image_generation_queue_total`、`image_generation_active_total`、`image_generation_queued_total` 回归断言后，旧实现按预期失败。
- GREEN：`generateImagesInBackground()` 已按去重后的 `representativeDishesForGeneration` 写入队列总量、并发活跃量、排队量。
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "AI generated dish images"` 当前实际跑完 131 条回归，131/131 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 结果页图片队列体验补充：

- RED：新增类型、轮询签名、ResultsPage 队列提示、DishImageWithLoading 排队文案断言后，旧实现按预期失败。
- GREEN：队列字段已从 `TranslationResult.metadata` 贯通到结果页 banner 与单张图片占位状态。
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "results image backfill|dish image pending UI"` 当前实际跑完 131 条回归，131/131 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 详情页图片队列体验补充：

- RED：新增 `dish detail pending hero image receives image generation queue state` 回归断言后，旧实现按预期失败，因为 `imageGenProgress` 只包含 `done/total`，详情页 hero 图拿不到大菜单排队状态。
- GREEN：`src/app/page.tsx` 现在把 `metadata.image_generation_active_total` 与 `metadata.image_generation_queued_total` 合并进 `imageGenProgress`；`src/components/dish/DishDetailPage.tsx` 已把 `pendingActiveTotal`、`pendingQueuedTotal` 传给 `DishImageWithLoading`。
- 价值：用户从结果页点进某道待生成图片的详情时，hero 图会继续显示“生成中/排队中”的解释，避免误判为图片坏了或详情页排版错误。
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "dish detail pending hero"` 当前实际跑完 132 条回归，132/132 通过。
- 全量：`node --test tests/logic-regressions.test.mjs`：132/132 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 fast first-pass 模型 A/B 工具补充：

- RED：新增 `fast first-pass model benchmark runs isolated local servers per candidate` 回归断言后，旧实现按预期失败，因为项目只有单服务 benchmark，无法自动按 `QWEN_FAST_FIRST_PASS_MODELS` 做候选模型矩阵。
- GREEN：新增 `scripts/benchmark-fast-first-pass-models.mjs`。脚本会为每个候选模型启动独立本地 Next production server，注入 `MENU_FAST_FIRST_PASS=true` 与 `QWEN_FAST_FIRST_PASS_MODELS=<model>`，再复用 `scripts/benchmark-menu-flow.mjs` 测真实上传、首个结果和模型耗时。
- 输出字段包括：
  - `best_model`
  - 每个模型的 `success_rate`
  - `median_first_result_ms`
  - `median_first_pass_model_ms`
  - 原始 `benchmark` 报告
- 示例：
  ```bash
  npm run build
  node scripts/benchmark-fast-first-pass-models.mjs \
    --models qwen-vl-plus,qwen-vl-max \
    --target-lang zh \
    --repeat 2 \
    --image-timeout-ms 0 \
    '/Users/julian/Documents/菜单/20260522-184232.jpg'
  ```
- 注意：这个脚本会按模型逐个启动本地服务；真实测速需要有效的 Qwen/DashScope 环境变量和空闲端口。默认 `--image-timeout-ms 0` 是为了专注比较首轮 OCR/视觉模型，不把后台图片生成耗时混进去。
- 注意：默认启动命令是 `npm run start -- --port <port>`，需要先 `npm run build`。不要默认用 `next dev`，Next 16 同目录存在其他 dev server 时会报 `Another next dev server is already running`，导致 A/B 工具不可用。
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "fast first-pass model benchmark"` 当前实际跑完 133 条回归，133/133 通过。
- 验证：`node --check scripts/benchmark-fast-first-pass-models.mjs` 通过。
- 全量：`node --test tests/logic-regressions.test.mjs`：133/133 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。

2026-08-05 fast first-pass A/B 防缓存污染补充：

- RED：发现模型 A/B 脚本如果复用同一张菜单图片，第二个候选模型或同模型第二次 repeat 可能直接命中翻译缓存，导致“看起来更快但没有真实调用模型”。新增断言要求 A/B 脚本默认启用 `cacheBust`、支持 `--no-cache-bust` 显式关闭、用 `sharp` 生成临时隔离图片、并把 `repeat` 放到外层循环逐次隔离。
- GREEN：`scripts/benchmark-fast-first-pass-models.mjs` 现在每个模型服务仍只启动一次，但每次 repeat 都会在系统临时目录生成视觉等价的 JPEG 副本，并在左上角加 6px 极小色块改变 raw/server-normalized hash。这样每个模型、每次 repeat 都会走真实 OCR/视觉模型路径，不会被前一次缓存污染。
- 兼容修复：默认服务启动从 `npm run dev` 改为 `npm run start`。实测 `next start` 可以和当前 `localhost:3011` dev server 共存；`next dev` 会被 Next 16 的同目录 dev lock 拦截。
- 输出新增：
  - `cache_bust`
  - `cache_bust_image_count`
  - 每个模型结果中的 `benchmark.reports`，保留每次独立 benchmark 原始报告。
- 关闭方式：只有调试脚本开销时才用 `--no-cache-bust`；真实 A/B 默认不要关闭。
- 验证：`node --test tests/logic-regressions.test.mjs --test-name-pattern "fast first-pass model benchmark"` 当前实际跑完 133 条回归，133/133 通过。
- 验证：`node --check scripts/benchmark-fast-first-pass-models.mjs` 通过。
- 全量：`node --test tests/logic-regressions.test.mjs`：133/133 通过。
- 全量：`npm run lint`：通过。
- 全量：`npm run build`：通过。
- 真实 A/B 小样本：
  - 命令：`node scripts/benchmark-fast-first-pass-models.mjs --models qwen-vl-plus,qwen-vl-max --target-lang zh --repeat 1 --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184232.jpg'`
  - `qwen-vl-plus`：`first_result_ms=15232ms`，`firstPassModelMs=14198ms`，15 道菜，5 张图 ready，10 张进入后台补图。
  - `qwen-vl-max`：`first_result_ms=34827ms`，`firstPassModelMs=34437ms`，15 道菜，5 张图 ready，10 张进入后台补图。
  - 结论：这张样本上 `qwen-vl-plus` 明显更适合 fast first pass；仍需用 3-5 张真实菜单复测后再下最终线上策略。

## 后续优先级

1. 继续补齐 405 个远程/AI 候选，优先从 `scripts/plan-knowledge-image-backfill.mjs --limit=20` 输出的高频项开始。
2. 对新生成图库建立人工目检门槛：像 calzone 这种模型容易生成相邻品类的菜，不能只看文件存在。
3. 将 `generated_local_unstable: 189` 分批同步/提升为稳定 Supabase 或本地图，降低线上坏图和跨机器失效风险。
4. 用真实菜单跑 `scripts/benchmark-menu-flow.mjs`，记录上传、首个结果、文字完成、图片补齐时间，形成速度基线。
5. 对 cache probe 后台补图做线上真实验证：重复上传同一菜单时应立即进入结果页，缺图项先显示分类动画，然后通过 task polling 替换为稳定图片。
6. 下一轮速度优化建议优先分析首轮 OCR/视觉模型：
   - 首次识别 `firstPassMs` 约 19-24s，已明显超过用户“等待像 App 一样轻”的预期。
   - 目前压缩输入和 prompt 瘦身的收益都不稳定：压缩前 232KB、压缩后 138KB，但同图模型耗时仍可到 24.9s。
   - 重复上传/缓存路径已经非常快：cache probe 约 28ms，首个结果约 124ms。
   - 已具备 `QWEN_FAST_FIRST_PASS_MODELS`、`firstPassModelName` 与防缓存污染 A/B 工具；下一步应拿 3-5 张真实菜单直接跑模型候选矩阵，而不是继续盲调 prompt。
   - 推荐命令：
     ```bash
     npm run build
     node scripts/benchmark-fast-first-pass-models.mjs \
       --models qwen-vl-plus,qwen-vl-max \
       --target-lang zh \
       --repeat 2 \
       --image-timeout-ms 0 \
       '/Users/julian/Documents/菜单/20260522-184232.jpg' \
       '/Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg'
     ```
   - 已具备 `MENU_FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS` 单模型保护；线上 A/B 当前默认 30 秒，若后续接入更慢但更准的模型，可按 provider 单独配置。
  - 可选方向：更快视觉 provider 对比、专用 OCR 模型/接口、低清粗结果先展示后高清补偿、菜单分区裁剪/透视校正前处理、多图并行阈值，以及“只先抽取菜名和价格，详情后台 enrich”的两阶段识别体验。

2026-08-05 大菜单后台生图限流补充：

- RED：已有回归测试要求大菜单不能把所有缺图菜一次性送进 AI 生图；旧实现会对 `representativeDishesForGeneration` 全量生成，100-200 道菜菜单会造成长队列、慢轮询和用户误判坏图。
- GREEN：`generateImagesInBackground()` 新增 `BACKGROUND_IMAGE_GENERATION_LIMIT`，由 `MENU_BACKGROUND_IMAGE_GENERATION_LIMIT` 配置，默认 24，范围被限制在首屏优先数量 4 到 48 之间。
- 行为变化：
  - 继续使用 `prioritizeImageGenerationDishes()`，首屏菜品优先进入 AI 生图。
  - `activeDishesForGeneration = representativeDishesForGeneration.slice(0, BACKGROUND_IMAGE_GENERATION_LIMIT)` 进入真实后台生图队列。
  - `deferredDishesForGeneration = representativeDishesForGeneration.slice(BACKGROUND_IMAGE_GENERATION_LIMIT)` 标记为 `image_status = "deferred"`，不阻塞当前任务。
  - 元数据新增 `image_generation_deferred_total`，进度条 `total` 改为当前活跃补图总量，避免 deferred 菜品让进度永远到不了 100%。
  - `mergeImageGenerationStateIntoCurrentResult()` 会同步合并 `image_generation_queue_total`、`image_generation_active_total`、`image_generation_queued_total`、`image_generation_deferred_total`，避免 enrichment 与图片轮询交错时丢失队列状态。
  - 结果页顶部提示会在大菜单场景说明“稍后补图”数量；卡片/详情占位显示“稍后补图”或“图片稍后补图，先看翻译和推荐”。
- 价值：大菜单首屏更稳定，AI 生图成本和并发风险可控；用户先得到可读菜单、推荐和少量关键菜图，后排图片不再制造无限等待感。
- 验证：
  - `node --test tests/logic-regressions.test.mjs`：133/133 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-05 deferred 图片状态语义补充：

- RED：新增回归断言后，旧实现按预期失败，因为 `image_status: "deferred"` 的无图菜仍被 `isDishImagePending()` 和结果页 `hasPendingImages()` 当成 pending，会继续触发图片轮询与“生成中”语义。
- GREEN：
  - `isDishImagePending()` 现在对 `deferred` 返回 `false`。
  - 结果页 `hasPendingImages()` 现在排除 `dish.image_status === "deferred"`。
- 价值：大菜单后排菜被标记为“稍后补图”后，不再延长当前结果页的快速图片轮询；用户看到的是可解释的占位，而不是持续等待。
- 验证：
  - `node --test tests/logic-regressions.test.mjs`：133/133 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-05 cache probe 补图限流补充：

- RED：新增 cache route 回归断言后，旧实现按预期失败，因为 `/api/v1/translate/menu/cache` 命中缓存后会把所有缺图菜全量送进 `generateImagesForDishes()`，且并发写死为 `2`，没有复用大菜单后台生图上限和 deferred 语义。
- GREEN：
  - `src/app/api/v1/translate/menu/cache/route.ts` 新增 `CACHE_PROBE_BACKGROUND_IMAGE_GENERATION_LIMIT`，复用 `MENU_BACKGROUND_IMAGE_GENERATION_LIMIT` 默认 24、上限 48。
  - cache probe 补图会拆成 `activeRepresentatives` 与 `deferredRepresentatives`；后排菜标记为 `image_status = "deferred"`，不进入当前批次生图。
  - 元数据同步写入 `image_generation_queue_total`、`image_generation_active_total`、`image_generation_queued_total`、`image_generation_deferred_total`。
  - `resultNeedsImageRefresh()`、`restoreRefreshableMissingImageState()` 和补图过滤都排除 deferred，避免重复上传缓存命中后又把“稍后补图”重新改回 pending。
  - 上传后的临时 AI 图片 URL 不再作为 fallback 写入缓存；如果图片无法保存为 runtime-displayable URL，会走失败分支而不是污染结果。
- 价值：重复上传同一大菜单时，cache hit 可以继续秒开文字结果，同时后台补图不会再次把 100-200 道菜全量压进 AI 队列。
- 验证：
  - `node --test tests/logic-regressions.test.mjs`：134/134 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-05 Burrata 图片诊断别名补充：

- RED：新增诊断回归后，`scripts/diagnose-dish-images.mjs Burrata` 按预期失败；生产 `matchDishKnowledgeImage()` 已能命中 `burrata-con-pomodorini`，但诊断脚本仍把 `Burrata` 误报为 `ai_pending`。
- GREEN：
  - `src/lib/dish-image-match.ts` 显式加入 `Burrata / 布里亚塔 / 布拉塔` 到 `burrata-con-pomodorini` 的本地图片别名，避免依赖模糊评分。
  - `scripts/diagnose-dish-images.mjs` 同步该别名，诊断输出与生产匹配路径一致。
- 价值：高频西餐菜 `Burrata`、`Burrata 15€`、`布里亚塔` 会直接使用 `/dishes/burrata-con-pomodorini.webp`，减少不必要 AI 生图；诊断脚本不再把可本地命中的菜误报成待生成。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：621。
  - 已提升生成缓存：18。
  - 稳定本地覆盖率：62.5%。
  - 仍依赖远程/AI：401。
  - 运行时生成但未稳定提升：208。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "diagnostics mirrors production aliases|common short menu names"`：134/134 通过。
  - `node scripts/diagnose-dish-images.mjs Burrata 'Burrata 15€' '布里亚塔'`：三者均返回 `local_knowledge / burrata-con-pomodorini`。

2026-08-05 fast first-pass A/B 与超时默认值补充：

- 真实 A/B：
  - 命令：`node scripts/benchmark-fast-first-pass-models.mjs --models qwen-vl-plus,qwen-vl-max --target-lang zh --repeat 1 --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184232.jpg' '/Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg'`
  - `qwen-vl-plus`：`first_result_ms=16739ms`，两页 `firstPassModelMsByPage=[15022,15685]`，32 道菜，10 张图 ready，22 张后台补图。
  - `qwen-vl-max`：`first_result_ms=27304ms`，两页 `firstPassModelMsByPage=[28498,26889]`，32 道菜，10 张图 ready，22 张后台补图。
  - 结论：这轮真实双图测试仍然支持 `qwen-vl-plus` 作为默认 fast first-pass 模型；`qwen-vl-max` 不适合首屏路径，更适合作为兜底或后台补偿。
- GREEN：
  - `src/lib/ai/qwen.ts` 将 `MENU_FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS` 默认值从 `45000` 收紧到 `30000`。
  - 回归测试锁定 `MENU_FAST_FIRST_PASS_ATTEMPT_TIMEOUT_MS || "30000"`，防止后续默认值无意识变回过长等待。
- 价值：海外弱网或 provider 抖动时，单个 fast 候选模型最多默认占用 30 秒，避免用户长期停留在识别加载页；同时不影响当前约 15 秒的 `qwen-vl-plus` 正常请求。

2026-08-05 生成图提升与泛名保护补充：

- RED：
  - `node scripts/promote-generated-dish-images.mjs --limit=20 --verbose` 显示 `generated-plain`、`generated-vegan`、`generated-overnight` 仍为 `would_promote`。
  - 新增 `ROYALE / BENEDICT / FLORENTINE` 稳定本地命中断言后，测试按预期失败，因为这三张仍停留在 `/generated-dishes` 临时层。
- GREEN：
  - `scripts/promote-generated-dish-images.mjs` 的泛名判断改为优先使用 `name_original`。只要原始菜名是 `plain`、`vegan`、`overnight` 这类必须依赖菜单分区上下文的泛名，就跳过提升；不会再因为翻译名带了上下文而被误放行。
  - 回归测试现在会真实执行 dry-run，断言 `generated-plain`、`generated-vegan`、`generated-overnight` 均为 `skipped_generic_name`。
  - 目检并提升 3 张早餐蛋类生成图：
    - `generated-royale`
    - `generated-benedict`
    - `generated-florentine`
  - 新增文件位于 `public/dishes/generated-cache/`，并写入 `public/generated-dish-local-index.json`。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：621。
  - 已提升生成缓存：21。
  - 稳定本地覆盖率：62.8%。
  - 仍依赖远程/AI：401。
  - 运行时生成但未稳定提升：208。
- 诊断验证：
  - `Royale`、`Benedict`、`Florentine` 均返回 `promoted_generated_cache`，URL 为 `/dishes/generated-cache/*.webp`。
  - `Plain`、`Vegan`、`Overnight` 仍保持 `generated_local_unstable`，不纳入全局稳定图库，避免后续把 `vegan burger` 等菜错配成粥类图片。
- 验证：
 - `node --test tests/logic-regressions.test.mjs --test-name-pattern "verified generated dish images"`：134/134 通过。
 - `npm run lint`：通过。
 - `npm run build`：通过。

2026-08-05 高频本地图库第五批与高风险 prompt hint 补充：

- 目标：继续降低海外菜单常见菜的 AI 等待，并重点修正 `California Roll`、`Black Pepper Crab` 这类模型容易拉偏的高风险图片。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言：
    - `Banh Xeo`
    - `Bun Cha`
    - `Chili Crab`
    - `Black Pepper Crab`
    - `California Roll`
  - 初始诊断均为 `ai_pending`，测试首个失败为 `Banh Xeo` 返回 `undefined`。
  - 新增 `dish image prompts keep high-frequency overseas dishes visually distinct`，要求：
    - `California Roll` 必须是 inside-out sushi roll、切开的 maki rounds、米饭在外，禁止 hand roll / seaweed cup / uncut sushi log。
    - `Bun Cha` 必须有 rice vermicelli、grilled pork patties/slices、nuoc cham，禁止 rice bowl / kebab chunks。
    - `Black Pepper Crab` 必须是 Singapore black pepper crab、dark black pepper sauce / crust，禁止 chili crab / bright red / orange-red sauce。
  - 第三轮又新增 `image_prompt_hint` 红灯，要求关键本地图库提示必须出现在通用 category framing 之前，避免高风险菜被通用 seafood/sushi 语义冲淡。
- GREEN：
  - `src/lib/ai/image-gen.ts` 新增/增强：
    - `CALIFORNIA_ROLL_PATTERN`
    - `BUN_CHA_PATTERN`
    - `BLACK_PEPPER_CRAB_PATTERN`
    - `image_prompt_hint` 支持，放在 prompt 的 `Visual priority` 之后、通用摄影 framing 之前。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增 `SPECIAL_BACKFILL_IMAGE_HINTS`，当前覆盖：
    - `california-roll`：强制 6-8 个切开的 inside-out 圆卷，米饭在外，禁止单根未切 sushi log。
    - `black-pepper-crab`：强制深黑褐黑椒酱和黑椒颗粒，禁止红/橙/番茄/辣椒蟹酱。
  - 生成并写入 5 张本地 webp：
    - `/dishes/banh-xeo.webp`
    - `/dishes/bun-cha.webp`
    - `/dishes/chili-crab.webp`
    - `/dishes/black-pepper-crab.webp`
    - `/dishes/california-roll.webp`
  - 目检联系表：
    - `/tmp/dishlens-backfill-20260805-g.png`：第一轮目检发现 `California Roll` 仍像手卷/单根海苔卷，`Bun Cha` 可用，`Black Pepper Crab` 偏红。
    - `/tmp/dishlens-backfill-20260805-h.png`：第二轮 `California Roll` 仍是单根 roll，`Black Pepper Crab` 仍偏橙红。
    - `/tmp/dishlens-backfill-20260805-i.png`：第三轮可接受，`California Roll` 已为切开的 inside-out 圆卷；`Black Pepper Crab` 有明显黑椒覆盖，与 `Chili Crab` 可区分。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：646。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：67.2%。
  - 仍依赖远程/AI：376。
  - 运行时生成但未稳定提升：208。
- 诊断验证：
  - `node scripts/diagnose-dish-images.mjs 'Banh Xeo' 'Bun Cha' 'Chili Crab' 'Black Pepper Crab' 'California Roll' --json`
  - 五者均返回 `local_knowledge`，URL 均为 `/dishes/*.webp`。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|high-frequency overseas|critical local-library|Wan knowledge image backfill|dish image diagnostics mirrors"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续建议：
  - 继续用小批量、强目检的方式补 376 个远程/AI 候选；不要只看生成成功。
 - 对 `California Roll` 这类模型长期不稳定的菜，优先保留本地图，线上同名直接命中，避免重复 AI 生图。
 - 首次识别慢仍主要来自视觉模型首轮调用，本地图补齐主要改善结果页图片可见速度，不能单独解决 15-25 秒首屏等待。

2026-08-05 首屏 OCR 并发与大菜单 token 上限补充：

- 目标：继续推进“识别更快”和“单张图/多页菜单含大量菜品时更可用”。此前首屏 fast first-pass 已经比完整识别轻，但默认仍和完整 OCR 共用 `MENU_OCR_CONCURRENCY=2`；多页菜单会以 2 页一批等待。另一个隐患是 fast first-pass 默认 `MENU_FAST_FIRST_PASS_MAX_TOKENS=3072`，对密集菜单或 100-200 道菜容易更接近输出上限。
- RED：
  - 将回归测试改为期望：
    - fast first-pass 使用独立 `FAST_FIRST_PASS_OCR_CONCURRENCY`。
    - 默认 `MENU_FAST_FIRST_PASS_OCR_CONCURRENCY || "4"`，上限 4。
    - 完整 OCR 仍保留 `MENU_OCR_CONCURRENCY || "2"`，不把后台 enrichment 压力一起抬高。
    - `MENU_FAST_FIRST_PASS_MAX_TOKENS` 默认改为 `4096`。
  - 初始测试按预期失败：代码仍是 `3072` 且 first-pass 仍使用 `OCR_CONCURRENCY`。
- GREEN：
  - `src/lib/ai/qwen.ts`：
    - `MENU_FAST_FIRST_PASS_MAX_TOKENS` 默认从 `3072` 调整为 `4096`，仍通过 `Math.min(4096, ...)` 限制上限。
  - `src/app/api/v1/translate/menu/route.ts`：
    - 新增 `FAST_FIRST_PASS_OCR_CONCURRENCY`。
    - `processImagesFastFirstPass()` 的 batch loop 改为使用 `FAST_FIRST_PASS_OCR_CONCURRENCY`。
    - `processImages()` 完整通道仍使用原 `OCR_CONCURRENCY`，保持后台完整识别的保守并发。
- 预期收益：
  - 3-4 页菜单的首屏 OCR 理论上少一批等待；例如 4 页菜单从 2+2 批变成 4 页并行。
  - 大量菜名的 fast first-pass 输出空间更充足，减少密集菜单被截断或漏项的风险。
  - 后台 enrichment 没有同步升并发，降低 provider 抖动或限流风险。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "fast first paint|multi-page menu OCR|fast overseas|smaller model image"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 真实 4 页菜单 benchmark：
  - 样本：
    - `/Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg`
    - `/Users/julian/Documents/菜单/微信图片_20260523192504_158_838.jpg`
    - `/Users/julian/Documents/菜单/微信图片_20260523192453_155_838.jpg`
    - `/Users/julian/Documents/菜单/微信图片_20260523192450_154_838.jpg`
  - 并发 3 时，cache-bust 首次识别：`first_result_ms=9168ms`，`text_done_ms=30200ms`，49 道菜，31/49 图片 ready。每页模型耗时 `[14322, 20359, 8613, 9169]`；第 4 页需要第二批启动，所以总文字完成约 30 秒。
  - 并发 4 时，第一次 repeat 命中上一次 deterministic cache-bust 缓存，不能作为新识别证据；第二次 repeat 使用新扰动图，真实识别：`first_result_ms=10668ms`，`text_done_ms=18179ms`，49 道菜，32/49 图片 ready。每页模型耗时 `[17707, 12996, 9700, 11248]`；4 页同时进入首屏 OCR，总文字完成约 18 秒。
  - 结论：对 4 页海外菜单，默认 fast first-pass 并发 4 能明显减少“全部文字完成”等待；首个结果仍取决于最快页面模型耗时，本轮约 9-11 秒。
- 后续建议：
  - 用真实 3-5 页菜单跑：
    - `node scripts/benchmark-menu-flow.mjs --base-url http://localhost:3000 --image-timeout-ms 0 --timeout-ms 180000 <images...>`
  - 重点比较 `first_result_ms`、`first_pass_model_ms_by_page`、`first_pass_model_names` 和 `dish_count`，确认并发提升是否带来真实首屏收益且没有增加失败率。

2026-08-05 高频本地图库第四批与 Temaki 质量收口：

- 目标：继续减少海外菜单中常见菜品的 AI 等待，补齐下一批高频 `ai_pending` 菜，并把已经生成但视觉不准的 `Temaki` 收到可稳定使用的质量线。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言：
    - `Temaki`
    - `Arroz con Mariscos`
    - `Arroz Negro`
    - `Bacalao al Pil-Pil`
    - `Banh Trang Tron`
  - 初始测试按预期失败，首个失败为 `Temaki` 返回 `undefined`。
  - 在区域包裹类 prompt 测试中新增 `Temaki` 约束：必须是锥形手卷、可见海苔和馅料、禁止寿司块/圆筒卷。
  - 目检发现第一版 `Temaki` 仍偏圆筒寿司卷，第二版变成竖直海苔杯；继续补 RED 约束，禁止 `not standing vertical`、`not upright cylinder`，并移除 `upright cone` 语义。
  - `Banh Trang Tron` 第一版偏普通白菜虾沙拉；补充越南米纸沙拉 prompt guardrail，要求薄透明米纸条、青芒、虾米、鹌鹑蛋、花生，并禁止 cabbage salad/coleslaw。
- GREEN：
  - 运行：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=temaki,arroz-con-mariscos,arroz-negro,bacalao-al-pil-pil,banh-trang-tron --apply --item-timeout-ms=120000 --delay-ms=800`
  - 后续对 `Temaki` 和 `Banh Trang Tron` 使用 `--force` 重刷，最终 `Temaki` 图为斜放锥形海苔手卷，尖底、宽口和三文鱼/黄瓜/米饭可辨识；`Banh Trang Tron` 图不再像普通白菜沙拉。
  - 生成并写入 5 张本地 webp：
    - `/dishes/temaki.webp`
    - `/dishes/arroz-con-mariscos.webp`
    - `/dishes/arroz-negro.webp`
    - `/dishes/bacalao-al-pil-pil.webp`
    - `/dishes/banh-trang-tron.webp`
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步加入直接别名，避免生产匹配和诊断分叉。
  - `src/lib/ai/image-gen.ts` 新增/增强 `TEMAKI_PATTERN`、`BANH_TRANG_TRON_PATTERN` 专属视觉 guardrail。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：641。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：66.7%。
  - 仍依赖远程/AI：381。
  - 运行时生成但未稳定提升：208。
- 诊断验证：
  - `node scripts/diagnose-dish-images.mjs 'Temaki' 'Arroz con Mariscos' 'Arroz Negro' 'Bacalao al Pil-Pil' 'Banh Trang Tron' --json`
  - 五者均返回 `local_knowledge`，URL 均为 `/dishes/*.webp`。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|regional wrapped|Vietnamese rice paper|dish image diagnostics mirrors"`：135/135 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续建议：
  - 继续按 `scripts/plan-knowledge-image-backfill.mjs --limit=20` 小批量补图，并坚持人工目检；`Temaki` 这次证明“文件存在”不等于“可以进入稳定图库”。
  - 对仍在 `generated_local_unstable: 208` 的运行时图片继续分批提升，优先处理真实菜单高频、目检可信、菜名不泛化的项。
  - 下一轮速度收益最大处仍是首次识别模型路径：图片覆盖已经能减少后台补图等待，但首次首屏 15-25 秒主要来自视觉模型调用。

2026-08-05 高频本地图库第三批补充：

- 目标：继续减少海外菜单中常见菜品的 AI 等待，优先补齐仍会触发 `ai_pending` 或不稳定生成层的高频菜。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言：
    - `Pizza Pugliese`
    - `Pizza Salsiccia e Friarielli`
    - `Pizza Wurstel e Patate`
    - `Popiah`
    - `Saltimbocca alla Romana`
  - 测试先按预期失败，首个失败为 `Pizza Pugliese` 返回 `undefined`。
- GREEN：
  - 运行：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=pizza-pugliese,pizza-salsiccia-friarielli,pizza-wurstel-patate,popiah,saltimbocca --apply --item-timeout-ms=120000 --delay-ms=800`
  - 生成并写入 5 张本地 webp：
    - `/dishes/pizza-pugliese.webp`
    - `/dishes/pizza-salsiccia-friarielli.webp`
    - `/dishes/pizza-wurstel-patate.webp`
    - `/dishes/popiah.webp`
    - `/dishes/saltimbocca.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
- Saltimbocca 质量收口：
  - 第一版目检不通过：主体像厚牛排/肉圆，不能作为稳定资产。
  - 先补 RED 测试，要求 prompt 明确包含 `thin veal cutlets/scallopini`、`prosciutto`、`sage`、`not thick beef steak`。
  - 第二版目检仍偏肉卷/圆形 medallion；继续补 RED 测试，要求 prompt 明确 `wide flat/flat irregular/flattened` 和 `not round medallions/not rolled meat rounds`。
  - `src/lib/ai/image-gen.ts` 新增 `SALTIMBOCCA_PATTERN` 和专属视觉 guardrail：宽而扁的小牛肉薄片、火腿、鼠尾草、浅白葡萄酒黄油汁；禁止厚牛排、圆形 medallion、肉卷、肉丸、炖菜。
  - 重新运行 `node scripts/backfill-knowledge-images-with-wan.mjs --ids=saltimbocca --apply --force --item-timeout-ms=120000 --delay-ms=800`。
  - 最终目检通过：图片为两片扁平小牛肉片，上方有 prosciutto 和 sage，浅色黄油/酒汁，不再是厚肉圆。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：636。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：66.2%。
  - 仍依赖远程/AI：386。
  - 运行时生成但未稳定提升：208。
- 诊断验证：
  - `node scripts/diagnose-dish-images.mjs 'Pizza Pugliese' 'Pizza Salsiccia e Friarielli' 'Pizza Wurstel e Patate' 'Popiah' 'Saltimbocca alla Romana' --json`
  - 5 个候选均返回 `local_knowledge`，URL 均为 `/dishes/*.webp`。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "regional mains"`：134/134 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-05 高频披萨知识库补图补充：

- 目标：继续降低意大利菜单的图片等待。`Pizza Bianca`、`Pizza Bufalina`、`Pizza Napoletana`、`Pizza al Tartufo`、`Pizza Frutti di Mare` 都是海外餐厅常见菜单项，之前诊断均为 `ai_pending`，会触发后台 AI 生图。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names"` 按预期失败，首个失败为 `Pizza Bianca` 实际返回 `undefined`，证明这些菜仍未命中本地知识图。
- GREEN：
  - 运行：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=pizza-bianca,pizza-bufalina,pizza-napoletana,pizza-tartufo,pizza-frutti-di-mare --apply --item-timeout-ms=120000 --delay-ms=800`
  - 生成并写入 5 张本地 webp：
    - `/dishes/pizza-bianca.webp`
    - `/dishes/pizza-bufalina.webp`
    - `/dishes/pizza-frutti-di-mare.webp`
    - `/dishes/pizza-napoletana.webp`
    - `/dishes/pizza-tartufo.webp`
  - 已更新 `public/dish-knowledge-db.json` 中对应 `card` 和 `hero`。
  - 目检联系表：`/tmp/dishlens-pizza-backfill-20260805.png`。5 张均为对应披萨类型，无文字、水印或明显错菜；海鲜披萨有海鲜/贝类视觉，松露披萨有松露片。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：626。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：65.3%。
  - 仍依赖远程/AI：396。
  - 运行时生成但未稳定提升：208。
- 诊断验证：
  - `node scripts/diagnose-dish-images.mjs 'Pizza Bianca' 'Pizza Bufalina' 'Pizza Napoletana' 'Pizza al Tartufo' 'Pizza Frutti di Mare' --json`
  - 五者均返回 `local_knowledge`，URL 为 `/dishes/*.webp`。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names"`：134/134 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续建议：
  - 继续按小批量补图，不要一次性生成几十张不目检。下一批建议优先补：`pizza-caprese`、`pizza-romana`、`pizza-siciliana`、`pizza-burrata-prosciutto`、`pizza-mortadella-pistacchio`。
  - 每批都保留 RED/GREEN 回归断言和 contact sheet，避免为了覆盖率引入错图。

2026-08-05 高频披萨知识库补图第二批：

- 目标：继续降低海外意大利菜单的图片等待，并修正 `Pizza Burrata e Prosciutto` 被泛化 `burrata` 别名误配成普通布拉塔番茄前菜的问题。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言：
    - `Pizza Caprese`
    - `Pizza Romana`
    - `Pizza Siciliana`
    - `Pizza Burrata e Prosciutto`
    - `Pizza Mortadella e Pistacchio`
  - 测试先按预期失败，首个失败为 `Pizza Caprese` 返回 `undefined`。
  - 生成图片后，测试继续暴露 `Pizza Burrata e Prosciutto` 被 `burrata-con-pomodorini` 截走，确认这是匹配优先级问题，不只是缺图。
- GREEN：
  - 运行：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=pizza-caprese,pizza-romana,pizza-siciliana,pizza-burrata-prosciutto,pizza-mortadella-pistacchio --apply --item-timeout-ms=120000 --delay-ms=800`
  - 生成并写入 5 张本地 webp：
    - `/dishes/pizza-burrata-prosciutto.webp`
    - `/dishes/pizza-caprese.webp`
    - `/dishes/pizza-mortadella-pistacchio.webp`
    - `/dishes/pizza-romana.webp`
    - `/dishes/pizza-siciliana.webp`
  - 已更新 `public/dish-knowledge-db.json` 中对应 `card` 和 `hero`。
  - 目检联系表：`/tmp/dishlens-pizza-backfill-20260805-c.png`。5 张均为披萨，无文字/水印；布拉塔火腿披萨不再是普通布拉塔前菜，开心果披萨有绿色碎粒和肉片。
  - `src/lib/dish-image-match.ts` 增加更具体的 `pizza burrata e prosciutto` 直接别名，并放在宽泛 `burrata` 别名之前。
  - `scripts/diagnose-dish-images.mjs` 同步增加该别名，避免诊断工具和生产匹配分叉。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：631。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：65.8%。
  - 仍依赖远程/AI：391。
  - 运行时生成但未稳定提升：208。
- 诊断验证：
  - `node scripts/diagnose-dish-images.mjs 'Pizza Burrata e Prosciutto' 'Burrata' --json`
  - `Pizza Burrata e Prosciutto` 返回 `local_knowledge / pizza-burrata-prosciutto`。
  - `Burrata` 仍返回 `local_knowledge / burrata-con-pomodorini`。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|dish image diagnostics mirrors"`：134/134 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-05 运行时生成图第二批提升补充：

- 目标：继续把已经生成且目检可靠的运行时图片提升到 `public/dishes/generated-cache/`，让重复菜单和类似菜名优先命中本地静态图，减少 Supabase/Wan 依赖。
- 目检联系表：`/tmp/dishlens-promote-candidates-20260805-b.png`。
- RED：
  - 新增早餐/甜品/咖啡饮品稳定命中断言后，`CHIA PUDDING` 等菜按预期失败，因为仍在 `/generated-dishes` 临时层。
- GREEN：
  - 提升 20 张目检合格图片：
    - `generated-chia-pudding`
    - `generated-sandwich-piselli-fava-melissa-uovo-poche`
    - `generated-omelette-alla-vignarola`
    - `generated-pan-frutto-ricotta-miele-noci`
    - `generated-semi-di-chia-latte-di-riso-sciropppo-d-acero-frutti-di-bosco`
    - `generated-semi-di-chia-latte-di-riso-sciroppio-d-acero-frutti-di-bosco`
    - `generated-sydney-rock-oysters-mignonette-lg-of`
    - `generated-chia-pudding-v`
    - `generated-pomme-rotie-au-four`
    - `generated-poire-pochee-a-la-creme-de-mascarpone`
    - `generated-glaces-artisanales-et-croquant-d-amandes`
    - `generated-colonel`
    - `generated-expresso`
    - `generated-decafeine`
    - `generated-double-expresso`
    - `generated-grand-cafe`
    - `generated-cappuccino`
    - `generated-latte-macchiato`
    - `generated-infusion`
    - `generated-decafine`
  - `scripts/promote-generated-dish-images.mjs` 增加阻止名单：
    - `generated-pommeau-glace`：目检像苹果鸡尾酒，不像苹果雪葩/Calvados。
    - `generated-angelochu-anchovy`、`generated-miso-chickpea-v-l`：已有 canonical promoted cache 覆盖，避免重复噪音。
  - dry-run 收口结果：`would_promote: 0`，`already_indexed: 41`，`skipped_generic_name: 3`。
- 当前图片覆盖诊断：
  - 知识库总数：1022。
  - 本地知识图：621。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：64.8%。
  - 仍依赖远程/AI：401。
  - 运行时生成但未稳定提升：208。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "verified generated dish images"`：134/134 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-05 大菜单图片补图自适应限流收口：

- 背景：
  - 之前结果页已经接入 `image_generation_queue_total`、`image_generation_deferred_total` 等队列元数据，但上传主路由仍用固定 `BACKGROUND_IMAGE_GENERATION_LIMIT=24` 切分后台 AI 生图队列。
  - 这会让 100-200 道菜菜单在首次上传或缓存命中缺图时仍启动过多 AI 图片任务，拖慢轮询、增加 Wan/API 成本，也容易让用户误以为图片失效。
- RED：
  - `tests/logic-regressions.test.mjs` 已要求主上传路由具备 `imageGenerationLimitForDishCount()`、`MENU_LARGE_MENU_IMAGE_GENERATION_LIMIT`、`MENU_HUGE_MENU_IMAGE_GENERATION_LIMIT`。
  - 旧实现按预期失败，因为主路由仍直接使用 `representativeDishesForGeneration.slice(0, BACKGROUND_IMAGE_GENERATION_LIMIT)`。
- GREEN：
  - `src/app/api/v1/translate/menu/route.ts` 新增自适应上限：
    - 普通菜单：默认 `MENU_BACKGROUND_IMAGE_GENERATION_LIMIT=24`。
    - 大菜单：`totalDishes >= 80` 时默认降为 `MENU_LARGE_MENU_IMAGE_GENERATION_LIMIT=16`。
    - 超大菜单：`totalDishes >= 160` 时默认降为 `MENU_HUGE_MENU_IMAGE_GENERATION_LIMIT=8`。
    - 最低仍保护 `ABOVE_FOLD_IMAGE_GENERATION_LIMIT=4`，保证首屏关键菜优先补图。
  - `generateImagesInBackground()` 改为 `imageGenerationLimitForDishCount(allDishes.length)`，后排代表菜统一标记 `image_status: "deferred"`。
  - `src/app/api/v1/translate/menu/cache/route.ts` 同步增加 `cacheProbeImageGenerationLimitForDishCount()`，缓存命中后缺图补齐也复用相同的大菜单降载策略。
- 价值：
  - 一张图片或多页菜单里有 100-200 道菜时，系统会先让翻译、推荐、首屏图片可用，不再把所有缺图菜都压进同一轮 AI 生图。
  - 结果页/详情页已有的“生成中/排队中/稍后补图”语义现在和后端队列真实一致，海外弱网下用户等待感更可控。
  - 重复上传缓存命中时也不会重新制造超长后台图片队列。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：646。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：67.2%。
  - 仍依赖远程/AI：376。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "large-menu backfill|cache-probe image refresh"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "image generation|cache-probe image refresh|large-menu backfill|deferred 图片状态|dish image diagnostics"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续用 3-5 张真实 80+、160+ 菜菜单跑 benchmark，确认 `image_generation_deferred_total` 与结果页提示在真实轮询中符合预期。
  - 把 `generated_local_unstable: 210` 继续分批目检提升，优先补海外菜单高频菜，提升本地图命中率。

2026-08-05 高频本地图库第六批补充：

- 目标：
  - 继续降低海外菜单常见菜的 AI 等待，优先补视觉身份清楚、用户旅行场景常见、且不易泛化错配的菜品。
- 本批选择：
  - `cha-gio`：越式炸春卷。
  - `croquetas-espanolas`：西班牙炸丸子。
  - `fish-tacos-street`：鱼肉塔可。
  - `gambas-al-ajillo`：西班牙蒜香虾。
  - `goi-cuon`：越南鲜春卷。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Gambas al Ajillo` 返回 `undefined`。
- GREEN：
  - 使用生产同源 Wan prompt 栈生成并写入 5 张 768x768 webp：
    - `public/dishes/cha-gio.webp`
    - `public/dishes/croquetas-espanolas.webp`
    - `public/dishes/fish-tacos-street.webp`
    - `public/dishes/gambas-al-ajillo.webp`
    - `public/dishes/goi-cuon.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
- 目检：
  - 联系表：`/tmp/dishlens-backfill-20260805-next5.png`。
  - 结果：5 张均能看出菜品身份；`goi-cuon` 为透明米纸卷，`fish-tacos-street` 为鱼肉塔可，`gambas-al-ajillo` 为蒜香虾，质量可进入稳定本地图库。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：651。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：67.7%。
  - 仍依赖远程/AI：371。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Gambas al Ajillo' 'Goi Cuon' 'Cha Gio' 'Croquetas' 'Fish Tacos' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics mirrors"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续按小批量补图，优先从 `boquerones-fritos`、`branzino-al-forno`、`bun-thit-nuong`、`bungeoppang`、`ca-kho-to`、`calamares-a-la-andaluza`、`char-kway-teow`、`dragon-roll` 中选择，生成后必须目检。

2026-08-05 高频本地图库第七批补充：

- 目标：
  - 继续减少海外菜单常见菜的实时 AI 生图等待，优先补西班牙、意大利、越南、韩国常见菜单项。
- 本批选择：
  - `boquerones-fritos`：西班牙炸凤尾鱼。
  - `branzino-al-forno`：意式烤海鲈鱼。
  - `bun-thit-nuong`：越式烤肉米粉。
  - `bungeoppang`：韩式鱼形红豆饼。
  - `ca-kho-to`：越式瓦缸焦糖鱼。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Boquerones Fritos` 返回 `undefined`。
- GREEN：
  - 使用 Wan 生成并写入 5 张 768x768 webp：
    - `public/dishes/boquerones-fritos.webp`
    - `public/dishes/branzino-al-forno.webp`
    - `public/dishes/bun-thit-nuong.webp`
    - `public/dishes/bungeoppang.webp`
    - `public/dishes/ca-kho-to.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `bungeoppang` 条目补充英文罗马化别名 `Bungeoppang`，否则英文菜单拼写会错过本地命中，只匹配到韩文/解释名。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 给 `boquerones-fritos` 加入强 prompt hint。第一版图片更像未裹粉煎小鱼；强制重生后改为金黄酥脆小鱼配柠檬，更符合 `Boquerones Fritos`。
- 目检：
  - 第一版联系表：`/tmp/dishlens-backfill-20260805-next5b.png`。
  - 重生后联系表：`/tmp/dishlens-backfill-20260805-next5b-v2.png`。
  - 结果：`boquerones-fritos` 重生后通过；其余 4 张均能看出菜品身份。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：656。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：68.2%。
  - 仍依赖远程/AI：366。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Boquerones Fritos' 'Branzino al Forno' 'Bun Thit Nuong' 'Bungeoppang' 'Ca Kho To' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image prompts keep high-frequency|critical local-library"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补：`calamares-a-la-andaluza`、`char-kway-teow`、`chirashizushi`、`dragon-roll`、`fish-amritsari`、`fish-curry` 等；寿司/鱼类必须目检，必要时加 prompt hint 后重生。

2026-08-05 高频本地图库第八批补充：

- 目标：
  - 继续降低海外菜单中西班牙、新马、日本、印度常见菜的实时 AI 生图概率。
- 本批选择：
  - `calamares-a-la-andaluza`：安达卢西亚炸鱿鱼。
  - `char-kway-teow`：新马炒粿条。
  - `chirashizushi`：散寿司。
  - `dragon-roll`：巨龙寿司卷。
  - `fish-amritsari`：阿姆利则炸鱼。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Calamares a la Andaluza` 返回 `undefined`。
- GREEN：
  - 使用 Wan 生成并写入 5 张 768x768 webp：
    - `public/dishes/calamares-a-la-andaluza.webp`
    - `public/dishes/char-kway-teow.webp`
    - `public/dishes/chirashizushi.webp`
    - `public/dishes/dragon-roll.webp`
    - `public/dishes/fish-amritsari.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `chirashizushi` 条目补充英文罗马化别名 `Chirashizushi`，否则英文菜单拼写会错过本地命中。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 给 `char-kway-teow` 加入强 prompt hint。第一版更像汤面/普通海鲜面；强制重生后改为深色镬气炒粿条，带虾、豆芽和扁米粉语义。
- 目检：
  - 第一版联系表：`/tmp/dishlens-backfill-20260805-next5c.png`。
  - 重生后联系表：`/tmp/dishlens-backfill-20260805-next5c-v2.png`。
  - 结果：`char-kway-teow` 重生后通过；`chirashizushi`、`dragon-roll`、`fish-amritsari` 视觉身份清楚；`calamares` 有鱿鱼圈和柠檬，质量可用。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：661。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：68.7%。
  - 仍依赖远程/AI：361。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Calamares a la Andaluza' 'Char Kway Teow' 'Chirashizushi' 'Dragon Roll' 'Fish Amritsari' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|critical local-library"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补 `fish-curry`、`fugu-sashimi`、`gai-tod`、`ganjang-gejang`、`gravlax`；其中 `fugu-sashimi` 和 `ganjang-gejang` 属高风险菜，需强 prompt hint 和严格目检。

2026-08-05 高频本地图库第九批补充：

- 目标：
  - 继续降低印度、日料、泰餐、韩餐、北欧常见菜的实时 AI 生图概率；重点处理高风险视觉错配菜。
- 本批选择：
  - `fish-curry`：印度鱼咖喱。
  - `fugu-sashimi`：河豚刺身。
  - `gai-tod`：泰式炸鸡。
  - `ganjang-gejang`：韩式酱油腌生蟹。
  - `gravlax`：北欧腌三文鱼。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Fish Curry` 返回 `undefined`。
- GREEN：
  - 使用 Wan 生成并写入 5 张 768x768 webp：
    - `public/dishes/fish-curry.webp`
    - `public/dishes/fugu-sashimi.webp`
    - `public/dishes/gai-tod.webp`
    - `public/dishes/ganjang-gejang.webp`
    - `public/dishes/gravlax.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `ganjang-gejang` 条目补充英文罗马化别名 `Ganjang Gejang`，否则英文菜单拼写不会命中本地图库。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入两个高风险菜 prompt hint：
    - `fugu-sashimi`：要求半透明河豚薄片菊花状摆盘，禁止普通三文鱼/金枪鱼/寿司卷。
    - `ganjang-gejang`：要求灰蓝/褐色生蟹壳、深色酱油腌汁和蟹黄，禁止熟红蟹/辣蟹。
- 目检：
  - 第一版联系表：`/tmp/dishlens-backfill-20260805-next5d.png`。
  - 重生后联系表：`/tmp/dishlens-backfill-20260805-next5d-v2.png`。
  - 结果：`ganjang-gejang` 第一版像熟红蟹，不合格；加强 prompt 后重生为灰蓝蟹壳+深色酱汁，质量过线。其他 4 张视觉身份清楚。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：666。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：69.2%。
  - 仍依赖远程/AI：356。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Fish Curry' 'Fugu Sashimi' 'Gai Tod' 'Ganjang Gejang' 'Gravlax' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|critical local-library"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补 `haemul-pajeon`、`hokkien-mee`、`hoy-tod`、`kerak-telor`、`khao-pad`；其中 `hokkien-mee` 和 `hoy-tod` 容易被生成成泛面/泛煎蛋，需要目检和必要的 prompt hint。

2026-08-05 高频本地图库第十批补充：

- 目标：
  - 继续降低韩餐、新马、泰餐、印尼常见菜单项的实时 AI 生图概率，提升海外菜单结果页首屏图片稳定性。
- 本批选择：
  - `haemul-pajeon`：韩式海鲜葱饼。
  - `hokkien-mee`：新马福建面。
  - `hoy-tod`：泰式蚝煎。
  - `kerak-telor`：印尼椰丝蛋饼。
  - `khao-pad`：泰式炒饭。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Haemul Pajeon` 返回 `undefined`。
- GREEN：
  - 使用 Wan 生成并写入 5 张 768x768 webp：
    - `public/dishes/haemul-pajeon.webp`
    - `public/dishes/hokkien-mee.webp`
    - `public/dishes/hoy-tod.webp`
    - `public/dishes/kerak-telor.webp`
    - `public/dishes/khao-pad.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `haemul-pajeon` 条目补充英文罗马化别名 `Haemul Pajeon`，否则英文菜单拼写不会命中本地图库。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入三个强 prompt hint：
    - `hokkien-mee`：要求黄面+米粉、虾/鱿鱼/蛋/韭菜/叁巴，禁止汤面、拉面、黑色炒粿条。
    - `hoy-tod`：要求泰式酥脆蚝煎、豆芽、红辣椒酱，禁止普通蛋饼/韩式海鲜饼。
    - `haemul-pajeon`：要求韩式海鲜葱饼切块、长葱段和海鲜可见，禁止厚蛋饼/披萨/泰式蚝煎。
- 目检：
  - 第一版联系表：`/tmp/dishlens-backfill-20260805-next5e.png`。
  - 重生后联系表：`/tmp/dishlens-backfill-20260805-next5e-v2.png`。
  - 结果：`haemul-pajeon` 第一版更像厚蛋饼；加强 prompt 后重生为切块葱饼，有葱段、海鲜和蘸酱，质量过线。其余 4 张视觉身份可用。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：671。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：69.7%。
  - 仍依赖远程/AI：351。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Haemul Pajeon' 'Hokkien Mee' 'Hoy Tod' 'Kerak Telor' 'Khao Pad' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|critical local-library"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 稳定本地覆盖率已接近 70%。继续补 `kra-pao-gai`、`kua-mee`、`maki-roll`、`mee-goreng`、`mee-krob`；其中 `maki-roll`、`mee-goreng` 容易与既有寿司/炒面混淆，需要强 prompt 和目检。

2026-08-05 高频本地图库第十一批补充：

- 目标：
  - 把泰餐、日式寿司和东南亚面类高频缺图项继续前移到稳定本地图库，减少海外菜单结果页的 AI 现生图等待。
- 本批选择：
  - `kra-pao-gai`：泰式打抛鸡。
  - `kua-mee`：泰式干炒米粉。
  - `maki-roll`：日式海苔外包卷寿司。
  - `mee-goreng`：马来/印尼炒面。
  - `mee-krob`：泰式脆米粉。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Kra Pao Gai` 返回 `undefined`。
  - 追加脚本保护断言，要求有 `SPECIAL_BACKFILL_IMAGE_HINTS` 的高风险菜不能被宽泛同名本地图直接复用；旧脚本按预期失败，因为 `mee-goreng` 会被中文别名 `炒面` 截到 `chow-mein`。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/kra-pao-gai.webp`
    - `public/dishes/kua-mee.webp`
    - `public/dishes/maki-roll.webp`
    - `public/dishes/mee-goreng.webp`
    - `public/dishes/mee-krob.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入 4 个强 prompt hint：
    - `kra-pao-gai`：要求打抛鸡肉碎、九层塔/圣罗勒、红辣椒、白饭和煎蛋，禁止咖喱/汤/烤鸡。
    - `maki-roll`：要求海苔在外、6-8 个圆形切段、米饭和馅料截面清楚，禁止加州卷/手卷/龙卷/握寿司。
    - `mee-goreng`：要求马来/印尼黄面、干炒红褐色酱、蛋/豆腐或鸡肉/蔬菜/青柠，禁止汤面/意面/炒粿条/炒饭。
    - `mee-krob`：要求泰式酸甜脆米粉，细脆米粉成窝状或堆状，禁止普通软炒面/汤面/Pad Thai。
  - 回填脚本复用逻辑加保护：`!FORCE && !SPECIAL_BACKFILL_IMAGE_HINTS[entry.id]` 时才允许复用已有本地图，避免高风险菜被宽泛别名错配。
  - `mee-goreng` 首次被复用为 `chow-mein` 后，已用 `--force` 独立重新生成。
- 目检：
  - 联系表：`/tmp/dishlens-backfill-20260805-next5f.png`。
  - 结果：5 张视觉身份可用。`kra-pao-gai` 能看出米饭、打抛鸡和煎蛋；`maki-roll` 为海苔外包切段；`mee-krob` 为脆米粉配虾和青柠；`mee-goreng` 已不再复用普通中式炒面。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：676。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：70.2%。
  - 仍依赖远程/AI：346。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Kra Pao Gai' 'Kua Mee' 'Maki Roll' 'Mee Goreng' 'Mee Krob' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续沿 `scripts/plan-knowledge-image-backfill.mjs --limit=10` 规划补图库，优先选择真实海外菜单高频、菜品身份清晰、且不容易被泛名污染的条目。
  - 对 `generated_local_unstable: 210` 做分批提升或清理，进一步降低线上坏图和跨机器不一致。
  - 识别速度方面仍应继续做 provider/两阶段识别优化；本地图覆盖提升主要改善结果页图片可见速度，不能单独解决首次视觉 OCR 等待。

2026-08-05 高频本地图库第十二批补充：

- 目标：
  - 继续提升真实海外菜单里常见东南亚、日本、韩餐菜品的稳定本地命中率，同时修正 `Spicy Stir-Fried Octopus` 被误配到虾类图片的风险。
- 本批选择：
  - `nakji-bokkeum`：韩式辣炒章鱼。
  - `nam-prik-oong`：泰北番茄猪肉辣椒蘸酱。
  - `nasi-lemak`：马来/新加坡椰浆饭。
  - `negitoro-roll`：葱香金枪鱼卷。
  - `nigiri-assorted`：握寿司拼盘。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，其中 `Spicy Stir-Fried Octopus` 实际命中 `kung-pao-shrimp`，说明泛化文本会导致跨菜系错图。
  - 追加脚本质量断言，要求 `nakji-bokkeum` prompt 包含 `single plate or bowl`，并要求 `nasi-lemak` 明确禁止 `crab/lobster`，避免生成拼图式菜照和错误海鲜主角。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/nakji-bokkeum.webp`
    - `public/dishes/nam-prik-oong.webp`
    - `public/dishes/nasi-lemak.webp`
    - `public/dishes/negitoro-roll.webp`
    - `public/dishes/nigiri-assorted.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入 5 个强 prompt hint：
    - `nakji-bokkeum`：要求单盘/单碗、章鱼触手和吸盘、韩式红辣酱，禁止虾、宫保虾、拼图和多张照片。
    - `nam-prik-oong`：要求红橙色番茄猪肉蘸酱、黄瓜/白菜/长豆/香草/猪皮或蔬菜配盘，禁止咖喱/汤/意面酱。
    - `nasi-lemak`：要求椰浆饭、叁巴、炸江鱼仔、花生、黄瓜和半颗水煮蛋，禁止炒饭/咖喱饭/蟹/龙虾/印尼炒饭。
    - `negitoro-roll`：要求海苔外包切段寿司，粉色碎金枪鱼和葱花截面清楚，禁止加州卷/手卷/握寿司。
    - `nigiri-assorted`：要求多种握寿司，米饭椭圆上覆盖鱼片，禁止寿司卷/纯刺身/单个握寿司。
- 目检：
  - 第一版联系表：`/tmp/dishlens-backfill-20260805-next5g.png`。
  - 重生后联系表：`/tmp/dishlens-backfill-20260805-next5g-v2.png`。
  - 结果：`nakji-bokkeum` 第一版为拼图式多宫格，不合格；`nasi-lemak` 第一版出现螃蟹，不合格。加强 prompt 后两者重生通过：章鱼为单碗红酱章鱼，椰浆饭保留米饭、蛋、叁巴和配菜结构。其余 3 张视觉身份可用。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：681。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：70.6%。
  - 仍依赖远程/AI：341。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Spicy Stir-Fried Octopus' 'Nam Prik Oong' 'Nasi Lemak' 'Scallion Tuna Roll' 'Assorted Nigiri Platter' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续用 planner 补 `or-suan`、`oyster-omelette`、`pad-kra-pao`、`paella-de-marisco`、`pasta-frutti-di-mare` 等高频项；蚝煎类和炒饭类需要特别注意不要互相错配。
  - 继续把每批问题图的“目检发现 -> prompt 约束 -> 强制重生”沉淀成测试，保持图库扩张不会牺牲准确性。

2026-08-05 高频本地图库第十三批与海鲜意面错配修复：

- 目标：
  - 继续补齐海外菜单高频的蚝煎/打抛/海鲜主食类图片，并修复 `Seafood Pasta` 被错误匹配到 `pizza-frutti-di-mare` 的问题。
- 本批选择：
  - `or-suan`：泰式蚝烙。
  - `oyster-omelette`：新加坡/台式蚝煎。
  - `pad-kra-pao`：泰式打抛。
  - `paella-de-marisco`：西班牙海鲜饭。
  - `pasta-frutti-di-mare`：意式海鲜意面。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Or Suan` 返回 `undefined`。
  - 诊断发现 `Seafood Pasta` 旧实现会命中 `pizza-frutti-di-mare`，原因是海鲜意面仍是远程图，而海鲜披萨已经是本地图，模糊匹配把 pasta 拉向了 pizza。
  - 追加脚本断言，要求本批 5 道菜都有强 prompt hint，特别要求 `pasta-frutti-di-mare` 明确禁止 `pizza`。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/or-suan.webp`
    - `public/dishes/oyster-omelette.webp`
    - `public/dishes/pad-kra-pao.webp`
    - `public/dishes/paella-de-marisco.webp`
    - `public/dishes/pasta-frutti-di-mare.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入 5 个强 prompt hint：
    - `or-suan`：要求泰式脆边蚝烙、蚝肉、蛋和淀粉质地、豆芽/香菜/辣椒酱，禁止普通蛋饼/韩式海鲜饼/汤。
    - `oyster-omelette`：要求新加坡或台式蚝煎、蚝肉、软蛋、透明地瓜粉感、红辣椒酱，禁止泰式蚝煎/韩式饼/披萨。
    - `pad-kra-pao`：要求打抛碎肉、白饭、煎蛋、圣罗勒/九层塔和辣椒，禁止咖喱/炒饭/汤。
    - `paella-de-marisco`：要求浅平锅、西班牙藏红花黄米、虾/青口/鱿鱼/蛤蜊/柠檬，禁止烩饭/炒饭/海鲜意面。
    - `pasta-frutti-di-mare`：要求长意面或扁意面、贝类/虾/鱿鱼/欧芹/橄榄油或轻番茄酱，禁止披萨/海鲜饭/烩饭/汤面。
- 目检：
  - 联系表：`/tmp/dishlens-backfill-20260805-next5h.png`。
  - 结果：5 张视觉身份可用。`Seafood Pasta` 已明确为海鲜意面而不是海鲜披萨；`paella` 为浅锅黄米海鲜饭；`pad-kra-pao` 有米饭和煎蛋；两张蚝类菜虽形态接近，但都能看出蚝煎/蚝烙，不是普通蛋饼。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：686。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：71.1%。
  - 仍依赖远程/AI：336。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Or Suan' 'Oyster Omelette' 'Pad Kra Pao' 'Seafood Paella' 'Seafood Pasta' --json`：5 个均为 `local_knowledge`，其中 `Seafood Pasta` 命中 `pasta-frutti-di-mare`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补 planner 后续高频项，优先处理 `pickled-herring`、`pulpo-a-la-gallega`、`quesadilla`、`seafood-risotto`、`shawarma` 等可清晰区分的菜。
  - 对海鲜饭/海鲜意面/海鲜披萨/海鲜烩饭这组继续加交叉断言，防止本地图增长后再次因近义词错配。

2026-08-05 高频本地图库第十四批与海鲜烩饭组保护：

- 目标：
  - 继续补齐海外菜单高频冷盘、章鱼、意面和 risotto 类图片，并把海鲜饭/海鲜意面/海鲜烩饭/墨鱼汁烩饭的视觉边界继续固化。
- 本批选择：
  - `pickled-herring`：斯堪的纳维亚腌鲱鱼。
  - `pulpo-a-la-gallega`：西班牙加利西亚章鱼。
  - `puttanesca`：意式 Puttanesca 意面。
  - `risotto-ai-frutti-di-mare`：海鲜烩饭。
  - `risotto-al-nero-di-seppia`：墨鱼汁烩饭。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Pickled Herring` 返回 `undefined`。
  - 追加脚本断言，要求 5 个新条目都有强 prompt hint；其中 risotto 类要求明确禁止 paella/pasta/fried rice/pizza 等近邻品类。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/pickled-herring.webp`
    - `public/dishes/pulpo-a-la-gallega.webp`
    - `public/dishes/puttanesca.webp`
    - `public/dishes/risotto-ai-frutti-di-mare.webp`
    - `public/dishes/risotto-al-nero-di-seppia.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入 5 个强 prompt hint：
    - `pickled-herring`：要求冷盘鲱鱼片、洋葱圈、莳萝、土豆或黑麦面包，禁止炸鱼/烤三文鱼/罐头沙丁鱼。
    - `pulpo-a-la-gallega`：要求章鱼触手切片、土豆、烟熏红椒粉、橄榄油和粗盐，禁止章鱼小丸子/鱿鱼圈/章鱼意面。
    - `puttanesca`：要求红番茄酱长意面、黑橄榄、酸豆、凤尾鱼和欧芹，禁止披萨/海鲜意面/烩饭。
    - `risotto-ai-frutti-di-mare`：要求奶油短粒米质地、虾/青口/蛤蜊/鱿鱼和欧芹，禁止海鲜饭/海鲜意面/炒饭/披萨。
    - `risotto-al-nero-di-seppia`：要求黑色奶油短粒米和鱿鱼/墨鱼块，禁止黑意面/海鲜饭/汤/寿司。
- 目检：
  - 联系表：`/tmp/dishlens-backfill-20260805-next5i.png`。
  - 结果：5 张视觉身份可用。腌鲱鱼为冷盘，Galician Octopus 为章鱼切片配土豆，Puttanesca 为红酱长意面，海鲜烩饭和墨鱼汁烩饭均保持 risotto 米饭形态，没有混成 paella 或 pasta。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：691。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：71.6%。
  - 仍依赖远程/AI：331。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Pickled Herring' 'Galician Octopus' 'Puttanesca Pasta' 'Seafood Risotto' 'Squid Ink Risotto' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补 planner 后续高频项，可优先处理 `norwegian-salmon`、`pla-rad-prik`、`prawn-masala`、`rainbow-roll`、`risotto-ai-gamberi`。
  - 对 “seafood paella / seafood pasta / seafood risotto / squid ink risotto / seafood pizza” 建议继续保留同组回归断言，作为图库增长后的错配哨兵。

2026-08-05 高频本地图库第十五批补充：

- 目标：
  - 继续把海外菜单高频海鲜、寿司与 risotto 类菜品前移到稳定本地图库，减少首次结果页的 AI 现生图等待，并降低远程临时图片失效风险。
- 本批选择：
  - `norwegian-salmon`：挪威三文鱼。
  - `pla-rad-prik`：泰式辣椒鱼。
  - `prawn-masala`：印度玛萨拉虾咖喱。
  - `rainbow-roll`：日式彩虹卷。
  - `risotto-ai-gamberi`：意式虾仁烩饭。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个本地命中断言。
  - 旧实现按预期失败，首个失败为 `Norwegian Salmon` 返回 `undefined`，说明这些高频菜仍会走远程图或 AI 生图。
  - 在 `Wan knowledge image backfill` 脚本测试中加入 5 个强 prompt hint 断言，避免生成时被拉向相邻品类。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/norwegian-salmon.webp`
    - `public/dishes/pla-rad-prik.webp`
    - `public/dishes/prawn-masala.webp`
    - `public/dishes/rainbow-roll.webp`
    - `public/dishes/risotto-ai-gamberi.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入 5 个强 prompt hint：
    - `norwegian-salmon`：要求厚切粉橙色三文鱼鱼柳、柠檬、莳萝和简单蔬菜，禁止寿司/刺身/烟熏片/整鱼。
    - `pla-rad-prik`：要求整条酥炸鱼、头尾可见、红色泰式甜辣酱，禁止咖喱鱼/鱼片/鱼汤。
    - `prawn-masala`：要求橙红色玛萨拉咖喱汁中的整只虾，搭配香菜、米饭或 naan，禁止烤虾/泰式咖喱/虾意面。
    - `rainbow-roll`：要求 6-8 个 inside-out 卷寿司切段，外侧/顶部有彩色鱼片或牛油果覆盖，禁止握寿司/刺身/普通 maki。
    - `risotto-ai-gamberi`：要求奶油短粒米和粉色大虾，禁止 paella、虾意面、炒饭、咖喱饭或汤。
- 目检：
  - 第一版联系表：`/tmp/dishlens-backfill-20260805-next5j.png`。
  - 彩虹卷第一版被生成成握寿司拼盘，不合格；第二版不再是握寿司，但偏普通卷寿司；第三版联系表：`/tmp/dishlens-backfill-20260805-next5j-v3.png`。
  - 第三版彩虹卷已能表现切段卷寿司和彩色顶部，不再是握寿司/刺身。其余 4 张视觉身份清楚：三文鱼为鱼柳、泰式辣椒鱼为整鱼红酱、虾玛萨拉为咖喱虾、虾仁烩饭为奶油米饭配虾。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：696。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：72.1%。
  - 仍依赖远程/AI：326。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Norwegian Salmon' 'Pla Rad Prik' 'Spicy Prawn Curry' 'Rainbow Roll' 'Shrimp Risotto' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 距离 90% 稳定本地覆盖仍约差 188 张稳定图片，建议继续用每批 5-10 张的节奏补图，并保留人工联系表目检。
  - 优先处理 `generated_local_unstable: 210` 的提升/清理，避免分享页或换机器部署时出现本地生成图失效。
  - 对 sushi 组继续加强错配哨兵：`rainbow-roll`、`maki-roll`、`negitoro-roll`、`nigiri-assorted` 不应互相泛化。

2026-08-05 高频本地图库第十六批补充与海外罗马字别名修复：

- 目标：
  - 继续提升海外常见菜单的本地图命中率，优先处理东南亚、北欧、意式和日式街头小吃中常见、形态清晰的条目。
  - 修复无重音拼写和罗马字菜名导致的“本地图已存在但仍显示 pending”的问题。
- 本批选择：
  - `mie-goreng-indonesian`：印尼炒面。
  - `nasi-goreng-indonesian`：印尼炒饭。
  - `smorrebrod`：丹麦开放式三明治。
  - `spaghetti-alle-vongole`：蛤蜊意面。
  - `takoyaki`：章鱼烧。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Mie Goreng' 'Nasi Goreng' 'Smorrebrod' 'Clam Pasta' 'Takoyaki' --json` 旧实现 5 个均为 `ai_pending`。
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个断言；旧实现先失败于 `Mie Goreng -> undefined`。
  - 在 `Wan knowledge image backfill` 脚本测试中新增 5 个强 prompt hint 断言；旧脚本按预期缺 `mie-goreng-indonesian` 等提示词。
  - 生成图片后发现 `Smorrebrod` 和 `Takoyaki` 仍无法命中，原因是 `Smørrebrød` 的 `ø` 没被归一化，`Takoyaki` 也缺常见罗马字别名；诊断脚本同样误报 pending。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/mie-goreng-indonesian.webp`
    - `public/dishes/nasi-goreng-indonesian.webp`
    - `public/dishes/smorrebrod.webp`
    - `public/dishes/spaghetti-alle-vongole.webp`
    - `public/dishes/takoyaki.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入 5 个强 prompt hint：
    - `mie-goreng-indonesian`：要求印尼干炒黄面、甜酱油/辣椒酱、蛋/鸡肉或虾/蔬菜/青柠，禁止汤面、意面、Pad Thai、炒粿条、炒饭。
    - `nasi-goreng-indonesian`：要求深色甜酱油炒饭、煎蛋、黄瓜、番茄、虾片和炸葱，禁止 biryani、白饭、咖喱饭、paella、nasi lemak、浅色中式炒饭。
    - `smorrebrod`：要求至少三片可见矩形黑麦面包底的开放式三明治，禁止碗、沙拉、闭合三明治、汉堡、bruschetta。
    - `spaghetti-alle-vongole`：要求长意面和大量开壳蛤蜊、蒜香白酒橄榄油风格，禁止青口、海鲜烩饭、海鲜饭、蛤蜊浓汤。
    - `takoyaki`：要求圆形章鱼烧、木鱼花、海苔粉、美乃滋线、照烧酱和签子，禁止寿司、肉丸、arancini、甜甜圈球、章鱼切片。
  - `src/lib/dish-image-match.ts` 增强字符归一化：`ø/Ø -> o`、`œ/Œ -> oe`、`æ/Æ -> ae`；新增 `smorrebrod` 与 `takoyaki` 直接别名。
  - `scripts/diagnose-dish-images.mjs` 同步同样归一化和直接别名，保持诊断层与生产匹配层一致。
- 目检：
  - 第一版联系表：`/tmp/dishlens-backfill-20260805-next5k.png`。
  - `smorrebrod` 第一版像冷菜/沙拉，不够像开放式黑麦面包；加强 prompt 后重生。
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next5k-v2.png`。
  - 结果：`smorrebrod` 第二版已能看到多片开放式黑麦面包；`mie-goreng` 为炒面、`nasi-goreng` 为带煎蛋炒饭、`spaghetti alle vongole` 为蛤蜊长意面、`takoyaki` 为章鱼烧，视觉身份可用。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：701。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：72.6%。
  - 仍依赖远程/AI：321。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Mie Goreng' 'Nasi Goreng' 'Smorrebrod' 'Clam Pasta' 'Takoyaki' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "diagnostics mirrors|common short menu names|Wan knowledge image backfill"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补 planner 后续项，但应避免一次性选择太多相近寿司/握寿司，防止 prompt 与匹配测试互相污染。
  - 建议优先补 `sashimi`、`sashimi-platter`、`spicy-tuna-roll`、`sushi-nigiri-*` 时使用更细的同组互斥测试，明确“刺身 / 握寿司 / 卷寿司 / 拼盘”的边界。
  - 继续推进 `generated_local_unstable: 210` 的 Supabase 同步或本地提升，解决分享页和部署环境中的图片失效问题。

2026-08-05 高频本地图库第十七批补充与日料边界保护：

- 目标：
  - 处理海外日料菜单中高频且容易互相错配的条目：刺身、刺身拼盘、卷寿司、握寿司、日式鱼形甜点。
  - 降低 `Sashimi` 被错配到 `fugu-sashimi`、`Taiyaki` 走 pending 或被韩式 `bungeoppang` 顶替的风险。
- 本批选择：
  - `sashimi`：刺身。
  - `sashimi-platter`：刺身拼盘。
  - `spicy-tuna-roll`：辣金枪鱼卷。
  - `sushi-nigiri-salmon`：三文鱼握寿司。
  - `taiyaki`：日式鲷鱼烧。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Sashimi' 'Sashimi Platter' 'Spicy Tuna Roll' 'Salmon Nigiri Sushi' 'Fish-Shaped Pastry' --json` 旧实现中前 4 个为 `ai_pending`，`Fish-Shaped Pastry` 错命中 `bungeoppang`。
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 5 个断言；旧实现先失败于 `Sashimi -> fugu-sashimi`。
  - 在 `Wan knowledge image backfill` 脚本测试中新增 5 个强 prompt hint 断言；旧脚本缺通用刺身、拼盘、辣金枪鱼卷、三文鱼握寿司和鲷鱼烧提示词。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/sashimi.webp`
    - `public/dishes/sashimi-platter.webp`
    - `public/dishes/spicy-tuna-roll.webp`
    - `public/dishes/sushi-nigiri-salmon.webp`
    - `public/dishes/taiyaki.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加入 5 个强 prompt hint：
    - `sashimi`：要求无米饭的生鱼片、三文鱼/金枪鱼/白身鱼、紫苏/萝卜丝/芥末/酱油，禁止握寿司、卷寿司、河豚菊花摆盘和 poke。
    - `sashimi-platter`：要求大份多品种无米饭刺身拼盘，禁止握寿司、卷寿司、poke、海鲜沙拉和单一河豚薄片。
    - `spicy-tuna-roll`：要求 6-8 个切段寿司卷、红色碎金枪鱼馅、辣味美乃滋或辣椒点缀，禁止握寿司、刺身、彩虹卷、金枪鱼牛排。
    - `sushi-nigiri-salmon`：要求椭圆饭团上覆盖橙色三文鱼片，禁止无米饭刺身、卷寿司、烤三文鱼或烟熏三文鱼吐司。
    - `taiyaki`：要求金黄鱼形华夫点心，可露出红豆/卡仕达馅，禁止真鱼、章鱼烧、普通华夫和韩式 bungeoppang 纸袋场景。
  - `src/lib/dish-image-match.ts` 新增 `taiyaki` 罗马字别名，确保用户菜单直接写 `Taiyaki` 时命中本地图。
  - `scripts/diagnose-dish-images.mjs` 同步 `taiyaki` 别名；诊断镜像测试加入 `Taiyaki`，避免产品和诊断结果分叉。
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next5l.png`。
  - 结果：`sashimi` 与 `sashimi-platter` 都无米饭；`spicy-tuna-roll` 为切段卷寿司；`sushi-nigiri-salmon` 清楚显示米饭上覆三文鱼；`taiyaki` 为鱼形甜点，不再复用韩式图。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：706。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：73.1%。
  - 仍依赖远程/AI：316。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Sashimi' 'Sashimi Platter' 'Spicy Tuna Roll' 'Salmon Nigiri Sushi' 'Taiyaki' 'Fish-Shaped Pastry' --json`：6 个均为 `local_knowledge`，其中 `Taiyaki` 和 `Fish-Shaped Pastry` 均命中 `taiyaki`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "diagnostics mirrors|common short menu names|Wan knowledge image backfill"`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补日料组时建议做同组断言：`sashimi`、`sashimi-platter`、`nigiri-assorted`、`sushi-nigiri-*`、`maki-roll`、`spicy-tuna-roll`、`rainbow-roll` 应保持互不误配。
  - 可继续补 `sushi-nigiri-tuna`、`sushi-nigiri-shrimp`、`sushi-nigiri-eel`、`tempura-shrimp`、`yakisoba` 等 planner 高优先级条目。
  - 识别速度层面仍建议并行推进 provider A/B 与首屏粗结果策略；本地图主要解决图片等待和稳定性，不能单独消除首次 OCR 模型 15-25 秒波动。

2026-08-05 高频本地图库第十八批补充与握寿司/天妇罗收口：

- 目标：
  - 继续收口日料菜单中高频、形态相近、容易互相混淆的条目。
  - 将金枪鱼握寿司、虾握寿司、鳗鱼握寿司、章鱼握寿司、炸虾天妇罗从 `ai_pending` 提升到稳定本地知识图库，减少列表/详情页等待与重复 AI 生图。
- 本批选择：
  - `sushi-nigiri-tuna`：金枪鱼握寿司。
  - `sushi-nigiri-shrimp`：虾握寿司。
  - `sushi-nigiri-eel`：鳗鱼握寿司。
  - `sushi-nigiri-octopus`：章鱼握寿司。
  - `tempura-shrimp`：炸虾天妇罗。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Tuna Nigiri Sushi' 'Shrimp Nigiri Sushi' 'Eel Nigiri Sushi' 'Octopus Nigiri Sushi' 'Shrimp Tempura' --json` 旧实现 5 个均为 `ai_pending`。
  - `common short menu names resolve to prebuilt local dish images` 已新增 5 个断言；旧实现按预期失败于 `Tuna Nigiri Sushi -> undefined`。
  - `Wan knowledge image backfill` 脚本测试已锁定 5 个强 prompt hint，要求握寿司必须有米饭，炸虾天妇罗不能被生成成寿司。
- GREEN：
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/sushi-nigiri-tuna.webp`
    - `public/dishes/sushi-nigiri-shrimp.webp`
    - `public/dishes/sushi-nigiri-eel.webp`
    - `public/dishes/sushi-nigiri-octopus.webp`
    - `public/dishes/tempura-shrimp.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - 生成命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=sushi-nigiri-tuna,sushi-nigiri-shrimp,sushi-nigiri-eel,sushi-nigiri-octopus,tempura-shrimp --apply --item-timeout-ms=120000 --delay-ms=800`
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next5m.png`。
  - 结果：金枪鱼、虾、鳗鱼、章鱼均清楚显示为米饭上覆食材的握寿司，没有被生成成刺身、卷寿司或饭碗；炸虾天妇罗为长条炸虾，可用于菜单列表和详情页。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：711。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：73.6%。
  - 仍依赖远程/AI：311。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Tuna Nigiri Sushi' 'Shrimp Nigiri Sushi' 'Eel Nigiri Sushi' 'Octopus Nigiri Sushi' 'Shrimp Tempura' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续补剩余 `pollinations_remote: 311`，建议优先从 planner 中高频且视觉边界清楚的项开始，每批 5-10 张。
  - 对 `generated_local_unstable: 210` 做提升/清理和 Supabase 同步验证，减少分享页、生产部署和跨机器访问中的图片失效。
  - 日料组后续可继续补 `nigiri-assorted`、`maki-roll`、`yakisoba` 等，但仍要保留“刺身 / 握寿司 / 卷寿司 / 天妇罗 / 饭碗”的互斥目检。

2026-08-05 高频本地图库第十九批补充与海外常见菜边界保护：

- 目标：
  - 继续减少海外菜单结果页的 AI 生图排队，优先选择视觉边界清楚、常见于意大利/东南亚/北欧/印度菜单的缺图菜。
  - 避开 `nasi-goreng-sg` 与已补 `nasi-goreng-indonesian` 的语义重叠，降低重复图和错配风险。
- 本批选择：
  - `polpo-alla-lucchese`：卢卡风格章鱼。
  - `rojak`：新马 Rojak 沙拉。
  - `smorgasbord`：北欧自助拼盘。
  - `spaghetti-alle-cozze`：青口贝意面。
  - `tandoori-prawns`：坦都里烤虾。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Polpo alla Lucchese' 'Rojak' 'Smorgasbord' 'Mussel Spaghetti' 'Tandoori Prawns' --json` 旧实现 5 个均为 `ai_pending`。
  - `common short menu names resolve to prebuilt local dish images` 新增 5 个断言；旧实现按预期失败于 `Polpo alla Lucchese -> undefined`。
  - `Wan knowledge image backfill` 脚本测试新增 5 个强 prompt hint 断言；旧脚本缺 `polpo-alla-lucchese` 等提示词。
- GREEN：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增 5 个强 prompt hint：
    - `polpo-alla-lucchese`：要求可见章鱼触手吸盘、番茄/橄榄/酸豆/香草，禁止寿司、章鱼烧、鱿鱼圈、海鲜意面和无章鱼红炖菜。
    - `rojak`：要求黑亮虾酱、花生、黄瓜、菠萝、沙葛/萝卜、豆芽、豆卜/油条，禁止西式绿沙拉、水果酸奶沙拉、青木瓜沙拉、poke、咖喱或面条。
    - `smorgasbord`：要求北欧冷拼式多品种拼盘，包含腌鲱鱼、三文鱼、黑麦面包、奶酪、冷切、土豆、莳萝和小碗，禁止单一三明治或普通熟食拼盘。
    - `spaghetti-alle-cozze`：要求长意面和大量开壳青口贝，禁止 vongole 蛤蜊意面、海鲜饭、海鲜烩饭、青口汤或无贝壳泛海鲜意面。
    - `tandoori-prawns`：要求红橙色坦都里香料腌烤大虾、柠檬、洋葱、薄荷酱和烤痕，禁止咖喱虾、天妇罗、寿司、面条或普通烤虾。
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/polpo-alla-lucchese.webp`
    - `public/dishes/rojak.webp`
    - `public/dishes/smorgasbord.webp`
    - `public/dishes/spaghetti-alle-cozze.webp`
    - `public/dishes/tandoori-prawns.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - 生成命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=polpo-alla-lucchese,rojak,smorgasbord,spaghetti-alle-cozze,tandoori-prawns --apply --item-timeout-ms=120000 --delay-ms=800`
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next5n.png`。
  - 结果：`polpo` 的章鱼触手清晰；`rojak` 可见切蔬果、黑色酱料和花生质感；`smorgasbord` 是多品类北欧冷拼；`spaghetti alle cozze` 显示长意面和开壳青口；`tandoori prawns` 有红橙香料色、柠檬和洋葱配菜，可接受。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：716。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：74.1%。
  - 仍依赖远程/AI：306。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Polpo alla Lucchese' 'Rojak' 'Smorgasbord' 'Mussel Spaghetti' 'Tandoori Prawns' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 planner 的 `pollinations_remote: 306` 中补图，建议优先处理 `tteokbokki`、`yakisoba`、`yam-pla-muk`、`tempeh-indonesian`、`aebleskiver` 等视觉边界相对明确的项。
  - 对同名/近义条目要谨慎：例如 `nasi-goreng-sg` 与 `nasi-goreng-indonesian`、`baklava-me` 与 `baklava-turkish`，更适合先做去重或 alias 策略再决定是否各自生成。

2026-08-05 高频本地图库第二十批补充与生成超时观察：

- 目标：
  - 继续推进本地图库覆盖率，减少海外菜单列表/详情页对实时 AI 生图的依赖。
  - 将上一批建议的 5 个高频候选从 `ai_pending` 提升为稳定本地知识图。
- 本批选择：
  - `tteokbokki`：韩式辣炒年糕。
  - `yakisoba`：日式炒面。
  - `yam-pla-muk`：泰式鱿鱼沙拉。
  - `tempeh-indonesian`：印尼天贝。
  - `aebleskiver`：丹麦松饼球。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Tteokbokki' 'Yakisoba' 'Yam Pla Muk' 'Tempeh' 'Aebleskiver' --json` 旧状态 5 个均为 `ai_pending`。
  - `common short menu names resolve to prebuilt local dish images` 新增 5 个断言；旧实现按预期失败于 `Tteokbokki -> undefined`。
  - `Wan knowledge image backfill` 脚本测试新增 5 个强 prompt hint 断言，并额外要求 `tempeh-indonesian` 包含 `whole soybeans` 约束，避免生成成光滑豆腐或 paneer。
- GREEN：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增/强化 5 个 prompt hint：
    - `tteokbokki`：要求红色 gochujang 酱、圆柱年糕、鱼饼、葱、芝麻/水煮蛋，禁止年糕汤、意面、gnocchi、咖喱、面条、寿司或白年糕。
    - `yakisoba`：要求干炒小麦面、棕色炒面酱、卷心菜/胡萝卜/豆芽/肉或海鲜，禁止拉面汤、荞麦汤面、意面、pad thai、普通炒饭。
    - `yam-pla-muk`：要求白色鱿鱼圈和触手、青柠、辣椒、红洋葱、芹菜、薄荷/香菜，禁止炸鱿鱼圈、整只烤鱿鱼、海鲜意面或没有鱿鱼的青木瓜沙拉。
    - `tempeh-indonesian`：要求切面能看见整粒黄豆的马赛克纹理，禁止 tofu、paneer、鸡块、土豆、falafel 或普通蔬菜炒物。
    - `aebleskiver`：要求圆形金黄色松饼球、糖粉和果酱/莓果蘸酱，禁止肉丸、章鱼烧、甜甜圈洞、华夫饼或咸味炸球。
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/tteokbokki.webp`
    - `public/dishes/yakisoba.webp`
    - `public/dishes/yam-pla-muk.webp`
    - `public/dishes/tempeh-indonesian.webp`
    - `public/dishes/aebleskiver.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - 生成命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=tteokbokki,yakisoba,yam-pla-muk,tempeh-indonesian,aebleskiver --apply --item-timeout-ms=120000 --delay-ms=800`
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next5o.png`。
  - 结果：`tteokbokki` 为红酱年糕；`yakisoba` 为干炒面；`yam-pla-muk` 可见鱿鱼和泰式凉拌元素；`aebleskiver` 为圆形甜点球配糖粉/果酱；`tempeh-indonesian` 第一版可用但黄豆纹理仍可继续提高。
  - 曾尝试对 `tempeh-indonesian` 用更强 whole-soybean prompt 强制重生成，但 Wan 单张超过 120s 超时失败；原已生成文件保留。该现象再次证明实时生图不应阻塞用户查看菜单，应继续优先本地化、缓存和后台补图。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：721。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：74.6%。
  - 仍依赖远程/AI：301。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Tteokbokki' 'Yakisoba' 'Yam Pla Muk' 'Tempeh' 'Aebleskiver' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 `pollinations_remote: 301` 中按 planner 每批 5-10 张补图，优先补视觉边界清楚、高频、能减少大菜单等待的条目。
  - 对 `generated_local_unstable: 210` 做质量筛选、提升入稳定索引，并同步 Supabase/线上静态资源，减少分享页和跨设备图片失效。
  - 对单张 Wan 生成超过 60-120s 的情况继续记录，产品策略上保持“先展示文字和推荐，图片后台渐进补齐”。

2026-08-05 高频本地图库第二十一批补充与海外菜单继续收口：

- 目标：
  - 继续减少结果页实时 AI 生图等待，优先补 planner 中高分且视觉边界清楚的海外菜单菜品。
  - 避开 `nasi-goreng-sg` 与已补 `nasi-goreng-indonesian` 的语义重复，避免制造重复图和错配。
- 本批选择：
  - `rakfisk`：挪威发酵鱼。
  - `albondigas-espanolas`：西班牙肉丸。
  - `anmitsu`：日式馅蜜。
  - `baghrir`：摩洛哥千孔煎饼。
  - `bebek-bengil`：巴厘岛/印尼脆皮鸭。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Rakfisk' 'Spanish Meatballs' 'Anmitsu' 'Baghrir' 'Crispy Duck' --json` 旧状态 5 个均为 `ai_pending`。
  - `common short menu names resolve to prebuilt local dish images` 新增 5 个断言；旧实现按预期失败于 `Rakfisk -> undefined`。
  - `Wan knowledge image backfill` 脚本测试新增 5 个 prompt hint 断言；旧脚本缺 `rakfisk` 等提示词。
- GREEN：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增 5 个强 prompt hint：
    - `rakfisk`：冷食发酵鳟鱼/白鱼片、flatbread/lefse、酸奶油、红洋葱、土豆、莳萝，禁止熟三文鱼排、寿司、刺身拼盘、腌鲱鱼或普通烟熏鱼。
    - `albondigas-espanolas`：西班牙 tapas 风格番茄酱肉丸，禁止意面肉丸、瑞典奶油肉丸、kofta 或无酱普通肉丸。
    - `anmitsu`：寒天冻、红豆、白玉团子、水果、黑糖蜜的日式甜品碗，禁止刨冰、奶茶、纯水果沙拉、西式布丁、单独麻薯或红豆汤。
    - `baghrir`：表面大量小孔的摩洛哥 semolina 煎饼，蜂蜜黄油、薄荷茶语境，禁止美式松饼、可丽饼、naan、injera、华夫饼或无孔 flatbread。
    - `bebek-bengil`：巴厘岛脆皮鸭，金黄酥皮、鸭腿/半鸭形态、sambal、米饭、黄瓜和印尼配菜，禁止北京烤鸭卷饼、油封鸭、烤鸡、炸鸡、咖喱鸭或鸭汤面。
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步新增 `anmitsu` alias；知识库英文名是 `Red Bean Jelly Dessert`，真实菜单常直接写 `Anmitsu`，不补 alias 会继续漏匹配。
  - 使用 Wan 生成并写入 5 张 webp：
    - `public/dishes/rakfisk.webp`
    - `public/dishes/albondigas-espanolas.webp`
    - `public/dishes/anmitsu.webp`
    - `public/dishes/baghrir.webp`
    - `public/dishes/bebek-bengil.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - 生成命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=rakfisk,albondigas-espanolas,anmitsu,baghrir,bebek-bengil --apply --item-timeout-ms=120000 --delay-ms=800`
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next5p.png`。
  - 结果：`rakfisk` 是冷食白鱼片并有北欧配菜语境；`albondigas` 是番茄酱肉丸；`anmitsu` 有红豆/白玉/水果/寒天甜品碗特征；`baghrir` 千孔结构清楚；`bebek-bengil` 是带印尼配菜的脆皮鸭腿，可接受。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：726。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：75.0%。
  - 仍依赖远程/AI：296。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Rakfisk' 'Spanish Meatballs' 'Anmitsu' 'Baghrir' 'Crispy Duck' --json`：5 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 `pollinations_remote: 296` 中补图，每批仍建议 5-10 张，优先跳过高度重复条目，先做 alias/去重再生成。
  - 建议下一批候选可从 planner 继续选择 `bibim-guksu`、`bibim-naengmyeon`、`bingsu`、`bo-luc-lac`、`bruschetta-al-pomodoro`、`bulgogi` 等视觉边界相对清楚且海外高频的菜。
  - 图片系统总体仍未完成：距离 90% 稳定本地覆盖还需继续补约 150 张左右，并处理 `generated_local_unstable: 210` 的质量筛选与持久化同步。

2026-08-05 高频本地图库第二十二批补充与韩餐/越南/意式高频菜收口：

- 目标：
  - 继续提升结果页图片首屏速度，减少海外常见菜单对实时 AI 生图的依赖。
  - 优先补韩国、越南、意大利餐厅高频菜，并将 `Bruschetta` 从运行时 unstable 图提升为稳定本地知识图。
- 本批选择：
  - `bibim-guksu`：韩式拌面。
  - `bibim-naengmyeon`：韩式拌冷面。
  - `bingsu`：韩式刨冰。
  - `bo-luc-lac`：越式摇摇牛肉。
  - `bruschetta-al-pomodoro`：番茄烤面包。
  - `bulgogi`：韩式烤肉。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Bibim Guksu' 'Bibim Naengmyeon' 'Bingsu' 'Bo Luc Lac' 'Bruschetta' 'Bulgogi' --json` 旧状态中 5 个为 `ai_pending`，`Bruschetta` 为 `generated_local_unstable`，不适合线上/分享页稳定复用。
  - `common short menu names resolve to prebuilt local dish images` 新增 6 个断言；旧实现按预期失败于 `Bibim Guksu -> undefined`。
  - `Wan knowledge image backfill` 脚本测试新增 6 个 prompt hint 断言；旧脚本缺这些高频菜的生成约束。
- GREEN：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增 6 个强 prompt hint：
    - `bibim-guksu`：细面、红色 gochujang 拌酱、黄瓜、芝麻、水煮蛋和蔬菜，禁止汤面、冷面汤、拉面、意面、pad thai 或普通炒面。
    - `bibim-naengmyeon`：深色荞麦冷面、红辣酱、黄瓜、韩梨、水煮蛋、不锈钢/冷面碗语境，禁止汤面、bibim guksu 小麦面、拉面、蘸面或炒面。
    - `bingsu`：细腻雪花冰、红豆、水果、麻薯、炼乳，禁止纯冰淇淋球、奶茶、smoothie、西式 parfait 或普通碎冰。
    - `bo-luc-lac`：焦边牛肉块、洋葱、彩椒、番茄、水田芥/生菜、青柠胡椒盐，禁止牛肉炖菜、牛排片、烤串、bulgogi、咖喱牛肉或普通牛肉丝炒菜。
    - `bruschetta-al-pomodoro`：烤面包、番茄丁、罗勒、大蒜、橄榄油，禁止披萨、无面包 caprese、普通 toast、奶酪 crostini、蒜蓉面包或三明治。
    - `bulgogi`：薄片腌烤牛肉、焦糖化酱汁、洋葱、葱、芝麻、米饭/生菜配菜，禁止 bo luc lac 牛肉块、牛排、烤串、牛肉炖菜或普通炒牛肉。
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步新增常见罗马字/英文/中文/韩文 alias：
    - `bibim guksu`、`bibim naengmyeon`、`bingsu/patbingsu`、`bo luc lac`、`bruschetta`、`bulgogi`。
  - 使用 Wan 生成并写入 6 张 webp：
    - `public/dishes/bibim-guksu.webp`
    - `public/dishes/bibim-naengmyeon.webp`
    - `public/dishes/bingsu.webp`
    - `public/dishes/bo-luc-lac.webp`
    - `public/dishes/bruschetta-al-pomodoro.webp`
    - `public/dishes/bulgogi.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - 生成命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=bibim-guksu,bibim-naengmyeon,bingsu,bo-luc-lac,bruschetta-al-pomodoro,bulgogi --apply --item-timeout-ms=120000 --delay-ms=800`
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next6q.png`。
  - 结果：`bibim-guksu` 和 `bibim-naengmyeon` 均为红酱冷拌面风格，后者更像冷面碗；`bingsu` 雪花冰特征清楚；`bo-luc-lac` 为牛肉块；`bruschetta` 为番茄罗勒烤面包；`bulgogi` 为薄片酱烤牛肉配饭，可接受。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：732。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：75.6%。
  - 仍依赖远程/AI：290。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Bibim Guksu' 'Bibim Naengmyeon' 'Bingsu' 'Bo Luc Lac' 'Bruschetta' 'Bulgogi' --json`：6 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 `pollinations_remote: 290` 中补图，建议继续跳过明显重复项，优先补 `cao-lau`、`cassata-siciliana`、`chebakia`、`chendol`、`chicken-korma`、`chiles-en-nogada`、`churros-con-chocolate` 等视觉边界较清楚的海外高频菜。
  - 对 `generated_local_unstable: 210` 应单独做一轮“质量筛选与提升”，把已生成但可用的图片转入稳定本地/Storage，减少重复 AI 生图和分享页图片失效。

2026-08-05 高频本地图库第二十三批补充与多菜系视觉边界收口：

- 目标：
  - 继续把海外高频菜单图从远程/AI 依赖提升为稳定本地知识图，减少用户在结果页和详情页等待图片。
  - 选择视觉识别点强、跨菜系且低重复的候选，避免继续生成 `baklava`、`nasi-goreng` 等已有相近资产的重复图。
- 本批选择：
  - `cao-lau`：越南会安高楼面。
  - `cassata-siciliana`：西西里卡萨塔蛋糕。
  - `chebakia`：摩洛哥花形蜂蜜饼干。
  - `chendol`：东南亚煎蕊/珍多冰。
  - `chicken-korma`：印度奶油鸡咖喱。
  - `chiles-en-nogada`：墨西哥核桃酱酿辣椒。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Cao Lau' 'Sicilian Cassata' 'Chebakia' 'Cendol' 'Chicken Korma' 'Chiles en Nogada' --json` 旧状态 6 个均为 `ai_pending`。
  - `common short menu names resolve to prebuilt local dish images` 新增 6 个断言；旧实现按预期失败于 `Cao Lau -> undefined`。
  - `Wan knowledge image backfill` 脚本测试新增 6 个 prompt hint 断言；旧脚本缺 `cao-lau` 等提示词。
- GREEN：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增 6 个强 prompt hint：
    - `cao-lau`：厚实有嚼劲面条、叉烧风格猪肉、香草、豆芽、脆米饼、少量酱汁，禁止 pho、ramen、bun bo hue、普通炒面或汤面。
    - `cassata-siciliana`：绿色 marzipan、ricotta sponge cake、蜜饯水果、icing、切面/整蛋糕层次，禁止 gelato、cheesecake、tiramisu、fruit tart 或 panna cotta。
    - `chebakia`：花形/扭结油炸芝麻饼干、蜂蜜糖浆和芝麻，禁止 churros、baklava、doughnuts、pretzels 或普通饼干。
    - `chendol`：绿色 pandan jelly strands、椰奶、刨冰、椰糖浆、红豆，禁止 bubble tea、matcha latte、bingsu、smoothie 或普通冰淇淋。
    - `chicken-korma`：浅金/奶油色腰果或酸奶咖喱、鸡肉块、杏仁、香菜、naan 或米饭，禁止 butter chicken、tikka masala、biryani、Thai curry 或炸鸡。
    - `chiles-en-nogada`：poblano pepper 形态、白色核桃奶油酱、红石榴籽、绿欧芹，强调墨西哥国旗色，禁止 nachos、普通酿椒、chile relleno 番茄酱、tacos 或普通烤椒。
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步新增常见 alias：
    - `cao lau/cao lầu/hoi an noodles`、`cassata/sicilian cassata`、`chebakia/shebakia`、`cendol/chendol`、`chicken korma`、`chiles en nogada`。
  - 使用 Wan 生成并写入 6 张 webp：
    - `public/dishes/cao-lau.webp`
    - `public/dishes/cassata-siciliana.webp`
    - `public/dishes/chebakia.webp`
    - `public/dishes/chendol.webp`
    - `public/dishes/chicken-korma.webp`
    - `public/dishes/chiles-en-nogada.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - 生成命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=cao-lau,cassata-siciliana,chebakia,chendol,chicken-korma,chiles-en-nogada --apply --item-timeout-ms=120000 --delay-ms=800`
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next6r.png`。
  - 结果：`cao-lau` 为干/少汁越南面碗；`cassata` 绿色 marzipan 与切面层次明确；`chebakia` 花形蜂蜜饼清楚；`chendol` 绿色 pandan jelly 可见；`chicken-korma` 为浅色奶油咖喱；`chiles-en-nogada` 有白酱、石榴籽和 poblano 形态，可接受。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：738。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：76.2%。
  - 仍依赖远程/AI：284。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Cao Lau' 'Sicilian Cassata' 'Chebakia' 'Cendol' 'Chicken Korma' 'Chiles en Nogada' --json`：6 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 `pollinations_remote: 284` 中补图，建议优先 `churros-con-chocolate`、`cinnamon-roll-scandinavian`、`cochinillo-asado`、`crema-catalana`、`crostata-di-marmellata`、`dakgalbi` 等边界清楚条目。
  - 同时需要开始处理 `generated_local_unstable: 210`，否则会持续存在“本地页面可见但分享页/线上可能失效”的风险。

2026-08-05 高频本地图库第二十四批补充与西班牙/北欧/韩餐高频菜收口：

- 目标：
  - 继续提升稳定本地图库覆盖，减少海外真实菜单结果页的实时 AI 生图等待。
  - 选择视觉边界清楚且低重复的高频候选，跳过 `churros-street` 等与本批 `churros-con-chocolate` 高度相似的条目。
- 本批选择：
  - `churros-con-chocolate`：西班牙吉拿棒配巧克力。
  - `cinnamon-roll-scandinavian`：瑞典肉桂卷/Kanelbulle。
  - `cochinillo-asado`：西班牙烤乳猪。
  - `crema-catalana`：加泰罗尼亚焦糖布丁。
  - `crostata-di-marmellata`：意式果酱塔。
  - `dakgalbi`：韩式辣炒鸡排。
- RED：
  - `node scripts/diagnose-dish-images.mjs 'Churros with Chocolate' 'Cinnamon Roll' 'Roast Suckling Pig' 'Crema Catalana' 'Jam Tart' 'Dakgalbi' --json` 旧状态 6 个均为 `ai_pending`。
  - `common short menu names resolve to prebuilt local dish images` 新增 6 个断言；旧实现按预期失败于 `Churros with Chocolate -> undefined`。
  - `Wan knowledge image backfill` 脚本测试新增 6 个 prompt hint 断言；旧脚本缺 `churros-con-chocolate` 等提示词。
- GREEN：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增 6 个强 prompt hint：
    - `churros-con-chocolate`：长条有棱炸 churros、糖粉、浓稠黑巧克力蘸杯，禁止 doughnuts、eclairs、breadsticks、pretzels 或无巧克力 churros。
    - `cinnamon-roll-scandinavian`：瑞典 kanelbulle，扭结/螺旋肉桂豆蔻面包、pearl sugar、fika/bakery 语境，禁止美式厚糖霜肉桂卷、croissant、Danish pastry 或普通面包。
    - `cochinillo-asado`：西班牙烤乳猪、酥脆金色猪皮、整段/小整只造型、西班牙烤盘，禁止烤鸭、猪肋排、普通烤猪肉片、烤鸡或 pulled pork。
    - `crema-catalana`：浅陶碗、玻璃状焦糖壳、黄色 custard、肉桂/柑橘皮提示，禁止 flan、panna cotta、深白 ramekin creme brulee 或 cheesecake。
    - `crostata-di-marmellata`：意式果酱塔、格子酥皮、亮红/杏色果酱、shortcrust pastry，禁止鲜水果塔、cheesecake、无格子派、pizza 或 cookies。
    - `dakgalbi`：红色 gochujang 酱辣炒鸡、卷心菜、红薯、年糕、葱、芝麻、热锅 stir-fry，禁止韩式炸鸡、bulgogi、咖喱鸡、teriyaki 或普通无红酱炒鸡。
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步新增常见 alias：
    - `churros with chocolate`、`cinnamon roll/kanelbulle`、`roast suckling pig/cochinillo asado`、`crema catalana`、`jam tart/crostata di marmellata`、`dakgalbi/dak galbi`。
  - 使用 Wan 生成并写入 6 张 webp：
    - `public/dishes/churros-con-chocolate.webp`
    - `public/dishes/cinnamon-roll-scandinavian.webp`
    - `public/dishes/cochinillo-asado.webp`
    - `public/dishes/crema-catalana.webp`
    - `public/dishes/crostata-di-marmellata.webp`
    - `public/dishes/dakgalbi.webp`
  - `public/dish-knowledge-db.json` 中对应条目的 `card` 和 `hero` 已更新为本地静态路径。
  - 生成命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=churros-con-chocolate,cinnamon-roll-scandinavian,cochinillo-asado,crema-catalana,crostata-di-marmellata,dakgalbi --apply --item-timeout-ms=120000 --delay-ms=800`
- 目检：
  - 最终联系表：`/tmp/dishlens-backfill-20260805-next6s.png`。
  - 结果：`churros` 有巧克力蘸杯；`cinnamon roll` 有清楚螺旋与 fika 场景；`cochinillo` 为金黄整段烤乳猪；`crema catalana` 为陶碗焦糖面；`crostata` 格子果酱塔清晰；`dakgalbi` 为红酱热锅鸡肉年糕蔬菜，可接受。
- 当前图片覆盖诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：744。
  - 已提升生成缓存：41。
  - 稳定本地覆盖率：76.8%。
  - 仍依赖远程/AI：278。
  - 运行时生成但未稳定提升：210。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Churros with Chocolate' 'Cinnamon Roll' 'Roast Suckling Pig' 'Crema Catalana' 'Jam Tart' 'Dakgalbi' --json`：6 个均为 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 `pollinations_remote: 278` 中补图，建议可选 `dakgangjeong`、`dal-makhani`、`edamame`、`fettuccine-alfredo`、`gado-gado`、`galbi` 等海外高频且视觉边界清楚的菜。
  - 图片稳定性仍要单独推进 `generated_local_unstable: 210` 的质量筛选和持久化提升。

2026-08-05 运行时生成图稳定化审计与两张安全提升：

- 目标：
  - 降低分享页、线上部署和换机器访问时的图片失效风险。
  - 把 `public/generated-dishes` 中有任务证据且已人工目检可信的运行时图，提升为稳定本地缓存。
  - 不把无任务证据、泛化菜名或已知错图写入全局稳定图库。
- RED：
  - 给 `verified generated dish images can be promoted into the offline local image index` 增加审计字段断言：
    - `total_generated_files`
    - `unmapped_generated_files`
    - `review_ready_mapped`
    - `recover_task_cache_evidence_before_promoting`
  - 旧脚本按预期失败，因为 dry-run 只报告候选处理结果，无法解释 210 张运行时图的完整分布。
- GREEN：
  - `scripts/promote-generated-dish-images.mjs` 新增完整 dry-run 审计：
    - 扫描 `public/generated-dishes` 全量图片。
    - 分层统计：有任务缓存证据、已提升、可人工复核提升、泛化名跳过、ID blocklist、无任务证据。
    - 输出样本和下一步动作：
      - `manual_visual_review_then_run_with_apply`
      - `recover_task_cache_evidence_before_promoting`
  - 审计结果：
    - `total_generated_files`: 210
    - `task_cache_mapped_images`: 50
    - `generated_files_with_task_cache`: 46
    - `already_indexed`: 41 -> 提升后 43
    - `review_ready_mapped`: 2 -> 提升后 0
    - `skipped_generic_name`: 3
    - `blocked_by_id`: 4
    - `unmapped_generated_files`: 160
  - 人工目检并提升 2 张：
    - `generated-cioccolato`：对应 `LA PIZZA « CIOCCOLATO »`，图片为巧克力甜披萨，符合菜单语义。
    - `generated-jambon-de-parme-24-mois`：对应 `JAMBON DE PARME 24 MOIS`，图片为帕尔马火腿薄片，符合菜单语义。
  - 提升命令：
    - `node scripts/promote-generated-dish-images.mjs --ids=generated-cioccolato,generated-jambon-de-parme-24-mois --apply --verbose`
  - 新增稳定文件：
    - `public/dishes/generated-cache/generated-cioccolato.webp`
    - `public/dishes/generated-cache/generated-jambon-de-parme-24-mois.webp`
  - `public/generated-dish-local-index.json` 已写入 2 条新索引。
- 诊断结果：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：744。
  - 已提升生成缓存：43。
  - 稳定本地覆盖率：77.0%。
  - 仍依赖远程/AI：278。
  - 运行时生成但未稳定提升：210。
  - `LA PIZZA CIOCCOLATO` 与 `JAMBON DE PARME 24 MOIS` 均命中 `promoted_generated_cache`。
- 结论：
  - 当前没有剩余“有任务证据且可直接提升”的候选。
  - 下一步应优先处理 `unmapped_generated_files: 160`：恢复任务缓存证据、从历史结果重建映射，或对高频项重新走知识库生图/人工目检后入库。

2026-08-05 无任务证据运行时图的知识库精确匹配与 7 张本地化：

- 目标：
  - 继续处理 `unmapped_generated_files: 160`，先找出不需要重新生图、但可以从现有运行时图安全回填知识库的高置信候选。
  - 避免把 hash 文件名或泛化推断直接写入稳定图库。
- RED：
  - 扩展 `verified generated dish images can be promoted into the offline local image index`，要求 dry-run 审计输出：
    - `unmapped_remote_knowledge_matches`
    - `unmapped_local_knowledge_duplicates`
    - `unmapped_hashed_storage_ids`
    - `next_action_for_unmapped_knowledge_matches`
  - 旧脚本按预期失败，因为它只能统计“无任务证据”，不能判断这些文件是否能和知识库条目精确对应。
- GREEN：
  - `scripts/promote-generated-dish-images.mjs` 新增知识库匹配审计：
    - 从 `generated-xxx` 推断 `xxx`，跳过 `generated-dish-xxxxx` hash。
    - 与 `public/dish-knowledge-db.json` 的 `id/names` 做严格 slug 匹配。
    - 区分：
      - `unmapped_remote_knowledge_matches`：无任务证据，但能匹配仍为远程/待生成的知识库条目。
      - `unmapped_local_knowledge_duplicates`：无任务证据，但知识库已经有稳定本地图。
      - `unmapped_hashed_storage_ids`：无法从文件名安全推断菜名。
  - 初始审计发现：
    - `unmapped_remote_knowledge_matches`: 7
    - `unmapped_local_knowledge_duplicates`: 6
    - `unmapped_hashed_storage_ids`: 43
- 人工目检：
  - 联系表：`/tmp/dishlens-unmapped-knowledge-candidates-20260805.png`
  - 7 张候选均可接受：
    - `generated-bruschetta`：番茄罗勒烤面包；生产匹配仍优先 `bruschetta-al-pomodoro`，但 `bruschetta` 知识库条目也已本地化。
    - `generated-chicken-parmigiana`：炸鸡排配番茄酱/芝士。
    - `generated-chocolate-lava-cake`：熔岩巧克力蛋糕。
    - `generated-jamon-iberico`：伊比利亚火腿薄片。
    - `generated-melanzane-alla-parmigiana`：焗烤茄子。
    - `generated-paella-valenciana`：西班牙饭锅，米饭和肉类配料清楚。
    - `generated-patatas-bravas`：炸土豆配红酱。
- 已本地化知识库条目：
  - `public/dishes/bruschetta.webp`
  - `public/dishes/pollo-alla-parmigiana.webp`
  - `public/dishes/tortino-al-cioccolato.webp`
  - `public/dishes/jamon-iberico.webp`
  - `public/dishes/melanzane-parmigiana.webp`
  - `public/dishes/paella-valenciana.webp`
  - `public/dishes/patatas-bravas.webp`
  - `public/dish-knowledge-db.json` 中上述 7 个条目的 `card/hero` 已改为本地静态路径。
- 当前诊断：
  - `node scripts/diagnose-dish-images.mjs`
  - 知识库总数：1022。
  - 本地知识图：751。
  - 已提升生成缓存：43。
  - 稳定本地覆盖率：77.7%。
  - 仍依赖远程/AI：271。
  - `unmapped_remote_knowledge_matches`: 0。
- 后续建议：
  - `unmapped_local_knowledge_duplicates: 13` 可以安全清理或保留作人工参考，但不应再进入稳定索引。
  - `unmapped_hashed_storage_ids: 43` 需要从历史任务/菜单结果恢复菜名证据，不能从文件名推断。
  - 剩余无证据且未匹配知识库的可读文件名，需要单独做人工映射或直接用知识库 backfill 流程重新生成。

2026-08-05 知识库高优先级小批量补图与质量返工：

- 目标：
  - 继续降低海外常见菜单项对远程图片和即时 AI 生图的依赖。
  - 保持小批量、可目检、可回归验证，避免为了追求数量引入错图。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 7 个待本地化断言：
    - `Bal Kaymak -> bal-kaymak`
    - `Cloudberry Cream -> cloudberry-cream`
    - `Dadar Gulung -> dadar-gulung`
    - `Sweet Glazed Chicken -> dakgangjeong`
    - `Dal Makhani -> dal-makhani`
    - `Fettuccine Alfredo -> fettuccine-alfredo`
    - `Gado-Gado -> gado-gado`
  - 旧状态按预期失败于 `Bal Kaymak`，证明这些菜名还不能稳定命中本地图。
- 执行：
  - 计划命令：
    - `node scripts/plan-knowledge-image-backfill.mjs --limit=20`
  - 实际补图命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=nasi-goreng-sg,babà-al-rum,bal-kaymak,cloudberry-cream,dadar-gulung,dakgangjeong,dal-makhani,fettuccine-alfredo,gado-gado --apply --item-timeout-ms=120000 --delay-ms=800`
  - 脚本自动复用 2 个等价本地图：
    - `nasi-goreng-sg` 复用 `nasi-goreng-indonesian`
    - `babà-al-rum` 复用 `baba-au-rhum`
  - 新生成 7 张：
    - `public/dishes/bal-kaymak.webp`
    - `public/dishes/cloudberry-cream.webp`
    - `public/dishes/dadar-gulung.webp`
    - `public/dishes/dakgangjeong.webp`
    - `public/dishes/dal-makhani.webp`
    - `public/dishes/fettuccine-alfredo.webp`
    - `public/dishes/gado-gado.webp`
- 质量返工：
  - 首轮目检发现：
    - `bal-kaymak` 被生成得像布丁/奶冻，不符合土耳其 kaymak 蜂蜜奶油。
    - `gado-gado` 被生成得像春卷，不符合印尼花生酱蔬菜沙拉。
  - 给 `scripts/backfill-knowledge-images-with-wan.mjs` 新增两个专门 prompt hint，并加回归断言：
    - `bal-kaymak`：强调 `Turkish kaymak`、`thick clotted cream`、蜂蜜、面包/蜂巢，禁止 panna cotta/flan/pudding。
    - `gado-gado`：强调 `Indonesian gado-gado`、`peanut sauce`、水煮蛋、豆腐/天贝、蔬菜、虾片，禁止 spring roll/wrap。
  - 返工命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=bal-kaymak,gado-gado --force --apply --item-timeout-ms=120000 --delay-ms=800`
  - 返工后目检：
    - `bal-kaymak`：白色厚奶油配蜂蜜和面包，合格。
    - `gado-gado`：蔬菜、鸡蛋、豆腐/天贝、花生酱组合清楚，合格。
- 诊断结果：
  - `node scripts/diagnose-dish-images.mjs 'Nasi Goreng' 'Rum Baba' 'Bal Kaymak' 'Cloudberry Cream' 'Dadar Gulung' 'Sweet Glazed Chicken' 'Dal Makhani' 'Fettuccine Alfredo' 'Gado-Gado' --json`
  - 9 个均返回 `local_knowledge`。
  - 全库诊断：
    - 知识库总数：1022。
    - 本地知识图：760。
    - 已提升生成缓存：43。
    - 稳定本地覆盖率：78.6%。
    - 仍依赖远程/AI：262。
    - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill"`：137/137 通过。
- 下一步：
  - 继续从 `node scripts/plan-knowledge-image-backfill.mjs --limit=20` 的剩余候选中推进，优先 `edamame`、`es-campur`、`galbi`、`ganjang-chicken`、`gnocchi-al-ragu` 等海外常见且视觉边界清楚的菜。
  - 每批保持 6-10 张并做 contact sheet 目检；对首轮偏图项先补 `SPECIAL_BACKFILL_IMAGE_HINTS` 再 `--force` 返工。

2026-08-05 第二批海外高频知识库补图：

- 目标：
  - 继续减少海外常见菜名触发即时 AI 生图，提升列表首屏速度和分享页稳定性。
  - 重点处理上轮计划中仍为 `ai_pending` 的高频/易识别菜品。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 7 个断言：
    - `Edamame -> edamame`
    - `Es Campur -> es-campur`
    - `Galbi -> galbi`
    - `Soy Garlic Chicken -> ganjang-chicken`
    - `Gnocchi al Ragu -> gnocchi-al-ragu`
    - `Danish Pastry -> danish-pastry`
    - `Durian -> durian-sg`
  - 旧状态按预期失败于 `Edamame`，证明这批菜名未稳定命中本地图。
- 执行：
  - dry-run：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=edamame,es-campur,galbi,ganjang-chicken,gnocchi-al-ragu,danish-pastry,durian-sg --item-timeout-ms=120000 --delay-ms=800`
  - 实际补图：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=edamame,es-campur,galbi,ganjang-chicken,gnocchi-al-ragu,danish-pastry,durian-sg --apply --item-timeout-ms=120000 --delay-ms=800`
  - 新生成 7 张：
    - `public/dishes/danish-pastry.webp`
    - `public/dishes/durian-sg.webp`
    - `public/dishes/edamame.webp`
    - `public/dishes/es-campur.webp`
    - `public/dishes/galbi.webp`
    - `public/dishes/ganjang-chicken.webp`
    - `public/dishes/gnocchi-al-ragu.webp`
- 人工目检：
  - 联系表：`/tmp/dishlens-backfill-batch2-20260805.png`
  - 7 张均可接受：
    - `danish-pastry`：丹麦酥层次清楚。
    - `durian-sg`：榴莲果肉与外形清楚。
    - `edamame`：毛豆豆荚清楚。
    - `es-campur`：印尼混合冰的刨冰、果料、豆类组合清楚。
    - `galbi`：韩式排骨肉/短肋构图清楚。
    - `ganjang-chicken`：酱油蒜香炸鸡块和酱汁清楚。
    - `gnocchi-al-ragu`：土豆团子配肉酱语义可接受。
- 匹配修复：
  - 发现 `galbi.webp` 已本地化后，`Galbi` 仍因短菜名匹配不足返回 `ai_pending`。
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步新增别名：
    - `galbi`
    - `kalbi`
    - `korean short ribs`
    - `grilled short ribs`
    - `韩式牛排骨`
    - `갈비`
- 诊断结果：
  - `node scripts/diagnose-dish-images.mjs 'Edamame' 'Es Campur' 'Galbi' 'Soy Garlic Chicken' 'Gnocchi al Ragu' 'Danish Pastry' 'Durian' --json`
  - 7 个均返回 `local_knowledge`。
  - 全库诊断：
    - 知识库总数：1022。
    - 本地知识图：767。
    - 已提升生成缓存：43。
    - 稳定本地覆盖率：79.3%。
    - 仍依赖远程/AI：255。
    - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续用 `node scripts/plan-knowledge-image-backfill.mjs --limit=16` 推进剩余远程候选；下一批可优先 `gyoza`、`hotteok`、`gulab-jamun`、`gyeranppang`、`halva-me`、`grina` 这类视觉边界相对明确的条目。
  - `baklava-me` / `baklava-turkish` 与已有 `baklava-greek` 存在概念重复，建议先做复用或别名治理，不急于重复生成。

2026-08-05 第三批知识库补图、重复概念复用与返工：

- 目标：
  - 继续把海外常见甜点/小吃从远程/AI pending 迁入稳定本地图。
  - 对 Baklava 这类重复概念优先复用已有稳定图，避免重复生成和图库分叉。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 8 个断言：
    - `Turkish Baklava -> baklava-turkish`
    - `Churros -> churros-street`
    - `Ghriba -> grina`
    - `Gulab Jamun -> gulab-jamun`
    - `Egg Bread -> gyeranppang`
    - `Gyoza -> gyoza`
    - `Halva -> halva-me`
    - `Hotteok -> hotteok`
  - 旧状态按预期失败：`Turkish Baklava` 被泛化命中 `baklava-greek`，其余新条目仍待本地化。
- 执行：
  - dry-run：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=baklava-me,baklava-turkish,churros-street,grina,gulab-jamun,gyeranppang,gyoza,halva-me,hotteok --item-timeout-ms=120000 --delay-ms=800`
  - 实际补图/复用：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=baklava-me,baklava-turkish,churros-street,grina,gulab-jamun,gyeranppang,gyoza,halva-me,hotteok --apply --item-timeout-ms=120000 --delay-ms=800`
  - 复用 2 个：
    - `baklava-me` 复用 `baklava-greek`
    - `baklava-turkish` 复用 `baklava-greek`
  - 新生成 7 张：
    - `public/dishes/churros-street.webp`
    - `public/dishes/grina.webp`
    - `public/dishes/gulab-jamun.webp`
    - `public/dishes/gyeranppang.webp`
    - `public/dishes/gyoza.webp`
    - `public/dishes/halva-me.webp`
    - `public/dishes/hotteok.webp`
- 人工目检：
  - 联系表：`/tmp/dishlens-backfill-batch3-20260805.png`
  - 首轮可接受：
    - `churros-street`：西班牙油条形态清楚。
    - `grina`：摩洛哥甜饼/酥球形态可接受。
    - `gulab-jamun`：糖浆奶球清楚。
    - `gyeranppang`：韩式鸡蛋面包截面可接受。
    - `halva-me`：芝麻甜糕/哈尔瓦块状形态清楚。
  - 首轮不合格并返工：
    - `gyoza` 初稿更像切开的馅饼/锅贴混合，不够日式煎饺。
    - `hotteok` 初稿像带流心的甜点蛋糕，不像韩式街头糖饼。
- 质量返工：
  - 在 `scripts/backfill-knowledge-images-with-wan.mjs` 新增两个专门 prompt hint，并加回归断言：
    - `gyoza`：强调 `Japanese gyoza`、`crescent dumplings`、煎脆底部和蘸汁，禁止 empanadas/bao/ravioli/pierogi。
    - `hotteok`：强调 `Korean hotteok`、`flat griddle pancake`、红糖肉桂坚果馅，禁止 cake/tart/lava cake/pancake stack。
  - 返工命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=gyoza,hotteok --force --apply --item-timeout-ms=120000 --delay-ms=800`
  - 返工后目检：
    - `gyoza`：日式月牙煎饺清楚，合格。
    - `hotteok`：扁平糖饼带坚果糖馅，合格。
- 匹配修复：
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步新增别名：
    - `turkish baklava` / `baklava turkish` / `土耳其果仁蜜饼 -> baklava-turkish`
    - `middle eastern baklava` / `arabic baklava` / `baklava me` / `中东果仁蜜饼 -> baklava-me`
    - `gyoza` / `japanese dumplings` / `japanese pan fried dumplings` / `日式煎饺` / `餃子 -> gyoza`
    - `hotteok` / `korean sweet pancake` / `sweet pancake` / `韩式糖饼` / `호떡 -> hotteok`
- 诊断结果：
  - `node scripts/diagnose-dish-images.mjs 'Turkish Baklava' 'Middle Eastern Baklava' 'Churros' 'Ghriba' 'Gulab Jamun' 'Egg Bread' 'Gyoza' 'Halva' 'Hotteok' --json`
  - 9 个均返回 `local_knowledge`。
  - 全库诊断：
    - 知识库总数：1022。
    - 本地知识图：776。
    - 已提升生成缓存：43。
    - 稳定本地覆盖率：80.1%。
    - 仍依赖远程/AI：246。
    - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 `ice-kacang`、`inari-sushi`、`jajangmyeon`、`jalebi`、`japchae`、`jokbal`、`kakigori`、`kanom-krok`、`karaage` 中选择 6-9 个做下一批。
  - 对 `ice-kacang/kakigori` 这类刨冰甜品注意避免互相混淆；对 `jajangmyeon/japchae` 注意面型和酱色提示词。

2026-08-05 第四批知识库补图、面类/刨冰/韩式猪蹄质量修正：

- 目标：
  - 继续提升海外菜单常见菜的稳定本地图覆盖。
  - 特别处理刨冰、韩式面类、日式/韩式炸物等容易在即时 AI 生图中混淆的品类。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 9 个断言：
    - `Ice Kacang -> ice-kacang`
    - `Inari Sushi -> inari-sushi`
    - `Jajangmyeon -> jajangmyeon`
    - `Jalebi -> jalebi`
    - `Japchae -> japchae`
    - `Jokbal -> jokbal`
    - `Kakigori -> kakigori`
    - `Kanom Krok -> kanom-krok`
    - `Karaage -> karaage`
  - 旧状态按预期失败于 `Ice Kacang`。
- 执行：
  - dry-run：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=ice-kacang,inari-sushi,jajangmyeon,jalebi,japchae,jokbal,kakigori,kanom-krok,karaage --item-timeout-ms=120000 --delay-ms=800`
  - 实际补图：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=ice-kacang,inari-sushi,jajangmyeon,jalebi,japchae,jokbal,kakigori,kanom-krok,karaage --apply --item-timeout-ms=120000 --delay-ms=800`
  - 新生成 9 张：
    - `public/dishes/ice-kacang.webp`
    - `public/dishes/inari-sushi.webp`
    - `public/dishes/jajangmyeon.webp`
    - `public/dishes/jalebi.webp`
    - `public/dishes/japchae.webp`
    - `public/dishes/jokbal.webp`
    - `public/dishes/kakigori.webp`
    - `public/dishes/kanom-krok.webp`
    - `public/dishes/karaage.webp`
- 人工目检：
  - 联系表：`/tmp/dishlens-backfill-batch4-20260805.png`
  - 首轮可接受：
    - `ice-kacang`：红豆冰/刨冰组合清楚。
    - `inari-sushi`：稻荷寿司豆皮包饭形态清楚。
    - `jalebi`：糖浆螺旋形态清楚。
    - `japchae`：韩式粉丝/杂菜形态可接受。
    - `kakigori`：日式刨冰可接受。
    - `karaage`：日式炸鸡块可接受。
  - 首轮不合格/不够稳：
    - `jajangmyeon` 酱色偏红，不像韩式黑豆炸酱面。
    - `jokbal` 被生成成鸡爪/爪形，明显错误。
    - `kanom-krok` 像饼干，不像泰式椰子小煎糕。
- 质量返工：
  - 给 `scripts/backfill-knowledge-images-with-wan.mjs` 新增专门 prompt hint，并加回归断言：
    - `jajangmyeon`：强调 `Korean jajangmyeon`、`glossy black bean sauce`、深棕至黑色炸酱，禁止红酱/意面/汤面。
    - `jokbal`：强调 `Korean jokbal`、`braised pig's feet`、`sliced pork trotter`、`no visible toes`，禁止鸡爪/整只爪形/鸭脚。
    - `kanom-krok`：强调 `Thai kanom krok`、`small coconut rice pancakes`、半球杯状小椰子煎糕，禁止饼干/马卡龙/松饼。
  - 返工命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=jajangmyeon,jokbal,kanom-krok --force --apply --item-timeout-ms=120000 --delay-ms=800`
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=jokbal --force --apply --item-timeout-ms=120000 --delay-ms=800`
  - 返工后目检：
    - `jajangmyeon`：黑豆炸酱面语义可接受。
    - `kanom-krok`：泰式椰子小煎糕语义可接受。
    - `jokbal`：第二次返工后变为切片猪蹄/猪肘肉，无爪形，合格。
- 匹配修复：
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 同步新增短名别名：
    - `inari sushi` / `fried tofu pouch sushi` / `稻荷寿司` / `稲荷寿司 -> inari-sushi`
    - `jajangmyeon` / `jjajangmyeon` / `black bean noodles` / `韩式炸酱面` / `자장면` / `짜장면 -> jajangmyeon`
    - `japchae` / `glass noodle stir fry` / `韩式杂菜` / `잡채 -> japchae`
    - `jokbal` / `braised pig's feet` / `korean braised pork trotter` / `韩式卤猪蹄` / `족발 -> jokbal`
    - `kakigori` / `japanese shaved ice` / `shaved ice` / `刨冰` / `かき氷 -> kakigori`
    - `karaage` / `japanese fried chicken` / `日式炸鸡块` / `唐揚げ -> karaage`
- 诊断结果：
  - `node scripts/diagnose-dish-images.mjs 'Ice Kacang' 'Inari Sushi' 'Jajangmyeon' 'Jalebi' 'Japchae' 'Jokbal' 'Kakigori' 'Kanom Krok' 'Karaage' --json`
  - 9 个均返回 `local_knowledge`。
  - 全库诊断：
    - 知识库总数：1022。
    - 本地知识图：785。
    - 已提升生成缓存：43。
    - 稳定本地覆盖率：81.0%。
    - 仍依赖远程/AI：237。
    - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names|Wan knowledge image backfill|dish image diagnostics"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 继续从 `karniyarik`、`kaya-toast`、`kazandibi`、`keema-matar`、`khanom-buang`、`khao-man-gai-thai`、`khao-mok-gai`、`kheer`、`knafeh-me` 中选择下一批。
  - 下一批注意：`khanom-buang/kanom-krok` 都是泰式甜点，提示词要区分薄脆饼 vs 小椰子煎糕；`khao-man-gai-thai` 不要和新加坡海南鸡饭重复错配。

2026-08-06 第五批知识库补图、土耳其/泰国/印度/中东常见菜本地化：

- 目标：
  - 继续减少结果页和详情页对即时 AI 生图的依赖。
  - 补齐海外菜单中常见但容易混淆的土耳其、泰国、印度、中东菜品。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 9 个断言：
    - `Karnıyarık -> karniyarik`
    - `Kaya Toast -> kaya-toast`
    - `Kazandibi -> kazandibi`
    - `Keema Matar -> keema-matar`
    - `Khanom Buang -> khanom-buang`
    - `Thai Khao Man Gai -> khao-man-gai-thai`
    - `Khao Mok Gai -> khao-mok-gai`
    - `Kheer -> kheer`
    - `Knafeh -> knafeh-me`
  - 旧状态按预期失败于 `Karnıyarık`，说明这批仍会走远程/AI 链路。
  - 额外新增 `kaya-toast` prompt 质量断言，要求包含 `No avocado` 和 `no eggs on top`，旧状态按预期失败。
  - 额外新增诊断脚本别名断言，要求 `Thai Khao Man Gai` 在诊断中命中 `khao-man-gai-thai`，旧状态按预期失败为 `ai_pending`。
- 执行：
  - dry-run：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=karniyarik,kaya-toast,kazandibi,keema-matar,khanom-buang,khao-man-gai-thai,khao-mok-gai,kheer,knafeh-me --item-timeout-ms=120000 --delay-ms=800`
  - 实际补图：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=karniyarik,kaya-toast,kazandibi,keema-matar,khanom-buang,khao-man-gai-thai,khao-mok-gai,kheer,knafeh-me --item-timeout-ms=120000 --delay-ms=800 --apply`
  - 新生成 9 张：
    - `public/dishes/karniyarik.webp`
    - `public/dishes/kaya-toast.webp`
    - `public/dishes/kazandibi.webp`
    - `public/dishes/keema-matar.webp`
    - `public/dishes/khanom-buang.webp`
    - `public/dishes/khao-man-gai-thai.webp`
    - `public/dishes/khao-mok-gai.webp`
    - `public/dishes/kheer.webp`
    - `public/dishes/knafeh-me.webp`
- 人工目检：
  - 联系表初版：`/tmp/dishlens-backfill-batch5-20260806.png`
  - 联系表返工版：`/tmp/dishlens-backfill-batch5-20260806-v2.png`
  - 首轮可接受：
    - `karniyarik`：剖开茄子填肉和番茄酱汁清楚。
    - `kazandibi`：焦底奶布丁卷状/焦糖面清楚。
    - `keema-matar`：肉末豌豆咖喱形态清楚。
    - `khanom-buang`：泰式薄脆饼/甜薄饼形态可接受，未混成 `kanom-krok`。
    - `khao-man-gai-thai`：鸡饭、黄瓜、蘸酱组合可接受。
    - `khao-mok-gai`：黄姜鸡肉饭、鸡腿、蘸酱组合清楚。
    - `kheer`：印度米布丁、坚果/藏红花点缀清楚。
    - `knafeh-me`：橙金色 kataifi 甜点和开心果点缀清楚。
  - 首轮不合格：
    - `kaya-toast` 被生成成牛油果鸡蛋吐司，不是新加坡咖椰吐司。
- 质量返工：
  - 强化 `kaya-toast` prompt hint：
    - 明确 `Singapore kaya toast`、绿色咖椰酱、冷黄油片、kopitiam 早餐托盘。
    - 明确 `No avocado`、`no eggs on top`、`no poached egg topping`。
  - 返工命令：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=kaya-toast --item-timeout-ms=120000 --delay-ms=800 --force --apply`
  - 返工后目检：
    - `kaya-toast`：绿色咖椰酱、黄油块、旁边软蛋，已从牛油果吐司纠正为可用咖椰吐司图。
- 匹配/诊断修复：
  - `scripts/diagnose-dish-images.mjs` 新增：
    - `thai khao man gai` / `khao man gai thai` / `ข้าวมันไก่` / `泰式海南鸡饭` / `海南鸡饭 泰式 -> khao-man-gai-thai`
  - 生产匹配器已因知识库本地图自然命中这 9 个短名；本轮主要同步修复诊断工具，避免误判 `Thai Khao Man Gai` 仍在 AI pending。
- 诊断结果：
  - `node scripts/diagnose-dish-images.mjs 'Karnıyarık' 'Kaya Toast' 'Kazandibi' 'Keema Matar' 'Khanom Buang' 'Thai Khao Man Gai' 'Khao Mok Gai' 'Kheer' 'Knafeh' --json`
  - 9 个均返回 `local_knowledge`。
  - 全库诊断：
    - 知识库总数：1022。
    - 本地知识图：794。
    - 已提升生成缓存：43。
    - 稳定本地覆盖率：81.9%。
    - 仍依赖远程/AI：228。
    - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "Wan knowledge image backfill"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "diagnostics mirrors"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 下一批候选建议从：
    - `korean-bbq-platter`
    - `korean-fried-chicken`
    - `kulfi`
    - `kulfi-falooda`
    - `kunefe`
    - `lod-chong`
    - `lokum-turkish`
    - `lomo-saltado`
    - `malai-kofta`
  - 注意 `knafeh-me/kunefe` 很接近，但可分别保留中东/土耳其语境；如果图片重复度过高，后续可评估是否复用同一稳定图或用别名归一。
  - 继续处理 `generated_local_unstable: 210`，这些仍是分享页/跨部署失效风险来源。

2026-08-06 第六批知识库补图、韩式/印度/泰国/秘鲁高频项本地化：

- 目标：
  - 继续减少海外菜单高频菜品在结果页和详情页触发即时 AI 生图。
  - 覆盖韩式聚餐、印度甜品、泰国甜品、土耳其甜品和秘鲁主菜，降低大菜单中图片排队数量。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 9 个断言：
    - `Korean BBQ Platter -> korean-bbq-platter`
    - `Korean Fried Chicken -> korean-fried-chicken`
    - `Kulfi -> kulfi`
    - `Kulfi Falooda -> kulfi-falooda`
    - `Künefe -> kunefe`
    - `Lod Chong -> lod-chong`
    - `Lokum -> lokum-turkish`
    - `Lomo Saltado -> lomo-saltado`
    - `Malai Kofta -> malai-kofta`
  - 旧状态按预期失败于 `Korean BBQ Platter`，说明这批仍会走远程/AI 链路。
  - 在 `Wan knowledge image backfill...` 中新增 prompt 质量断言，要求脚本包含：
    - `Korean BBQ platter` + `table grill`
    - `Korean fried chicken` + `glossy red gochujang`
    - `Indian kulfi falooda` + `falooda vermicelli`
    - `Thai lod chong` + `green pandan jelly noodles`
    - `Indian malai kofta` + `cream sauce`
  - 旧状态按预期失败于缺少 `korean-bbq-platter` 专用提示。
- 执行：
  - dry-run：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=korean-bbq-platter,korean-fried-chicken,kulfi,kulfi-falooda,kunefe,lod-chong,lokum-turkish,lomo-saltado,malai-kofta --item-timeout-ms=120000 --delay-ms=800`
  - 实际补图：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=korean-bbq-platter,korean-fried-chicken,kulfi,kulfi-falooda,kunefe,lod-chong,lokum-turkish,lomo-saltado,malai-kofta --item-timeout-ms=120000 --delay-ms=800 --apply`
  - 新生成 9 张：
    - `public/dishes/korean-bbq-platter.webp`
    - `public/dishes/korean-fried-chicken.webp`
    - `public/dishes/kulfi.webp`
    - `public/dishes/kulfi-falooda.webp`
    - `public/dishes/kunefe.webp`
    - `public/dishes/lod-chong.webp`
    - `public/dishes/lokum-turkish.webp`
    - `public/dishes/lomo-saltado.webp`
    - `public/dishes/malai-kofta.webp`
- 人工目检：
  - 联系表：`/tmp/dishlens-backfill-batch6-20260806.png`
  - 结果：
    - `korean-bbq-platter`：烤肉拼盘、泡菜/生菜等韩式配菜清楚，合格。
    - `korean-fried-chicken`：红亮韩式炸鸡、芝麻/葱花清楚，合格。
    - `kulfi`：开心果绿色冰品切块/卷状语义可接受，合格。
    - `kulfi-falooda`：高杯、玫瑰糖浆、奶感和配料层次清楚，合格。
    - `kunefe`：金橙色 kataifi 奶酪甜点和开心果清楚，合格。
    - `lod-chong`：椰奶中绿色 pandan jelly noodles 清楚，合格。
    - `lokum-turkish`：糖粉土耳其软糖小块清楚，合格。
    - `lomo-saltado`：牛肉、洋葱番茄和薯条可辨，略偏炖菜质感但仍可接受。
    - `malai-kofta`：奶油咖喱酱中 kofta 球清楚，合格。
- 匹配/诊断：
  - `node scripts/diagnose-dish-images.mjs 'Korean BBQ Platter' 'Korean Fried Chicken' 'Kulfi' 'Kulfi Falooda' 'Künefe' 'Lod Chong' 'Lokum' 'Lomo Saltado' 'Malai Kofta' --json`
  - 9 个均返回 `local_knowledge`。
  - 全库诊断：
    - 知识库总数：1022。
    - 本地知识图：803。
    - 已提升生成缓存：43。
    - 稳定本地覆盖率：82.8%。
    - 仍依赖远程/AI：219。
    - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 下一批候选建议从：
    - `massaman-curry`
    - `mazamorra-morada`
    - `mole-negro`
    - `mole-poblano`
    - `moo-ping`
    - `muhammara-lebanese`
    - `muhammara-me`
    - `mujadara`
    - `mutter-paneer`
  - 注意 `muhammara-lebanese/muhammara-me` 可能可以共享稳定图或做别名归一；`mole-negro/mole-poblano` 需要避免变成普通巧克力酱或炖肉。
  - 继续推进 `generated_local_unstable: 210` 的清理/提升，这批仍会影响分享页和跨部署图片稳定性。

2026-08-06 运行时生成图稳定性诊断口径修正：

- 背景：
  - 之前 `scripts/diagnose-dish-images.mjs --summary` 的 `generated_local_unstable` 直接统计 `public/generated-dishes/` 中所有图片文件。
  - 这个数字会把已经提升到 `public/dishes/generated-cache/` 并写入 `public/generated-dish-local-index.json` 的源文件也算进“不稳定”总数，容易夸大剩余风险池。
- 改动：
  - `scripts/diagnose-dish-images.mjs` 新增两个摘要字段：
    - `generated_local_promoted_source_files`：运行时生成目录中，已经有稳定 promoted cache/index 的源文件数量。
    - `generated_local_unstable_unpromoted`：真正仍未提升、分享页/跨部署仍有失效风险的运行时生成文件数量。
  - 新增回归测试：
    - `dish image diagnostics separates promoted runtime source files from unstable files`
    - 断言 `generated_local_unstable = generated_local_promoted_source_files + generated_local_unstable_unpromoted`。
- 当前诊断：
  - 知识库总数：1022。
  - 本地知识图：812。
  - 已提升生成缓存：43。
  - 稳定本地覆盖率：83.7%。
  - `generated_local_unstable`：210。
  - `generated_local_promoted_source_files`：43。
  - `generated_local_unstable_unpromoted`：167。
- 同步审计：
  - `node scripts/promote-generated-dish-images.mjs` 当前 dry-run 显示：
    - `review_ready_mapped: 0`，没有新的“有任务证据且可直接进入目检提升”的候选。
    - `already_indexed: 43`，已提升项仍保留源文件。
    - `skipped_generic_name: 3`，`plain`、`vegan`、`overnight` 不应全局推广。
    - `blocked_by_id: 4`，仍为人工质量 blocklist。
    - `unmapped_generated_files: 160`，这些缺少任务缓存证据，不应盲目提升。
    - `unmapped_local_knowledge_duplicates: 13`，已有稳定本地图的重复运行时文件，可后续清理或保留作人工参考。
- 验证：
  - RED：新增诊断拆分字段测试后，旧实现按预期失败。
  - GREEN：实现运行时源文件拆分统计后，目标测试通过。
  - 全量：`node --test tests/logic-regressions.test.mjs`：138/138 通过。
  - 全量：`npm run lint`：通过。
  - 全量：`npm run build`：通过。
- 下一步：
  - 把后续图片稳定性目标从笼统的 `generated_local_unstable: 210` 改为更准确的 `generated_local_unstable_unpromoted: 167`。
  - 由于当前 `review_ready_mapped: 0`，下一轮不要盲目 `--apply`；应优先恢复/补充这 160 张未映射图的任务证据，或用人工目检把高频菜重新纳入知识库图片。
  - `unmapped_local_knowledge_duplicates: 13` 可设计安全清理流程，但不应影响线上展示，因为这些菜已有稳定本地图。

2026-08-06 未稳定运行时图片可审计清单：

- 目标：
  - 把 `generated_local_unstable_unpromoted: 167` 从一个总数拆成可执行清单，方便后续按风险和收益分批处理。
  - 避免无任务证据、泛名、错图或已有稳定图的文件被误提升进 `generated-cache`。
- 改动：
  - `scripts/promote-generated-dish-images.mjs` 新增 `--unstable-report`。
  - 输出 `unstable_report`：
    - `total_unstable_unpromoted`
    - `returned_items`
    - `limit`
    - `unstable_unpromoted_items`
    - `items` 兼容字段
  - 每个 item 都包含 `storage_id`、`status`、`next_action`，并在可推断时包含 `file`、`inferred_key`、`knowledge_id`、`name_original`。
  - 已经提升到 `generated-cache` 的源文件被标记为 `already_promoted_source_file`，但不会进入 `unstable_report.items`，避免再次污染风险池。
- 当前全量分类：
  - 命令：
    - `node scripts/promote-generated-dish-images.mjs --unstable-report --limit=1000`
  - 结果：
    - `total_unstable_unpromoted`: 167
    - `unmapped_named_without_knowledge_match`: 104
    - `unmapped_hashed_storage_id`: 43
    - `unmapped_local_knowledge_duplicate`: 13
    - `blocked_by_id`: 4
    - `skipped_generic_name`: 3
- 处理顺序建议：
  1. 先处理 `unmapped_local_knowledge_duplicate: 13`：这些已有稳定本地图，适合做 dry-run 清理或保留作人工参考，不应进入 promoted cache。
  2. 再处理 `unmapped_named_without_knowledge_match: 104`：优先挑真实菜单高频菜，目检后补进知识库图片或恢复任务证据。
  3. `unmapped_hashed_storage_id: 43` 缺少可读菜名，必须先恢复 `.cache/tasks` 证据或从历史菜单中确认菜名，不应直接提升。
  4. `blocked_by_id: 4` 和 `skipped_generic_name: 3` 保持禁止提升，除非有新的人工目检和明确菜名上下文。
- 验证：
  - RED：新增 `generated image promotion script reports unpromoted unstable files with safe next actions` 后，旧脚本按预期失败。
  - GREEN：实现 `--unstable-report` 后目标测试通过。
  - 全量：`node --test tests/logic-regressions.test.mjs`：139/139 通过。
  - 全量：`npm run lint`：通过。
  - 全量：`npm run build`：通过。

2026-08-06 第七批知识库补图、泰国/秘鲁/墨西哥/中东/印度高频项本地化：

- 目标：
  - 继续减少结果页和详情页即时 AI 生图数量。
  - 覆盖下一批候选顶部的泰国咖喱、秘鲁甜品、墨西哥 mole、中东蘸酱/米饭、印度 paneer 咖喱。
- RED：
  - 在 `common short menu names resolve to prebuilt local dish images` 中新增 9 个断言：
    - `Massaman Curry -> massaman-curry`
    - `Mazamorra Morada -> mazamorra-morada`
    - `Mole Negro -> mole-negro`
    - `Mole Poblano -> mole-poblano`
    - `Moo Ping -> moo-ping`
    - `Muhammara -> muhammara-lebanese`
    - `Middle Eastern Muhammara -> muhammara-me`
    - `Mujadara -> mujadara`
    - `Mutter Paneer -> mutter-paneer`
  - 旧状态按预期失败于 `Massaman Curry`。
  - 在 `Wan knowledge image backfill...` 中新增 prompt 质量断言，要求脚本包含：
    - `Thai massaman curry` + `peanuts and potatoes`
    - `Mexican mole negro` + `dark black-brown mole sauce`
    - `Thai moo ping` + `grilled pork skewers`
    - `red pepper walnut dip`
    - `lentils and rice`
    - `paneer cubes and green peas`
  - 旧状态按预期失败于缺少 `massaman-curry` 专用提示。
- 执行：
  - dry-run：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=massaman-curry,mazamorra-morada,mole-negro,mole-poblano,moo-ping,muhammara-lebanese,muhammara-me,mujadara,mutter-paneer --item-timeout-ms=120000 --delay-ms=800`
  - 实际补图：
    - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=massaman-curry,mazamorra-morada,mole-negro,mole-poblano,moo-ping,muhammara-lebanese,muhammara-me,mujadara,mutter-paneer --item-timeout-ms=120000 --delay-ms=800 --apply`
  - 新生成 9 张：
    - `public/dishes/massaman-curry.webp`
    - `public/dishes/mazamorra-morada.webp`
    - `public/dishes/mole-negro.webp`
    - `public/dishes/mole-poblano.webp`
    - `public/dishes/moo-ping.webp`
    - `public/dishes/muhammara-lebanese.webp`
    - `public/dishes/muhammara-me.webp`
    - `public/dishes/mujadara.webp`
    - `public/dishes/mutter-paneer.webp`
- 人工目检：
  - 联系表：`/tmp/dishlens-backfill-batch7-20260806.png`
  - 结果：
    - `massaman-curry`：土豆、坚果、肉块和米饭组合清楚，合格。
    - `mazamorra-morada`：深紫色玉米布丁和水果块清楚，合格。
    - `mole-negro`：深色 mole 酱和鸡/肉丝、米饭语义可接受，合格。
    - `mole-poblano`：红棕 mole 酱、鸡肉/玉米饼搭配清楚，合格。
    - `moo-ping`：泰式猪肉串、糯米和蘸酱组合清楚，合格。
    - `muhammara-lebanese`：红椒核桃蘸酱、坚果和饼清楚，合格。
    - `muhammara-me`：偏通用红椒蘸酱但仍符合 muhammara 方向，后续可考虑与 lebanese 版本归一或复用更清晰图。
    - `mujadara`：扁豆米饭和焦糖洋葱清楚，合格。
    - `mutter-paneer`：paneer、豌豆和红橙咖喱酱清楚，合格。
- 匹配/诊断修复：
  - `src/lib/dish-image-match.ts` 与 `scripts/diagnose-dish-images.mjs` 新增更具体别名：
    - `middle eastern muhammara` / `muhammara me` / `arabic muhammara` / `中东核桃辣酱 -> muhammara-me`
    - `lebanese muhammara` / `muhammara lebanese` / `muhammara` / `核桃辣酱 -> muhammara-lebanese`
  - 原因：初次验证时 `Middle Eastern Muhammara` 会被泛化匹配到 `muhammara-lebanese`，导致短名测试失败；补别名后生产匹配器和诊断工具一致。
- 诊断结果：
  - `node scripts/diagnose-dish-images.mjs 'Massaman Curry' 'Mazamorra Morada' 'Mole Negro' 'Mole Poblano' 'Moo Ping' 'Muhammara' 'Middle Eastern Muhammara' 'Mujadara' 'Mutter Paneer' --json`
  - 9 个均返回 `local_knowledge`。
  - 全库诊断：
    - 知识库总数：1022。
    - 本地知识图：812。
    - 已提升生成缓存：43。
    - 稳定本地覆盖率：83.7%。
    - 仍依赖远程/AI：210。
    - 运行时生成但未稳定提升：210。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "common short menu names"`：137/137 通过。
  - `node --test tests/logic-regressions.test.mjs`：137/137 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步：
  - 下一批候选建议从：
    - `nasi-uduk`
    - `nasu-dengaku`
    - `okonomiyaki`
    - `pa-tong-ko`
    - `paccheri-al-ragu`
    - `pad-prik-king`
    - `pad-see-ew`
    - `pajeon`
    - `paletas`
  - 注意 `pajeon/haemul-pajeon`、`okonomiyaki/pajeon` 都是煎饼类，要用专门提示词防止互相混淆。
  - `generated_local_unstable: 210` 仍未下降，说明下一阶段需要从“知识库 Pollinations 替换”转向“运行时生成图清理/提升/Supabase 同步”并行推进。

2026-08-06 目检通过的运行时生成图稳定化小批次：

- 目标：
  - 把已经人工目检合格的运行时 AI 生成图，从 `public/generated-dishes/` 提升到可跨部署复用的 `public/dishes/generated-cache/`。
  - 同名菜后续直接命中本地索引，减少重复 AI 生图、图片失效和结果页等待。
- 人工目检联系表：
  - `/tmp/dishlens-unstable-candidates-20260806.png`
- 本批提升 7 张：
  - `Battered Onion Rings -> /dishes/generated-cache/generated-battered-onion-rings.webp`
  - `Chicken Wings -> /dishes/generated-cache/generated-chicken-wings.webp`
  - `Crispy Fried Calamari -> /dishes/generated-cache/generated-crispy-fried-calamari.webp`
  - `Egyptian Falafels -> /dishes/generated-cache/generated-egyptian-falafels.webp`
  - `Garlic Prawns -> /dishes/generated-cache/generated-garlic-prawns.webp`
  - `Grilled Salmon -> /dishes/generated-cache/generated-grilled-salmon.webp`
  - `Italian Ice -> /dishes/generated-cache/generated-italian-ice.webp`
- 本批未提升但已目检的风险项：
  - `cheesy-garlic-bread`：图更像普通烤芝士吐司，不够像蒜香面包。
  - `marinara`：图更像海鲜意面，容易误导披萨/番茄酱语义。
  - `artichoke-dip`、`braised-pork-belly`、`caesar`：本轮暂不提升，留待后续更系统的类别/菜单高频排序。
- 改动：
  - 新增 7 张稳定 webp 到 `public/dishes/generated-cache/`。
  - `public/generated-dish-local-index.json` 从 43 条增至 50 条，新增条目的 `source` 为 `manual_visual_generated`。
  - `tests/logic-regressions.test.mjs` 新增回归测试 `visually reviewed runtime images are reusable as stable generated-cache dish images`。
- 最新诊断：
  - 知识库总数：1022。
  - 本地知识图：812。
  - 已提升生成缓存：50。
  - `generated_local_promoted_source_files`：50。
  - `generated_local_unstable_unpromoted`：160。
  - 稳定本地覆盖率：84.3%。
- 验证：
  - RED：新增 7 道菜稳定缓存断言后，旧状态按预期失败于 `Battered Onion Rings`。
  - GREEN：写入 generated-cache 和本地索引后，目标测试通过。
  - 当前执行 `node --test tests/logic-regressions.test.mjs --test-name-pattern "visually reviewed runtime images"` 实际跑完 140 条回归，140/140 通过。
  - `node scripts/diagnose-dish-images.mjs "Battered Onion Rings" "Chicken Wings" "Crispy Fried Calamari" "Egyptian Falafels" "Garlic Prawns" "Grilled Salmon" "Italian Ice"`：7 个均命中 `promoted_generated_cache`。

2026-08-06 未稳定生成图目检工具增强：

- 目标：
  - 让“图片本地化/错图清理”从手工拼命令变成可重复流程。
  - 后续处理剩余 `generated_local_unstable_unpromoted: 160` 时，可以一条命令生成候选 JSON 和目检联系表，减少人工筛图成本。
- 改动：
  - `scripts/promote-generated-dish-images.mjs` 新增 `--contact-sheet=<path>`。
  - `--unstable-report` 现在额外返回 `unstable_report.review_candidates`。
  - 新增候选字段：
    - `candidate_name`
    - `thumbnail_path`
    - `review_priority`
    - `next_action: manual_visual_review_contact_sheet`
  - 联系表采用暖色卡片、细边框、菜名和 storage id，便于快速目检，不影响生产代码。
- 使用方式：
  - `node scripts/promote-generated-dish-images.mjs --unstable-report --limit=16 --contact-sheet=/tmp/dishlens-generated-review-candidates-20260806.png`
- 当前真实输出：
  - 联系表：`/tmp/dishlens-generated-review-candidates-20260806.png`
  - 候选数：16
  - 第一批候选包含 `Ai Funghi`、`Albacore Tuna Lof`、`Artichoke Dip`、`Battered Whiting`、`Bigspicy Chicken Wrap` 等。
- 目检发现：
  - 该批里有明显错图或上下文不安全项，例如 `Beef Steak` 实际看起来像一杯深色酱/甜品，不能直接提升。
  - `Bottle` 是海鲜拼盘但名字是泛名，也不应提升为全局菜品图。
  - 这证明 contact sheet 很有必要，不能只靠 storage id 自动提升。
- 验证：
  - RED：新增 `generated image promotion script can render a visual review contact sheet` 后，旧脚本按预期失败，因为没有 `--contact-sheet`。
  - GREEN：实现 `buildReviewCandidates()` 和 `renderContactSheet()` 后通过。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "contact sheet|unpromoted unstable|visually reviewed"`：当前实际跑完 141 条回归，141/141 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖率仍为 84.3%，本轮是工具增强，未自动提升新图片。

2026-08-06 contact sheet 第二批稳定化：

- 目标：
  - 继续把已目检可靠的运行时生成图提升为跨部署稳定缓存。
  - 修复短菜名/相近菜名误匹配，尤其是 `Ai Funghi` 与 `Risotto ai Funghi Porcini` 这类共享关键词但实际菜品不同的场景。
- 本批提升 8 张：
  - `Ai Funghi -> /dishes/generated-cache/generated-ai-funghi.webp`
  - `Artichoke Dip -> /dishes/generated-cache/generated-artichoke-dip.webp`
  - `Battered Whiting -> /dishes/generated-cache/generated-battered-whiting.webp`
  - `Bigspicy Chicken Wrap -> /dishes/generated-cache/generated-bigspicy-chicken-wrap.webp`
  - `Blette A La Ligure -> /dishes/generated-cache/generated-blette-a-la-ligure.webp`
  - `Braised Pork Belly -> /dishes/generated-cache/generated-braised-pork-belly.webp`
  - `Cafe Gourmand -> /dishes/generated-cache/generated-cafe-gourmand.webp`
  - `Cauliflower Aged Cheddar Croquettes -> /dishes/generated-cache/generated-cauliflower-aged-cheddar-croquettes.webp`
- 关键匹配修复：
  - `GeneratedDishLocalEntry` 新增 `context_terms`，短名生成缓存只有在菜单上下文满足条件时才允许短语/包含匹配。
  - `Ai Funghi` 生成缓存增加 `pizza/pizzas/pizzeria/披萨` 上下文保护，避免抢走 `Risotto ai Funghi Porcini`。
  - 新增直接别名：
    - `Caesar` / `Caesar Salad` / `凯撒沙拉 -> caesar-salad`
    - `Capriccioza` / `Capricciosa` / `Pizza Capricciosa -> pizza-capricciosa`
  - 生产匹配器 `src/lib/dish-image-match.ts` 与诊断脚本 `scripts/diagnose-dish-images.mjs` 已保持一致。
- 最新诊断：
  - 知识库总数：1022。
  - 本地知识图：812。
  - 已提升生成缓存：58。
  - 已提升生成缓存文件：58。
  - 仍依赖远程/AI：210。
  - 运行时生成但未稳定提升：152。
  - 稳定本地覆盖率：85.1%。
- 抽样诊断：
  - `Ai Funghi` 返回 `promoted_generated_cache / local-generated-ai-funghi`。
  - `Risotto ai Funghi Porcini` 返回 `local_knowledge / risotto-ai-funghi`。
  - `Artichoke Dip`、`Battered Whiting`、`Bigspicy Chicken Wrap`、`Blette A La Ligure`、`Braised Pork Belly`、`Cafe Gourmand`、`Cauliflower Aged Cheddar Croquettes` 均返回 `promoted_generated_cache`。
  - `Caesar` 返回 `local_knowledge / caesar-salad`。
  - `Capriccioza` 返回 `local_knowledge / pizza-capricciosa`。
- promotion audit 修复：
  - `scripts/promote-generated-dish-images.mjs` 新增 `already_promoted_source_files`。
  - 已提升源文件不再被误算进未稳定风险池。
  - 当前 `--unstable-report --limit=1` 显示：
    - `total_generated_files: 210`
    - `already_promoted_source_files: 58`
    - `total_unstable_unpromoted: 152`
    - `unmapped_generated_files: 145`
- 验证：
  - RED：新增 contact-sheet reviewed 稳定缓存测试后，旧实现按预期失败于 `Ai Funghi` 误命中 `risotto-ai-funghi`。
  - GREEN：加入 `context_terms` 与 8 张稳定缓存后，目标测试通过。
  - `node --test tests/logic-regressions.test.mjs`：142/142 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 下一步建议：
  - 继续处理剩余 `152` 张未稳定运行时生成图，优先从有清晰菜名、无泛名、无已有本地图重复的候选开始。
  - 对 `unmapped_local_knowledge_duplicates: 13` 设计 dry-run 清理流程；这些已有稳定本地图，不应继续污染运行时风险池。
  - 保持“人工目检后再提升”的规则，避免把错图固化进 `generated-cache`。

2026-08-06 contact sheet 第三批稳定化：

- 目标：
  - 继续降低结果页和详情页对运行时图片、Supabase、AI 生图的依赖。
  - 只提升“菜名具体且图片语义明确”的候选，跳过泛名、错图和上下文危险项。
- 目检联系表：
  - `/tmp/dishlens-generated-review-candidates-20260806-next.png`
- 本批提升 10 张：
  - `Cheese Bombs -> /dishes/generated-cache/generated-cheese-bombs.webp`
  - `Chef Salad -> /dishes/generated-cache/generated-chef-salad.webp`
  - `Chicken Maharaja Mac -> /dishes/generated-cache/generated-chicken-maharaja-mac.webp`
  - `Crumbed Lamb Loin Chops -> /dishes/generated-cache/generated-crumbed-lamb-loin-chops.webp`
  - `Espresso -> /dishes/generated-cache/generated-espresso.webp`
  - `Eye Fillet -> /dishes/generated-cache/generated-eye-fillet.webp`
  - `Farfalle -> /dishes/generated-cache/generated-farfalle.webp`
  - `Field Greens With Balsamic Vinaigrette -> /dishes/generated-cache/generated-field-greens-with-balsamic-vinaigrette.webp`
  - `Filet O Fish -> /dishes/generated-cache/generated-filet-o-fish.webp`
  - `Fisherman S Basket -> /dishes/generated-cache/generated-fisherman-s-basket.webp`
- 本批跳过/保留风险池：
  - `Beef Steak`：联系表里实际像深色酱汁，不像牛排，不能提升。
  - `Bottle`：图是海鲜拼盘但名字是泛名，不适合全局匹配。
  - `Dessert` / `Desserts` / `Drinks`：泛名，不应作为全局菜品图。
  - `Caesar` / `Capriccioza`：已有稳定本地图，保留现有 canonical 命中，不提升重复运行时图。
  - `Cheesy Garlic Bread`：更像芝士吐司，蒜香面包身份不够明确，暂不提升。
  - `Chicken Piccata`：图片更像鸡腿，不像 piccata，暂不提升。
- 额外修正：
  - 初次写入时 `Espresso` 误加 `Expresso` 别名，导致旧法语菜单里的 `EXPRESSO` 被抢到新图。
  - 已移除该别名，`Espresso` 命中新图，`Expresso` 继续命中既有 `generated-expresso`。
- 最新诊断：
  - 知识库总数：1022。
  - 本地知识图：812。
  - 已提升生成缓存：68。
  - 已提升生成缓存文件：68。
  - 仍依赖远程/AI：210。
  - 运行时生成但未稳定提升：142。
  - 稳定本地覆盖率：86.1%。
- 抽样诊断：
  - 本批 10 张均返回 `promoted_generated_cache`。
  - `Beef Steak`、`Dessert`、`Drinks` 仍返回 `generated_local_unstable`，符合预期。
- 验证：
  - RED：新增 `second contact-sheet reviewed runtime images are promoted only for specific safe dishes` 后，旧状态按预期失败于 `Cheese Bombs` 未命中稳定缓存。
  - GREEN：写入 10 张稳定缓存和索引后，目标测试通过。
  - 回归捕获并修复 `Espresso/Expresso` 别名污染后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "second contact-sheet reviewed|verified generated dish images"`：143/143 通过。

2026-08-06 contact sheet 第四批稳定化与风险阻断：

- 目标：
  - 让联系表候选池更干净：已目检不安全、泛名、已有 canonical 本地图覆盖的运行时图不再反复出现。
  - 继续提升菜名明确、视觉语义稳定的海外常见快餐/饮品/沙拉/意面图，减少结果页图片等待。
- 新增阻断项：
  - 已有 canonical 覆盖或重复项：
    - `generated-albacore-tuna-lof`
    - `generated-caesar`
    - `generated-capriccioza`
    - `generated-heirloom-tomato-lvg`
  - 菜名单品/品牌语义过强，不适合全局复用：
    - `generated-borgo-signature`
    - `generated-la-burrata-du-moment-l-inspiration-du-chef-mauro`
    - `generated-long-paddock-driftwood-lgeo`
  - 泛名/section title：
    - `generated-main-course`
    - `generated-main-courses`
  - 歧义或错图：
    - `generated-marinara`：图像像海鲜意面，容易误导披萨/番茄酱语义。
- 本批提升 9 张：
  - `Coffee Tea -> /dishes/generated-cache/generated-coffee-tea.webp`
  - `Garlic Bread -> /dishes/generated-cache/generated-garlic-bread.webp`
  - `Green Tea -> /dishes/generated-cache/generated-green-tea.webp`
  - `Grilled Chicken Breast -> /dishes/generated-cache/generated-grilled-chicken-breast.webp`
  - `House Salad -> /dishes/generated-cache/generated-house-salad.webp`
  - `Iceburg/Iceberg Salad -> /dishes/generated-cache/generated-iceburg-salad.webp`
  - `Kanelone/Cannelloni -> /dishes/generated-cache/generated-kanelone.webp`
  - `Linguine Pesto -> /dishes/generated-cache/generated-linguine-pesto.webp`
  - `Mcchicken -> /dishes/generated-cache/generated-mcchicken.webp`
- 最新诊断：
  - 知识库总数：1022。
  - 本地知识图：812。
  - 已提升生成缓存：77。
  - 已提升生成缓存文件：77。
  - 阻断项：22。
  - 仍依赖远程/AI：210。
  - 运行时生成但未稳定提升：133。
  - 稳定本地覆盖率：87.0%。
- 抽样诊断：
  - 本批 9 张均返回 `promoted_generated_cache`。
  - `Marinara` 返回 `local_knowledge / pizza-marinara`，不会命中错误运行时图。
  - `Main Course` 仍返回 `generated_local_unstable`，不会进入稳定缓存。
- 验证：
  - RED：扩展 `visual-review rejected runtime images are blocked from future contact sheets` 和新增 `third contact-sheet reviewed runtime images add common overseas quick-order dishes` 后，旧状态按预期失败。
  - GREEN：补充 blocklist 和 9 张稳定缓存后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "visual-review rejected|third contact-sheet"`：145/145 通过。

2026-08-06 大菜单图片 deferred 状态修复：

- 目标：
  - 兼顾 100-200 道菜大菜单的速度和可用性：后台只优先生成首批高价值图片，但不能把被延后的图片误报为全部完成。
- 问题：
  - 上传路径和 cache-probe 路径都会根据菜单规模限制实际 AI 生图数量。
  - 超出上限的代表菜会被标记为 `image_status: "deferred"`。
  - 旧逻辑只要首批图片没有失败，最终 `image_generation_status` 就写成 `done`，这会让用户误以为所有菜品图都完成了。
- 修复：
  - `src/app/api/v1/translate/menu/route.ts`：
    - 增加 `hasDeferredImageGeneration = deferredDishesForGeneration.length > 0`。
    - 当存在 deferred 且首批没有失败时，最终状态写为 `partial`，不是 `done`。
  - `src/app/api/v1/translate/menu/cache/route.ts`：
    - cache 命中后台补图同样使用 `hasDeferredImageGeneration = deferredRepresentatives.length > 0`。
    - 保持上传路径与重复上传路径一致。
  - `src/components/results/ResultsPage.tsx`：
    - 当状态为 `partial` 且存在 deferred 图片，即使首批进度已经 `done/total`，顶部也显示“首批图片已完成 · X 张稍后补图”。
    - 用户能理解这是大菜单分批补图策略，不会把剩余占位误认为崩溃或图片失效。
- 价值：
  - 200 道菜菜单不需要等待全部图片生成即可使用。
  - 首屏和首批高价值图片更快出现，同时状态表达更诚实。
  - 历史、轮询和分享页不会把 deferred 误判成完整图片完成。
- 验证：
  - RED：更新 `large-menu backfill` 与 `cache-probe image refresh` 断言后，旧实现按预期失败。
  - GREEN：两条后台路径 final status 改为 deferred-aware 后通过。
  - RED/GREEN：新增结果页 `hasDeferredImageBackfill` 与“首批图片已完成”提示断言后通过。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "results page explains background|large-menu backfill|cache-probe image refresh|AI generated dish images"`：145/145 通过。

2026-08-06 大菜单 deferred 不再重入图片队列：

- 目标：
  - 继续降低 100-200 道菜菜单的后台图片压力，避免 fast first pass 后的 enrichment 或缓存刷新把“稍后补图”的菜重新改成 `pending` 并再次触发 AI 生图。
- 问题：
  - `resultNeedsImageRefresh()` 只排除了 `failed`，没有排除 `deferred`。
  - `generateImagesInBackground()` 只按 `!dish.ai_image_url` 过滤，因此 enrichment 阶段如果排队了新的 result payload，可能把已 deferred 的菜再次标记为 `pending`。
  - 这会破坏大菜单降载策略，让后台图片任务变长，增加 Wan/DashScope 成本，也会让用户在列表和详情页看到更久的生成中状态。
- 修复：
  - `src/app/api/v1/translate/menu/route.ts`：
    - `resultNeedsImageRefresh()` 现在排除 `image_status === "deferred"`。
    - `generateImagesInBackground()` 现在只处理同时满足 `!ai_image_url`、`!image_url` 且非 `deferred` 的菜品。
  - `tests/logic-regressions.test.mjs`：
    - 上传主路由与 cache route 一样，要求 deferred 不被视为待刷新缺图。
    - 生图队列过滤明确要求排除已有 `image_url` 和 `deferred`。
- 价值：
  - 大菜单首次识别后的首批图片策略不会被后续 enrichment 覆盖。
  - 重复上传缓存命中和首次上传路径语义一致：`deferred` 是“稍后补图”，不是“继续无限排队”。
  - 降低海外弱网和大菜单场景下的长时间 pending、重复生图和图片任务拥塞风险。
- 验证：
  - RED：`node --test tests/logic-regressions.test.mjs --test-name-pattern "cached menu results refresh|AI generated dish images"` 先按预期失败。
  - GREEN：实现 deferred 过滤后，同命令 145/145 通过。
  - 全量：`node --test tests/logic-regressions.test.mjs`：145/145 通过。
  - 全量：`npm run lint`：通过。
  - 全量：`npm run build`：通过。

2026-08-06 真实菜单 benchmark suite 与缓存测速修正：

- 目标：
  - 后续优化“首次识别慢 / 重复上传快 / 图片补齐慢”时，需要一个可批量跑真实菜单的测速入口，而不是每次手动跑单张图片并手工整理结果。
- 新增与修复：
  - 新增 `scripts/benchmark-menu-suite.mjs`，批量调用 `scripts/benchmark-menu-flow.mjs`，聚合多张真实菜单的首屏、文字完成、缓存命中、图片缺失、失败桶和慢样本。
  - suite 支持 `--base-url`、`--target-lang`、`--repeat`、`--cache-probe`、`--image-timeout-ms`、`--continue-on-error`。
  - 修复 suite 子进程调用方式，显式使用 `execFile(process.execPath, ...)`，让测试和实现一致。
  - 修复缓存命中统计污染：当 run 为 `cached_immediate` 时，不再把历史 `metadata.timings.firstPassModelMs` 或历史模型名计入本次 suite 的 `p50_first_pass_model_ms` / `first_pass_model_names`。
  - `scripts/benchmark-menu-suite.mjs` 现在可被测试导入；导出的 `summarizeSuite()` 有行为级回归测试。
  - 子 benchmark 失败时，suite report 会保留失败子进程的 `stdout` / `stderr`，方便排查 provider 超时、HTTP 错误或 JSON 解析失败。
- 本地真实菜单验证：
  - 本地服务：`http://localhost:3011`。
  - 命令：
    - `node scripts/benchmark-menu-suite.mjs --base-url http://localhost:3011 --target-lang zh --image-timeout-ms 0 --timeout-ms 120000 --cache-probe --continue-on-error /Users/julian/Documents/菜单/20260522-184232.jpg /Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg`
  - 结果：
    - 两张菜单均 `cache_probe_hit=true`。
    - `p50_first_result_ms=112ms`，`p90_first_result_ms=134ms`。
    - `cache_probe_hit_rate=1`。
    - `image_missing_total=0`。
    - `p50_first_pass_model_ms=null`，说明缓存秒回报告不再混入历史首次模型耗时。
- 结论：
  - 重复上传 / 缓存路径已经非常快，并且图片完整。
  - 首次识别慢仍需用冷启动或 cache-bust benchmark 单独测；当前 suite 主要证明缓存路径和批量诊断能力。
- 验证：
  - RED：新增 `cached_immediate` 断言后，旧 suite 按预期失败。
  - GREEN：缓存命中 run 排除模型耗时和模型名后通过。
  - 代码审查后补强：新增行为测试，确认 cached run 不污染 `p50_first_pass_model_ms` 和 `first_pass_model_names`；新增失败诊断测试，确认 stdout/stderr 不丢失。
  - 全量：`node --test tests/logic-regressions.test.mjs`：149/149 通过。
  - 全量：`npm run lint`：通过。
  - 全量：`npm run build`：通过。

2026-08-06 冷启动 cache-bust benchmark 与首次识别瓶颈确认：

- 目标：
  - 热缓存路径已经证明能 100ms 级返回，但首次新菜单仍慢。为了不靠清缓存或破坏线上数据，需要一个“临时改图、强制新哈希”的真实菜单冷启动测速能力。
- 新增与修复：
  - `scripts/benchmark-menu-flow.mjs` 新增 `--cache-bust` / `--no-cache-bust`。
    - 开启后，每次 repeat 都会把输入菜单复制到系统临时目录，并在左上角合成 6x6 像素小色块。
    - 原始菜单文件不变；临时图 OCR 内容基本不变，但 raw/server-normalized hash 会变化，从而模拟“新用户第一次上传新菜单”。
    - run 结果新增 `cache_bust_enabled` 与 `cache_bust_image_count`。
  - `scripts/benchmark-menu-suite.mjs` 新增 `--cache-bust` / `--no-cache-bust` 并透传到 flow。
  - 修复 suite 缓存命中率噪音：没有执行 cache probe 的冷启动 run 不再被统计为 `cache_probe_hit_rate=0`，而是保持 `null`，避免把冷启动实验误判成缓存系统异常。
- 本地真实菜单验证：
  - 本地服务：`http://localhost:3011`。
  - 冷启动命令：
    - `node scripts/benchmark-menu-suite.mjs --base-url http://localhost:3011 --target-lang zh --image-timeout-ms 0 --timeout-ms 120000 --cache-bust --continue-on-error '/Users/julian/Documents/菜单/20260522-184232.jpg'`
  - 冷启动结果：
    - `p50_first_result_ms=13763ms`。
    - `p50_first_pass_model_ms=12883ms`。
    - `upload_response_ms=15ms`。
    - `dish_count=15`，首屏文字完成时 `image_ready=11`、`image_missing=4`。
    - `cache_probe_hit_rate=null`，符合未启用 cache probe 的语义。
  - 热缓存对照命令：
    - `node scripts/benchmark-menu-suite.mjs --base-url http://localhost:3011 --target-lang zh --image-timeout-ms 0 --timeout-ms 120000 --cache-probe --continue-on-error '/Users/julian/Documents/菜单/20260522-184232.jpg'`
  - 热缓存结果：
    - `cache_probe_hit=true`，`cache_probe_ms=28ms`。
    - `first_result_ms=124ms`，`text_done_ms=124ms`。
    - `image_ready=15`，`image_missing=0`。
    - `p50_first_pass_model_ms=null`，说明缓存路径没有混入历史模型耗时。
- 结论：
  - 当前“重复上传 / 已缓存菜单”已经很快，图片也完整。
  - 当前“首次新菜单”主要瓶颈是云端视觉模型：本次上传只 15ms，模型调用 12.883s，占首屏 13.763s 的绝大部分。
  - 下一步速度优化应该优先做 fast-first-pass provider A/B、首轮 prompt/输入图进一步压缩、大菜单按页早返回，而不是继续盲目优化上传或本地解析。
  - 图片缺失 4 张仍说明本地图库与 promoted generated-cache 还应继续补齐；这会减少首次菜单里需要进入后台 AI 生图的数量，但不会直接解决 12s 级 OCR 模型延迟。
- 验证：
  - RED：新增 flow/suite cache-bust 断言后，旧实现按预期失败。
  - GREEN：实现临时图 cache-bust、suite 透传参数后，benchmark 相关测试通过。
  - RED：新增“未执行 cache probe 不应报告缓存命中率”行为测试后，旧 suite 按预期失败。
  - GREEN：flow 默认 `cache_probe_hit=null`，suite 只统计 `cache_probe_ms` 有值的 run 后通过。
  - 代码审查后补强：suite 子进程 timeout 现在使用 `(timeoutMs + imageTimeoutMs + 30000) * repeat`，避免 `--repeat 2+` 的冷启动 benchmark 被提前杀死，并降低 temp cache-bust 目录残留风险。
  - 全量：`node --test tests/logic-regressions.test.mjs`：150/150 通过。
  - 全量：`npm run lint`：通过。
  - 全量：`npm run build`：通过。

2026-08-06 fast first-pass A/B cache-bust 跨运行污染修复：

- 发现：
  - `scripts/benchmark-fast-first-pass-models.mjs` 的临时图片色块只按 `model/run/imageIndex` 生成，跨脚本重复运行时可能生成同一张临时图，导致 A/B benchmark 命中旧翻译缓存。
  - 结果表现为 `first_result_ms` 看起来只有 100ms 级，但 `firstPassModelMs` 仍保留历史 14s/34s 数据，容易误判模型速度。
- 修复：
  - 新增 `cacheBustSessionId = process.pid + Date.now() + Math.random()`。
  - `cacheBustColor()` 把 session id 纳入 hash，每次脚本运行都会生成不同临时图，避免跨运行缓存污染。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "fast first-pass model benchmark"`：150/150 通过。
- 后续：
  - 重新用 3-5 张真实菜单跑 `benchmark-fast-first-pass-models.mjs` 后，才能把模型 A/B 结论作为线上配置依据。

2026-08-06 fast first-pass 模型 A/B 初步结论：

- 验证命令 1：
  - `node scripts/benchmark-fast-first-pass-models.mjs --models qwen-vl-plus,qwen-vl-max --target-lang zh --repeat 1 --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/20260522-184232.jpg'`
- 结果 1：
  - `qwen-vl-plus`：`cached_immediate=false`，`first_result_ms=15217ms`，`firstPassModelMs=14255ms`，15 道菜，11 张图 ready，4 张后台补图。
  - `qwen-vl-max`：`cached_immediate=false`，`first_result_ms=25750ms`，`firstPassModelMs=24893ms`，15 道菜，12 张图 ready，3 张后台补图。
- 验证命令 2：
  - `node scripts/benchmark-fast-first-pass-models.mjs --models qwen-vl-plus,qwen-vl-max --target-lang zh --repeat 1 --image-timeout-ms 0 --timeout-ms 120000 '/Users/julian/Documents/菜单/微信图片_20260523192458_157_838.jpg'`
- 结果 2：
  - `qwen-vl-plus`：`cached_immediate=false`，`first_result_ms=15190ms`，`firstPassModelMs=13849ms`，17 道菜，16 张图 ready，1 张后台补图。
  - `qwen-vl-max`：`cached_immediate=false`，`first_result_ms=22702ms`，`firstPassModelMs=22161ms`，17 道菜，16 张图 ready，1 张后台补图。
- 结论：
  - 两张真实菜单都显示 `qwen-vl-plus` 明显快于 `qwen-vl-max`，且没有缓存污染。
  - 当前线上/本地首屏 fast path 继续以 `qwen-vl-plus` 作为默认更合理；`qwen-vl-max` 不适合作为首屏模型，可保留给后台 enrichment 或疑难回退。
  - 如果要把首次识别从 14-15s 继续压到 5-8s，需要引入更快视觉/OCR provider 对比，或把首轮改为更粗粒度的“菜名+价格先出，描述和推荐后台补全”策略。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "fast first-pass model benchmark"`：150/150 通过。
  - `npm run lint`：通过。

2026-08-06 稳定本地图库推进到 90%：

- 目标：
  - 继续减少海外菜单首次结果页对远程图、Supabase 和实时 AI 生图的依赖，降低坏图和分享页跨设备失效概率。
- 操作：
  - 生成并目检联系表：`.cache/generated-review-candidates-2026-08-06-c.png`。
  - 跳过泛化/上下文危险项：`Banksia`、`S228`、`Set`、`Water`、`Vegetarian`、`Salads`、`Pasta` 等。
  - 用 `scripts/promote-generated-dish-images.mjs --reviewed-ids=... --apply` 提升 5 张目检合格运行时图：
    - `generated-neapolitan`
    - `generated-papalina`
    - `generated-porridge-v`
    - `generated-selection-of-french-cheese`
    - `generated-soupe-de-saison`
- 结果：
  - `node scripts/diagnose-dish-images.mjs --summary`：
    - `local_knowledge=812`
    - `promoted_generated_cache=108`
    - `generated_local_unstable_unpromoted=103`
    - `stable_local_with_promoted_coverage_percent=90`
  - 注意：`Neapolitan` 同时已被 `pizza-napoletana` 本地知识图覆盖，后续统计应继续关注“真实缺口命中”，不要只看 promoted 数量。
- 规格/饮食标记匹配修复：
  - 发现 `Sydney Rock Oysters, Mignonette` 普通菜名无法命中已有 `SYDNEY ROCK OYSTERS, MIGNONETTE L GF DF` / `LG OF` 稳定图。
  - 在 `src/lib/dish-image-match.ts` 的 generated-cache 匹配层增加受限后缀变体：仅剥离 `L/LG/GF/DF/OF`，并保留精确完整菜名优先级。
  - 同步 `scripts/diagnose-dish-images.mjs`，避免诊断脚本误报 `ai_pending`。
  - 没有全局改 `normalizeDishText`，避免 `TRUFFLE PECORINO FRIES` 等当前运行时图被稳定缓存提前覆盖。
- 验证：
  - `node scripts/diagnose-dish-images.mjs 'Sydney Rock Oysters, Mignonette' --json`：命中 `promoted_generated_cache`。
  - `node --test tests/logic-regressions.test.mjs`：150/150 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续：
  - 继续处理剩余 `generated_local_unstable_unpromoted=103`，优先选菜名具体、视觉身份明确、没有本地知识图重复的候选。
  - 对 promoted 统计补一个“去重覆盖”指标，避免重复条目让覆盖率看起来比真实缺口修复更乐观。

2026-08-06 图片覆盖诊断新增去重口径：

- 目标：
  - 上一轮 summary 显示 `stable_local_with_promoted_coverage_percent=90`，但其中存在 `Neapolitan` 这类 promoted generated-cache 条目已被本地知识库覆盖的重复项。
  - 需要区分“promoted 数量增加”和“真正新增稳定覆盖”，避免后续图片治理被表面覆盖率误导。
- 新增指标：
  - `promoted_generated_cache_unique_new`：promoted generated-cache 中没有被本地知识库覆盖的条目数。
  - `promoted_generated_cache_duplicate_local`：promoted generated-cache 中已能通过本地知识库命中的重复条目数。
  - `stable_local_deduped_coverage_percent`：`local_knowledge + unique_new promoted` 计算出的去重稳定覆盖率。
- 当前诊断结果：
  - `promoted_generated_cache=108`
  - `promoted_generated_cache_unique_new=97`
  - `promoted_generated_cache_duplicate_local=11`
  - `stable_local_with_promoted_coverage_percent=90`
  - `stable_local_deduped_coverage_percent=88.9`
- 结论：
  - 表面稳定覆盖已经到 90%，但去重后有效稳定覆盖是 88.9%。
  - 下一轮图片补齐应优先处理真正新增覆盖项，而不是继续提升已经被本地知识库覆盖的重复生成图。
- 验证：
  - RED：新增 summary 字段和数学关系断言后，旧诊断脚本按预期失败。
  - GREEN：实现 `promotedGeneratedCacheCoverage()` 后通过。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "dish image diagnostics"`：150/150 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-06 知识库本地图继续推进到 93.2% 稳定覆盖：

- 目标：
  - 继续减少结果页和分享页对远程图、实时 AI 生图、临时 signed URL 的依赖。
  - 对“已进入本地图库但目检不够像”的条目先修正，避免错误图片被稳定缓存固化。
- 质量修正：
  - `patbingsu` 已重生成：从杯装/饮品感改为宽碗韩式刨冰，红豆、糯米团/水果和碎冰更清楚。
  - `princess-cake` 已重生成：从白色奶油圆点心改为瑞典公主蛋糕，绿色杏仁糖外层、切面和粉色玫瑰明确。
  - `roti-prata` 已重生成：从松饼/煎蛋叠层改为带咖喱蘸汁的分层新加坡煎饼。
  - `semifreddo` 已重生成：从奶油团改为有结构的意式半冻甜品切片。
- 新增本地知识图/本地化条目：
  - `picarones`
  - `pisang-goreng`
  - `prosciutto-e-melone`
  - `ravioli-ricotta-spinaci`
  - `rigatoni-alla-norma`
  - `samgyeopsal`
  - `satay-indonesian`
  - `spanish-tortilla`
  - `porridge-scandinavian`
  - `pulao`
  - `rasmalai`
  - `rocoto-relleno`
  - `roti-prata`
  - `ruam-mit`
  - `scandinavian-waffle`
  - `semifreddo`
- 去重复用：
  - `satay-singaporean` 复用 `satay-indonesian`
  - `satay-thai` 复用 `satay-indonesian`
  - 这验证了 knowledge backfill 脚本的等价本地图复用路径，避免同名跨地区菜重复生成。
- Prompt 质量保护：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 新增/加强专项提示：
    - `patbingsu`
    - `picarones`
    - `princess-cake`
    - `roti-prata`
    - `semifreddo`
  - `tests/logic-regressions.test.mjs` 同步加断言，防止后续 prompt 回退导致错图再次进入本地库。
- 当前诊断结果：
  - `total_entries=1022`
  - `local_knowledge=844`
  - `promoted_generated_cache=108`
  - `promoted_generated_cache_unique_new=97`
  - `promoted_generated_cache_duplicate_local=11`
  - `pollinations_remote=178`
  - `ai_pending_or_remote=178`
  - `generated_local_unstable_unpromoted=103`
  - `local_knowledge_coverage_percent=82.6`
  - `stable_local_with_promoted_coverage_percent=93.2`
  - `stable_local_deduped_coverage_percent=92.1`
- 验证：
  - `node scripts/diagnose-dish-images.mjs Princess\ Cake Roti\ Prata Semifreddo Pulao Rasmalai Rocoto\ Relleno Ruam\ Mit Scandinavian\ Waffle Satay --json`：全部命中 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "Wan knowledge image backfill"`：150/150 通过。
- 后续：
  - 继续从 `node scripts/plan-knowledge-image-backfill.mjs --limit=30` 里挑选真正高频、视觉身份明确的缺口，优先补 `shahi-paneer`、`tacos-al-pastor`、`tamagoyaki`、`tebasaki`、`tempura-vegetable`、`teriyaki-chicken`、`thai-spring-rolls`、`tortellini-panna`、`tostada-con-tomate`、`tres-leches-cake`。
  - 每批继续保留人工目检 contact sheet；错图必须先修 prompt 再入库，不要只追覆盖率数字。

2026-08-06 大菜单图片分批策略可解释化：

- 背景：
  - 当前大菜单图片策略已经按菜单规模限流：普通菜单默认最多先补 24 张图，80+ 道菜先补 16 张，160+ 道菜先补 8 张。
  - 这个策略对系统稳定和海外弱网很重要，但用户只看到“排队/稍后补图”时，容易误判为系统坏图或卡住。
- 本轮改动：
  - 新增 `metadata.image_generation_batch_limit`，记录本次图片后台补齐的首批重点图上限。
  - `/api/v1/translate/menu` 和 `/api/v1/translate/menu/cache` 都会写入该字段，缓存命中后后台补图也保持一致。
  - `buildResultSyncSignature()` 纳入 `image_generation_batch_limit`，轮询拿到分批策略变化时会触发 UI 更新。
  - `ResultsPage` 图片补齐 banner 改成更产品化的解释：
    - 大菜单场景显示类似“这份菜单较长，先生成 8 张重点图，其余按需补图。”
    - 首批完成但仍有 deferred 图时，显示“稍后按需补图，菜单可以先看。”
  - `TranslationResult.metadata` 类型同步补 `image_generation_batch_limit?: number`。
- 价值：
  - 200 道菜场景不会把所有缺图都压进实时 AI 生图队列，降低超时、崩溃和海外网络波动风险。
  - 用户能理解系统是在“先保证可读菜单和重点图”，而不是图片生成失败。
  - 后续诊断也能直接看到当前任务采用了几张图的首批上限。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "results image backfill|AI generated dish images"`：当前环境实际跑完 150/150，通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。
- 后续：
  - 如果要继续提升 200 道菜的最终图片完整度，可以增加“按用户滚动/点击详情触发单菜按需生图”的 API 与前端入口，而不是后台一次性生成全部 200 张。

2026-08-06 deferred 单菜按需补图闭环：

- 背景：
  - 上一轮大菜单策略会把超出首批上限的缺图菜标记为 `image_status: "deferred"`，避免 100-200 道菜菜单一次性触发大量 AI 生图。
  - 但 deferred 菜如果用户真的点进详情页查看，之前只能看到“图片稍后补图”，缺少主动生成入口，体验像卡住。
- 本轮改动：
  - `src/lib/api-client.ts` 新增 `generateDishImageForDish(dish)`，复用现有 `/api/v1/dish/[id]/generate-image` 单菜生图 API。
  - `src/components/shared/DishImageWithLoading.tsx` 对 `deferred` 状态展示“现在生成”按钮；失败图仍保留“重试”。
  - `src/components/dish/DishDetailPage.tsx` 接收 `imageGenerating` 与 `onGenerateImage`，详情 Hero 图居中展示加载动画时可直接触发单菜生成。
  - `src/app/page.tsx` 新增 `handleGenerateSelectedDishImage()`：
    - 点击后只生成当前详情菜品，不恢复整份菜单后台队列。
    - 生成中同步把当前菜状态改为 `generating`。
    - 成功后写入 `ai_image_url` / `image_url` / `image_status: "done"`，并同步更新当前 `translationResult`，返回列表后同一菜品直接显示新图。
    - 如果该菜原本是 `deferred`，成功后 `metadata.image_generation_deferred_total` 减 1，顶部提示不会停留在旧数量。
    - 失败时标记 `image_status: "failed"` 与错误信息，用户可再次重试。
- 价值：
  - 200 道菜场景继续保持首屏轻量与系统稳定，同时给用户“我关心哪道就先补哪道”的控制权。
  - 不需要为了查看某一道菜而让系统排队生成整份菜单所有图片。
  - 已生成图片仍走现有持久化链路，后续同名菜可被缓存复用。
- 验证：
  - RED：`deferred dish detail images can be generated on demand without resuming the full menu queue` 先因缺少 `generateDishImageForDish` 按预期失败。
  - GREEN：实现 client、详情页入口、状态同步后通过。
  - `node --test tests/logic-regressions.test.mjs`：151/151 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。
- 后续：
  - 继续做“滚动到可视区域时按需预热少量 deferred 图”，但必须有速率限制，避免又退回一次性生成大量图片。
  - 继续补齐 `pollinations_remote=178` 和 `generated_local_unstable_unpromoted=103`，减少用户需要手动按需生图的概率。

2026-08-06 结果页 deferred 图片可见区小批量预热：

- 背景：
  - 详情页已经支持 deferred 单菜“现在生成”，但用户在 100-200 道菜列表里连续浏览时，如果每道都要点详情页再补图，仍然偏重。
  - 不能简单把所有 deferred 菜重新压进后台队列，否则会抵消大菜单分批策略，重新带来超时、排队和服务抖动。
- 本轮改动：
  - `src/components/results/ResultsPage.tsx` 新增视口预热逻辑：
    - 只观察 `image_status === "deferred"` 的结果卡片。
    - 使用 `IntersectionObserver`，卡片接近/进入视口后加入预热队列。
    - `RESULTS_DEFERRED_PREWARM_LIMIT = 2`，每批最多触发 2 道菜。
    - `RESULTS_DEFERRED_PREWARM_DELAY_MS = 900`，批次之间做轻量间隔。
    - `prewarmedDeferredDishIdsRef` 防止同一道菜反复触发。
    - `generatingDishIds` 防止正在生成的菜重复请求。
  - `src/app/page.tsx` 新增通用 `handleGenerateDishImage()`：
    - 供结果页可见区预热调用。
    - 复用已有单菜生图 API 和 `updateTranslationResultDishImage()` 状态同步。
    - 生成中集合用 `generatingDishIdsRef` + `generatingDishIds` 管理，避免同一道菜多次并发请求。
    - 成功后仍写入 `ai_image_url` / `image_url` / `image_status: "done"`，并复用现有 deferred 计数递减逻辑。
  - 详情页原有 `handleGenerateSelectedDishImage()` 保持独立，避免列表预热改动影响详情页手动补图体验。
- 价值：
  - 200 道菜菜单仍然不一次性生成全部图片。
  - 用户滚动看到的 deferred 菜会被温和预热，列表体验更像 App 的渐进加载，而不是大面积永久示意图。
  - 生成过的图片继续进入现有持久化/缓存链路，后续同名菜可复用。
- 验证：
  - RED：新增 `results page prewarms visible deferred dish images in small batches` 后，旧结果页缺少预热常量、观察器和 App 回调，测试按预期失败。
  - GREEN：实现后通过。
  - `node --test tests/logic-regressions.test.mjs`：152/152 通过。
  - `npm run lint`：通过，无 warning。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。
- 后续：
  - 需要用真实 80+ / 160+ 菜菜单在浏览器里观察 AI 生图请求节奏，确认滚动速度快时不会触发过多并发。
  - 可以考虑按网络状态或设备性能进一步动态调整 `RESULTS_DEFERRED_PREWARM_LIMIT`。

2026-08-06 结果页 deferred 预热增加海外弱网自适应：

- 背景：
  - 结果页可见区预热会让 App 体验更顺，但海外餐厅常见弱 Wi-Fi、漫游、地铁/商场网络和省流量模式。
  - 如果在这些网络下仍按默认节奏补图，可能抢占识别结果轮询、详情浏览和分享页加载的带宽。
- 本轮改动：
  - `src/components/results/ResultsPage.tsx` 新增 `getDeferredPrewarmPolicy()`。
  - 通过 Network Information API 的 `navigator.connection` 读取：
    - `saveData`
    - `effectiveType`
  - 策略：
    - `saveData`、`slow-2g`、`2g`：关闭 deferred 自动预热，保留详情页“现在生成”手动入口。
    - `3g`：每批 1 张，间隔 1800ms。
    - 其他/未知网络：保持默认每批 2 张，间隔 900ms。
  - 如果浏览器不支持 `navigator.connection`，走默认策略，不影响 Safari/iOS 等兼容性。
- 价值：
  - 在弱网或省流量模式下，优先保证菜单文字、推荐内容和详情浏览可用。
  - 在较好网络下，继续保留接近 App 的渐进补图体验。
  - 200 道菜菜单不会因快速滚动而在慢网下产生过多补图请求。
- 验证：
  - RED：新增 `results page adapts deferred image prewarm to weak overseas networks` 后，旧实现缺少网络策略，按预期失败。
  - GREEN：实现网络自适应策略后通过。
  - `node --test tests/logic-regressions.test.mjs`：153/153 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。
- 后续：
  - 真实浏览器验证时，可以在 Chrome DevTools 中切换 Save-Data/网络限速，观察 deferred 预热是否按策略停用或降速。
  - 如需更细，可把策略扩展到 `downlink` / `rtt`，但当前先用兼容度较好的 `effectiveType` 与 `saveData`。

2026-08-06 deferred 预热策略监听网络变化与构建修复：

- 背景：
  - 上一版弱网策略只在组件初始化时计算一次。如果用户进入结果页后网络从 Wi-Fi 掉到 2G/省流量，已有预热队列仍可能继续触发。
  - `next build` 同时暴露出 `NetworkInformationLike` 类型缺少 `addEventListener/removeEventListener`，导致生产构建类型检查失败。
- 本轮改动：
  - `src/components/results/ResultsPage.tsx` 将 deferred 预热策略保存在 state 中。
  - 监听 `navigator.connection` 的 `change` 事件；网络变化时重新计算 `getDeferredPrewarmPolicy()`。
  - 网络变化时清空待预热队列、清空已预热 id、清掉当前 timer，避免旧网络状态下的补图请求继续执行。
  - 为 `NetworkInformationLike` 补充 `addEventListener/removeEventListener` 类型，并用局部函数 + `.call(connection, ...)` 绑定，满足 TypeScript 收窄与运行时 this 语义。
- 价值：
  - 海外弱网/漫游/省流量环境下，图片预热会随网络变化收敛，优先保证文字结果和详情页可用。
  - 生产构建恢复可用，避免发布时被 Next.js 类型检查卡住。
- 验证：
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-06 deferred 菜品不再回退到外部规则图：

- 根因：
  - `getDishImageUrl()` 在菜品没有本地/持久化图时，会继续走 `imageRules` / `diverseFallbacks` 的 Unsplash 远程规则图。
  - 对 `image_status === "deferred"` 的菜，`isDishImagePending()` 会返回 false，因此 `DishImageWithLoading` 可能不显示本地食物动画，而是直接渲染远程 fallback。
  - 这会在海外弱网、外链不可达、或图片 host 配置不完整时表现为破图，也会让“稍后补图/现在生成”的体验失效。
- 本轮改动：
  - `src/lib/dish-presentation.ts` 在本地图库与可复用持久化图检查之后，若 `image_status` 为 `deferred`、`failed`、`generating` 或 `pending`，直接返回空图片 URL。
  - 这样列表与详情会稳定显示本地 category loading 动画和手动生成入口，不再被 Unsplash fallback 顶掉。
  - 保留本地图库与 Supabase 稳定图优先级，不影响已命中的真实菜品图。
- 测试：
  - 在 `missing dish images are treated as pending instead of real food placeholders` 中新增 deferred 混合来源沙拉用例。
  - RED：旧实现返回 `https://images.unsplash.com/...`，测试失败。
  - GREEN：修复后返回空字符串，组件可显示本地 loading。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "missing dish images"`：154/154 通过。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。

2026-08-06 彻底移除前端 Unsplash 运行时 fallback：

- 背景：
  - 上一轮已阻止 `deferred` 菜品被 Unsplash 规则图顶掉，但 `getDishImageUrl()` 对普通未知菜仍会返回 `imageRules` / `diverseFallbacks` 的 Unsplash URL。
  - 结果页主图组件会用 pending 状态拦截这类 URL，但历史、收藏、近期菜单缩略图等直接消费 `getDishImageUrl()` 的路径仍可能拿到外链。
  - 海外弱网、中国网络、图片 host 配置变化、或外链限流都会让这些缩略图变成破图，也会误导用户以为这是菜品真实图片。
- 本轮改动：
  - `src/lib/dish-presentation.ts` 删除 `imageRules`、`diverseFallbacks` 与相关 Unsplash fallback。
  - `getDishImageUrl()` 现在只返回：
    - 用户上传/用户图；
    - 本地知识图库；
    - 已持久化且 displayable 的稳定 URL。
  - 没有稳定图时返回空字符串，由本地 loading 动画、后台 AI 补图和手动生成入口接管。
- 测试：
  - 在 `missing dish images are treated as pending instead of real food placeholders` 中新增未知沙拉用例。
  - RED：旧实现返回 `https://images.unsplash.com/...`，测试失败。
  - GREEN：移除远程 fallback 后返回空字符串。
- 验证：
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过，无 warning。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。
- 后续：
  - 如果需要给历史/收藏无图状态更精致的视觉，可以复用 `DishImageWithLoading` 的 category illustration，而不是恢复远程照片 fallback。
  - 继续提升 `pollinations_remote=178` 和 `generated_local_unstable_unpromoted=103`，让更多菜直接命中本地或审核后的稳定生成图。

2026-08-06 历史/收藏/首页最近记录接入本地无图占位：

- 背景：
  - 移除 Unsplash fallback 后，`getDishImageUrl()` 对未知菜会返回空字符串，这是稳定策略本身没问题。
  - 但历史、收藏、首页最近记录等页面此前直接消费缩略图 URL：
    - 历史页用固定 `pizza-margherita.webp` 兜底，会误导用户以为菜单里有披萨。
    - 收藏页用菜名首字母方块，视觉粗糙且不像美食 App。
    - 首页最近记录失败缩略图直接隐藏，三张小图位置会不稳定。
- 本轮改动：
  - 新增 `src/components/shared/FoodThumbnailFallback.tsx`。
  - 该组件使用本地 SVG 小餐盘插画、暖色渐变、细边框，不依赖任何远程图片。
  - `HistoryPage` 无缩略图或缩略图加载失败时显示本地占位，不再用披萨图兜底。
  - `FavoritesPage` 无菜品图时显示本地占位，不再用首字母方块。
  - `HomePage` 最近记录三张小缩略图槽位固定；缺图或加载失败时显示本地占位，布局不会跳。
- 价值：
  - 断网、海外弱网、图片缓存未命中时，历史/收藏/首页仍保持 App 化、稳定、可读的视觉。
  - 避免用错误真实食物图误导用户，也避免空白/破图影响信任感。
  - 与“本地图优先、缺图渐进补齐”的图片策略一致。
- 测试：
  - `home screen uses app-readable food product typography` 新增 `FoodThumbnailFallback` 与不再出现 `fallbackRecentImage` 的断言。
  - `history and favorites screens use app-readable typography` 新增共享占位组件、无披萨兜底、无首字母方块断言。
  - `recent menu thumbnails ignore unsafe generated image URLs` 更新为失败缩略图显示本地占位，而不是隐藏。
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "recent menu thumbnails|home screen uses|history and favorites"`：154/154 通过。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。

2026-08-06 收藏旧图片 URL 清理与加载失败兜底：

- 背景：
  - 历史记录已经会清理旧的临时图片 URL，但收藏记录此前仍会直接读取 `dish.image_url`。
  - 如果用户早期收藏里保存了 DashScope signed URL、Pollinations/Unsplash 外链、或 `/generated-dishes/` 机器本地图，收藏页会继续尝试渲染这些不稳定地址，表现为破图或跨设备失效。
- 本轮改动：
  - `src/lib/local-storage.ts` 新增 `sanitizeFavoriteDish()`。
  - `getFavorites()` 读取本地收藏后会删除不安全或未知来源的 `image_url`，并把清理后的收藏写回 `localStorage`。
  - `src/components/favorites/FavoritesPage.tsx` 在渲染前用 `isSafeStoredThumbnail()` 二次过滤收藏图片。
  - 收藏图片真实加载失败时记录到 `failedFavoriteImages`，立即切换到本地 `FoodThumbnailFallback`，不再让坏图长期停留。
- 价值：
  - 老用户本机历史收藏会自动自愈，减少海外弱网、换设备、部署环境变化时的破图。
  - 收藏页和历史页、首页最近记录统一到“只显示可信本地图/稳定 Storage 图，否则本地占位”的策略。
- 验证：
  - RED：`recent menu thumbnails ignore unsafe generated image URLs` 先因缺少 `sanitizeFavoriteDish` 按预期失败。
  - GREEN：实现存储层清理和收藏页兜底后通过。
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "recent menu thumbnails ignore unsafe generated image URLs"`：当前环境实际跑完 154/154，通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `93.2%`，去重稳定覆盖 `92.1%`。

2026-08-06 高优先级本地图第五批与诊断别名同步：

- 背景：
  - 继续减少海外菜单首次结果页对实时 AI 生图、远程图和 signed URL 的依赖。
  - 这一批优先选视觉身份明确、海外菜单高频、且此前诊断为 `ai_pending` 的菜：`shahi-paneer`、`tacos-al-pastor`、`tamagoyaki`、`tebasaki`、`teriyaki-chicken`。
- 本轮改动：
  - 使用 `scripts/backfill-knowledge-images-with-wan.mjs` 生成并写入 5 张本地 WebP：
    - `/dishes/shahi-paneer.webp`
    - `/dishes/tacos-al-pastor.webp`
    - `/dishes/tamagoyaki.webp`
    - `/dishes/tebasaki.webp`
    - `/dishes/teriyaki-chicken.webp`
  - 更新 `public/dish-knowledge-db.json`，这些菜后续直接走本地知识图库，不再等待 AI 生图。
  - 目检 contact sheet：`.cache/knowledge-backfill-2026-08-06-d-final.png`。
  - `tacos-al-pastor` 第一版生成成接近卷饼的闭合形态，已加强 prompt 为 open-face small corn tortillas，并强制重生成；最终版能看到开放式小玉米饼、菠萝、洋葱/香菜。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 加强这 5 道菜的专属视觉提示，避免 paneer 变成绿咖喱、al pastor 变成 wrap、tamagoyaki 变成西式煎蛋、tebasaki 变成普通炸鸡块、teriyaki chicken 变成橙鸡/咖喱鸡。
  - `src/lib/dish-image-match.ts` 新增对应生产别名。
  - `scripts/diagnose-dish-images.mjs` 同步新增对应诊断别名；否则运行时已能命中本地图，但诊断脚本仍会把 `tamagoyaki` / `tebasaki` 误报为 `ai_pending`。
- 覆盖率：
  - 诊断汇总从上一轮 `stable_local_with_promoted_coverage_percent=93.2` / `stable_local_deduped_coverage_percent=92.1` 提升到：
    - `local_knowledge=849`
    - `promoted_generated_cache=108`
    - `promoted_generated_cache_unique_new=97`
    - `pollinations_remote=173`
    - `ai_pending_or_remote=173`
    - `stable_local_with_promoted_coverage_percent=93.6`
    - `stable_local_deduped_coverage_percent=92.6`
- 验证：
  - RED：`dish image diagnostics mirrors production aliases for local knowledge matches` 加入 `Japanese Omelette` / `Tebasaki` 后，诊断脚本按预期失败，返回 `ai_pending`。
  - GREEN：同步诊断别名后，该测试通过。
  - `node scripts/diagnose-dish-images.mjs shahi-paneer 'Tacos al Pastor' tamagoyaki tebasaki 'Teriyaki Chicken' --json`：5/5 全部命中 `local_knowledge`。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定覆盖 `93.6%`，去重稳定覆盖 `92.6%`。
- 后续：
  - 继续用 `node scripts/plan-knowledge-image-backfill.mjs --limit=30` 挑选下一批长尾，优先处理 `pollinations_remote=173` 和 `generated_local_unstable_unpromoted=103`。
  - 每批仍需 contact sheet 目检，避免错图被稳定固化进本地图库。

2026-08-06 蔬菜天妇罗错图修正与诊断别名补齐：

- 背景：
  - `tempura-vegetable` 虽然已经进入本地知识图库，但前一版 AI 生成图中出现了明显虾天妇罗，容易误导素食/海鲜忌口用户。
  - 诊断脚本对短菜单名 `Tortellini Panna` 误报 `ai_pending`，而生产匹配器实际可以命中 `tortellini-panna`；这会让后续排障时误以为产品还会重复生图。
- 本轮改动：
  - 加强 `scripts/backfill-knowledge-images-with-wan.mjs` 中 `tempura-vegetable` 的专属 prompt：
    - 明确主体必须是蔬菜天妇罗拼盘。
    - 强制所有蔬菜裹浅金色不规则炸衣。
    - 明确禁止虾、海鲜、薯条、洋葱圈、pakora、春卷、炸鸡、沙拉和蒸蔬菜。
  - 重新生成并目检 `/dishes/tempura-vegetable.webp`；最终版为蔬菜炸物，可看到莲藕等蔬菜天妇罗，没有明显虾/海鲜主体。
  - 目检 contact sheet：`.cache/knowledge-backfill-2026-08-06-e-final-v4.png`。
  - `scripts/diagnose-dish-images.mjs` 新增 `Tortellini Panna` / `Tortellini in cream sauce` / `奶油意式馄饨` 到 `tortellini-panna` 的直接诊断别名。
- 回归保护：
  - `Wan knowledge image backfill reuses production image prompts and writes local webp assets` 新增断言，要求脚本包含 `no shrimp or seafood`，避免后续 prompt 回退。
  - `dish image diagnostics mirrors production aliases for local knowledge matches` 新增 `Tortellini Panna` 断言，要求诊断结果和生产匹配一致。
- 当前覆盖率：
  - `total_entries=1022`
  - `local_knowledge=855`
  - `promoted_generated_cache=108`
  - `promoted_generated_cache_unique_new=97`
  - `pollinations_remote=167`
  - `ai_pending_or_remote=167`
  - `stable_local_with_promoted_coverage_percent=94.2`
  - `stable_local_deduped_coverage_percent=93.2`
- 验证：
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs "Vegetable Tempura" "蔬菜天妇罗" "Tortellini Panna" "Tortellini alla Panna" "Swedish Meatballs" "Thai Spring Rolls" --json`：6/6 全部命中 `local_knowledge`。
- 注意：
  - 诊断脚本输入真实菜单名时已正确命中；图库 id/slug 直查缺口已在下一节补齐。

2026-08-06 图片诊断 id 直查与本地化计划器去重：

- 背景：
  - 上一节留下的诊断缺口已补：直接输入知识库 id/slug，例如 `tempura-vegetable`、`tortellini-panna`，现在也会返回 `local_knowledge`，不再误报 `ai_pending`。
  - `scripts/plan-knowledge-image-backfill.mjs` 之前只看条目自身是否为远程图，没检查它是否已经能通过同名/别名命中其他本地图；因此会把 `tacos-al-pastor-street` 这类重复条目继续列为待生成。
- 本轮改动：
  - `scripts/diagnose-dish-images.mjs` 的 `matchLocalKnowledge()` 在别名匹配前增加 id/slug 直查：
    - 原始输入等于 `entry.id`
    - `slug(input)` 等于 `entry.id`
    - `canonicalDishNameKey(entry.id)` 等于输入 canonical key
  - `scripts/plan-knowledge-image-backfill.mjs` 新增 `normalizedEntryNames()` 与 `hasEquivalentLocalImage()`：
    - 候选远程条目如果和已有本地图条目共享规范化 id/name，就跳过。
    - 这样不会为已经可用的等价菜名重复安排 AI 生图。
- 验证：
  - RED：`dish image diagnostics mirrors production aliases for local knowledge matches` 加入 `tempura-vegetable` 后先失败，实际返回 `ai_pending`。
  - GREEN：补 id/slug 直查后通过。
  - RED：`knowledge image backfill planner prioritizes stable generation over unreliable remote downloads` 要求 `hasEquivalentLocalImage` 且计划中不含 `tacos-al-pastor-street`，先失败。
  - GREEN：计划器去重后通过。
  - `node scripts/diagnose-dish-images.mjs tempura-vegetable tortellini-panna "Vegetable Tempura" --json`：3/3 命中 `local_knowledge`。
  - `node scripts/plan-knowledge-image-backfill.mjs --limit=12`：不再返回 `tacos-al-pastor-street`，下一批候选变为 `Sellou`、`sfiha`、`sigeumchi-namul`、`sunomono`、`sutlac`、`tavuk-gogsu` 等真实缺图项。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖保持 `94.2%`，去重稳定覆盖 `93.2%`。
- 后续：
  - 下一批图片本地化建议从去重后的候选里选 5-8 个视觉身份清晰的菜，优先 `sfiha`、`sigeumchi-namul`、`sunomono`、`sutlac`、`yakitori`，生成后必须 contact sheet 目检再固化。
  - `Sellou` 当前 id 首字母大写，输出路径为 `/dishes/Sellou.webp`；如要长期规范化，建议单独做一次 id 迁移评估，避免改动知识库引用时引入破图。

2026-08-06 高优先级本地图第六批：

- 背景：
  - 上一节去重后，下一批真实缺图候选中有 5 个视觉身份明确且海外菜单常见或易错配的菜：`sfiha`、`sigeumchi-namul`、`sunomono`、`sutlac`、`yakitori`。
  - `Grilled Chicken Skewers` 之前会命中 `generated-grilled-chicken-breast` 的 promoted cache，说明没有本地 `yakitori` 时容易错配成普通鸡胸肉图。
- 本轮改动：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 为 5 道菜增加专属 prompt：
    - `sfiha`：开放式小肉饼，禁止披萨片、闭合 empanada、pita pocket、taco 等。
    - `sigeumchi-namul`：韩式焯菠菜小菜，深绿色、芝麻油光泽、芝麻点缀，禁止生菠菜沙拉/奶油菠菜。
    - `sunomono`：日式醋物，薄黄瓜片、小碗、清醋汁和芝麻，禁止西式沙拉/黄瓜条/汤。
    - `sutlac`：土耳其烤米布丁，小陶碗或瓷碗，焦糖化表面，禁止 creme brulee/flan/panna cotta。
    - `yakitori`：日式烤鸡肉串，竹签、tare 酱、轻微焦痕，禁止鸡胸肉排/satay/炸鸡/鸡翅。
  - 使用 Wan/DashScope 生成并写入 5 张本地 WebP：
    - `/dishes/sfiha.webp`
    - `/dishes/sigeumchi-namul.webp`
    - `/dishes/sunomono.webp`
    - `/dishes/sutlac.webp`
    - `/dishes/yakitori.webp`
  - 更新 `public/dish-knowledge-db.json`，上述条目后续直接命中本地图库，不再等待实时 AI 生图。
  - 目检 contact sheet：`.cache/knowledge-backfill-2026-08-06-f-final.png`。
- 目检结论：
  - `sfiha`：开放式肉馅小饼，未生成成披萨。
  - `sigeumchi-namul`：韩式拌菠菜小菜，菜品身份清楚。
  - `sunomono`：薄黄瓜片和海藻/醋物质感清楚。
  - `sutlac`：陶碗米布丁，焦糖化表面可见。
  - `yakitori`：竹签鸡肉串，未生成成普通鸡胸肉排。
- 覆盖率变化：
  - `local_knowledge`：855 -> 860
  - `pollinations_remote`：167 -> 162
  - `ai_pending_or_remote`：167 -> 162
  - `local_knowledge_coverage_percent`：83.7 -> 84.1
  - `stable_local_with_promoted_coverage_percent`：94.2 -> 94.7
  - `stable_local_deduped_coverage_percent`：93.2 -> 93.6
- 验证：
  - RED：`Wan knowledge image backfill reuses production image prompts and writes local webp assets` 加入 5 道菜 prompt 断言后先失败。
  - GREEN：补专属 prompt 后通过。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=sfiha,sigeumchi-namul,sunomono,sutlac,yakitori --apply --item-timeout-ms=120000 --delay-ms=800`：5/5 生成成功，批次约 61 秒。
  - `node scripts/diagnose-dish-images.mjs Sfiha "Spinach with Sesame" "Cucumber Vinegar Salad" Sutlac Yakitori "Grilled Chicken Skewers" sfiha sigeumchi-namul sunomono sutlac yakitori --json`：全部命中 `local_knowledge`。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续：
  - 下一批可继续从 `node scripts/plan-knowledge-image-backfill.mjs --format=ids --limit=8` 选：当前前几个是 `Sellou,tavuk-gogsu,tres-leches-cake,tub-tim-grob,umm-ali,uttapam,yangnyeom-chicken...`。
  - 建议先跳过 `Sellou` 或单独处理其大写 id 规范化问题，优先处理视觉身份更稳的 `tavuk-gogsu`、`tres-leches-cake`、`tub-tim-grob`、`umm-ali`、`uttapam`、`yangnyeom-chicken`。

2026-08-06 高优先级本地图第七批：

- 背景：
  - 继续围绕“上传大菜单后少走实时 AI 生图、结果页更快出现稳定高质量图”的主线推进。
  - 上一批后 `node scripts/plan-knowledge-image-backfill.mjs --limit=16` 显示剩余 162 个远程/待 AI 图。
  - `Sellou` 的 id 为大写 `Sellou`，输出路径会是 `/dishes/Sellou.webp`，仍建议单独做 id 规范化评估；本轮先跳过，避免引入大小写路径问题。
  - 本轮选择视觉身份更明确的 6 个：`tavuk-gogsu`、`tres-leches-cake`、`tub-tim-grob`、`umm-ali`、`uttapam`、`yangnyeom-chicken`。
- 本轮改动：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 增加 6 个专属 prompt：
    - `tavuk-gogsu`：土耳其鸡胸肉奶布丁，强调白色奶布丁切片/软块和肉丝纤维，禁止咸味鸡胸肉、鸡汤、焦糖布丁、米布丁。
    - `tres-leches-cake`：拉美三奶蛋糕，强调湿润浸奶海绵蛋糕、奶浆和奶油，禁止芝士蛋糕、普通层蛋糕、提拉米苏、干蛋糕。
    - `tub-tim-grob`：泰式红宝石冰，强调红色透明荸荠块、椰奶和碎冰，禁止珍珠奶茶、鸡尾酒、普通果冻/刨冰。
    - `umm-ali`：中东 Umm Ali 面包布丁，强调奶/奶油浸泡酥皮、坚果、葡萄干和烤金表面，禁止米布丁、焦糖布丁、巴克拉瓦。
    - `uttapam`：南印度厚咸米饼，强调圆形厚煎饼、洋葱番茄辣椒香菜 topping、椰子 chutney 和 sambar，禁止 dosa 卷、naan、披萨、甜煎饼。
    - `yangnyeom-chicken`：韩式甜辣炸鸡，强调小块炸鸡裹亮红甜辣酱、芝麻/葱花，禁止水牛城鸡翅、普通炸鸡、烤鸡、橙鸡、咖喱鸡。
  - 使用 Wan/DashScope 生成并写入 6 张本地 WebP：
    - `/dishes/tavuk-gogsu.webp`
    - `/dishes/tres-leches-cake.webp`
    - `/dishes/tub-tim-grob.webp`
    - `/dishes/umm-ali.webp`
    - `/dishes/uttapam.webp`
    - `/dishes/yangnyeom-chicken.webp`
  - 更新 `public/dish-knowledge-db.json`，上述条目后续直接命中本地图库，不再进入实时 AI 生图慢路径。
  - 目检 contact sheet：`.cache/knowledge-backfill-2026-08-06-g-final.png`。
- 目检结论：
  - `tavuk-gogsu`：白色奶布丁切片带纤维纹理，符合该菜特殊形态，未生成成咸味鸡胸肉。
  - `tres-leches-cake`：湿润奶油蛋糕切片，三奶蛋糕身份可读。
  - `tub-tim-grob`：红色透明块、椰奶和碗装甜品特征清楚。
  - `umm-ali`：烤面包布丁、坚果和金黄表面清楚。
  - `uttapam`：厚圆咸米饼和蔬菜 topping 清楚。
  - `yangnyeom-chicken`：亮红酱汁炸鸡块清楚，未混成普通烤鸡或鸡胸排。
- 覆盖率变化：
  - `local_knowledge`：860 -> 866
  - `pollinations_remote`：162 -> 156
  - `ai_pending_or_remote`：162 -> 156
  - `local_knowledge_coverage_percent`：84.1 -> 84.7
  - `stable_local_with_promoted_coverage_percent`：94.7 -> 95.3
  - `stable_local_deduped_coverage_percent`：93.6 -> 94.2
- 验证：
  - RED：`Wan knowledge image backfill reuses production image prompts and writes local webp assets` 加入 6 道菜 prompt 断言后先失败。
  - GREEN：补专属 prompt 后通过。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=tavuk-gogsu,tres-leches-cake,tub-tim-grob,umm-ali,uttapam,yangnyeom-chicken --apply --item-timeout-ms=120000 --delay-ms=800`：6/6 生成成功，批次约 81 秒。
  - `node scripts/diagnose-dish-images.mjs "Tavuk Göğsü" "Three Milk Cake" "Tub Tim Grob" "Umm Ali" Uttapam "Sweet Spicy Chicken" tavuk-gogsu tres-leches-cake tub-tim-grob umm-ali uttapam yangnyeom-chicken --json`：12/12 全部命中 `local_knowledge`。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖 `95.3%`，去重稳定覆盖 `94.2%`。
- 后续：
  - 下一批 `node scripts/plan-knowledge-image-backfill.mjs --limit=10` 返回：`Sellou`、`yokan`、`zeppole`、`aji-de-gallina`、`amatriciana`、`arancini-di-riso`、`arrabbiata`、`bruschetta-ai-funghi`、`bucatini-amatriciana`、`cacio-e-pepe`。
  - 建议继续跳过或单独处理 `Sellou` 大写 id；优先做 `yokan`、`zeppole` 和意面/意式小食批次，同时重点检查 `amatriciana` 与 `bucatini-amatriciana` 是否应该通过别名去重，避免重复生成近似图。

2026-08-06 本地化计划器候选间去重：

- 背景：
  - 第七批后，下一批计划器输出同时包含 `amatriciana` 和 `bucatini-amatriciana`。
  - 两者共享 `Bucatini all'Amatriciana` 菜名，视觉上应复用同一类图；如果都进入生成队列，会浪费 AI 生图时间，并增加近似重复图进入本地图库的风险。
- 本轮改动：
  - `scripts/plan-knowledge-image-backfill.mjs` 新增 `hasEquivalentPlannedImage()`。
  - 计划器仍先按原有优先级排序，再逐个加入候选；如果新候选和已计划候选共享规范化后的 id/name，就跳过新候选。
  - 这只影响 backfill 计划，不改生产图片匹配结果，不会影响已上线菜单展示。
- 验证：
  - RED：`knowledge image backfill planner prioritizes stable generation over unreliable remote downloads` 新增 `hasEquivalentPlannedImage` 和 Amatriciana 去重断言后先失败。
  - GREEN：实现候选间去重后通过。
  - `node scripts/plan-knowledge-image-backfill.mjs --limit=12`：只返回 `amatriciana`，不再返回 `bucatini-amatriciana`；第 12 个候选顺延为 `cotoletta-alla-milanese`。
- 后续：
  - 下一批图片生成建议重新以计划器输出为准，不再手动沿用旧列表。
  - `Sellou` 大写 id 仍未处理，建议先做 id/path 规范化小修，再决定是否生成该图。

2026-08-06 安全小写本地图路径与第八批甜点图：

- 背景：
  - `Sellou` 的知识库 id 为大写，上一轮计划器会输出 `/dishes/Sellou.webp`。
  - 线上 Linux 文件系统、CDN 缓存和后续人工排查都对大小写敏感；本地图路径应统一为小写稳定 slug，避免破图或重复文件。
- 本轮改动：
  - `scripts/plan-knowledge-image-backfill.mjs` 新增 `safeLocalDishFilename()` / `localDishImagePath()`。
  - `scripts/backfill-knowledge-images-with-wan.mjs` 同步新增 `safeLocalDishFilename()` / `localDishImagePath()`。
  - Wan backfill 的 dry-run、实际落盘、`hasLocalFile()`、`entry.card` / `entry.hero` 更新都改用安全小写文件名。
  - 为 `Sellou`、`yokan`、`zeppole` 增加专属 prompt：
    - `Sellou`：摩洛哥芝麻杏仁甜糕，强调棕色松散/成型甜粉糕、芝麻杏仁蜂蜜香料，禁止蛋糕、布朗尼、halva 条、曲奇、couscous。
    - `yokan`：日式羊羹，强调深红棕色平滑红豆果冻切片，禁止麻薯、蛋糕、布丁杯、红豆汤。
    - `zeppole`：意式炸面团甜点，强调金黄小圆炸面团/环状酥点和糖粉，禁止甜甜圈、churros、泡芙、洋葱圈、咸味海鲜炸物。
  - 生成并写入 3 张本地 WebP：
    - `/dishes/sellou.webp`
    - `/dishes/yokan.webp`
    - `/dishes/zeppole.webp`
  - 更新 `public/dish-knowledge-db.json`，`Sellou` 条目保持原 id，但图片 URL 使用小写 `/dishes/sellou.webp`。
  - 目检 contact sheet：`.cache/knowledge-backfill-2026-08-06-h-final.png`。
- 目检结论：
  - `Sellou`：棕色芝麻杏仁甜糕/粉糕质感清楚，未生成成普通蛋糕。
  - `yokan`：深红棕色光滑羊羹切片清楚。
  - `zeppole`：金黄炸面团甜点、糖粉和馅料特征清楚。
- 覆盖率变化：
  - `local_knowledge`：866 -> 869
  - `pollinations_remote`：156 -> 153
  - `ai_pending_or_remote`：156 -> 153
  - `local_knowledge_coverage_percent`：84.7 -> 85.0
  - `stable_local_with_promoted_coverage_percent`：95.3 -> 95.6
  - `stable_local_deduped_coverage_percent`：94.2 -> 94.5
- 验证：
  - RED：计划器和 Wan dry-run 加入 `Sellou -> /dishes/sellou.webp` 断言后先失败。
  - GREEN：实现安全小写路径后通过。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=Sellou,yokan,zeppole --apply --item-timeout-ms=120000 --delay-ms=800`：3/3 生成成功，批次约 39 秒。
  - `node scripts/diagnose-dish-images.mjs Sellou sellou "Red Bean Jelly" yokan Zeppole zeppole --json`：6/6 命中 `local_knowledge`。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖 `95.6%`，去重稳定覆盖 `94.5%`。
- 后续：
  - 新的下一批计划：`aji-de-gallina,amatriciana,arancini-di-riso,arrabbiata,bruschetta-ai-funghi,cacio-e-pepe,chicken-lollipop,chole-bhature,cotoletta-alla-milanese,crostini-toscani`。
  - 建议下一轮先做意面/意式小食批次，同时继续观察候选间去重是否会过滤更多近似菜。

2026-08-06 高优先级本地图第九批：意式小食/意面与秘鲁主菜：

- 背景：
  - 继续围绕“上传菜单后优先本地图、少走实时 AI 生图、结果页更快更稳”的主线推进。
  - 第八批后计划器输出前 6 个候选为：`aji-de-gallina`、`amatriciana`、`arancini-di-riso`、`arrabbiata`、`bruschetta-ai-funghi`、`cacio-e-pepe`。
  - 这些菜在海外菜单中出现频率高，且容易因相近视觉形态被生成错图：红酱意面互相混、arancini 混成肉丸、蘑菇 bruschetta 被番茄 bruschetta 抢图、cacio e pepe 被生成成红酱意面。
- 本轮改动：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 增加 6 个专属 prompt：
    - `aji-de-gallina`：秘鲁黄色辣椒鸡肉浓炖，强调米饭、土豆、橄榄、半颗蛋，禁止咖喱/炸鸡/鸡汤/意面。
    - `amatriciana`：罗马红酱意面，强调 guanciale、番茄酱、pecorino，禁止 bolognese、carbonara、arrabbiata、披萨。
    - `arancini-di-riso`：西西里炸饭团，强调金黄面包糠外壳和切开米饭/肉酱/马苏里拉内馅，禁止肉丸、falafel、takoyaki。
    - `arrabbiata`：辣味番茄通心粉，强调 penne/rigatoni、红番茄酱、辣椒片和蒜，禁止 amatriciana guanciale、肉酱、奶油酱。
    - `bruschetta-ai-funghi`：蘑菇烤面包，强调蘑菇、烤面包、蒜、香草、橄榄油，禁止番茄 bruschetta、牛油果吐司、披萨、蘑菇汤。
    - `cacio-e-pepe`：芝士黑胡椒意面，强化浅象牙色/浅米色 pecorino 酱和黑胡椒视觉，严格禁止红酱/橙酱/amatriciana/arrabbiata。
  - 生成并写入 6 张本地 WebP：
    - `/dishes/aji-de-gallina.webp`
    - `/dishes/amatriciana.webp`
    - `/dishes/arancini-di-riso.webp`
    - `/dishes/arrabbiata.webp`
    - `/dishes/bruschetta-ai-funghi.webp`
    - `/dishes/cacio-e-pepe.webp`
  - 更新 `public/dish-knowledge-db.json`，上述 6 个条目后续直接命中本地图库。
  - `cacio-e-pepe` 初版生成成偏红酱意面，已强化 prompt 后强制重生成；最终目检为浅色芝士黑胡椒意面。
  - 修复 `Mushroom Bruschetta` 图片错配：
    - `src/lib/dish-image-match.ts` 将 `mushroom bruschetta / bruschetta ai funghi / funghi bruschetta / 蘑菇烤面包` 显式指向 `bruschetta-ai-funghi`，并放在泛化 `bruschetta` 别名前。
    - `scripts/diagnose-dish-images.mjs` 同步相同别名，保证诊断结果和生产匹配一致。
- 目检 contact sheet：
  - `.cache/knowledge-backfill-2026-08-06-i-final.png`
- 目检结论：
  - `aji-de-gallina`：黄色鸡肉浓炖配米饭、土豆、蛋和橄榄，秘鲁菜身份可读。
  - `amatriciana`：红酱 rigatoni 与 guanciale 感清楚。
  - `arancini-di-riso`：金黄炸饭团和切开内馅清楚。
  - `arrabbiata`：红酱 penne/rigatoni 和辣椒视觉清楚。
  - `bruschetta-ai-funghi`：蘑菇烤面包主体清楚，没有被番茄 bruschetta 混淆。
  - `cacio-e-pepe`：二次生成后为浅色芝士黑胡椒意面，和红酱意面区分开。
- 覆盖率变化：
  - `local_knowledge`：869 -> 875
  - `pollinations_remote`：153 -> 147
  - `ai_pending_or_remote`：153 -> 147
  - `local_knowledge_coverage_percent`：85.0 -> 85.6
  - `stable_local_with_promoted_coverage_percent`：95.6 -> 96.2
  - `stable_local_deduped_coverage_percent`：94.5 -> 95.1
- 验证：
  - RED：`Wan knowledge image backfill reuses production image prompts and writes local webp assets` 加入 6 道菜 prompt 断言后先失败。
  - GREEN：补专属 prompt 后通过，`node --test tests/logic-regressions.test.mjs --test-name-pattern "Wan knowledge image backfill"`：154/154 通过。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=aji-de-gallina,amatriciana,arancini-di-riso,arrabbiata,bruschetta-ai-funghi,cacio-e-pepe --apply --item-timeout-ms=120000 --delay-ms=800`：6/6 生成成功。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=cacio-e-pepe --apply --force --item-timeout-ms=120000 --delay-ms=800`：1/1 重生成成功。
  - `node scripts/diagnose-dish-images.mjs "Aji de Gallina" Amatriciana "Fried Rice Balls" Arrabbiata "Mushroom Bruschetta" "Cacio e Pepe" --json`：6/6 命中 `local_knowledge`，`Mushroom Bruschetta` 命中 `bruschetta-ai-funghi`。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖 `96.2%`，去重稳定覆盖 `95.1%`。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续：
  - 新的下一批计划：`chicken-lollipop,chole-bhature,cotoletta-alla-milanese,crostini-toscani,danish-rye-bread,dumplings-street,fattoush-salad,gozleme,jeera-rice,kanom-jeen,kibbeh-me,kimbap`。
  - 建议继续优先处理高频海外菜单与易错类别：炸鸡小食、印度早餐/豆咖喱、意式炸肉排/小吐司、土耳其/中东小食、韩国紫菜包饭。
  - 当前仍有 `pollinations_remote=147`，应继续分批生成并人工目检；大菜单首次识别速度瓶颈仍在视觉模型首轮调用，不在图片本地化本身。

2026-08-06 高优先级本地图第十批：海外高频小食/面包/饺子：

- 背景：
  - 第九批后计划器输出前 6 个候选为：`chicken-lollipop`、`chole-bhature`、`cotoletta-alla-milanese`、`crostini-toscani`、`danish-rye-bread`、`dumplings-street`。
  - 这些菜覆盖海外真实菜单里的印度/意大利/北欧/亚洲街头小食场景，且如果没有本地图，列表页和详情页都会进入 AI 生图慢路径。
  - 本批几个菜视觉相邻风险较高：`cotoletta` 容易变成烤肉排，`dumplings-street` 容易变成小笼包，`chole-bhature` 容易变成 naan/poori 泛图。
- 本轮改动：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 增加 6 个专属 prompt：
    - `chicken-lollipop`：印度棒棒鸡翅，强调 frenched chicken winglets、骨柄、红橙 Indo-Chinese 酱，禁止普通鸡翅/鸡块/烤串。
    - `chole-bhature`：北印度鹰嘴豆咖喱配炸面包，强调深色 chickpea curry 和鼓起的金黄 bhature，禁止 naan/roti/dosa/鹰嘴豆沙拉。
    - `cotoletta-alla-milanese`：米兰炸排，强调整面浅金色面包糠、薄而平、无烤痕，禁止烤牛排/烤肉排/炸鸡/katsu。
    - `crostini-toscani`：托斯卡纳鸡肝 crostini，强调小烤面包和深棕鸡肝酱，禁止番茄 bruschetta/蘑菇 bruschetta/牛油果吐司。
    - `danish-rye-bread`：丹麦黑麦面包，强调深色紧实黑麦 loaf、切片、种子/谷物，禁止白面包/蛋糕/开放三明治 topping。
    - `dumplings-street`：街头锅贴/煎饺，强调月牙形侧卧、褶边、金黄煎底，禁止小笼包/汤包/包子/烧卖/馄饨汤。
  - 生成并写入 6 张本地 WebP：
    - `/dishes/chicken-lollipop.webp`
    - `/dishes/chole-bhature.webp`
    - `/dishes/cotoletta-alla-milanese.webp`
    - `/dishes/crostini-toscani.webp`
    - `/dishes/danish-rye-bread.webp`
    - `/dishes/dumplings-street.webp`
  - 更新 `public/dish-knowledge-db.json`，上述 6 个条目后续直接命中本地图库。
  - 初次目检发现：
    - `cotoletta-alla-milanese` 初版更像烤肉排，不合格。
    - `dumplings-street` 初版更像小笼包/汤包，不合格。
  - 已强化这两个 prompt 并使用 `--force` 重生成，最终图通过目检。
  - 修复 `Street Dumplings` 别名缺口：
    - `src/lib/dish-image-match.ts` 增加 `street dumplings / potstickers / pan-fried dumplings / 锅贴 / 煎饺 -> dumplings-street`。
    - `scripts/diagnose-dish-images.mjs` 同步相同别名，避免诊断工具继续误报为 `ai_pending`。
- 目检 contact sheet：
  - `.cache/knowledge-backfill-2026-08-06-j-final.png`
- 目检结论：
  - `chicken-lollipop`：红橙酱棒棒鸡翅、骨柄特征清楚。
  - `chole-bhature`：鹰嘴豆咖喱与鼓起炸面包可读。
  - `cotoletta-alla-milanese`：二次生成后为浅金色面包糠炸排，和烤排区分开。
  - `crostini-toscani`：多片小烤面包配深色鸡肝酱，身份可读。
  - `danish-rye-bread`：深色紧实黑麦面包切片清楚。
  - `dumplings-street`：二次生成后为侧卧月牙形锅贴/煎饺，未再生成小笼包。
- 覆盖率变化：
  - `local_knowledge`：875 -> 881
  - `pollinations_remote`：147 -> 141
  - `ai_pending_or_remote`：147 -> 141
  - `local_knowledge_coverage_percent`：85.6 -> 86.2
  - `stable_local_with_promoted_coverage_percent`：96.2 -> 96.8
  - `stable_local_deduped_coverage_percent`：95.1 -> 95.7
- 验证：
  - RED：`Wan knowledge image backfill reuses production image prompts and writes local webp assets` 加入 6 道菜 prompt 断言后先失败。
  - GREEN：补专属 prompt 后通过，`node --test tests/logic-regressions.test.mjs --test-name-pattern "Wan knowledge image backfill"`：154/154 通过。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=chicken-lollipop,chole-bhature,cotoletta-alla-milanese,crostini-toscani,danish-rye-bread,dumplings-street --apply --item-timeout-ms=120000 --delay-ms=800`：6/6 生成成功。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=cotoletta-alla-milanese,dumplings-street --apply --force --item-timeout-ms=120000 --delay-ms=800`：2/2 重生成成功。
  - `node scripts/diagnose-dish-images.mjs "Chicken Lollipop" "Chole Bhature" "Milanese Breaded Cutlet" "Tuscan Chicken Liver Crostini" "Danish Rye Bread" Potstickers "Street Dumplings" --json`：全部命中 `local_knowledge`。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖 `96.8%`，去重稳定覆盖 `95.7%`。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续：
  - 新的下一批计划：`fattoush-salad,gozleme,jeera-rice,kanom-jeen,kibbeh-me,kimbap,kimchi-bokkeumbap,kongnamul,korokke,kushikatsu,lahmacun,lasagna-alla-bolognese`。
  - 下一批建议优先处理：中东沙拉/炸肉丸、土耳其薄饼、韩国紫菜包饭/泡菜炒饭、日式炸物，以及 lasagna 这类高频意餐。
  - 图片本地化已经接近 97% 稳定覆盖；后续除了继续补图，更应该同步推进首次识别模型 A/B、前处理裁切和大菜单首屏策略，因为首轮视觉模型仍是首次上传的主要耗时来源。

2026-08-06 高优先级本地图第十一批：中东/土耳其/印度/泰国/韩国高频菜：

- 背景：
  - 第十批后计划器输出前 6 个候选为：`fattoush-salad`、`gozleme`、`jeera-rice`、`kanom-jeen`、`kibbeh-me`、`kimbap`。
  - 这些菜覆盖真实海外菜单里常见的中东沙拉、土耳其馅饼、印度米饭、泰式米线、黎凡特炸肉丸和韩国紫菜包饭。
  - 本批的主要风险是跨文化菜名被模型拉向相邻品类：`kanom-jeen` 容易被生成成海鲜面，`kibbeh` 容易被生成成普通炸肉丸或 arancini，`kimbap` 容易被生成成日式寿司卷。
- 本轮改动：
  - `scripts/backfill-knowledge-images-with-wan.mjs` 增加 6 个专属 prompt：
    - `fattoush-salad`：黎凡特 fattoush 沙拉，强调黄瓜、番茄、萝卜、香草和脆 pita chips，禁止希腊沙拉、凯撒沙拉、tabbouleh、nachos。
    - `gozleme`：土耳其 gozleme 馅饼，强调煎烤扁面饼、折叠形态和可见内馅，禁止 quesadilla、披萨、naan、pide、lahmacun。
    - `jeera-rice`：印度孜然米饭，强调松散 basmati 长米粒、孜然粒和 ghee 光泽，禁止 biryani、炒饭、pulao、risotto。
    - `kanom-jeen`：泰式发酵米线，强调白色细米线巢、泰式咖喱、香草蔬菜配菜，并明确禁止大虾/海鲜成为主体。
    - `kibbeh-me`：中东 kibbeh，强调 bulgur 橄榄球形炸肉丸，最好有切开内馅，禁止 falafel、meatball、arancini、kofta。
    - `kimbap`：韩国 kimbap，强调海苔米饭卷切片和彩色熟食内馅，禁止日式生鱼寿司、California roll、nigiri。
  - 生成并写入 6 张本地 WebP：
    - `/dishes/fattoush-salad.webp`
    - `/dishes/gozleme.webp`
    - `/dishes/jeera-rice.webp`
    - `/dishes/kanom-jeen.webp`
    - `/dishes/kibbeh-me.webp`
    - `/dishes/kimbap.webp`
  - 更新 `public/dish-knowledge-db.json`，上述 6 个条目后续直接命中本地图库。
  - 初次目检发现 `kanom-jeen` 更像虾和鸡蛋盖在咖喱面上，菜品身份不够准；已强化 prompt 后使用 `--force` 重生成。
  - 修复常见别名缺口：
    - `Thai Kanom Jeen`、`Khanom Chin` 现在命中 `kanom-jeen`。
    - `Turkish Gozleme` 现在命中 `gozleme`。
    - `Middle Eastern Kibbeh`、`Lebanese Kibbeh` 现在命中 `kibbeh-me`。
    - `src/lib/dish-image-match.ts` 和 `scripts/diagnose-dish-images.mjs` 已同步，避免生产命中和诊断误判不一致。
- 目检 contact sheet：
  - `.cache/knowledge-backfill-2026-08-06-k-final.png`
- 目检结论：
  - `fattoush-salad`：蔬菜沙拉和脆 pita chips 清楚。
  - `gozleme`：煎烤折叠馅饼和内馅清楚。
  - `jeera-rice`：孜然米饭长米粒和香料感清楚。
  - `kanom-jeen`：二次生成后白色泰式米线为主体，配咖喱和蔬菜，不再被海鲜主体带偏。
  - `kibbeh-me`：金黄 bulgur 炸肉丸和切开内馅清楚。
  - `kimbap`：韩国紫菜包饭切片和熟食内馅清楚，未混成生鱼寿司。
- 覆盖率变化：
  - `local_knowledge`：881 -> 887
  - `pollinations_remote`：141 -> 135
  - `ai_pending_or_remote`：141 -> 135
  - `local_knowledge_coverage_percent`：86.2 -> 86.8
  - `stable_local_with_promoted_coverage_percent`：96.8 -> 97.4
  - `stable_local_deduped_coverage_percent`：95.7 -> 96.3
- 验证：
  - RED：`Wan knowledge image backfill reuses production image prompts and writes local webp assets` 加入本批 prompt 断言后先失败。
  - GREEN：补专属 prompt 后通过。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=fattoush-salad,gozleme,jeera-rice,kanom-jeen,kibbeh-me,kimbap --apply --item-timeout-ms=120000 --delay-ms=800`：6/6 生成成功。
  - `node scripts/backfill-knowledge-images-with-wan.mjs --ids=kanom-jeen --apply --force --item-timeout-ms=120000 --delay-ms=800`：1/1 重生成成功。
  - `node scripts/diagnose-dish-images.mjs "Fattoush Salad" Fattoush Gozleme "Turkish Gozleme" "Jeera Rice" "Cumin Rice" "Kanom Jeen" "Thai Kanom Jeen" "Khanom Chin" Kibbeh "Middle Eastern Kibbeh" Kimbap "Korean Seaweed Rice Roll" --json`：全部命中 `local_knowledge`。
  - `node scripts/diagnose-dish-images.mjs --summary`：稳定本地覆盖 `97.4%`，去重稳定覆盖 `96.3%`。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续：
  - 新的下一批计划：`kimchi-bokkeumbap,kongnamul,korokke,kushikatsu,lahmacun,lasagna-alla-bolognese,lasagna-verdure,lechazo-asado,linguine-pesto-trapanese,manakeesh,mansaf,manti-turkish`。
  - 图片本地化已经到 `97.4%` 稳定覆盖，继续补图仍有价值，但下一阶段更应该同步推进首次识别速度：视觉模型 A/B、菜单分区/裁切前处理、粗结果先展示、完整 enrichment 后台补齐。

2026-08-06 首轮视觉模型输入目标字节压缩：

- 背景：
  - 冷启动 benchmark 已确认：首次上传菜单的主要耗时仍在 fast first-pass 视觉模型调用，而不是图片生成或本地图库匹配。
  - 之前首轮模型图只按固定 `MENU_FAST_FIRST_PASS_IMAGE_MAX_DIM=1100`、`MENU_FAST_FIRST_PASS_IMAGE_QUALITY=68` 编码，部分海外手机大图仍可能给模型发送偏大的输入。
- 本轮改动：
  - `src/app/api/v1/translate/menu/route.ts` 新增 `MENU_FAST_FIRST_PASS_IMAGE_TARGET_BYTES`，默认 `180 * 1024`，夹在 `96KB` 到 `300KB`。
  - `buildFastFirstPassModelBuffer()` 会先按原规格编码；若仍超过目标字节，则依次尝试更低质量和更小尺寸：
    - 原规格：`FAST_FIRST_PASS_IMAGE_MAX_DIM` / `FAST_FIRST_PASS_IMAGE_QUALITY`
    - 同尺寸低质量：`quality <= 62`
    - `1000px` / `quality <= 58`
    - `900px` / `quality 55`
  - 如果所有尝试仍超过目标，会选最小 Buffer，而不是放弃优化。
  - 仅 `firstPassImageBuffers` 进入首轮视觉模型；缓存 key、重复上传命中、后续 enrichment 仍使用完整归一化后的 `imageBuffers`，避免压缩策略改变导致历史缓存漂移。
  - `TranslationTimings` 新增：
    - `firstPassTargetBytes`
    - `firstPassCompressionRatio`
  - 后续 benchmark 可直接看首轮模型输入总字节和压缩比，判断是否需要进一步调 `180KB` 阈值。
- 验证：
  - RED：`fast first-pass uses a smaller model image while preserving normalized cache keys` 先因缺少 `MENU_FAST_FIRST_PASS_IMAGE_TARGET_BYTES` 失败。
  - GREEN：实现目标字节压缩后，定向测试通过。
  - `node --test tests/logic-regressions.test.mjs`：154/154 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续：
  - 建议立刻用 `scripts/benchmark-menu-suite.mjs` 做冷启动 cache-bust 对比，重点记录 `firstPassModelBytes`、`firstPassCompressionRatio`、`firstPageMs`、`firstPassModelMsByPage`。
  - 如果真实菜单识别准确率无下降，可考虑把默认目标从 `180KB` 继续压到 `150KB` 做 A/B；如果小字菜单漏识别变多，则保持当前阈值并优先做菜单区域裁切。

2026-08-06 图片稳定缓存优先级与当前项目状态复核：

- 本轮复核结论：
  - `node scripts/diagnose-dish-images.mjs --summary` 当前输出：
    - `total_entries=1022`
    - `local_knowledge=887`
    - `promoted_generated_cache=108`
    - `promoted_generated_cache_unique_new=97`
    - `pollinations_remote=135`
    - `generated_local_unstable_unpromoted=104`
    - `local_knowledge_coverage_percent=86.8`
    - `stable_local_with_promoted_coverage_percent=97.4`
    - `stable_local_deduped_coverage_percent=96.3`
  - 说明图片系统已从“现生成优先”基本切到“稳定本地图库/审核缓存优先”，但还剩 135 个远程图和 104 个未审核 runtime 图需要继续收口。
- 本轮修复：
  - 之前完整回归只剩 1 个失败：`stale local generated image URLs from the database are not reused as valid cached images`。
  - 根因不是产品逻辑坏掉，而是测试期望仍停留在旧 runtime 图 URL：`/generated-dishes/generated-truffle-pecorino-fries.png`。
  - 当前生产匹配会优先返回已人工审核、可随构建/分享稳定访问的 promoted cache：`/dishes/generated-cache/generated-truffle-pecorino-fries-vg-dfo.webp`。
  - 已更新测试期望，固定“审核后的 generated-cache 优先于机器本地 runtime URL”的行为。这更符合海外分享、线上部署、跨机器访问的稳定性目标。
- 诊断证据：
  - `node scripts/diagnose-dish-images.mjs 'Truffle Pecorino Fries VG DFO' 'Truffle Pecorino Fries' --json`
  - 两个名字均命中：
    - `layer=promoted_generated_cache`
    - `id=local-generated-truffle-pecorino-fries-vg-dfo`
    - `url=/dishes/generated-cache/generated-truffle-pecorino-fries-vg-dfo.webp`
- 验证：
  - `node --test tests/logic-regressions.test.mjs --test-name-pattern "stale local generated image URLs|dish image diagnostics mirrors|common short menu names"`：155/155 通过。
  - `node --test tests/logic-regressions.test.mjs`：155/155 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 仍需重点推进：
  - 首次上传速度：最近真实菜单冷启动 benchmark 首屏仍约 `p50=6.1s / p90=9.2s`，完整 enrichment 可到 `30s+`。下一轮应做菜单区域裁切、视觉模型 A/B、首屏分批返回和 200 菜大菜单增量渲染策略。
  - Supabase 稳定性：本地生产日志出现过 `Supabase lookup timed out` 与 `uploadDishImage storage unavailable { error: 'fetch failed' }`，ECS 本地缓存可兜底，但跨部署/分享稳定性仍依赖 Supabase Storage 同步。建议增加 Supabase 健康诊断页、上传重试和后台补同步队列。
  - 图片资产收口：继续把剩余 `pollinations_remote=135` 转成本地 WebP；对 `generated_local_unstable_unpromoted=104` 做 contact sheet 目检后 promote 或 reject。
  - 菜名归一化：继续增强价格、货币、饮食标记、OCR 噪声、多语言别名归一，避免同菜重复生图或错配。
  - 体验：识别中明确区分“菜名已识别”“推荐文案补齐中”“图片后台补齐中”；大菜单场景优先保证可阅读列表和详情，不等待所有图片完成。

2026-08-06 超大菜单远程图片查找保护：

- 背景：
  - 当前目标要求兼顾“一张图包含很多菜，甚至 200 个菜”的可用性。
  - 图片生成队列已经有大菜单限流：80 道以上只主动生成 16 张，160 道以上只主动生成 8 张，其余 deferred 按需补图。
  - 但 enrichment 阶段的 `findExistingDishImages()` 仍可能对所有菜名/译名构造大量 Supabase `in(...)` 候选。海外弱网或 Supabase 偶发慢时，这一步会拖慢完整文本结果，甚至触发 lookup timeout。
- 本轮改动：
  - `src/app/api/v1/translate/menu/route.ts` 新增两个可配置阈值：
    - `MENU_REMOTE_IMAGE_LOOKUP_DISH_LIMIT`，默认 `80`，超过则跳过 Supabase 图片缓存查找。
    - `MENU_REMOTE_IMAGE_LOOKUP_CANDIDATE_LIMIT`，默认 `240`，候选名过多时跳过 Supabase 图片缓存查找。
  - 触发跳过时会输出 `translate:remote_image_lookup_skipped`，包含：
    - `reason: "too_many_dishes"` 或 `reason: "too_many_candidates"`
    - `dishCount` / `candidateCount` / `limit`
  - 跳过的只是远程图片缓存查找；本地知识库匹配仍照常执行，后台 AI 生图/按需 deferred 补图仍照常执行。
- 取舍：
  - 对超大菜单，少数已在 Supabase 中生成过但不在本地图库里的图，可能不会在 enrichment 当下直接命中。
  - 换来的收益是：200 菜菜单不会因为远程图片缓存查询拖住文本可读结果，更符合海外现场点餐“先看菜单翻译和推荐”的核心体验。
- 验证：
  - RED：新增 `large menus skip remote dish image lookup so 200-dish results are not blocked by Supabase` 后先失败，缺少相关阈值和跳过逻辑。
  - GREEN：实现阈值和跳过日志后，定向测试通过。
  - `node --test tests/logic-regressions.test.mjs`：156/156 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续建议：
  - 用真实 150-200 菜菜单做一次 benchmark，观察 `enrichmentMs` 和 Supabase lookup 日志是否下降。
  - 如果用户反馈“超大菜单图片太少”，优先扩大本地图库和 promoted cache，而不是重新让 200 菜同步查 Supabase。
  - 可考虑在结果页增加“先生成前 N 张/仅生成我点开的菜”的显式策略，让用户理解 deferred 图片不是失败。

2026-08-06 项目状态复核与 200 菜结果页渐进渲染：

- 当前图片系统状态：
  - `node scripts/diagnose-dish-images.mjs --summary --json`
  - `total_entries=1022`
  - `local_knowledge=887`
  - `promoted_generated_cache=108`
  - `promoted_generated_cache_unique_new=97`
  - `pollinations_remote=135`
  - `generated_local_unstable_unpromoted=104`
  - `local_knowledge_coverage_percent=86.8`
  - `stable_local_with_promoted_coverage_percent=97.4`
  - `stable_local_deduped_coverage_percent=96.3`
- 本轮改动：
  - `src/components/results/ResultsPage.tsx` 对大菜单结果页改为渐进渲染：默认先展示 60 道菜，每次“再显示”追加 40 道。
  - deferred 图片预热只遍历当前可见菜品，避免 100-200 道菜一次性挂大量 DOM、IntersectionObserver 和图片预热队列。
  - 超大菜单页头显示 `60/200` 这类进度，用户可以先看翻译与推荐，不需要等待所有卡片和图片进入页面。
  - 渐进渲染状态按 `task_id + selectedCategory` 作用域派生；切换菜单或分类会自然回到 60 道，不再用 `useEffect` 同步 `setState`。
- 修复点：
  - 初版实现用 `useEffect(() => setVisibleDishLimit(...))` 重置可见数量，`npm run lint` 报 `react-hooks/set-state-in-effect`。
  - 已改成 `visibleDishLimitState` + `visibleDishScopeKey`，避免额外级联渲染，也符合当前“速度/稳定性优先”的方向。
- 验证：
  - RED：更新 `large result pages render dish cards progressively for 200-dish menus` 断言后，旧实现按预期失败，缺少作用域状态且仍依赖 effect 重置。
  - GREEN：实现作用域渐进渲染后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "large result pages render dish cards progressively"` 实际跑完整文件，157/157 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续建议：
  - 用真实 150-200 菜菜单跑 `scripts/benchmark-menu-flow.mjs`，确认结果页首屏渲染、滚动和 deferred 图片预热是否明显改善。
  - 如果用户仍觉得大菜单慢，下一步应做虚拟列表或窗口化渲染；当前 60+40 是低风险落地版。
  - 图片侧继续优先收口 `pollinations_remote=135` 与 `generated_local_unstable_unpromoted=104`，因为稳定本地图越多，结果页越少进入后台补图。

2026-08-06 deferred 图片预热稳定性补充：

- 背景：
  - 结果页已经用 IntersectionObserver 对可见 deferred 图片做小批量预热，避免大菜单一次性触发大量 AI 生图。
  - 但在分类切换或任务切换时，旧的 `observedDeferredDishIdsRef` 可能保留“已观察过”的 dish id；如果用户切走前卡片还没有真正进入视口，再切回来时新 DOM 可能不会重新 observe，导致这道菜长期停留在占位图。
- 本轮修复：
  - `src/components/results/ResultsPage.tsx` 新增按 `visibleDishScopeKey` 触发的 ref 清理：
    - `observedDeferredDishIdsRef.current.clear()`
    - `deferredPrewarmQueueRef.current = []`
    - 清理未触发的 `prewarmTimerRef`
  - 这个 effect 只操作 ref 和 timer，不做同步 `setState`，避免引入额外级联渲染。
- 用户收益：
  - 在“全部/推荐/素食/分类”等 tab 间切换时，当前可见 deferred 菜品会重新进入图片预热观察。
  - 海外弱网或 100-200 道菜菜单中，用户更不容易看到长期不动的图片占位。
- 验证：
  - RED：为 `results page prewarms visible deferred dish images in small batches` 增加 ref 清理断言后，旧实现按预期失败。
  - GREEN：实现作用域清理后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "results page prewarms visible deferred dish images"` 实际跑完整文件，157/157 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

2026-08-06 LoadingPage 首屏任务轮询提速：

- 背景：
  - 上传菜单后，后端已经支持 cache miss 先返回 `task_id`，再后台写入 fast first-pass / partial result。
  - 但前端 LoadingPage 之前固定每 1500ms 轮询一次任务结果；海外网络下如果服务端刚写入 partial result，用户仍可能额外等到下一次固定轮询。
- 本轮改动：
  - `src/components/results/LoadingPage.tsx` 新增分段轮询：
    - `LOADING_TASK_POLL_FAST_MS = 700`
    - `LOADING_TASK_POLL_STEADY_MS = 1500`
    - `LOADING_TASK_FAST_POLL_WINDOW_MS = 20_000`
    - `LOADING_TASK_ERROR_RETRY_MS = 2000`
  - 新增 `getLoadingTaskPollDelay(elapsedMs)`：
    - 前 20 秒按 700ms 轮询，更快接住首批可读菜单。
    - 20 秒后回到 1500ms，避免长任务持续压服务器。
    - 网络错误仍按 2000ms 重试，避免弱网下过度请求。
- 用户收益：
  - 对真实菜单冷启动，后端一旦产出 partial result，前端最多约 0.7 秒内更容易跳转到结果页。
  - 体验上从“等整套分析完成”更接近“先给可读菜单，图片和丰富推荐继续后台补齐”。
- 验证：
  - RED：新增 `loading screen polls task results aggressively during the first overseas wait window` 后，旧实现缺少分段轮询常量和 helper，测试按预期失败。
  - GREEN：实现分段轮询后，`node --test tests/logic-regressions.test.mjs --test-name-pattern "loading screen polls task results aggressively"` 实际跑完整文件，158/158 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。
- 后续建议：
  - 用 `scripts/benchmark-menu-suite.mjs` 对真实菜单做 cache-bust 冷启动对比，重点看 `firstPageMs` 是否下降，以及请求数是否仍在可接受范围。
  - 如果前 20 秒请求量过高，可把 700ms 调到 900ms；如果海外体感仍慢，优先继续优化服务端 fast first-pass 和图片后台补齐，不建议让 LoadingPage 等图片完成。

2026-08-06 重复上传 client-hash 缓存命中提速：

- 背景：
  - 客户端已经会计算 raw/compressed hash，并先走浏览器缓存与 `/api/v1/translate/menu/cache` 轻量预探测。
  - 但如果预探测没有命中或被跳过，正式 `/api/v1/translate/menu` 上传请求里，服务端之前会先把所有上传图片 `arrayBuffer()` 读进内存，再检查 `client_hashes/client_hash_sets` 是否命中翻译缓存。
  - 对“同一菜单重复上传 / 大图 / 海外弱网”场景，这会让本来可以秒回的缓存命中仍承担大图读取成本。
- 本轮改动：
  - `src/app/api/v1/translate/menu/route.ts` 新增 `findCachedTranslationByClientKeys()`，统一处理 client-hash 缓存查找、过期内存缓存、不可缓存结果清理。
  - POST 流程中，在 `rawImageBuffers = await Promise.all(images.map(file.arrayBuffer()))` 之前先解析：
    - `earlyClientHashes`
    - `earlyClientHashSets`
    - `earlyClientCacheKeys`
  - 如果 early cache 命中且 `shouldRefreshCachedResultInBackground(earlyCachedResult)` 为 false，直接：
    - 更新 task 为完成；
    - 返回缓存结果；
    - 标记 `metadata.cache_hit_without_raw_read = true`；
    - 写入 `timings.rawReadMs = 0`；
    - 输出 `translate:client_cache_hit` 日志。
  - 如果缓存命中但缺图/缺推荐/含被清洗图片，仍继续读取图片并走原有后台刷新链路，避免牺牲缓存自愈能力。
- 用户收益：
  - 重复扫码同一菜单时，服务端不再为干净缓存命中读取完整上传图片，尤其适合海外网络、餐厅弱 Wi-Fi、大尺寸照片。
  - 大菜单/多图菜单的二次打开更轻，服务端内存压力也更低。
- 验证：
  - RED：新增 `repeat uploads can return a clean client-hash cache hit before reading full image buffers` 后，旧实现按预期失败，缺少 early cache helper 与读图前缓存命中。
  - GREEN：实现 early cache hit 后：
    - `node --test tests/logic-regressions.test.mjs`：159/159 通过。
    - `npm run lint`：通过。
    - `npm run build`：通过。
- 后续建议：
  - benchmark 中新增/观察 `cache_hit_without_raw_read` 比例；重复菜单场景应接近“无需上传后端大图读取”的体感。
  - 继续优化 cache probe 被跳过时的策略，例如大上传也先做 raw hash 轻量命中，再决定是否压缩/上传。

2026-08-06 benchmark 增加“跳过 raw image read 的缓存命中”指标：

- 背景：
  - 上一轮 POST 已支持干净 client-hash cache hit 在读取完整上传图片前直接返回。
  - 但真实菜单压测脚本还看不到这个命中是否发生，只能看总耗时，无法区分“浏览器/轻量 cache probe 命中”和“正式上传接口命中但未读大图”。
- 本轮改动：
  - `scripts/benchmark-menu-flow.mjs` 的 `summarizeResult()` 新增：
    - `cache_hit_without_raw_read`
    - `raw_read_ms`
  - `scripts/benchmark-menu-suite.mjs` 的 summary 新增：
    - `cache_hit_without_raw_read_count`
    - `cache_hit_without_raw_read_rate`
    - `p50_raw_read_ms`
    - `p90_raw_read_ms`
- 用户收益：
  - 以后跑真实菜单 benchmark 时，可以直接看到重复扫码是否真的绕过了服务端大图读取。
  - 如果 `cache_hit_without_raw_read_rate` 低，说明缓存 alias、client hash sets 或 cache probe 策略还需要继续排查。
  - 如果 `p90_raw_read_ms` 高，说明大图读取仍是正式上传链路的服务端压力点，需要继续做客户端压缩/预探测策略。
- 验证：
  - RED：新增 `menu benchmarks expose server cache hits that skip raw image reads` 后，旧脚本按预期失败。
  - GREEN：实现指标后：
    - `node --test tests/logic-regressions.test.mjs`：160/160 通过。
    - `npm run lint`：通过。
    - `npm run build`：通过。
- 推荐下一步压测命令：
 - 冷启动：
    - `node scripts/benchmark-menu-suite.mjs --base-url http://localhost:3000 --cache-bust --image-timeout-ms 0 public/sample-menus/*.jpg`
  - 重复上传/缓存路径：
    - `node scripts/benchmark-menu-suite.mjs --base-url http://localhost:3000 --repeat 2 --image-timeout-ms 0 public/sample-menus/*.jpg`

2026-08-06 大上传 raw hash alias 持久化补充：

- 背景：
  - 客户端已经支持在压缩前计算 raw image hash，并对 24MB 以内的原图做 `/api/v1/translate/menu/cache` 轻量探测。
  - 但如果 raw 探测 miss、压缩后图片仍超过 5MB，客户端会跳过 compressed hash probe；旧逻辑没有把已计算出的 raw hash sets 带到正式上传请求。
  - 结果是服务端无法把这次识别结果写入 client-hash alias，后续浏览器本地缓存失效、跨会话或不同入口重复上传时，可能仍无法走服务端 client-hash 秒回路径。
- 本轮改动：
  - `src/lib/api-client.ts` 将 `rawHashSets` 提升到上传流程外层保存。
  - 当 compressed cache probe 因 `large_upload` 被跳过时，如果已有 raw hash sets，则：
    - `clientHashSets = rawHashSets`
    - `clientHashes = clientHashSets[0] || []`
    - 后续仍通过 `formData.append("client_hash_sets", ...)` 和 `formData.append("client_hashes", ...)` 发给 `/api/v1/translate/menu`。
  - 服务端现有 `client_hash_sets` alias 写入逻辑无需改动，会在正式上传完成后把结果记到 raw client-hash cache key 下。
- 用户收益：
  - 对海外现场常见的大图菜单，第一次识别后，即使压缩图太大跳过了 compressed probe，后续重复扫码仍更容易命中服务端 client-hash 缓存。
  - 这减少重复菜单再次进入完整 OCR/视觉模型的概率，也降低大图上传链路的服务器压力。
- 验证：
  - RED：新增 `large compressed menu uploads still send raw client hash aliases to the server` 后，旧实现按预期失败，缺少外层 `rawHashSets` 与 `large_upload` 分支 alias 传递。
  - GREEN：实现后验证通过：
    - `node --test tests/logic-regressions.test.mjs --test-name-pattern "large compressed menu uploads"`：161/161 通过。
    - `node --test tests/logic-regressions.test.mjs`：161/161 通过。
    - `npm run lint`：通过。
    - `npm run build`：通过。
- 后续建议：
  - 用真实大图菜单跑重复上传 benchmark，观察第二次上传是否出现更高的 `cache_hit_without_raw_read_rate`。
  - 如果 raw hash 计算本身对超大图造成明显前端卡顿，可进一步把 hash 计算放到 Worker，或只对前 24MB 内、页数不超过阈值的场景启用。

2026-08-06 本地图片资产部署风险诊断补充：

- 背景：
  - 图片覆盖诊断显示稳定本地覆盖已经接近 `97.4%`，但此前摘要只检查 `/dishes/...` 文件是否存在于当前机器。
  - 如果这些文件没有被 Git 跟踪，本地测试能显示图片，线上 `git pull && npm run build` 后仍会破图。
  - 这正是“本地图片系统看起来好了，但线上/分享页仍有坏图”的高风险来源。
- 本轮改动：
  - `scripts/diagnose-dish-images.mjs --summary` 新增稳定本地图片资产部署字段：
    - `local_image_assets_total`
    - `local_image_assets_missing`
    - `local_image_assets_untracked`
    - `local_image_assets_deploy_ready`
  - 脚本会扫描 `public/dish-knowledge-db.json` 和 `public/generated-dish-local-index.json` 中所有 `/dishes/...` 的 `card/hero` 引用。
  - 通过 `git ls-files public/dishes` 判断被引用的图片是否已进入 Git 跟踪。
- 当前诊断结果：
  - `local_image_assets_total=965`
  - `local_image_assets_missing=0`
  - `local_image_assets_untracked=557`
  - `local_image_assets_deploy_ready=false`
- 结论：
  - 本地没有缺图，但部署并不就绪；557 个被引用的稳定本地图片仍可能在线上缺失。
  - 这比单纯 `find public/dishes` 更准确，因为它只统计实际被 DB/index 引用、会影响用户结果页/分享页的资产。
- 验证：
  - RED：新增 `dish image diagnostics reports deploy-risky local image assets` 后，旧脚本按预期失败，缺少 Git 跟踪诊断字段。
  - GREEN：实现后验证通过：
    - `node --test tests/logic-regressions.test.mjs --test-name-pattern "deploy-risky local image assets"`：162/162 通过。
    - `node --test tests/logic-regressions.test.mjs`：162/162 通过。
    - `npm run lint`：通过。
    - `npm run build`：通过。
- 下一步建议：
  - 部署前必须处理 `local_image_assets_untracked=557`：要么把这些实际引用的图片纳入 Git，要么从 DB/index 中移除不应上线的引用。
  - 处理后再次运行 `node scripts/diagnose-dish-images.mjs --summary`，目标是 `local_image_assets_deploy_ready=true`。
  - 可以进一步给部署脚本增加硬性 gate：如果 `local_image_assets_deploy_ready=false`，阻止上线。

2026-08-10 本地图片资产收口、套餐图命中与速度验证：

- 已处理 557 个部署风险图片资产：
  - 已将 `public/dishes/` 下实际被知识库/生成索引引用的新增图片纳入 Git staged 状态。
  - 修复 `scripts/diagnose-dish-images.mjs` 对非 ASCII 文件名的 Git 跟踪误判：改为 `git ls-files -z public/dishes` 并按 `\0` 拆分，避免 `crêpe.webp`、`glögg.webp`、`schwarzwälder-kirschtorte.webp` 被错误计为 untracked。
  - 新增 `--fail-on-deploy-risk` 硬性 gate：当 `local_image_assets_missing > 0` 或 `local_image_assets_untracked > 0` 时退出非 0，可接入部署脚本。

- 当前图片诊断：
  - `local_image_assets_total=967`
  - `local_image_assets_missing=0`
  - `local_image_assets_untracked=0`
  - `local_image_assets_deploy_ready=true`
  - `promoted_generated_cache=110`
  - `stable_local_with_promoted_coverage_percent=97.6`
  - `stable_local_deduped_coverage_percent=96.5`

- 真实 benchmark 结论：
  - 项目样例冷启动两张菜单：
    - `english-menu-snacks-meat-sea.jpg`: `first_result_ms=9943ms`，10/10 图片 ready。
    - `english-menu-large-plates-dessert.jpg`: `first_result_ms=10658ms`，8/8 图片 ready。
  - 重复上传缓存路径：
    - 命中后 `first_result_ms=53-122ms`。
    - 说明重复扫码同菜单的缓存闭环有效，首次识别慢主要仍由 `qwen-vl-plus` 视觉模型耗时决定。
  - 真实用户照片抽测：
    - `2024-06-17-22-53-48-749-1024x768.jpg`: 34 道菜，`first_result_ms=28745ms`，初始缺图 18，后续需要继续本地化法国小馆菜图。
    - `微信图片_20260523192458_157_838.jpg`: 命中缓存，`first_result_ms=148ms`，17/17 图片 ready。
    - `mcdonalds-menu-india-v0-...webp`: 修复前 6 道菜缺图 6；套餐匹配和本地缓存提升后冷缓存复测 `first_result_ms=6167ms`，6/6 图片 ready。

- 本轮套餐/快餐图片问题修复：
  - `src/lib/menu-analysis-normalization.ts` 增强套餐分类纠偏：`meal/combo/套餐` 且包含 `burger/wrap/paneer/Filet-O-Fish/McChicken/Maharaja` 等主体时，纠回 `staple/main` 路径，不再误判为 `drink` 或 `dessert`。
  - `src/lib/dish-name-normalization.ts` 增强菜名候选：
    - 去编号、价格、商标符号。
    - 拆分 `原文 / 英文` 双语菜名。
    - 处理重音与特殊拉丁字符。
  - `src/lib/dish-image-match.ts` 对 combo meal 先尝试本地生成缓存命中，查不到才放弃，避免已有套餐图仍反复 AI 生成。
  - 已人工目检并提升两张 Paneer 套餐图：
    - `generated-bigspicy-paneer-wrap`
    - `generated-mcspicy-paneer`
  - 诊断确认：
    - `BigSpicy Paneer Wrap Meal` -> `promoted_generated_cache`
    - `McSpicy Paneer Meal` -> `promoted_generated_cache`
    - `BigSpicy Chicken Wrap Meal` -> `promoted_generated_cache`
    - `McChicken Meal` -> `promoted_generated_cache`

- 验证结果：
  - `node scripts/diagnose-dish-images.mjs --summary --fail-on-deploy-risk`：通过，`local_image_assets_deploy_ready=true`。
  - `node --test tests/logic-regressions.test.mjs`：164/164 通过。
  - `npm run lint`：通过。
  - `npm run build`：通过。

- 仍需继续：
  - 34 道菜法国小馆样本仍有 18 张首屏缺图，下一步建议按 `scripts/promote-generated-dish-images.mjs` 的 `review_ready_mapped` 批次人工目检并提升。
  - 首次识别慢的核心瓶颈仍是云端视觉模型：本轮样例首轮模型耗时约 5-28s；重复上传已可降到百毫秒级。下一阶段应继续 A/B 更快视觉 provider、菜单裁剪/分区识别、或“粗结构先展示，完整结构后台补齐”。
