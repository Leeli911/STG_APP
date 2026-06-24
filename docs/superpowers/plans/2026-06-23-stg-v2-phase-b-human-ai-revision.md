# STG V2 Phase B Human-AI Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-safe Human-AI Revision loop in which a user accepts, rejects, or edits the existing Coaching suggestion, persists exactly one committed decision, and re-scores the resulting final answer through the unchanged Attempt service and AI pipeline.

**Architecture:** Add exactly two persisted entities, `practice_sessions` and `revision_events`, with an atomic PostgreSQL decision-commit function that also pre-creates the single final Attempt. Expose the workflow through Training Session APIs and one shared frontend gateway contract implemented by an in-memory DemoAdapter and an HTTP LiveAdapter; both render the existing `TrainingSessionScreen` component tree.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase/PostgreSQL with RLS, existing STG Attempt service and AI pipeline, Vitest, Testing Library

---

## 1. Scope boundary

Phase B implements:

- `practice_sessions`
- `revision_events` with `unique(session_id)`
- Training Session create/read/revision APIs
- one committed `accepted | rejected | edited` decision per Session
- shared Edit validation
- final Attempt creation and re-score through the existing Attempt service
- DemoAdapter and LiveAdapter behind one `TrainingSessionGateway`
- Suggestion, revision controls, final-answer state, and re-score status in the V2 screen

Phase B does not implement:

- `DeltaSummary`
- score or dimension delta calculation
- Feedback Mode selection or A-D conditional rendering
- Learning Dashboard or `/api/training-progress`
- Prompt additions or edits
- Prompt Schema edits
- new AI agents
- changes to `apps/web/src/server/ai/pipeline.ts`
- changes to the Legacy Result page
- main-navigation integration

`feedbackMode` is always `"D"` in Phase B. The API does not accept a client-selected mode.

### Phase B DTO bridge

The approved final V2 spec makes `delta` required for `completed`. Phase B deliberately stops one step earlier:

- `completed.scoreAfter` is required because the final Attempt has been scored.
- `completed.delta` remains `null`.
- no component compares Before and After scores.
- Phase C changes `completed.delta` from `null` to the derived Delta DTO and adds `DeltaSummary`.

This is the only staged relaxation of the final DTO contract.

## 2. Files to create or modify

### Create

- `apps/web/src/database/migrations/202606230001_create_human_ai_revision.sql` — the two tables, constraints, indexes, RLS, and two narrow write functions
- `apps/web/src/lib/validation/revision.ts` — shared Accept/Reject/Edit normalization and validation
- `apps/web/src/server/training-sessions/trainingSessionRepository.ts` — Supabase repository and RPC result mapping
- `apps/web/src/server/training-sessions/devTrainingSessionRepository.ts` — development in-memory repository with the same interface
- `apps/web/src/server/training-sessions/trainingSessionService.ts` — Session lifecycle and unchanged Attempt-service orchestration
- `apps/web/src/server/training-sessions/createTrainingSessionApi.ts` — `POST /api/training-sessions` handler
- `apps/web/src/server/training-sessions/getTrainingSessionApi.ts` — `GET /api/training-sessions/:sessionId` handler
- `apps/web/src/server/training-sessions/commitRevisionApi.ts` — `POST /api/training-sessions/:sessionId/revision` handler
- `apps/web/src/app/api/training-sessions/route.ts`
- `apps/web/src/app/api/training-sessions/[sessionId]/route.ts`
- `apps/web/src/app/api/training-sessions/[sessionId]/revision/route.ts`
- `apps/web/src/features/training-session/TrainingSessionGateway.ts` — the adapter interface and request types
- `apps/web/src/features/training-session/DemoAdapter.ts` — page-memory deterministic Session workflow
- `apps/web/src/features/training-session/LiveAdapter.ts` — HTTP implementation
- `apps/web/src/features/training-session/TrainingSessionController.tsx` — transient edit/submission/error state
- `apps/web/src/components/training/SuggestionPanel.tsx`
- `apps/web/src/components/training/RevisionPanel.tsx`
- `apps/web/src/components/training/RescoreStatus.tsx`
- `apps/web/src/tests/module-10-revision-database.test.ts`
- `apps/web/src/tests/module-10-revision-validator.test.ts`
- `apps/web/src/tests/module-10-training-session-service.test.ts`
- `apps/web/src/tests/module-10-training-session-api.test.ts`
- `apps/web/src/tests/module-10-training-session-adapters.test.ts`
- `apps/web/src/tests/module-10-human-ai-revision-ui.test.tsx`

### Modify

- `apps/web/src/server/training-sessions/types.ts` — persisted rows and Phase B Session DTO union
- `apps/web/src/server/training-sessions/trainingSessionDto.ts` — map feedback-ready, rescoring, rescore-failed, and completed states
- `apps/web/src/server/training-sessions/index.ts` — exports
- `apps/web/src/features/training-session/TrainingSessionScreen.tsx` — add suggestion, revision controls, final state, and re-score status
- `apps/web/src/tests/module-3-database.test.ts` — register the new migration in baseline migration checks only if the test enumerates files explicitly
- `README.md` — brief Phase B status and unchanged-pipeline statement

### Must remain unchanged

