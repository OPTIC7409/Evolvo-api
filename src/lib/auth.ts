/**
 * NextAuth Configuration - Backend API
 * 
 * Handles authentication with Google and GitHub OAuth providers.
 * This is the ONLY place where OAuth should be handled - the frontend
 * proxies all auth requests here for security.
 */

import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { getOrCreateUser, getUserSubscription } from "@/lib/db/supabase";

// Frontend URL for redirects after auth
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Debug logging for auth configuration
console.log("[AUTH CONFIG] FRONTEND_URL:", FRONTEND_URL);
console.log("[AUTH CONFIG] NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
console.log("[AUTH CONFIG] NODE_ENV:", process.env.NODE_ENV);

// Extend the default session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      tier: "free" | "pro" | "enterprise";
    };
  }
  
  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    tier: "free" | "pro" | "enterprise";
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
  ],
  
  // Use frontend URLs for sign-in pages (user will be on frontend)
  pages: {
    signIn: `${FRONTEND_URL}/login`,
    error: `${FRONTEND_URL}/login`,
  },
  
  // Cookie configuration for cross-origin usage
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" 
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Don't set domain - let the browser handle it for both origins
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.callback-url"
        : "next-auth.callback-url",
      options: {
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Host-next-auth.csrf-token"
        : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    state: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.state"
        : "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 15, // 15 minutes
      },
    },
  },
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Allow redirects to the frontend URL
      if (url.startsWith(FRONTEND_URL)) {
        return url;
      }
      // Allow relative URLs
      if (url.startsWith("/")) {
        return `${FRONTEND_URL}${url}`;
      }
      // Allow backend URLs
      if (url.startsWith(baseUrl)) {
        // Redirect backend URLs to frontend
        return url.replace(baseUrl, FRONTEND_URL);
      }
      // Default to frontend
      return FRONTEND_URL;
    },
    
    async signIn({ user, account }) {
      // For GitHub users without public email, use their GitHub ID as identifier
      if (!user.email && account?.provider === "github") {
        // GitHub users without email can still sign in
        // We'll use their provider account ID as a fallback identifier
        user.email = `${account.providerAccountId}@github.user`;
      }
      
      if (!user.email) {
        console.error("Sign in failed: No email provided");
        return false;
      }
      
      // Always allow sign in - database operations are optional
      // We'll try to create the user but won't block sign-in if it fails
      try {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          await getOrCreateUser(user.email, user.name || undefined, user.image || undefined);
        }
      } catch (error) {
        // Log but don't block sign-in
        console.warn("Could not save user to database (tables may not exist yet):", error);
      }
      return true;
    },
    
    async jwt({ token, user, account, trigger }) {
      if (user) {
        // Handle GitHub users without email
        let userEmail = user.email;
        if (!userEmail && account?.provider === "github") {
          userEmail = `${account.providerAccountId}@github.user`;
        }
        
        token.email = userEmail || user.id || "unknown";
        token.id = user.id || userEmail || "unknown";
        token.tier = "free";
        
        // Try to get user from database, but don't fail if it doesn't work
        if (userEmail && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const dbUser = await getOrCreateUser(userEmail, user.name || undefined, user.image || undefined);
            const subscription = await getUserSubscription(dbUser.id);
            token.id = dbUser.id;
            token.tier = subscription?.tier || "free";
          } catch (error) {
            console.warn("Could not fetch user from database:", error);
            // Keep default values set above
          }
        }
      }
      
      // Refresh tier on update (optional)
      if (trigger === "update" && token.id && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const subscription = await getUserSubscription(token.id);
          token.tier = subscription?.tier || "free";
        } catch {
          // Ignore refresh errors
        }
      }
      
      return token;
    },
    
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.tier = token.tier;
      }
      return session;
    },
  },
  
  events: {
    async signIn({ user }) {
      console.log(`User signed in: ${user.email}`);
    },
  },
  
  debug: process.env.NODE_ENV === "development",
};

/**
 * Get the current user's tier from a session
 */
export function getTierFromSession(session: { user?: { tier?: string } } | null): "free" | "pro" | "enterprise" {
  return (session?.user?.tier as "free" | "pro" | "enterprise") || "free";
}

/**
 * Check if user has access to a feature based on tier
 */
export function hasFeatureAccess(tier: "free" | "pro" | "enterprise", feature: string): boolean {
  const features: Record<string, ("free" | "pro" | "enterprise")[]> = {
    codeEditor: ["pro", "enterprise"],
    unlimitedProjects: ["enterprise"],
    prioritySupport: ["enterprise"],
    customBranding: ["enterprise"],
  };
  
  const allowedTiers = features[feature];
  if (!allowedTiers) return true; // Feature not restricted
  
  return allowedTiers.includes(tier);
}

/**
 * Get usage limits based on tier
 */
export function getUsageLimits(tier: "free" | "pro" | "enterprise"): {
  monthlyRequests: number;
  projectLimit: number;
  responseDelay: number;
} {
  const limits = {
    free: {
      monthlyRequests: 50,
      projectLimit: 1,
      responseDelay: 3000, // 3 second delay
    },
    pro: {
      monthlyRequests: 500,
      projectLimit: 10,
      responseDelay: 0,
    },
    enterprise: {
      monthlyRequests: Infinity,
      projectLimit: Infinity,
      responseDelay: 0,
    },
  };
  
  return limits[tier];
}
