# DishLens Codex 交接文档 - 2026-08-10 海外快速生图

## 本轮目标

在不牺牲饮品、汤、海鲜和套餐准确率的前提下，降低海外用户等待 AI 菜品图的时间，并确保同一道菜只生成一次、后续跨进程和跨部署稳定复用。

## 已完成

1. 新增新加坡 Model Studio 同步生图链路。
   - 普通菜品：`z-image-turbo` 优先，`wan2.7-image` 单次回退。
   - 饮品、汤、海鲜、套餐：`wan2.7-image` 优先，失败后回退快速模型。
   - 仅超时、网络、429 和 5xx 允许回退；鉴权、权限、内容安全等终止错误立即停止，避免重复计费。
2. 详情页改为缓存优先。
   - 使用菜名和翻译生成确定性 storage id。
   - 生成前查询本机缓存、阿里 OSS、兼容 Supabase 缓存。
   - 命中后直接更新任务结果，不再调用模型。
3. 持久化闭环加固。
   - 新生成图优先保存到阿里 OSS；Supabase Storage 只作兼容回退。
   - 模型临时 URL 持久化失败时返回 502，不再把会过期的地址标记为完成。
   - 下载限制为可信 HTTPS 域名，并校验重定向最终地址、超时和最大体积。
4. 海外稳定性保护。
   - Model Studio 请求起始间隔默认 550ms，避免超过约 2 RPS。
   - 快速模型默认 15 秒超时，高质量模型默认 45 秒。
   - `wan2.7-image` 使用 `thinking_mode: false`，减少结构化菜品图的不必要推理等待。
   - 新加坡 API key 与北京 `QWEN_API_KEY` 严格隔离。
   - OSS 自定义 CDN host 可通过 `NEXT_PUBLIC_DISH_IMAGE_CDN_HOST` 注入 Next Image 白名单。
5. 配置模板已纳入仓库。
   - `.gitignore` 继续忽略真实 `.env*`，只解除 `.env.example` 的忽略。
6. 按需生图成本与稳定性保护。
   - 请求必须携带有效 `task_id`，服务端只使用任务结果中真实存在的菜品数据。
   - 每客户端、每任务和全局都有生成预算；同一 storage id 的并发请求合并为一次生成。
   - 当前生产 PM2 为单进程 `fork_mode`，内存限流与幂等有效；扩容前需迁移到 Redis。
   - 生产只接受 HTTPS OSS、Supabase Storage 或配置 CDN 的稳定地址；机器本地 URL 只在开发环境返回。
7. 发布候选边界加固。
   - 千问客户端改为首次真实请求时初始化，干净机器无需密钥即可完成生产构建。
   - 合法 OSS/CDN `/generated-dishes/` 地址不会再被误删；生产环境不会把机器本地图片恢复成完成状态。
   - Nginx 覆盖的 `X-Real-IP` 作为客户端预算身份，转发链只取可信代理追加端，并定期清理过期限流桶。
   - 浏览器缓存只作命中提示；重复上传必须经服务端缓存取得新的 `task_id`，避免 PM2 重启或任务过期后按需生图 404。

## 路由与缓存顺序

```text
本地知识图 / 人工审核图
  -> 本机运行时缓存
  -> 阿里 OSS 确定性对象
  -> Supabase 兼容缓存
  -> 分类路由 AI 生图
  -> WebP 优化
  -> 阿里 OSS 持久化
  -> 返回稳定 URL
```

AI 分类路由：

```text
普通菜：z-image-turbo -> 可重试错误时 wan2.7-image
饮品/汤/海鲜/套餐：wan2.7-image -> 可重试错误时 z-image-turbo
```

## 生产配置

```bash
IMAGE_PROVIDER=wan
ALIBABA_MODEL_STUDIO_WORKSPACE_ID=<新加坡 workspace id>
ALIBABA_MODEL_STUDIO_API_KEY=<同区域 API key>
ALIBABA_IMAGE_FAST_MODEL=z-image-turbo
ALIBABA_IMAGE_FALLBACK_MODEL=wan2.7-image
ALIBABA_IMAGE_QUALITY_KINDS=drink,soup,seafood,meal
ALIBABA_IMAGE_REQUEST_INTERVAL_MS=550
ALIBABA_IMAGE_FAST_TIMEOUT_MS=15000
ALIBABA_IMAGE_QUALITY_TIMEOUT_MS=45000
```

