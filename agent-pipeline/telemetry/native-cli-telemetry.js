/**
 * The Agent SDK's OFFICIAL telemetry path (per
 * https://code.claude.com/docs/en/agent-sdk/observability): the SDK runs the
 * Claude Code CLI as a child process, and the CLI itself has OpenTelemetry
 * instrumentation built in - metrics, log events, and (beta) traces exported
 * directly to any OTLP collector. This is separate from and complementary to
 * instrumentation.js's OpenInference-based Langfuse integration:
 *
 *  - OpenInference (instrumentation.js): observes the SDK's message stream
 *    from THIS Node process and constructs Langfuse's `generation`/`tool`
 *    observations with the token/cost semantics Langfuse expects. This is
 *    Langfuse's own documented integration and is the default.
 *
 *  - Native CLI export (this file): the CLI's own first-party telemetry -
 *    covers things OpenInference can't see because it never inspects CLI
 *    internals: permission-wait spans, hook execution, and the
 *    tool_decision/security audit-event stream. Off by default because
 *    running both means the same model calls get described by two
 *    independent spans in Langfuse (OpenInference's `generation` and the
 *    CLI's own `claude_code.llm_request`) - fine for browsing traces, but
 *    don't sum cost across both or you'll double-count. Turn on with
 *    ENABLE_NATIVE_CLI_TELEMETRY=1 if you want the audit/hook visibility and
 *    are aware of that overlap.
 *
 * Verified against Langfuse's actual OTLP endpoint before shipping this:
 * POST /api/public/otel/v1/traces  -> 200
 * POST /api/public/otel/v1/metrics -> 200
 * POST /api/public/otel/v1/logs    -> 404 (route doesn't exist)
 * So OTEL_LOGS_EXPORTER is deliberately left unset here - enabling it against
 * Langfuse would silently fail (the CLI drops export errors by default per
 * the doc's own warning) while looking configured.
 */
const nativeTelemetryEnabled = process.env.ENABLE_NATIVE_CLI_TELEMETRY === "1";

function requireLangfuseCreds() {
  const { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL } = process.env;
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY || !LANGFUSE_BASE_URL) {
    throw new Error(
      "nativeCliTelemetryEnv: LANGFUSE_PUBLIC_KEY/SECRET_KEY/BASE_URL must be set"
    );
  }
  return { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL };
}

/**
 * Env vars to merge into `options.env` for a `query()` call so the CLI
 * subprocess exports its native telemetry to Langfuse. No-op object (`{}`)
 * when ENABLE_NATIVE_CLI_TELEMETRY isn't set, so callers can unconditionally
 * spread the result.
 *
 * @param {object} [opts]
 * @param {string} [opts.serviceName] - Distinguishes this agent from other
 *   services exporting to the same project. Defaults to "jira-agent-pipeline".
 * @param {boolean} [opts.traces] - Also export the beta trace spans
 *   (claude_code.interaction / llm_request / tool / hook). Off by default -
 *   span shape is explicitly documented as unstable pre-GA.
 */
export function nativeCliTelemetryEnv({ serviceName = "jira-agent-pipeline", traces = false } = {}) {
  if (!nativeTelemetryEnabled) return {};

  const { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL } = requireLangfuseCreds();
  const authHeader = Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString("base64");

  const env = {
    CLAUDE_CODE_ENABLE_TELEMETRY: "1",
    OTEL_METRICS_EXPORTER: "otlp",
    // OTEL_LOGS_EXPORTER intentionally omitted - see file header.
    OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_ENDPOINT: `${LANGFUSE_BASE_URL}/api/public/otel`,
    OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Basic ${authHeader}`,
    OTEL_SERVICE_NAME: serviceName,
    OTEL_RESOURCE_ATTRIBUTES: `deployment.environment=${process.env.LANGFUSE_TRACING_ENVIRONMENT || "development"}`,
    // The CLI batches and exports on an interval (60s metrics / 5s traces
    // default); a killed short-lived process loses whatever's still
    // buffered. Same risk independently found and fixed for the MCP
    // server's tracing (see ../../application/issue-tracker/
    // mcp-issue-tracker/mcp/TRACING.md) - shortening the interval is the
    // doc's own recommended mitigation here, since there's no per-signal
    // "immediate" mode like the Langfuse JS SDK has.
    OTEL_METRIC_EXPORT_INTERVAL: "1000",
  };

  if (traces) {
    env.OTEL_TRACES_EXPORTER = "otlp";
    env.CLAUDE_CODE_ENHANCED_TELEMETRY_BETA = "1";
    env.OTEL_TRACES_EXPORT_INTERVAL = "1000";
  }

  return env;
}

/**
 * Attach a per-end-user identity to every span/event from one call, so
 * tool_decision/security audit events become a per-user trail rather than
 * being attributed only to the shared ANTHROPIC_API_KEY. Percent-encodes
 * values per the doc's requirement (OTEL_RESOURCE_ATTRIBUTES reserves
 * commas/spaces/equals). Merge the result's OTEL_RESOURCE_ATTRIBUTES with
 * any already set by nativeCliTelemetryEnv (comma-joined) rather than
 * overwriting it.
 */
export function endUserResourceAttributes({ userId, tenantId } = {}) {
  const parts = [];
  if (userId) parts.push(`enduser.id=${encodeURIComponent(userId)}`);
  if (tenantId) parts.push(`tenant.id=${encodeURIComponent(tenantId)}`);
  return parts.join(",");
}

export const nativeCliTelemetryEnabled = nativeTelemetryEnabled;
