/**
 * Stripe Webhooks API
 * 
 * Handles Stripe webhook events for subscription management.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { stripe, getTierFromPriceId } from "@/lib/stripe/config";
import { 
  getUserByStripeCustomerId, 
  updateSubscription,
  createServerClient,
  updateAuditPurchaseStatus,
  getAuditPurchaseByPaymentIntent,
} from "@/lib/db/supabase";
import { sendPaymentFailedEmail, sendSubscriptionCanceledEmail } from "@/lib/email";
import { logPaymentEvent, logError } from "@/lib/logger";
import Stripe from "stripe";

// Disable body parsing for webhook signature verification
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");
  
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }
  
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }
  
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
      
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }
      
      // Security audit one-time payment events
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }
      
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  
  // Check if this is a security audit purchase
  if (metadata?.type === "security_audit") {
    await handleSecurityAuditCheckout(session);
    return;
  }
  
  // Otherwise, handle as subscription
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  
  if (!customerId || !subscriptionId) {
    console.error("Missing customer or subscription ID in checkout session");
    return;
  }
  
  // Get the user
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }
  
  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId) || "pro";
  
  // Update user's subscription in database
  const supabase = createServerClient();
  
  // First check if subscription exists
  const { data: existingSub } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();
    
  if (existingSub) {
    // Update existing
    await supabase
      .from("subscriptions")
      .update({
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        status: "active",
        tier: tier,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      })
      .eq("user_id", user.id);
  } else {
    // Create new
    await supabase.from("subscriptions").insert({
      user_id: user.id,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      status: "active",
      tier: tier,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    });
  }
  
  console.log(`User ${user.email} subscribed to ${tier} plan`);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId) || "pro";
  
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) {
    console.error(`No user found for Stripe customer: ${customerId}`);
    return;
  }
  
  // Map Stripe status to our status
  let status: "active" | "canceled" | "past_due" | "trialing" | "incomplete" = "active";
  switch (subscription.status) {
    case "active":
      status = "active";
      break;
    case "canceled":
      status = "canceled";
      break;
    case "past_due":
      status = "past_due";
      break;
    case "trialing":
      status = "trialing";
      break;
    case "incomplete":
    case "incomplete_expired":
      status = "incomplete";
      break;
  }
  
  await updateSubscription(user.id, {
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: status,
    tier: tier,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
  });
  
  console.log(`Updated subscription for user ${user.email}: ${tier} (${status})`);
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) {
    logError(new Error(`No user found for Stripe customer: ${customerId}`), {
      context: "stripe_webhook",
      event: "subscription_deleted",
    });
    return;
  }
  
  // Downgrade to free tier
  await updateSubscription(user.id, {
    status: "canceled",
    tier: "free",
    stripe_subscription_id: null,
    stripe_price_id: null,
    cancel_at_period_end: false,
  });
  
  logPaymentEvent("subscription_canceled", {
    userId: user.id,
    customerId,
    subscriptionId: subscription.id,
  });
  
  // Send cancellation email
  const endDate = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "immediately";
  
  const emailResult = await sendSubscriptionCanceledEmail(
    user.email,
    user.name || "there",
    endDate
  );
  
  if (!emailResult.success) {
    logError(new Error(`Failed to send subscription canceled email: ${emailResult.error}`), {
      context: "email",
      userId: user.id,
    });
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) {
    logError(new Error(`No user found for Stripe customer: ${customerId}`), {
      context: "stripe_webhook",
      event: "payment_failed",
    });
    return;
  }
  
  await updateSubscription(user.id, {
    status: "past_due",
  });
  
  logPaymentEvent("payment_failed", {
    userId: user.id,
    customerId,
    invoiceId: invoice.id,
    amountDue: invoice.amount_due,
  });
  
  // Send email notification about failed payment
  const amount = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: invoice.currency?.toUpperCase() || "GBP",
  }).format((invoice.amount_due || 0) / 100);
  
  const emailResult = await sendPaymentFailedEmail(
    user.email,
    user.name || "there",
    amount
  );
  
  if (!emailResult.success) {
    logError(new Error(`Failed to send payment failed email: ${emailResult.error}`), {
      context: "email",
      userId: user.id,
    });
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  const user = await getUserByStripeCustomerId(customerId);
  
  if (!user) {
    return; // Not an error, could be first payment handled by checkout.session.completed
  }
  
  // Make sure subscription is marked as active
  await updateSubscription(user.id, {
    status: "active",
  });
  
  console.log(`Payment succeeded for user ${user.email}`);
}

/**
 * Handle successful payment intent (for one-time payments like security audit)
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  
  // Check if this is a security audit payment
  if (metadata?.type === "security_audit") {
    await updateAuditPurchaseStatus(paymentIntent.id, "completed");
    console.log(`Security audit payment succeeded for project: ${metadata.projectId}`);
  }
}

/**
 * Handle failed payment intent
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const metadata = paymentIntent.metadata;
  
  // Check if this is a security audit payment
  if (metadata?.type === "security_audit") {
    await updateAuditPurchaseStatus(paymentIntent.id, "failed");
    console.log(`Security audit payment failed for project: ${metadata.projectId}`);
  }
}

/**
 * Handle security audit checkout completion
 */
async function handleSecurityAuditCheckout(session: Stripe.Checkout.Session) {
  const metadata = session.metadata;
  
  if (!metadata?.projectId || !metadata?.auditId || !metadata?.userId) {
    console.error("Missing metadata in security audit checkout session");
    return;
  }
  
  const supabase = createServerClient();
  
  // Update the purchase record to completed
  // We use session.id since that's what we stored in createAuditPurchase
  await supabase
    .from("security_audit_purchases")
    .update({ status: "completed" })
    .eq("stripe_payment_intent_id", session.id);
  
  console.log(`Security audit checkout completed for project: ${metadata.projectId}`);
}
