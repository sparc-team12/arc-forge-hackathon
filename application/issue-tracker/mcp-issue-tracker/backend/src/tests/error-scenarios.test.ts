import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../index.js";
import { createTestUser, createTestTag, createTestIssue } from "./helpers.js";
import { FastifyInstance } from "fastify";
import "./setup.js";

describe("Error Scenarios", () => {
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

  describe("Validation Errors", () => {
    it("should validate issue creation with missing title", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: {
          description: "Missing title",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.error.toLowerCase()).toContain("validation");
    });

    it("should validate issue creation with invalid status", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: {
          title: "Test Issue",
          status: "invalid_status",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it("should validate issue creation with invalid priority", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: {
          title: "Test Issue",
          priority: "invalid_priority",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it("should validate tag creation with missing name", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/tags",
        payload: {
          color: "#3b82f6",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it("should validate tag creation with invalid color format", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/tags",
        payload: {
          name: "test-tag",
          color: "invalid-color",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });
  });

  describe("Not Found Errors", () => {
    it("should return 404 for non-existent issue", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues/999999",
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.message.toLowerCase()).toContain("does not exist");
    });

    it("should return 404 when updating non-existent issue", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/issues/999999",
        payload: {
          title: "Updated Title",
        },
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it("should return 404 when deleting non-existent issue", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/issues/999999",
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it("should return 404 for non-existent tag", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/tags/999999",
      });

      expect(response.statusCode).toBe(404);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it("should return 404 for invalid route", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/nonexistent",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Constraint Violation Errors", () => {
    it("should prevent creating issue with non-existent user", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: {
          title: "Test Issue",
          assigned_user_id: "non-existent-user",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.message.toLowerCase()).toContain("user");
    });

    it("should prevent creating issue with non-existent tag", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: {
          title: "Test Issue",
          tag_ids: [999999],
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
    });

    it("should prevent duplicate tag names", async () => {
      // Create first tag
      await createTestTag({ name: "duplicate-tag", color: "#3b82f6" });

      // Try to create duplicate
      const response = await app.inject({
        method: "POST",
        url: "/api/tags",
        payload: {
          name: "duplicate-tag",
          color: "#ef4444",
        },
      });

      expect(response.statusCode).toBe(409);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(false);
      expect(data.message.toLowerCase()).toContain("already exists");
    });
  });

  describe("Malformed Request Errors", () => {
    it("should handle invalid JSON", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: "invalid json{",
        headers: {
          "content-type": "application/json",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle missing content-type header", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: JSON.stringify({ title: "Test" }),
        // No content-type header
      });

      // Should still work or give a reasonable error
      expect([200, 201, 400, 415]).toContain(response.statusCode);
    });

    it("should handle very large payloads gracefully", async () => {
      const largeDescription = "x".repeat(100000); // 100KB string

      const response = await app.inject({
        method: "POST",
        url: "/api/issues",
        payload: {
          title: "Test Issue",
          description: largeDescription,
        },
      });

      // Should either accept it or reject with proper error
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(500);
    });
  });

  describe("Query Parameter Errors", () => {
    it("should handle invalid limit parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?limit=invalid",
      });

      expect(response.statusCode).toBe(200); // Should default or ignore invalid value
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it("should handle negative limit parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?limit=-5",
      });

      expect(response.statusCode).toBe(200); // Should handle gracefully
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it("should handle invalid offset parameter", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?offset=invalid",
      });

      expect(response.statusCode).toBe(200); // Should default or ignore
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it("should handle invalid filter values", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?status=invalid_status&priority=invalid_priority",
      });

      expect(response.statusCode).toBe(200); // Should ignore invalid filters
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string search", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?search=",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it("should handle special characters in search", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/issues?search=%22%27%3C%3E%26",
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });

    it("should handle extremely long search terms", async () => {
      const longSearch = "x".repeat(1000);
      const response = await app.inject({
        method: "GET",
        url: `/api/issues?search=${encodeURIComponent(longSearch)}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });
  });

  describe("Rate Limiting and Performance", () => {
    it("should handle multiple rapid requests", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        app.inject({
          method: "GET",
          url: "/api/issues",
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed (no rate limiting implemented)
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
      });
    });

    it("should handle concurrent issue creation", async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        app.inject({
          method: "POST",
          url: "/api/issues",
          payload: {
            title: `Concurrent Issue ${i}`,
            description: "Test concurrent creation",
          },
        })
      );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.statusCode).toBe(201);
      });
    });
  });
});
