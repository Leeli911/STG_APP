import type {
  StructuredPracticeScenario,
  StructuredSkillId
} from "@/features/structured-practice/types";

export const structuredPracticeScenarios: StructuredPracticeScenario[] = [
  {
    id: "stg-v03-purpose-01",
    day: 1,
    skillId: "purpose",
    title: "明确目的",
    shortDescription: "先确定希望对方知道什么、决定什么。",
    audience: "直属主管",
    desiredOutcome: "让主管了解项目将延期，并决定是否调整发布日期。",
    prompt:
      "新用户引导改版比原计划晚三天。你需要向主管说明情况，并请他决定是否把发布日期调整到下周一。请完成一次简短汇报。",
    transferAudience: "项目负责人",
    transferDesiredOutcome: "让负责人了解数据仍需核对，并决定周报如何发布。",
    transferPrompt:
      "一项关键数据还需要两天核对。请向项目负责人说明情况，并请他决定延后周报，还是先发布暂定数据。",
    lesson: {
      principle: "表达之前，先确定受众和希望对方采取的行动。",
      checklist: [
        "核心目的是否真的出现在回答中",
        "对方听完后是否知道需要做什么决定",
        "背景信息是否都服务于这个目的"
      ]
    }
  },
  {
    id: "stg-v03-conclusion-01",
    day: 2,
    skillId: "conclusion_first",
    title: "结论先行",
    shortDescription: "第一句话先给判断、结果或请求。",
    audience: "项目主管",
    desiredOutcome: "让主管先知道项目存在上线风险，并听到你的处理建议。",
    prompt:
      "主管临时问你：本周项目状态怎么样？目前核心功能已经完成，但联调问题可能影响周五上线。请直接回答。",
    transferAudience: "业务负责人",
    transferDesiredOutcome: "让负责人先知道投诉增加的主要原因和处理动作。",
    transferPrompt:
      "业务负责人问：昨天用户投诉为什么突然增加？你已经确认主要原因是新版本的登录异常，团队正在回滚。请直接回答。",
    lesson: {
      principle: "先回答问题，再补充背景、依据和细节。",
      checklist: [
        "第一句话是否已经给出核心判断",
        "后续内容是否在支撑第一句话",
        "是否删除了不影响判断的开场铺垫"
      ]
    }
  },
  {
    id: "stg-v03-grouping-01",
    day: 3,
    skillId: "grouping",
    title: "两到三点框架",
    shortDescription: "把多个理由整理成少量、清楚的分组。",
    audience: "产品负责人",
    desiredOutcome: "让负责人理解为什么下一阶段应优先优化新用户引导。",
    prompt:
      "你建议下一阶段优先优化新用户引导。现有信息包括：流失集中在前三步、相关客服咨询很多、改动成本相对较低。请说明理由。",
    transferAudience: "团队主管",
    transferDesiredOutcome: "让主管理解为什么需要增加一名协作人员。",
    transferPrompt:
      "你希望团队增加一名协作人员。当前问题包括需求并行增加、测试排期冲突、关键成员频繁加班。请说明理由。",
    lesson: {
      principle: "听众通常只能稳定记住少量重点，优先整理成两到三点。",
      checklist: [
        "是否明确告诉对方一共有几点",
        "每一点是否只表达一个主要意思",
        "不同点之间是否尽量不重复"
      ]
    }
  }
];

export function getStructuredPracticeScenario(skillId: StructuredSkillId) {
  const scenario = structuredPracticeScenarios.find(
    (item) => item.skillId === skillId
  );

  if (!scenario) {
    throw new Error(`Unknown structured practice skill: ${skillId}`);
  }

  return scenario;
}
