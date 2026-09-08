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

## Adaptation points

The agent prompts intentionally avoid assuming a particular Jira integration, Git provider, framework, or language.

Configure the Jira retrieval and PR creation portions to use the tools available in your Claude Code environment.

Before demonstrating against a real repository, test the workflow against a small, disposable CR and ensure the available Jira/Git tooling is authenticated.
