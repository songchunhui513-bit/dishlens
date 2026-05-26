# DishLens Codex 交接文档 v2

> 日期：2026-05-26
> 上一版：docs/handoff-codex-2026-05-26.md
> 仓库：https://github.com/songchunhui513-bit/dishlens
> 线上地址：https://dishlens.wukongmkt.com

---

## 当前状态

| 指标 | 值 |
|------|-----|
| 本地知识库图片 | 534/1022（52%） |
| Supabase dishes 表 | 119 条（已清理污染数据） |
| ECS generated-dishes | 166 张 / 197MB |
| SERVICE_ROLE_KEY | 已配置 |
| localStorage 历史上限 | 50 条 |
| 首页近期翻译 | 8 条 |

---

## 本轮核心修复（2026-05-26 下午）

### 致命 Bug：中文菜名 storage ID 全部碰撞

**根因**：`src/lib/dish-image-persistence.ts` 的 `slug()` 函数：
```typescript
// 旧代码 — 致命缺陷
return value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
```

中文字符不在 `[a-z0-9]` 范围内 → 全部替换为 `-` → 空字符串 → 所有纯中文菜名都 fallback 到 `generated-dish`。

**影响范围**：任何 name_original 为纯 CJK 的菜品（中文菜单、日文菜单的所有菜），storage ID 全是 `generated-dish`，AI 生成的图片互相覆盖，Supabase dishes 表全部指向同一个 URL。

**修复**：纯 CJK 名称改用 hash 生成唯一 ID：
```typescript
if (!/[a-z0-9]/.test(cleaned)) {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
    return `dish-${Math.abs(h).toString(36)}`;
}
```

**清理**：从 Supabase dishes 表删除 28 条污染记录（12 汉堡 + 16 饮品），删除对应 Supabase Storage 文件，清除 ECS `generated-dishes/` 旧缓存文件。

### 图片分类系统扩展

| 类别 | 之前 | 之后 |
|------|------|------|
| `classifyDishImageKind` | 4 类（drink/soup/dessert/main） | 9 类（+burger/wrap/sandwich/salad/pizza） |
| `imageRules` 饮品 | 1 条规则覆盖所有酒 | 9 条（啤酒/葡萄酒/威士忌/烧酒/梅酒/清酒/鸡尾酒/香槟/通用） |
| `DishImageWithLoading` | 10 种 loading 图标 | 12 种（+burger/wrap） |
| Burger prompt | 泛用 main 模板 | 专用模板，强制区分肉饼类型 |

### 其他修复

| # | 问题 | 修复 |
|---|------|------|
| 1 | AI 生图进度不可见 | Hero 区显示 `AI 正在生成图片 · 50%`，轮询实时更新 |
| 2 | 翻译缓存存的是无图旧数据 | `generateImagesInBackground` 完成后更新内存 LRU 缓存 |
| 3 | 从历史记录进入后 loading 不消失 | 轮询从 5s 延迟改为立即发射 |
| 4 | 首页近期翻译缩略图过时 | 返回首页时重新读 localStorage + 轮询检测到新图时更新历史 |
| 5 | 首页近期翻译仅 3 条 | 扩展到 8 条 |
| 6 | localStorage 无上限 | 上限改为 50 条 |
| 7 | PWA 无 manifest/图标 | 新增 manifest.json + SVG 图标 |
| 8 | Supabase 旧数据污染 | 批量清理重复 URL 记录 |

---

## 图片系统四层优先级（最终版）

```
1. 本地知识库图片（/dishes/*.png，534 张）
   └─ matchDishKnowledgeImage() → DIRECT_ALIASES → token 模糊匹配

2. ECS 本地生成图缓存（/generated-dishes/<storageId>.png）
   └─ getCachedDishImageUrl() → existsSync 检查本地文件
   └─ storageId 现在保证唯一（CJK hash + 拉丁 slug）

3. Supabase dishes 表缓存（ai_image_url 字段）
   └─ findExistingDishImages() → 批量查询，按 name_original 匹配
   └─ SERVICE_ROLE_KEY 已配置，写入不受 RLS 限制

4. AI 生图（Wan API → 保存本地 + Supabase Storage + dishes 表）
   └─ generateImagesForDishes() → 并发 2 张，每张 20-60 秒
```

