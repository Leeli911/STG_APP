# Deployment Runbook

本手册覆盖 Vercel + Supabase + OpenAI 的 Preview、Staging 和 Production 发布。同步与 Background AI 均已接线；Background 必须先在隔离 Staging 完成真实 Webhook、Cron 和恢复验证，再提升到 Production。

## 1. 环境矩阵

| 配置 | Preview | Staging | Production |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Preview URL 或省略 | Staging URL | 正式 HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_URL` | 可省略或隔离项目 | Staging 项目 | Production 项目 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 对应项目 | 对应项目 | 对应项目 |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅需 Live 数据时 | 必须 | 必须 |
| `LIVE_TRAINING_V2` | `true`（测试新流程） | 内部验证时 `true` | 初始 `false`；Gate 通过后 `true` |
| `STG_AI_MODE` | `mock` | `live`（先 Sync smoke） | `live` |
| `STG_AI_EXECUTION_MODE` | `sync` | `sync` → 验证期 `background` | Staging Gate 通过后 `background`；`sync` 为回退 |
| `OPENAI_API_KEY` | 不配置 | 必须 | 必须 |
| `OPENAI_MODEL` | `gpt-4.1-mini` | 评测通过的固定值 | 与 Staging 验证值一致 |
| `OPENAI_WEBHOOK_SECRET` | 不配置 | Background 时必须 | Background 时必须 |
| `CRON_SECRET` | 可配置隔离值 | 必须 | 必须 |
| `STG_ENABLE_DEV_AUTH` | `false` | `false` | `false` |
| `STG_ENABLE_DEV_ADMIN` | `false` | `false` | `false` |

兼容旧 Supabase 项目时可使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，新部署优先使用 Publishable Key。`NEXT_PUBLIC_APP_URL` 不是当前 Auth 回调的读取变量；使用 `NEXT_PUBLIC_SITE_URL`。

`LIVE_TRAINING_V2` 是服务端 fail-closed 开关。`false` 时 Workspace 提交后进入旧只读 Result；`true` 时进入 `/training/[attemptId]` 完整 Revision/Delta 流程。Owner 为 Beta Release Owner，计划在新流程稳定运行一个发布周期后移除（目标：2026-09-30）。Production 启用或回退都要记录 Deployment 与操作者。

免费公开 Demo 的 `vercel.json` 不配置 Cron，因为 Mock/Sync 模式不需要 Reconciler。启用隔离 Staging 的 Live Background 模式时，再在 Vercel 项目或外部调度器中每 5 分钟 GET `/api/internal/ai/reconcile`；调度请求使用 `CRON_SECRET` Bearer Token。Endpoint 也兼容手工 POST 和旧 `STG_CRON_SECRET`。当 `STG_AI_MODE` 不是 `live` 或执行模式不是 `background` 时，它返回 `200 skipped`。

免费公开 Demo 同时由 GitHub Pages 承载：`npm run build:demo` 使用 Vite 静态打包，但直接导入 Next 主应用的 `DemoAdapter`、`TrainingSessionController`、DTO 与 `TrainingSessionScreen`。`.github/workflows/pages.yml` 在 `main` 更新相关源文件时发布到 `https://leeli911.github.io/STG_APP/training-demo/`。该入口没有登录、Supabase、OpenAI、App API 或 Cron；Vercel 仍用于完整 Next.js Preview/Live 环境。

Feature/operational switch 规则：

| Switch | 默认 | 用途 | 回退 |
| --- | --- | --- | --- |
| `STG_AI_MODE` | Preview `mock`；Live 环境 `live` | 控制确定性 AI 与付费 Provider | 故障时先暂停入口；不要把 Mock 输出混入真实历史。 |
| `STG_AI_EXECUTION_MODE` | `sync` | 控制同步与 Background 状态机 | Background 故障时切回 `sync`，Cron 自动 no-op。 |
| `LIVE_TRAINING_V2` | `false` | 控制旧只读 Result 与 V2 修订主流程 | 出现阻断故障时切回 `false`；旧入口保留一个发布周期。 |
| `STG_ENABLE_DEV_AUTH` | `false` | 本机 E2E/开发认证 | Production 永久失效。 |
| `STG_ENABLE_DEV_ADMIN` | `false` | 本机 Admin 验证 | Production 不得启用。 |

每个新 Feature Flag 必须有 Owner、默认值、启用条件、回退路径、到期日和双路径测试。`LIVE_TRAINING_V2` 已覆盖 V2 与旧 Result 两条路由测试，不得被改成默认开放。

## 2. 发布前验证

