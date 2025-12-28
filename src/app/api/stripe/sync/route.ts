/**
 * Stripe Sync API
 * 
 * Syncs subscription status directly from Stripe.
 * This is a fallback for when webhooks aren't configured (local development).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe, getTierFromPriceId } from "@/lib/stripe/config";
import { getUserByEmail, updateSubscription } from "@/lib/db/supabase";
import prisma from "@/lib/db/prisma";

export async function POST(request: Request) {
  try {
    // Get optional tier hint from request body
    let tierHint: string | null = null;
    try {
      const body = await request.json();
      tierHint = body.tier || null;
    } catch {
      // No body or invalid JSON, ignore
    }
    
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
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
    
    // Check if user has a Stripe customer ID
    if (!user.stripe_customer_id) {
      return NextResponse.json({
        synced: false,
        message: "No Stripe customer found",
        tier: "free",
      });
    }
    
    // Get subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: "active",
      limit: 1,
    });
    
    if (subscriptions.data.length === 0) {
      // No active subscription, ensure user is on free tier
      await updateSubscription(user.id, {
        status: "active",
        tier: "free",
        stripe_subscription_id: null,
        stripe_price_id: null,
      });
      
      return NextResponse.json({
        synced: true,
        tier: "free",
      });
    }
    
    // Cast to any to access period properties (Stripe types vary by version)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subscription = subscriptions.data[0] as any;
    const priceId = subscription.items.data[0]?.price.id;
    // Use price ID to determine tier, fallback to URL hint, then default to "pro"
    const tier = getTierFromPriceId(priceId) || (tierHint as "pro" | "enterprise") || "pro";
    
    // Get period timestamps
    const currentPeriodStart = subscription.current_period_start;
    const currentPeriodEnd = subscription.current_period_end;
    
    console.log("Stripe subscription data:", {
      id: subscription.id,
      status: subscription.status,
      priceId,
      tier,
      tierHint,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
    });
    
    // Safely convert Stripe timestamps to dates
    const periodStart = currentPeriodStart 
      ? new Date(currentPeriodStart * 1000)
      : new Date();
    const periodEnd = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
    
    // First check if subscription record exists
    const existingSub = await prisma.subscription.findFirst({
      where: { userId: user.id },
    });
    
    const subscriptionData = {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: "active",
      tier: tier,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    };
    
    if (existingSub) {
      // Update existing
      await prisma.subscription.update({
        where: { id: existingSub.id },
        data: subscriptionData,
      });
    } else {
      // Create new
      await prisma.subscription.create({
        data: {
          userId: user.id,
          ...subscriptionData,
        },
      });
    }
    
    console.log(`Synced subscription for ${user.email}: ${tier}`);
    
    return NextResponse.json({
      synced: true,
      tier: tier,
      status: subscription.status,
    });
    
  } catch (error) {
    console.error("Stripe sync error:", error);
    
    const message = error instanceof Error ? error.message : "Failed to sync subscription";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
