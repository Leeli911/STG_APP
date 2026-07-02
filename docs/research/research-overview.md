# STG Research Overview

Structured Thinking Gym (STG) is a practical AI communication training system with a research-informed design. It is not presented as a completed research platform. Instead, it is a working product foundation that can support future study of explainable feedback, Human-AI collaboration, and learning progress.

## Project Motivation

Many AI writing and interview tools produce fluent suggestions, but they often hide the reasoning behind feedback and make revision feel like copying an answer. STG explores a different product shape: the AI gives structured feedback and a suggested revision, while the learner remains responsible for the final communication choice.

## Problem

Communication practice is difficult to improve without three things:

- an understandable assessment
- a concrete revision path
- a way to observe whether the learner follows, rejects, or adapts feedback

STG addresses this by turning one draft answer into an explainable, user-controlled revision loop.

## System Design

STG uses a layered system architecture:

```text
Presentation → Controller → Gateway → API → Service → Repository → Database
```

The architecture separates the user interface, interaction state, data access, workflow orchestration, and persistence. Demo Mode and Live Mode share the same frontend component tree and training-session contract, which keeps the public demo aligned with the real product flow.

Implemented:

- shared training-session screen for demo and live flows
- deterministic demo adapter
- live workflow architecture for training sessions
- explainable feedback display
- Human-AI revision controls

Future Work:

- score-delta tracking
- feedback mode comparison
- learning dashboard
- adaptive coaching logic

## Human-AI Collaboration

STG treats revision as a collaboration rather than an AI replacement task.

The AI provides:

- score
- diagnosis
- suggested revision
- re-score after the final answer

The human provides:

- original draft
- revision decision
- final answer

Implemented: users can accept, reject, or edit the AI suggestion in the training loop.

Future Work: analyze patterns in how users respond to AI suggestions over time.

## Explainable Feedback

STG surfaces feedback through score breakdowns, evidence, deductions, and improvement focus. The goal is to make the feedback understandable enough for a user to revise intentionally.

Implemented: the V2 screen explains dimensions using existing analysis and coaching outputs.

Future Work: evaluate whether different levels of feedback detail affect revision quality or user trust.

## Human-in-the-loop

The system does not assume that the AI rewrite is the correct final answer. The learner decides whether to:

- accept the suggestion
- reject it and keep the original draft
- edit the answer into a personal final version

Implemented: the product records the revision decision as part of the training-session flow.

Future Work: use revision decisions as learning signals for progress tracking and adaptive guidance.

## Deterministic Demo

The public demo is designed to work without login, paid AI calls, external services, or browser storage. It uses the same UI and data contract as the live product, but with deterministic in-memory data.

Implemented: `/training-demo` demonstrates the full revision loop without external dependencies.

Future Work: use the demo as a stable artifact for portfolio review, interviews, and project walkthroughs.

## Current Scope

Current STG V2 includes:

- explainable feedback
- Human-AI revision loop
- deterministic demo route
- shared demo/live frontend contract
- layered engineering architecture

The project does not currently include statistical testing, participant management, survey systems, or a research administration backend.

## Future Research Directions

STG could support future work in:

- learning analytics based on score changes and revision behavior
- feedback effectiveness across different feedback depths
- revision behavior analysis for accept / reject / edit decisions
- adaptive coaching based on user progress patterns
- Human-AI learning systems that keep the learner in control

These directions should grow out of the product experience rather than replace it with a separate research platform.
