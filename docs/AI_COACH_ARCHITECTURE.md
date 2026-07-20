# AI Coach Architecture

本文记录 STG AI Coach 的真实运行边界。同步和 Background 主链路均已接线；Background 仍需真实 OpenAI Staging 验证，Judge 只属于离线评测。

## 当前生产候选链路

```text
Attempt saved
→ Analysis Engine
→ Analysis JSON Schema + Zod + cross-field validation
→ Coaching Engine
→ Coaching JSON Schema + Zod + cross-field validation
→ Repair（仅结构化校验失败时，最多一次）
→ Fact / output quality gates
→ Atomic score + feedback + metadata persistence
→ Training Session
→ Human accept / reject / edit
→ Final answer re-score
```

Attempt Service 根据 `STG_AI_EXECUTION_MODE` 选择执行方式：`sync` 等待管线完成；`background` 原子认领 Job、启动 Provider Background Response 并以 `202` 快速返回。前端读取 Processing Attempt 并在 `/training/[attemptId]` 轮询，完成后自动进入共享 Training Session。

## 已实现能力

### Analysis Engine

- 输入题目、训练目标、评分重点、原始回答和可选 Profile 上下文。
- 输出五维分数、可观察特征、原文证据、问题与优先改进方向。
- 保存 Prompt、Rubric、模型、延迟和 Provider Response 元数据。

### Coaching Engine

- 将 Analysis 转换为可执行反馈、建议稿、Why Better 和下一步练习。
- 建议必须基于原回答，不得新造经历、公司、工具、数字或结果。
- 中文/英文反馈由回答语言与 Profile 偏好决定。

### Repair Engine

- 只在结构化解析或 Schema/质量校验失败时调用；每个阶段最多一次。
- 目标是恢复合法结构，而不是重新定义评分或创作另一套答案。
- 修复后仍需通过本地 Schema、跨字段和事实检查。

### Deterministic Quality Gate

线上质量门由以下确定性检查组成：

- OpenAI Structured Outputs JSON Schema
- 本地 Zod 解析
- 分数范围和总分一致性
- 必填证据与字段关系
- 数字及受保护实体的事实一致性
- 禁止短语和安全标记

仓库中可能存在 Judge Prompt/Schema，但 Judge **没有进入实时推理链路**。它只可作为离线 Eval 工具；不能在产品或履历中宣称“多 Agent Judge 已上线”。

## 结构化输出

OpenAI Client 使用 Responses API 的严格 `json_schema`：

```ts
text: {
  format: {
    type: "json_schema",
    name: output.name,
    schema: output.schema,
    strict: true
  }
}
```

Provider 的 Schema 约束不能替代本地校验。拒绝、Incomplete、超时、无输出和语义不一致仍需在应用层显式处理。

## Demo 与 Live 边界

```text
DemoAdapter ───────┐
                   ├─ TrainingSessionGateway → Controller → Shared Screen
LiveAdapter ───────┘
```

- Demo 使用固定题目、固定反馈和内存状态；全程不调用 App API、OpenAI、Supabase 或浏览器存储。
- Live 使用认证 API、Attempt/Session Service 和 Supabase。
- 两种模式共享 DTO、校验语义和呈现组件，但 Demo 分数不是模型运行结果。

## Human-in-the-loop 与重新评分

- `accepted`：最终稿等于 AI 建议稿，进入重新评分。
- `edited`：最终稿等于用户编辑稿，进入重新评分。
- `rejected`：最终稿等于原稿，沿用原评分并返回 Delta 0，不产生无意义的 AI 调用。
- Revision 是不可变事件；重试复用同一个 Idempotency Key。
- Delta 由不可变的 Score Before/After 推导，不作为独立权威数据。
- UI 明确说明系统分数变化不代表经验证的能力提升。

## 异步 AI 链路

以下已存在于代码、路由和迁移中：

