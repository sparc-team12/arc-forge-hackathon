import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildApp } from "../index.js";
import { FastifyInstance } from "fastify";
import "./setup.js";

/**
 * Covers the server-side phone number guard on POST /api/auth/sign-up/email.
 *
 * Only negative cases are automated here. The guard rejects before
 * auth.handler is called, so these requests never reach BetterAuth or any
 * database. A happy-path sign-up test is deliberately omitted: auth.ts opens
 * its own better-sqlite3 connection to the real database.sqlite at module
 * load, so a successful sign-up would write a real row into the developer's
 * database file. The positive path is verified manually.
 */
describe("Sign-up phone number validation", () => {
  let app: FastifyInstance;

  const basePayload = {
    name: "Phone Test User",
    email: "phone-test@example.com",
    password: "password123",
  };

  beforeEach(async () => {
    app = await buildApp({ skipAuth: false });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  const invalidCases: Array<{ label: string; phoneNumber?: unknown }> = [
    { label: "is missing" },
    { label: "is empty", phoneNumber: "" },
    { label: "is too short", phoneNumber: "98765" },
    { label: "is too long", phoneNumber: "98765432101" },
    { label: "contains letters", phoneNumber: "98765abcde" },
    { label: "contains dashes", phoneNumber: "987-654-3210" },
    { label: "contains spaces", phoneNumber: "987 654 3210" },
    { label: "has a country code prefix", phoneNumber: "+919876543210" },
    { label: "is a JSON number rather than a string", phoneNumber: 1234567890 },
  ];

  for (const { label, phoneNumber } of invalidCases) {
    it(`should reject sign-up with 400 when the phone number ${label}`, async () => {
      const payload: Record<string, unknown> = { ...basePayload };
      if (phoneNumber !== undefined) {
        payload.phoneNumber = phoneNumber;
      }

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/sign-up/email",
        payload,
      });

      expect(response.statusCode).toBe(400);

      const data = JSON.parse(response.payload);
      expect(data.error).toBe("Validation error");
      expect(data.code).toBe("INVALID_PHONE_NUMBER");
      expect(data.message).toBe(
        "Phone number must be exactly 10 digits (numbers only)"
      );
    });
  }

  it("should not create a user record when the phone number is invalid", async () => {
    const { testDb } = await import("./setup.js");

    await app.inject({
      method: "POST",
      url: "/api/auth/sign-up/email",
      payload: { ...basePayload, phoneNumber: "98765" },
    });

    const row = await testDb.get("SELECT id FROM user WHERE email = ?", [
      basePayload.email,
    ]);

    expect(row).toBeUndefined();
  });
});
