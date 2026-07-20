# Product Overview

## 产品定位

Structured Thinking Gym 是一个文本型 AI 面试表达训练 App。首个公开 Beta 面向求职者、转岗者和初入职场用户，解决“知道要说什么，但回答铺垫过长、结构混乱或证据不足”的问题。

产品不承诺替用户生成完美答案，而是帮助用户完成一次主动修订：

```text
注册 / 登录
→ 设置目标岗位、面试类型、训练目标与反馈语言
→ 今日题目
→ 原始回答
→ 可解释 AI 反馈
→ 接受 / 拒绝 / 编辑
→ 最终回答与重新评分
→ 下一天 / 历史 / 七天总结
```

## 用户与 Beta 边界

Beta 默认：

- 中文 UI；用户可用中文或英文作答。
- 固定、版本化的七天课程，便于校准和比较。
- 文本优先，不包含语音、简历/JD 解析、支付、团队账号或 AI 动态出题。
- 目标岗位和训练目标只调整说明和反馈语境，不改变课程与 Rubric。
- 首轮计划邀请 5–20 名用户；所有效果表述以实际数据为准。

## 当前产品能力

### Done

- 首页、登录、注册、找回/重设密码和受保护路由基础。
- 七天题目内容、Workspace、Attempt 提交和传统结果兼容页。
- Analysis 与 Coaching 两阶段 AI 管线、严格结构化输出、Repair 和事实保护。
- 可解释五维评分：相关性、核心信息、结构、事实证据、面试影响力。
- Human-in-the-loop Session：接受、拒绝、编辑、最终稿和重新评分。
- `/training/[attemptId]` 真实训练入口及 `/training-demo` 确定性入口。
- Demo 和 Live 共用 DTO、Gateway、Controller 与 UI。
- 账户 Settings、训练数据 JSON 导出、训练数据删除和永久账户删除；导出包含当前用户事件、配额及不含 Provider Payload/敏感错误的 AI Job 运行记录。
- 自动化单元/组件测试、生产构建和 Playwright Beta 旅程。

### Partial / awaiting live validation

- Onboarding Profile、Dashboard、History 和版本化 `stg-7day-v1` 数据结构已实现，但需要应用迁移后进行真实用户、跨设备和 Day 1–7 验证。
- 异步 AI 主链路、`202` Processing Attempt、签名 Webhook、Reconciler 和受保护 Cron 已实现；真实 OpenAI Webhook/停滞恢复仍需 Staging 验证。
- 产品事件由业务 API 服务端权威写入并按业务动作去重；配额、数据导出/删除和账户删除已实现。正式监控、真实级联删除和备份保留边界需在部署环境验收。

### Planned for Beta operations

- Preview、Staging、Production 云环境。
- 注册 Staging OpenAI Webhook，验证重放、遗漏、乱序、超时和停滞恢复。
- 真实 Supabase RLS/RPC 集成测试与低预算 Live AI smoke test。
- 5–20 人 Pilot、结构化访谈、漏斗/延迟/成本复盘和七天完成报告。

## 核心行为规则

- 用户必须先提交自己的回答，AI 建议不能替代原始草稿。
- Revision 只能提交一次；重试必须复用同一个 Idempotency Key。
- 接受：最终稿为建议稿，再评分。
- 编辑：最终稿为用户编辑稿，再评分。
- 拒绝：最终稿为原稿，沿用原评分，Delta 为 0，不新增 AI 调用。
- 下一天只在 Session 有明确 Revision 决策且已完成时解锁。
- Delta 是同一 Session 的系统评估差值，不是被证明的能力提升。

## 五维 Rubric 与课程

五维评分：

1. 回答相关性
2. 核心信息
3. 表达结构
4. 事实证据
5. 面试影响力

七天技能：

1. Conclusion First
2. Categorization
3. STAR
4. Evidence
5. Conflict Handling
6. Stakeholder Communication
7. Final Pitch

课程内容保持可版本化和可追溯；Beta 不引入难以校准的自动生成课程。

## 成功指标

部署前只定义指标，不填写结果：

- Onboarding → 首次草稿提交率
- 草稿 → Revision → Rescore 完成率
- 次日返回率和七天完成率
- AI Schema/事实错误率、端到端 P50/P95 延迟、单 Session 成本
- 用户对反馈是否具体、可信、可执行的结构化评价

首轮最低证据目标为 20 个完整 Session 和 5 份以上结构化用户反馈。任何履历数字必须可从产品事件、日志或访谈记录追溯。

## 非目标

- 不把系统评分称为客观能力测量。
- 不声称 Judge 已在生产运行。
- 不在未收集真实数据时宣称用户提升、留存或商业效果。
- 不复制参考项目中受非商业、无许可证或其他限制保护的代码和内容。
