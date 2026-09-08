---
description: Run the agentic CR workflow for a Jira ticket.
---

# Work Ticket

Execute the workflow defined in `workflow.md` for the Jira ticket supplied after this command.

Example:

```text
/work-ticket AC-12
```

## Orchestrator responsibilities

You are the workflow orchestrator.

Do not perform all specialist work yourself. Delegate specialist stages to the agents in `.claude/agents/`.

Create/use:

```text
workspaces/<TICKET_ID>/
```

Maintain:

```text
workspaces/<TICKET_ID>/state.json
```

The workflow is fail-closed.

## Execution

1. Parse the Jira ticket ID.
2. Read `workflow.md`.
3. Initialize or resume `state.json`.
4. Execute the next incomplete stage.
5. Verify the expected artifact exists.
6. Read the artifact.
7. For validation stages, require `status == PASS`.
8. Update state.
9. Proceed only when the gate passes.

### Stage mapping

| Stage | Agent | Output |
|---|---|---|
| Jira retrieval | Jira-capable tooling | `01-jira.md` |
| Requirements validation | `requirements-validator` | `01-requirements-validation.json` |
| CR generation | `cr-agent` | `02-cr.md` |
| CR validation | `cr-validator` | `03-cr-validation.json` |
| Architecture | `solution-architect` | `04-technical-design.md` |
| Architecture validation | `architecture-validator` | `05-architecture-validation.json` |
| Development | `developer` | `06-implementation.md` |
| Code review | `code-reviewer` | `07-code-verification.json` |
| Test verification | `test-verifier` | `07-code-verification.json` |
| PR | `pr-agent` | `08-pr.md` |

## Validation gates

The following must be PASS before proceeding:

```text
01-requirements-validation.json
03-cr-validation.json
05-architecture-validation.json
07-code-verification.json
```

If a gate returns FAIL or BLOCKED:

1. Update `state.json` to `HUMAN_REVIEW`.
2. Set `human_intervention_required` to true.
3. Stop.
4. Display the blocking findings.
5. Preserve all artifacts.
6. Resume from the last valid state when the user reruns the command.

## Development safety

Before development, ensure the working tree is understood.

Never allow the developer or PR agent to overwrite or commit unrelated pre-existing user changes.

## Verification

After code-reviewer and test-verifier complete, combine their findings into `07-code-verification.json`.

Overall status is:

```text
PASS only if BOTH reviewers PASS.
FAIL if either reviewer FAILS.
```

## Completion

Only create the PR when the overall verification status is PASS.

After the PR is created:

```text
status = COMPLETE
human_intervention_required = false
```

Display:

```text
WORKFLOW COMPLETE

Ticket: <ticket>

✓ Jira retrieved
✓ Requirements validated
✓ CR generated
✓ CR validated
✓ Architecture generated
✓ Architecture validated
✓ Implementation complete
✓ Code verified
✓ Pull request created

PR: <actual PR URL>
```

Never fabricate tool results, test results, commits, branches, or PR URLs.
