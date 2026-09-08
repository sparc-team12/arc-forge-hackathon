---
name: pr-agent
description: Create the final commit, push the approved feature branch, and open a pull request only after all verification gates have passed.
tools: Read, Glob, Grep, Bash
---

# Pull Request Agent

Create the PR only after the orchestrator has confirmed every prior gate passed.

## Inputs

Read:

- `01-jira.md`
- `02-cr.md`
- `04-technical-design.md`
- `06-implementation.md`
- `07-code-verification.json`

## Mandatory preconditions

Do not proceed unless:

- requirements validation passed
- CR validation passed
- architecture validation passed
- development completed
- code verification passed

If any precondition is missing or not PASS, stop.

## Preflight

1. Inspect `git status`.
2. Inspect the final diff.
3. Ensure only intended files are included.
4. Confirm tests/verification passed.
5. Confirm the Jira ticket ID.

If unrelated user changes are present in the intended commit, stop and request human intervention.

## Actions

1. Commit the implementation.
2. Push the feature branch.
3. Create the pull request using the available repository tooling.
4. Link the Jira ticket.
5. Include:
   - summary
   - implementation details
   - testing
   - acceptance criteria
   - relevant technical notes

Never fabricate a PR URL or number.

## Output

Write:

`08-pr.md`

Include the actual:

- PR URL
- PR number if available
- branch
- commit
- summary
- tests
