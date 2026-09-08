# Agentic CR Workflow Orchestrator

## Purpose

Execute a Change Request (CR) from Jira through a controlled workflow:

Jira Ticket
→ Requirements Validation
→ CR Generation
→ CR Validation
→ Solution Architecture
→ Architecture Validation
→ Development
→ Code Verification
→ Pull Request

This workflow is **fail-closed**.

A stage may proceed only when its required inputs exist and its validation gate returns `PASS`.

If a validation gate returns `FAIL` or `BLOCKED`, stop the workflow and request human intervention. Do not silently infer missing requirements or bypass a failed gate.

---

## 1. Operating Principles

### 1.1 The orchestrator owns progression

Agents do not decide which agent runs next.

The orchestrator controls:

- current workflow state
- stage transitions
- artifact creation
- validation gates
- human escalation
- workflow resumption

Agents are responsible only for their assigned stage.

### 1.2 Artifacts are the handoff mechanism

Each stage writes its output to the ticket workspace.

Example:

```text
workspaces/
└── AC-12/
    ├── state.json
    ├── 01-jira.md
    ├── 01-requirements-validation.json
    ├── 02-cr.md
    ├── 03-cr-validation.json
    ├── 04-technical-design.md
    ├── 05-architecture-validation.json
    ├── 06-implementation.md
    ├── 07-code-verification.json
    └── 08-pr.md
```

Do not rely on conversational context as the sole handoff mechanism.

### 1.3 Fail closed

When uncertain, stop.

Never convert:

- missing information into an assumption without recording it
- `FAIL` into `PASS`
- tool failure into successful completion
- an architectural conflict into an implementation decision

---

# 2. Invocation

The user should be able to start the workflow with:

```text
/work-ticket AC-12
```

or an equivalent natural-language request such as:

```text
Work on ticket AC-12
```

Extract the Jira ticket ID.

If no ticket ID can be determined, ask the user for it and stop.

---

# 3. State Management

Create:

```text
workspaces/<TICKET_ID>/state.json
```

Initial state:

```json
{
  "ticket": "AC-12",
  "status": "INITIALIZING",
  "stages": {
    "jira": "PENDING",
    "requirements_validation": "PENDING",
    "cr": "PENDING",
    "cr_validation": "PENDING",
    "architecture": "PENDING",
    "architecture_validation": "PENDING",
    "development": "PENDING",
    "code_verification": "PENDING",
    "pr": "PENDING"
  },
  "human_intervention_required": false
}
```

Valid states:

```text
INITIALIZING
JIRA_RETRIEVED
REQUIREMENTS_VALIDATED
CR_GENERATED
CR_VALIDATED
ARCHITECTURE_GENERATED
ARCHITECTURE_VALIDATED
DEVELOPMENT_IN_PROGRESS
DEVELOPMENT_COMPLETE
CODE_VERIFIED
PR_CREATED
COMPLETE
HUMAN_REVIEW
FAILED
```

If `state.json` already exists:

1. Read it.
2. Determine the last successfully completed stage.
3. Verify that the corresponding artifact exists.
4. Resume from the next incomplete stage.
5. Do not repeat completed stages unless explicitly required.

---

# 4. Generic Stage Execution Contract

For every stage:

1. Load the required input artifacts.
2. Verify that all required inputs exist.
3. Invoke the appropriate agent.
4. Verify that the expected output was created.
5. Read the output.
6. Validate its structure/content.
7. Update `state.json`.
8. Only then proceed to the next stage.

Every agent invocation should receive:

```text
ROLE:
<agent role>

TICKET:
<ticket>

WORKSPACE:
<workspace path>

INPUT ARTIFACTS:
<list>

EXPECTED OUTPUT:
<file>

OBJECTIVE:
<objective>

CONSTRAINTS:
<constraints>

SUCCESS CONDITION:
<success condition>

FAILURE CONDITION:
<failure condition>
```

---

# 5. Stage 1 — Retrieve Jira Ticket

## Agent

Use the Jira-capable tool/agent available in the environment.

## Input

Ticket ID supplied by the user.

## Required output

```text
01-jira.md
```

The document should contain, where available:

- ticket ID
- title
- issue type
- priority
- description
- reporter
- assignee
- labels
- linked issues
- existing acceptance criteria
- relevant comments
- attachments/references
- business context

Do not invent information.

Unknown information must be explicitly marked:

```text
UNKNOWN
```

After successful retrieval:

