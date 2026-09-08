#!/usr/bin/env node
/**
 * Sits between the Claude Code CLI's native OTel export and Langfuse.
 *
 * Why this exists: Claude Code's `claude_code.llm_request` trace span carries
 * plain-named token attributes (`input_tokens`, `output_tokens`, ...), not
 * Langfuse's recognized `gen_ai.usage.*` / `llm.token_count.*` names, and it
 * carries NO cost attribute at all - cost only exists on the separate
 * `claude_code.cost.usage` OTel *metric*, which Langfuse's product doesn't
 * surface anywhere tied back to a trace. Even if the token attributes were
 * renamed, relying on Langfuse to auto-price the call requires Langfuse's
 * model-price table to already recognize the exact model string (e.g.
 * "claude-sonnet-5") - a bad bet for a model this new. So this proxy prices
 * the call itself, from a small local table, and writes the result directly
 * as `langfuse.observation.cost_details` / `usage_details` - Langfuse-native
 * attributes it reads verbatim, no inference required.
 *
 * Also (best-effort): Claude Code's `claude_code.tool` span already carries
 * `subagent_type` for Agent/Task tool dispatches (gated by
 * OTEL_LOG_TOOL_DETAILS=1, which run-orchestrator.ps1 sets). Langfuse's Agent
 * Graph only picks a span as its own agent node when it's typed `agent` and
 * distinctly named - plain `tool`-typed spans all called "claude_code.tool"
 * collapse into one indistinguishable node - so this proxy retypes and
 * renames those spans too. Whether this fully renders as separate Agent
 * Graph nodes hasn't been verified against a live Langfuse project; cost is
 * the guaranteed part of this fix, agent identification is the bonus.
 *
 * Protocol note: this only works because run-orchestrator.ps1 sets
 * OTEL_EXPORTER_OTLP_PROTOCOL=http/json - the CLI sends plain JSON bodies
 * (protobuf-JSON mapping) that are trivial to walk and mutate. Switching that
 * env var to a binary protocol would silently break this proxy.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// USD per 1M tokens. Source: Anthropic's published API pricing.
// Extend this table (or override via env) as new model ids ship.
const PRICING = {
  "claude-fable-5-1": { input: 10.0, output: 50.0 },
  "claude-mythos-5-1": { input: 10.0, output: 50.0 },
  "claude-fable-5": { input: 10.0, output: 50.0 },
  "claude-opus-5": { input: 5.0, output: 25.0 },
  "claude-opus-4-8": { input: 5.0, output: 25.0 },
  "claude-opus-4-7": { input: 5.0, output: 25.0 },
  "claude-opus-4-6": { input: 5.0, output: 25.0 },
  "claude-sonnet-5": { input: 2.0, output: 10.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
};

// Standard Anthropic prompt-caching multipliers of the base input price.
// Claude Code's span does not distinguish 5m vs 1h cache writes, so this
// blends to the more common 5m (1.25x) tier - an approximation, not exact.
const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function attrValue(v) {
  if (v == null) return undefined;
  if ("stringValue" in v) return v.stringValue;
  if ("intValue" in v) return Number(v.intValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("boolValue" in v) return v.boolValue;
  return undefined;
}

function getAttr(attrs, key) {
  const found = (attrs || []).find((a) => a.key === key);
  return found ? attrValue(found.value) : undefined;
}

function setAttr(attrs, key, value) {
  const av =
    typeof value === "number"
      ? Number.isInteger(value)
        ? { intValue: String(value) }
        : { doubleValue: value }
      : typeof value === "boolean"
      ? { boolValue: value }
      : { stringValue: String(value) };
  const existing = attrs.find((a) => a.key === key);
  if (existing) existing.value = av;
  else attrs.push({ key, value: av });
}

function transformTraces(body) {
  for (const rs of body.resourceSpans || []) {
    for (const ss of rs.scopeSpans || []) {
      for (const span of ss.spans || []) {
        const attrs = span.attributes || (span.attributes = []);

        if (span.name === "claude_code.llm_request") {
          const model = getAttr(attrs, "model") || getAttr(attrs, "gen_ai.request.model");
          const inputTokens = getAttr(attrs, "input_tokens") || 0;
          const outputTokens = getAttr(attrs, "output_tokens") || 0;
          const cacheRead = getAttr(attrs, "cache_read_tokens") || 0;
          const cacheWrite = getAttr(attrs, "cache_creation_tokens") || 0;
          const price = PRICING[model];

          if (price) {
            const inputCost = (inputTokens / 1e6) * price.input;
            const outputCost = (outputTokens / 1e6) * price.output;
            const cacheReadCost = (cacheRead / 1e6) * price.input * CACHE_READ_MULTIPLIER;
            const cacheWriteCost = (cacheWrite / 1e6) * price.input * CACHE_WRITE_MULTIPLIER;
            const totalInputCost = inputCost + cacheReadCost + cacheWriteCost;
            const totalCost = totalInputCost + outputCost;

            setAttr(
              attrs,
              "langfuse.observation.usage_details",
              JSON.stringify({
                input: inputTokens,
                output: outputTokens,
                cache_read_input_tokens: cacheRead,
                cache_creation_input_tokens: cacheWrite,
                total: inputTokens + outputTokens + cacheRead + cacheWrite,
              })
            );
            setAttr(
              attrs,
              "langfuse.observation.cost_details",
              JSON.stringify({
                input: round6(totalInputCost),
                output: round6(outputCost),
                total: round6(totalCost),
              })
            );
          } else if (model) {
            process.stderr.write(
              `[otel-cost-proxy] no price entry for model "${model}" - cost left blank for span ${span.spanId}\n`
            );
          }
        } else if (span.name === "claude_code.tool") {
          const subagentType = getAttr(attrs, "subagent_type");
          if (subagentType) {
            setAttr(attrs, "langfuse.observation.type", "agent");
            span.name = `subagent:${subagentType}`;
          }
        }
      }
    }
  }
  return body;
}

function forward(pathName, bodyBuf, res, upstreamBase, authHeader) {
  const url = new URL(upstreamBase + pathName);
  const upReq = https.request(
    {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        "Content-Length": Buffer.byteLength(bodyBuf),
      },
    },
    (upRes) => {
      const chunks = [];
      upRes.on("data", (c) => chunks.push(c));
      upRes.on("end", () => {
        res.writeHead(upRes.statusCode || 502, { "Content-Type": "application/json" });
        res.end(Buffer.concat(chunks));
      });
    }
  );
  upReq.on("error", (err) => {
    console.error(`[otel-cost-proxy] upstream forward to ${pathName} failed: ${err.message}`);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  upReq.write(bodyBuf);
  upReq.end();
}

function createServer(upstreamBase, authHeader) {
  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200);
      res.end("ok");
      return;
    }

    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks);

      if (req.url === "/v1/traces") {
        let body;
        try {
          body = JSON.parse(raw.toString("utf8"));
        } catch (err) {
          console.error(`[otel-cost-proxy] non-JSON trace payload, forwarding untouched: ${err.message}`);
          forward("/v1/traces", raw, res, upstreamBase, authHeader);
          return;
        }
        forward(
          "/v1/traces",
          Buffer.from(JSON.stringify(transformTraces(body))),
          res,
          upstreamBase,
          authHeader
        );
      } else if (req.url === "/v1/metrics") {
        forward("/v1/metrics", raw, res, upstreamBase, authHeader);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
  });
}

function main() {
  const PORT = Number(process.env.OTEL_COST_PROXY_PORT || 4319);

  const settingsLocalPath = path.join(__dirname, "..", ".claude", "settings.local.json");
  let settingsLocal;
  try {
    settingsLocal = JSON.parse(fs.readFileSync(settingsLocalPath, "utf8"));
  } catch (err) {
    console.error(`[otel-cost-proxy] cannot read ${settingsLocalPath}: ${err.message}`);
    process.exit(1);
  }
  const { LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL } = settingsLocal.env || {};
  if (!LANGFUSE_PUBLIC_KEY || !LANGFUSE_SECRET_KEY) {
    console.error(
      `[otel-cost-proxy] LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY missing from ${settingsLocalPath}`
    );
    process.exit(1);
  }

  const upstreamBase = `${LANGFUSE_BASE_URL || "https://cloud.langfuse.com"}/api/public/otel`;
  const authHeader =
    "Basic " + Buffer.from(`${LANGFUSE_PUBLIC_KEY}:${LANGFUSE_SECRET_KEY}`).toString("base64");

  createServer(upstreamBase, authHeader).listen(PORT, "127.0.0.1", () => {
    console.log(`[otel-cost-proxy] listening on http://127.0.0.1:${PORT}, forwarding to ${upstreamBase}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { transformTraces, getAttr, setAttr, createServer };
