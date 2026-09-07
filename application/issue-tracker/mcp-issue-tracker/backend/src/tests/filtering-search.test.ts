import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../index.js";
import { createTestUser, createTestTag, createTestIssue } from "./helpers.js";
import { FastifyInstance } from "fastify";
import { Issue, PaginatedResponse } from "../types/api.js";
import "./setup.js";

describe("Issues Filtering and Search", () => {
  let app: FastifyInstance;
  let user1Id: string, user2Id: string;
  let frontendTagId: number, backendTagId: number, bugTagId: number;

  beforeEach(async () => {
    app = await buildApp({ skipAuth: true });

    // Create test users
    await createTestUser({
      id: "user-1",
      name: "Alice Johnson",
      email: "alice@example.com",
    });
    await createTestUser({
      id: "user-2",
      name: "Bob Smith",
      email: "bob@example.com",
    });
    user1Id = "user-1";
    user2Id = "user-2";

    // Create test tags
    const frontendTag = await createTestTag({
      name: "frontend",
      color: "#3b82f6",
    });
    const backendTag = await createTestTag({
      name: "backend",
      color: "#10b981",
    });
    const bugTag = await createTestTag({ name: "bug", color: "#ef4444" });

    frontendTagId = frontendTag.id;
    backendTagId = backendTag.id;
    bugTagId = bugTag.id;

    // Create test issues with various combinations
    const issue1 = await createTestIssue({
      title: "Fix login button",
      description: "The login button is not working properly",
      status: "not_started",
      priority: "high",
      created_by_user_id: user1Id,
      assigned_user_id: user2Id,
    });

    const issue2 = await createTestIssue({
      title: "Add user dashboard",
      description: "Create a comprehensive user dashboard",
      status: "in_progress",
      priority: "medium",
      created_by_user_id: user2Id,
      assigned_user_id: user1Id,
    });

    const issue3 = await createTestIssue({
      title: "Database migration script",
      description: "Write migration for new user fields",
      status: "done",
      priority: "low",
      created_by_user_id: user1Id,
      assigned_user_id: null,
    });

    const issue4 = await createTestIssue({
      title: "Critical bug in payment",
      description: "Payment processing fails randomly",
      status: "not_started",
      priority: "urgent",
      created_by_user_id: user2Id,
      assigned_user_id: user1Id,
    });

    // Add tags to issues
    const { testDb } = await import("./setup.js");

    // Issue 1: frontend + bug
    await testDb.run(
      "INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)",
      [issue1.id, frontendTagId]
    );
    await testDb.run(
      "INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)",
      [issue1.id, bugTagId]
    );

    // Issue 2: frontend
    await testDb.run(
      "INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)",
      [issue2.id, frontendTagId]
    );

    // Issue 3: backend
    await testDb.run(
      "INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)",
      [issue3.id, backendTagId]
    );

    // Issue 4: bug
    await testDb.run(
      "INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)",
      [issue4.id, bugTagId]
    );

    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe("Status Filtering", () => {
    it("should filter by status: not_started", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?status=not_started",
      });

      expect(response.statusCode).toBe(200);
      const data: PaginatedResponse<Issue> = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2); // "Fix login button" and "Critical bug in payment"

      data.data.forEach((issue: Issue) => {
        expect(issue.status).toBe("not_started");
      });
    });

    it("should filter by status: in_progress", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?status=in_progress",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Add user dashboard");
    });

    it("should filter by status: done", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?status=done",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Database migration script");
    });
  });

  describe("User Assignment Filtering", () => {
    it("should filter by assigned user", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/issues?assigned_user_id=${user1Id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2); // "Add user dashboard" and "Critical bug in payment"

      data.data.forEach((issue: any) => {
        expect(issue.assigned_user_id).toBe(user1Id);
      });
    });

    it("should filter by created user", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/issues?created_by_user_id=${user1Id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);

      // Check that we get at least the 2 issues we created for user1
      expect(data.data.length).toBeGreaterThanOrEqual(2);

      // Check that all returned issues are created by user1
      data.data.forEach((issue: any) => {
        expect(issue.created_by_user_id).toBe(user1Id);
      });

      // Check that our specific test issues are included
      const titles = data.data.map((issue: any) => issue.title);
      expect(titles).toContain("Fix login button");
      expect(titles).toContain("Database migration script");
    });
  });

  describe("Tag Filtering", () => {
    it("should filter by tag", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/issues?tag_id=${frontendTagId}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2); // "Fix login button" and "Add user dashboard"

      const titles = data.data.map((issue: any) => issue.title);
      expect(titles).toContain("Fix login button");
      expect(titles).toContain("Add user dashboard");
    });

    it("should filter by bug tag", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/issues?tag_id=${bugTagId}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2); // "Fix login button" and "Critical bug in payment"
    });
  });

  describe("Priority Filtering", () => {
    it("should filter by priority: urgent", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?priority=urgent",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);

      // Check that we get at least 1 issue with urgent priority
      expect(data.data.length).toBeGreaterThanOrEqual(1);

      // Check that all returned issues have urgent priority
      data.data.forEach((issue: any) => {
        expect(issue.priority).toBe("urgent");
      });

      // Check that our specific urgent issue is included
      const titles = data.data.map((issue: any) => issue.title);
      expect(titles).toContain("Critical bug in payment");
    });

    it("should filter by priority: high", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?priority=high",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);

      // Check that we get at least 1 issue with high priority
      expect(data.data.length).toBeGreaterThanOrEqual(1);

      // Check that all returned issues have high priority
      data.data.forEach((issue: any) => {
        expect(issue.priority).toBe("high");
      });

      // Check that our specific high priority issue is included
      const titles = data.data.map((issue: any) => issue.title);
      expect(titles).toContain("Fix login button");
    });
  });

  describe("Search Functionality", () => {
    it("should search by title", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?search=login",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Fix login button");
    });

    it("should search by description", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?search=dashboard",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Add user dashboard");
    });

    it("should search case-insensitively", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?search=DATABASE",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Database migration script");
    });

    it("should return empty results for non-matching search", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?search=nonexistent",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
    });
  });

  describe("Combined Filtering", () => {
    it("should combine status and tag filters", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/issues?status=not_started&tag_id=${bugTagId}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2); // Both "Fix login button" and "Critical bug in payment"
    });

    it("should combine search and status filters", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?search=bug&status=not_started",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Critical bug in payment");
    });
  });

  describe("Pagination", () => {
    it("should support limit and offset", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?limit=2&offset=0",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.total).toBe(4);
      expect(data.pagination.hasMore).toBe(true);
    });

    it("should handle second page", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?limit=2&offset=2",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.offset).toBe(2);
      expect(data.pagination.hasMore).toBe(false);
    });
  });
});
