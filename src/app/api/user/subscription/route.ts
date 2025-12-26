/**
 * User Subscription API
 * 
 * Returns the current user's subscription details and usage.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTierFeatures, type SubscriptionTier } from "@/lib/subscription/tiers";

export async function GET() {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Check if Supabase is configured
    const supabaseConfigured = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseConfigured) {
      // Use database for subscription data
      try {
        const { getUserByEmail, getUserSubscription, getMonthlyUsage } = await import("@/lib/db/supabase");
        
        const user = await getUserByEmail(session.user.email);
        
        if (!user) {
          // User not in database yet, return free tier defaults
          const tierFeatures = getTierFeatures("free");
          return NextResponse.json({
            user: {
              id: session.user.id || session.user.email,
              email: session.user.email,
              name: session.user.name,
            },
            subscription: {
              tier: "free",
              status: "active",
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
            },
            features: tierFeatures,
            usage: {
              aiRequests: 0,
              limit: tierFeatures.limits.monthlyRequests,
              percentUsed: 0,
            },
          });
        }
        
        // Get subscription
        const subscription = await getUserSubscription(user.id);
        const tier = (subscription?.tier || "free") as SubscriptionTier;
        const tierFeatures = getTierFeatures(tier);
        
        // Get usage
        const usage = await getMonthlyUsage(user.id);
        
        // Note: Infinity doesn't serialize to JSON, so use -1 to represent "unlimited"
        const monthlyLimit = tierFeatures.limits.monthlyRequests === Infinity 
          ? -1 
          : tierFeatures.limits.monthlyRequests;
        
        return NextResponse.json({
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          subscription: {
            tier: tier,
            status: subscription?.status || "active",
            currentPeriodEnd: subscription?.current_period_end || null,
            cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
          },
          features: {
            ...tierFeatures,
            limits: {
              ...tierFeatures.limits,
              monthlyRequests: monthlyLimit,
            },
          },
          usage: {
            aiRequests: usage?.ai_requests || 0,
            limit: monthlyLimit,
            percentUsed: monthlyLimit === -1 
              ? 0 
              : ((usage?.ai_requests || 0) / monthlyLimit) * 100,
          },
        });
      } catch (dbError) {
        console.error("Database error:", dbError);
        // Fall through to default response
      }
    }
    
    // Return default free tier if Supabase not configured or error occurred
    const tier: SubscriptionTier = (session.user as { tier?: SubscriptionTier }).tier || "free";
    const tierFeatures = getTierFeatures(tier);
    
    // Note: Infinity doesn't serialize to JSON, so use -1 to represent "unlimited"
    const monthlyLimit = tierFeatures.limits.monthlyRequests === Infinity 
      ? -1 
      : tierFeatures.limits.monthlyRequests;
    
    return NextResponse.json({
      user: {
        id: session.user.id || session.user.email,
        email: session.user.email,
        name: session.user.name,
      },
      subscription: {
        tier: tier,
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      features: {
        ...tierFeatures,
        limits: {
          ...tierFeatures.limits,
          monthlyRequests: monthlyLimit,
        },
      },
      usage: {
        aiRequests: 0,
        limit: monthlyLimit,
        percentUsed: 0,
      },
    });
    
  } catch (error) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
