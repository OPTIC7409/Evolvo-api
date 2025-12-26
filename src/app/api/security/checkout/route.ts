/**
 * Security Audit Checkout API
 * 
 * POST /api/security/checkout
 * Creates a Stripe Checkout session for security audit purchase.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe, SECURITY_AUDIT_PRICE_AMOUNT } from "@/lib/stripe/config";
import {
  getUserByEmail,
  getProject,
  getLatestSecurityAudit,
  hasFullAuditPurchase,
  createAuditPurchase,
} from "@/lib/db/supabase";

export const runtime = "nodejs";

interface CheckoutRequest {
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
    
    const body: CheckoutRequest = await request.json();
    
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
    
    // Check if already purchased
    const alreadyPurchased = await hasFullAuditPurchase(user.id, body.projectId);
    if (alreadyPurchased) {
      return NextResponse.json(
        { error: "Security audit already purchased for this project", alreadyPurchased: true },
        { status: 400 }
      );
    }
    
    // Get the latest partial scan to link to purchase
    let auditId = body.auditId;
    if (!auditId) {
      const latestScan = await getLatestSecurityAudit(body.projectId, "partial");
      auditId = latestScan?.id;
    }
    
    if (!auditId) {
      return NextResponse.json(
        { error: "No security scan found. Run a scan first." },
        { status: 400 }
      );
    }
    
    // Get base URL for redirects
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    
    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Security Audit",
              description: `Full security audit for project: ${project.name}`,
            },
            unit_amount: SECURITY_AUDIT_PRICE_AMOUNT,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "security_audit",
        projectId: body.projectId,
        auditId,
        userId: user.id,
      },
      customer_email: session.user.email,
      success_url: `${baseUrl}/workspace?project=${body.projectId}&audit_success=true&audit_id=${auditId}`,
      cancel_url: `${baseUrl}/workspace?project=${body.projectId}&audit_cancelled=true`,
    });
    
    // Create pending purchase record
    if (checkoutSession.id) {
      await createAuditPurchase(
        user.id,
        body.projectId,
        auditId,
        checkoutSession.id, // Use session ID instead of payment intent for checkout
        SECURITY_AUDIT_PRICE_AMOUNT,
        "gbp"
      );
    }
    
    return NextResponse.json({
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
    
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