- `apps/web/src/app/result/[attemptId]/ResultClient.tsx`
- `apps/web/src/server/ai/pipeline.ts`
- `apps/web/src/schemas/ai/index.ts`
- `apps/web/src/prompts/**`
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/server/auth/protected-routes.ts`

No V2 route or navigation link is required for Phase B. An optional direct-only route such as `/v2-demo` may be planned separately after explicit approval; it must not be added as an incidental Phase B step.

## 3. Database migration design

Create `202606230001_create_human_ai_revision.sql` with exactly two new tables.

### 3.1 `practice_sessions`

```sql
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  initial_attempt_id uuid not null references public.attempts(id) on delete cascade,
  final_attempt_id uuid references public.attempts(id) on delete set null,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  practice_day integer not null check (practice_day between 1 and 7),
  feedback_mode text not null default 'D' check (feedback_mode = 'D'),
  feedback_shown_at timestamp with time zone,
  status text not null default 'feedback_ready' check (
    status in ('feedback_ready', 'rescoring', 'rescore_failed', 'completed')
  ),
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  constraint practice_sessions_initial_attempt_unique unique (initial_attempt_id),
  constraint practice_sessions_final_attempt_unique unique (final_attempt_id),
  constraint practice_sessions_user_idempotency_unique unique (user_id, idempotency_key)
);
```

The initial Attempt remains the Draft/Before source of truth. The final Attempt remains the Final/After source of truth. The Session stores references, not duplicate answers or scores.

### 3.2 `revision_events`

```sql
create table if not exists public.revision_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  action text not null check (action in ('accepted', 'rejected', 'edited')),
  edited_text text,
  client_decided_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  constraint revision_events_session_unique unique (session_id),
  constraint revision_events_edit_shape_check check (
    (action = 'edited' and edited_text is not null and length(trim(edited_text)) > 0)
    or
    (action in ('accepted', 'rejected') and edited_text is null)
  )
);
```

`unique(session_id)` is the final database guarantee that a Session has only one committed Decision. `revision_events` is append-only: no update or delete policy is created.

### 3.3 Indexes

```sql
create index if not exists practice_sessions_user_created_idx
  on public.practice_sessions(user_id, created_at desc);

create index if not exists practice_sessions_status_idx
  on public.practice_sessions(status);
```

The explicit Session indexes support ownership/history and state reads. Do not create a separate `revision_events(session_id)` index because `revision_events_session_unique` already creates the required unique index.

### 3.4 Atomic `commit_revision_event` function

The migration also creates a function, not a third table:

```sql
public.commit_revision_event(
  p_session_id uuid,
  p_idempotency_key text,
  p_action text,
  p_edited_text text,
  p_client_decided_at timestamp with time zone
) returns jsonb
```

The function runs in one transaction and must:

1. Require `auth.uid()`.
2. Lock the owned `practice_sessions` row with `for update`.
3. Read any existing `revision_events` row.
4. Return `{"outcome":"replayed"}` only when Session ID, idempotency key, action, and normalized edited text all match.
5. Return `{"outcome":"conflict"}` for every other existing Decision.
6. Require Session status `feedback_ready`, except that an identical `rescore_failed` replay changes status back to `rescoring` and returns `{"outcome":"retry_claimed"}`.
7. Resolve final text exactly as:
   - `accepted`: `ai_feedback.rewrite->>'text'`
   - `rejected`: `attempts.original_answer`
   - `edited`: trimmed `p_edited_text`
8. Pre-create one `attempts` row with:
   - the initial Attempt's `user_id` and `question_id`
   - resolved final text as `original_answer`
   - `status = 'submitted'`
   - `idempotency_key = 'revision:' || p_session_id::text`
   - `client_started_at = p_client_decided_at`
9. Insert one `revision_events` row.
10. Set `practice_sessions.final_attempt_id` and `status = 'rescoring'`.
11. Return `outcome`, `revision_event_id`, and `final_attempt_id`.

The function must be `security definer`, set a fixed search path, check ownership explicitly, revoke execution from `public`, and grant execution only to `authenticated`.

### 3.5 `set_revision_rescore_outcome` function

Create a second narrow function:

```sql
public.set_revision_rescore_outcome(
  p_session_id uuid,
  p_status text
) returns void
```

It accepts only `completed` or `rescore_failed`, requires ownership, locks the Session, verifies the final Attempt belongs to the same user, and verifies:

- `completed` only when final Attempt status is `completed`
- `rescore_failed` only when final Attempt status is `failed`

For `completed`, set `completed_at = now()`. For `rescore_failed`, keep `completed_at = null`.

## 4. RLS policy design

Enable RLS on both tables.

### `practice_sessions`

- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id` and the initial Attempt exists, belongs to `auth.uid()`, and is `completed`
- no direct UPDATE policy; state mutation goes through the two narrow database functions
- no DELETE policy

```sql
create policy "Users can read own practice sessions"
  on public.practice_sessions for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can create own practice sessions"
  on public.practice_sessions for insert to authenticated
  with check (
    auth.uid() = user_id
    and feedback_mode = 'D'
    and exists (
      select 1 from public.attempts
      where attempts.id = initial_attempt_id
        and attempts.user_id = auth.uid()
        and attempts.status = 'completed'
    )
  );
```

### `revision_events`

- SELECT: the parent Session belongs to `auth.uid()`
- no direct INSERT/UPDATE/DELETE policy; the atomic function is the only write path

