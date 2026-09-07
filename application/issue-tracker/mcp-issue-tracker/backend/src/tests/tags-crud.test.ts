import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../index.js";
import { createTestUser, createTestTag, createTestIssue } from "./helpers.js";
import { FastifyInstance } from "fastify";
import "./setup.js";

describe("Tags CRUD Operations", () => {
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

  describe("CREATE (POST /api/tags)", () => {
    it("should create a new tag", async () => {
      const newTag = {
        name: "frontend",
        color: "#3b82f6",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/tags",
        payload: newTag,
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe(newTag.name);
      expect(data.data.color).toBe(newTag.color);
    });

    it("should prevent duplicate tag names", async () => {
      // Create first tag
      await createTestTag({ name: "backend", color: "#10b981" });

      // Try to create duplicate
      const response = await app.inject({
        method: "POST",
        url: "/api/tags",
        payload: { name: "backend", color: "#ef4444" },
      });

      expect(response.statusCode).toBe(409);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.message).toContain("already exists");
    });

    it("should validate required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/tags",
        payload: {}, // missing name
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("READ (GET /api/tags)", () => {
    beforeEach(async () => {
      await createTestTag({ name: "frontend", color: "#3b82f6" });
      await createTestTag({ name: "backend", color: "#10b981" });
      await createTestTag({ name: "bug", color: "#ef4444" });
    });

    it("should get all tags", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/tags",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(3);

      const tagNames = data.data.map((tag: any) => tag.name);
      expect(tagNames).toContain("frontend");
      expect(tagNames).toContain("backend");
      expect(tagNames).toContain("bug");
    });
  });

  describe("DELETE (DELETE /api/tags/:id)", () => {
    it("should delete a tag that is not in use", async () => {
      const tag = await createTestTag({ name: "unused-tag", color: "#6b7280" });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/tags/${tag.id}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it("should prevent deletion of tag in use", async () => {
      const tag = await createTestTag({ name: "used-tag", color: "#6b7280" });

      // Create issue with this tag
      const issue = await createTestIssue({
        title: "Issue with tag",
        created_by_user_id: "test-user-1",
      });

      // Add tag to issue (simulate the relationship)
      const { testDb } = await import("./setup.js");
      await testDb.run(
        "INSERT INTO issue_tags (issue_id, tag_id) VALUES (?, ?)",
        [issue.id, tag.id]
      );

      const response = await app.inject({
        method: "DELETE",
        url: `/api/tags/${tag.id}`,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.message.toLowerCase()).toContain("cannot delete");
    });

    it("should return 404 for non-existent tag", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/tags/999999",
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
