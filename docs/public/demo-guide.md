# Public Demo Guide

STG 的免费公开训练入口：

```text
/training-demo
```

当前线上入口：

```text
https://leeli911.github.io/STG_APP/training-demo/
```

Next.js 路由与 GitHub Pages 静态入口都直接复用 `StructuredPracticeDemo`、课程场景、确定性规则和进度逻辑，不维护第二套评分实现。线上入口只有在相应版本完成 GitHub Pages 发布后才会更新；本地分支的新功能不等于已经部署。

## v0.4 展示内容

```text
无提示冷答
→ 核心结论自检
→ 单点原文证据反馈
→ 用户亲自重写
→ 未见题迁移
→ 24 小时后未见冷测
```

首批只训练三个微技能：

- 明确目的
- 结论先行
- 两到三点框架

训练结果区分任务信息、当前微技能状态、自检对齐和是否完成闭环，不输出未经验证的“能力提升百分比”。

## 本地运行

```bash
npm ci
npm run dev
```

打开：

```text
http://localhost:3000/training-demo
```

无需登录。

## 建议验收路径

1. 输入不足 20 字并提交，确认页面给出明确错误，而不是没有反应。
2. 完成一次冷答和自检，确认反馈引用回答原文且只给一个修改动作。
3. 只修改标点，确认不能进入迁移题。
4. 亲自改善目标结构后进入未见题，确认新题不展示方法提示。
5. 刷新未完成页面，确认步骤和回答恢复。
6. 使用到期 Fixture 或等待 24 小时，确认可以进入另一道未见冷测。
7. 在浏览器网络面板确认没有 App API、OpenAI、Supabase 或第三方分析请求。

自动化验收：

```bash
npm run test:e2e:install
npm run test:e2e
npm run eval:structured
npm run audit:synthetic
```

## 本地数据和隐私

- 完整的进行中答案只保存在当前标签页的 `sessionStorage`，用于刷新恢复。
- 最近 30 次完成状态和冷测到期时间保存在当前浏览器的 `localStorage`。
- 不调用 OpenAI、Supabase、App API 或第三方分析。
- 清理站点数据即可删除本地训练记录。

## 能证明与不能证明

公开 Demo 可以证明：

- 提交、反馈、重写、迁移、恢复和冷测流程真实可运行。
- 当前规则版本对同一输入产生确定结果。
- 反馈证据来自用户回答，而不是模型虚构。
- 免费流程不依赖外部服务。

公开 Demo 不能证明：

- 真实目标用户需要、喜欢或会持续使用产品。
- 单次迁移达标等于长期能力提升。
- 规则覆盖所有自然中文表达。
- 合成用户审计等于真实 Pilot。
