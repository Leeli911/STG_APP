# STG V2 Upgrade Design Spec

**Status:** Approved for phased implementation
**Date:** 2026-06-23
**Product:** Structured Thinking Gym (STG)

## 1. Purpose

STG V2 extends the existing AI communication coach without changing its product direction or replacing its current AI pipeline. The public product remains a practical communication training system. Explainability, collaborative revision, and learning analytics emerge from normal product use; the UI does not expose research or experimentation terminology.

The V2 learning loop is:

```text
Question
→ Draft
→ Explainable Feedback
→ Accept / Reject / Edit
→ Final Answer
→ Re-score
→ Improvement Summary
```

The existing Analysis, Coaching, Repair, and Judge pipelines remain the source of truth. V2 prioritizes observability and user behavior signals over new AI capabilities.

## 2. Non-goals

V2 does not add:

- A/B testing infrastructure
- Statistical significance testing
- Research participant management
- Survey systems
- Additional AI agents
- New model capabilities
- Complex experimentation or research dashboards
- Social features
- A gamification redesign

## 3. Architectural invariants

1. Demo Mode and Live Mode use one component tree and one `TrainingSessionDto` contract.
2. Demo and Live differ only in their adapter and data source.
3. The existing Analysis / Coaching / Repair / Judge pipeline and prompt schemas remain authoritative.
4. Feedback Mode controls frontend visibility only. The backend always generates and saves the complete existing result.
5. The Legacy Result route and `AttemptResultDto` remain supported.
6. Delta values are derived from immutable before/after score records and are not a database source of truth.
7. The implementation order is fixed:

```text
Explainable Feedback
→ Human-AI Revision
→ Delta Tracking
→ Feedback Mode
→ Learning Dashboard
```

## 4. One UI and two adapters

```text
DemoAdapter ───────┐
                   ├─→ TrainingSessionDto → TrainingSessionScreen
LiveAdapter ───────┘
```

`TrainingSessionScreen` and its child components never branch on `sourceMode` to select a second page. Both adapters provide identical DTO shapes and status semantics.

### 4.1 Demo Adapter

Demo Mode:

- requires no login
- calls no STG API
- calls neither OpenAI nor Supabase
- uses deterministic fixtures shaped like existing Analysis and Coaching output
- completes Draft → Explainable Feedback → Decision → Final → Delta
- keeps user input in page memory only
- clears the session on refresh or tab close
- defaults to Feedback Mode D

### 4.2 Live Adapter

Live Mode:

- authenticates through the existing auth path
- reuses the existing Attempt API and AI pipeline
- stores normal attempts, scores, and AI feedback in existing tables
- persists the relationship between initial and final attempts
- persists one committed revision decision per session
- returns the same `TrainingSessionDto` used by Demo Mode

## 5. Naming rules

`sourceMode` and `feedbackMode` are independent:

```ts
type SourceMode = "demo" | "live";
type FeedbackMode = "A" | "B" | "C" | "D";
```

- `sourceMode` answers: where did this session data come from?
- `feedbackMode` answers: which feedback components may the frontend show?

The existing `AttemptResultDto.attempt.feedbackMode?: "mock" | "live"` is a legacy field whose semantics are not changed. V2 mappers normalize it into `TrainingSessionDto.sourceMode`. V2 never repurposes the legacy field for A-D feedback visibility.

## 6. Canonical TrainingSessionDto

The canonical conceptual flow is:

```text
Draft → Suggestion → Decision → Final → Delta
```

The shared base fields are:

```ts
type TrainingSessionBase = {
  id: string;
  sourceMode: SourceMode;
  feedbackMode: FeedbackMode;
  practiceDay: number;
  draft: {
    text: string;
    attemptId: string | null;
    submittedAt: string | null;
  };
  feedbackShownAt: string | null;
};

type SuggestionDto = {
  text: string;
  structureUsed: string;
  whyBetter: WhyBetterItem[];
};

type DiagnosisDto = DiagnosisItem[];

type DecisionDto = {
  action: "accepted" | "rejected" | "edited";
  editedText: string | null;
  decidedAt: string;
};

type FinalAnswerDto = {
  text: string;
  attemptId: string;
  submittedAt: string;
};
```

