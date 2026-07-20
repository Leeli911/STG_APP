# Database

Supabase migrations and seed data for the STG training core live here. Apply migrations in filename order and validate them in an isolated Supabase project before production.

Current schema areas:

- `questions`: fixed 7-day interview training content
- `attempts`: saved user answers with idempotency protection
- `practice_sessions` / `revision_events`: immutable Human-AI revision workflow
- `user_profiles`: onboarding context and anonymized-eval consent
- `curricula` / `curriculum_items`: versioned seven-day programme mapping
- `ai_jobs`: background-work ledger and lease metadata; infrastructure only until the HTTP worker path is connected
- `product_events` / `usage_counters`: service-role-only, business-idempotent Beta telemetry and quota foundations

The canonical 7-day seed content is mirrored in:

- `migrations/202606180001_create_training_core.sql`
- `seed/questions.v1.sql`

Keep content changes backward-compatible with saved attempts whenever possible.

Migrations are forward-only. Back up production first; prefer an application rollback followed by a corrective migration over dropping new tables or columns. See `docs/DEPLOYMENT.md` for the release procedure.
