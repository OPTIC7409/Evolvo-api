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
import { 
  getUserByEmail, 
  updateSubscription,
  createServerClient
} from "@/lib/db/supabase";

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
    
    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    // Use price ID to determine tier, fallback to URL hint, then default to "pro"
    const tier = getTierFromPriceId(priceId) || (tierHint as "pro" | "enterprise") || "pro";
    
    console.log("Stripe subscription data:", {
      id: subscription.id,
      status: subscription.status,
      priceId,
      tier,
      tierHint,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
    });
    
    // Update database with subscription info
    const supabase = createServerClient();
    
    // First check if subscription record exists
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    // Safely convert Stripe timestamps to ISO strings
    const periodStart = subscription.current_period_start 
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : new Date().toISOString();
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default to 30 days from now
    
    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status: "active" as const,
      tier: tier,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
    };
    
    if (existingSub) {
      // Update existing
      await supabase
        .from("subscriptions")
        .update(subscriptionData)
        .eq("user_id", user.id);
    } else {
      // Create new
      await supabase.from("subscriptions").insert({
        user_id: user.id,
        ...subscriptionData,
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
