# Demo Guide

STG includes a deterministic demo route for public portfolio review:

```text
/training-demo
```

The demo is designed for GitHub reviewers, portfolio visitors, interviewers, and PhD advisors who want to understand the system quickly without setting up paid services.

## What the Demo Shows

The demo walks through the complete deterministic Human-AI revision loop:

```text
Question
→ Draft
→ Explainable feedback
→ AI suggestion
→ Accept / reject / edit
→ Final answer
→ Re-score and delta
```

You first submit a draft answer, then inspect the score breakdown, compare the AI suggestion, choose one of three revision actions, and review the final score delta.

## How to Run Locally

From the repository root:

```bash
npm install
npm run dev
```

Then open:

```text
http://localhost:3000/training-demo
```

No login is required.

## What to Try

Try each decision path:

1. Accept the AI suggestion and confirm the final answer matches the suggestion.
2. Reject the suggestion and confirm the final answer stays as the original draft.
3. Edit the answer and confirm the final answer reflects your edited text.
4. Confirm the final score and dimension changes are shown with the disclaimer that a system score delta is not validated learning impact.

The route uses the same training-session screen as the live product, so the demo is not a separate mock page.

## What This Demo Proves

The demo proves that the public experience is not a separate mock page.

- It uses the same UI as the live training-session flow.
- It uses the same DTO shape expected by the live workflow.
- It uses the same accept / reject / edit interaction model.
- It changes only the data source: deterministic in-memory data instead of live services.

This keeps the demo reliable for portfolio review while still representing the real product architecture.

## What the Demo Does Not Require

The demo does not use:

- login
- OpenAI
- Supabase
- external API calls
- localStorage
- sessionStorage

It is intentionally deterministic so it can be shown reliably in a portfolio setting.

## Current Scope

The demo currently shows:

- draft answer
- total score
- score breakdown
- AI suggestion
- accept / reject / edit controls
- final answer after revision
- total and per-dimension score changes

It intentionally does not show authenticated history, long-term progress, or live AI latency. Those belong to the live product rather than the public deterministic route.
