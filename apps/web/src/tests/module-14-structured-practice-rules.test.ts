import {
  getStructuredPracticePrompt,
  structuredPracticeScenarios
} from "@/features/structured-practice/curriculum";
import {
  evaluateRevisionChange,
  evaluateStructuredAnswer
} from "@/features/structured-practice/ruleEngine";
import type {
  SkillAssessment,
  StructuredSkillId
} from "@/features/structured-practice/types";

describe("v0.4 可信结构化表达规则", () => {
  it("课程包含 3 个技能和 18 个不重复场景题", () => {
    const prompts = structuredPracticeScenarios.flatMap(
      (scenario) => scenario.prompts
    );

    expect(structuredPracticeScenarios).toHaveLength(3);
    expect(prompts).toHaveLength(18);
    expect(new Set(prompts.map((prompt) => prompt.id)).size).toBe(18);
    structuredPracticeScenarios.forEach((scenario) => {
      expect(
        scenario.prompts.filter((prompt) => prompt.kind === "cold")
      ).toHaveLength(3);
      expect(
        scenario.prompts.filter((prompt) => prompt.kind === "delayed")
      ).toHaveLength(1);
    });
  });

  it("明确目的必须完成题目目标，不能由用户自填核心句自证通过", () => {
    const result = evaluate(
      "purpose",
      "stg-v04-purpose-cold-01",
      "我们今天讨论了字体颜色和按钮大小，会议记录已经整理完成。",
      "我们今天讨论了字体颜色和按钮大小。"
    );

    expect(result.status).toBe("needs_work");
    expect(result.taskStatus).toBe("needs_work");
    expect(result.selfCheckStatus).toBe("uncertain");
  });

  it("明确目的覆盖事实、对象和行动时达标", () => {
    const result = evaluate(
      "purpose",
      "stg-v04-purpose-cold-01",
      "项目将延期三天，我建议把发布日期调整到下周一，请主管今天确认。",
      "项目延期，需要主管确认调整发布日期。"
    );

    expect(result.status).toBe("met");
    expect(result.taskStatus).toBe("met");
    expect(result.matchedIntentIds).toEqual([
      "delay",
      "release",
      "decision"
    ]);
  });

  it("明确目的信息不完整时只判部分达标", () => {
    const result = evaluate(
      "purpose",
      "stg-v04-purpose-cold-01",
      "项目会延期三天，发布日期可能受影响。",
      "项目延期会影响发布日期。"
    );

    expect(result.status).toBe("partial");
    expect(result.taskStatus).toBe("partial");
  });

  it("只有决定关键词、没有向听众提出请求时不能判明确目的达标", () => {
    const result = evaluate(
      "purpose",
      "stg-v04-purpose-far-01",
      "第一预算上限，第二新增渠道超支，第三决定暂停投放。",
      "需要决定是否暂停投放。"
    );

    expect(result.taskStatus).toBe("met");
    expect(result.status).toBe("partial");
    expect(result.observation).toContain("请求语气");
  });

  it("结论在第一句且完成任务时达标", () => {
    const result = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      "项目存在周五上线风险，我建议先解决联调问题再发布。核心功能已经完成。",
      "项目存在上线风险，建议先解决联调问题。"
    );

    expect(result.status).toBe("met");
    expect(result.targetSentenceIndex).toBe(0);
  });

  it("结论在后文时只判接近", () => {
    const result = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      "目前核心功能已经完成。联调问题可能影响周五上线，我建议调整发布安排。",
      "联调问题可能影响周五上线。"
    );

    expect(result.status).toBe("partial");
    expect(result.targetSentenceIndex).toBe(1);
    expect(result.observation).toContain("开场铺垫之后");
  });

  it("无关首句即使被复制为核心句也不能判结论先行", () => {
    const result = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      "今天开了项目周会，大家更新了会议记录。",
      "今天开了项目周会。"
    );

    expect(result.status).toBe("needs_work");
    expect(result.taskStatus).toBe("needs_work");
  });

  it("用方法名和评分词包装关键词碎片不能判为达标", () => {
    const result = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-near-01",
      "建议、选择、方案二、上线风险更低，第一结论，第二原因，这就是结论先行。",
      "建议选择方案二。"
    );

    expect(result.taskStatus).toBe("met");
    expect(result.status).toBe("uncertain");
    expect(result.observation).toContain("命中方法或评分");
  });

  it("两到三点必须覆盖不同的相关理由", () => {
    const result = evaluate(
      "grouping",
      "stg-v04-grouping-cold-01",
      "我建议优化新用户引导，主要有三点。第一点，前三步流失高。第二点，客服咨询很多。第三点，改动成本较低。",
      "我建议优化新用户引导。"
    );

    expect(result.status).toBe("met");
    expect(result.groupCount).toBe(3);
    expect(result.distinctGroupCount).toBe(3);
  });

  it("重复分点不能靠序号刷成达标", () => {
    const result = evaluate(
      "grouping",
      "stg-v04-grouping-cold-01",
      "我建议优化新用户引导。第一点，客服咨询很多。第二点，客服咨询还是很多。",
      "我建议优化新用户引导。"
    );

    expect(result.status).toBe("needs_work");
    expect(result.groupCount).toBe(2);
    expect(result.distinctGroupCount).toBe(1);
  });

  it("即使总共命中多个理由，跨分点重复同一理由也不能达标", () => {
    const result = evaluate(
      "grouping",
      "stg-v04-grouping-far-01",
      "第一客户价值，第二客户价值更高，第三选择方案甲，实施难度低且维护成本小。",
      "建议选择方案甲。"
    );

    expect(result.taskStatus).toBe("met");
    expect(result.status).toBe("needs_work");
    expect(result.observation).toContain("内容重复");
  });

  it("只有分点形式但内容无关时拒绝乐观判定", () => {
    const result = evaluate(
      "grouping",
      "stg-v04-grouping-cold-01",
      "第一点，苹果很好吃。第二点，今天阳光很好。",
      "我想分享两件事。"
    );

    expect(["needs_work", "uncertain"]).toContain(result.status);
    expect(result.status).not.toBe("met");
  });

  it("没有显式结构时不能视为两到三点框架", () => {
    const result = evaluate(
      "grouping",
      "stg-v04-grouping-cold-01",
      "我建议优化新用户引导，因为前三步流失高，客服咨询很多，改动成本也较低。",
      "我建议优化新用户引导。"
    );

    expect(result.status).toBe("needs_work");
    expect(result.groupCount).toBe(0);
  });

  it("反馈证据始终来自回答原文", () => {
    const answer =
      "核心功能已经完成。联调问题可能影响周五上线，我建议调整发布安排。";
    const result = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      answer,
      "联调问题可能影响周五上线。"
    );
    const cited = result.evidence.slice(1, -1).replace(/…$/, "");

    expect(answer).toContain(cited);
  });

  it("仅修改标点不能算有效重写", () => {
    const before = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      "核心功能已经完成。联调问题可能影响周五上线。",
      "联调问题可能影响周五上线。"
    );
    const after = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      "核心功能已经完成；联调问题可能影响周五上线！",
      "联调问题可能影响周五上线。"
    );

    expect(
      evaluateRevisionChange({
        beforeAnswer: "核心功能已经完成。联调问题可能影响周五上线。",
        afterAnswer: "核心功能已经完成；联调问题可能影响周五上线！",
        before,
        after
      })
    ).toMatchObject({ kind: "unchanged", canContinue: false });
  });

  it("结构状态真正改善后才能进入迁移", () => {
    const beforeAnswer =
      "核心功能已经完成。联调问题可能影响周五上线，我建议调整发布安排。";
    const afterAnswer =
      "联调问题可能影响周五上线，我建议调整发布安排。核心功能已经完成。";
    const before = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      beforeAnswer,
      "联调问题可能影响周五上线。"
    );
    const after = evaluate(
      "conclusion_first",
      "stg-v04-conclusion-cold-01",
      afterAnswer,
      "联调问题可能影响周五上线。"
    );

    expect(
      evaluateRevisionChange({
        beforeAnswer,
        afterAnswer,
        before,
        after
      })
    ).toMatchObject({ kind: "improved", canContinue: true });
  });
});

function evaluate(
  skillId: StructuredSkillId,
  promptId: string,
  answer: string,
  selfStatement: string
): SkillAssessment {
  const prompt = getStructuredPracticePrompt(promptId);
  return evaluateStructuredAnswer({
    skillId,
    answer,
    selfStatement,
    evaluation: prompt.evaluation
  });
}
