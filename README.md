# Structured Thinking Gym

Structured Thinking Gym (STG) 是一个面向求职者、转岗者和初入职场人群的结构化面试表达训练 App。它把一次回答变成可解释、可修订、可复评的训练闭环：

```text
题目 → 原始回答 → AI 反馈 → 接受 / 拒绝 / 编辑 → 最终回答 → 重新评分
```

项目目标是交付一个可公开试用的文本型 Beta，并用真实、可复核的工程和产品证据形成 AI 产品案例。STG 不把系统分数变化描述为已经验证的学习效果。

## 当前状态

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| 确定性公开 Demo | Done | `/training-demo` 使用内存 Adapter，不调用 OpenAI、Supabase 或 App API。 |
| AI Coach | Done（同步模式） | Analysis → Coaching、严格 JSON Schema、Zod 校验、一次 Repair、事实保护和运行元数据。 |
| Human-in-the-loop | Done | 接受、拒绝、编辑、最终稿与前后评分均使用共享 Session DTO。 |
| 真实训练入口 | Done in code | `/workspace` 提交后进入 `/training/[attemptId]`；部署后仍需真实 Supabase/OpenAI smoke test。 |
| 七天课程与概览 | Partial | 版本化课程、Dashboard、History 和用户 Profile 已实现；迁移及跨设备验证待完成。 |
| 异步 AI | Done in code | `202` 提交、Job/Lease、Background Analysis/Coaching/Repair、签名 Webhook、Reconciler 与 Cron 已接线；真实 OpenAI Staging 验证待完成。 |
| 账户与数据 | Done in code | Settings、JSON 导出、训练数据删除和永久账户删除已实现；导出覆盖事件、配额及脱敏 AI Job，真实 Supabase 级联删除待 Staging 验证。 |
| Beta 发布 | Release candidate | GitHub Actions、Vercel Preview 和 GitHub Pages 静态入口已具备；真实 Supabase/OpenAI Staging 与 5–20 人 Pilot 尚未执行。 |

Judge 不在生产推理链路中。现有 Judge 相关资源只用于离线评测；线上质量门由 Schema、Rubric、跨字段检查和事实保护组成。

## 产品差异

- 反馈包含评分依据、原文证据和单一优先改进方向，而不只给黑盒总分。
- 用户对 AI 建议的接受、拒绝或编辑是一等数据，AI 不替用户决定最终表达。
- 前后评分固定在同一 Session、Rubric、Prompt 与模型版本语境下。
- Demo 和 Live 通过同一 `TrainingSessionGateway`、Controller、DTO 与 Screen，降低演示和产品逻辑漂移。
- 七天内容聚焦 Conclusion First、Categorization、STAR、Evidence、Conflict、Stakeholder 和 Final Pitch。

## 本地运行

要求 Node.js 22 和 npm 10；仓库使用 npm workspaces。

```bash
npm ci
npm run dev
```

打开：

- 首页：`http://localhost:3000`
- 公开 Demo：`http://localhost:3000/training-demo`
- 免费线上 Demo：<https://leeli911.github.io/STG_APP/training-demo/>

本地默认使用 Mock AI。需要开发账号时，在 `apps/web/.env.local` 中显式设置 `STG_ENABLE_DEV_AUTH=true`；该开关在生产环境中始终失效。
完整 Revision/Delta 主流程由服务端 `LIVE_TRAINING_V2` 控制；本地示例为 `true`，Production 在 Staging Gate 通过前必须保持 `false`。

## 验证命令

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e:install
npm run test:e2e
```

Playwright 使用 Mock AI 和本地开发认证，覆盖首页到 Demo 完整修订、Demo 无外部 API、登录/Onboarding 和受保护路由跳转。浏览器产物写入 `output/playwright/`，不会提交到 Git。

当前本地验收基线：27 个 Vitest 文件、230 项单元/组件测试；公开 Demo 的 Desktop Chrome 与 Pixel 7 Playwright 用例通过，生产构建通过。

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
