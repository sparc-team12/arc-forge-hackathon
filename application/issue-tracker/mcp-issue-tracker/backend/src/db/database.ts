import sqlite3 from "sqlite3";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Enable verbose mode for debugging
sqlite3.verbose();

// Database file path - consistent with auth.ts
const DB_PATH = path.resolve(__dirname, "..", "..", "database.sqlite");

export interface Database {
  run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
}

export class DatabaseConnection {
  private db: sqlite3.Database;
  public run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  public get: (sql: string, params?: any[]) => Promise<any>;
  public all: (sql: string, params?: any[]) => Promise<any[]>;
  public close: () => Promise<void>;

  constructor(db: sqlite3.Database) {
    this.db = db;

    // Properly promisify the run method to return the context (this)
    this.run = (sql: string, params?: any[]) => {
      return new Promise((resolve, reject) => {
        this.db.run(sql, params || [], function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this); // 'this' contains lastID, changes, etc.
          }
        });
      });
    };

    this.get = promisify(db.get.bind(db));
    this.all = promisify(db.all.bind(db));
    this.close = promisify(db.close.bind(db));
  }
}

export async function createDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("Error opening database:", err);
        reject(err);
      } else {
        if (process.env.NODE_ENV !== "test") {
          console.log("Connected to SQLite database at:", DB_PATH);
        }
        resolve(new DatabaseConnection(db));
      }
    });
  });
}

export async function runMigrations(): Promise<void> {
  const db = await createDatabase();

  try {
    // Enable foreign keys
    await db.run("PRAGMA foreign_keys = ON");

    const migrationsDir = path.join(__dirname, "migrations");
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (process.env.NODE_ENV !== "test") {
      console.log("Running database migrations...");
    }

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      if (process.env.NODE_ENV !== "test") {
        console.log(`Running migration: ${file}`);
      }
      await db.run(sql);
    }

    if (process.env.NODE_ENV !== "test") {
      console.log("All migrations completed successfully!");
    }
  } catch (error) {
    console.error("Error running migrations:", error);
    throw error;
  } finally {
    await db.close();
  }
}

export async function getDatabase(): Promise<Database> {
  // Use test database if we're in test environment
  if (process.env.NODE_ENV === "test") {
    const { testDb } = await import("../tests/setup.js");
    // Enable foreign keys for test database
    await testDb.run("PRAGMA foreign_keys = ON");
    return testDb;
  }

  const db = await createDatabase();
  // Enable foreign keys for this connection
  await db.run("PRAGMA foreign_keys = ON");
  return db;
}