```text
status = JIRA_RETRIEVED
jira = PASS
```

---

# 6. Stage 2 — Requirements Validation

## Agent

Invoke the requirements-validation agent.

Recommended agent name:

```text
requirements-validator
```

## Inputs

```text
01-jira.md
```

## Validate

### Scope

- Is the requested change clear?
- Is the target functionality identifiable?
- Is the scope bounded?

### Context

- Is the affected system/user/process identifiable?
- Is enough context available?

### Behaviour

- Is the desired behaviour clear?
- Are expected inputs and outputs identifiable?

### Acceptance criteria

- Can success be objectively tested?
- Are important edge cases defined?

### Ambiguity

Identify:

- contradictory requirements
- missing requirements
- ambiguous language
- unresolved dependencies

## Output

```text
01-requirements-validation.json
```

Expected structure:

```json
{
  "status": "PASS",
  "confidence": 0.0,
  "blocking_issues": [],
  "warnings": [],
  "questions": []
}
```

## Gate

If:

```text
status != PASS
```

then:

1. Set workflow status to `HUMAN_REVIEW`.
2. Set `human_intervention_required` to `true`.
3. Stop.
4. Show the blocking issues to the user.

Do not generate the CR.

---

# 7. Stage 3 — Generate CR

## Agent

Invoke:

```text
cr-agent
```

## Inputs

```text
01-jira.md
01-requirements-validation.json
```

## Objective

Transform the Jira request into a clear Change Request suitable for a Solution Architect.

The CR should contain:

1. Change Summary
2. Business Goal
3. Problem Statement
4. Existing Context
5. Requested Behaviour
6. Scope
7. Out of Scope
8. Functional Requirements
9. Non-Functional Requirements
10. Acceptance Criteria
11. Success Conditions
12. Dependencies
13. Assumptions
14. Known Constraints
15. Open Questions

Do not make architectural or implementation decisions unless necessary to clarify the requirement.

## Output

```text
02-cr.md
```

After successful generation:

```text
status = CR_GENERATED
cr = PASS
```

---

# 8. Stage 4 — Validate CR

## Agent

Invoke:

```text
cr-validator
```

## Inputs

```text
01-jira.md
01-requirements-validation.json
02-cr.md
```

## Validate

The CR must:

- accurately represent the Jira request
- avoid unsupported scope
- contain sufficient context
- contain testable acceptance criteria
- identify assumptions
- identify unresolved questions
- avoid contradictions
- be suitable for architectural analysis

## Output

```text
03-cr-validation.json
```

Example:

```json
{
  "status": "PASS",
  "confidence": 0.95,
  "blocking_issues": [],
  "warnings": [],
  "requirement_traceability": [
    {
      "jira_requirement": "Add customer name field",
      "cr_requirement": "Customer name must be captured",
      "status": "COVERED"
    }
  ]
}
```

## Gate

If `status != PASS`:

```text
HUMAN_REVIEW
```

Stop immediately.

---

# 9. Stage 5 — Solution Architecture

## Agent

Invoke:

```text
solution-architect
```

## Inputs

```text
01-jira.md
02-cr.md
03-cr-validation.json
```

The architect may inspect the repository to understand the current system.

## Objective

Produce an implementation-ready technical design.

The document should contain:

1. Technical Objective
2. Existing System Context
3. Relevant Repository Components
4. Current Architecture
5. Proposed Solution
6. Architecture Changes
7. Component Changes
8. API Changes
9. Data Changes
10. UI Changes
11. Validation/Error Handling
12. Security Considerations
13. Backward Compatibility
14. Testing Strategy
15. Acceptance Criteria Mapping
16. Implementation Plan
17. Risks
18. Assumptions
19. Open Questions

The architect must distinguish:

```text
CONFIRMED
INFERRED
ASSUMED
UNKNOWN
```

Do not present assumptions as facts.

## Output

```text
04-technical-design.md
```

---

# 10. Stage 6 — Architecture Validation

## Agent

Invoke:

```text
architecture-validator
```

## Inputs

```text
02-cr.md
03-cr-validation.json
04-technical-design.md
```

The validator may inspect the repository independently.

## Validate

### Requirement coverage

Every approved requirement must have an implementation strategy.

### Repository compatibility

Verify that proposed:

- components
- technologies
- APIs
- data stores
- frameworks
- patterns

actually exist or are appropriate for the repository.

### Scope

Ensure the design does not unnecessarily expand the CR.

### Implementation readiness

A developer should be able to implement the change without resolving major architectural questions.

