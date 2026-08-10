# DishLens 项目交接文档 — 2026-07-01

> **交接对象**: Codex
> **当前状态**: 本地研发态，生产环境已同步最新代码
> **基线**: 65/65 测试通过 | Lint 0 | Build pass

---

## 1. 项目概述

DishLens — H5/PWA AI 菜单翻译工具。面向海外旅行者、留学生、商务出行用户。

**核心闭环**: 拍照 → AI 识别翻译 → 智能分类浏览 → 选菜点单 → 给店员核对 → 保存到点过

**设计风格**: v7 Warm Editorial — 暖奶油底色 + 鼠尾草绿主色 + 暖橙点缀。禁止 emoji、禁止粗黑重 UI。

**技术栈**: Next.js 16 App Router + React 19 + TypeScript strict + TailwindCSS 4 + Supabase + Qwen VL + Wan AI

---

## 2. 部署环境

| 环境 | 地址 | 服务器 | 管理 |
|------|------|------|------|
| 生产 | https://dishlens.wukongmkt.com | Google Cloud 35.255.147.40 | PM2 + nginx |
| 备用 | 8.133.168.91:3000 | 阿里云 ECS | PM2 + BT Panel nginx |
| 展示页 | https://dishlens-summary-deploy.vercel.app | Vercel | 自动部署 |
| 本地 | http://localhost:3101 | MacBook | `npm run dev -- -p 3101` |

### 部署流程

```bash
# 1. 本地提交推送
git add -A && git commit -m "..." && git push origin main

# 2. 服务器拉取部署
# Google Cloud:
gcloud compute ssh dishlens-global --zone us-central1-a
cd /opt/dishlens && git pull
# 构建产物从阿里云同步(.next + node_modules)，避免 lightningcss 兼容问题

# 阿里云:
ssh root@8.133.168.91
cd /opt/dishlens && git pull && npm run build
set -a && source .env.production && set +a && pm2 restart dishlens --update-env
```

### DNS

- `dishlens.wukongmkt.com` → 35.255.147.40 (Google Cloud)
- DNS 托管: 阿里云 hichina (dns23/dns24.hichina.com)
- 免费版不支持分线路，GeoDNS 待 Cloudflare 迁移

---

## 3. 核心功能清单

### AI 菜单识别
- 两阶段识别: 快速出文字 → 精炼补推荐/标签/分类
- Qwen VL 为主，DeepSeek/Gemini fallback
- 大菜单 JSON 截断自动降级 simple mode
- API 超时 120s，前端轮询 180s
- 流式渐进加载: 完成一页展示一页

### 结果页
- SummaryInsightCard: 餐厅名 + AI洞察 + 场景标签 + 招牌推荐(3级fallback)
- 20 类智能分类，自适应菜单大小
- Dish Cards: 120×120 图片 + 序号/评分/菜名/原文/标签/价格
- parseDishPrice 自动识别货币符号
- 卡片边距/溢出修复

### 菜品图片生成
- Wan/DashScope 异步生图
- 7 类高风险菜品视觉词典(红鲻鱼/鹅肝/扇贝/蜗牛/布拉塔/牛排/甜饮品)
- 限流保护: 并发1 + 间隔3s + 指数退避重试
- 前端状态跟踪 + 重试按钮
- 奶酪拼盘匹配修复，去掉裸"酒"通配

### 点单闭环
- 列表页/详情页增减份数
- 店员核对页: 原文菜名/图片/份数/价格/备注分段
- 点过页: 按餐厅聚合 + 16国地标图标

### 首页
- 今日推荐卡片
- 最近翻译: 餐厅化记录 + 地标PNG图标
- 底部入口: 历史/收藏/点过/设置
- 位置推荐骨架(待接入 Google/高德 Key)

### 稳定性
- SSR 白屏修复(去掉 mounted guard)
- ISR 缓存清除(nginx 覆盖 Cache-Control)
- 本地 Task Store 内存 fallback
- 图片生成有序队列，不限制前16道

