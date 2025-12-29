/**
 * Admin Login API
 * 
 * Authenticates admin users via email verification against ADMIN_EMAILS env var.
 * Uses magic link style authentication - sends a verification code via email.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendAdminVerificationEmail } from "@/lib/email";
import crypto from "crypto";

// Get admin emails from environment
function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS || "";
  return adminEmails.split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
}

// Check if email is an admin
function isAdminEmail(email: string): boolean {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

// Generate secure token
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, action, token } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is in admin list
    if (!isAdminEmail(normalizedEmail)) {
      // Don't reveal whether the email exists
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    if (action === "verify" && token) {
      // Verify the token
      const session = await prisma.adminSession.findFirst({
        where: {
          email: normalizedEmail,
          token,
          expiresAt: { gt: new Date() }
        }
      });

      if (!session) {
        return NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 401 }
        );
      }

      // Create a new long-lived session token
      const sessionToken = generateToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await prisma.adminSession.create({
        data: {
          email: normalizedEmail,
          token: sessionToken,
          expiresAt
        }
      });

      // Delete the verification token
      await prisma.adminSession.delete({
        where: { id: session.id }
      });

      return NextResponse.json({
        success: true,
        token: sessionToken,
        expiresAt: expiresAt.toISOString()
      });
    }

    // Generate a 6-digit verification code
    const verificationCode = Math.random().toString().slice(2, 8);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store the verification code
    await prisma.adminSession.create({
      data: {
        email: normalizedEmail,
        token: verificationCode,
        expiresAt
      }
    });

    // Send verification email
    const emailResult = await sendAdminVerificationEmail(normalizedEmail, verificationCode);
    
    if (!emailResult.success) {
      console.error(`[Admin Login] Failed to send email to ${normalizedEmail}:`, emailResult.error);
      // In development, still allow login by returning the code
      if (process.env.NODE_ENV === "development") {
        console.log(`[Admin Login] DEV MODE - Verification code for ${normalizedEmail}: ${verificationCode}`);
        return NextResponse.json({
          success: true,
          message: "Email service unavailable - using dev mode",
          devCode: verificationCode
        });
      }
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 }
      );
    }

    console.log(`[Admin Login] Verification code sent to ${normalizedEmail}`);
    
    // In development, also return the code for easier testing
    if (process.env.NODE_ENV === "development") {
      return NextResponse.json({
        success: true,
        message: "Verification code sent to your email",
        devCode: verificationCode
      });
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email"
    });

  } catch (error) {
    console.error("[Admin Login] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