```sql
create policy "Users can read own revision events"
  on public.revision_events for select to authenticated
  using (
    exists (
      select 1 from public.practice_sessions
      where practice_sessions.id = revision_events.session_id
        and practice_sessions.user_id = auth.uid()
    )
  );
```

Tests must verify that one user cannot read, create, or mutate another user's Session or Decision.

## 5. API endpoints and contracts

All responses use the existing `jsonSuccess` / `jsonError` envelope.

### 5.1 Create Session

```http
POST /api/training-sessions
X-Idempotency-Key: <non-empty key>
Content-Type: application/json
```

```json
{
  "initial_attempt_id": "uuid"
}
```

Phase B rejects a `feedback_mode` property rather than silently accepting it. The server always writes and returns `feedbackMode: "D"`.

Responses:

- `201`: first Session creation
- `200`: same key and same initial Attempt replay, or same initial Attempt found through the unique constraint
- `400 VALIDATION_ERROR`: invalid JSON, UUID, missing idempotency header, or unexpected `feedback_mode`
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`: initial Attempt belongs to another user
- `404 NOT_FOUND`: Attempt/result is missing
- `409 IDEMPOTENCY_KEY_REUSED`: same key with different initial Attempt

Success:

```json
{
  "ok": true,
  "data": { "session": "FeedbackReadyTrainingSessionDto" },
  "meta": { "request_id": "uuid" }
}
```

### 5.2 Get Session

```http
GET /api/training-sessions/:sessionId
```

Responses:

- `200`: current Phase B `TrainingSessionDto`
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`: do not reveal another user's Session contents
- `404 NOT_FOUND`

### 5.3 Commit Revision and Re-score

```http
POST /api/training-sessions/:sessionId/revision
X-Idempotency-Key: <non-empty key>
Content-Type: application/json
```

Accepted/rejected request:

```json
{
  "action": "accepted",
  "edited_text": null,
  "client_decided_at": "2026-06-23T10:00:00.000Z"
}
```

Edited request:

```json
{
  "action": "edited",
  "edited_text": "Trimmed final answer",
  "client_decided_at": "2026-06-23T10:00:00.000Z"
}
```

Responses:

- `200`: first request completed re-score, completed replay, or successful retry from `rescore_failed`
- `202`: identical replay while the first request is still `rescoring`
- `400 VALIDATION_ERROR`: malformed action, invalid Edit, or non-null `edited_text` for accepted/rejected
- `401 UNAUTHENTICATED`
- `403 FORBIDDEN`
- `404 NOT_FOUND`
- `409 REVISION_ALREADY_COMMITTED`: any second Decision that does not match the committed idempotency key and payload
- `502 RESCORE_FAILED`: Decision and final Attempt are retained; details contain `session_id`, and GET returns `rescore_failed`

The response never includes Delta fields beyond `delta: null`.

## 6. Server types and service functions

### 6.1 Persisted types

Add to `server/training-sessions/types.ts`:

```ts
export type RevisionAction = "accepted" | "rejected" | "edited";
export type PracticeSessionStatus =
  | "feedback_ready"
  | "rescoring"
  | "rescore_failed"
  | "completed";

export type PracticeSessionRow = {
  id: string;
  user_id: string;
  initial_attempt_id: string;
  final_attempt_id: string | null;
  idempotency_key: string;
  practice_day: number;
  feedback_mode: "D";
  feedback_shown_at: string | null;
  status: PracticeSessionStatus;
  created_at: string;
  completed_at: string | null;
};

export type RevisionEventRow = {
  id: string;
  session_id: string;
  idempotency_key: string;
  action: RevisionAction;
  edited_text: string | null;
  client_decided_at: string | null;
  created_at: string;
};
```

### 6.2 Phase B DTO union

Keep the existing `FeedbackReadyTrainingSessionDto` and add:

```ts
type PhaseBDecisionDto = {
  action: RevisionAction;
  editedText: string | null;
  decidedAt: string;
  idempotencyKey: string;
};

type PhaseBFinalDto = {
  text: string;
  attemptId: string;
  submittedAt: string;
};

type RescoringTrainingSessionDto = SharedFeedbackSession & {
  status: "rescoring";
  decision: PhaseBDecisionDto;
  final: PhaseBFinalDto;
  scoreAfter: null;
  delta: null;
};

type RescoreFailedTrainingSessionDto = SharedFeedbackSession & {
  status: "rescore_failed";
  decision: PhaseBDecisionDto;
  final: PhaseBFinalDto;
  scoreAfter: null;
  delta: null;
};

type CompletedTrainingSessionDto = SharedFeedbackSession & {
  status: "completed";
  decision: PhaseBDecisionDto;
  final: PhaseBFinalDto;
  scoreAfter: ScoreSnapshotDto;
  delta: null;
};

export type TrainingSessionDto =
  | FeedbackReadyTrainingSessionDto
  | RescoringTrainingSessionDto
  | RescoreFailedTrainingSessionDto
  | CompletedTrainingSessionDto;
```

`SharedFeedbackSession` contains one consistent spelling of `sourceMode`, `feedbackMode`, `practiceDay`, `draft`, `diagnosis`, `suggestion`, `scoreBefore`, and `feedbackShownAt`.

### 6.3 Repository interface