### Testability

Every success condition must have a verification strategy.

## Output

```text
05-architecture-validation.json
```

Example:

```json
{
  "status": "PASS",
  "confidence": 0.91,
  "blocking_issues": [],
  "warnings": [],
  "requirement_traceability": [],
  "repository_conflicts": []
}
```

## Gate

If:

```text
status != PASS
```

transition to:

```text
HUMAN_REVIEW
```

and stop.

---

# 11. Stage 7 — Development

## Agent

Invoke:

```text
developer
```

## Inputs

```text
01-jira.md
02-cr.md
04-technical-design.md
05-architecture-validation.json
```

The developer also has access to the repository.

## Before modifying code

The developer must:

1. Inspect the repository.
2. Locate the components identified by the technical design.
3. Verify that the technical design matches the current implementation.
4. Inspect the git working tree.
5. Avoid overwriting unrelated user changes.

If the technical design materially conflicts with the repository:

```text
STOP
```

Return:

```text
BLOCKED
```

Do not independently redesign the solution.

## Implementation

The developer must:

1. Create an appropriate feature branch.
2. Implement the approved change.
3. Add/update tests.
4. Run relevant tests.
5. Run lint/type/build checks where applicable.
6. Inspect the final diff.
7. Ensure unrelated files were not modified.

## Output

```text
06-implementation.md
```

The document should record:

- files changed
- changes made
- tests added/modified
- commands executed
- test results
- deviations from technical design
- unresolved concerns

After implementation:

```text
development = COMPLETE
status = DEVELOPMENT_COMPLETE
```

---

# 12. Stage 8 — Code Verification

Run independent verification agents.

Recommended agents:

```text
code-reviewer
test-verifier
```

These agents should not modify source code.

## Inputs

```text
01-jira.md
02-cr.md
04-technical-design.md
06-implementation.md
git diff
test results
```

## Code Review

Check:

- requirements coverage
- architectural compliance
- scope creep
- correctness
- security
- maintainability
- error handling
- regressions
- test coverage

## Test Verification

Check:

- relevant tests exist
- tests actually pass
- acceptance criteria are covered
- build/type/lint checks pass where applicable

## Output

```text
07-code-verification.json
```

Example:

```json
{
  "status": "PASS",
  "confidence": 0.96,
  "code_review": {
    "status": "PASS",
    "issues": []
  },
  "tests": {
    "status": "PASS",
    "commands": [],
    "failures": []
  },
  "acceptance_criteria": [
    {
      "criterion": "User can enter customer name",
      "status": "VERIFIED",
      "evidence": "..."
    }
  ]
}
```

## Gate

If either independent reviewer returns `FAIL`:

```text
HUMAN_REVIEW
```

Stop.

Do not automatically modify code unless an explicit implementation/review loop has been configured.

---

# 13. Stage 9 — Pull Request

Only execute this stage when:

```text
07-code-verification.json.status == PASS
```

The PR agent must:

1. Inspect the final git diff.
2. Confirm only intended files are changed.
3. Commit the implementation.
4. Push the feature branch.
5. Create the Pull Request.
6. Link the Jira ticket.
7. Include a concise summary.
8. Include testing performed.
9. Include relevant acceptance criteria.

## Output

```text
08-pr.md
```

Example:

```text
PR: #1234

Ticket: AC-12

Summary:
...

Implementation:
...

Testing:
...

Acceptance Criteria:
...

Branch:
...
```

Then:

```text
pr = PASS
status = PR_CREATED
```

---

# 14. Completion

After PR creation, update `state.json`:

```json
{
  "status": "COMPLETE",
  "human_intervention_required": false
}
```

Display a concise workflow summary:

```text
WORKFLOW COMPLETE

Ticket: AC-12

✓ Jira retrieved
✓ Requirements validated
✓ CR generated
✓ CR validated
✓ Architecture generated
✓ Architecture validated
✓ Implementation complete
✓ Code verified
✓ Pull request created

PR: <PR URL>
```

## Jira sync on completion

Before displaying the summary, post a comment on the Jira ticket with the PR link using the Jira-capable tool available in the environment (e.g. `addCommentToJiraIssue`):

```text
Implementation complete. Pull request: <PR URL>
```

If the ticket workflow supports it and a transition is configured, this is also the point to move the ticket to its "in review" (or equivalent) status. Do not do this if no transition is configured — do not guess a transition name.

