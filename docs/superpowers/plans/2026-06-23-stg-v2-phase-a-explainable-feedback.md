# STG V2 Phase A Explainable Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render evidence-backed dimension explanations in the V2 feedback-ready screen using only existing score and diagnosis data.

**Architecture:** Add a pure mapper from existing `AttemptRow`, `ScoreRow`, and `AiFeedbackRow` records into a feedback-ready `TrainingSessionDto`. Render the mapped dimensions through a focused `ExplainableRubric` component inside a parallel V2 `TrainingSessionScreen`; do not modify the Legacy Result page or AI pipeline.

**Tech Stack:** TypeScript, React 19, Next.js 15, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Explainable feedback types and mapper

**Files:**
- Create: `apps/web/src/server/training-sessions/types.ts`
- Create: `apps/web/src/server/training-sessions/trainingSessionDto.ts`
- Create: `apps/web/src/server/training-sessions/index.ts`
- Test: `apps/web/src/tests/module-9-explainable-feedback.test.tsx`

- [ ] **Step 1: Write failing mapper tests**

Add fixtures using existing row contracts and assert that the mapper preserves score evidence and deductions and maps `lack_example` to the Evidence dimension's `improvementFocus`:

```tsx
import { toFeedbackReadyTrainingSessionDto } from "@/server/training-sessions";

it("maps existing rubric evidence into explainable dimensions", () => {
  const session = toFeedbackReadyTrainingSessionDto({
    sessionId: "session-1",
    sourceMode: "live",
    feedbackMode: "D",
    attempt,
    score,
    feedback
  });

  expect(session.status).toBe("feedback_ready");
  expect(session.scoreBefore.dimensions).toContainEqual({
    dimension: "evidence",
    displayName: "Evidence",
    score: 13,
    maxScore: 20,
    evidence: "有原因但缺少具体经历。",
    deductions: [
      { rule: "specific_example", points: 2, reason: "缺少真实经历。" }
    ],
    improvementFocus: "补充一个真实学习或工作场景。"
  });
});

it("uses null when no diagnosis maps to a dimension", () => {
  const session = toFeedbackReadyTrainingSessionDto({
    sessionId: "session-1",
    sourceMode: "demo",
    feedbackMode: "D",
    attempt,
    score,
    feedback: { ...feedback, diagnosis: [] }
  });

  expect(
    session.scoreBefore.dimensions.find(
      (item) => item.dimension === "evidence"
    )?.improvementFocus
  ).toBeNull();
});
```

- [ ] **Step 2: Run the mapper tests and verify RED**

Run:

```bash
npm --workspace apps/web test -- module-9-explainable-feedback
```

Expected: FAIL because `@/server/training-sessions` does not exist.

- [ ] **Step 3: Add the Phase A DTO types**

Create `types.ts` with the approved naming:

```ts
import type { DiagnosisItem, WhyBetterItem } from "@/server/attempts";

export type SourceMode = "demo" | "live";
export type FeedbackMode = "A" | "B" | "C" | "D";
export type DimensionKey =
  | "relevance"
  | "core_message"
  | "structure"
  | "evidence"
  | "interview_impact";

export type ExplainableDimensionDto = {
  dimension: DimensionKey;
  displayName: string;
  score: number;
  maxScore: number;
  evidence: string;
  deductions: Array<{ rule: string; points: number; reason: string }>;
  improvementFocus: string | null;
};

export type FeedbackReadyTrainingSessionDto = {
  id: string;
  sourceMode: SourceMode;
  feedbackMode: FeedbackMode;
  practiceDay: number;
  status: "feedback_ready";
  draft: { text: string; attemptId: string; submittedAt: string };
  diagnosis: DiagnosisItem[];
  suggestion: {
    text: string;
    structureUsed: string;
    whyBetter: WhyBetterItem[];
  };
  scoreBefore: { total: number; dimensions: ExplainableDimensionDto[] };
  decision: null;
  final: null;
  scoreAfter: null;
  delta: null;
  feedbackShownAt: string | null;
};
```

- [ ] **Step 4: Implement the pure mapper**

Create `trainingSessionDto.ts`. Parse `score.rubric_evidence.dimension_scores` defensively, use static dimension labels, and map existing issue types to dimensions:

```ts
const labels: Record<DimensionKey, string> = {
  relevance: "Answer Relevance",
  core_message: "Core Message",
  structure: "Structure",
  evidence: "Evidence",
  interview_impact: "Interview Impact"
};

const issueDimensions: Partial<Record<string, DimensionKey>> = {
  off_topic: "relevance",
  missing_core_message: "core_message",
  late_core_message: "core_message",
  vague_core_message: "core_message",
  background_too_long: "core_message",
  no_clear_structure: "structure",
  action_missing: "structure",
  result_missing: "structure",
  lack_example: "evidence",
  lack_metric: "evidence",
  unsupported_claim: "evidence",
  repetition: "interview_impact",
  weak_role_fit: "interview_impact",
  over_humble: "interview_impact",
  overclaim: "interview_impact"
};
```

Return an empty dimensions array for missing or malformed historical `rubric_evidence`; do not invent evidence.

- [ ] **Step 5: Run mapper tests and verify GREEN**

Run:

```bash
npm --workspace apps/web test -- module-9-explainable-feedback
```