`TrainingSessionDto` is a discriminated union. It is one DTO contract, not separate Demo and Live DTOs.

```ts
type TrainingSessionDto =
  | DraftTrainingSessionDto
  | AnalyzingTrainingSessionDto
  | InitialFailedTrainingSessionDto
  | FeedbackReadyTrainingSessionDto
  | RescoringTrainingSessionDto
  | RescoreFailedTrainingSessionDto
  | CompletedTrainingSessionDto;
```

### 6.1 Status field availability

All lifecycle fields are present in every union member. Their values are required objects or explicitly `null` according to status.

| `status` | `diagnosis` | `suggestion` | `scoreBefore` | `decision` | `final` | `scoreAfter` | `delta` |
|---|---|---|---|---|---|---|---|
| `draft` | null | null | null | null | null | null | null |
| `analyzing` | null | null | null | null | null | null | null |
| `initial_failed` | null | null | null | null | null | null | null |
| `feedback_ready` | required | required | required | null | null | null | null |
| `rescoring` | required | required | required | required | required | null | null |
| `rescore_failed` | required | required | required | required | required | null | null |
| `completed` | required | required | required | required | required | required | required |

`revising` is not a persisted session status. Drafting an edit and `isSubmitting` are local UI states.

## 7. Explainable score contract

```ts
type DimensionKey =
  | "relevance"
  | "core_message"
  | "structure"
  | "evidence"
  | "interview_impact";

type DeductionDto = {
  rule: string;
  points: number;
  reason: string;
};

type ExplainableDimensionDto = {
  dimension: DimensionKey;
  displayName: string;
  score: number;
  maxScore: number;
  evidence: string;
  deductions: DeductionDto[];
  improvementFocus: string | null;
};

type ScoreSnapshot = {
  total: number;
  dimensions: ExplainableDimensionDto[];
};
```

Explainable Feedback may only reuse:

- `dimension_scores.score`
- `dimension_scores.max_score`
- `dimension_scores.evidence`
- `dimension_scores.deductions`
- `diagnosis.fix_direction`

Dimension labels are static product labels derived from `dimension`, not generated model content. A fixed `issue_type → dimension` mapping associates a diagnosis with a dimension. The first matching diagnosis in the existing ordered output supplies `improvementFocus`. If no diagnosis matches, `improvementFocus` is `null`; the UI does not generate substitute coaching content.

Phase A introduces no migration, prompt change, prompt schema change, model call, or AI agent.

## 8. Decision semantics

The three actions have one meaning throughout V2:

| Action | Final answer | `editedText` |
|---|---|---|
| `accepted` | `suggestion.text` | null |
| `rejected` | `draft.text` | null |
| `edited` | normalized user edit | required |

Mode A and Mode B do not display the suggestion, so they cannot submit `accepted`. They may submit `rejected` (keep the original) or `edited` (revise independently). Modes C and D may submit all three actions.

### 8.1 Edit validation

Client and server share the same validator. After trimming, `edited_text`:

- must not be empty
- must not equal the trimmed Draft
- must not equal the trimmed Suggestion
- must satisfy the existing minimum-answer validation
- must be no longer than the existing `MAX_ANSWER_LENGTH` of 6000 characters

Invalid edits show an ordinary inline message, create no revision record, create no final attempt, and do not enter re-scoring.

## 9. Status transitions

```text
draft
→ analyzing
→ feedback_ready
→ rescoring
→ completed
```

Failure transitions:

```text
analyzing → initial_failed
rescoring → rescore_failed
rescore_failed → rescoring
```

A `rescore_failed` retry reuses the committed Decision, Final Answer, Final Attempt, and idempotency key. It never creates a second Decision or a second `revision_events` row.

## 10. Persistence design

### 10.1 Existing tables remain authoritative

- Draft: initial row in `attempts`
- Suggestion: initial Attempt's row in `ai_feedback`
- Score Before: initial Attempt's row in `scores`
- Final: final row in `attempts`
- Score After: final Attempt's row in `scores`

