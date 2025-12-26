/**
 * Subscription Tier Definitions
 * 
 * Defines the features and limits for each subscription tier.
 */

export type SubscriptionTier = "free" | "pro" | "enterprise";

export interface TierFeatures {
  name: string;
  price: number; // Monthly price in dollars
  priceLabel: string;
  description: string;
  features: string[];
  limits: {
    monthlyRequests: number;
    projectLimit: number;
    responseDelay: number; // Milliseconds
    dockerProjects: number; // Max Docker sandbox projects
    dockerContainers: number; // Max containers per project
  };
  access: {
    codeEditor: boolean;
    fileExplorer: boolean;
    terminal: boolean;
    preview: boolean;
    export: boolean;
    customDomain: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
    dockerCloud: boolean; // Docker cloud services access
  };
}

export const TIERS: Record<SubscriptionTier, TierFeatures> = {
  free: {
    name: "Free",
    price: 0,
    priceLabel: "Free",
    description: "Get started with basic features",
    features: [
      "50 AI requests/month",
      "1 project",
      "Live preview",
      "Basic templates",
      "Community support",
    ],
    limits: {
      monthlyRequests: 50,
      projectLimit: 1,
      responseDelay: 3000, // 3 second artificial delay
      dockerProjects: 0,
      dockerContainers: 0,
    },
    access: {
      codeEditor: false,
      fileExplorer: true,
      terminal: false,
      preview: true,
      export: false,
      customDomain: false,
      prioritySupport: false,
      apiAccess: false,
      dockerCloud: false,
    },
  },
  pro: {
    name: "Pro",
    price: 19,
    priceLabel: "$19/mo",
    description: "For serious builders",
    features: [
      "500 AI requests/month",
      "10 projects",
      "Full code editor access",
      "Terminal access",
      "Export projects",
      "Priority response speed",
      "Docker Cloud Services",
      "PostgreSQL & Redis",
      "Email support",
    ],
    limits: {
      monthlyRequests: 500,
      projectLimit: 10,
      responseDelay: 0,
      dockerProjects: 3,
      dockerContainers: 3,
    },
    access: {
      codeEditor: true,
      fileExplorer: true,
      terminal: true,
      preview: true,
      export: true,
      customDomain: false,
      prioritySupport: false,
      apiAccess: false,
      dockerCloud: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    priceLabel: "$99/mo",
    description: "For teams and businesses",
    features: [
      "Unlimited AI requests",
      "Unlimited projects",
      "Full code editor access",
      "Terminal access",
      "Export projects",
      "Priority response speed",
      "Docker Cloud Services",
      "PostgreSQL, Redis & pgvector",
      "Custom domains",
      "API access",
      "Priority support",
      "Team collaboration (coming soon)",
    ],
    limits: {
      monthlyRequests: Infinity,
      projectLimit: Infinity,
      responseDelay: 0,
      dockerProjects: 50,
      dockerContainers: 10,
    },
    access: {
      codeEditor: true,
      fileExplorer: true,
      terminal: true,
      preview: true,
      export: true,
      customDomain: true,
      prioritySupport: true,
      apiAccess: true,
      dockerCloud: true,
    },
  },
};

/**
 * Get tier features
 */
export function getTierFeatures(tier: SubscriptionTier): TierFeatures {
  return TIERS[tier];
}

/**
 * Check if user can access a feature
 */
export function canAccess(tier: SubscriptionTier, feature: keyof TierFeatures["access"]): boolean {
  return TIERS[tier].access[feature];
}

/**
 * Check if user has reached their request limit
 */
export function hasReachedLimit(tier: SubscriptionTier, currentUsage: number): boolean {
  const limit = TIERS[tier].limits.monthlyRequests;
  return limit !== Infinity && currentUsage >= limit;
}

/**
 * Get the response delay for a tier
 */
export function getResponseDelay(tier: SubscriptionTier): number {
  return TIERS[tier].limits.responseDelay;
}

/**
 * Get all tiers for display
 */
export function getAllTiers(): { tier: SubscriptionTier; features: TierFeatures }[] {
  return Object.entries(TIERS).map(([tier, features]) => ({
    tier: tier as SubscriptionTier,
    features,
  }));
}

/**
 * Compare tiers - returns true if tier1 is higher than tier2
 */
export function isHigherTier(tier1: SubscriptionTier, tier2: SubscriptionTier): boolean {
  const order: Record<SubscriptionTier, number> = {
    free: 0,
    pro: 1,
    enterprise: 2,
  };
  return order[tier1] > order[tier2];
}
