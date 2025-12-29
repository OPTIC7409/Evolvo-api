/**
 * Backend Middleware
 * 
 * Adds CORS headers to allow cross-origin requests from the frontend.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Frontend URL for CORS
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Allowed origins
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  "https://evolvo.xyz",
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
        "Access-Control-Allow-Origin": isAllowedOrigin ? origin : FRONTEND_URL,
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
