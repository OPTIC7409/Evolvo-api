/**
 * Delete User Account API
 * 
 * Permanently deletes a user's account and all associated data.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe/config";
import { getUserByEmail } from "@/lib/db/supabase";
import prisma from "@/lib/db/prisma";

export async function DELETE(request: Request) {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Verify confirmation
    const body = await request.json();
    if (body.confirmation !== "confirm") {
      return NextResponse.json(
        { error: "Please type 'confirm' to delete your account" },
        { status: 400 }
      );
    }
    
    try {
      const user = await getUserByEmail(session.user.email);
      
      if (user) {
        // Cancel any active Stripe subscription
        if (user.stripe_customer_id) {
          try {
            const subscriptions = await stripe.subscriptions.list({
              customer: user.stripe_customer_id,
              status: "active",
            });
            
            for (const subscription of subscriptions.data) {
              await stripe.subscriptions.cancel(subscription.id);
            }
            
            // Optionally delete the Stripe customer
            // await stripe.customers.del(user.stripe_customer_id);
          } catch (stripeError) {
            console.error("Error canceling Stripe subscription:", stripeError);
            // Continue with deletion even if Stripe fails
          }
        }
        
        // Delete user data in order (respecting foreign keys)
        // Prisma will cascade deletes based on schema relations
        
        // Delete usage records
        await prisma.usage.deleteMany({
          where: { userId: user.id },
        });
        
        // Delete subscriptions
        await prisma.subscription.deleteMany({
          where: { userId: user.id },
        });
        
        // Delete project files first (child of projects)
        await prisma.projectFile.deleteMany({
          where: { project: { userId: user.id } },
        });
        
        // Delete project messages (child of projects)
        await prisma.projectMessage.deleteMany({
          where: { project: { userId: user.id } },
        });
        
        // Delete projects
        await prisma.project.deleteMany({
          where: { userId: user.id },
        });
        
        // Delete sessions
        await prisma.session.deleteMany({
          where: { userId: user.id },
        });
        
        // Delete accounts (OAuth connections)
        await prisma.account.deleteMany({
          where: { userId: user.id },
        });
        
        // Finally, delete the user
        await prisma.user.delete({
          where: { id: user.id },
        });
        
        console.log(`Deleted user account: ${session.user.email}`);
      }
    } catch (dbError) {
      console.error("Database error during account deletion:", dbError);
      return NextResponse.json(
        { error: "Failed to delete account data" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
    
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