- `ai_jobs`：Attempt、Stage、Status、Provider Response、版本、Retry、Lease、Token、成本/延迟和错误字段。
- 每个 Attempt/Stage 只能有一个 Active Job。
- Background Response 的创建与 Retrieve Adapter。
- OpenAI Webhook 签名解析 Service。
- Reconcile Service：认领停滞 Job、读取 Provider 状态并分发完成/失败结果。
- 完成 Attempt 的事务/RPC 基础。
- Attempt API 在 Background 模式返回 `202`，重复 Idempotency Key 读取同一进行中 Attempt。
- `/api/webhooks/openai` 验证签名后处理 Completed/Failed/Cancelled/Incomplete 事件。
- `/api/internal/ai/reconcile` 使用 Timing-safe Bearer 校验，支持 Vercel Cron GET 和手工 POST。
- `vercel.json` 每 5 分钟触发 Reconcile；未启用 Background 时返回 `skipped`，不会产生 500 噪声。
- Background Result Handler 完成 Analysis → Coaching → Repair/Complete；Rescore 只运行 Analysis。

代码完成不等于生产验证。Staging 仍需验证真实签名、事件重放/乱序/遗漏、停滞恢复、配额、成本和 Provider 故障；在此之前保持 `sync` 为 Production 回退路径。

## 状态模型

面向用户的 Attempt 状态目标为：

```text
submitted / queued
→ analyzing / analysis_running
→ coaching / coaching_running
→ feedback_ready
→ rescoring
→ completed | failed
```

当前旧表和新基础设施仍存在少量兼容状态。提交处理中返回 `202`，读取处理中返回 `200` 和 `retryAfterMs`，而不是用 `404` 表示尚未完成。

Provider/Job 状态不会直接暴露给用户。Provider ID、Lease Token、原始错误和内部 Prompt 只保留在服务端。

## 模型选择

候选模型配置：

- Baseline：`gpt-4.1-mini`
- Cost candidate：`gpt-5.6-luna`
- Quality challenger：`gpt-5.6-terra`

模型名称只是候选，不代表已上线。切换条件：

1. 通过中英文黄金集；
2. 严重事实虚构为 0；
3. 维度评分与人工中位数偏差不超过一个 Rubric 档位；
4. Schema 最终成功率 100%；
5. 延迟和单 Session 成本满足 Beta 预算；
6. 同一 Session 固定 Model、Prompt 和 Rubric 版本。

## Eval 与可观测性

Golden Set V2 已包含 60 个中英文标注案例，覆盖空泛回答、虚构数字、偏题、STAR 缺失和混合语言。CI 使用固定 Mock/Fixture；付费 Live Smoke 必须显式 `STG_AI_MODE=live` 并受预算控制。60 条 Fixture 的存在不代表候选模型已经通过付费 Live Eval。

每次 AI 调用应记录：

- Attempt/Job/Request correlation ID
- Model、Prompt、Rubric 版本
- Stage、重试和 Repair 次数
- Input/Output/Total Token
- Provider Response ID
- Stage 及端到端延迟
- 归一化错误码

日志不得包含完整原始回答、完整建议稿、API Key、Service Role Key、Webhook Secret 或内部 Prompt 正文。

## 失败与恢复

- Schema 失败：最多一次 Repair，仍失败则安全终止。
- Fact Gate 失败：不展示不可信建议，记录规范化错误。
- HTTP 不确定结果：读取 Attempt/Session 决定是否需要重试。
- 重复提交：Idempotency Key 返回同一资源。
- Partial Persistence：必须通过原子 RPC 避免 Score 与 Feedback 分裂。
- Background 停滞：由 Reconciler 按 Lease 恢复并 Retrieve 原 Provider Response，不直接重新发起第二次付费调用。

## Secret 与发布约束

- Preview 默认 `STG_AI_MODE=mock`、`STG_AI_EXECUTION_MODE=sync`。
- Staging 先验证 Live Sync，再配置 `OPENAI_WEBHOOK_SECRET`、`CRON_SECRET` 并选择 `background`。
- Production 的 Live AI 需要 `OPENAI_API_KEY`、固定模型、Webhook Secret 和 Cron Secret；Background 只在 Staging Gate 通过后启用。
- 不提交任何真实环境文件或密钥。
- 生产切换 AI 配置前必须执行 [Beta Release Checklist](BETA_RELEASE_CHECKLIST.md) 和 [Deployment Runbook](DEPLOYMENT.md)。
