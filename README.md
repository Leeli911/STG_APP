# Structured Thinking Gym

Structured Thinking Gym (STG) 是一个面向中文职场用户的结构化表达训练 App。v0.4 聚焦临时汇报与工作短答，把“读过方法”变成可观察、可复现的主动练习：

```text
无提示回答 → 核心结论自检 → 单点证据反馈 → 亲自重写
→ 未见题迁移 → 24 小时间隔冷测
```

核心定位是：**不是帮用户把这一次写得更好，而是训练用户下一次自己说清楚。** 免费公开训练使用浏览器内确定性规则，不调用付费模型。现有 AI 面试训练后端继续保留为实验能力，不作为 v0.4 用户价值成立的前提。

## 当前状态

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| v0.4 公开训练 | Done locally | `/training-demo` 覆盖冷答、自检、单点反馈、主动重写、迁移和 24 小时间隔冷测；待发布。 |
| 三个微技能与 18 个场景 | Done | 明确目的、结论先行、两到三点框架；覆盖冷题、近迁移、远迁移和延迟题。 |
| 可信规则验收 | Done | 四种状态、场景目标锚点、原文位置证据、抗投机规则及 180 个冻结回归样本。 |
| 免费离线 Eval | Done | `npm run eval:structured` 当前 Macro-F1 1.000、严重假通过 0/45、证据溯源 100%；只代表当前回归集。 |
| 合成用户审计 | Done | 6 个行为角色、3 种训练机制、54 条严格配对轨迹；不是 Pilot 或真人学习效果证明。 |
| 本地进度与恢复 | Done | 刷新恢复未完成答案，区分完成/达标，并在 24 小时后安排未见冷测。 |
| AI Coach | Done（同步模式） | Analysis → Coaching、严格 JSON Schema、Zod 校验、一次 Repair、事实保护和运行元数据。 |
| Human-in-the-loop | Done | 接受、拒绝、编辑、最终稿与前后评分均使用共享 Session DTO。 |
| 真实训练入口 | Done in code | `/workspace` 提交后进入 `/training/[attemptId]`；部署后仍需真实 Supabase/OpenAI smoke test。 |
| 七天课程与概览 | Partial | 版本化课程、Dashboard、History 和用户 Profile 已实现；迁移及跨设备验证待完成。 |
| 异步 AI | Done in code | `202` 提交、Job/Lease、Background Analysis/Coaching/Repair、签名 Webhook、Reconciler 与 Cron 已接线；真实 OpenAI Staging 验证待完成。 |
| 账户与数据 | Done in code | Settings、JSON 导出、训练数据删除和永久账户删除已实现；导出覆盖事件、配额及脱敏 AI Job，真实 Supabase 级联删除待 Staging 验证。 |
| Beta 发布 | v0.4 release candidate | GitHub Actions、Vercel Preview 和 GitHub Pages 静态入口已具备；v0.4 待推送发布，真实用户 Pilot 尚未执行。 |

Judge 不在生产推理链路中。现有 Judge 相关资源只用于离线评测；线上质量门由 Schema、Rubric、跨字段检查和事实保护组成。

## 产品差异

- 作答前不展示方法，先保留真实的冷回答基线。
- 每次只训练一个可观察动作，反馈引用用户原文，不给黑盒能力高分。
- 不提供一键采用，必须亲自重写，避免把 AI 的表达误认为自己的能力。
- 用一个未见过的新工作情境做迁移检查，而不只比较同一答案的前后分数。
- 用 24 小时后的未见题区分即时表现与间隔保持，不把完成流程叫作能力提升。
- 场景目标而不是用户自填结论决定规则状态；关键词、重复分点和元评分话术不能自证通过。
- 中文职场短汇报、五分钟、零模型成本；用户不需要自行编写复杂教练提示词。

完整范围、证据和限制见 [v0.4 可信评测计划](docs/V04_TRUSTWORTHY_EVAL_PLAN.md)、[产品有用性评估](docs/V04_PRODUCT_UTILITY_ASSESSMENT.md) 与 [产品决策日志](docs/PRODUCT_DECISION_LOG.md)。

## 本地运行

要求 Node.js 22 和 npm 10；仓库使用 npm workspaces。

```bash
npm ci
npm run dev
```

打开：

- 首页：`http://localhost:3000`
- 公开 Demo：`http://localhost:3000/training-demo`
- 免费线上 Demo（当前已发布版本）：<https://leeli911.github.io/STG_APP/training-demo/>

本地默认使用 Mock AI。需要开发账号时，在 `apps/web/.env.local` 中显式设置 `STG_ENABLE_DEV_AUTH=true`；该开关在生产环境中始终失效。
完整 Revision/Delta 主流程由服务端 `LIVE_TRAINING_V2` 控制；本地示例为 `true`，Production 在 Staging Gate 通过前必须保持 `false`。

