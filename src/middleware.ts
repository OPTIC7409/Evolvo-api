/**
 * Backend Middleware
 * 
 * Adds CORS headers to allow cross-origin requests from the frontend.
 * 
 * IMPORTANT: For cookies to work cross-origin:
 * 1. Access-Control-Allow-Credentials: true
 * 2. Access-Control-Allow-Origin: must be specific origin (not *)
 * 3. Cookies must have SameSite=None; Secure (see auth.ts)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Frontend URL for CORS
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Allowed origins - must be specific for credentials to work
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  "https://evolvo.xyz",
  "https://www.evolvo.xyz",
  "http://localhost:3000",
  "http://localhost:3100",
];

export function middleware(request: NextRequest) {
  const origin = request.headers.get("origin");
  const isAllowedOrigin = origin && ALLOWED_ORIGINS.some(allowed => 
    origin === allowed || origin.endsWith(".evolvo.xyz")
  );

  // Handle preflight OPTIONS requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        // MUST be specific origin, not "*", when using credentials
        "Access-Control-Allow-Origin": isAllowedOrigin && origin ? origin : FRONTEND_URL,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, X-Requested-With",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Get the response
  const response = NextResponse.next();

  // Add CORS headers to the response
  // These are required for cross-origin fetch() with credentials: "include"
  if (isAllowedOrigin && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Expose-Headers", "Set-Cookie");
  }

  return response;
}

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
  ],
};
