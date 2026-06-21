# AI Coach Architecture

This document describes the target AI Coach architecture for Structured Thinking Gym and the current implementation status.

## Current Status

The current app saves user attempts and shows a placeholder result page. Production AI feedback is not wired into the app yet.

Current repository status:

- `apps/web/src/prompts/` is reserved for prompt templates.
- `POST /api/attempts` validates and saves the original answer.
- The result page currently confirms that the answer was saved.
- `OPENAI_API_KEY` is reserved in `.env.example` for the upcoming AI module.

## Target Goal

The AI Coach should turn a submitted interview answer into stable, structured coaching output that the frontend can render without guessing.

The system should provide:

- Score
- Diagnosis
- Rewrite
- Explanation of why the rewrite is better
- Next practice suggestion
- Machine-readable metadata for progress tracking

## Prompt Engines

The target prompt system has four engines.

### 1. Analysis Engine

Purpose:

- Read the question, learning goal, expected structure, evaluation focus, and user answer
- Score the answer
- Identify the main communication issue
- Extract specific evidence from the user answer

Expected output:

- Overall score
- Ability-level scores
- Strengths
- Weaknesses
- Missing structure
- Priority coaching focus

### 2. Coaching Engine

Purpose:

- Convert analysis into user-facing feedback
- Rewrite the answer in a stronger structure
- Explain why the rewrite is better
- Suggest the next practice action

Expected output:

- Short feedback summary
- Concrete improvement advice
- Rewritten answer
- Why-better explanation
- Next practice suggestion

### 3. Repair Engine

Purpose:

- Recover from malformed model output
- Convert invalid or partial output into the required JSON shape
- Preserve original coaching meaning when possible

Expected output:

- Valid JSON matching the production schema
- Explicit fallback fields if recovery is incomplete

### 4. Judge Engine

Purpose:

- Check whether the coaching output is safe and useful enough to display
- Verify that required fields exist
- Reject vague, contradictory, or off-topic feedback

Expected output:

- `approved`
- `needs_repair`
- `blocked`
- Reason codes for observability

## Target Pipeline

```text
User answer
  -> Attempt saved
  -> Analysis Engine
  -> Coaching Engine
  -> JSON schema validation
  -> Repair Engine, only if validation fails
  -> Judge Engine
  -> Persist AI result
  -> Render result page
```

## Suggested Result Shape

The exact schema can evolve, but the frontend should receive a stable object similar to this:

```json
{
  "score": 72,
  "levelScores": {
    "conclusionFirst": 80,
    "categorization": 65,
    "logicalProgression": 70,
    "persuasiveExpression": 72
  },
  "diagnosis": {
    "summary": "The answer has a clear motivation, but the main conclusion appears too late.",
    "strengths": ["Uses a concrete reason"],
    "issues": ["Conclusion is not the first sentence"]
  },
  "rewrite": {
    "answer": "I want to do data analysis because I enjoy turning unclear business questions into evidence-based decisions...",
    "whyBetter": "The rewrite opens with the conclusion, then supports it with a concrete example."
  },
  "nextPractice": {
    "focus": "Conclusion First",
    "suggestion": "Rewrite the first sentence so it directly answers the question."
  }
}
```

## Integration Points

Likely code areas for implementation:

- `apps/web/src/prompts/`
- `apps/web/src/server/attempts/`
- `apps/web/src/app/api/attempts/route.ts`
- `apps/web/src/app/result/[attemptId]/page.tsx`
- `apps/web/src/database/migrations/`

Likely database additions:

- AI result table or JSON column linked to `attempts`
- Status values for `submitted`, `processing`, `completed`, and `failed`
- Error metadata for failed or blocked AI runs

## Production Requirements

AI output should be:

- Valid JSON
- Schema-checked before rendering
- Specific to the user's answer
- Short enough for users to read quickly
- Clear about the single highest-priority improvement
- Free of secrets, prompt text, or internal scoring instructions

## Secret Handling

Never commit:

- Real OpenAI API keys
- Supabase service role keys
- Full production prompts if they contain private strategy
- `.env.local` or production environment files

Only commit safe templates and public documentation.
