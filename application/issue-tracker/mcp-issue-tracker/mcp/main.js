// Must stay first: registers the OpenTelemetry provider and pins stray stdout
// writes to stderr before any other module can touch the stdio transport.
import { SERVER_VERSION } from "./telemetry/instrumentation.js";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import apiBasedTools from "./api-based-tools.js";
import { instrumentServer } from "./telemetry/tracing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an MCP server
const server = new McpServer({
  name: "issues-tracker-server",
  version: SERVER_VERSION,
});

// Wrap tool/resource registration so every handler registered below is traced.
instrumentServer(server);

// Register API-based tools
apiBasedTools(server);

// Register the database schema resource
server.registerResource(
  "database-schema",
  "schema://database",
  {
    title: "Database Schema",
    description: "SQLite schema for the issues database",
    mimeType: "text/plain",
  },
  async (uri) => {
    const dbPath = path.join(__dirname, "..", "backend", "database.sqlite");

    const schema = await new Promise((resolve, reject) => {
      const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

      db.all(
        "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY name",
        (err, rows) => {
          db.close();
          if (err) reject(err);
          else resolve(rows.map((row) => row.sql + ";").join("\n"));
        }
      );
    });

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: schema,
        },
      ],
    };
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
