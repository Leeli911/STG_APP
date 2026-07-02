# Structured Thinking Gym

Structured Thinking Gym (STG) is an AI-powered communication training system for practicing structured interview answers through assessment, guided revision, and progress-ready feedback.

It is built as a production-quality portfolio project: practical for users, explainable in its feedback, and designed so future learning analytics can emerge from normal product use. It is not a research platform, survey tool, or course project.

## Project Overview

STG focuses on one high-value learning loop:

```text
Question
→ Draft answer
→ Explainable feedback
→ AI suggestion
→ Accept / reject / edit
→ Final answer
→ Re-score
```

The goal is to help users communicate with a clearer main point, stronger structure, better evidence, and more audience-aware delivery.

## Why STG is Different

- Explainable feedback: users see score breakdowns, evidence, and improvement focus instead of a black-box score.
- Human-AI revision: users actively accept, reject, or edit AI suggestions instead of passively copying a rewrite.
- Deterministic demo: portfolio visitors can try the core loop without login, paid AI calls, or external services.

## Try the Demo

STG includes a portfolio demo route:

```text
/training-demo
```

The demo uses the same Training Session screen and data contract as the live flow, but runs on deterministic in-memory data. It does not require login, OpenAI, Supabase, external API calls, or browser storage.

See [Demo Guide](docs/public/demo-guide.md) for what to try.

## Design Goals

- Keep the product lightweight and practical.
- Explain why feedback was given.
- Turn AI suggestions into an active revision workflow.
- Keep demo mode free and reliable.
- Preserve the existing AI coaching pipeline while observing revision behavior.

## Core Features

- Explainable score breakdown by communication dimension
- Evidence-based feedback and improvement focus
- AI suggestion for a stronger answer
- Accept / reject / edit revision controls
- Final answer display after revision
- Shared demo and live training-session UI
- Live architecture prepared for authenticated training sessions

## Architecture at a Glance

```text
Presentation → Controller → Gateway → API → Service → Repository → Persistence
```

Demo and live modes share one component tree through `TrainingSessionGateway`:

```text
DemoAdapter / LiveAdapter → Controller → TrainingSessionScreen
```

See [Architecture Overview](docs/public/architecture-overview.md) for the layer responsibilities.

## System Design

STG separates AI generation from user revision behavior. The system can show feedback, present an AI suggestion, record the user's revision decision, and re-score the final answer without adding another AI agent or creating a separate research workflow.

The same UI can run against a deterministic demo source or the live application workflow. That makes the public demo realistic while keeping it inexpensive to operate.

## Design Principles

- Explainability: scores should be understandable through evidence and improvement focus.
- Human-in-the-loop: users decide whether to accept, reject, or edit AI suggestions.
- Deterministic Demo: the public demo should work without paid services or external dependencies.
- Separation of Concerns: UI, state management, transport, orchestration, and persistence stay separate.

See [Design Principles](docs/public/design-principles.md) for the public-facing rationale.

## Repository Structure

```text
apps/web/src/app/             Next.js routes and route handlers
apps/web/src/components/      Shared presentation components
apps/web/src/features/        Feature-level client logic and adapters
apps/web/src/server/          Server-side application services
apps/web/src/tests/           Vitest and Testing Library coverage
docs/public/                  Public portfolio documentation
docs/superpowers/specs/       Approved working specifications
docs/superpowers/plans/       Implementation planning documents
```

The `docs/superpowers` folder is intentionally kept as working documentation. Public-facing explanations live under `docs/public`.

## Developer Guide

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000/training-demo
```

Verify:

```bash
npm test
npm run build
```

Live mode uses the existing app environment configuration. Use `.env.example` as the template and never commit real secrets.

## Documentation

Public documentation:

- [System Overview](docs/public/system-overview.md)
- [Design Principles](docs/public/design-principles.md)
- [Architecture Overview](docs/public/architecture-overview.md)
- [Demo Guide](docs/public/demo-guide.md)

Working documentation remains under `docs/superpowers/specs` and `docs/superpowers/plans`.

## Security Notes

Never commit real local environment files or secrets, including `.env`, `.env.local`, `.env.production`, service role keys, or OpenAI API keys.

Use `.env.example` only as a template.

## Status

STG V2 currently includes explainable feedback, a Human-AI revision loop, and a deterministic `/training-demo` route. Delta tracking, feedback-mode gating, and a learning dashboard are intentionally future phases.
