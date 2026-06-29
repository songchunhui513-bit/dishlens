# DishLens 项目进展总结 — 2026-06-08

> **交接给**: Codex
> **目标**: 继续本地研发与验证，暂不发布线上
> **重要**: 现网 H5 设计风格不能乱改，线上环境不要擅自部署

---

## 1. 项目定位

DishLens — H5/PWA AI 菜单翻译工具。面向海外旅行者、留学生、商务出行用户。

核心闭环：拍照 → AI 识别翻译 → 智能分类浏览 → 选菜点单 → 给店员核对 → 保存到"点过"

## 2. 技术栈

- **Next.js 16** App Router + React 19 + TypeScript strict
- **TailwindCSS 4** + 自定义 CSS 变量
- **Qwen VL** (DashScope) — 菜单 OCR + 翻译
- **Wan AI** (DashScope) — 菜品图片生成
- **Supabase** — 数据持久化
- **localStorage** — 客户端状态（设置/历史/收藏）
- **PM2** — 生产进程管理（端口 3000）
- **BT Panel** — 服务器管理（nginx + PHP）

## 3. 设计系统

```css
--bg: #FFF5E9; --card: #FEE6CB; --card-alt: #FFF0DD;
--ink: #2D2D2D; --primary: #4CAF50; --accent: #FF9F1C; --muted: #8A8A8A;
--font-display: "Source Serif 4" (品牌/菜名)
--font-body: "Poppins" (UI/按钮)
--font-ui: "Inter" (标签/说明)
视口: 393×852 (iPhone 15 Pro)
```

禁止 emoji 图标 / 禁止粗重黑色模块 / 禁止擅自改设计风格。

## 4. 基线状态

| 指标 | 状态 |
|------|------|
| 测试 | 60/60 pass (`node --test tests/logic-regressions.test.mjs`) |
| Lint | 0 error, 0 warning |
| Build | pass |
| 本地 | `http://localhost:3101` |
| 线上 | `https://dishlens.wukongmkt.com` |
| 官网 | `https://wukongmkt.com` |

## 5. 已完成功能

### 5.1 AI 菜单识别
- 两阶段识别：快速出文字 → 精炼补推荐/标签
- Qwen VL 为主，支持 DeepSeek fallback
- AI 输出结构化字段：`recommendation`/`good_for`/`caution`/`category`
- `menu_metadata` 完整传递（restaurant/insight/signature）

### 5.2 结果页
- **SummaryInsightCard**: 餐厅名+评分+AI洞察+场景标签+招牌推荐
- **CategoryTabs**: 20 类智能分类，自适应菜单大小
- **Dish Cards**: 120×120 图片、序号、评分徽章、菜名/原文、描述、标签、价格、＋按钮
- **Floating Bar**: 右下角浮层显示已选数量和总价

### 5.3 菜品图片生成
- Wan/DashScope 异步生成
- `buildDishVisualProfile()` — 7 类高风险菜品视觉词典（红鲻鱼/鹅肝/扇贝/蜗牛/布拉塔/牛排/甜品饮料）
- 每道菜 `image_status`: pending/done/failed
- 失败图片显示"重试"按钮，`POST /api/v1/dish/[id]/generate-image` 单项重试
- 去掉了「酒」裸通配规则，修复奶酪被误判为酒类的问题

### 5.4 点单闭环
- 列表页和详情页支持增加菜品份数
- 给店员核对页：原文菜名、图片、份数、价格、备注
- "点过"页按餐厅聚合

### 5.5 分享
- 系统分享 + 复制链接 + WhatsApp/Telegram/LINE/Facebook/X
- iOS 原生 share sheet，OG 元数据

### 5.6 首页
- 今日推荐（可扩展为位置推荐）
- 底部入口：历史/收藏/点过/设置

## 6. 核心文件清单

