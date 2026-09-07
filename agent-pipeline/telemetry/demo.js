/**
 * Proves the telemetry wiring works - NOT a Jira integration and not the
 * agent pipeline itself. Runs one trivial Claude Agent SDK call, wrapped in
 * withTicketTrace with a fake ticket key, so a real trace with token/cost
 * data lands in Langfuse. That's the entire point of this script.
 *
 *   node demo.js
 *
 * Requires ANTHROPIC_API_KEY and LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY in
 * .env (see .env.template).
 */
import { ClaudeAgentSDK, tracingEnabled, flushTraces } from "./instrumentation.js";
import { withTicketTrace } from "./context.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set - copy .env.template to .env and fill it in.");
  process.exit(1);
}
if (!tracingEnabled) {
  console.error("LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY not set - traces will not be sent.");
}

const { query } = ClaudeAgentSDK;

await withTicketTrace(
  { key: "DEMO-1", summary: "Telemetry wiring smoke test", source: "manual-demo" },
  async () => {
    for await (const message of query({
      prompt: "What is the capital of France? Answer in a single short sentence.",
      options: { model: "claude-sonnet-5", allowedTools: [] },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text") console.log("assistant:", block.text);
        }
      }
      if (message.type === "result") {
        console.log("result:", {
          durationMs: message.duration_ms,
          costUsd: message.total_cost_usd,
          usage: message.usage,
        });
      }
    }
  }
);

await flushTraces();
console.error("done - trace sent (allow ~15-30s for it to become queryable in Langfuse).");
