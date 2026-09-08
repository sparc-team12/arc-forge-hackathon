/**
 * Local OTLP relay: sits between Claude Code's native telemetry export and
 * Langfuse, rewriting Claude Code's plain attribute names (input_tokens,
 * output_tokens, cache_read_tokens, cache_creation_tokens) into the
 * `gen_ai.usage.*` names Langfuse's OTLP ingestion actually parses for cost
 * calculation. Without this, Langfuse correctly types the span as a
 * Generation and matches the model to a price, but never computes a cost -
 * verified directly against the live endpoint before building this (see
 * .claude/RELAY.md).
 *
 * Must be running before any Claude Code session starts - .claude/settings.json
 * points OTEL_EXPORTER_OTLP_ENDPOINT at this relay (http://localhost:4318),
 * not at Langfuse directly. If this isn't running, telemetry export fails
 * silently (Claude Code's own documented behavior) - Claude Code itself is
 * completely unaffected either way.
 *
 *   node .claude/otel-relay.js
 */
import http from "http";
import https from "https";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.OTEL_RELAY_PORT || 4318);

function loadCreds() {
  const envPath = path.join(DIR, "otel.env");
  if (!existsSync(envPath)) return null;
  const vars = {};
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  if (!vars.LANGFUSE_PUBLIC_KEY || !vars.LANGFUSE_SECRET_KEY) return null;
  return {
    baseUrl: vars.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
    authHeader:
      "Basic " + Buffer.from(`${vars.LANGFUSE_PUBLIC_KEY}:${vars.LANGFUSE_SECRET_KEY}`).toString("base64"),
  };
}

// Claude Code's native attribute name -> the gen_ai.usage.* name Langfuse's
// cost engine parses. Verified empirically against the live Langfuse OTLP
// endpoint (input/output confirmed to compute cost end-to-end; cache names
// per Langfuse's documented accepted variants).
const USAGE_ATTR_MAP = {
  input_tokens: "gen_ai.usage.input_tokens",
  output_tokens: "gen_ai.usage.output_tokens",
  cache_read_tokens: "gen_ai.usage.cache_read_tokens",
  cache_creation_tokens: "gen_ai.usage.cache_write_tokens",
};

function attrValue(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("intValue" in v) return v.intValue;
  if ("doubleValue" in v) return v.doubleValue;
  if ("boolValue" in v) return v.boolValue;
  return undefined;
}

function makeIntAttr(key, value) {
  return { key, value: { intValue: String(value) } };
}

/** Non-destructive: adds gen_ai.usage.* copies alongside Claude Code's originals. */
function rewriteUsageAttributes(payload) {
  let rewritten = 0;
  for (const rs of payload.resourceSpans || []) {
    for (const ss of rs.scopeSpans || []) {
      for (const span of ss.spans || []) {
        const attrs = span.attributes || [];
        const byKey = Object.fromEntries(attrs.map((a) => [a.key, a]));
        const additions = [];
        for (const [nativeKey, targetKey] of Object.entries(USAGE_ATTR_MAP)) {
          if (byKey[nativeKey] && !byKey[targetKey]) {
            const value = attrValue(byKey[nativeKey].value);
            if (typeof value === "number" || /^\d+$/.test(String(value))) {
              additions.push(makeIntAttr(targetKey, value));
            }
          }
        }
        if (additions.length) {
          span.attributes = [...attrs, ...additions];
          rewritten++;
        }
      }
    }
  }
  return rewritten;
}

function forward(pathname, body, creds) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `${creds.baseUrl}${pathname}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: creds.authHeader,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const creds = loadCreds();
  if (!creds) {
    console.error("[otel-relay] no credentials in .claude/otel.env - dropping request");
    res.writeHead(503).end();
    return;
  }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      if (req.url === "/v1/traces") {
        const payload = JSON.parse(body);
        const rewritten = rewriteUsageAttributes(payload);
        const outBody = JSON.stringify(payload);
        const result = await forward("/api/public/otel/v1/traces", outBody, creds);
        console.error(
          `[otel-relay] /v1/traces: ${rewritten} span(s) rewritten, upstream ${result.status}`
        );
        res.writeHead(result.status, { "Content-Type": "application/json" }).end(result.data);
      } else if (req.url === "/v1/metrics") {
        const result = await forward("/api/public/otel/v1/metrics", body, creds);
        console.error(`[otel-relay] /v1/metrics: upstream ${result.status}`);
        res.writeHead(result.status, { "Content-Type": "application/json" }).end(result.data);
      } else {
        res.writeHead(404).end();
      }
    } catch (error) {
      console.error("[otel-relay] error:", error.message);
      res.writeHead(500).end();
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`[otel-relay] listening on http://127.0.0.1:${PORT}`);
});
