# DishLens GeoDNS 双站部署交接文档

> 日期：2026-06-02
> 上一版：docs/handoff-codex-2026-05-26-v2.md
> 仓库：https://github.com/songchunhui513-bit/dishlens

---

## 核心变更：单域名 GeoDNS 双站架构

同一域名 `dishlens.wukongmkt.com`，DNS 根据用户 IP 自动路由：

```
国内用户 → 8.133.168.91 (阿里云 ECS)
海外用户 → 35.255.147.40 (Google Cloud VM)
```

两站共用同一个 Supabase 数据库和 Qwen API Key。

---

## 服务器清单

| 项目 | 国内站 | 海外站 |
|------|--------|--------|
| 域名 | dishlens.wukongmkt.com | dishlens.wukongmkt.com |
| IP | 8.133.168.91 | 35.255.147.40（静态） |
| 云商 | 阿里云 ECS | Google Cloud e2-medium |
| 系统 | CentOS / Alibaba Linux | Debian 12 |
| 目录 | /opt/dishlens | /opt/dishlens-global |
| PM2 | dishlens | dishlens-global |
| AI 提供者 | qwen,deepseek | qwen |
| 证书 | Let's Encrypt | Let's Encrypt |
| SSH 用户 | root@8.133.168.91 | julian@35.255.147.40 |

---

## DNS 配置（阿里云万网 DNS）

| 主机记录 | 类型 | 解析线路 | 记录值 |
|---------|------|---------|--------|
| dishlens | A | 默认 | 8.133.168.91 |
| dishlens | A | 境外 | 35.255.147.40 |

**注意**：不再需要 `global.dishlens` 子域名，已删除。

---

## Google 服务器 SSH

```bash
# 方式 1：gcloud CLI
gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359

# 方式 2：直连（需 Google Cloud 防火墙开放 22）
ssh julian@35.255.147.40
```

---

## 日常运维命令

### 更新代码（两台都要做）

```bash
# 国内
ssh root@8.133.168.91 "cd /opt/dishlens && git pull && npm run build && pm2 restart dishlens"

# 海外
gcloud compute ssh dishlens-global --zone us-central1-a --project gen-lang-client-0436209359 --command "cd /opt/dishlens-global && git pull && NODE_OPTIONS='--max-old-space-size=768' npm run build && pm2 restart dishlens-global"
```

### 查看日志

```bash
# 国内
ssh root@8.133.168.91 "pm2 logs dishlens --lines 50 --nostream"

# 海外
gcloud compute ssh dishlens-global --zone us-central1-a --command "pm2 logs dishlens-global --lines 50 --nostream"
```

### 重启服务

```bash
# 国内
ssh root@8.133.168.91 "pm2 restart dishlens"

# 海外
gcloud compute ssh dishlens-global --zone us-central1-a --command "pm2 restart dishlens-global"
```

### 查看 PM2 状态

```bash
gcloud compute ssh dishlens-global --zone us-central1-a --command "pm2 status"
ssh root@8.133.168.91 "pm2 status"
```

---

## 环境变量差异

| 变量 | 国内站 | 海外站 |
|------|--------|--------|
| NEXT_PUBLIC_APP_URL | https://dishlens.wukongmkt.com | https://dishlens.wukongmkt.com |
| MENU_AI_PROVIDER | qwen,deepseek | qwen |
| QWEN_API_KEY | ✅ | ✅ |
| SUPABASE_URL | ✅ | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | ✅ | ✅ |
| DEEPSEEK_API_KEY | ✅ | ❌ 无 key |

---

## 已知差异和注意事项

### 1. generated-dishes 目录不同步
- 国内 ECS：228MB / 191 张
- Google VM：0 张（新建）
- **影响**：同一道菜在国内翻译过后，海外再翻译仍会重新生图
- **缓解**：两台机都优先用 Supabase Storage URL。只要 Supabase dishes 表有记录，两边都能复用

### 2. Google 服务器 npm build 内存限制
e2-medium 只有 4GB，npm install 和 build 需要：
```bash
NODE_OPTIONS='--max-old-space-size=768' npm run build
```
如果仍然 OOM，先启用 swap：`sudo swapon /swapfile`

### 3. PM2 已配开机自启（Google 站）
systemd 服务：`pm2-julian.service`，重启 VM 后自动恢复。

### 4. DNS 生效时间
GeoDNS 修改后最多 10 分钟（600s TTL）全球生效。

---

## AI 提供者链路

```
analyzeMenuImage() → providerOrder() → qwen → deepseek → gemini → ollama
```

当前两站：
- **国内**：qwen 优先，deepseek 兜底（`MENU_AI_PROVIDER=qwen,deepseek`）
- **海外**：仅 qwen（`MENU_AI_PROVIDER=qwen`）

如获取 DeepSeek 或 Gemini key，加入海外 `.env.production` 后重启即可。

---

## 待处理

| 优先级 | 事项 |
|--------|------|
| P1 | Google 服务器装 swap（防 build OOM）— 已创建 `/swapfile`（2GB），运行 `sudo swapon /swapfile` 启用 |
| P1 | Google 服务器同步 generated-dishes — 或依赖 Supabase Storage 兜底 |
| P1 | 知识库图片继续下载 — 539/1022，`scripts/download-knowledge-images.mjs` |
| P2 | 国内站代码对齐 Google 站（commit `21d0813` vs `954845c` 之后的分叉）|
| P2 | 小程序对齐 H5 — 文档 `docs/plans/miniprogram-h5-alignment.md` |
| P3 | ECS 磁盘监控 — generated-dishes 228MB 持续增长 |

---

## 设计约束（同之前，重申）

1. 不要改 UI 视觉设计（颜色/字体/间距/圆角/动画）
2. 不要删 Nginx default 配置（国内服务器服务于 wukongmkt.com）
3. 不要修改 globals.css 设计 token
4. slug 函数保证纯 CJK 名称唯一（hash fallback）
5. 不要用 shimmer/真实食物照片做 loading
