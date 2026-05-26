# DishLens 图片缓存与上传速度交接

> 日期：2026-05-26
> 工作目录：`/Users/julian/AI点菜/dishlens`
> 主题：上传后耗时、图片本地化、AI 生图缓存、离线依赖说明

## 本次完成

1. 图片缓存命中前置加速
   - 菜单翻译结果组装阶段改为批量查询 Supabase `dishes` 表，不再每道菜单独查一次。
   - 图片优先级保持为：本地知识库 `/dishes/` > ECS 生成图 `/generated-dishes/` > Supabase 已生成图 > AI 生图。
   - 对用户上传速度的影响：命中本地或已生成缓存时，结果页不再等待 AI 生图；未命中新菜仍后台生成。

2. 菜名归一与去重
   - 新增 `src/lib/dish-name-normalization.ts`。
   - 处理价格、货币、大小写、重音符号、括号描述、点线、常见冠词和泛词。
   - 例子：`LA MARINARA 11,50€` 与 `Marinara Pizza` 会归一到同一个 key，生成图缓存 id 均为 `generated-marinara`。

3. 本地图库落地
   - `scripts/download-knowledge-images.mjs` 新增 `--existing-only`，可只吸收已经存在的本地图，不访问外网。
   - 本次已把 22 张 `public/dishes/*.png` 写回 `public/dish-knowledge-db.json`。
   - 当前诊断统计：1022 道知识库菜，320 道命中本地图库，702 道仍是远程旧 URL/待本地化。

4. 图片系统诊断
   - 新增 `scripts/diagnose-dish-images.mjs`。
   - 可输出每道菜命中哪一层：`local_knowledge`、`generated_local`、`supabase_db`、`ai_pending`。
   - 示例：
     - `node scripts/diagnose-dish-images.mjs --summary`
     - `node scripts/diagnose-dish-images.mjs "Borscht" "LA MARINARA 11,50€"`

5. 运行时生成图不进 Git
   - `.gitignore` 新增 `/public/generated-dishes/`。
   - 该目录是运行时缓存，线上 ECS 会继续保留；源码只提交可复用的知识库图片 `/public/dishes/`。

6. 线上持久化补齐
   - 线上 Supabase Storage 原本缺少 `dishes` bucket，AI 图片上传报 `Bucket not found`。
   - 已用 service role 创建公开 `dishes` bucket。
   - 已验证 `generated-burrata-du-moment-l-inspiration-du-chef-mauro.png` 可上传到 Supabase Storage，并已把对应 `dishes.ai_image_url` 更新为 Supabase 公共 URL。

7. 缓存任务进度修正
   - 修复内存翻译缓存命中时 `progress.current` 仍为 0 的问题。
   - 现在重复上传同菜单会返回 `cached: true`，任务状态为 `done` 且进度为 `1/1`。

## 本地/云端模型与离线影响

| 能力 | 当前实现 | 本地还是云端 | 主机离线影响 |
|---|---|---|---|
| 菜单图片 OCR/识别 | Qwen VL Max `qwen-vl-max` | 云端 DashScope | 新上传菜单无法识别 |
| 翻译精炼/评价总结/审核 | Qwen Plus `qwen-plus` | 云端 DashScope | 相关 AI 文本能力不可用 |
| AI 菜品生图 | Wan `wanx2.1-t2i-turbo` | 云端 DashScope | 新菜无法生成真实图片 |
| 生图 fallback | Pollinations Flux URL | 云端第三方 | 离线不可用，且不作为稳定缓存 |
| 本地知识库图 | `public/dishes/*.png` | 本地静态资源 | 不受外网影响，只要网站服务可访问 |
| 已生成图本地缓存 | `public/generated-dishes/*.png` | ECS 本地文件 | ECS 在线即可访问；多实例需共享存储 |
| 已生成图云端缓存 | Supabase Storage + `dishes.ai_image_url` | 云端 Supabase | 主机离线不可写；用户访问也依赖 Supabase 可达 |
| 翻译任务状态 | Supabase `tasks` 表 | 云端 Supabase | 新任务轮询/跨进程恢复受影响 |
| 历史/收藏页面态 | 浏览器 `localStorage` 为主 | 用户浏览器本地 | 已缓存数据可看，云端同步能力受限 |

结论：当前产品不是离线 AI 产品。本地化图片能显著减少生图等待，但新菜单识别、翻译、新菜生图仍依赖云端模型。若 ECS 主机断网，用户打开线上站点本身也会受影响；若只是本机开发环境离线，不影响已部署线上服务。

## 验证结果

- `node --test tests/logic-regressions.test.mjs` 通过，14/14。
- `npm run lint` 通过。
- `npm run build` 通过。
- `node scripts/diagnose-dish-images.mjs --summary` 输出：`local_knowledge=320`，`ai_pending_or_remote=702`。
- 线上 `public/generated-dishes/` 当前约 65 张、86MB。
- 线上重复上传 `/Users/julian/Documents/菜单/微信图片_20260523192450_154_838.jpg`：
  - 首次：约 1 秒返回任务入口，后台 OCR 后命中 `/generated-dishes/generated-burrata-du-moment-l-inspiration-du-chef-mauro.png`。
  - 再次：约 1 秒命中内存缓存，`cached=true`，progress `1/1`。
- 诊断样例：
  - `Borscht` -> `local_knowledge` -> `/dishes/borscht.png`
  - `Tangyuan` -> `local_knowledge` -> `/dishes/tangyuan.png`
  - `LA MARINARA 11,50€` -> `local_knowledge` -> `/dishes/pizza-marinara.png`
  - `Marinara Pizza` -> `local_knowledge` -> `/dishes/pizza-marinara.png`

## 后续建议

1. 继续补图库
   - 优先用 `DOWNLOAD_LIMIT=50 node scripts/download-knowledge-images.mjs` 小批量补图，避免 Pollinations 限速导致长时间阻塞。
   - 每批跑完用 `node scripts/diagnose-dish-images.mjs --summary` 看本地覆盖率。

2. 验证线上持久化闭环
   - 上传一份含新菜的小菜单。
   - 等 AI 生图完成后检查 ECS `public/generated-dishes/`、Supabase Storage、`dishes.ai_image_url`。
   - 再次上传同菜单，应命中本地生成图或 Supabase 缓存，不重复生图。

3. 进一步提速
   - 把 `tasks` 写入失败降级为内存任务，避免 Supabase 慢时拖慢上传流程。
   - 对多页菜单先返回 OCR/翻译结果，图片全部后台增量刷新。
   - 为 Supabase `dishes.name_original` 增加归一化字段和索引，避免只靠原文候选查询。