可选：

```bash
NEXT_PUBLIC_DISH_IMAGE_CDN_HOST=<OSS 自定义 CDN hostname>
```

注意：Workspace endpoint 和 API key 必须同属新加坡区域。未配置 `ALIBABA_MODEL_STUDIO_WORKSPACE_ID` 或显式 base URL 时，代码继续使用旧 `wanx2.1` 异步链路，便于灰度和回滚。

## 实测结果

使用当前中国节点凭证进行直连基线测试：

| 菜品 | 模型 | 生成耗时 | 下载耗时 | 目检 |
|---|---|---:|---:|---|
| Pizza Margherita | `z-image-turbo` | 4.014s | 0.628s | 菜品形态、番茄、奶酪与罗勒正确 |
| Lobster Bisque | `wan2.7-image` | 16.099s | 0.903s | 汤体、龙虾元素与餐厅摆盘正确 |

这组数字证明新同步链路可用，但不是新加坡区域的最终 SLA。新加坡生产 key 尚未配置，必须在目标区域再次 benchmark。

## 验证结果

- `node --test tests/logic-regressions.test.mjs`：176/176 通过。
- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- 从 Git 索引导出到无 `.env.local` 的全新目录后，`npm ci`、176 项回归、lint 和 Next.js 16.3.0 生产构建全部通过。
- `npm audit --omit=dev`：0 个漏洞。
- `git diff --check`：通过。
- `node scripts/diagnose-dish-images.mjs --summary --fail-on-deploy-risk`：通过。
  - 稳定本地覆盖率 97.6%。
  - 本地图片缺失 0。
  - 被引用但未纳入 Git 的图片 0。

## 生产预检

- 公网 Google DNS 与 Cloudflare DNS 均返回 `35.255.147.40`，当前主入口是 Google Cloud，而非阿里云备用机。
- 主站代码目录：`/opt/dishlens-global`；分支 `main`；基线 `61c0edd`；工作区干净。
- PM2：`dishlens`，单进程 `fork`，在线；Nginx 反代到 `127.0.0.1:3000` 并覆盖 `X-Real-IP`。
- 当前生产已具备 `QWEN_API_KEY`、`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，因此可按旧 Wan + Supabase 兼容链路部署。
- 当前生产尚缺新加坡 Model Studio、阿里 OSS、图片 CDN 和 Upstash Redis 配置；不影响单进程兼容模式，但不能宣称新海外目标架构已启用。

## 尚未完成

1. 尚未创建或注入新加坡 Model Studio Workspace ID/API key，因此新链路还不能在目标海外区域正式启用。
2. 尚未推送和发布到线上；当前文档记录的是已验证的本地发布候选。
3. 尚未在新加坡 ECS + OSS 上运行 20 道菜冷启动、困难品类准确率和重复缓存命中 benchmark。
4. `npm test` 仍未在 `package.json` 中定义；当前完整命令是 `node --test tests/logic-regressions.test.mjs`。

## 下一步

1. 在阿里云新加坡区域创建 Model Studio Workspace/API key，并确认与 endpoint 同区域。
2. 配置新加坡 OSS bucket、CORS、自定义域名/CDN 和上述环境变量。
3. 先灰度 10% 请求，监控各模型成功率、P50/P95、回退率、持久化成功率和缓存命中率。
4. 用 20 道普通菜和 20 道困难品类验收；达到目标后全量切换。
5. 发布后重复上传同一菜单，确认第二次不产生模型调用且稳定 URL 跨重启可访问。

## 官方参考

- [Z-Image API](https://www.alibabacloud.com/help/en/model-studio/z-image-api-reference)
- [Wan 2.7 Image API](https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference)
- [Model Studio image models](https://www.alibabacloud.com/help/en/model-studio/image-model)
