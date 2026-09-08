import { FastifyInstance } from "fastify";
import { testDb } from "./setup.js";

export const createTestUser = async (userData: any = {}) => {
  // Generate unique identifiers to avoid conflicts between tests
  // But allow override with specific IDs
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const uniqueId = userData.id || `test-user-${timestamp}-${random}`;
  const uniqueEmail =
    userData.email || `test-${timestamp}-${random}@example.com`;

  const defaultUser = {
    id: uniqueId,
    email: uniqueEmail,
    name: "Test User",
    emailVerified: 1, // Required field for BetterAuth
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const user = { ...defaultUser, ...userData };

  await testDb.run(
    "INSERT INTO user (id, email, name, emailVerified, image, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      user.id,
      user.email,
      user.name,
      user.emailVerified,
      user.image,
      user.createdAt,
      user.updatedAt,
    ]
  );

  return user;
};

export const createTestDbUser = async (userData: any = {}) => {
  // Generate unique identifiers to avoid conflicts between tests
  // But allow override with specific IDs
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const uniqueId = userData.id || `test-user-db-${timestamp}-${random}`;
  const uniqueEmail =
    userData.email || `test-db-${timestamp}-${random}@example.com`;

  const defaultUser = {
    id: uniqueId,
    name: "Test User",
    email: uniqueEmail,
    emailVerified: 1, // Required field for BetterAuth
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const user = { ...defaultUser, ...userData };

  await testDb.run(
    "INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      user.id,
      user.name,
      user.email,
      user.emailVerified,
      user.image,
      user.createdAt,
      user.updatedAt,
    ]
  );

  return user;
};

export const createTestTag = async (tagData = {}) => {
  const defaultTag = {
    name: "test-tag",
    color: "#3b82f6",
  };

  const tag = { ...defaultTag, ...tagData };

  const result = await testDb.run(
    "INSERT INTO tags (name, color) VALUES (?, ?)",
    [tag.name, tag.color]
  );

  return { ...tag, id: result.lastID };
};

export const createTestIssue = async (issueData: any = {}) => {
  // If no created_by_user_id is provided, we'll need to create a user first
  let userId = issueData.created_by_user_id;
  if (!userId) {
    const user = await createTestUser();
    userId = user.id;
  }

  const defaultIssue = {
    title: "Test Issue",
    description: "Test Description",
    status: "not_started",
    priority: "medium",
    assigned_user_id: null,
    created_by_user_id: userId,
  };

  const issue = { ...defaultIssue, ...issueData };

  const result = await testDb.run(
    "INSERT INTO issues (title, description, status, created_by_user_id, assigned_user_id, priority) VALUES (?, ?, ?, ?, ?, ?)",
    [
      issue.title,
      issue.description,
      issue.status,
      issue.created_by_user_id,
      issue.assigned_user_id,
      issue.priority,
    ]
  );

  return { ...issue, id: result.lastID };
};

export const mockAuthenticatedRequest = (
  app: FastifyInstance,
  userId: string = "test-user-1"
) => {
  // Add a preHandler hook that runs to set the user context
  app.addHook("onRequest", async (request, reply) => {
    // Skip auth for API routes in tests and set mock user
    if (
      request.url.startsWith("/api/") &&
      !request.url.startsWith("/api/auth")
    ) {
      (request as any).user = {
        id: userId,
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  });
};