### 前端组件
| 文件 | 职责 |
|------|------|
| `src/components/results/ResultsPage.tsx` | 结果页主组件 |
| `src/components/results/SummaryInsightCard.tsx` | 洞察卡片 |
| `src/components/results/CategoryTabs.tsx` | 分类标签栏 |
| `src/components/shared/CuisineIllustration.tsx` | 9语种料理插画 |
| `src/components/shared/DishImageWithLoading.tsx` | 菜品图片（含重试按钮） |
| `src/components/order/OrderQuantityControl.tsx` | 加减按钮 |
| `src/components/dish/DishDetailPage.tsx` | 菜品详情 |
| `src/components/order/OrderedPage.tsx` | 点过列表 |
| `src/components/order/OrderConfirmPage.tsx` | 店员核对页 |

### 业务逻辑
| 文件 | 职责 |
|------|------|
| `src/lib/ai/qwen.ts` | Qwen VL prompt + API |
| `src/lib/ai/image-gen.ts` | 图片生成 prompt + Wan API + 视觉词典 |
| `src/lib/results-categories.ts` | 20 类智能分类引擎 |
| `src/lib/results-insight-fallback.ts` | 元数据提取+3级fallback |
| `src/lib/dish-presentation.ts` | 菜品文本/图片/洞察 |
| `src/lib/order-state.ts` | 点单状态+价格解析 |
| `src/app/api/v1/translate/menu/route.ts` | 翻译 API 主流程 |
| `src/app/api/v1/dish/[id]/generate-image/route.ts` | 单项图片重试 API |

### 原型参考
| 文件 | 说明 |
|------|------|
| `_temp/results-c-compact-enriched.html` | 主原型（Insight Card + 分类 + 卡片） |
| `_temp/results-c-final.html` | 备用原型（含数据行） |
| `_temp/boss-review-dishlens-2026-06-08.html` | 老板评审页 |
| `_temp/dish-image-prompt-logic-2026-06-08.html` | 图片生成逻辑说明 |

## 7. 关键数据流

```
用户拍照 → 压缩上传 → API route → Qwen VL 识别
    → 快速第一轮出文字结果
    → 精炼轮补充 recommendation/good_for/caution/category/menu_metadata
    → 后台 Wan 异步生成图片 (image_status: pending→done/failed)
    → 前端轮询更新
```

## 8. 服务器状态 (8.133.168.91)

| 服务 | 端口 | 管理方式 |
|------|------|----------|
| wukongmkt.com (WordPress) | 80/443 | BT Panel nginx |
| dishlens.wukongmkt.com | 80/443 → 3000 | nginx 反代 + PM2 |
| scrper-v2 | 3001 | Docker |
| Coolify | 已停止 (restart=no) | Docker |

- nginx 已注册 systemd unit (`bt-nginx`)，开机自启
- Coolify 6 个容器已停止，重启策略已改为 no，不会自动复活
- 不要通过宝塔一键安装任何带 Docker 代理的应用，会抢 80/443

## 9. 待完成

### P1
- 位置推荐：需用户提供 Google Places Key + 高德 Key
- 海外上传验证：意大利/日本/泰国/新加坡/澳大利亚
- 点单/点过功能完整验收
- 图片生成结果自检（生成后用视觉模型检查是否匹配）

### P2
- 724 张 Pollinations 图片下载到本地 `/public/dishes/`
- 微信小程序独立项目 (`feature/wechat-miniprogram` 分支)

## 10. 接手步骤

```bash
cd /Users/julian/AI点菜/dishlens

# 1. 确认基线
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build

# 2. 启动本地开发
npm run dev -- -p 3101

# 3. 查看原型
open _temp/results-c-compact-enriched.html

# 4. 查看现有文档
ls docs/
```

## 11. 环境变量

本地 `.env.local` 已配置。关键变量：
- `QWEN_API_KEY` — DashScope API key
- `QWEN_VL_MODEL` / `QWEN_TEXT_MODEL`
- `WAN_MODEL` — 图片生成模型
- `IMAGE_PROVIDER` — `wan` 或 `pollinations`
- `MENU_IMAGE_GENERATION_RETRIES` — 重试次数（默认 2）
- `MENU_IMAGE_GENERATION_CONCURRENCY` — 并发数（默认 3）

不要在文档或代码中暴露完整 API key。