## 验证命令

```bash
npm run lint
npm run typecheck
npm test
npm run eval:structured
npm run audit:synthetic
npm run build
npm run test:e2e:install
npm run test:e2e
```

Playwright 使用 Mock AI 和本地开发认证，覆盖首页到 Demo 完整修订、Demo 无外部 API、登录/Onboarding 和受保护路由跳转。浏览器产物写入 `output/playwright/`，不会提交到 Git。

当前 v0.4 本地验收基线：31 个 Vitest 文件、442 项单元/组件测试，以及 Desktop Chrome 与移动端 Chromium 共 14 项 Playwright 流程全部通过；静态 Demo 与 Next.js 生产构建通过。规则评测和合成审计报告分别见 [V04_RULE_EVAL](docs/evals/V04_RULE_EVAL.md) 与 [V04_SYNTHETIC_USER_AUDIT](docs/evals/V04_SYNTHETIC_USER_AUDIT.md)。

本机已有 Google Chrome 时可用 `PLAYWRIGHT_USE_SYSTEM_CHROME=1 npm run test:e2e` 跳过浏览器下载；CI 始终安装并使用固定 Playwright Chromium。

## 架构

```text
Presentation → Controller → Gateway → API → Service → Repository → Persistence

DemoAdapter ──┐
              ├── TrainingSessionGateway → TrainingSessionController → TrainingSessionScreen
LiveAdapter ──┘
```

AI 主链路当前为：

```text
Attempt → Analysis → Coaching → Structured validation
        → Repair（仅校验失败时）→ Fact / quality gates
        → Atomic persistence → Training Session
```

Live AI 可在 `sync` 与 `background` 间切换。Background 模式会快速返回处理中 Attempt，通过签名 Webhook 推进 Analysis/Coaching/Repair，并由受 Cron Secret 保护的 Reconciler 恢复遗漏事件。该链路已完成代码和自动化测试，但在真实 OpenAI Staging 验证前不能描述为“生产运行中”。

## 仓库结构

```text
apps/web/src/app/             Next.js 页面与 API
apps/demo/                    复用 DemoAdapter/Controller/Screen 的 GitHub Pages 静态入口
apps/web/src/features/        Controller、Gateway、Adapter 与 feature hooks
apps/web/src/server/          AI、Attempt、Session、Profile 与 Overview 服务
apps/web/src/database/        Supabase schema 与 migrations
apps/web/src/tests/           Vitest / Testing Library
e2e/                          Playwright 浏览器测试
docs/                         产品、架构、部署、发布和履历证据文档
```

## 部署与发布

- [Deployment Runbook](docs/DEPLOYMENT.md)
- [Beta Release Checklist](docs/BETA_RELEASE_CHECKLIST.md)
- [Resume Evidence Ledger](docs/RESUME_EVIDENCE_LEDGER.md)
- [Product Overview](docs/PRODUCT_OVERVIEW.md)
- [Roadmap](docs/ROADMAP.md)
- [AI Coach Architecture](docs/AI_COACH_ARCHITECTURE.md)
- [Public Demo Guide](docs/public/demo-guide.md)
- [v0.4 Rule Eval](docs/evals/V04_RULE_EVAL.md)
- [v0.4 Synthetic User Audit](docs/evals/V04_SYNTHETIC_USER_AUDIT.md)

免费公开 Demo 不配置 Cron，也不设置 OpenAI Key。只有隔离 Staging 启用 Live Background AI 时，才由 Vercel 或外部调度器使用 `CRON_SECRET` 调用 `/api/internal/ai/reconcile`；非 Live/Background 模式下 Endpoint 返回安全的 `skipped` 结果。

## 安全边界

- 永不提交 `.env.local`、OpenAI Key、Supabase Service Role Key 或 Webhook Secret。
- 生产必须使用真实 Supabase Auth，且 `STG_ENABLE_DEV_AUTH=false`、`STG_ENABLE_DEV_ADMIN=false`。
- 浏览器不应直接写入 AI 权威表；相关写入由服务端或受控 RPC 完成。
- Funnel Event 只能由已认证业务 API 通过 Service Role 记录；不存在通用浏览器事件写入口，业务重试由唯一事件身份去重。
- 日志、产品事件和 Eval 数据不得包含完整回答、凭据或可直接识别用户的信息。

## 可安全陈述的项目证据

目前可陈述：已构建 Next.js/TypeScript/Supabase 训练原型、两阶段 AI Coach、结构化校验与 Repair、Human-in-the-loop 修订、分层 Demo/Live 架构、原子修订和自动化测试。

真实使用人数、完成率、留存率、AI 失败率、延迟、成本和用户效果，只能在 Beta 部署并收集数据后写入履历。详见 [Resume Evidence Ledger](docs/RESUME_EVIDENCE_LEDGER.md)。