**关键代码 route.ts：**
```typescript
const imageUrl = localMatch?.card || cachedGeneratedImageUrl || existingImageUrl || null;
```

---

## isDishImagePending 判定

```typescript
// 以下 URL 视为不可信 → pending → 显示 loading 动画：
- null / undefined（未生成）
- images.unsplash.com
- image.pollinations.ai  
- dashscope-result.*.aliyuncs.com（DashScope 临时签名 URL，会过期）

// 以下 URL 视为稳定 → 直接显示：
- /dishes/*.png（本地知识库）
- /generated-dishes/*.png（本地生成缓存）
- Supabase Storage 公开 URL
```

---

## 关键技术要点

### slug 函数（dish-image-persistence.ts）

**这是最关键的底层函数。任何修改都必须确保不同输入产生不同输出。**

当前逻辑：
1. 拉丁文字（含 a-z0-9）→ 传统 slug（去特殊字符、连字符化）
2. 纯 CJK/非拉丁文字 → hash 生成唯一 ID（`dish-xxxxx`）
3. 混合（中文+英文）→ slug 后取拉丁部分

### 菜名归一化（dish-name-normalization.ts）

处理价格、货币、重音、冠词、泛词（"pizza", "meal" 等）。`canonicalDishNameKey` 在 slug 之前调用，影响 storage ID 和 DB 查询。

### 生图 prompt（image-gen.ts）

9 种分类各有专用 framing prompt。关键原则：prompt 必须包含 dish name + ingredients + description，并强调与默认外观的差异化。

---

## 关键文件速查

| 文件 | 职责 |
|------|------|
| `src/app/api/v1/translate/menu/route.ts` | 翻译 API 主流程 + 图片分配 + 缓存 + 后台生图 |
| `src/lib/ai/image-gen.ts` | Wan API 生图 + 9 类 prompt |
| `src/lib/dish-image-persistence.ts` | **storageId 生成（slug 函数 — 最关键）** |
| `src/lib/dish-name-normalization.ts` | 菜名归一化（去价格/货币/冠词） |
| `src/lib/dish-image-match.ts` | 知识库图片匹配 |
| `src/lib/dish-presentation.ts` | 前端图片 URL 解析 + imageRules + isDishImagePending |
| `src/lib/storage/supabase-storage.ts` | Supabase Storage + 本地文件缓存 |
| `src/lib/db/supabase.ts` | Supabase client（含 admin client） |
| `src/lib/cache/task-store.ts` | Supabase tasks 表 CRUD |
| `src/components/shared/DishImageWithLoading.tsx` | 图片容器（loading 动画 + 进度 + onError） |
| `src/app/page.tsx` | 全局状态管理 |

---

## 设计约束（绝对不能做）

1. 不要改 UI 视觉设计（颜色、字体、间距、圆角、动画参数）
2. 不要删 Nginx default 配置
3. 不要修改 globals.css 设计 token
4. isLocalImageUrl 只接受 `/dishes/` 路径
5. 不要用 shimmer/骨架屏做加载态
6. 不要用真实食物照片做 AI 生图占位
7. slug 函数不能对非拉丁字符返回空字符串

---

## 待处理事项

### P1

| 事项 | 说明 |
|------|------|
| 知识库图片继续下载 | `DOWNLOAD_LIMIT=30 node scripts/download-knowledge-images.mjs`，534/1022，每批 30 张约 42 分钟 |
| 下载的新图片 commit | `public/dishes/` 中约 55 张新图片未 commit 到 Git |
| 验证 burger/drink 重新上传 | 旧数据已清除，新上传应该生成不同图片 |

### P2

| 事项 | 说明 |
|------|------|
| 用户认证 UI | AuthModal.tsx 未创建 |
| ECS generated-dishes 体积 | 197MB/166 张，需监控磁盘 |
| 多实例部署 | generated-dishes 是本地文件，多实例需共享存储 |
| 生图失败重试 | Wan API 失败后仅有 Pollinations fallback，无自动重试 |

---

## 部署

```bash
ssh root@8.133.168.91
cd /opt/dishlens && git pull && npm run build && pm2 restart dishlens
pm2 logs dishlens --lines 50
```

线上 `.env.production` 已配置 `SUPABASE_SERVICE_ROLE_KEY`。
