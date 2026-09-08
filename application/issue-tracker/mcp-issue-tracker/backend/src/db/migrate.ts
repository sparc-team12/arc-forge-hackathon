#!/usr/bin/env node
import { runMigrations } from "./database.js";

async function migrate() {
  try {
    await runMigrations();
    console.log("Database migrations completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

migrate();
