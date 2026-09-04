import { FastifyRequest, FastifyReply } from "fastify";

interface RateLimitOptions {
  max: number; // Maximum number of requests
  window: number; // Time window in milliseconds
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (use Redis in production)
const store: RateLimitStore = {};

/**
 * Clean up expired entries from the store
 */
function cleanupStore(): void {
  const now = Date.now();
  for (const key in store) {
    const entry = store[key];
    if (entry && entry.resetTime <= now) {
      delete store[key];
    }
  }
}

// Clean up store every 5 minutes
setInterval(cleanupStore, 5 * 60 * 1000);

/**
 * Generate a unique key for rate limiting
 */
function generateKey(request: FastifyRequest): string {
  // Use IP address as the key (in production, you might want to use user ID for authenticated requests)
  const ip = request.ip || request.socket.remoteAddress || "unknown";
  return `rate-limit:${ip}`;
}

/**
 * Create a rate limiting middleware
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const key = generateKey(request);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = store[key];
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: now + options.window,
      };
      store[key] = entry;
    }

    // Increment counter
    entry.count++;

    // Set headers
    reply.header("X-RateLimit-Limit", options.max);
    reply.header(
      "X-RateLimit-Remaining",
      Math.max(0, options.max - entry.count)
    );
    reply.header("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    // Check if limit exceeded
    if (entry.count > options.max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      reply.header("Retry-After", retryAfter);

      return reply.status(429).send({
        success: false,
        error: "Too Many Requests",
        message:
          options.message ||
          `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter,
        limit: options.max,
        window: options.window,
      });
    }
  };
}

/**
 * Pre-configured rate limit middlewares
 */
export const rateLimits = {
  // General API rate limit
  api: createRateLimitMiddleware({
    max: 100, // 100 requests
    window: 15 * 60 * 1000, // per 15 minutes
    message: "API rate limit exceeded. Please slow down your requests.",
  }),

  // Reasonable rate limit for authentication endpoints
  auth: createRateLimitMiddleware({
    max: 50, // 50 requests (increased from 30)
    window: 15 * 60 * 1000, // per 15 minutes
    message:
      "Authentication rate limit exceeded. Please wait before trying again.",
  }),

  // Very strict rate limit for creating resources
  create: createRateLimitMiddleware({
    max: 20, // 20 requests
    window: 60 * 1000, // per minute
    message: "Creation rate limit exceeded. Please slow down.",
  }),
};