Expected: mapper tests PASS.

### Task 2: ExplainableRubric component

**Files:**
- Create: `apps/web/src/components/training/ExplainableRubric.tsx`
- Modify: `apps/web/src/tests/module-9-explainable-feedback.test.tsx`

- [ ] **Step 1: Write failing component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { ExplainableRubric } from "@/components/training/ExplainableRubric";

it("renders score, evidence, deduction, and improvement focus", () => {
  render(<ExplainableRubric dimensions={dimensions} />);

  expect(screen.getByRole("heading", { name: "Evidence" })).toBeInTheDocument();
  expect(screen.getByText("13 / 20")).toBeInTheDocument();
  expect(screen.getByText("有原因但缺少具体经历。")).toBeInTheDocument();
  expect(screen.getByText("缺少真实经历。")).toBeInTheDocument();
  expect(screen.getByText("补充一个真实学习或工作场景。")).toBeInTheDocument();
});

it("renders neutral empty states without generating coaching text", () => {
  render(
    <ExplainableRubric
      dimensions={[{ ...dimensions[0], deductions: [], improvementFocus: null }]}
    />
  );

  expect(screen.getByText("No deductions recorded.")).toBeInTheDocument();
  expect(screen.getByText("No primary improvement focus.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run component tests and verify RED**

Run the focused test command and expect failure because the component does not exist.

- [ ] **Step 3: Implement ExplainableRubric**

```tsx
import type { ExplainableDimensionDto } from "@/server/training-sessions";

export function ExplainableRubric({
  dimensions
}: {
  dimensions: ExplainableDimensionDto[];
}) {
  if (dimensions.length === 0) {
    return <p>Detailed rubric is unavailable for this earlier attempt.</p>;
  }

  return (
    <section aria-labelledby="explainable-rubric-title">
      <h2 id="explainable-rubric-title">Score Breakdown</h2>
      {dimensions.map((item) => (
        <article key={item.dimension}>
          <h3>{item.displayName}</h3>
          <p>{item.score} / {item.maxScore}</p>
          <p>{item.evidence}</p>
          {item.deductions.length === 0 ? (
            <p>No deductions recorded.</p>
          ) : (
            item.deductions.map((deduction) => (
              <p key={`${deduction.rule}-${deduction.points}`}>{deduction.reason}</p>
            ))
          )}
          <p>{item.improvementFocus ?? "No primary improvement focus."}</p>
        </article>
      ))}
    </section>
  );
}
```

Apply existing Tailwind card styles without changing behavior.

- [ ] **Step 4: Run focused tests and verify GREEN**

Expected: mapper and component tests PASS.

### Task 3: V2 TrainingSessionScreen integration

**Files:**
- Create: `apps/web/src/features/training-session/TrainingSessionScreen.tsx`
- Modify: `apps/web/src/tests/module-9-explainable-feedback.test.tsx`

- [ ] **Step 1: Write a failing screen rendering test**

```tsx
import { TrainingSessionScreen } from "@/features/training-session/TrainingSessionScreen";

it("renders total score and explainable rubric in feedback_ready", () => {
  render(<TrainingSessionScreen session={session} />);

  expect(screen.getByText("68")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Score Breakdown" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Core Message" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the test and verify RED**

Expected: FAIL because `TrainingSessionScreen` does not exist.

- [ ] **Step 3: Implement the Phase A feedback-ready screen**

```tsx
import { ExplainableRubric } from "@/components/training/ExplainableRubric";
import type { FeedbackReadyTrainingSessionDto } from "@/server/training-sessions";

export function TrainingSessionScreen({
  session
}: {
  session: FeedbackReadyTrainingSessionDto;
}) {
  return (
    <main className="space-y-6">
      <section>
        <p>Total Score</p>
        <p>{session.scoreBefore.total}</p>
      </section>
      <ExplainableRubric dimensions={session.scoreBefore.dimensions} />
    </main>
  );
}
```

The component remains parallel to the Legacy Result page and is not wired into `ResultClient` during Phase A.

- [ ] **Step 4: Run focused tests and verify GREEN**

Expected: all Module 9 tests PASS.

### Task 4: Documentation and regression verification

**Files:**
- Modify: `README.md`
- Verify unchanged: `apps/web/src/app/result/[attemptId]/ResultClient.tsx`
- Verify unchanged: `apps/web/src/schemas/ai/index.ts`
- Verify unchanged: `apps/web/src/prompts/**`
- Verify unchanged: `apps/web/src/database/migrations/**`

- [ ] **Step 1: Add a concise Phase A README section**

Document that V2 Phase A maps stored dimension evidence and diagnosis focus into a new V2 component without changing prompts, model calls, migrations, or the Legacy Result page.

- [ ] **Step 2: Run focused tests**

```bash
npm --workspace apps/web test -- module-9-explainable-feedback
```

Expected: PASS.

- [ ] **Step 3: Run the complete regression suite**

```bash
npm test
```

Expected: 0 failed tests, including existing Legacy Result tests.

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: exit code 0 with successful type checking and build output.

- [ ] **Step 5: Verify the Phase A scope boundary**

```bash
git diff --name-only main...HEAD
```

Expected: no migration, prompt, schema, AI pipeline, or Legacy Result files.