```ts
export type TrainingSessionRepository = {
  findById(userId: string, sessionId: string): Promise<PracticeSessionRow | null>;
  findByInitialAttemptId(
    userId: string,
    initialAttemptId: string
  ): Promise<PracticeSessionRow | null>;
  findByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<PracticeSessionRow | null>;
  create(input: CreatePracticeSessionInput): Promise<PracticeSessionRow>;
  findRevision(sessionId: string): Promise<RevisionEventRow | null>;
  commitRevision(input: CommitRevisionRepositoryInput): Promise<CommitOutcome>;
  setRescoreOutcome(
    sessionId: string,
    status: "completed" | "rescore_failed"
  ): Promise<void>;
};
```

`CommitOutcome` is `committed | replayed | retry_claimed | conflict | not_found` and includes IDs when present.

### 6.4 Service interface

```ts
export type TrainingSessionService = {
  createSession(input: CreateTrainingSessionInput): Promise<TrainingSessionDto>;
  getSession(userId: string, sessionId: string): Promise<TrainingSessionDto>;
  commitRevision(
    input: CommitRevisionInput
  ): Promise<{ session: TrainingSessionDto; httpStatus: 200 | 202 }>;
};
```

Implement these internal functions with single responsibilities:

- `validateCreateSessionInput` — UUID and idempotency header
- `loadOwnedInitialAttemptContext` — Attempt + score + feedback ownership/readiness
- `createSession` writes `feedback_shown_at = now()` immediately before returning the feedback-ready DTO; adapters must call it only when they are ready to render feedback
- `validateCommitRevisionInput` — action, ISO timestamp, shared Edit validator
- `resolveFinalAnswer` — exact accepted/rejected/edited semantics
- `runFinalAttempt` — call `createAttemptService(...).submitAttempt` with the pre-created Attempt's derived idempotency key and a `currentDayResolver` fixed to `session.practice_day`
- `loadTrainingSessionContext` — Session, revision, initial Attempt/score/feedback, and optional final Attempt/score/feedback
- `toTrainingSessionDto` — map repository context into the Phase B union

Do not import or call `runAiCoachPipeline` from the Training Session service. The service must reach it only through the existing `createAttemptService().submitAttempt` path.

## 7. Idempotency design

### Session creation

- require `X-Idempotency-Key`
- same user + same key + same initial Attempt: return current Session
- same user + same key + different initial Attempt: `409 IDEMPOTENCY_KEY_REUSED`
- same initial Attempt under a different key: return the existing Session because `initial_attempt_id` is unique

### Revision commitment

- the client creates one idempotency key when the user confirms a Decision
- retries reuse that key
- atomic function compares Session ID, key, action, and normalized edited text
- same key + same payload:
  - `completed`: return current Session, no pipeline call
  - `rescoring`: return current Session with 202, no second pipeline call
  - `rescore_failed`: atomically claim retry, reuse final Attempt, run pipeline again
- any different key or payload after a Decision exists: `409 REVISION_ALREADY_COMMITTED`
- `unique(session_id)` prevents concurrent double insert even if application checks race
- final Attempt key is deterministic: `revision:<sessionId>`

The mapper includes the committed Revision Event's opaque `idempotencyKey` in `decision`. This value is not a credential. It lets a refreshed `rescore_failed` screen retry the same Decision without inventing a new key.

The `rescore_failed` path must never insert a second `revision_events` row or create a second final Attempt.

## 8. Shared Edit validator design

Create `lib/validation/revision.ts`:

```ts
export type RevisionValidationInput = {
  action: unknown;
  editedText: unknown;
  draftText: string;
  suggestionText: string;
};

export type RevisionValidationResult =
  | {
      ok: true;
      action: "accepted" | "rejected" | "edited";
      editedText: string | null;
      finalText: string;
    }
  | {
      ok: false;
      field: "action" | "edited_text";
      message: string;
    };
```

Rules:

- accepted → `editedText = null`, `finalText = suggestionText`
- rejected → `editedText = null`, `finalText = draftText`
- edited → trim the value and require:
  - non-empty
  - different from trimmed Draft
  - different from trimmed Suggestion
  - `validateMinimumAnswer` success
  - length at most `MAX_ANSWER_LENGTH` (6000)
- accepted/rejected with non-null `edited_text` are invalid
- equality is exact, case-sensitive equality after trimming; do not introduce case-folding or semantic similarity

The RevisionPanel uses this function before calling its gateway. The API service runs the same function again before persistence.

## 9. DemoAdapter design

`DemoAdapter` implements the same `TrainingSessionGateway` as LiveAdapter and stores data in one closure/React-lifetime memory object. It must not call `fetch`, Supabase, localStorage, or sessionStorage.

```ts
export type TrainingSessionGateway = {
  createSession(input: {
    initialAttemptId: string;
    idempotencyKey: string;
  }): Promise<TrainingSessionDto>;
  getSession(sessionId: string): Promise<TrainingSessionDto>;
  commitRevision(input: {
    sessionId: string;
    idempotencyKey: string;
    action: RevisionAction;
    editedText: string | null;
    clientDecidedAt: string;
  }): Promise<TrainingSessionDto>;
};
```

Demo behavior:

