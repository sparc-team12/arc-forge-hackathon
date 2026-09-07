/**
 * Guards the one regression the tracing change could realistically cause:
 * corrupting the MCP stdio channel.
 *
 * This server speaks JSON-RPC over stdout, so a single stray console.log from
 * Langfuse, OpenTelemetry or any transitive dependency breaks the protocol.
 * Spawns the real server both with and without tracing enabled and completes a
 * full handshake over stdio.
 *
 *   node telemetry/verify-stdio.js
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import { fileURLToPath } from "url";

const serverDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function handshake(mode) {
  const env = { ...process.env };

  if (mode === "tracing enabled") {
    env.LANGFUSE_PUBLIC_KEY = "pk-lf-verify";
    env.LANGFUSE_SECRET_KEY = "sk-lf-verify";
    // Dead port: never touches the network during verification.
    env.LANGFUSE_BASE_URL = "http://127.0.0.1:9";
  } else {
    delete env.LANGFUSE_PUBLIC_KEY;
    delete env.LANGFUSE_SECRET_KEY;
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(serverDir, "main.js")],
    cwd: serverDir,
    env,
    stderr: "pipe",
  });

  const client = new Client({ name: "verify-stdio", version: "1.0.0" });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const { resources } = await client.listResources();
    await client.close();

    console.error(
      `  PASS  ${mode.padEnd(16)} handshake clean - ${tools.length} tools, ` +
        `${resources.length} resource(s)`
    );
    return true;
  } catch (error) {
    console.error(`  FAIL  ${mode.padEnd(16)} ${error.message}`);
    return false;
  }
}

console.error("\nMCP stdio protocol integrity:");
const results = [
  await handshake("tracing off"),
  await handshake("tracing enabled"),
];

const ok = results.every(Boolean);
console.error(
  ok
    ? "\nstdout is uncorrupted in both modes.\n"
    : "\nstdio handshake failed - stdout may be polluted.\n"
);
process.exit(ok ? 0 : 1);
