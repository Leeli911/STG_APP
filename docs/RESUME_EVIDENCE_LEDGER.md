# Resume Evidence Claim Ledger

本 Ledger 防止把规划、代码存在、部署上线和真实用户结果混为一谈。每条履历表述必须有可复核证据，并注明时间范围。

## 当前可使用

| 可用表述 | 证据 | 限定语 |
| --- | --- | --- |
| 构建 Next.js、React、TypeScript、Supabase 的结构化面试训练原型 | 仓库代码、构建和架构文档 | 使用“原型/Beta 代码”，不要称商业化产品。 |
| 实现 Analysis → Coaching 两阶段 AI Coach | Pipeline、Prompt Manifest、Schema 和测试 | Judge 不在生产链路。 |
| 实现严格结构化输出、Zod 校验、一次 Repair 和事实保护 | OpenAI Client、Schemas、Golden Tests | 事实保护有明确范围，不声称消除全部幻觉。 |
| 设计并实现接受、拒绝、编辑与重新评分闭环 | Session DTO、Controller、Adapters、Revision RPC、Demo | Live 云环境仍需 Smoke Test。 |
| 使用 Gateway/Adapter/Controller/Service/Repository 分层共享 Demo 与 Live UI | 架构代码与 Contract Tests | 不宣称参考项目代码复用。 |
| 实现 Revision 幂等、唯一决策和并发保护 | Migration、RPC、Service Tests | 真实 Postgres 并发验证完成后再升级为“生产验证”。 |
| 建立自动化回归基线 | 225 项 Vitest + 6 项双视口 Playwright，本地全绿 | 仅陈述对应 Commit 的实际 CI/本地记录；后续数量变化需重新验证。 |
| 建立七天单技能课程与五维 Rubric | Seed/Migration、内容文档、UI | 不声称课程已证明有效。 |
| 建立自动化质量体系 | Vitest、Playwright、CI、Build 输出 | 测试数必须从当次 CI 获取，不能长期写死。 |

## 代码完成但履历需谨慎

| 能力 | 当前状态 | 可写条件 |
| --- | --- | --- |
| 真实 `/workspace → /training → revision → delta` | Code complete / live validation pending | Staging 真实 Auth、Supabase、OpenAI 三条 Revision 路径通过。 |
| 七天进度、Dashboard 与 History | Migration/code present | Day 1–7、跨设备和旧数据兼容验证通过。 |
| 异步 AI Job/Webhook/Reconcile | Code complete / staging validation pending | 真实 Webhook、Cron、重放与停滞恢复通过后，可写“实现异步系统”；生产观察窗通过后才写“上线运行”。 |
| 配额、成本和 Token 可观测性 | Data foundation | Provider 账单与应用记录校准、告警实际触发测试完成。 |
| 隐私导出、训练数据/账户删除 | Code complete | 真实用户旅程、级联删除与 Auth Account 删除在 Staging 验收后再称“已验证”。 |
| 服务端 Funnel Event 与业务幂等去重 | Code complete | Service Role/RPC 权限和真实 Postgres 并发验证后再用 Funnel 数据支撑履历指标。 |
| 12 个月原始回答保留 | Policy only | 自动清理、备份保留和隐私说明全部验收后再公开。 |

## 当前禁止使用

- “Judge Agent 已投入生产”或“多 Agent 自动审核上线”。
- “帮助用户能力提升 X%”。
- “提升面试通过率/Offer 率”。
- 未经采集的活跃用户、留存、七天完成率、AI 失败率、P95 或成本数字。
- “生产级”或“零幻觉”，除非限定具体已验证边界。
- 将 Demo 固定分数、Mock 结果或系统 Delta 当作真实用户学习效果。

## Pilot 后可解锁的表述模板

只替换有来源的方括号：

- “发布文本型 AI 训练 Beta，在 `[日期范围]` 内服务 `[去重用户数]` 名试用用户，完成 `[Session 数]` 次草稿—修订—复评闭环。”
- “通过异步状态机、幂等 Job 与恢复机制，将端到端 AI 反馈 P95 控制在 `[秒]`，失败率为 `[百分比]`，单 Session 平均成本为 `[金额]`。”
- “使用 `[样本数]` 个中英文人工标注案例评测模型，在严重事实错误为 `[数字]` 的前提下，将 `[质量指标]` 从 `[基线]` 提升至 `[结果]`。”
- “根据 `[反馈人数]` 份结构化访谈，将 `[具体问题]` 识别为主要流失点，并通过 `[具体改动]` 将 `[产品漏斗指标]` 从 `[前]` 提升至 `[后]`。”

不要把相关性描述为因果。即使用户 Session 分数上升，也应写“系统评估分数变化”，而不是“能力提高”。

## 证据登记模板

每个指标登记：

| 字段 | 内容 |
| --- | --- |
| Claim | 准备公开的完整句子 |
| Population | 用户、Session、Eval Case 或请求范围 |
| Time window | 明确起止日期与时区 |
| Source | CI、SQL、Event Query、Provider Usage、访谈记录或 PR URL |
| Definition | 分母、去重规则、失败/重试处理 |
| Owner | 复核人 |
| Privacy | 去标识化、授权和保留情况 |
| Status | Draft / Verified / Retired |

## 发布复核

每次修改简历、作品集或 README 前：

1. 从最新 CI 读取测试/构建证据。
2. 从 Production Event/Log 查询实际时间窗，不手工估算。
3. 与 OpenAI Usage/账单核对 Token 和成本。
4. 删除小样本可能识别个人的信息。
5. 将已过期或定义变化的 Claim 标记为 Retired，而不是静默覆盖。
