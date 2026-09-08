/**
 * Offline verification of the Langfuse instrumentation.
 *
 * Drives the real MCP server over an in-memory transport with a stubbed backend
 * and captures the spans that would be exported, so trace shape, observation
 * types, nesting, redaction and error levels can be checked without Langfuse
 * credentials or a running API.
 *
 *   node telemetry/verify-tracing.js
 */

// Dummy credentials switch tracing on; the dead base URL guarantees the
// exporter never reaches the network during verification.
process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-verify";
process.env.LANGFUSE_SECRET_KEY = "sk-lf-verify";
process.env.LANGFUSE_BASE_URL = "http://127.0.0.1:9";
process.env.LANGFUSE_LOG_LEVEL = "ERROR";

const { NodeTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } =
  await import("@opentelemetry/sdk-trace-node");
const { setLangfuseTracerProvider } = await import("@langfuse/tracing");
const { LangfuseOtelSpanAttributes } = await import("@langfuse/tracing");

// Import order mirrors main.js: instrumentation first.
await import("./instrumentation.js");
const { instrumentServer } = await import("./tracing.js");
const { McpServer } = await import(
  "@modelcontextprotocol/sdk/server/mcp.js"
);
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import(
  "@modelcontextprotocol/sdk/inMemory.js"
);
const apiBasedTools = (await import("../api-based-tools.js")).default;

// Route Langfuse's spans into an in-memory exporter we can assert against.
//
// LangfuseSpanProcessor must come first: it is its onStart hook that copies the
// attributes set by propagateAttributes (sessionId, userId, tags, ...) onto the
// span. Without it in the chain we would be asserting against spans that the
// real pipeline never produces. Its own export attempts go to the dead URL
// configured above and are discarded.
const exporter = new InMemorySpanExporter();
const { langfuseSpanProcessor } = await import("./instrumentation.js");
const provider = new NodeTracerProvider({
  spanProcessors: [langfuseSpanProcessor, new SimpleSpanProcessor(exporter)],
});
setLangfuseTracerProvider(provider);

const API_KEY = "super-secret-api-key-value-12345";

// Stub the backend so tool calls exercise success, HTTP error and network
// failure paths deterministically.
let fetchMode = "ok";
globalThis.fetch = async (url, config) => {
  if (fetchMode === "network-error") throw new Error("ECONNREFUSED");
  if (fetchMode === "not-found") {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(
    JSON.stringify({ issues: [{ id: 1, title: "Fix login bug" }], total: 1 }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": "session=SUPER_SECRET_COOKIE; HttpOnly",
      },
    }
  );
};

const server = new McpServer({ name: "issues-tracker-server", version: "1.0.0" });
instrumentServer(server);
apiBasedTools(server);

// main.js registers the schema resource against the real SQLite file. Register
// one of the same shape here so the registerResource wrapper itself is covered
// without depending on the database; verify-stdio.js separately confirms the
// real resource registers cleanly through this same wrapper.
server.registerResource(
  "database-schema",
  "schema://database",
  { title: "Database Schema", mimeType: "text/plain" },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "text/plain",
        text: "CREATE TABLE issues (id INTEGER PRIMARY KEY, title TEXT);",
      },
    ],
  })
);

const client = new Client({ name: "verify", version: "1.0.0" });
const [clientTransport, serverTransport] =
  InMemoryTransport.createLinkedPair();
await Promise.all([
  client.connect(clientTransport),
  server.connect(serverTransport),
]);

// --- exercise the traced paths ------------------------------------------
await client.callTool({
  name: "issues-list",
  arguments: { status: "in_progress", apiKey: API_KEY },
});

fetchMode = "not-found";
await client.callTool({
  name: "issues-get",
  arguments: { id: 999, apiKey: API_KEY },
});

fetchMode = "network-error";
await client.callTool({ name: "health-status", arguments: {} });

fetchMode = "ok";

// Resource reads go through a separate wrapper; exercise it too. The schema
// read hits the real SQLite file, so skip cleanly if it is not present.
let resourceTraced = false;
try {
  await client.readResource({ uri: "schema://database" });
  resourceTraced = true;
} catch (error) {
  console.error(`  (resource read skipped: ${error.message})`);
}

// --- assertions ----------------------------------------------------------
const spans = exporter.getFinishedSpans();
const attr = (s, k) => s.attributes[k];
const A = LangfuseOtelSpanAttributes;

const failures = [];
const check = (label, condition, detail = "") => {
  if (condition) console.error(`  PASS  ${label}`);
  else {
    console.error(`  FAIL  ${label} ${detail}`);
    failures.push(label);
  }
};

