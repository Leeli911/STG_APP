# Architecture Overview

STG uses a layered architecture so the product can support both a free deterministic demo and a live AI-backed workflow without duplicating the user interface.

## High-level Structure

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

## Layer Responsibilities

| Layer | Responsibility |
| --- | --- |
| Presentation | Renders the training screen, feedback, suggestion, revision controls, and final answer. |
| Controller | Manages UI state, validation messages, submission state, retry recovery, and the current training-session DTO. |
| Gateway | Provides one stable interface for demo and live data sources. |
| API | Exposes the live training-session workflow to the frontend. |
| Service | Coordinates session creation, revision commit, and re-scoring through the existing attempt flow. |
| Repository | Adapts live persistence concerns behind the service layer. |
| Persistence | Stores live training records and revision outcomes. |

Presentation components do not call external data sources directly. They receive a view model from the controller and render it.

## Demo and Live Modes

Both modes use the same screen:

```text
DemoAdapter ───────┐
                   ├─→ TrainingSessionGateway → Controller → TrainingSessionScreen
LiveAdapter ───────┘
```

The difference is only the data source.

- Demo mode uses deterministic in-memory data.
- Live mode uses the authenticated application workflow.

This allows the public demo to behave like the real product while remaining free and reliable to run.

## Human-AI Revision Loop

The training session is built around a user-controlled revision workflow:

```text
Draft
→ Explainable feedback
→ AI suggestion
→ Accept / reject / edit
→ Final answer
→ Re-score
```

The AI provides feedback and a suggested rewrite. The user decides whether to follow it, ignore it, or adapt it. That decision becomes part of the training session.

## AI Workflow Boundary

STG keeps AI assistance and human decision-making separate.

The AI is responsible for:

- scoring the draft answer
- diagnosing communication issues
- suggesting a stronger revision
- re-scoring the final answer

The human user is responsible for:

- reviewing the feedback
- choosing whether to accept, reject, or edit the suggestion
- producing the final answer submitted for re-scoring

This boundary keeps the product focused on communication learning instead of one-click answer generation.

## Why This Architecture Matters

This structure makes STG easier to present and evaluate:

- HR reviewers can try the demo without setup friction.
- Technical reviewers can see clear separation between UI, state, and orchestration.
- Research-oriented reviewers can see how explainable feedback and revision behavior could support future learning analysis.

The product remains a communication coach first. The architecture simply makes the learning process observable and extensible.
