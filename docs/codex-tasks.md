# Codex 执行清单

> 仓库：https://github.com/songchunhui513-bit/dishlens
> 分支：main（最新 commit: 本地待提交，上一线上 commit `6d19234`）
> 详细交接文档：`docs/handoff-codex-2026-05-25.md`
> 线上地址：https://dishlens.wukongmkt.com
> 部署：`ssh root@8.133.168.91 && cd /opt/dishlens && git pull && npm run build && pm2 restart dishlens`

---

## P0: AI 生图加载状态（最高优先级）✅ 已完成

**问题**：没有本地图片也没有缓存图片的菜品，当前显示 Unsplash 真实食物照占位 → 误导用户以为是实际菜品图。

**需求**：
1. 初始显示**品牌风格加载动画**（不是真实食物照片）
2. 动画风格必须与 `src/components/results/FoodCharacters.tsx` 一致：暖奶油底色 `#FFF5E9` + 棕色描边 `#D4A574` + 橙色星星 `#FF9F1C` + 手绘 SVG + 柔和微浮动
3. **禁止 shimmer/骨架屏**（太 generic）
4. **禁止真实食物图片占位**（误导）
5. AI 图片生成完成后 fade out 加载动画 → fade in 真实图片

**涉及两个位置**：
- 列表卡片 68×68：`src/components/results/ResultsPage.tsx` line 224
- 详情页 Hero 全宽 200px：`src/components/dish/DishDetailPage.tsx` line 138

**已实现**：
1. 新增 `isDishImagePending(dish)` → `src/lib/dish-presentation.ts`
2. 新建 `src/components/shared/DishImageWithLoading.tsx`
3. 已替换 ResultsPage 和 DishDetailPage 图片位
4. 新增 `.dish-image-loading` / `.dish-image-ready` 动画样式
5. 按 dessert/soup/drink/pasta/main 展示不同手绘小动画

**设计参考**：
- `src/components/results/FoodCharacters.tsx`
- `src/app/globals.css` line 111-132（steamA、bowlFloat、sparkleA 等 keyframes）
- v7 设计 token：`globals.css` :root 变量

---

## P1: 部署上线

代码已 push 到 main。需要：
1. `ssh root@8.133.168.91`
2. `cd /opt/dishlens && git pull && npm run build && pm2 restart dishlens`
3. `pm2 logs dishlens --lines 50` 确认启动正常
4. 访问 https://dishlens.wukongmkt.com 验证

---

## P1: 图片持久化验证 ✅ 已加固，待真实菜单复测

当前实现：
1. 本地有匹配：直接用 `/dishes/*.png`
2. 本地无匹配：先查确定性缓存 `/generated-dishes/<storageId>.png`
3. 仍无缓存：AI 生图，写入 ECS 本地 `public/generated-dishes/`
4. 如配置 `SUPABASE_SERVICE_ROLE_KEY`，同步写 Supabase Storage / dishes 表
5. 再次遇到同名菜：直接复用确定性本地缓存或 DB 缓存

**已知风险**：当前阿里云 `.env.production` 缺 `SUPABASE_SERVICE_ROLE_KEY`，DB 行写入仍可能受 RLS 限制，但 ECS 本地生成图缓存已经能兜底复用。

## P1: 饮品/汤类生图准确性 ✅ 已完成基础修复

- `src/lib/ai/image-gen.ts` 新增 `classifyDishImageKind`
- 饮品：提示词使用 cup/mug/glass，不再要求 plate
- 汤类：提示词使用 bowl/broth/soup/stew，不再要求 plate
- 甜点：使用 dessert portion 小盘/碗构图

---

## P1: 知识库图片本地化（724 张）

724/1022 道菜只有 Pollinations URL（浏览器加载不稳定），需下载为本地文件：
1. 读 `public/dish-knowledge-db.json`，筛选 `card` 或 `hero` 字段包含 `pollinations.ai` 的条目
2. 批量下载为 `/dishes/<slug>.png`
3. 更新 JSON 中对应条目的 `card`/`hero` 字段为 `/dishes/<slug>.png`
4. 下载后 `isLocalImageUrl` 就能匹配更多菜

---

## P1: dishes 表脏数据清理

之前错误缓存的 AI 图片仍在表中（如牛排配给了博洛尼亚香肠）：
```sql
DELETE FROM dishes WHERE image_source = 'ai' AND ai_image_url LIKE '%unsplash%';
```

---

## P1: Supabase RLS for dishes 表

匿名用户 INSERT 被 RLS 阻止。解决方案：
- 用 service_role client（`SUPABASE_SERVICE_ROLE_KEY`）
- 或调整 RLS 策略允许匿名 INSERT
- 检查：`supabase/schema.sql` line 263

---

## P2: 其他

| 事项 | 说明 |
|------|------|
| 用户认证 UI | AuthModal.tsx 未创建 |
| localStorage 历史上限 | 无上限，建议 50 条 |
| PWA manifest | 缺 manifest.json |
| 错误监控 | 无 Sentry |

---

## 关键文件速查

| 文件 | 职责 |
|------|------|
| `src/app/api/v1/translate/menu/route.ts` | 翻译 API 主流程 + 图片分配 + 缓存 + 后台生图 |
| `src/lib/dish-image-match.ts` | 知识库图片匹配（DIRECT_ALIASES + token 模糊匹配） |
| `src/lib/dish-presentation.ts` | 前端图片 URL 解析 + 菜品洞察文案 + imageRules |
| `src/lib/ai/image-gen.ts` | AI 图片生成（Wan API + Pollinations fallback） |
| `src/components/results/FoodCharacters.tsx` | 食物角色动画（加载动画设计参考） |
| `src/components/results/ResultsPage.tsx` | 翻译结果列表（卡片图片） |
| `src/components/dish/DishDetailPage.tsx` | 菜品详情页（Hero 图片） |

---

## 绝对不能做

1. **不要改 UI 组件的视觉设计**（颜色、字体、间距、圆角、动画参数）
2. **不要删 Nginx default 配置**
3. **不要修改 globals.css 设计 token**
4. **isLocalImageUrl 只接受 `/dishes/` 路径**
