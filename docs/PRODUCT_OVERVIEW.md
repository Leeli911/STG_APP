# Product Overview

Structured Thinking Gym is an AI learning product for interview communication practice.

The first product bet is narrow: job seekers often know what they want to say, but their answers are hard to follow under interview pressure. The MVP helps them practice one answer at a time and compare their original version with a more structured version.

## Target User

Primary user:

- Job seeker preparing for interviews
- Early-career candidate or career switcher
- User who needs practical answer feedback, not a theory-heavy course

Primary pain:

- Answers are too long, indirect, or unstructured
- User cannot clearly explain experience and value
- User needs repeatable practice before interviews

## MVP Promise

In Sprint 1, the product should answer one question:

Can users feel a clear improvement after comparing their original interview answer with AI coaching?

The MVP is designed around a 7-day practice loop. Each day focuses on one communication behavior and one interview question.

## Current Product Surface

Implemented web app areas:

- Login and logout
- Protected app routes
- Dashboard shell
- Workspace for today's question
- Answer submission
- Result page after an attempt is saved
- History shell
- Admin shell

Implemented backend surface:

- `GET /api/questions?scope=today`
- `GET /api/questions?scope=all`
- `GET /api/questions?day=1..7`
- `POST /api/attempts`
- Supabase schema for questions, attempts, and growth profiles
- Development fallback repositories for local use without Supabase

## Core Learning Loop

The target loop is:

1. User opens today's training question.
2. User writes an answer in their own words.
3. System saves the attempt.
4. AI Coach analyzes the answer.
5. User sees score, diagnosis, rewrite, and explanation.
6. User understands what changed and why it is better.
7. System records progress and prepares the next practice step.

The current implementation covers steps 1 through 3. Steps 4 through 7 belong to the upcoming AI Coach module.

## Learning Levels

The product currently uses seven practice days that map to these communication abilities:

- Conclusion First
- Categorization
- STAR-style complete case structure
- Evidence-based expression
- Conflict handling
- Stakeholder communication
- Persuasive final pitch

These are intentionally practical. Each question is a behavior drill, not a lecture.

## MVP Scope

Included or in progress:

- Web app foundation
- Auth foundation
- Fixed 7-day content pack
- Question loading
- Attempt saving
- AI feedback pipeline design
- Training history foundation

Not included in the first MVP:

- Payment
- Team accounts
- Mobile app
- Public community
- Full course system
- Advanced analytics dashboard
- Multi-language content system

## Product Principles

- One practice action per session
- Feedback should be structured, specific, and usable
- AI output should be rendered from JSON, not free-form text
- Content should teach through doing, not through long theory
- The first MVP should validate learning value before adding growth features