---

## 4. 关键文件索引

### AI 翻译
| 文件 | 职责 |
|------|------|
| `src/app/api/v1/translate/menu/route.ts` | 翻译 API 主流程 |
| `src/lib/ai/qwen.ts` | AI prompt + API 封装 |
| `src/lib/ai/image-gen.ts` | 图片生成 prompt + 视觉词典 |
| `src/lib/cache/task-store.ts` | 任务状态管理(内存+Supabase) |

### 结果页
| 文件 | 职责 |
|------|------|
| `src/components/results/ResultsPage.tsx` | 结果页主组件 |
| `src/components/results/SummaryInsightCard.tsx` | 洞察卡片 |
| `src/components/results/CategoryTabs.tsx` | 分类标签栏 |
| `src/lib/results-categories.ts` | 20类分类引擎 |
| `src/lib/results-insight-fallback.ts` | 元数据提取+fallback |

### 点单
| 文件 | 职责 |
|------|------|
| `src/components/order/OrderConfirmPage.tsx` | 店员核对页 |
| `src/components/order/OrderedPage.tsx` | 点过列表 |
| `src/components/order/OrderQuantityControl.tsx` | 加减按钮 |
| `src/lib/order-state.ts` | 点单状态+价格解析 |

### 首页
| 文件 | 职责 |
|------|------|
| `src/components/home/HomePage.tsx` | 首页 |
| `src/components/shared/RegionLandmarkIcon.tsx` | 地标图标 |
| `src/lib/recent-menu-records.ts` | 最近翻译记录 |
| `src/hooks/useDailyRecommendation.ts` | 每日推荐 |

### 通用
| 文件 | 职责 |
|------|------|
| `src/app/page.tsx` | 全局状态管理(所有页面路由) |
| `src/app/layout.tsx` | 根布局 |
| `src/app/globals.css` | 设计 token |
| `src/types/index.ts` | 类型定义 |
| `src/lib/local-storage.ts` | localStorage 持久化 |
| `src/lib/dish-presentation.ts` | 菜品文本/图片/洞察 |
| `src/lib/dish-image-match.ts` | 本地知识库图片匹配 |
| `tests/logic-regressions.test.mjs` | 65个逻辑回归测试 |

---

## 5. 开发约定

1. 设计 token 只用 `var(--xxx)`，不创新颜色
2. 字体: `var(--font-display)` (衬线菜名) / `var(--font-body)` (UI) / `var(--font-ui)` (标签)
3. `"use client"` 必加在交互组件
4. 视口 393×852，移动端优先
5. 禁止 emoji 图标，用 SVG 或文字
6. 禁止擅自改首页/结果页/详情页视觉骨架

---

## 6. 待完成

| 优先级 | 事项 |
|------|------|
| P1 | 真实菜单识别回归测试 |
| P1 | 图片生成可靠性验证(Wan 限流/失败率) |
| P2 | Google Cloud SSL 证书签发 |
| P2 | 位置推荐 Google/高德 Key 接入 |
| P2 | 724 张 Pollinations 图片下载到本地 |
| P2 | Cloudflare DNS 迁移(实现 GeoDNS) |

---

## 7. 接手步骤

```bash
cd /Users/julian/AI点菜/dishlens

# 1. 确认基线
node --test tests/logic-regressions.test.mjs
npm run lint
npm run build

# 2. 启动本地开发
npm run dev -- -p 3101
# 访问 http://localhost:3101/?recent-landmark-a=1&task-store-fix=1

# 3. 查看文档
ls docs/

# 4. 查看展示页
open https://dishlens-summary-deploy.vercel.app
```

## 8. 重要提醒

- 不要清理/回滚未提交的本地改动
- 不要擅自部署到生产环境
- 不要重写首页、结果页、详情页视觉
- API key 不要写入代码或文档
- 修改后跑 `node --test tests/logic-regressions.test.mjs` 确认不破坏现有逻辑
