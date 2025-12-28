/**
 * Rate Limiting Middleware for Evolvo API
 * 
 * Uses Upstash Redis for distributed rate limiting.
 * Falls back to in-memory limiting if Redis is not configured.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "./logger";

// In-memory fallback for development/testing
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Rate limit configurations for different endpoints
 */
export const rateLimits = {
  // General API: 100 requests per minute
  api: { requests: 100, window: "1m" as const },
  
  // Auth endpoints: 10 requests per minute (prevent brute force)
  auth: { requests: 10, window: "1m" as const },
  
  // AI chat: 20 requests per minute (expensive)
  aiChat: { requests: 20, window: "1m" as const },
  
  // Security scan: 5 requests per minute
  securityScan: { requests: 5, window: "1m" as const },
  
  // Stripe operations: 10 requests per minute
  stripe: { requests: 10, window: "1m" as const },
  
  // File operations: 50 requests per minute
  files: { requests: 50, window: "1m" as const },
};

type RateLimitType = keyof typeof rateLimits;

// Create Redis client if configured
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// Create rate limiters
const rateLimiters: Record<RateLimitType, Ratelimit | null> = {} as Record<RateLimitType, Ratelimit | null>;

if (redis) {
  for (const [key, config] of Object.entries(rateLimits)) {
    rateLimiters[key as RateLimitType] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      analytics: true,
      prefix: `ratelimit:api:${key}`,
    });
  }
}

/**
 * In-memory rate limiting fallback
 */
function inMemoryRateLimit(
  identifier: string,
  config: { requests: number; window: string }
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowMs = config.window === "1m" ? 60000 : 
                   config.window === "1h" ? 3600000 : 
                   config.window === "1d" ? 86400000 : 60000;
  
  const key = `${identifier}`;
  const entry = inMemoryStore.get(key);
  
  if (!entry || now > entry.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: config.requests - 1, reset: now + windowMs };
  }
  
  if (entry.count >= config.requests) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }
  
  entry.count++;
  return { success: true, remaining: config.requests - entry.count, reset: entry.resetAt };
}

/**
 * Get identifier for rate limiting
 */
export function getIdentifier(request: NextRequest): string {
  const userId = request.headers.get("x-user-id");
  if (userId) return `user:${userId}`;
  
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : 
             request.headers.get("x-real-ip") || 
             "anonymous";
  
  return `ip:${ip}`;
}

/**
 * Check rate limit for a request
 */
export async function checkRateLimit(
  request: NextRequest,
  type: RateLimitType = "api"
): Promise<{
  success: boolean;
  remaining: number;
  reset: number;
  response?: NextResponse;
}> {
  const identifier = getIdentifier(request);
  const config = rateLimits[type];
  
  let result: { success: boolean; remaining: number; reset: number };
  
  const limiter = rateLimiters[type];
  if (limiter) {
    const { success, remaining, reset } = await limiter.limit(identifier);
    result = { success, remaining, reset };
  } else {
    result = inMemoryRateLimit(`${type}:${identifier}`, config);
  }
  
  if (!result.success) {
    logSecurityEvent("rate_limit_exceeded", {
      identifier,
      type,
      path: request.nextUrl.pathname,
    });
  }
  
  if (!result.success) {
    return {
      ...result,
      response: NextResponse.json(
        {
          error: "Too many requests",
          message: "Please slow down and try again later",
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(config.requests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.reset),
          },
        }
      ),
    };
  }
  
  return result;
}

/**
 * Simple rate limit check for use in API routes
 */
export async function rateLimit(
  request: NextRequest,
  type: RateLimitType = "api"
): Promise<NextResponse | null> {
  const { success, response } = await checkRateLimit(request, type);
  return success ? null : (response || null);
}
