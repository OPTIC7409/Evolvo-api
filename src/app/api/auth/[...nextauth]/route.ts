/**
 * NextAuth API Route - Backend
 * 
 * Handles all authentication requests.
 * The frontend proxies auth requests here for security - OAuth secrets
 * and database operations only happen on this backend.
 */

import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

// Frontend URL for CORS
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Create the NextAuth handler
const handler = NextAuth(authOptions);

/**
 * Wrap the handler to add CORS headers for cross-origin requests
 */
async function corsHandler(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  
  // Get the response from NextAuth
  const response = await handler(request, context);
  
  // Clone the response to modify headers
  const newResponse = new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  
  // Add CORS headers if request is from frontend
  if (origin === FRONTEND_URL || origin?.startsWith("http://localhost:")) {
    newResponse.headers.set("Access-Control-Allow-Origin", origin);
    newResponse.headers.set("Access-Control-Allow-Credentials", "true");
    newResponse.headers.set("Access-Control-Expose-Headers", "Set-Cookie");
  }
  
  return newResponse;
}

/**
 * Handle preflight requests
 */
async function optionsHandler(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  
  const response = new NextResponse(null, { status: 204 });
  
  if (origin === FRONTEND_URL || origin?.startsWith("http://localhost:")) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Cookie, X-Forwarded-Host, Origin"
    );
  }
  
  return response;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
): Promise<NextResponse> {
  return corsHandler(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
): Promise<NextResponse> {
  return corsHandler(request, context);
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return optionsHandler(request);
}
