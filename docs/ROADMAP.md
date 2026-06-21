# Roadmap

This roadmap is intentionally focused on MVP validation. It should be updated as the product learns from real users.

## Phase 0: Foundation

Status: mostly complete.

Goals:

- Create Next.js app foundation
- Add protected routes
- Add local development login fallback
- Add Supabase client setup
- Add app shell routes
- Add test foundation

Evidence in the current app:

- Dashboard, workspace, result, history, and admin routes exist
- Login and logout exist
- Local dev login is available
- Vitest tests are present

## Phase 1: 7-Day Training MVP

Status: in progress.

Goals:

- Add fixed 7-day question pack
- Load today's question
- Save user answer attempts
- Prevent duplicate submissions with idempotency keys
- Store training data in Supabase
- Keep a development fallback path for local work without Supabase

Current validation question:

Do users complete a short practice session and feel that the flow is simple enough to repeat for seven days?

## Phase 2: AI Coach Feedback

Status: next.

Goals:

- Add Analysis Engine
- Add Coaching Engine
- Add Repair Engine
- Add Judge Engine
- Persist AI results
- Render score, diagnosis, rewrite, why-better explanation, and next practice suggestion
- Add tests around malformed AI output and blocked output

Current validation question:

Do users feel a clear improvement after comparing their original answer with the AI rewrite?

## Phase 3: Training History and Progress

Status: planned.

Goals:

- Show previous attempts in history
- Show current day and completed days on the dashboard
- Update growth profile after completed AI feedback
- Add simple streak or continuation signals

Current validation question:

Do users return for the next practice day without needing a full course system?

## Phase 4: Content Expansion

Status: planned.

Goals:

- Add more interview tracks
- Add role-specific question packs
- Add content authoring guidelines
- Add internal review workflow for questions and feedback rubrics

Potential tracks:

- Data analyst interviews
- Product manager interviews
- Business analyst interviews
- Behavioral interviews
- Self-introduction and final pitch drills

## Later, Not MVP

These should wait until the first learning loop is validated:

- Payment
- Team accounts
- Mobile app
- Public community
- Full course marketplace
- Advanced analytics dashboard
- Multi-language curriculum management
