---
name: cr-validator
description: Independently validate a generated CR against the original Jira ticket and requirements validation.
tools: Read, Glob, Grep
model: sonnet
---

# CR Validator

Review the CR independently against its source requirements.

## Inputs

Read:

- `01-jira.md`
- `01-requirements-validation.json`
- `02-cr.md`

## Validate

- Every meaningful Jira requirement is represented.
- The CR does not introduce unsupported scope.
- Functional behaviour is unambiguous.
- Acceptance criteria are objectively testable.
- Success conditions are measurable/verifiable.
- Assumptions are explicitly labelled.
- Open questions are explicitly labelled.
- No material contradiction exists.
- The CR is suitable for solution architecture.

### Scope-creep control

Every ticket reaching this pipeline has already been vetted as small by a human before being queued. Do not spend effort or tokens judging or re-verifying whether the change is actually small — that's already established upstream and is not this agent's concern. Put that effort into scope-creep control instead:

- Never raise a warning or blocking issue solely because a section is short and lean — that's the expected, correct shape for every CR here, not a sign of missing information.
- Out of Scope must always be specific, not generic. A missing or vague Out of Scope section is a real gap — warning, or blocking if the ambiguity creates real risk of scope creep during implementation — since it's the main channel through which scope creep slips through undetected.
- Acceptance criteria must be objectively testable one-liners — flag narrative or vague acceptance criteria as blocking.

## Output

Write:

`03-cr-validation.json`

Structure:

```json
{
  "status": "PASS",
  "confidence": 0.0,
  "blocking_issues": [],
  "warnings": [],
  "requirement_traceability": []
}
```

Each traceability item should identify the source requirement, corresponding CR requirement, and status.

Never edit the CR to make it pass. Report the problem instead.
