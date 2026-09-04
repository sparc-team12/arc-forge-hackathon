import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../index.js";
import { createTestDbUser } from "./helpers.js";
import "./setup.js"; // This runs the setup hooks

describe("Issues API Basic", () => {
  it("should pass basic test", () => {
    expect(true).toBe(true);
  });

  it("should create app", async () => {
    const app = await buildApp({ skipAuth: true });
    expect(app).toBeDefined();
    await app.close();
  });

  it("should create test user", async () => {
    const user = await createTestDbUser({
      name: "Test User",
      email: "unique-test@example.com", // Use unique email to avoid conflicts
    });
    expect(user.id).toBeDefined();
    expect(user.name).toBe("Test User");
  });
});
