# Agentic CR PoC for Claude Code

## Structure

```text
.claude/
├── agents/
│   ├── requirements-validator.md
│   ├── cr-agent.md
│   ├── cr-validator.md
│   ├── solution-architect.md
│   ├── architecture-validator.md
│   ├── developer.md
│   ├── code-reviewer.md
│   ├── test-verifier.md
│   └── pr-agent.md
└── commands/
    └── work-ticket.md

workflow.md
workspaces/
```

## Run

From the repository root:

```text
/work-ticket AC-12
```

The command acts as the orchestrator and delegates the specialist stages.

## Models

Each agent's frontmatter pins a `model:` tiered to the stakes of its task:

- `opus` — `solution-architect`, `developer` (highest-stakes reasoning/coding).
- `sonnet` — `requirements-validator`, `cr-agent`, `cr-validator`, `architecture-validator`, `code-reviewer`, `test-verifier` (structured document generation/validation).
- `haiku` — `pr-agent` (mostly mechanical: commit, push, open PR).

## Jira progress tracking

Subagents do not talk to Jira themselves and hold no Jira-write tools. The orchestrator (the `/work-ticket` command) swaps a Jira label as each stage starts and posts a success/failure comment (with the stage's JSON result embedded) as each stage completes. See `workflow.md` §4a for the full contract.

## Adaptation points

The agent prompts intentionally avoid assuming a particular Jira integration, Git provider, framework, or language.

Configure the Jira retrieval and PR creation portions to use the tools available in your Claude Code environment.

Before demonstrating against a real repository, test the workflow against a small, disposable CR and ensure the available Jira/Git tooling is authenticated.
