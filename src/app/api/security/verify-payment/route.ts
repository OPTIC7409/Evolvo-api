/**
 * Security Audit Payment Verification API
 * 
 * POST /api/security/verify-payment
 * Verifies a Stripe checkout session and marks purchase as completed.
 * Called after user returns from Stripe Checkout.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe/config";
import { runFullAudit } from "@/lib/security";
import {
  getUserByEmail,
  getProject,
  getProjectFiles,
  saveFullAudit,
  hasFullAuditPurchase,
  createAuditPurchase,
  updateAuditPurchaseStatus,
} from "@/lib/db/supabase";
import prisma from "@/lib/db/prisma";

export const runtime = "nodejs";

interface VerifyRequest {
  projectId: string;
  auditId?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const body: VerifyRequest = await request.json();
    
    if (!body.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    
    // Get user
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Verify project ownership
    const project = await getProject(body.projectId);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }
    
    // Try to find purchase in database first
    let purchaseVerified = false;
    let stripeSessionId: string | null = null;
    
    // Check for pending purchase using Prisma
    const purchase = await prisma.securityAuditPurchase.findFirst({
      where: {
        userId: user.id,
        projectId: body.projectId,
        status: "pending",
      },
      orderBy: { createdAt: "desc" },
    });
    
    if (purchase) {
      stripeSessionId = purchase.stripePaymentIntentId;
    } else {
      // Check if already completed
      const alreadyPurchased = await hasFullAuditPurchase(user.id, body.projectId);
      if (alreadyPurchased) {
        purchaseVerified = true;
      }
    }
    
    // If we have a session ID, verify with Stripe
    if (stripeSessionId) {
      try {
        const checkoutSession = await stripe.checkout.sessions.retrieve(stripeSessionId);
        
        if (checkoutSession.payment_status === "paid") {
          purchaseVerified = true;
          
          // Update purchase status
          if (purchase) {
            await updateAuditPurchaseStatus(stripeSessionId, "completed");
          }
        }
      } catch (stripeError) {
        console.error("Stripe session retrieval error:", stripeError);
      }
    }
    
    // If no purchase record found, check Stripe directly for recent sessions
    if (!purchaseVerified && !purchase) {
      console.log("No purchase record found, checking Stripe directly...");
      
      try {
        // List recent checkout sessions
        const sessions = await stripe.checkout.sessions.list({
          limit: 100,
        });
        
        // Find a paid session for this project and email
        const matchingSession = sessions.data.find(s => 
          s.payment_status === "paid" && 
          s.customer_email === session.user.email &&
          s.metadata?.type === "security_audit" &&
          s.metadata?.projectId === body.projectId
        );
        
        if (matchingSession) {
          purchaseVerified = true;
          stripeSessionId = matchingSession.id;
          
          // Create the missing purchase record
          try {
            await createAuditPurchase(
              user.id,
              body.projectId,
              matchingSession.metadata?.auditId || body.projectId,
              matchingSession.id,
              matchingSession.amount_total || 1499,
              "gbp"
            );
            // Mark it as completed
            await updateAuditPurchaseStatus(matchingSession.id, "completed");
          } catch (insertError) {
            console.warn("Could not create purchase record:", insertError);
          }
        }
      } catch (stripeListError) {
        console.error("Error listing Stripe sessions:", stripeListError);
      }
    }
    
    // If still not verified, return error
    if (!purchaseVerified) {
      return NextResponse.json(
        { error: "No valid payment found. Please complete the checkout process." },
        { status: 400 }
      );
    }
    
    // Payment verified! Run the full audit
    const projectFiles = await getProjectFiles(body.projectId);
    const files = projectFiles.map(f => ({ path: f.path, content: f.content }));
    
    // Extract package.json if present
    const pkgFile = files.find(f => f.path === "package.json");
    const packageJson = pkgFile?.content;
    
    if (files.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Payment verified but no files to audit",
        noFiles: true,
      });
    }
    
    // Run the full security audit
    const audit = runFullAudit(body.projectId, files, packageJson);
    
    // Save the audit result
    try {
      await saveFullAudit(user.id, audit);
    } catch (saveError) {
      console.warn("Could not save audit to database:", saveError);
    }
    
    return NextResponse.json({
      success: true,
      message: "Payment verified and audit completed",
      audit,
    });
    
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