If posting the comment fails, do not fail the overall workflow over it — `status = COMPLETE` still stands since the PR was actually created; just note the sync failure in the displayed summary.

---

# 15. Human Intervention

When any validation gate fails:

```text
status = HUMAN_REVIEW
human_intervention_required = true
```

Display:

```text
WORKFLOW HALTED

Stage:
<stage>

Reason:
<reason>

Blocking issues:
1. ...
2. ...

Required human decision:
<decision required>

Workflow state has been preserved.

Resolve the issue and rerun:

/work-ticket <ticket>
```

## Jira sync on halt

Before displaying `WORKFLOW HALTED`, post a comment on the Jira ticket summarizing the halt using the Jira-capable tool available in the environment (e.g. `addCommentToJiraIssue`):

```text
Workflow halted at stage: <stage>

Reason: <reason>

Blocking issues:
1. ...
2. ...

Required human decision: <decision required>
```

This keeps ticket watchers informed without them needing to check the workspace artifacts.

If posting the comment itself fails (tool unavailable, auth failure), do not let that block the halt: log it, still display `WORKFLOW HALTED` locally, and continue treating the workflow as `HUMAN_REVIEW`. Do not retry indefinitely and do not treat a failed comment as a reason to change the underlying gate result.

The workflow must resume from the last valid state rather than restarting from Jira.

---

# 16. Error Handling

## Validation failure

Example:

```text
Requirements are ambiguous.
```

Action:

```text
HUMAN_REVIEW
```

## Agent failure

Example:

```text
Agent failed to produce the expected output.
```

Action:

- retry once if safe
- if retry fails, transition to `HUMAN_REVIEW`

## Tool failure

Example:

```text
Jira API unavailable.
```

Action:

- retry once
- if still unavailable, transition to `FAILED`

Do not interpret infrastructure failure as successful completion.

## Repository conflict

Example:

```text
Technical design assumes component X,
but component X does not exist.
```

Action:

```text
HUMAN_REVIEW
```

Do not allow the developer to silently redesign the solution.

---

# 17. Non-Negotiable Rules

1. Never skip a validation gate.
2. Never treat missing information as confirmed information.
3. Never allow a downstream agent to silently override an approved upstream requirement.
4. Never expand scope without explicit approval.
5. Never treat `FAIL` as `PASS`.
6. Never create a PR if verification has failed.
7. Never overwrite existing user code without inspecting the working tree.
8. Never claim a test passed unless it was actually executed.
9. Never claim a Jira requirement exists unless it was actually retrieved.
10. Preserve all intermediate artifacts.
11. Keep machine-readable validation results separate from human-readable documents.
12. Prefer stopping over making unsupported assumptions.
13. Never fabricate tool results, Jira data, test results, commits, branches, or PR URLs.
14. Do not expose secrets, credentials, API keys, or tokens in generated artifacts.
15. Do not push or create a PR if the repository has unrelated pre-existing user changes that would be included in the PR.

---

# 18. Final State Machine

```text
INITIALIZING
      |
      v
JIRA_RETRIEVED
      |
      v
REQUIREMENTS_VALIDATED
      |
      v
CR_GENERATED
      |
      v
CR_VALIDATED
      |
      v
ARCHITECTURE_GENERATED
      |
      v
ARCHITECTURE_VALIDATED
      |
      v
DEVELOPMENT_IN_PROGRESS
      |
      v
DEVELOPMENT_COMPLETE
      |
      v
CODE_VERIFIED
      |
      v
PR_CREATED
      |
      v
COMPLETE
```

Any validation failure:

```text
ANY VALIDATOR
      |
      v
HUMAN_REVIEW
      |
      | human resolves issue
      v
RESUME FROM LAST VALID STATE
```

---

# 19. Important Implementation Note for Claude Code

This file defines the workflow and contracts. It does not assume that one Claude agent can directly "call" another.

The Claude Code session acting as the orchestrator should execute the stages sequentially, using the artifacts in the ticket workspace as the explicit handoff between stages.

The conceptual model is:

```text
                    ORCHESTRATOR
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
    CR Agent         Architect         Developer
        |                |                |
        v                v                v
     CR.md        Technical Design    Code Changes
        |                |                |
        v                v                v
     Validator       Validator        Verification
        |                |                |
        +----------------+----------------+
                         |
                         v
                         PR
```

The orchestrator must never advance merely because an agent produced output. It must verify the output and pass the corresponding validation gate first.

The artifacts, validation JSON files, and `state.json` are the durable protocol between stages.

