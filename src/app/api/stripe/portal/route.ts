/**
 * Stripe Customer Portal API
 * 
 * Creates a Stripe Customer Portal session for managing subscriptions.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe/config";
import { getUserByEmail } from "@/lib/db/supabase";

export async function POST() {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be logged in to manage your subscription" },
        { status: 401 }
      );
    }
    
    // Get user from database
    const user = await getUserByEmail(session.user.email);
    
    if (!user?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }
    
    // Create Customer Portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${process.env.NEXTAUTH_URL}/settings`,
    });
    
    return NextResponse.json({
      url: portalSession.url,
    });
    
  } catch (error) {
    console.error("Stripe portal error:", error);
    
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
