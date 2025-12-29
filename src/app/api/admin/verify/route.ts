/**
 * Admin Session Verification API
 * 
 * Verifies admin session tokens for protected routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token is required" },
        { status: 400 }
      );
    }

    // Find valid session
    const session = await prisma.adminSession.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() }
      }
    });

    if (!session) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      email: session.email,
      expiresAt: session.expiresAt.toISOString()
    });

  } catch (error) {
    console.error("[Admin Verify] Error:", error);
    return NextResponse.json(
      { valid: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    // Delete the session (logout)
    await prisma.adminSession.deleteMany({
      where: { token }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Admin Logout] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
