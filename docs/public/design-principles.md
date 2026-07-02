# Design Principles

STG is designed as a practical AI communication coach with a public demo that is easy to understand and inexpensive to operate.

The system follows four principles.

## Explainability

A score is only useful if the user can understand it.

STG shows feedback as a breakdown by communication dimension, including evidence and an improvement focus. The goal is to make the feedback feel actionable instead of mysterious.

In STG, this means each score dimension is paired with visible evidence and a concrete improvement focus.

This also makes the system easier to evaluate as a portfolio project: visitors can see not only what the AI recommends, but why the product presents that recommendation to the user.

## Human-in-the-loop

The AI does not replace the user’s answer.

After reading feedback and a suggested rewrite, the user chooses what happens next:

- accept the suggestion
- reject it and keep the draft
- edit the answer into a personal final version

In STG, this means the AI can suggest a better answer, but the user still chooses the final revision path.

This keeps the product focused on learning and revision, not one-click answer generation.

## Deterministic Demo

The public demo should work every time.

STG includes a deterministic demo mode that uses in-memory data and the same UI as the live product. It does not require login, paid AI calls, external services, or browser storage.

In STG, this means `/training-demo` can demonstrate the full revision loop without relying on external services.

That makes the project suitable for GitHub, a personal website, and live walkthroughs where reliability matters.

## Separation of Concerns

Each layer has one job:

- Presentation renders the experience.
- Controller manages interaction state.
- Gateway selects the data source.
- Service logic coordinates the live workflow.

In STG, this means presentation components render the experience while controller and gateway layers handle state and data-source boundaries.

This separation keeps the system easier to test, explain, and extend. Future features such as delta tracking or a learning dashboard can build on the same structure without rewriting the product flow.
