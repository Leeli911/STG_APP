# STG Beta Roadmap

状态口径：`Done` 表示代码和本地验证已具备；`Partial` 表示已有实现但缺少生产接线或真实环境验收；`Planned` 表示尚未实施。路线图不得用计划替代已交付事实。

## M0 · 项目真相、生产安全与 CI

Status: **Done in code，待完整 CI 首跑**

- 开发认证必须同时满足非生产环境和 `STG_ENABLE_DEV_AUTH=true`。
- 普通用户导航隐藏 Admin；服务端 Admin 需要显式角色判断。
- AI 权威表的浏览器写策略由迁移撤销，服务端写入通过 Service Role 或受控 RPC。
- ESLint、Typecheck、Vitest、Build、Secret Scan、Dependency Review、CodeQL 和 Playwright 已进入 GitHub Actions。
- Node/npm 版本已固定，安全响应头由 Next 配置统一管理。

Exit gate:

- `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e` 全部通过。
- Production 环境无法使用开发 Cookie 或开发 Admin Flag。
- Supabase 迁移在临时项目上通过 RLS/RPC 验证。

## M1 · 可靠的 AI 处理状态

Status: **Done in code，待真实 OpenAI Staging 验证**

已实现：

- Responses API 严格 JSON Schema、Zod/跨字段校验、一次 Repair 和事实保护。
- Processing Attempt DTO，不再把“处理中”当作不存在。
- `ai_jobs`、Stage/Status 状态机、唯一 Active Job、Lease、Token/延迟字段。
- Background Response Provider、签名 Webhook Service 和 Reconcile Service。
- 原子完成 Attempt 的 RPC 基础与每天 Session 配额基础。
- Attempt 主提交可按 `STG_AI_EXECUTION_MODE` 选择同步或 Background；Background 快速返回 `202`。
- `/api/webhooks/openai` 验证 OpenAI 签名并推进 Job。
- `/api/internal/ai/reconcile` 同时支持 Vercel Cron GET 和手工 POST，以 Timing-safe Bearer 校验保护。
- Vercel Cron 每 5 分钟处理停滞 Job；Background 未启用时安全返回 `skipped`。
- Background Rescore 只运行 Analysis，并通过原子完成路径更新 Session。

Remaining validation:

- 在 Staging 注册真实 OpenAI Webhook。
- 验证 Webhook 重放、遗漏、乱序、停滞 Job 恢复和 Provider 故障。
- 校准配额、Token/成本字段、告警和端到端延迟。

Exit gate:

- 重复 Submit 只创建一个 Attempt/Job 且只收费一次。
- 停滞或遗漏 Webhook 的 Job 能由 Reconciler 恢复。
- 生产 AI 失败率低于 2%，端到端 P95 低于 60 秒；这些数字只能在 Pilot 后填写。

## M2 · 真实 Human-in-the-loop 主流程

Status: **Done in code，待 Live smoke test**

- `/workspace` 提交后进入 `/training/[attemptId]` 并显示处理状态。
- AI 完成后通过 LiveAdapter、Controller 和共享 Screen 创建/读取 Session。
- 用户可接受、拒绝或编辑建议，并看到初始分、最终分、总 Delta 和维度变化。
- Revision 使用 Idempotency Key；不确定网络结果通过读取 Session 恢复。
- `/result/[attemptId]` 作为只读兼容入口保留。
- `/training-demo` 使用内存 Adapter 演示同一闭环，且不会请求 App API、OpenAI 或 Supabase。

Exit gate:

- 在 Staging 上以真实 Auth、数据库和低预算 OpenAI 完成三种 Revision 路径。
- 刷新、双击、超时和重试都不会提交第二个不同决策。

## M3 · 七天课程、进度与历史

Status: **Partial**

- `stg-7day-v1`、Curriculum/Curriculum Item 和 Profile 数据结构已加入迁移。
- Dashboard/History 已从占位页升级为 Overview 驱动界面。
- 进度根据完成的 Session 推导，而不是把固定 Day 1 当作权威状态。
- History 支持回看原稿、最终稿、决策与前后分数。

Remaining:

- 在真实数据库应用并验证迁移及七天回填。
- 验证 Day 1–7 顺序解锁、跨设备一致性、Day 7 完成态和旧数据兼容。
- 增加七天总结页；只报告观察到的趋势，不宣称因果能力提升。

## M4 · Beta 用户体验、隐私与可观测性

Status: **Partial**

- 中文首页、注册、登录、找回/重设密码、Onboarding 和主要加载/失败状态已实现。
- Profile 包含目标岗位、面试类型、训练目标、反馈语言和匿名 Eval 选择。
- Product Event、Usage Counter 和反馈查看时间已有数据基础。
- Settings、训练数据 JSON 导出、训练数据删除和永久 Auth Account 删除已实现。

Remaining:

- 完成账户导出/删除、级联关系和 12 个月原始回答保留策略的真实 Staging 验证。
- 接入结构化日志/OpenTelemetry，确认完整回答和凭据永不进入日志或事件。
- 完成移动端、键盘、焦点和颜色对比验收。
- 内部反馈模式保持 Feature Flag，不在样本不足时对外称 A/B 实验。

## M5 · 部署、Pilot 与履历案例

Status: **Planned / release tooling ready**

- `vercel.json`、受保护 Reconcile Cron、环境清单、迁移/回滚手册、Beta Checklist 和 Playwright 已加入仓库。
- Preview 使用 Mock AI；Staging 使用隔离 Supabase/OpenAI；Production 禁用所有开发后门。
- 生产默认每人每天最多 3 次 AI Session；全局 US$5/日预算需要在 Provider/Vercel 层补齐硬限制和告警。
- `LIVE_TRAINING_V2` 已实现为服务端 fail-closed 开关；Production 在 Staging Gate 前保持 `false`，旧 Result 保留一个发布周期用于回退。

Pilot exit gate:

- 5–20 名试用用户、至少 20 个完整 Session、至少 5 份结构化反馈。
- 形成有来源的漏斗、延迟、错误和成本数据。
- 发布公开 Demo、系统图、Eval 报告、关键 PR 和案例复盘。
- 履历只采用 [Resume Evidence Ledger](RESUME_EVIDENCE_LEDGER.md) 中已验证的表述。

## Later / Out of Beta

- 语音面试
- 简历与 JD 解析
- 支付与团队账号
- 教练市场或公开社区
- AI 动态生成课程
- 复杂自适应掌握度算法
