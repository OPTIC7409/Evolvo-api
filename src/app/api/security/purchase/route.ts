/**
 * Security Audit Purchase API
 * 
 * POST /api/security/purchase
 * Creates a Stripe payment intent for security audit purchase.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  stripe,
  getOrCreateStripeCustomer,
  SECURITY_AUDIT_PRICE_AMOUNT,
} from "@/lib/stripe/config";
import {
  getUserByEmail,
  getProject,
  getLatestSecurityAudit,
  hasFullAuditPurchase,
  createAuditPurchase,
} from "@/lib/db/supabase";

export const runtime = "nodejs";

interface PurchaseRequest {
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
    
    const body: PurchaseRequest = await request.json();
    
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
        { error: "Security audit already purchased for this project" },
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
    
    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      session.user.email,
      user.stripe_customer_id
    );
    
    // Update user with Stripe customer ID if new
    if (!user.stripe_customer_id) {
      const { createServerClient } = await import("@/lib/db/supabase");
      const supabase = createServerClient();
      await supabase
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }
    
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: SECURITY_AUDIT_PRICE_AMOUNT,
      currency: "gbp",
      customer: customerId,
      metadata: {
        type: "security_audit",
        projectId: body.projectId,
        auditId,
        userId: user.id,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    // Create purchase record
    await createAuditPurchase(
      user.id,
      body.projectId,
      auditId,
      paymentIntent.id,
      SECURITY_AUDIT_PRICE_AMOUNT,
      "gbp"
    );
    
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: SECURITY_AUDIT_PRICE_AMOUNT,
      currency: "gbp",
    });
    
  } catch (error) {
    console.error("Purchase error:", error);
    return NextResponse.json(
      { error: "Failed to create payment" },
      { status: 500 }
    );
  }
}
