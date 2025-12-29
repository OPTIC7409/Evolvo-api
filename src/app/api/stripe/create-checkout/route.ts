/**
 * Stripe Create Checkout Session API
 * 
 * Creates a Stripe Checkout session for subscription purchases.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe, getPriceIdForTier } from "@/lib/stripe/config";
import { getUserByEmail, updateUserStripeCustomerId } from "@/lib/db/supabase";

export async function POST(request: Request) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be logged in to subscribe" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { tier } = body as { tier: "pro" | "enterprise" };
    
    if (!tier || !["pro", "enterprise"].includes(tier)) {
      return NextResponse.json(
        { error: "Invalid subscription tier" },
        { status: 400 }
      );
    }
    
    // Get user from database
    const user = await getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Get or create Stripe customer
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email,
        name: session.user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });
      
      customerId = customer.id;
      await updateUserStripeCustomerId(user.id, customerId);
    }
    
    // Get the price ID for the selected tier
    const priceId = getPriceIdForTier(tier);
    
    // Create Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/settings?success=true&tier=${tier}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          userId: user.id,
          tier: tier,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });
    
    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
    
  } catch (error) {
    console.error("Stripe checkout error:", error);
    
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
