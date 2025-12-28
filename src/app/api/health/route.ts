/**
 * Health Check API Endpoint (Backend)
 * 
 * Returns the health status of the backend API and its dependencies.
 */

import { NextResponse } from "next/server";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  service: string;
  checks: {
    name: string;
    status: "pass" | "fail" | "warn";
    message?: string;
    latency?: number;
  }[];
}

// Track when the server started
const startTime = Date.now();

/**
 * Check if Supabase is accessible
 */
async function checkSupabase(): Promise<{ status: "pass" | "fail" | "warn"; latency: number; message?: string }> {
  const start = Date.now();
  
  if (!process.env.SUPABASE_URL) {
    return { status: "warn", latency: 0, message: "SUPABASE_URL not configured" };
  }
  
  try {
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
      method: "HEAD",
      headers: {
        "apikey": process.env.SUPABASE_PUBLIC_KEY || "",
      },
    });
    
    const latency = Date.now() - start;
    
    if (response.ok || response.status === 400) {
      return { status: "pass", latency };
    }
    
    return { status: "fail", latency, message: `HTTP ${response.status}` };
  } catch (error) {
    return { 
      status: "fail", 
      latency: Date.now() - start, 
      message: error instanceof Error ? error.message : "Connection failed" 
    };
  }
}

/**
 * Check if Anthropic API is accessible
 */
async function checkAnthropic(): Promise<{ status: "pass" | "fail" | "warn"; latency: number; message?: string }> {
  const start = Date.now();
  
  if (!process.env.ANTHROPIC_API_KEY) {
    return { status: "warn", latency: 0, message: "ANTHROPIC_API_KEY not configured" };
  }
  
  // We don't actually call the API to avoid costs, just check the key format
  const isValidFormat = process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-");
  
  return {
    status: isValidFormat ? "pass" : "warn",
    latency: Date.now() - start,
    message: isValidFormat ? undefined : "Invalid API key format",
  };
}

/**
 * Check if Stripe is configured
 */
function checkStripe(): { status: "pass" | "fail" | "warn"; message?: string } {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: "warn", message: "STRIPE_SECRET_KEY not configured" };
  }
  
  const isValidFormat = process.env.STRIPE_SECRET_KEY.startsWith("sk_");
  
  return {
    status: isValidFormat ? "pass" : "warn",
    message: isValidFormat ? undefined : "Invalid Stripe key format",
  };
}

export async function GET() {
  const checks: HealthStatus["checks"] = [];
  
  // Run health checks
  const [supabaseResult, anthropicResult] = await Promise.all([
    checkSupabase(),
    checkAnthropic(),
  ]);
  
  const stripeResult = checkStripe();
  
  checks.push({
    name: "database",
    status: supabaseResult.status,
    latency: supabaseResult.latency,
    message: supabaseResult.message,
  });
  
  checks.push({
    name: "ai_provider",
    status: anthropicResult.status,
    latency: anthropicResult.latency,
    message: anthropicResult.message,
  });
  
  checks.push({
    name: "payment_provider",
    status: stripeResult.status,
    message: stripeResult.message,
  });
  
  // Environment checks
  checks.push({
    name: "auth",
    status: process.env.NEXTAUTH_SECRET ? "pass" : "fail",
    message: process.env.NEXTAUTH_SECRET ? undefined : "NEXTAUTH_SECRET not configured",
  });
  
  checks.push({
    name: "oauth_google",
    status: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? "pass" : "warn",
    message: process.env.GOOGLE_CLIENT_ID ? undefined : "Google OAuth not configured",
  });
  
  checks.push({
    name: "oauth_github",
    status: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? "pass" : "warn",
    message: process.env.GITHUB_CLIENT_ID ? undefined : "GitHub OAuth not configured",
  });
  
  // Determine overall status
  const hasFailure = checks.some(c => c.status === "fail");
  const hasWarning = checks.some(c => c.status === "warn");
  
  const status: HealthStatus = {
    status: hasFailure ? "unhealthy" : hasWarning ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    service: "evolvo-api",
    checks,
  };
  
  // Return appropriate HTTP status
  const httpStatus = hasFailure ? 503 : 200;
  
  return NextResponse.json(status, { status: httpStatus });
}

// Also support HEAD requests for simple uptime checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
