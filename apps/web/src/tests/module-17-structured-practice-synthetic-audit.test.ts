import {
  loadStructuredSyntheticTrajectories,
  runStructuredSyntheticAudit
} from "@/server/benchmarks/structuredPracticeSyntheticAudit";

describe("Module 17 structured-practice synthetic user audit", () => {
  const run = runStructuredSyntheticAudit(
    loadStructuredSyntheticTrajectories()
  );

  it("keeps 54 balanced trajectories across six roles and three treatments", () => {
    expect(run.summary.totalTrajectories).toBe(54);
    expect(run.summary.personas).toHaveLength(6);
    expect(run.summary.fixtureIntegrity).toMatchObject({
      uniqueIds: true,
      balancedTreatments: true,
      balancedSkills: true,
      eachPersonaCoversEverySkillAndTreatment: true,
      treatmentMatchesRevisionOwnership: true,
      pairedColdBaselines: true,
      matchedTransferPrompts: true,
      passed: true
    });
    expect(
      Object.values(run.summary.byTreatment).map((item) => item.trajectories)
    ).toEqual([18, 18, 18]);
  });

  it("never reports an evidence quote that cannot be recovered from its answer", () => {
    expect(run.summary.evidenceProvenanceRate).toBe(1);
    expect(
      run.cases.every((item) => item.evidenceProvenancePassed)
    ).toBe(true);
  });

  it("keeps direct AI revisions separate from learner-authored practice", () => {
    expect(run.summary.byTreatment.direct_ai.learnerAuthoredRevision).toBe(0);
    expect(run.summary.byTreatment.stg.learnerAuthoredRevision).toBe(18);
    expect(
      run.summary.byTreatment.practice_only.learnerAuthoredRevision
    ).toBe(18);
  });

  it("labels the report as synthetic evidence with explicit limitations", () => {
    expect(run.markdown).toContain("不是用户研究、Pilot 或学习效果证明");
    expect(run.summary.limitations).toHaveLength(5);
    expect(run.markdown).toContain("关键词投机复核队列");
  });
});
