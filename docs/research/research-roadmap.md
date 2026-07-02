# Research Roadmap

This roadmap describes how STG could evolve as a research-informed system. It is not a product release roadmap and does not claim that all stages are already implemented.

```text
Current System
↓
Learning Analytics
↓
Feedback Effectiveness
↓
Revision Behaviour Analysis
↓
Adaptive Coaching
↓
Human-AI Learning Research Platform
```

## 1. Current System

Status: Implemented foundation

The current system supports:

- explainable feedback
- Human-AI revision through accept / reject / edit
- deterministic demo mode
- shared demo/live frontend architecture
- final answer re-scoring through the existing workflow

Research value:

- establishes a working environment for observing revision behavior
- keeps the learner in control of the final answer
- provides a stable demo artifact for review and discussion

## 2. Learning Analytics

Status: Future Work

The next research step is to summarize learning progress across sessions.

Potential signals:

- score before revision
- score after revision
- score change by dimension
- revision rate
- acceptance / rejection / edit patterns

Research value:

- helps describe whether users improve after revision
- provides a basis for progress visualization
- keeps analytics tied to normal product usage

## 3. Feedback Effectiveness

Status: Future Work

This stage would explore how different feedback levels affect user behavior.

Possible questions:

- Does score-only feedback lead to different revision behavior than score-plus-diagnosis?
- Does showing a rewrite increase acceptance but reduce independent editing?
- Does explaining why a rewrite is better improve user trust or revision quality?

Research value:

- connects feedback design to measurable user behavior
- supports future comparison of feedback strategies without turning the product into a testing platform

## 4. Revision Behaviour Analysis

Status: Future Work

This stage would study how users respond to AI suggestions.

Potential patterns:

- users accept suggestions directly
- users reject suggestions and keep their draft
- users edit suggestions into a hybrid final answer
- users improve some dimensions more than others

Research value:

- makes Human-AI collaboration observable
- distinguishes passive AI adoption from active learning behavior
- supports qualitative and quantitative follow-up questions

## 5. Adaptive Coaching

Status: Future Work

Adaptive coaching would use repeated learning signals to adjust guidance over time.

Possible directions:

- suggest different practice focus based on recurring weak dimensions
- adjust feedback depth based on user revision behavior
- recommend next exercises based on improvement patterns

Research value:

- moves from static feedback to personalized learning support
- keeps adaptation grounded in user behavior rather than assumptions

## 6. Human-AI Learning Research Platform

Status: Long-term Future Work

This is a possible long-term direction, not the current product scope.

A future research platform could support:

- structured analysis of learning progress
- comparison of feedback strategies
- deeper study of Human-AI revision behavior
- controlled research workflows if needed

Research value:

- turns the current product foundation into infrastructure for Human-AI learning research
- preserves the core principle that research capability should emerge from a useful product experience

## Boundary

STG should not become a research platform prematurely. The current priority is a usable AI communication coach with explainable feedback, user-controlled revision, and reliable demo access.