在仓库根目录执行：

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e:install
npm run test:e2e
```

再确认：

- `git status --short` 只包含本次发布内容。
- `.env*`、API Key、Service Role Key 和浏览器测试产物没有被跟踪。
- Preview 的 `/training-demo` 完成题目、回答、反馈、Revision 和 Delta，且 Network 中无 `/api`、OpenAI 或 Supabase 请求。
- Production 环境变量没有开发认证/Admin 开关。

## 3. 数据库迁移

所有 Migration 按文件名顺序应用。Production 前先在独立 Staging Supabase 执行：

```bash
supabase db push --dry-run
supabase db push
```

应用前：

1. 记录目标 Project Ref 和当前 Migration Version。
2. 建立数据库备份；Production 确认可执行 Point-in-time Recovery 或已有可下载备份。
3. 导出关键表的行数与约束快照：`questions`、`attempts`、`scores`、`ai_feedback`、`practice_sessions`、`revision_events`。
4. 检查最新 Migration 的回填结果不会产生重复 Day、孤立 Session 或违反外键的数据。

应用后：

1. 确认七条 `stg-7day-v1` Curriculum Item 均存在且顺序为 Day 1–7。
2. 使用真实 authenticated 用户验证只读策略。
3. 验证浏览器身份不能直接 INSERT/UPDATE AI 权威表。
4. 验证 authenticated/anon 无权调用 `record_product_event`，业务 API 的 Service Role 写入携带当前认证用户 ID，重复动作只保留一个 Funnel Event。
5. 使用 Service Role 验证 Attempt 完成、Revision RPC、Feedback viewed 和 Profile upsert。
6. 验证数据导出包含当前用户 Product Events、Usage Counters 和安全 AI Job 字段，但不包含 Provider Request/Output Payload、Provider Response ID、Lease、Idempotency Keys 或错误正文。
7. 验证账户删除/级联策略不会被 `restrict` 意外阻塞。

迁移采用 forward-only 原则。不要在生产直接删除新表、函数或列来“回滚”。如果 Migration 失败：停止 Promotion，恢复备份/分支数据库或发布新的修复 Migration；先回退应用版本，再在确认旧版本与新 Schema 兼容后处理数据库。

## 4. Preview 与 Staging

1. 推送分支并等待 CI 全绿。
2. 创建 Vercel Preview，保持 `STG_AI_MODE=mock`。
3. 执行公开 Demo、登录/Onboarding、受保护路由和移动端 smoke test。
4. 将同一 Commit 部署到 Staging，连接隔离 Supabase。
5. 先以 `STG_AI_MODE=live`、`STG_AI_EXECUTION_MODE=sync` 执行一次受预算控制的 `npm run test:live-smoke -- --confirm-live-spend`。
6. 运行 `npm run verify:live-attempt -- <attempt-id>`，保存脱敏结果。
7. 在 OpenAI 注册 `https://<staging-host>/api/webhooks/openai`，保存 Signing Secret，并设置独立 `CRON_SECRET`。
8. 切换 `STG_AI_EXECUTION_MODE=background`，验证 Submit `202`、Processing `200`、Analysis → Coaching、一次 Repair、自动 Session、Revision Rescore 和 Cron 恢复。
9. 模拟重复 Webhook、无效签名、遗漏事件和停滞 Lease；确认不重复收费、不产生第二个决策。
10. 设置 `LIVE_TRAINING_V2=true` 并重新部署，仅向内部账号开放；验证完整 Revision/Delta 后再申请 Production Promotion。

不得在 Preview 或 CI 中使用 Production Service Role/OpenAI Key。

## 5. Production Promotion

1. 将已通过 Staging 的同一 Commit Promote 到 Production，禁止重新构建不同 Commit。
2. 先验证首页、Demo、登录、静态资源与安全响应头。
3. 在 OpenAI 将正式 Webhook 指向 `/api/webhooks/openai`，验证 Production Signing Secret 与 Staging 隔离。
4. 保持 `LIVE_TRAINING_V2=false` 完成旧 Result smoke；再设置为 `true`、重新部署，并用内部账号完成一条低预算 Live Background 训练：Draft → `202` → Feedback → Revision → Rescore。
5. 检查 Attempt/Job/Session 只创建一次，分数版本一致，日志无完整回答或 Secret。
6. 手工使用正确/错误 Bearer Token 调用 Reconcile，分别确认成功/403；观察定时 Cron 成功记录。
7. 在 30 分钟观察窗内检查 5xx、AI 失败、Webhook、P95、Token 和每日配额。
8. 通过后再邀请 Pilot 用户；首批不超过 5 人，稳定后逐步扩展到 20 人。

## 6. 应用回滚

触发条件包括：认证绕过、数据越权、重复收费、事实保护失效、持续 5xx 或无法完成 Revision。

操作顺序：

1. 暂停 Pilot 邀请和新训练提交；V2 UI/Revision 故障时先设 `LIVE_TRAINING_V2=false` 并重新部署；Background 故障但同步链路健康时切 `STG_AI_EXECUTION_MODE=sync`，Cron 会安全 no-op。
2. 在 Vercel 将流量回退到最近一个已验证 Deployment。
3. 保留失败 Deployment 和日志用于复盘，不删除现场证据。
4. 如果新 Migration 与旧代码兼容，保留 Schema；否则恢复已验证备份或发布 forward-fix Migration。
5. 用同一 Smoke Checklist 验证回滚版本，记录开始/结束时间、影响用户和数据处置。

任何可能删除或覆盖用户数据的数据库操作必须先获得明确审批和可验证备份。

## 7. Background AI Staging Gate

代码已包含签名 Webhook、受保护 Reconcile Route、`202` Attempt、Analysis → Coaching → Repair/Complete、Background Rescore 和 5 分钟 Cron。以下运行证据全部完成后才可把 Production 设置为 `background`：

- OpenAI Staging Webhook 签名成功，无效签名返回 400。
- 重复、遗漏、乱序、超时和失败事件不会重复调用或破坏状态。
- Reconciler 通过 Provider Response ID 恢复停滞任务，并拒绝错误 Bearer Token。
- 并发重复 Submit 只产生一个 Active Stage Job。
- Background Initial 与 Rescore 的原子写入通过真实 Postgres 验证。
- P95、失败率、Token、成本和每日配额有可用监控与告警。
- Sync 路径保持至少一个发布周期的回退能力。

## 8. 发布证据

每次 Beta 发布保存：Commit SHA、CI URL、GitHub Pages/Vercel Deployment URL、Migration Version、环境检查人、Smoke 结果、已知问题、回滚目标和脱敏指标截图。履历数字只能从这些记录或产品事件中提取。
