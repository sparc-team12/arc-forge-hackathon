/**
 * Langfuse tracing bootstrap for the issues MCP server.
 *
 * MUST be the first import in main.js: the OpenTelemetry provider has to be
 * registered before any traced code runs, and credentials have to be loaded
 * before LangfuseSpanProcessor is constructed.
 */

// Load .env first so the processor below sees LANGFUSE_* credentials.
import "dotenv/config";

import { randomUUID } from "crypto";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { mask } from "./redact.js";

/**
 * This server speaks MCP over stdio, so stdout is a JSON-RPC channel - a stray
 * console.log from any dependency corrupts the protocol and the client drops
 * the connection. Pin the stdout-bound console methods to stderr before
 * anything else can write. The transport writes to process.stdout directly and
 * is unaffected.
 */
for (const method of ["log", "info", "debug", "dir"]) {
  console[method] = (...args) => console.error(...args);
}

const credentialsPresent = Boolean(
  process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY
);

/**
 * One MCP stdio process serves exactly one client connection, so a per-process
 * id groups every tool call from that connection into a single Langfuse
 * session. See https://langfuse.com/docs/tracing-features/sessions
 */
export const SESSION_ID = `mcp-${randomUUID()}`;

export const SERVER_VERSION = process.env.MCP_SERVER_VERSION || "1.0.0";

export const tracingEnabled = credentialsPresent;

export let langfuseSpanProcessor;
let sdk;

if (credentialsPresent) {
  langfuseSpanProcessor = new LangfuseSpanProcessor({
    // Export-time safety net; secrets are already stripped at capture time.
    mask,
    environment:
      process.env.LANGFUSE_TRACING_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "development",
    release: process.env.LANGFUSE_RELEASE || SERVER_VERSION,
    // Every stdio connection is a short-lived process that its MCP client can
    // terminate at any moment - and on Windows, killing a child process does
    // not deliver a catchable SIGTERM (Node/OS limitation), so the SIGINT/
    // SIGTERM handlers below never get a chance to flush a batch queue.
    // "immediate" exports each span right away instead, trading one extra
    // small HTTP request per span for not silently losing the whole session
    // on disconnect. Recommended by Langfuse for exactly this kind of
    // short-lived process.
    exportMode: "immediate",
  });

  // No auto-instrumentations: the only spans we want are the ones this server
  // creates deliberately. Langfuse best practice is to keep framework/HTTP
  // noise out of the trace tree.
  sdk = new NodeSDK({ spanProcessors: [langfuseSpanProcessor] });
  sdk.start();

  registerShutdownHooks();
} else {
  console.error(
    "[langfuse] LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY not set - tracing disabled."
  );
}

/**
 * A long-lived stdio server exits when the client disconnects, which can strand
 * spans still sitting in the batch queue. Flush on every exit path.
 */
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

/** Force-flush pending spans. Useful for tests and one-shot scripts. */
export async function flushTraces() {
  if (langfuseSpanProcessor) await langfuseSpanProcessor.forceFlush();
}
