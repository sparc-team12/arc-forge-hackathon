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

| Stage | Agent | Output | Jira label |
|---|---|---|---|
| Jira retrieval | Orchestrator (`mcp__atlassian__getJiraIssue`) | `01-jira.md` | — |
| Requirements validation | `requirements-validator` | `01-requirements-validation.json` | `agent:requirements-validator` |
| CR generation | `cr-agent` | `02-cr.md` | `agent:cr-agent` |
| CR validation | `cr-validator` | `03-cr-validation.json` | `agent:cr-validator` |
| Architecture | `solution-architect` | `04-technical-design.md` | `agent:solution-architect` |
| Architecture validation | `architecture-validator` | `05-architecture-validation.json` | `agent:architecture-validator` |
| Development | `developer` | `06-implementation.md` | `agent:developer` |
| Code review | `code-reviewer` | `07-code-verification.json` | `agent:code-verification` |
| Test verification | `test-verifier` | `07-code-verification.json` | `agent:code-verification` |
| PR | `pr-agent` | `08-pr.md` | `agent:pr-agent` |

## Jira progress updates

Before invoking each stage's agent, swap the Jira label: remove the previous stage's label, add the current stage's label (`mcp__atlassian__editJiraIssue`). Track the currently-applied label in `state.json.jira_label`.

After each stage's output is verified and gated, post a Jira comment (`mcp__atlassian__addCommentToJiraIssue`) stating SUCCESS or FAILURE, with the stage's JSON result embedded as a code block (no attachment API is available, so embedding is the delivery mechanism). On FAILURE, include a one-line description and a one-line cause.

The full label table, comment template, and the JSON-embedding rules (including the companion `.status.json` used for `.md`-only stages) are defined in `workflow.md` §4a — treat it as the source of truth; this file only summarizes it.

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
