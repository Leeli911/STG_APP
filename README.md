# Structured Thinking Gym

Structured Thinking Gym is an AI interview communication coach for practicing structured answers.

The Sprint 1 MVP focuses on one simple loop: users read one interview question, write an answer, submit it, and save the training attempt. The next AI Coach module will add scoring, diagnosis, rewrite, explanation, and next-practice guidance.

## Current Version

Sprint 1 MVP.

Currently implemented:

- Next.js web app shell with protected routes
- Local development login fallback
- Supabase auth integration when environment variables are configured
- Dashboard, workspace, result, history, and admin routes
- Fixed 7-day interview question pack
- Question API for today's question, all questions, or a specific day
- Attempt API with answer validation and idempotency support
- Supabase migrations for questions, attempts, and growth profiles

Planned next in Sprint 1:

- AI analysis and scoring
- AI coaching result rendering
- AI rewrite and "why better" explanation
- Training history populated from saved attempts
- Growth profile updates after completed feedback

## Product Flow

Current user flow:

1. Log in.
2. Open the workspace.
3. Read today's interview question.
4. Write an answer.
5. Submit the answer.
6. Land on the result page after the attempt is saved.

Target AI coaching flow:

1. Read an interview question.
2. Write an answer.
3. Submit the answer.
4. Receive AI analysis.
5. Read the AI rewrite.
6. Understand why the rewrite is better.
7. Save the training result and continue the 7-day loop.

## Learning System

The MVP uses a 7-day question pack that trains one communication behavior at a time. The core abilities are:

- Conclusion First
- Categorization
- Complete Case Structure
- Evidence-Based Expression
- Conflict Handling
- Stakeholder Communication
- Persuasive Final Pitch

The goal is not to teach communication theory as a course. The product should help users improve real interview answers through repeated practice, comparison, and revision.

## AI Coach System

The planned AI Coach system is split into four prompt engines:

- Analysis Engine: scores and diagnoses the user's answer
- Coaching Engine: creates feedback, rewrite, explanation, and next suggestion
- Repair Engine: fixes invalid JSON output
- Judge Engine: checks whether AI output is ready for production display

The frontend should receive structured JSON so coaching results can be rendered consistently.

See [AI Coach Architecture](docs/AI_COACH_ARCHITECTURE.md) for the target design and current implementation status.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase Auth
- Supabase Database
- OpenAI API for the planned AI Coach module
- Vitest and Testing Library

## Local Development

Install dependencies from the repository root:

```bash
npm install
```

Create a local environment file for the web app:

```bash
cp .env.example apps/web/.env.local
```

Start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run tests:

```bash
npm test
```

## Local Dev Login

For local development only:

```text
Email: test@123.com
Password: 123
```

Do not use this account in production.

## Repository Structure

```text
apps/web/src/app/            Next.js routes and API route handlers
apps/web/src/components/     Shared React components
apps/web/src/features/       Feature-level frontend code
apps/web/src/lib/            Supabase, environment, and utility code
apps/web/src/server/         Server-side services and repositories
apps/web/src/prompts/        Planned AI Coach prompt templates
apps/web/src/database/       Supabase migrations and seed data
apps/web/src/tests/          Vitest test suite
docs/                        Product and system documentation
```

## Documentation

- [Product Overview](docs/PRODUCT_OVERVIEW.md)
- [AI Coach Architecture](docs/AI_COACH_ARCHITECTURE.md)
- [Content System](docs/CONTENT_SYSTEM.md)
- [Roadmap](docs/ROADMAP.md)

## Security Notes

Never commit real local environment files or secrets.

Do not commit:

- `.env`
- `.env.local`
- `.env.production`
- Supabase service role keys
- OpenAI API keys

Use `.env.example` only as a template.

## Status

This project is under active development.
