/**
 * Redaction helpers shared by the tracing wrappers and the export-time mask.
 *
 * Every tool in this MCP server takes an `apiKey` argument and forwards it as an
 * `x-api-key` header, so secrets are present on essentially every code path we
 * trace. Redaction is therefore applied in two independent layers:
 *
 *   1. At capture time (`redact`) - secrets are stripped before they are ever
 *      attached to a span. This is the layer that actually matters.
 *   2. At export time (`mask`, wired into LangfuseSpanProcessor) - a last-resort
 *      net for anything a future tool forgets to strip.
 */

import { createHash } from "crypto";

export const REDACTED = "[REDACTED]";

/** Object keys whose values must never leave the process. */
const SECRET_KEY_PATTERN =
  /^(api[-_]?key|x-api-key|key|authorization|cookie|set-cookie|token|access[-_]?token|refresh[-_]?token|secret|password|passwd|session|auth)$/i;

/** Bare string shapes that look like credentials even outside a known key. */
const SECRET_VALUE_PATTERNS = [
  /\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g, // Langfuse / OpenAI style keys
  /\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi, // bearer tokens
];

const MAX_DEPTH = 12;

/**
 * Recursively copy `value`, replacing anything secret with `[REDACTED]`.
 * Never throws - redaction failing open would leak, so it fails closed.
 */
export function redact(value, depth = 0) {
  try {
    if (depth > MAX_DEPTH) return "[TRUNCATED]";
    if (value == null) return value;

    if (typeof value === "string") return redactString(value);
    if (typeof value !== "object") return value;

    if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redact(val, depth + 1);
    }
    return out;
  } catch {
    return REDACTED;
  }
}

function redactString(str) {
  let out = str;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

/**
 * Export-time mask for LangfuseSpanProcessor.
 *
 * Langfuse hands us the already-serialised value of the input/output/metadata
 * span attributes, so this is normally a JSON string. Parse it when we can so
 * key-based redaction still applies, and fall back to pattern matching on the
 * raw string otherwise.
 */
export function mask({ data }) {
  try {
    if (typeof data === "string") {
      try {
        return JSON.stringify(redact(JSON.parse(data)));
      } catch {
        return redactString(data);
      }
    }
    return redact(data);
  } catch {
    return REDACTED;
  }
}

/**
 * Derive a stable, non-reversible identifier for the caller from their API key.
 *
 * Lets Langfuse attribute traces and cost per client (Users view) without the
 * key itself ever being sent.
 */
export function clientIdFromApiKey(apiKey) {
  if (typeof apiKey !== "string" || apiKey.length === 0) return undefined;
  return `key_${createHash("sha256").update(apiKey).digest("hex").slice(0, 16)}`;
}
