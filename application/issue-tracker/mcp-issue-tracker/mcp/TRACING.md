# Langfuse Tracing

Observability for the issues MCP server, built on the Langfuse JS/TS SDK v5
(OpenTelemetry-based).

## Setup

```bash
cd mcp
npm install
cp .env.template .env      # then fill in your Langfuse keys
```

Create a free project at <https://cloud.langfuse.com> and copy the key pair from
**Settings → API Keys** into `.env`:

```env
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

Tracing is **opt-in**: with no keys set the server logs one line to stderr and
runs exactly as before. Nothing else changes.

## Trace shape

One MCP tool call is one self-contained unit of work, so it is one trace:

```
issues-list                    observation type: tool       ← trace root
└── request-issues-api         observation type: span       ← backend HTTP call

read-database-schema           observation type: retriever
```

The nested backend span separates MCP-layer overhead from backend latency and
carries the HTTP status, so a slow or failing tool can be attributed without
guesswork.

Every trace carries:

| Attribute   | Value                                              | Why |
| ----------- | -------------------------------------------------- | --- |
| `sessionId` | one id per server process                          | An MCP stdio process serves one client connection, so this groups that whole conversation in the **Sessions** view |
| `userId`    | `key_<sha256(apiKey)[0:16]>`                       | Per-client attribution in the **Users** view without the key ever being sent |
| `traceName` | the MCP tool name                                  | The dimension you actually filter dashboards by |
| `tags`      | `mcp`, `feature:<issues\|tags\|users\|health\|auth\|resource>` | Per-area analytics |
| `version`   | MCP server version                                 | Correlate regressions with releases |

## Failure visibility

`makeRequest` never throws — it returns `status: 0` on network failure and
passes non-2xx responses through as normal values. Without explicit mapping
every call would look successful, so observation levels are set from the result:

| Condition            | Level     |
| -------------------- | --------- |
| network failure      | `ERROR`   |
| HTTP 5xx             | `ERROR`   |
| HTTP 4xx             | `WARNING` |
| thrown exception     | `ERROR`   |

Failures also carry a `statusMessage`. Filter by level in the Langfuse UI to
find them.

## Secret handling

Every tool takes an `apiKey` argument and forwards it as an `x-api-key` header,
so secrets touch nearly every traced path. Two independent layers apply:

1. **At capture time** — `redact()` strips credential-shaped keys and values
   before they are attached to a span. This is the layer that matters.
2. **At export time** — the same logic is wired into `LangfuseSpanProcessor`'s
   `mask` hook as a net for anything a future tool forgets to strip.

Both key-based (`apiKey`, `authorization`, `set-cookie`, `token`, …) and
value-based (`sk-…`, `Bearer …`) patterns are covered, recursively, including
response headers and URL query parameters.

## stdout is protected

MCP stdio uses **stdout** for JSON-RPC. A single stray `console.log` from any
dependency corrupts the protocol and the client drops the connection.
`telemetry/instrumentation.js` pins `console.log/info/debug/dir` to stderr
before anything else loads. The transport writes to `process.stdout` directly
and is unaffected.

## Verification

```bash
npm test
```

Runs two suites:

- **`verify:tracing`** — drives the real server over an in-memory transport with
  a stubbed backend and asserts on captured spans: observation types, nesting,
  trace grouping, session/user/tag propagation, error levels, and that neither
  the API key nor session cookies appear anywhere in span data. No credentials
  or running backend required.
- **`verify:stdio`** — spawns the real server both with and without tracing and
  completes a full stdio handshake, guarding against stdout corruption.

## Files

| File | Purpose |
| ---- | ------- |
| `telemetry/instrumentation.js` | SDK bootstrap, stdout guard, shutdown flushing. Must be the first import in `main.js`. |
| `telemetry/tracing.js` | Wraps `registerTool` / `registerResource` so every handler is traced automatically; new tools need no changes. |
| `telemetry/redact.js` | Redaction used at both capture and export time. |
| `telemetry/verify-*.js` | The two verification suites above. |