- initialize from deterministic Phase A-shaped Attempt/score/feedback fixtures
- force `sourceMode: "demo"` and `feedbackMode: "D"`
- accepted final text equals suggestion exactly
- rejected final text equals Draft exactly
- edited final text equals normalized Edit exactly
- commit one in-memory Decision; an identical replay returns current state
- a different replay throws `REVISION_ALREADY_COMMITTED`
- transition `feedback_ready → rescoring → completed`
- provide a deterministic `scoreAfter` fixture and `delta: null`
- support a test-only constructor option that causes the first re-score to become `rescore_failed`; a same-key retry reuses the Decision and becomes completed
- refreshing/unmounting the page creates a new adapter and clears all user input

The test-only failure option is constructor dependency injection, not a production UI control.

## 10. LiveAdapter design

`LiveAdapter` uses only the three Training Session endpoints:

```ts
createSession(input)      → POST /api/training-sessions
getSession(sessionId)     → GET /api/training-sessions/:sessionId
commitRevision(input)     → POST /api/training-sessions/:sessionId/revision
```

It must:

- send `X-Idempotency-Key` on both POST operations
- preserve the same revision key for retries
- parse the existing success/error envelope
- map `409 REVISION_ALREADY_COMMITTED` to a typed gateway error
- on network uncertainty, call `getSession` before allowing another Decision
- on `502 RESCORE_FAILED`, load the Session and surface its `rescore_failed` status
- for a `rescore_failed` retry after refresh, reuse `session.decision.idempotencyKey`
- never call OpenAI or Supabase directly from the browser

## 11. Frontend component changes

### `SuggestionPanel`

Render `session.suggestion.structureUsed` and `session.suggestion.text`. Do not render or gate Feedback Mode variants in Phase B.

### `RevisionPanel`

Props:

```ts
type RevisionPanelProps = {
  draftText: string;
  suggestionText: string;
  disabled: boolean;
  error: string | null;
  onSubmit(input: {
    action: RevisionAction;
    editedText: string | null;
  }): void;
};
```

Behavior:

- show Accept, Reject, and Edit because Phase B is fixed to D
- selecting Edit opens a textarea with 6000-character counter
- validate locally before `onSubmit`
- invalid Edit shows a normal inline message and makes no gateway call
- after submit begins, disable every Decision button and textarea
- labels use product language, not research terminology

### `RescoreStatus`

- `rescoring`: “Re-scoring your final answer…”
- `rescore_failed`: show “Retry scoring” that resubmits the same committed key/payload
- `completed`: show the Final Answer and “Re-score complete” only
- do not display Before/After comparison or Delta

### `TrainingSessionController`

- owns `isSubmitting`, edit text, validation message, and the single revision idempotency key
- calls the injected gateway
- replaces Session state with every gateway response
- keeps controls disabled for local `isSubmitting` or DTO `status === "rescoring"`
- reconciles a network error through `gateway.getSession`
- restores the retry key from `session.decision.idempotencyKey` after reload

### `TrainingSessionScreen`

Widen props from `FeedbackReadyTrainingSessionDto` to the Phase B `TrainingSessionDto`. Continue to render the Phase A total and `ExplainableRubric`, then add Suggestion, Revision, and Rescore sections according to status. Do not import either adapter into presentation components.

## 12. Status transitions

### Live

```text
completed initial Attempt
→ POST training-sessions
→ feedback_ready
→ atomic Decision + final Attempt creation
→ rescoring
→ completed
```

Failure/retry:

```text
rescoring
→ final Attempt failed
→ rescore_failed
→ same key + same payload retry_claimed
→ rescoring
→ completed
```

Conflicts:

```text
any committed Decision
+ different key or payload
→ 409 REVISION_ALREADY_COMMITTED
```

### Demo

```text
feedback_ready → rescoring → completed
```

The adapter may resolve the deterministic re-score on the next microtask so tests can observe disabled controls. It must not use arbitrary wall-clock sleeps.

## 13. Error handling

| Error | Server behavior | Frontend behavior |
|---|---|---|
| Invalid Edit | 400, no DB writes | inline message, remain feedback-ready |
| Missing idempotency key | 400 | non-destructive retry prompt |
| Unauthenticated | 401 | show login entry in Live context |
| Wrong owner | 403 | generic access message; do not reveal data |
| Session/Attempt missing | 404 | recovery link to existing workflow |
| Session create key reused with different Attempt | 409 `IDEMPOTENCY_KEY_REUSED` | reload current Attempt state |
| Different second Decision | 409 `REVISION_ALREADY_COMMITTED` | GET current Session and show committed Decision |
| AI re-score failure | mark final Attempt failed and Session `rescore_failed`; return 502 | show Retry Scoring; preserve Decision and Final |
| Network outcome unknown | no blind retry | GET Session first; reuse same key only if retry is valid |
| Historical rubric missing | existing neutral Phase A empty state | no invented evidence |

Do not include raw Supabase or OpenAI error messages in API responses.

## 14. Test plan

### Migration and RLS

- exactly two `create table` statements for the Phase B entities
- `revision_events_session_unique unique (session_id)` exists
- feedback mode defaults to and is constrained to D
- action/Edit shape check exists
- RLS enabled for both tables
- own-row SELECT policies exist
- no direct revision UPDATE/DELETE policy
- function execution revoked from public and granted to authenticated
- functions check `auth.uid()` and Session ownership
- no migration modifies existing Prompt, score, feedback, or pipeline contracts

### Validator

