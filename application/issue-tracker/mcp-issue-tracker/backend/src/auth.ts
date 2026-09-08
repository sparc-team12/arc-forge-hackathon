import { betterAuth, type BetterAuthOptions } from "better-auth";
//import { apiKey } from "better-auth/plugins";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Create the database connection with correct path
const dbPath = path.resolve(__dirname, "..", "database.sqlite");
const db = new Database(dbPath);

const authConfig: BetterAuthOptions = {
  database: db,
  baseURL: "http://localhost:3000/api/auth",
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: true,
        input: true,
        returned: false,
      },
    },
  },
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
  ],
};

// Create auth instance
const authInstance = betterAuth(authConfig);

// Add event handlers after creating the instance
// Note: In Better Auth 1.3.x, events might need to be handled differently
// For now, we'll use a hook-based approach in the sign-up endpoint

export const auth = {
  handler: authInstance.handler,
  api: authInstance.api,
};
