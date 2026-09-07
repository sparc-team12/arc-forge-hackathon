import { FastifyRequest, FastifyReply } from "fastify";
import { checkDatabaseHealth } from "../utils/database.js";
import os from "os";

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: "healthy" | "unhealthy";
      tables?: string[];
      error?: string;
    };
    memory: {
      status: "healthy" | "degraded";
      usage: {
        rss: number;
        heapTotal: number;
        heapUsed: number;
        external: number;
      };
      percentage: number;
    };
  };
}

/**
 * Check memory usage health
 */
function checkMemoryHealth(): HealthCheckResult["services"]["memory"] {
  const memUsage = process.memoryUsage();
  const totalMemory = os.totalmem();
  const percentage = (memUsage.rss / totalMemory) * 100;

  return {
    status: percentage > 90 ? "degraded" : "healthy",
    usage: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
    },
    percentage: Math.round(percentage * 100) / 100,
  };
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  const startTime = Date.now();

  // Check database health
  const databaseHealth = await checkDatabaseHealth();

  // Check memory health
  const memoryHealth = checkMemoryHealth();

  // Determine overall status
  let overallStatus: HealthCheckResult["status"] = "healthy";
  if (databaseHealth.status === "unhealthy") {
    overallStatus = "unhealthy";
  } else if (memoryHealth.status === "degraded") {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    services: {
      database: databaseHealth,
      memory: memoryHealth,
    },
  };
}

/**
 * Health check endpoint handler
 */
export async function healthCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const healthCheck = await performHealthCheck();

    // Set appropriate status code based on health
    let statusCode = 200;
    if (healthCheck.status === "degraded") {
      statusCode = 200; // Still operational
    } else if (healthCheck.status === "unhealthy") {
      statusCode = 503; // Service unavailable
    }

    return reply.status(statusCode).send(healthCheck);
  } catch (error) {
    return reply.status(503).send({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      error: error instanceof Error ? error.message : "Health check failed",
      services: {
        database: { status: "unhealthy", error: "Health check failed" },
        memory: {
          status: "healthy",
          usage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0 },
          percentage: 0,
        },
      },
    });
  }
}

/**
 * Simple readiness check (lighter than full health check)
 */
export async function readinessCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Quick database connectivity check
    const dbHealth = await checkDatabaseHealth();

    if (dbHealth.status === "healthy") {
      return reply.send({
        status: "ready",
        timestamp: new Date().toISOString(),
      });
    } else {
      return reply.status(503).send({
        status: "not_ready",
        timestamp: new Date().toISOString(),
        reason: "Database not available",
      });
    }
  } catch (error) {
    return reply.status(503).send({
      status: "not_ready",
      timestamp: new Date().toISOString(),
      reason: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Liveness check (minimal check to see if the service is alive)
 */
export async function livenessCheckHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.send({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
}
