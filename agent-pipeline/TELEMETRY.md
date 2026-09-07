# Agent Pipeline Telemetry

Langfuse instrumentation for Claude Agent SDK-based agents, built ahead of the
Jira-polling pipeline it's meant to observe. **This is telemetry only** - there
is no Jira integration or ticket-dispatch logic here. When that pipeline gets
built, it imports `ClaudeAgentSDK` and `withTicketTrace` from this module
instead of importing `@anthropic-ai/claude-agent-sdk` directly.

## Why this exists separately from the issue-tracker's MCP tracing

`application/issue-tracker/mcp-issue-tracker/mcp/telemetry/` traces MCP tool
calls (an unrelated app, no LLM calls). This traces actual Claude model
invocations - different unit of work, different data (tokens, cost, agent
steps), different unrelated codebase. Same Langfuse project can receive both;
they're just separate instrumentation surfaces.

## Setup

```bash
cd agent-pipeline/telemetry
npm install
cp .env.template .env   # fill in ANTHROPIC_API_KEY and LANGFUSE_* keys
```

## How a future pipeline hooks in

```js
import { ClaudeAgentSDK } from "./telemetry/instrumentation.js"; // NOT the raw SDK package
import { withTicketTrace } from "./telemetry/context.js";

const { query } = ClaudeAgentSDK;

for (const ticket of newTicketsFromJira) {
  await withTicketTrace(
    { key: ticket.key, summary: ticket.summary, source: "sprint-backlog-jql" },
    async () => {
      for await (const message of query({ prompt: buildPrompt(ticket), options: {...} })) {
        // handle messages
      }
    }
  );
}
```

Importing the raw `@anthropic-ai/claude-agent-sdk` package directly instead of
`ClaudeAgentSDK` from `instrumentation.js` silently skips tracing - the
OpenInference instrumentation patches a copy of the module's exports, and only
that patched copy is instrumented.

`withTicketTrace` groups every agent run for the same ticket into one Langfuse
session (`jira-<key>`), tags it (`jira-agent`, `ticket:<key>`, optionally
`source:<name>`), and names the trace from the ticket summary - so once the
pipeline exists, Langfuse's Sessions view shows the whole history of agent
attempts on one ticket, and the Users/Tags views can break down cost by JQL
source.

## What gets captured

The OpenInference `ClaudeAgentSDKInstrumentation` captures this automatically,
per Langfuse's documented integration - not something built here:

- Every model completion as a `generation` observation: model name, input/
  output token counts, cost
- Every tool call the agent makes, nested under its step
- Agent steps/loop structure

## Windows caveat carried over from the MCP tracing work

`exportMode: "immediate"` is set deliberately. A scheduled/short-lived pipeline
process can be killed by its scheduler at any point, and on Windows a killed
child process cannot run a graceful shutdown handler (no catchable `SIGTERM`) -
see `application/issue-tracker/mcp-issue-tracker/mcp/TRACING.md` for how this
was discovered. Immediate export avoids losing a whole run's traces to that.

## Verifying it works

```bash
npm run demo
```

Runs one trivial agent call (`"What is the capital of France?"`, no tool
access) wrapped in `withTicketTrace` with a fake ticket key (`DEMO-1`) - proves
the wiring end-to-end without touching Jira. Requires a real
`ANTHROPIC_API_KEY`; unlike the MCP server's tracing this can't be verified
fully offline, since it wraps the SDK's real model calls rather than
deterministic HTTP responses.

After running, allow ~15-30s for Langfuse's ingestion queue, then check the
trace in the UI or via `langfuse-cli` (see the MCP server's `TRACING.md` for
CLI usage patterns) - look for a trace named "Telemetry wiring smoke test"
with a nested `generation` observation carrying token usage and cost.
