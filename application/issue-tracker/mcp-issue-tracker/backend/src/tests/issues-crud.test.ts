import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../index.js";
import { createTestDbUser, createTestTag, createTestIssue } from "./helpers.js";
import { FastifyInstance } from "fastify";
import "./setup.js"; // This runs the setup hooks

describe("Issues CRUD Operations", () => {
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

  describe("CREATE (POST /api/issues)", () => {
    it("should create a new issue with minimal data", async () => {
      const newIssue = {
        title: "Test Issue",
        description: "Test description",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: newIssue,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe(newIssue.title);
      expect(data.data.description).toBe(newIssue.description);
      expect(data.data.status).toBe("not_started"); // default
      expect(data.data.priority).toBe("medium"); // default
    });

    it("should create issue with tags", async () => {
      // Create test tag
      const tag = await createTestTag({ name: "backend", color: "#10b981" });

      const newIssue = {
        title: "Issue with Tag",
        description: "Test description",
        tag_ids: [tag.id],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: newIssue,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.tags).toHaveLength(1);
      expect(data.data.tags[0].name).toBe("backend");
    });

    it("should validate required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: {}, // missing title
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.toLowerCase()).toContain("validation");
    });
  });

  describe("READ (GET /api/issues)", () => {
    beforeEach(async () => {
      // Create some test data
      await createTestIssue({
        title: "Issue 1",
        status: "not_started",
        priority: "high",
        created_by_user_id: "test-user-1",
      });
      await createTestIssue({
        title: "Issue 2",
        status: "in_progress",
        priority: "medium",
        created_by_user_id: "test-user-1",
      });
    });

    it("should get all issues", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it("should get single issue by ID", async () => {
      const issue = await createTestIssue({
        title: "Specific Issue",
        created_by_user_id: "test-user-1",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/issues/${issue.id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Specific Issue");
      expect(data.data.id).toBe(issue.id);
    });

    it("should return 404 for non-existent issue", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues/999999",
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });
  });

  describe("UPDATE (PUT /api/issues/:id)", () => {
    it("should update issue title and description", async () => {
      const issue = await createTestIssue({
        title: "Original Title",
        description: "Original description",
        created_by_user_id: "test-user-1",
      });

      const updateData = {
        title: "Updated Title",
        description: "Updated description",
      };

      const response = await app.inject({
        method: "PUT",
        url: `/api/issues/${issue.id}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe(updateData.title);
      expect(data.data.description).toBe(updateData.description);
    });

    it("should update issue status and priority", async () => {
      const issue = await createTestIssue({
        title: "Test Issue",
        status: "not_started",
        priority: "medium",
        created_by_user_id: "test-user-1",
      });

      const updateData = {
        status: "in_progress",
        priority: "high",
      };

      const response = await app.inject({
        method: "PUT",
        url: `/api/issues/${issue.id}`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe("in_progress");
      expect(data.data.priority).toBe("high");
    });

    it("should return 404 for non-existent issue", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/issues/999999",
        payload: { title: "Updated" },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("DELETE (DELETE /api/issues/:id)", () => {
    it("should delete an issue", async () => {
      const issue = await createTestIssue({
        title: "Issue to Delete",
        created_by_user_id: "test-user-1",
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/issues/${issue.id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);

      // Verify issue is deleted
      const getResponse = await app.inject({
        method: "GET",
        url: `/api/issues/${issue.id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it("should return 404 for non-existent issue", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/issues/999999",
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