- accepted returns suggestion text and null edit
- rejected returns Draft text and null edit
- edited returns trimmed edited text
- empty Edit rejected
- Edit equal to trimmed Draft rejected
- Edit equal to trimmed Suggestion rejected
- Edit above 6000 rejected
- Edit below existing minimum-answer threshold rejected
- accepted/rejected with edited text rejected

### Service and repository

- create Session only from owned completed initial Attempt
- Session creation fixed to D
- same create key/body returns existing Session
- reused create key/different Attempt conflicts
- accepted/rejected/edited resolve exact final text
- one final Attempt uses `revision:<sessionId>`
- Training Session service reaches AI only through `createAttemptService().submitAttempt`
- same revision key/payload while rescoring returns 202
- same revision key/payload after completed returns current Session
- different second Decision returns 409
- AI failure marks `rescore_failed`
- retry from `rescore_failed` reuses Revision Event and final Attempt
- repository creation counters remain one after retry

### APIs

- auth, UUID, JSON, idempotency header, ownership, not-found, conflict, and 502 envelopes
- response uses `{ data: { session }, meta: { request_id } }`
- POST create rejects client `feedback_mode`
- revision route never accepts A/B/C modes

### Adapters

- DemoAdapter makes zero `fetch` calls
- LiveAdapter calls only Training Session endpoints
- both satisfy the same TypeScript interface
- Demo accepted/rejected/edited semantics match Live service
- Demo identical replay succeeds and different replay conflicts
- Demo failure retry creates no second Decision

### UI

- Suggestion displayed before Decisions
- Accept/Reject/Edit visible in Phase B
- invalid Edit makes no gateway call
- Edit counter and 6000 limit shown
- all controls disabled while submitting/rescoring
- rescore_failed retry reuses the same key
- a refreshed rescore_failed Session exposes the committed key needed for safe retry
- completed shows Final Answer but no DeltaSummary
- Legacy Result tests remain unchanged and passing

### Full regression

```bash
npm test
npm run build
```

Expected: zero failing tests and a successful production build.

## 15. Step-by-step implementation tasks

### Task 1: Migration contract and RLS

**Files:**
- Create: `apps/web/src/tests/module-10-revision-database.test.ts`
- Create: `apps/web/src/database/migrations/202606230001_create_human_ai_revision.sql`

- [ ] **Step 1: Write failing migration tests**

Read the migration text and assert the two tables, `unique(session_id)`, fixed D check, RLS, policies, function signatures, ownership checks, and grants. Also assert the file contains exactly two matches for `create table if not exists public.`.

- [ ] **Step 2: Run RED**

```bash
npm --workspace apps/web test -- module-10-revision-database
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add the migration**

Implement the SQL in Sections 3 and 4, including `commit_revision_event` and `set_revision_rescore_outcome`. Return typed JSON outcomes rather than parsing exception strings for expected replay/conflict states.

- [ ] **Step 4: Run GREEN**

Run the focused migration tests. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/database/migrations/202606230001_create_human_ai_revision.sql apps/web/src/tests/module-10-revision-database.test.ts
git commit -m "feat: add revision session persistence"
```

### Task 2: Shared revision validator

**Files:**
- Create: `apps/web/src/tests/module-10-revision-validator.test.ts`
- Create: `apps/web/src/lib/validation/revision.ts`

- [ ] **Step 1: Write one failing test per rule**

Use the cases in Section 14. Assert returned `finalText`, normalized `editedText`, field name, and user-safe message.

- [ ] **Step 2: Run RED**

```bash
npm --workspace apps/web test -- module-10-revision-validator
```

Expected: FAIL because `revision.ts` does not exist.

- [ ] **Step 3: Implement the validator**

Use `validateMinimumAnswer`, `MAX_ANSWER_LENGTH`, exact trimmed comparisons, and the action semantics in Section 8. Do not add fuzzy comparison or model calls.

- [ ] **Step 4: Run GREEN**

Expected: all validator cases PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/validation/revision.ts apps/web/src/tests/module-10-revision-validator.test.ts
git commit -m "feat: validate revision decisions"
```

### Task 3: Phase B DTO union and mapper

**Files:**
- Modify: `apps/web/src/server/training-sessions/types.ts`
- Modify: `apps/web/src/server/training-sessions/trainingSessionDto.ts`
- Modify: `apps/web/src/server/training-sessions/index.ts`
- Create: `apps/web/src/tests/module-10-training-session-service.test.ts`

- [ ] **Step 1: Write failing DTO mapper tests**

Cover `feedback_ready`, `rescoring`, `rescore_failed`, and `completed`. Assert `sourceMode`, fixed `feedbackMode: "D"`, Decision/Final availability, the committed `decision.idempotencyKey`, `scoreAfter`, and `delta: null`.

- [ ] **Step 2: Run RED**

```bash
npm --workspace apps/web test -- module-10-training-session-service
```

Expected: FAIL because Phase B row types and mapper variants do not exist.

- [ ] **Step 3: Add types and mapper variants**

Implement Sections 6.1 and 6.2. Refactor the Phase A score mapping into a reusable function without changing its field provenance.

- [ ] **Step 4: Run GREEN**

Expected: DTO mapper tests PASS and Module 9 remains passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/training-sessions apps/web/src/tests/module-10-training-session-service.test.ts
git commit -m "feat: model revision session states"
```

### Task 4: Training Session repositories

