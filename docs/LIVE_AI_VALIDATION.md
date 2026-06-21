# STG Live AI Validation

This checklist validates the real OpenAI 2-Call Pipeline and its Supabase
persistence without exposing API keys, full answers, or full rewrites.

## Required Environment Variables

Create `apps/web/.env.local` locally. Do not commit it.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY

STG_AI_MODE=live
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
```

`STG_AI_MODE=live` is mandatory for the smoke test. The command exits before
execution if the mode is absent, set to `mock`, or `OPENAI_API_KEY` is absent.

## Apply Database Migrations

Apply the migrations in filename order to the same Supabase project configured
in `.env.local`:

1. `apps/web/src/database/migrations/202606180001_create_training_core.sql`
2. `apps/web/src/database/migrations/202606190001_add_attempt_idempotency.sql`
3. `apps/web/src/database/migrations/202606190002_create_mock_result_tables.sql`
4. `apps/web/src/database/migrations/202606190003_add_real_ai_pipeline_metadata.sql`

For a linked Supabase CLI project, run from the repository root:

```bash
supabase db push
```

Otherwise, apply each file once through the Supabase SQL Editor. Confirm that
`attempts`, `scores`, and `ai_feedback` contain the Module 8 columns before a
live submission.

## Run One Live Golden Case

The smoke runner uses `case-01` by default and prints a real-cost warning before
calling OpenAI:

```bash
npm run test:live-smoke
```

Select one case explicitly:

```bash
npm run test:live-smoke -- --case case-01
```

The safe summary contains only the case id, stage success flags, JSON validation
result, repair count, score, latency, fact-guard result, and final status. It
does not print the API key or the full Golden Case answer.

Multiple cases require an explicit opt-in and are limited to three:

```bash
npm run test:live-smoke -- \
  --case case-01 \
  --case case-02 \
  --allow-multiple
```

`--all` is disabled. A run above three cases is rejected before any API call.

## Run the Web End-to-End Check

1. Keep `STG_AI_MODE=live` in `apps/web/.env.local`.
2. Start the app with `npm run dev`.
3. Sign in with a real Supabase Auth user.
4. Open `/workspace`, submit a valid answer, and wait for the Result Page.
5. Confirm the page shows a personalized score, diagnosis, rewrite, Why Better,
   and Growth Suggestion without a `Development Mock Feedback` label.
6. Copy the attempt UUID from the `/result/<attemptId>` URL for database
   verification. Do not share this URL outside the test team.

## Verify Supabase Persistence

Run the verifier with the attempt UUID from the web flow:

```bash
npm run verify:live-attempt -- 00000000-0000-4000-8000-000000000000
```

The verifier uses `SUPABASE_SERVICE_ROLE_KEY` locally and selects only approved
metadata fields. It never selects or prints `original_answer` or `rewrite`.

The output checks:

- final attempt status
- Analysis and Coaching prompt versions
- AI model and repair count
- Analysis, Coaching, and total latency
- score row existence
- AI feedback row existence
- observable features existence
- safety flags existence

## Pass and Fail Criteria

A live smoke case passes when:

- Analysis and Coaching both succeed
- both JSON outputs validate
- final status is `completed`
- total score is present
- fact guard reports `passed` or `regenerated`

A persisted web attempt passes when:

- attempt status is `completed`
- prompt versions and AI model are present
- `scores` and `ai_feedback` rows exist
- `observable_features` and `safety_flags` are stored

Any `failed` status, missing persistence row, missing validated metadata, or
fact-guard failure is a failed validation. Keep the attempt id and server logs
for engineering review, but do not paste private answer or rewrite content into
tickets.

## API Key Safety

- Keep `.env.local` out of Git and screenshots.
- Never use an `OPENAI_API_KEY` in a browser-exposed `NEXT_PUBLIC_*` variable.
- Treat `SUPABASE_SERVICE_ROLE_KEY` as a server secret with full database access.
- Rotate a key immediately if it appears in terminal history, logs, chat, or Git.
- Run the smoke command only from a trusted local machine.
- Review the case count in the cost warning before allowing the call to continue.
