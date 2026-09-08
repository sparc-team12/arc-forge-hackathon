/**
 * Langfuse tracing wrappers for the MCP server surface.
 *
 * Rather than editing all 13 tool registrations, we intercept
 * `server.registerTool` / `server.registerResource` once and wrap every handler
 * that passes through. New tools are traced automatically.
 *
 * Trace shape - one MCP tool call is one self-contained unit of work, so it is
 * one trace:
 *
 *   <tool-name>                (observation type: tool)   <- root
 *     └── request-issues-api   (observation type: span)   <- backend HTTP call
 *
 *   read-database-schema       (observation type: retriever)
 *
 * All traces from one client connection share a session id, and are attributed
 * to a pseudonymous user id derived from the caller's API key.
 */

import {
  propagateAttributes,
  startActiveObservation,
  startObservation,
} from "@langfuse/tracing";
import {
  SESSION_ID,
  SERVER_VERSION,
  tracingEnabled,
} from "./instrumentation.js";
import { redact, clientIdFromApiKey } from "./redact.js";

/** Feature dimension per tool, used as a Langfuse tag for per-area analytics. */
function featureOf(toolName) {
  const [head] = toolName.split("-");
  return head === "api" ? "auth" : head;
}

/**
 * Map a backend response onto a Langfuse observation level so failures are
 * filterable in the UI. `makeRequest` never throws - it returns `status: 0`
 * with an `error` field on network failure - so without this every call would
 * look successful.
 */
function levelFor(result) {
  const status = result?.status;
  if (typeof status !== "number" || status === 0) {
    return { level: "ERROR", statusMessage: result?.error || "request failed" };
  }
  if (status >= 500) return { level: "ERROR", statusMessage: `HTTP ${status}` };
  if (status >= 400) return { level: "WARNING", statusMessage: `HTTP ${status}` };
  return { level: "DEFAULT" };
}

/**
 * Tool handlers return MCP content envelopes whose text is a JSON blob. Parse
 * it back out so the trace shows the actual API response rather than an opaque
 * escaped string.
 *
 * `makeRequest`'s envelope also carries the raw response `headers` (connection,
 * keep-alive, date, ...) - transport noise a reviewer scanning the trace does
 * not need. Per Langfuse's best practice to keep observation output to what's
 * needed "at a glance" and park raw payloads in metadata instead, headers are
 * split out here rather than left inline in output.
 */
function unwrapToolResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text;
  if (typeof text !== "string") return { parsed: undefined, output: result, headers: undefined };
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && "headers" in parsed) {
      const { headers, ...rest } = parsed;
      return { parsed, output: rest, headers };
    }
    return { parsed, output: parsed, headers: undefined };
  } catch {
    return { parsed: undefined, output: text, headers: undefined };
  }
}

/**
 * Wrap the server's registration methods so every tool call and resource read
 * produces a Langfuse trace. No-op when credentials are absent.
 */
export function instrumentServer(server) {
  if (!tracingEnabled) return server;

  const registerTool = server.registerTool.bind(server);
  const registerResource = server.registerResource.bind(server);

  server.registerTool = (name, config, handler) => {
    // Tools declared without an inputSchema are called as handler(extra);
    // tools with one are called as handler(args, extra).
    const takesArgs = Boolean(config?.inputSchema);

    const tracedHandler = async (...args) => {
      const params = takesArgs ? args[0] ?? {} : {};

      return propagateAttributes(
        {
          sessionId: SESSION_ID,
          userId: clientIdFromApiKey(params.apiKey),
          traceName: name,
          version: SERVER_VERSION,
          tags: ["mcp", `feature:${featureOf(name)}`],
        },
        () =>
          startActiveObservation(
            name,
            async (span) => {
              // redact() drops apiKey before it can reach a span attribute.
              span.update({
                input: redact(params),
                metadata: { mcpTool: name, transport: "stdio" },
              });

              try {
                const result = await handler(...args);
                const { parsed, output, headers } = unwrapToolResult(result);

                span.update({
                  output: redact(output),
                  ...(headers ? { metadata: { responseHeaders: redact(headers) } } : {}),
                  ...levelFor(parsed),
                });
                return result;
              } catch (error) {
                span.update({
                  level: "ERROR",
                  statusMessage: error?.message || String(error),
                });
                throw error;
              }
            },
            { asType: "tool" }
          )
      );
    };

    return registerTool(name, config, tracedHandler);
  };

  server.registerResource = (name, uri, config, handler) => {
    const tracedHandler = async (...args) =>
      propagateAttributes(
        {
          sessionId: SESSION_ID,
          traceName: `read-${name}`,
          version: SERVER_VERSION,
          tags: ["mcp", "feature:resource"],
        },
        () =>
          startActiveObservation(
            `read-${name}`,
            async (span) => {
              span.update({
                input: { uri: String(args[0] ?? uri) },
                metadata: { mcpResource: name, transport: "stdio" },
              });

              try {
                const result = await handler(...args);
                span.update({
                  output: redact(result?.contents?.[0]?.text ?? result),
                });
                return result;
              } catch (error) {
                span.update({
                  level: "ERROR",
                  statusMessage: error?.message || String(error),
                });
                throw error;
              }
            },
            // A schema lookup only reads data back - "retriever" is the
            // specific type for that, and drives the Agent Graph correctly.
            { asType: "retriever" }
          )
      );

    return registerResource(name, uri, config, tracedHandler);
  };

  return server;
}

/**
 * Wrap the backend HTTP call as a child span of the active tool observation.
 *
 * This is the one nested span worth keeping: it separates MCP-layer overhead
 * from backend latency and records the status code, so a slow or failing tool
 * can be attributed without guesswork.
 */
export async function traceBackendRequest({ method, url, body }, execute) {
  if (!tracingEnabled) return execute();

  const span = startObservation("request-issues-api", {
    input: { method, url: stripQuerySecrets(url), body: redact(body) },
  });

  try {
    const result = await execute();
    span.update({
      output: redact({ status: result?.status, data: result?.data }),
      ...levelFor(result),
    });
    return result;
  } catch (error) {
    span.update({
      level: "ERROR",
      statusMessage: error?.message || String(error),
    });
    throw error;
  } finally {
    span.end();
  }
}

/** Query strings are user-controlled; drop any credential-ish parameters. */
function stripQuerySecrets(url) {
  try {
    const parsed = new URL(url);
    for (const key of [...parsed.searchParams.keys()]) {
      if (/api[-_]?key|token|secret|password/i.test(key)) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}