**Files:**
- Create: `apps/web/src/server/training-sessions/trainingSessionRepository.ts`
- Create: `apps/web/src/server/training-sessions/devTrainingSessionRepository.ts`
- Modify: `apps/web/src/tests/module-10-training-session-service.test.ts`

- [ ] **Step 1: Add failing repository contract tests**

Test create/read, initial-Attempt uniqueness, create idempotency lookup, atomic commit outcomes, one revision count, and outcome updates for both Supabase-shaped and development repositories.

- [ ] **Step 2: Run RED**

Expected: repository imports are missing.

- [ ] **Step 3: Implement repositories**

Implement the interface in Section 6.3. The Supabase repository calls the two database functions; the dev repository performs equivalent mutations in one synchronous critical section and enforces one Event per Session.

- [ ] **Step 4: Run GREEN**

Expected: repository contract tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/training-sessions apps/web/src/tests/module-10-training-session-service.test.ts
git commit -m "feat: add training session repositories"
```

### Task 5: Training Session service and final re-score

**Files:**
- Create: `apps/web/src/server/training-sessions/trainingSessionService.ts`
- Modify: `apps/web/src/server/training-sessions/index.ts`
- Modify: `apps/web/src/tests/module-10-training-session-service.test.ts`

- [ ] **Step 1: Add failing service behavior tests**

Cover create ownership/readiness/idempotency, the three exact final-text semantics, 202 replay during rescoring, 409 different Decision, AI failure, and successful `rescore_failed` retry with one Event and one final Attempt.

- [ ] **Step 2: Run RED**

Expected: service factory is missing.

- [ ] **Step 3: Implement service**

Implement Section 6.4. Inject `AttemptRepository` and an Attempt-service factory so tests can count submissions. Use `currentDayResolver: async () => session.practice_day` for revision re-score. Never import `runAiCoachPipeline` directly.

- [ ] **Step 4: Run GREEN**

Expected: all service cases PASS; counters prove one Decision and one final Attempt.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/training-sessions apps/web/src/tests/module-10-training-session-service.test.ts
git commit -m "feat: orchestrate revision rescoring"
```

### Task 6: Training Session API handlers and routes

**Files:**
- Create: `apps/web/src/server/training-sessions/createTrainingSessionApi.ts`
- Create: `apps/web/src/server/training-sessions/getTrainingSessionApi.ts`
- Create: `apps/web/src/server/training-sessions/commitRevisionApi.ts`
- Create: `apps/web/src/app/api/training-sessions/route.ts`
- Create: `apps/web/src/app/api/training-sessions/[sessionId]/route.ts`
- Create: `apps/web/src/app/api/training-sessions/[sessionId]/revision/route.ts`
- Create: `apps/web/src/tests/module-10-training-session-api.test.ts`

- [ ] **Step 1: Write failing API contract tests**

Cover every status and error code in Section 5, including rejecting `feedback_mode`, 202 replay, 409 different Decision, and 502 with retained Session ID.

- [ ] **Step 2: Run RED**

```bash
npm --workspace apps/web test -- module-10-training-session-api
```

Expected: handler modules are missing.

- [ ] **Step 3: Implement handlers and thin routes**

Follow the existing Attempt API dependency-injection and `jsonSuccess`/`jsonError` patterns. Routes choose Supabase or the development repository using the same auth fallback pattern as `api/attempts`.

- [ ] **Step 4: Run GREEN**

Expected: API contract tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/training-sessions apps/web/src/server/training-sessions apps/web/src/tests/module-10-training-session-api.test.ts
git commit -m "feat: add training session APIs"
```

### Task 7: Shared gateway, DemoAdapter, and LiveAdapter

**Files:**
- Create: `apps/web/src/features/training-session/TrainingSessionGateway.ts`
- Create: `apps/web/src/features/training-session/DemoAdapter.ts`
- Create: `apps/web/src/features/training-session/LiveAdapter.ts`
- Create: `apps/web/src/tests/module-10-training-session-adapters.test.ts`

- [ ] **Step 1: Write failing shared-contract tests**

Run the same accepted/rejected/edited and idempotency cases against DemoAdapter and a LiveAdapter with a fake fetch transport. Assert Demo makes zero global fetch calls.

- [ ] **Step 2: Run RED**

```bash
npm --workspace apps/web test -- module-10-training-session-adapters
```

Expected: adapters are missing.

- [ ] **Step 3: Implement the gateway and adapters**

Use the interface and behaviors in Sections 9 and 10. Keep Demo state in memory. Do not branch the component tree by adapter type.

- [ ] **Step 4: Run GREEN**

Expected: adapter contract tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/training-session apps/web/src/tests/module-10-training-session-adapters.test.ts
git commit -m "feat: add demo and live revision adapters"
```

### Task 8: Revision UI and controller

**Files:**
- Create: `apps/web/src/components/training/SuggestionPanel.tsx`
- Create: `apps/web/src/components/training/RevisionPanel.tsx`
- Create: `apps/web/src/components/training/RescoreStatus.tsx`
- Create: `apps/web/src/features/training-session/TrainingSessionController.tsx`
- Modify: `apps/web/src/features/training-session/TrainingSessionScreen.tsx`
- Create: `apps/web/src/tests/module-10-human-ai-revision-ui.test.tsx`

- [ ] **Step 1: Write failing component tests**

