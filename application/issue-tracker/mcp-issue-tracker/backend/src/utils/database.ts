import sqlite3 from "sqlite3";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { DatabaseError } from "../middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database file path - consistent with auth.ts and db/database.ts
const DB_PATH = path.resolve(__dirname, "..", "..", "database.sqlite");

export interface Database {
  run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  get: (sql: string, params?: any[]) => Promise<any>;
  all: (sql: string, params?: any[]) => Promise<any[]>;
  close: () => Promise<void>;
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

class DatabaseConnection implements Database {
  private db: sqlite3.Database;
  public run: (sql: string, params?: any[]) => Promise<sqlite3.RunResult>;
  public get: (sql: string, params?: any[]) => Promise<any>;
  public all: (sql: string, params?: any[]) => Promise<any[]>;
  public close: () => Promise<void>;

  constructor(db: sqlite3.Database) {
    this.db = db;
    this.run = promisify(db.run.bind(db));
    this.get = promisify(db.get.bind(db));
    this.all = promisify(db.all.bind(db));
    this.close = promisify(db.close.bind(db));
  }

  async beginTransaction(): Promise<void> {
    await this.run("BEGIN TRANSACTION");
  }

  async commit(): Promise<void> {
    await this.run("COMMIT");
  }

  async rollback(): Promise<void> {
    await this.run("ROLLBACK");
  }
}

/**
 * Get a database connection with error handling
 */
export async function getDatabase(): Promise<Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(
          new DatabaseError(`Failed to connect to database: ${err.message}`, {
            path: DB_PATH,
            error: err,
          })
        );
      } else {
        // Enable foreign key constraints
        db.run("PRAGMA foreign_keys = ON", (pragmaErr) => {
          if (pragmaErr) {
            reject(
              new DatabaseError(
                `Failed to enable foreign keys: ${pragmaErr.message}`,
                {
                  error: pragmaErr,
                }
              )
            );
          } else {
            resolve(new DatabaseConnection(db));
          }
        });
      }
    });
  });
}

/**
 * Execute multiple database operations in a transaction
 */
export async function withTransaction<T>(
  callback: (db: Database) => Promise<T>
): Promise<T> {
  const db = await getDatabase();

  try {
    await db.beginTransaction();
    const result = await callback(db);
    await db.commit();
    await db.close();
    return result;
  } catch (error) {
    try {
      await db.rollback();
    } catch (rollbackError) {
      console.error("Failed to rollback transaction:", rollbackError);
    }
    await db.close();
    throw error;
  }
}

/**
 * Database health check
 */
export async function checkDatabaseHealth(): Promise<{
  status: "healthy" | "unhealthy";
  tables: string[];
  error?: string;
}> {
  try {
    const db = await getDatabase();

    // Check if we can query the database
    const tables = await db.all(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    await db.close();

    return {
      status: "healthy",
      tables: tables.map((table) => table.name),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      tables: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Query builder utilities
 */
export class QueryBuilder {
  private query: string = "";
  private params: any[] = [];

  constructor(baseQuery: string = "") {
    this.query = baseQuery;
  }

  /**
   * Add a WHERE condition
   */
  where(condition: string, ...params: any[]): QueryBuilder {
    if (this.query.toLowerCase().includes("where")) {
      this.query += ` AND ${condition}`;
    } else {
      this.query += ` WHERE ${condition}`;
    }
    this.params.push(...params);
    return this;
  }

  /**
   * Add an ORDER BY clause
   */
  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): QueryBuilder {
    if (this.query.toLowerCase().includes("order by")) {
      this.query += `, ${column} ${direction}`;
    } else {
      this.query += ` ORDER BY ${column} ${direction}`;
    }
    return this;
  }

  /**
   * Add a LIMIT clause
   */
  limit(count: number): QueryBuilder {
    this.query += ` LIMIT ?`;
    this.params.push(count);
    return this;
  }

  /**
   * Add an OFFSET clause
   */
  offset(count: number): QueryBuilder {
    this.query += ` OFFSET ?`;
    this.params.push(count);
    return this;
  }

  /**
   * Build the final query and parameters
   */
  build(): { query: string; params: any[] } {
    return {
      query: this.query,
      params: this.params,
    };
  }

  /**
   * Execute the query and return all results
   */
  async execute(db: Database): Promise<any[]> {
    const { query, params } = this.build();
    return await db.all(query, params);
  }

  /**
   * Execute the query and return first result
   */
  async executeOne(db: Database): Promise<any> {
    const { query, params } = this.build();
    return await db.get(query, params);
  }
}

/**
 * Escape SQL identifiers (table names, column names)
 */
export function escapeIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Build WHERE IN clause with proper parameter placeholders
 */
export function buildInClause(values: any[]): {
  clause: string;
  params: any[];
} {
  if (values.length === 0) {
    return { clause: "1=0", params: [] }; // Never matches anything
  }

  const placeholders = values.map(() => "?").join(",");
  return {
    clause: `IN (${placeholders})`,
    params: values,
  };
}

/**
 * Paginate query results
 */
export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export async function paginate<T>(
  db: Database,
  baseQuery: string,
  countQuery: string,
  params: any[],
  options: PaginationOptions
): Promise<PaginatedResult<T>> {
  // Get total count
  const countResult = await db.get(countQuery, params);
  const total = countResult.total || countResult.count || 0;

  // Get paginated data
  const dataQuery = `${baseQuery} LIMIT ? OFFSET ?`;
  const dataParams = [...params, options.limit, options.offset];
  const data = await db.all(dataQuery, dataParams);

  return {
    data,
    pagination: {
      total,
      limit: options.limit,
      offset: options.offset,
      hasMore: options.offset + options.limit < total,
    },
  };
}

/**
 * Database migration utilities
 */
export async function runMigration(migrationSql: string): Promise<void> {
  const db = await getDatabase();

  try {
    // Split migration into individual statements
    const statements = migrationSql
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    await db.beginTransaction();

    for (const statement of statements) {
      await db.run(statement);
    }

    await db.commit();
    await db.close();
  } catch (error) {
    await db.rollback();
    await db.close();
    throw new DatabaseError(
      `Migration failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        migration: migrationSql,
        error,
      }
    );
  }
}

/**
 * Backup database to a file
 */
export async function backupDatabase(backupPath: string): Promise<void> {
  const db = await getDatabase();

  try {
    await db.run(`VACUUM INTO ?`, [backupPath]);
    await db.close();
  } catch (error) {
    await db.close();
    throw new DatabaseError(
      `Backup failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      {
        backupPath,
        error,
      }
    );
  }
}
