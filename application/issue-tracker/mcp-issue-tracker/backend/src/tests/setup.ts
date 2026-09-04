import { beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import sqlite3 from "sqlite3";
import { DatabaseConnection } from "../db/database.js";

let testDb: DatabaseConnection;
let dbClosed = false;

beforeAll(async () => {
  // Use in-memory database for tests to avoid permission issues
  const sqliteDb = new sqlite3.Database(":memory:", (err) => {
    if (err) {
      console.error("Error creating in-memory test database:", err);
    }
  });

  testDb = new DatabaseConnection(sqliteDb);

  // Override the close method to prevent premature closing
  const originalClose = testDb.close.bind(testDb);
  testDb.close = async () => {
    // Don't actually close during tests, just mark as closed
    // The actual close will happen in afterAll
    return Promise.resolve();
  };

  // Create tables manually for testing instead of running migrations
  try {
    // BetterAuth user table (matches actual schema)
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        emailVerified INTEGER NOT NULL,
        image TEXT,
        createdAt DATE NOT NULL,
        updatedAt DATE NOT NULL
      )
    `);

    // BetterAuth session table (matches actual schema)
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        expiresAt DATE NOT NULL,
        token TEXT UNIQUE NOT NULL,
        createdAt DATE NOT NULL,
        updatedAt DATE NOT NULL,
        ipAddress TEXT,
        userAgent TEXT,
        userId TEXT NOT NULL REFERENCES user(id)
      )
    `);

    // BetterAuth account table
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        accountId TEXT NOT NULL,
        providerId TEXT NOT NULL,
        userId TEXT NOT NULL REFERENCES user(id),
        accessToken TEXT,
        refreshToken TEXT,
        expiresAt DATE,
        createdAt DATE NOT NULL,
        updatedAt DATE NOT NULL
      )
    `);

    // BetterAuth verification table
    await testDb.run(`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expiresAt DATE NOT NULL,
        createdAt DATE NOT NULL,
        updatedAt DATE
      )
    `);

    await testDb.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT DEFAULT '#gray',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testDb.run(`
      CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'review', 'testing', 'done', 'blocked')),
        assigned_user_id TEXT,
        created_by_user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        FOREIGN KEY (assigned_user_id) REFERENCES user(id),
        FOREIGN KEY (created_by_user_id) REFERENCES user(id)
      )
    `);

    await testDb.run(`
      CREATE TABLE IF NOT EXISTS issue_tags (
        issue_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (issue_id, tag_id),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    await testDb.run(`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        accountId TEXT NOT NULL,
        providerId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
      )
    `);

    await testDb.run(`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expiresAt INTEGER NOT NULL
      )
    `);

    // Create indices
    await testDb.run(
      `CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)`
    );
    await testDb.run(
      `CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority)`
    );
    await testDb.run(
      `CREATE INDEX IF NOT EXISTS idx_issues_created_by ON issues(created_by_user_id)`
    );
    await testDb.run(
      `CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON issues(assigned_user_id)`
    );
  } catch (err) {
    console.error("Error creating test database tables:", err);
    throw err;
  }
});

beforeEach(async () => {
  // Clear all data before each test - only if database is still open
  try {
    await testDb.run("DELETE FROM issue_tags");
    await testDb.run("DELETE FROM issues");
    await testDb.run("DELETE FROM tags");
    await testDb.run("DELETE FROM session");
    await testDb.run("DELETE FROM account");
    await testDb.run("DELETE FROM verification");
    await testDb.run("DELETE FROM user");

    // Create the default test user that routes expect when skipAuth is enabled
    await testDb.run(
      "INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        "test-user-1",
        "Test User",
        "test@example.com",
        1,
        null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );
  } catch (err) {
    // If database is closed, ignore the error since it will be recreated
    if ((err as any).code !== "SQLITE_MISUSE") {
      console.error("Error cleaning up test data:", err);
      throw err;
    }
  }
});

afterAll(async () => {
  if (testDb && !dbClosed) {
    try {
      // Restore original close and call it
      const sqliteDb = (testDb as any).db;
      await new Promise<void>((resolve, reject) => {
        sqliteDb.close((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
      dbClosed = true;
    } catch (err) {
      console.warn("Error closing test database:", err);
    }
  }
});

export { testDb };
