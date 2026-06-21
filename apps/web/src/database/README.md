# Database

Supabase migrations and seed data for the Sprint 1 training core live here.

Current schema areas:

- `questions`: fixed 7-day interview training content
- `attempts`: saved user answers with idempotency protection
- `growth_profiles`: per-user progress fields for the learning loop

The canonical 7-day seed content is mirrored in:

- `migrations/202606180001_create_training_core.sql`
- `seed/questions.v1.sql`

Keep content changes backward-compatible with saved attempts whenever possible.
