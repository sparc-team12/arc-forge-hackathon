/**
 * Redaction for the agent-pipeline telemetry, applied as LangfuseSpanProcessor's
 * export-time `mask` hook.
 *
 * Unlike the MCP server's tracing (where every argument is already known and
 * redacted at capture time), this instrumentation is generic: the
 * OpenInference ClaudeAgentSDKInstrumentation captures whatever the agent
 * reads and writes - ticket contents, file contents, tool arguments - none of
 * which this module controls the shape of. Export-time masking is therefore
 * the primary defense here, not a backstop.
 */

export const REDACTED = "[REDACTED]";

const SECRET_KEY_PATTERN =
  /^(api[-_]?key|authorization|cookie|set-cookie|token|access[-_]?token|refresh[-_]?token|secret|password|passwd|anthropic[-_]?api[-_]?key)$/i;

const SECRET_VALUE_PATTERNS = [
  /\b(sk|pk)-(ant|lf)-[A-Za-z0-9_-]{8,}\b/g, // Anthropic / Langfuse key formats
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi,
];

const MAX_DEPTH = 12;

function redactValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value == null) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => redactValue(v, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redactValue(val, depth + 1);
  }
  return out;
}

function redactString(str) {
  let out = str;
  for (const pattern of SECRET_VALUE_PATTERNS) out = out.replace(pattern, REDACTED);
  return out;
}

/** LangfuseSpanProcessor `mask` hook - never throws, fails closed on error. */
export function mask({ data }) {
  try {
    if (typeof data === "string") {
      try {
        return JSON.stringify(redactValue(JSON.parse(data)));
      } catch {
        return redactString(data);
      }
    }
    return redactValue(data);
  } catch {
    return REDACTED;
  }
}
