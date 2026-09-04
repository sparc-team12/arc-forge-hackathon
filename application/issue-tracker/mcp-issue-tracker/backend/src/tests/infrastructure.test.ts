import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../index.js";
import { createTestDbUser, createTestTag, createTestIssue } from "./helpers.js";
import { FastifyInstance } from "fastify";
import "./setup.js"; // This runs the setup hooks

describe("Testing Infrastructure", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp({ skipAuth: true });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("should create Fastify app successfully", async () => {
    expect(app).toBeDefined();
    expect(typeof app.inject).toBe("function");
  });

  it("should have health check endpoint", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const data = JSON.parse(response.payload);
    expect(data.status).toBe("healthy");
  });

  it("should create test database users", async () => {
    const user = await createTestDbUser({
      name: "Test User",
      email: "unique-test-1@example.com",
    });
    expect(user.id).toBeDefined();
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("unique-test-1@example.com");
  });

  it("should create test tags", async () => {
    const tag = await createTestTag({ name: "bug", color: "#ff0000" });
    expect(tag.id).toBeDefined();
    expect(tag.name).toBe("bug");
    expect(tag.color).toBe("#ff0000");
  });

  it("should create test issues", async () => {
    const user = await createTestDbUser({
      name: "Test User",
      email: "unique-test-2@example.com",
    });
    const issue = await createTestIssue({
      title: "Test Issue",
      description: "Test Description",
      created_by_user_id: user.id,
    });

    expect(issue.id).toBeDefined();
    expect(issue.title).toBe("Test Issue");
    expect(issue.created_by_user_id).toBe(user.id);
  });
});