const byName = (name) => spans.filter((s) => s.name === name);
const serialised = JSON.stringify(
  spans.map((s) => ({ name: s.name, attributes: s.attributes }))
);

console.error("\nCaptured spans:");
for (const s of spans) {
  console.error(
    `  ${s.name.padEnd(22)} type=${attr(s, A.OBSERVATION_TYPE)} ` +
      `level=${attr(s, A.OBSERVATION_LEVEL) ?? "DEFAULT"} ` +
      `trace=${s.spanContext().traceId.slice(0, 8)} ` +
      `parent=${s.parentSpanContext?.spanId?.slice(0, 8) ?? "-"}`
  );
}

console.error("\nSecret handling:");
check(
  "raw API key never appears on any span",
  !serialised.includes(API_KEY),
  "-> key leaked into span attributes"
);
check(
  "session cookie never appears on any span",
  !serialised.includes("SUPER_SECRET_COOKIE"),
  "-> set-cookie leaked into span attributes"
);
check(
  "apiKey field is redacted, not dropped",
  serialised.includes("[REDACTED]")
);

console.error("\nObservation types:");
const listSpan = byName("issues-list")[0];
const backendSpans = byName("request-issues-api");
check("tool call typed as 'tool'", attr(listSpan, A.OBSERVATION_TYPE) === "tool");
check(
  "backend call typed as 'span'",
  backendSpans.every((s) => attr(s, A.OBSERVATION_TYPE) === "span")
);

console.error("\nNesting and trace grouping:");
check(
  "backend span is a child of its tool span",
  backendSpans[0]?.parentSpanContext?.spanId === listSpan?.spanContext().spanId
);
check(
  "tool span is a trace root",
  listSpan?.parentSpanContext === undefined
);
check(
  "each tool call is its own trace",
  new Set(spans.filter((s) => attr(s, A.OBSERVATION_TYPE) === "tool").map((s) => s.spanContext().traceId)).size === 3
);

console.error("\nTrace context:");
check("sessionId set", Boolean(attr(listSpan, A.TRACE_SESSION_ID)));
check(
  "userId derived from API key (pseudonymous)",
  String(attr(listSpan, A.TRACE_USER_ID) ?? "").startsWith("key_")
);
check("traceName set", attr(listSpan, A.TRACE_NAME) === "issues-list");
check("version set", Boolean(attr(listSpan, A.VERSION)), `got ${attr(listSpan, A.VERSION)}`);
check(
  "feature tag set",
  JSON.stringify(attr(listSpan, A.TRACE_TAGS) ?? []).includes("feature:issues")
);
check(
  "input captured",
  String(attr(listSpan, A.OBSERVATION_INPUT) ?? "").includes("in_progress")
);
check(
  "output captured",
  String(attr(listSpan, A.OBSERVATION_OUTPUT) ?? "").includes("Fix login bug")
);

console.error("\nError levels:");
const notFound = byName("issues-get")[0];
const netFail = byName("health-status")[0];
check(
  "HTTP 404 -> WARNING",
  attr(notFound, A.OBSERVATION_LEVEL) === "WARNING",
  `got ${attr(notFound, A.OBSERVATION_LEVEL)}`
);
check(
  "network failure -> ERROR",
  attr(netFail, A.OBSERVATION_LEVEL) === "ERROR",
  `got ${attr(netFail, A.OBSERVATION_LEVEL)}`
);
check(
  "failure carries a statusMessage",
  Boolean(attr(netFail, A.OBSERVATION_STATUS_MESSAGE))
);

console.error("\nArity handling:");
check(
  "tool without inputSchema still traced",
  Boolean(netFail),
  "-> health-status produced no span"
);

if (resourceTraced) {
  console.error("\nResource reads:");
  const schemaSpan = byName("read-database-schema")[0];
  check("schema read produced a span", Boolean(schemaSpan));
  check(
    "schema read typed as 'retriever'",
    attr(schemaSpan, A.OBSERVATION_TYPE) === "retriever",
    `got ${attr(schemaSpan, A.OBSERVATION_TYPE)}`
  );
  check(
    "schema read captured its output",
    String(attr(schemaSpan, A.OBSERVATION_OUTPUT) ?? "").includes("CREATE TABLE")
  );
}

console.error(
  failures.length === 0
    ? `\nAll checks passed (${spans.length} spans).\n`
    : `\n${failures.length} check(s) failed.\n`
);

await client.close();
await server.close();
process.exit(failures.length === 0 ? 0 : 1);
