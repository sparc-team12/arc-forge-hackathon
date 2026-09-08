# Agent Pipeline — PARKED

The Jira-polling + Claude-agent pipeline this was built for was **not
implemented**. What exists here is only the telemetry framework it would have
hooked into, kept in case that work resumes. Nothing in this directory runs
automatically, and nothing outside this directory depends on it.

## Isolation guarantee

This is deliberately sectioned off from the issue-tracker MCP server's own
tracing (`application/issue-tracker/mcp-issue-tracker/mcp/telemetry/`) and
from the rest of the app. Specifically:

- **No code imports either direction.** Nothing under `application/` imports
  anything from `agent-pipeline/`, and nothing here imports app code.
- **Fully separate dependencies.** Its own `package.json`, its own
  `node_modules`, installed independently.
- **Fully separate credentials.** Its own `.env` (gitignored), loaded by an
  explicit path derived from the script's own location - not the process's
  current working directory - so it cannot accidentally pick up the MCP
  server's `.env` (or vice versa) even if a script were ever invoked from the
  wrong directory. Verified directly: running `instrumentation.js` from a
  different working directory still loads only this directory's `.env`.
- **Non-colliding Langfuse naming**, even if both eventually point at the same
  Langfuse project: sessions here are prefixed `jira-*` and tagged
  `jira-agent`; the MCP server's are prefixed `mcp-*` and tagged `mcp`. Traces
  from one are never mistakable for the other's in the Langfuse UI.
- **Nothing runs unattended.** `telemetry/demo.js` is a one-shot script you
  run by hand (`npm run demo`) - there's no server, no scheduled job, no
  background process here to interfere with anything.

See `TELEMETRY.md` for what's actually in `telemetry/` and why.
