/**
 * Structured Logger for Evolvo API
 * 
 * Production-ready logging with Pino.
 * Replaces console.log/error/warn with structured, queryable logs.
 */

import pino from "pino";

// Determine environment
const isDevelopment = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

// Create the base logger
const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info"),
  
  // Redact sensitive fields
  redact: {
    paths: [
      "password",
      "token",
      "authorization",
      "cookie",
      "apiKey",
      "api_key",
      "secret",
      "stripe_customer_id",
      "stripeCustomerId",
      "access_token",
      "refresh_token",
      "email",
    ],
    censor: "[REDACTED]",
  },
  
  // Format options
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      host: bindings.hostname,
      service: "evolvo-api",
    }),
  },
  
  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Pretty print in development
  transport: isDevelopment && !isTest
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      }
    : undefined,
});

// Create child loggers for different contexts
export const apiLogger = logger.child({ context: "api" });
export const authLogger = logger.child({ context: "auth" });
export const dbLogger = logger.child({ context: "database" });
export const stripeLogger = logger.child({ context: "stripe" });
export const aiLogger = logger.child({ context: "ai" });
export const securityLogger = logger.child({ context: "security" });

/**
 * Log an API request
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  userId?: string
) {
  apiLogger.info({
    type: "request",
    method,
    path,
    statusCode,
    duration,
    userId,
  });
}

/**
 * Log an error with context
 */
export function logError(
  error: Error | unknown,
  context?: Record<string, unknown>
) {
  const err = error instanceof Error ? error : new Error(String(error));
  
  logger.error({
    type: "error",
    message: err.message,
    stack: err.stack,
    name: err.name,
    ...context,
  });
}

/**
 * Log a security event
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>
) {
  securityLogger.warn({
    type: "security",
    event,
    ...details,
  });
}

/**
 * Log a payment event
 */
export function logPaymentEvent(
  event: string,
  details: Record<string, unknown>
) {
  stripeLogger.info({
    type: "payment",
    event,
    ...details,
  });
}

/**
 * Log an AI operation
 */
export function logAiOperation(
  operation: string,
  details: Record<string, unknown>
) {
  aiLogger.info({
    type: "ai",
    operation,
    ...details,
  });
}

/**
 * Log database operation
 */
export function logDbOperation(
  operation: string,
  table: string,
  duration?: number
) {
  dbLogger.debug({
    type: "database",
    operation,
    table,
    duration,
  });
}

// Export the base logger for custom use
export default logger;
