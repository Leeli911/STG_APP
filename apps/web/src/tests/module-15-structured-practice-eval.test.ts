import {
  loadStructuredPracticeGoldenSet,
  renderStructuredPracticeEvalMarkdown,
  runStructuredPracticeEval,
  type StructuredPracticeGoldenSet
} from "@/server/benchmarks/structuredPracticeEval";

const inMemoryGoldenSet: StructuredPracticeGoldenSet = {
  version: "structured-practice-rule-gold-v1-test",
  cases: [
    {
      id: "purpose-met",
      skillId: "purpose",
      promptId: "stg-v04-purpose-cold-01",
      answer: "项目晚三天，建议将发布日期调整到下周一，请您确认。",
      selfStatement: "建议将发布日期调整到下周一。",
      expectedStatus: "met",
      expectedTaskStatus: "met",
      tags: ["correct"],
      acceptableEvidence: ["项目晚三天"]
    },
    {
      id: "purpose-needs-work",
      skillId: "purpose",
      promptId: "stg-v04-purpose-cold-01",
      answer: "今天天气不错。",
      selfStatement: "今天天气不错。",
      expectedStatus: "needs_work",
      expectedTaskStatus: "needs_work",
      tags: ["off_topic"],
      acceptableEvidence: ["今天天气不错"]
    }
  ]
};

describe("Module 15 deterministic structured practice eval", () => {
  it("calculates classification, provenance, and determinism metrics", () => {
    const run = runStructuredPracticeEval(inMemoryGoldenSet);

    expect(run.summary).toMatchObject({
      evalVersion: "structured-practice-rule-gold-v1-test",
      totalCases: 2,
      accuracy: 1,
      taskAccuracy: 1,
      macroF1: 1,
      severeFalsePass: {
        count: 0,
        eligibleCases: 1,
        rate: 0
      },
      evidenceProvenance: {
        passedCases: 2,
        rate: 1
      },
      evidenceGoldMatch: {
        passedCases: 2,
        rate: 1
      },
      determinism: {
        passedCases: 2,
        rate: 1
      }
    });
    expect(run.summary.confusionMatrix.met.met).toBe(1);
    expect(run.summary.confusionMatrix.needs_work.needs_work).toBe(1);
    expect(run.summary.statusMetrics.met.f1).toBe(1);
    expect(run.summary.statusMetrics.needs_work.f1).toBe(1);
    expect(run.summary.releaseGate.passed).toBe(true);
  });

  it("counts a needs_work answer predicted as met as a severe false pass", () => {
    const manipulated: StructuredPracticeGoldenSet = {
      version: "red-team-test",
      cases: [
        {
          ...inMemoryGoldenSet.cases[0],
          id: "false-pass",
          expectedStatus: "needs_work",
          expectedTaskStatus: "needs_work",
          tags: ["keyword_stuffing"]
        }
      ]
    };

    const run = runStructuredPracticeEval(manipulated);

    expect(run.summary.accuracy).toBe(0);
    expect(run.summary.severeFalsePass).toEqual({
      count: 1,
      eligibleCases: 1,
      rate: 1
    });
    expect(run.summary.confusionMatrix.needs_work.met).toBe(1);
    expect(run.summary.releaseGate.passed).toBe(false);
  });

  it("renders a stable Markdown report from in-memory cases", () => {
    const run = runStructuredPracticeEval(inMemoryGoldenSet);
    const markdown = renderStructuredPracticeEvalMarkdown(
      run.summary,
      run.cases
    );

    expect(markdown).toContain("# 结构化表达规则评测报告");
    expect(markdown).toContain("严重假通过率（needs_work → met）：0.0%");
    expect(markdown).toContain("| needs_work | 0 | 0 | 0 | 1 |");
    expect(markdown).toContain("发布门：通过");
  });

  it("rejects duplicate case ids before evaluation", () => {
    expect(() =>
      runStructuredPracticeEval({
        version: "invalid",
        cases: [
          inMemoryGoldenSet.cases[0],
          inMemoryGoldenSet.cases[0]
        ]
      })
    ).toThrow("Duplicate structured practice eval case id");
  });
});

describe("rule-gold-v1 独立黄金集发布门", () => {
  const goldenSet = loadStructuredPracticeGoldenSet();
  const run = runStructuredPracticeEval(goldenSet);

  it("包含 180 个案例并通过预先定义的整体门槛", () => {
    expect(goldenSet.cases).toHaveLength(180);
    expect(run.summary.releaseGate).toMatchObject({
      macroF1AtLeast090: true,
      severeFalsePassAtMost002: true,
      evidenceProvenanceIs100Percent: true,
      evidenceGoldMatchAtLeast095: true,
      determinismIs100Percent: true,
      passed: true
    });
  });

  it.each(run.cases)(
    "$id 的证据可恢复、结果确定且严重错误不会误放",
    (result) => {
      expect(result.evidenceFromAnswer).toBe(true);
      expect(result.deterministic).toBe(true);
      if (result.expectedStatus === "needs_work") {
        expect(result.actualStatus).not.toBe("met");
      }
    }
  );
});
