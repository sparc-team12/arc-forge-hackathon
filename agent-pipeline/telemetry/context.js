/**
 * The hook point a future Jira-polling pipeline calls into.
 *
 * This module does not know what a "ticket" is, how it was fetched, or what
 * the agent does with it - it only attaches trace context around whatever
 * agent call happens inside `fn`. Every OpenTelemetry span the Claude Agent
 * SDK instrumentation creates during that call (agent steps, tool calls,
 * model completions, tokens, cost) inherits this context automatically.
 */
import { propagateAttributes, startActiveObservation } from "@langfuse/tracing";
import { SERVER_VERSION } from "./instrumentation.js";

/**
 * @param {object} ticket
 * @param {string} ticket.key - Ticket identifier, e.g. "PROJ-123". Becomes the
 *   session id, so every agent run for the same ticket groups together in
 *   Langfuse's Sessions view even across retries.
 * @param {string} [ticket.summary] - Short human-readable description, used as
 *   the trace name. Falls back to the ticket key if omitted.
 * @param {string} [ticket.source] - How the ticket was found, e.g. a JQL
 *   filter name. Recorded as a tag for per-source dashboards.
 * @param {Record<string,string>} [ticket.metadata] - Any other short string
 *   context worth having on every span for this run (e.g. project key,
 *   priority). Keep it small - this is metadata, not the ticket body.
 * @param {() => Promise<T>} fn - The agent invocation to run under this context.
 * @returns {Promise<T>}
 */
export async function withTicketTrace(ticket, fn) {
  const { key, summary, source, metadata = {} } = ticket;
  if (!key) throw new Error("withTicketTrace: ticket.key is required");
  const name = summary || key;

  return propagateAttributes(
    {
      sessionId: `jira-${key}`,
      traceName: name,
      version: SERVER_VERSION,
      tags: ["jira-agent", `ticket:${key}`, ...(source ? [`source:${source}`] : [])],
      metadata: { ticketKey: key, ...metadata },
    },
    () =>
      // A real active span, not just propagated attributes - this is what the
      // Agent SDK's W3C trace-context auto-injection (see
      // native-cli-telemetry.js) actually detects and nests under when
      // ENABLE_NATIVE_CLI_TELEMETRY is on. asType "agent" per Langfuse's own
      // guidance: a subagent's execution is typed `agent`, not `tool`/`span`,
      // so it shows up as its own node in the Agent Graph.
      startActiveObservation(name, () => fn(), { asType: "agent" })
  );
}
