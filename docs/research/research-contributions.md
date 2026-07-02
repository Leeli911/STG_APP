# Research Contributions

This document frames STG as a research-informed AI product project. It separates what has already been implemented from future research possibilities.

## Contribution Summary

STG contributes a working system design for AI-supported communication practice:

- Engineering Contribution: a layered architecture for demo and live AI training flows
- Product Contribution: a practical revision loop for structured communication training
- Human-AI Contribution: a user-controlled revision workflow with explainable feedback

These are project contributions, not claims of completed empirical research.

## Engineering Contribution

Implemented:

- one shared training-session screen for Demo Mode and Live Mode
- a gateway pattern that allows different data sources behind the same frontend contract
- a controller layer that separates presentation from submission state, validation, and retry behavior
- deterministic demo behavior for public review without external services
- a live workflow that reuses the existing AI coaching pipeline instead of adding another AI agent

Future Work:

- score-delta tracking as a derived learning signal
- lightweight learning dashboard
- additional architecture documentation for long-term maintainability
- deployment-ready portfolio demo hosting

## Product Contribution

Implemented:

- an interview communication training loop from draft to final answer
- explainable score breakdowns that make feedback more actionable
- AI suggestion display paired with user revision controls
- accept / reject / edit choices instead of passive rewrite consumption
- a no-login deterministic demo path for GitHub and portfolio visitors

Future Work:

- feedback display modes with different levels of guidance
- progress summaries across multiple practice sessions
- clearer onboarding for first-time visitors
- more scenarios beyond the current communication training flow

## Human-AI Contribution

Implemented:

- clear separation between AI assistance and human decision-making
- human-controlled final answer selection
- revision decision capture through accept, reject, or edit actions
- explainable feedback that connects score, evidence, and improvement focus
- re-scoring of the final answer after revision

Future Work:

- analyze how often users follow, reject, or adapt AI suggestions
- study whether explainable feedback improves revision quality
- compare feedback depth and its effect on user behavior
- investigate adaptive coaching based on repeated revision patterns

## What This Project Does Not Claim

STG does not currently claim:

- statistically validated learning gains
- controlled experimental results
- participant study outcomes
- generalizable conclusions about all learners
- a complete Human-AI learning research platform

The current contribution is a working product system that makes those future research directions feasible.
