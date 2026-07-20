# STG System Overview

Structured Thinking Gym (STG) is an AI-powered communication training system for practicing structured interview answers.

It is built as a public portfolio project: easy to try, clear to explain, and designed with production-style architecture. STG is not a research platform or a course project. It is a practical product that happens to generate useful signals about how users revise with AI assistance.

## Problem

Many interview and communication tools stop at either generic advice or a final score. That leaves users with two unanswered questions:

- Why did I receive this feedback?
- What should I do differently in my next version?

AI can produce stronger examples, but users still need to stay in control of the final answer. A useful communication coach should help users compare, revise, and learn instead of simply consuming an AI rewrite.

## Solution

STG turns one answer into a guided improvement loop:

```text
Draft
→ Explainable feedback
→ AI suggestion
→ Accept / reject / edit
→ Final answer
→ Re-score
```

The system helps users understand both the score and the revision path. A user can accept the AI suggestion, keep the original answer, or edit the suggestion into their own final version.

## Architecture

STG uses a layered architecture:

```text
Presentation
↓
Controller
↓
Gateway
↓
API
↓
Service
↓
Repository
↓
Persistence
```

This separation keeps the UI simple and keeps business decisions out of presentation components. The same screen can run in demo mode or live mode because both modes use the same shared training-session contract.

## Demo

The public demo is available at:

```text
/training-demo
```

The demo is deterministic and free to run. It does not require login, OpenAI, Supabase, external API calls, or browser storage. This makes the project safe to present on GitHub, a portfolio site, or during an interview.

## Key Design Decisions

- One component tree for demo and live modes
- One stable training-session data contract
- Explainable feedback built from existing scoring output
- User-controlled revision through accept, reject, or edit
- Deterministic demo data for reliable public review
- Clear separation between UI, state management, transport, orchestration, and persistence

## What This Project Demonstrates

STG is intended to show more than a single AI feature. It demonstrates:

- Layered AI architecture that separates presentation, state management, data access, and live orchestration
- Human-AI collaboration where the user makes the final revision decision
- Explainable feedback that connects scores to evidence and improvement focus
- Deterministic demo design for reliable public review without paid services
- Engineering boundaries that keep the product extensible without turning it into a research platform

## Current Boundary and Future Work

The shared training screen now displays score deltas after revision. Remaining release work includes:

- Feedback display modes for different levels of guidance
- Live validation of the seven-day dashboard and history
- Production connection of the background AI job, webhook, and reconciler infrastructure
- Pilot metrics and privacy-verified account lifecycle operations

These features should extend the existing product loop rather than turn STG into a separate research platform.
