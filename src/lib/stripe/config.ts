/**
 * Stripe Configuration
 * 
 * Stripe client and configuration for payment processing.
 */

import Stripe from "stripe";

// Server-side Stripe client
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-12-15.clover",
  typescript: true,
});

// Stripe price IDs for each tier (set these in .env after creating products in Stripe)
export const STRIPE_PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID || "",
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
} as const;

// Security audit price ID (one-time payment)
export const SECURITY_AUDIT_PRICE_ID = process.env.STRIPE_SECURITY_AUDIT_PRICE_ID || "";

// Security audit price in pence (£14.99)
export const SECURITY_AUDIT_PRICE_AMOUNT = 1499;

// Get price ID for a tier
export function getPriceIdForTier(tier: "pro" | "enterprise"): string {
  const priceId = STRIPE_PRICE_IDS[tier];
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for tier: ${tier}`);
  }
  return priceId;
}

// Get tier from price ID
export function getTierFromPriceId(priceId: string): "pro" | "enterprise" | null {
  if (priceId === STRIPE_PRICE_IDS.pro) return "pro";
  if (priceId === STRIPE_PRICE_IDS.enterprise) return "enterprise";
  return null;
}

/**
 * Create a payment intent for security audit
 */
export async function createSecurityAuditPaymentIntent(
  customerId: string,
  projectId: string,
  auditScanId: string
): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    amount: SECURITY_AUDIT_PRICE_AMOUNT,
    currency: "gbp",
    customer: customerId,
    metadata: {
      type: "security_audit",
      projectId,
      auditScanId,
    },
    automatic_payment_methods: {
      enabled: true,
    },
  });
}

/**
 * Create or get Stripe customer for user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  existingCustomerId?: string | null
): Promise<string> {
  if (existingCustomerId) {
    return existingCustomerId;
  }
  
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });
  
  return customer.id;
}
