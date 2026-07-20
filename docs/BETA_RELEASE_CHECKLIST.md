# Beta Release Checklist

每个 Preview、Staging 和 Production 发布复制一份本清单到 Release/PR，并附可点击证据。未经验证的项目保持未勾选。

## Release identity

- [ ] Release 名称、Commit SHA、Owner 和时间窗口已记录。
- [ ] 变更范围、数据库 Migration 和回滚目标已列出。
- [ ] 没有未解释的本地修改、密钥或测试产物。

## Automated gates

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Dependency Review、Secret Scan 和 CodeQL 通过。

## Security and privacy

- [ ] Production 的 `STG_ENABLE_DEV_AUTH` 与 `STG_ENABLE_DEV_ADMIN` 均为 `false`。
- [ ] 未登录访问 Dashboard/Workspace/Training/History/Admin 会跳转登录。
- [ ] 普通用户不能访问 Admin 或读写他人数据。
- [ ] 浏览器不能直接写 Attempts、Scores、AI Feedback、Growth、AI Jobs 或 Events。
- [ ] 通用 `/api/events` 不存在；`record_product_event` 只授予 Service Role，重复业务动作不会重复计入 Funnel。
- [ ] 日志、事件和错误中没有完整回答、凭据、API Key 或 Service Role Key。
- [ ] 用户导出包含自身 Events、Usage 和安全 AI Job 字段，且不含 Provider Payload/Response ID、Lease、Idempotency Keys 或错误正文。
- [ ] 账户导出/删除和数据保留行为已在 Staging 验证；若未完成，Production Beta 不开放该能力并明确已知限制。

## Database

- [ ] 已建立备份并记录恢复方法。
- [ ] Migration 在 Staging dry-run 和执行成功。
- [ ] `stg-7day-v1` 恰好包含 Day 1–7。
- [ ] RLS、原子 Attempt 完成、Revision 幂等、并发冲突和反馈查看时间通过真实 Postgres 验证。
- [ ] 旧 Attempt/Session/History 仍可读取。

## Product journeys

- [ ] 首页 → Demo 题目 → 草稿 → 反馈 → 接受 → Delta。
- [ ] Demo 的拒绝和编辑路径各手工验证一次。
- [ ] Demo 无 `/api`、OpenAI、Supabase、localStorage 或 sessionStorage 依赖。
- [ ] 注册、登录、找回密码、重设密码和 Onboarding 可用。
- [ ] Live Workspace → Training → Revision → Rescore 完成。
- [ ] 重复点击、刷新和网络超时不会产生第二个不同 Revision。
- [ ] Dashboard、History、Day 解锁和 Day 7 完成态符合数据事实。
- [ ] 中文 UI、中文/英文回答、移动端、键盘和焦点路径已检查。

## AI quality and cost

- [ ] Production Model、Prompt 和 Rubric 版本已固定并与 Staging 一致。
- [ ] 黄金集通过；Schema 最终成功率 100%，严重事实虚构为 0。
- [ ] Live smoke test 使用专门测试回答且支出已确认。
- [ ] 每用户每日配额和全局预算/告警已验证。
- [ ] Judge 未被错误描述为实时生产 Agent。
- [ ] Background Staging Gate 已完成；否则 `STG_AI_EXECUTION_MODE=sync`。
- [ ] `LIVE_TRAINING_V2` 在 Staging 完成新旧双路径验证；Production 初始为 `false`，启用与回退均有记录。
- [ ] OpenAI Webhook 有效签名成功、无效签名被拒绝，重复事件不产生第二个 Job/结果。
- [ ] Vercel Cron 使用 `CRON_SECRET` 成功，错误 Token 返回 403，Sync/Mock 模式安全 `skipped`。

## Operations

- [ ] 5xx、AI Failure、P50/P95、Token、成本和配额可观察。
- [ ] 事件只包含允许的枚举和非 PII Metadata。
- [ ] On-call 联系人、回滚 Deployment 和数据库恢复路径已记录。
- [ ] 30 分钟发布观察窗无阻断问题。

## Resume and public claims

- [ ] README、产品截图和案例页与本次真实能力一致。
- [ ] 使用人数、Session 数、完成率、成本和延迟都附来源与时间窗。
- [ ] “系统评分变化”没有被写成“经验证的能力提升”。
- [ ] 所有表述均通过 [Resume Evidence Ledger](RESUME_EVIDENCE_LEDGER.md) 审核。

## Decision

- [ ] GO：所有阻断项通过，允许扩大 Pilot。
- [ ] NO-GO：记录问题、Owner、修复目标和回滚/重试时间。
