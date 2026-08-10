# DishLens 项目总结 — 2026-06-29

## 部署状态

| 环境 | 地址 | 服务器 | 状态 |
|------|------|------|------|
| 生产 | https://dishlens.wukongmkt.com | Google Cloud 35.255.147.40 | ✅ HTTP 200 |
| 备用 | 8.133.168.91:3000 (PM2) | 阿里云 | ✅ 已同步部署 |
| 本地 | http://localhost:3101 | MacBook | ✅ 研发环境 |

## 核心功能清单

### AI 菜单识别与翻译
- 两阶段识别：快速出文字结果 → 精炼补充推荐/标签/分类
- Qwen VL 为主，DeepSeek/Gemini fallback
- AI 输出结构化字段：recommendation/good_for/caution/category/included_items
- 大菜单 JSON 截断自动降级 simple mode 重试
- API 超时 120s，前端轮询 180s
- 流式渐进加载：完成一页展示一页，不等全部完成

### 结果页
- SummaryInsightCard：餐厅名 + AI洞察 + 场景标签 + 招牌推荐（3级fallback）
- 20 类智能分类：自适应菜单大小，菜品属性优先级 > 硬编码规则
- Dish Cards：120×120 图片 + 序号/评分/菜名/原文/描述/标签/价格/＋按钮
- 价格自动识别货币（parseDishPrice）
- 卡片边距/溢出修复

### 菜品图片生成
- Wan/DashScope 异步生成
- 7 类高风险菜品视觉词典（红鲻鱼/鹅肝/扇贝/蜗牛/布拉塔/牛排/甜品饮料）
- 图片状态追踪：pending/done/failed + 前端重试按钮
- 奶酪拼盘匹配修复（20+关键词），去掉裸"酒"通配
- 限流保护：并发1 + 3s间隔 + 指数退避重试

### 点单闭环
- 列表页/详情页支持增减份数
- 店员核对页：原文菜名/图片/份数/价格/备注分段
- 点过页：按餐厅聚合 + 地标图标
- 底部入口：历史/收藏/点过/设置

### 首页与地标
- 今日推荐卡片
- 最近翻译：餐厅化记录 + 16国地标PNG图标
- 位置推荐骨架（待接入 Key）

### 稳定与体验
- SSR 白屏修复（去掉 mounted guard）
- Next.js ISR 缓存清除（nginx 覆盖 Cache-Control）
- 本地 Task Store 内存 fallback
- 图片生成有序队列，不限制前16道

## 本地 vs 线上差异

本地有但线上未发布的：
- 风格切换（三主题已开发但 UI 入口已隐藏，CSS 已还原）

## 测试基线

| 指标 | 结果 |
|------|------|
| 逻辑回归测试 | 65/65 pass |
| Lint | 0 error 0 warning |
| Build | pass |

## 关键文件索引

### AI 翻译
- `src/app/api/v1/translate/menu/route.ts` — 翻译 API 主流程
- `src/lib/ai/qwen.ts` — AI prompt + API 封装
- `src/lib/ai/image-gen.ts` — 图片生成 prompt + 视觉词典

### 结果页
- `src/components/results/ResultsPage.tsx`
- `src/components/results/SummaryInsightCard.tsx`
- `src/components/results/CategoryTabs.tsx`
- `src/lib/results-categories.ts` — 分类引擎
- `src/lib/results-insight-fallback.ts` — 元数据提取

### 点单
- `src/components/order/OrderConfirmPage.tsx`
- `src/components/order/OrderedPage.tsx`
- `src/lib/order-state.ts`

### 首页
- `src/components/home/HomePage.tsx`
- `src/components/shared/RegionLandmarkIcon.tsx`
- `src/lib/recent-menu-records.ts`

### 通用
- `src/types/index.ts`
- `src/lib/local-storage.ts`
- `src/lib/dish-presentation.ts`
- `src/lib/dish-image-match.ts`
- `tests/logic-regressions.test.mjs`

## 部署架构

```
dishlens.wukongmkt.com
        ↓
  DNS (阿里云 hichina)
        ↓
  Google Cloud VM (35.255.147.40)
  ├── nginx :80 → proxy → :3000
  ├── PM2: dishlens (next start)
  ├── Node.js 22.22.2
  └── /opt/dishlens (git pull from GitHub)

  阿里云 ECS (8.133.168.91) — 备用
  ├── BT Panel nginx :80/443 → proxy → :3000
  ├── PM2: dishlens (next start)
  └── /opt/dishlens (git pull from GitHub)
```

### 部署流程
```bash
# 本地提交推送
git add -A && git commit -m "..." && git push origin main

# 阿里云
ssh root@8.133.168.91
cd /opt/dishlens && git pull && npm run build
pm2 restart dishlens --update-env

# Google Cloud
gcloud compute ssh dishlens-global --zone us-central1-a
cd /opt/dishlens && git pull
# .next 从阿里云同步（避免本地构建的 lightningcss 兼容问题）
pm2 restart dishlens
```

## 待完成

| 优先级 | 事项 |
|--------|------|
| P1 | 真实菜单识别回归测试 |
| P1 | 图片生成可靠性验证（Wan限流/失败率） |
| P2 | Google Cloud 配置 SSL 证书 |
| P2 | 位置推荐 Google/高德 Key 接入 |
| P2 | 724 张 Pollinations 图片下载到本地 |
