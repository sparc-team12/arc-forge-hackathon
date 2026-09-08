/**
 * PARKED - see ../README.md. Langfuse telemetry for Claude Agent SDK-based
 * agents; the Jira pipeline itself was not built. Kept only so the wiring
 * exists when/if that pipeline resumes.
 *
 * Deliberately sectioned off from the issue-tracker MCP server's tracing
 * (application/issue-tracker/mcp-issue-tracker/mcp/telemetry/): separate
 * directory, separate package.json/node_modules/.env, zero imports between
 * the two in either direction, and non-colliding Langfuse session/tag
 * namespacing (`jira-*` / `jira-agent` here vs `mcp-*` / `mcp` there) so
 * traces from each never get confused for the other's even inside the same
 * Langfuse project. Nothing outside this directory imports anything from it.
 *
 * This is the framework a future pipeline hooks into - it does not itself
 * poll Jira or decide what agents do. Import this module first (before
 * `@anthropic-ai/claude-agent-sdk`), then wrap each agent invocation with
 * `withAgentTrace` from ./context.js so traces carry the right session/tags.
 *
 * Uses Langfuse's documented Claude Agent SDK integration: OpenInference's
 * ClaudeAgentSDKInstrumentation captures every agent step, tool call, and
 * model completion (with tokens/cost) as an OpenTelemetry span automatically -
 * https://langfuse.com/integrations/frameworks/claude-agent-sdk-js
 */

// Load THIS directory's .env explicitly - not process.cwd(). `dotenv/config`
// resolves relative to the current working directory, so a script invoked
// from elsewhere (e.g. the MCP server's directory, by mistake or by a future
// script that imports across directories) would silently load *that* .env
// instead of this one. An explicit path makes cross-loading impossible
// regardless of where this ever gets invoked from.
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), ".env") });

import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor, isDefaultExportSpan } from "@langfuse/otel";
import { ClaudeAgentSDKInstrumentation } from "@arizeai/openinference-instrumentation-claude-agent-sdk";
import * as ClaudeAgentSDKModule from "@anthropic-ai/claude-agent-sdk";
import { mask } from "./redact.js";

const OPENINFERENCE_SCOPE = "@arizeai/openinference-instrumentation-claude-agent-sdk";

const credentialsPresent = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
);

export const tracingEnabled = credentialsPresent;
export const SERVER_VERSION = process.env.AGENT_PIPELINE_VERSION || "0.1.0";

export let langfuseSpanProcessor;
let sdk;

/**
 * The Claude Agent SDK to actually call. `manuallyInstrument` patches a
 * mutable copy of the module's exports (a native ESM namespace object can't
 * be patched in place) and returns that patched copy - callers MUST use this
 * export, not `@anthropic-ai/claude-agent-sdk` directly, or every call
 * bypasses tracing entirely.
 */
export let ClaudeAgentSDK = ClaudeAgentSDKModule;

if (credentialsPresent) {
  const instrumentation = new ClaudeAgentSDKInstrumentation();
  ClaudeAgentSDK = instrumentation.manuallyInstrument({ ...ClaudeAgentSDKModule });

  langfuseSpanProcessor = new LangfuseSpanProcessor({
    mask,
    environment:
      process.env.LANGFUSE_TRACING_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.LANGFUSE_RELEASE || SERVER_VERSION,
    // The default filter only recognizes Langfuse's own spans plus a fixed
    // list of "known" LLM instrumentor scopes. OpenInference's Claude Agent
    // SDK instrumentation isn't on that list, so its spans would silently be
    // dropped without this override - this is Langfuse's own documented fix,
    // not a guess.
    shouldExportSpan: ({ otelSpan }) =>
      isDefaultExportSpan(otelSpan) ||
      otelSpan.instrumentationScope.name === OPENINFERENCE_SCOPE,
    // A pipeline invoking this per Jira ticket is expected to run as a
    // scheduled/short-lived job that can be killed by its scheduler at any
    // point - and on Windows a killed child process cannot run a graceful
    // shutdown handler (no catchable SIGTERM). "immediate" export avoids
    // losing a whole run's traces to that, at the cost of one extra small
    // HTTP request per span. See ../../application/issue-tracker/
    // mcp-issue-tracker/mcp/TRACING.md for how this was discovered.
    exportMode: "immediate",
  });

  sdk = new NodeSDK({
    spanProcessors: [langfuseSpanProcessor],
    instrumentations: [instrumentation],
  });
  sdk.start();

  registerShutdownHooks();
} else {
  console.error(
    "[langfuse] LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set - agent tracing disabled."
  );
}

function registerShutdownHooks() {
  let shuttingDown = false;
  const flushAndExit = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[langfuse] ${signal ?? "beforeExit"}: flushing traces...`);
    try {
      await sdk.shutdown();
      console.error("[langfuse] flush complete.");
    } catch (error) {
      console.error("[langfuse] failed to flush traces on exit:", error);
    }
    if (signal) process.exit(0);
  };

  process.once("SIGINT", () => flushAndExit("SIGINT"));
  process.once("SIGTERM", () => flushAndExit("SIGTERM"));
  process.once("beforeExit", () => flushAndExit(null));
}

/** Force-flush pending spans. Call before exit in any one-shot script. */
export async function flushTraces() {
  if (langfuseSpanProcessor) await langfuseSpanProcessor.forceFlush();
}