Cover suggestion rendering, all three controls, Edit validation without gateway calls, disabled state, exact submitted payloads, rescore-failed retry with the same key, Final Answer rendering, and absence of DeltaSummary.

- [ ] **Step 2: Run RED**

```bash
npm --workspace apps/web test -- module-10-human-ai-revision-ui
```

Expected: new UI modules are missing.

- [ ] **Step 3: Implement focused components and controller**

Use the props and behavior in Section 11. Keep business validation in the shared validator. Keep adapter selection outside presentation components.

- [ ] **Step 4: Run GREEN**

Expected: Phase B UI tests PASS and Module 9 remains passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/training apps/web/src/features/training-session apps/web/src/tests/module-10-human-ai-revision-ui.test.tsx
git commit -m "feat: add human AI revision controls"
```

### Task 9: Documentation, scope audit, and full verification

**Files:**
- Modify: `README.md`
- Verify unchanged: `apps/web/src/app/result/[attemptId]/ResultClient.tsx`
- Verify unchanged: `apps/web/src/server/ai/pipeline.ts`
- Verify unchanged: `apps/web/src/schemas/ai/index.ts`
- Verify unchanged: `apps/web/src/prompts/**`
- Verify unchanged: `apps/web/src/components/layout/AppShell.tsx`

- [ ] **Step 1: Add a concise Phase B README note**

State that Phase B adds one committed revision decision and reuses the unchanged Attempt/AI pipeline. State that Delta, Feedback Modes, Dashboard, and main-nav integration remain deferred.

- [ ] **Step 2: Run focused Phase B tests**

```bash
npm --workspace apps/web test -- module-10
```

Expected: all Module 10 tests PASS.

- [ ] **Step 3: Run full regression tests**

```bash
npm test
```

Expected: 0 failed tests, including Module 7 Legacy Result, Module 8 pipeline, and Module 9 explainable feedback.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 5: Audit changed files**

```bash
git diff --name-only codex/stg-v2-phase-a...HEAD
git diff --exit-code codex/stg-v2-phase-a...HEAD -- \
  apps/web/src/app/result/'[attemptId]'/ResultClient.tsx \
  apps/web/src/server/ai/pipeline.ts \
  apps/web/src/schemas/ai \
  apps/web/src/prompts \
  apps/web/src/components/layout/AppShell.tsx \
  apps/web/src/server/auth/protected-routes.ts
```

Expected: the first command contains only the Phase B file map; the second exits 0 with no output.

- [ ] **Step 6: Commit documentation**

```bash
git add README.md
git commit -m "docs: record human AI revision phase"
```

## 16. Rollback risks

### Database rollback

- Dropping `revision_events` and `practice_sessions` destroys committed revision behavior; never down-migrate after collecting real sessions without an export.
- Drop `commit_revision_event` and `set_revision_rescore_outcome` before dropping tables.
- The migration does not alter Prompt, score, feedback, or pipeline tables, so rollback is isolated to Phase B entities and functions.
- Final Attempts are normal `attempts` rows. Rolling back Phase B tables must not delete those Attempts automatically; export Session-to-Attempt links before rollback if auditability matters.

### Idempotency and partial failure

- A process crash after the database marks `rescoring` but before the pipeline starts can leave a Session temporarily stuck. Phase B does not add a background job or lease system. Operational recovery is a controlled same-key replay after confirming the final Attempt is still `submitted`; document this runbook before production exposure.
- Never “fix” a stuck Session by deleting its Revision Event. The one-Decision invariant must remain intact.
- Changing the revision key format after release can create duplicate final Attempts; keep `revision:<sessionId>` stable.

### Security-definer functions

- An incorrect ownership check could bypass RLS. Tests must exercise two users and function grants.
- Use fully qualified table references and a fixed search path.
- Do not grant function execution to `anon` or `public`.

### DTO compatibility

- Phase B's `completed.delta = null` is intentionally temporary. Phase C must update types, mapper, and tests together.
- The legacy `AttemptResultDto.attempt.feedbackMode?: "mock" | "live"` remains unrelated to V2 `feedbackMode: "D"`.
- Demo and Live must continue to satisfy the same gateway and DTO contracts.

### Product scope

- Do not add a V2 navigation link in Phase B.
- Do not implement the optional direct demo route without separate approval.
- Do not expose “experiment,” “research participant,” or A/B terminology in the UI.

## 17. Plan self-review

- [x] Only `practice_sessions` and `revision_events` are added as tables.
- [x] `revision_events` has `unique(session_id)` and no mutable policy.
- [x] Same key + same payload returns current state; every different second Decision returns 409.
- [x] `rescore_failed` retry reuses the Decision, Revision Event, final Attempt, and key.
- [x] `accepted`, `rejected`, and `edited` resolve to the approved exact final text.
- [x] Phase B is fixed to Feedback Mode D and implements no mode selector/gating.
- [x] DemoAdapter and LiveAdapter share one gateway, DTO, and component tree.
- [x] Delta calculation and DeltaSummary are absent.
- [x] Learning Dashboard and `/api/training-progress` are absent.
- [x] No Prompt, Prompt Schema, AI Agent, AI Pipeline, Legacy Result, main-nav, or protected-route change is planned.
- [x] Every implementation task follows test-first RED/GREEN steps and has an exact verification command.
