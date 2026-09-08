# Claude Code → Langfuse OTel Relay

Why this exists: Claude Code's native telemetry (`.claude/settings.json`)
exports directly to an OTLP endpoint. Pointed straight at Langfuse, traces
show up correctly typed as `Generation` and the model gets matched to a
price - but **cost is never computed**, because Claude Code names its token
attributes plainly (`input_tokens`, `output_tokens`, `cache_read_tokens`,
`cache_creation_tokens`) and Langfuse's cost engine only parses the
`gen_ai.usage.*`-namespaced names. Verified directly against the live
endpoint before building this - not assumed from docs.

This relay sits in between, adds the correctly-named attributes alongside
the originals (non-destructive), and forwards to the real Langfuse endpoint.

## Verified attribute mapping

| Claude Code emits | Langfuse parses | Note |
|---|---|---|
| `input_tokens` | `gen_ai.usage.input_tokens` | confirmed to compute cost end-to-end |
| `output_tokens` | `gen_ai.usage.output_tokens` | confirmed to compute cost end-to-end |
| `cache_read_tokens` | `gen_ai.usage.cache_read_tokens` | per Langfuse's documented accepted names |
| `cache_creation_tokens` | `gen_ai.usage.cache_write_tokens` | per Langfuse's documented accepted names |

Langfuse then subtracts cache amounts from the base input count itself
(correct behavior - cache reads/writes are priced differently from fresh
input, matching Anthropic's real pricing) - the relay doesn't need to do
that subtraction itself.

## Running it

```bash
node .claude/otel-relay.js
```

**Must be running before any Claude Code session starts.** `.claude/settings.json`
points `OTEL_EXPORTER_OTLP_ENDPOINT` at `http://localhost:4318` (the relay),
not at Langfuse directly. If the relay isn't running, telemetry export just
fails silently - same as any other export failure, Claude Code itself is
completely unaffected.

This is a real operational tradeoff worth being upfront about: before this,
telemetry was pure config with zero runtime footprint. Now it needs a
background process running whenever you want telemetry captured. Nothing
enforces that it's running - forgetting to start it doesn't break anything,
it just means no data reaches Langfuse for that session.

Credentials come from `.claude/otel.env` (gitignored) - the same file
`otel-headers.sh` used before this existed. No separate `otelHeadersHelper`
config is needed any more; Claude Code's side is unauthenticated (talks to
localhost only), and the relay adds the real `Authorization` header only on
the outbound leg to Langfuse.

## Verified live, end-to-end

Ran a real headless session (`claude -p "..."`) through the relay and
confirmed the resulting `claude_code.llm_request` generation in Langfuse
carried a fully computed cost breakdown - not just a trace with a null price.
