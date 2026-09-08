# Agent Pipeline Telemetry

> **PARKED** - see `../README.md` for the isolation guarantee. The Jira
> pipeline this was built for was not implemented; this is telemetry-only
> wiring kept in case that work resumes, and it is sectioned off from the
> rest of the repo - nothing here runs unless you run it by hand.

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
they're just separate instrumentation surfaces. See `../README.md` for exactly
how the two are kept from interfering with each other.

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

## Two telemetry sources, not one

There are actually two independent, complementary ways data reaches Langfuse
here - understanding the difference matters before turning both on.

**OpenInference (default, always on):** `instrumentation.js` patches the SDK's
JS exports so this Node process observes the agent's message stream and
constructs Langfuse's `generation`/`tool` observations itself. This is
[Langfuse's own documented integration](https://langfuse.com/integrations/frameworks/claude-agent-sdk-js)
for the Agent SDK and is what gives clean, correctly-typed cost/token data.

**Native CLI export (opt-in, `ENABLE_NATIVE_CLI_TELEMETRY=1`):** per
[Anthropic's official Agent SDK observability guide](https://code.claude.com/docs/en/agent-sdk/observability),
the Agent SDK runs the Claude Code CLI as a child process, and that CLI has
its own first-party OpenTelemetry instrumentation - it exports directly to an
OTLP endpoint, bypassing this Node process entirely. `native-cli-telemetry.js`
points that export straight at Langfuse. This surfaces things OpenInference
structurally cannot see, because it never inspects CLI internals: permission-
wait spans, hook execution, and the `tool_decision`/security audit-event
stream.

**Why it's opt-in, not merged into the default:** with both on, the same
model call gets described by two independent observations in Langfuse -
OpenInference's `generation` and the CLI's own `claude_code.llm_request`. Both
carry cost. Great for browsing either one's view of a trace; sum cost across
*both* and you'll double it. Turn it on when you specifically want the audit/
hook visibility and are prepared to pick one source for cost reporting.

**A fact worth knowing before you touch this:** Langfuse's OTLP endpoint
accepts traces (`/v1/traces`) and metrics (`/v1/metrics`) but returns a plain
404 for logs (`/v1/logs`) - verified directly against the live endpoint, not
assumed from docs. The Agent SDK's docs warn the CLI drops export errors
silently by default, so pointing `OTEL_LOGS_EXPORTER` at Langfuse would look
configured and do nothing. `native-cli-telemetry.js` deliberately leaves it
unset. If you want the log-event stream (prompts, tool results, security
events), it needs a separate OTel collector destination - Langfuse isn't one
for that signal.

Traces from the native path are beta (`CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`,
set automatically when you pass `{ traces: true }` to `nativeCliTelemetryEnv`)
- Anthropic's own docs say span names and attributes may change between
releases.

## Windows caveat carried over from the MCP tracing work

`exportMode: "immediate"` is set deliberately. A scheduled/short-lived pipeline
process can be killed by its scheduler at any point, and on Windows a killed
child process cannot run a graceful shutdown handler (no catchable `SIGTERM`) -
see `application/issue-tracker/mcp-issue-tracker/mcp/TRACING.md` for how this
was discovered. Immediate export avoids losing a whole run's traces to that.

The native CLI path has the same underlying risk for a different reason: it
batches on an interval (60s for metrics, 5s for traces by default) rather than
exporting per-span, and Anthropic's own docs call out that a killed process
loses whatever's still in the batch buffer. There's no per-signal "immediate"
switch there, so `nativeCliTelemetryEnv` shortens the interval to 1s instead
(`OTEL_METRIC_EXPORT_INTERVAL` / `OTEL_TRACES_EXPORT_INTERVAL`) - Anthropic's
own recommended mitigation for exactly this case.

## Verifying it works

```bash
npm run demo
# or, to also exercise the native CLI export path:
ENABLE_NATIVE_CLI_TELEMETRY=1 npm run demo
```

Runs one trivial agent call (`"What is the capital of France?"`, no tool
access) wrapped in `withTicketTrace` with a fake ticket key (`DEMO-1`) - proves
the wiring end-to-end without touching Jira. Requires a real
`ANTHROPIC_API_KEY`; unlike the MCP server's tracing this can't be verified
fully offline, since it wraps the SDK's real model calls rather than
deterministic HTTP responses. This has been wiring-verified (env construction,
Basic-auth header format checked byte-for-byte against what Langfuse expects,
Langfuse's OTLP endpoints probed directly) but not yet run against a real
model call - that's still pending a working `ANTHROPIC_API_KEY`.

After running, allow ~15-30s for Langfuse's ingestion queue, then check the
trace in the UI or via `langfuse-cli` (see the MCP server's `TRACING.md` for
CLI usage patterns) - look for a trace named "Telemetry wiring smoke test"
with a nested `generation` observation carrying token usage and cost.