### 10.2 Phase B adds exactly two tables

`practice_sessions`:

```text
id
user_id
initial_attempt_id
final_attempt_id nullable
practice_day
feedback_mode default D
feedback_shown_at nullable
status
created_at
completed_at nullable
```

`revision_events`:

```text
id
session_id
idempotency_key
action: accepted | rejected | edited
edited_text nullable
created_at
unique(session_id)
```

No additional V2 table is introduced in Phase B. Both tables use RLS so users can only access their own records.

### 10.3 Local Demo data

Demo keeps the complete `TrainingSessionDto` in page memory. It does not write user text to Supabase, browser durable storage, analytics, or an API.

## 11. Delta calculation

Delta is calculated from the two existing score snapshots:

```ts
scoreDelta = scoreAfter.total - scoreBefore.total;

dimensionDelta[dimension] =
  scoreAfter.dimensions[dimension].score
  - scoreBefore.dimensions[dimension].score;
```

The strongest improvement dimension is the largest positive dimension delta. Ties use the fixed rubric order. If every delta is zero or negative, the value is `null`.

Delta is returned in `TrainingSessionDto` and may be calculated on the client or server using the same pure function. It is not stored as an authoritative database value.

## 12. Feedback Mode visibility

Feedback Mode affects frontend rendering only.

| Mode | Visible feedback components |
|---|---|
| A | `TotalScoreCard` only |
| B | Total Score + `ExplainableRubric` + `DiagnosisList` |
| C | Mode B + `SuggestionPanel` |
| D | Mode C + `WhyBetterPanel` |

The backend generates and saves complete Analysis and Coaching output for every mode.

The V2 `RevisionPanel` is outside the feedback component gate:

- A/B: Keep Original (`rejected`) and Edit (`edited`)
- C/D: Accept (`accepted`), Reject (`rejected`), and Edit (`edited`)

`DeltaSummary` is displayed after a completed re-score in every mode.

The Legacy Result route remains unchanged and may continue to display Growth Suggestion. The V2 Session screen follows the visibility matrix above.

## 13. Frontend component boundaries

```text
TrainingSessionScreen
├─ SessionHeader
├─ DraftCard
├─ FeedbackRenderer
│  ├─ TotalScoreCard
│  ├─ ExplainableRubric
│  ├─ DiagnosisList
│  ├─ SuggestionPanel
│  └─ WhyBetterPanel
├─ RevisionPanel
│  ├─ DecisionControls
│  └─ EditAnswerForm
├─ RescoreStatus
└─ DeltaSummary
```

`TrainingSessionController` owns transient UI state and delegates data operations to a gateway implemented by `DemoAdapter` or `LiveAdapter`. Presentation components only receive DTO data and callbacks.

## 14. API design

The existing endpoints remain unchanged:

```http
POST /api/attempts
GET  /api/attempts/:attemptId/result
```

V2 adds:

```http
POST /api/training-sessions
GET  /api/training-sessions/:sessionId
POST /api/training-sessions/:sessionId/revision
GET  /api/training-progress
```

`GET /api/training-progress` is implemented only in Phase E.

### 14.1 Create a Live Session

```http
POST /api/training-sessions
X-Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "initial_attempt_id": "uuid",
  "feedback_mode": "D"
}
```

The initial Attempt must belong to the authenticated user and have a completed score and feedback result. Phase B fixes `feedback_mode` to D. Phase D activates A-D validation and selection.

### 14.2 Submit a Revision

```http
POST /api/training-sessions/:sessionId/revision
X-Idempotency-Key: <uuid>
Content-Type: application/json
```

```json
{
  "action": "edited",
  "edited_text": "Normalized final answer",
  "client_decided_at": "2026-06-23T10:00:00.000Z"
}
```

Success responses use the existing envelope and return `{ session: TrainingSessionDto }`. A duplicate request with the same key and payload returns the current Session. A different second Decision returns `409 REVISION_ALREADY_COMMITTED`.

