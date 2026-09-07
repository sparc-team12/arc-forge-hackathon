import { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ValidationError extends Error implements APIError {
  statusCode = 400;
  code = "VALIDATION_ERROR";

  constructor(message: string, public details?: any) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error implements APIError {
  statusCode = 404;
  code = "NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error implements APIError {
  statusCode = 409;
  code = "CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class AuthenticationError extends Error implements APIError {
  statusCode = 401;
  code = "AUTHENTICATION_ERROR";

  constructor(message: string = "Authentication required") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error implements APIError {
  statusCode = 403;
  code = "AUTHORIZATION_ERROR";

  constructor(message: string = "Insufficient permissions") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class DatabaseError extends Error implements APIError {
  statusCode = 500;
  code = "DATABASE_ERROR";

  constructor(message: string, public details?: any) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Global error handler for Fastify
 */
export async function errorHandler(
  error: FastifyError | APIError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const isDevelopment = process.env.NODE_ENV !== "production";

  // Log the error
  request.log.error(
    {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        statusCode: (error as APIError).statusCode,
      },
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        params: request.params,
        query: request.query,
      },
    },
    "Request error occurred"
  );

  // Determine status code
  let statusCode = 500;
  if ("statusCode" in error && typeof error.statusCode === "number") {
    statusCode = error.statusCode;
  } else if ("status" in error && typeof error.status === "number") {
    statusCode = error.status;
  }

  // Build error response
  const errorResponse: any = {
    success: false,
    error: error.name || "Internal Server Error",
    message: error.message || "An unexpected error occurred",
    code: (error as APIError).code || "INTERNAL_ERROR",
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method,
  };

  // Add additional details in development
  if (isDevelopment) {
    errorResponse.details = (error as APIError).details;
    errorResponse.stack = error.stack;
  }

  // Handle specific Fastify errors
  if (error.code === "FST_ERR_VALIDATION") {
    statusCode = 400;
    errorResponse.error = "Validation Error";
    errorResponse.code = "VALIDATION_ERROR";
    errorResponse.message = "Request validation failed";
    if (isDevelopment && "validation" in error) {
      errorResponse.validation = (error as any).validation;
    }
  } else if (error.code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
    statusCode = 400;
    errorResponse.error = "Bad Request";
    errorResponse.code = "EMPTY_BODY";
    errorResponse.message =
      "Request body cannot be empty when content-type is application/json";
  } else if (error.code === "FST_ERR_CTP_INVALID_MEDIA_TYPE") {
    statusCode = 415;
    errorResponse.error = "Unsupported Media Type";
    errorResponse.code = "INVALID_MEDIA_TYPE";
    errorResponse.message = "Content-Type header is invalid";
  }

  // Handle SQLite database errors
  if (error.message.includes("SQLITE_")) {
    statusCode = 500;
    errorResponse.error = "Database Error";
    errorResponse.code = "DATABASE_ERROR";

    if (error.message.includes("SQLITE_CONSTRAINT_UNIQUE")) {
      statusCode = 409;
      errorResponse.error = "Conflict";
      errorResponse.code = "DUPLICATE_ENTRY";
      errorResponse.message = "A record with this data already exists";
    } else if (error.message.includes("SQLITE_CONSTRAINT_FOREIGN")) {
      statusCode = 400;
      errorResponse.error = "Validation Error";
      errorResponse.code = "INVALID_REFERENCE";
      errorResponse.message = "Referenced record does not exist";
    } else if (error.message.includes("SQLITE_CONSTRAINT_NOTNULL")) {
      statusCode = 400;
      errorResponse.error = "Validation Error";
      errorResponse.code = "MISSING_REQUIRED_FIELD";
      errorResponse.message = "Required field is missing";
    } else {
      errorResponse.message = isDevelopment
        ? error.message
        : "A database error occurred";
    }
  }

  return reply.status(statusCode).send(errorResponse);
}

/**
 * Not found handler for unmatched routes
 */
export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.status(404).send({
    success: false,
    error: "Not Found",
    message: `Route ${request.method} ${request.url} not found`,
    code: "ROUTE_NOT_FOUND",
    timestamp: new Date().toISOString(),
    path: request.url,
    method: request.method,
  });
}

/**
 * Request logging middleware
 */
export async function requestLogger(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const start = Date.now();

  // Log request start
  request.log.info(
    {
      request: {
        method: request.method,
        url: request.url,
        headers: {
          "user-agent": request.headers["user-agent"],
          "content-type": request.headers["content-type"],
          authorization: request.headers.authorization
            ? "[REDACTED]"
            : undefined,
        },
        params: request.params,
        query: request.query,
      },
    },
    "Request started"
  );

  // Add response time header
  const duration = Date.now() - start;
  reply.header("X-Response-Time", `${duration}ms`);
}
