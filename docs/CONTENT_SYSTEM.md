# Content System

The content system defines the interview questions, learning goals, and evaluation focus used by Structured Thinking Gym.

The current MVP uses a fixed 7-day pack. Each day trains one behavior, so the user can focus on improving a single communication habit at a time.

## Content Principles

- One question should train one primary ability.
- The scenario should be realistic and easy to understand.
- The prompt should sound like an interview question.
- The learning goal should be narrow.
- The expected structure should tell the system what a good answer needs.
- The evaluation focus should tell the AI Coach what to judge first.
- The knowledge card should be short and practical.

## Current 7-Day Pack

| Day | Title | Primary behavior |
| --- | --- | --- |
| 1 | Conclusion First | Put the answer in the first sentence |
| 2 | Categorization | Organize an answer into clear points |
| 3 | STAR | Explain a complete experience case |
| 4 | Evidence | Support a claim with specific facts |
| 5 | Conflict Handling | Handle disagreement without sounding defensive |
| 6 | Stakeholder Communication | Report judgment, evidence, and next action |
| 7 | Final Pitch | Turn experience into persuasive hiring value |

The source content currently lives in:

- `apps/web/src/server/questions/staticQuestions.ts`
- `apps/web/src/database/migrations/202606180001_create_training_core.sql`
- `apps/web/src/database/seed/questions.v1.sql`

## Question Data Shape

Each question uses these fields:

- `day_number`
- `title`
- `scenario`
- `prompt`
- `learning_goal`
- `expected_structure`
- `evaluation_focus`
- `knowledge_card`
- `is_active`

This structure supports both the frontend practice UI and the future AI Coach prompt context.

## Knowledge Cards

Knowledge cards are short explanations shown near the practice question.

Good knowledge cards should:

- Explain the mistake users commonly make
- Give one practical correction
- Avoid long theory
- Stay close to the day's learning goal

## AI Coach Context

When the AI Coach module is implemented, each coaching request should include:

- The question prompt
- The scenario
- The learning goal
- The expected structure
- The evaluation focus
- The user's original answer

This keeps feedback aligned with the training objective instead of producing generic interview advice.

## Authoring Checklist

Before adding or changing a question, check:

- Does this question match a real interview situation?
- Can the user answer it without extra context?
- Does it train only one main behavior?
- Is the expected structure clear enough for AI evaluation?
- Is the evaluation focus observable in the answer text?
- Is the knowledge card short enough to read before writing?
- Does it avoid promising a "perfect answer"?

## Versioning

The first content pack is treated as `questions.v1`.

Future versions should preserve historical attempts. If a question changes materially, prefer adding a new content version instead of mutating the meaning of past training records.