## 15. Duplicate submission safety

Client protection:

- set `isSubmitting` on the first action
- disable Accept, Reject, Edit, and submit while `isSubmitting` or `status === "rescoring"`
- reuse the same idempotency key for network retries
- reconcile unknown network outcomes with GET Session before enabling another submission

Server protection:

- require `X-Idempotency-Key`
- commit the Decision and session status transition transactionally
- enforce `unique(session_id)` on `revision_events`
- derive the final Attempt idempotency key from Session ID
- return the current Session for an identical replay
- reject a different second Decision with 409

The database uniqueness constraint is the final concurrency guard.

## 16. Error handling

| Condition | Response and UI behavior |
|---|---|
| Invalid Edit | 400; inline message; remain `feedback_ready` |
| Unauthenticated Live request | 401; show login entry |
| Session owned by another user | 403 |
| Missing Session | 404 |
| Different second Decision | 409; reload committed Session |
| Initial AI failure | `initial_failed`; keep existing retry path |
| Re-score AI failure | `rescore_failed`; retain Decision and Final |
| Network outcome unknown | GET Session before retry |

Demo Mode has no authentication, API, OpenAI, Supabase, or network error path.

## 17. Delivery phases

### Phase A: Explainable Feedback

Scope:

- add the TypeScript DTO types required for explainable dimensions and a feedback-ready V2 Session
- map existing Analysis / Coaching result fields into the DTO
- add `ExplainableRubric`
- render the rubric inside the Phase A `feedback_ready` state of `TrainingSessionScreen`
- add unit and component tests
- add a short README status update

Constraints:

- no migration
- no Prompt or Prompt Schema change
- no new model call
- no new AI agent
- no change to the Legacy Result page

### Phase B: Human-AI Revision

- add only `practice_sessions` and `revision_events`
- add `unique(session_id)` to `revision_events`
- add the unified Session APIs and the two adapters
- add Accept / Reject / Edit with shared validation
- create one final Attempt and re-score through the existing pipeline

### Phase C: Delta Tracking

- add the shared pure delta calculation
- compare initial and final score snapshots
- render `DeltaSummary`
- do not add a Delta table or duplicate score truth

### Phase D: Feedback Mode

- activate A-D backend validation
- render the visibility matrix from the complete saved result
- reject `accepted` for A/B
- do not add experiment infrastructure

### Phase E: Learning Dashboard

- aggregate completed normal product sessions
- show score improvement, acceptance rate, strongest improvement dimension, and feedback mode usage
- avoid advanced analytics and statistical testing

## 18. Testing boundaries

Tests cover:

- discriminated-union status invariants
- exact explainable-field provenance
- A-D component visibility
- A/B rejection of `accepted`
- Edit normalization and validation
- disabled actions during `rescoring`
- client and server idempotency
- concurrent submissions producing one revision event
- `unique(session_id)` in the migration
- `rescore_failed` retry reusing the existing Decision
- positive, zero, negative, and tied dimension deltas
- Demo completing the full loop with zero `fetch` calls
- existing Attempt API, AI pipeline, Prompt Schema, and Legacy Result regressions

## 19. Consistency self-review

- [x] `TrainingSessionDto`, `scoreBefore`, `scoreAfter`, `suggestion`, `decision`, `final`, and `delta` use one spelling throughout.
- [x] `sourceMode` is only Demo/Live provenance; `feedbackMode` is only A-D visibility.
- [x] Demo and Live use the same `TrainingSessionScreen` component tree and DTO.
- [x] Phase A has no migration, Prompt change, Prompt Schema change, or new AI call.
- [x] Phase B adds exactly `practice_sessions` and `revision_events`.
- [x] `revision_events` enforces `unique(session_id)`.
- [x] `accepted`, `rejected`, and `edited` have one meaning throughout.
- [x] Modes A/B cannot submit `accepted`.
- [x] Delta is derived and is not a database source of truth.
- [x] `rescore_failed` retry does not create a new Decision.
- [x] The Legacy Result route and DTO remain supported.
- [x] No phase adds a new AI agent.
