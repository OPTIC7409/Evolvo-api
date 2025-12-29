/**
 * Admin Subscriptions API
 * 
 * Gift and manage user subscriptions.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Verify admin token middleware
async function verifyAdminToken(token: string | null): Promise<string | null> {
  if (!token) return null;
  
  const session = await prisma.adminSession.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() }
    }
  });
  
  return session?.email || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("x-admin-token");
    
    if (!await verifyAdminToken(token)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all gifted subscriptions
    const giftedSubscriptions = await prisma.giftedSubscription.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            email: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json({ giftedSubscriptions });

  } catch (error) {
    console.error("[Admin Subscriptions GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-admin-token");
    const adminEmail = await verifyAdminToken(token);
    
    if (!adminEmail) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, userEmail, tier, durationDays, note } = body;

    if ((!userId && !userEmail) || !tier || !durationDays) {
      return NextResponse.json(
        { error: "Missing required fields: userId or userEmail, tier, durationDays" },
        { status: 400 }
      );
    }

    // Find user by ID or email
    let user;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId } });
    } else {
      user = await prisma.user.findUnique({ where: { email: userEmail } });
    }

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    // Create gifted subscription record
    const giftedSubscription = await prisma.giftedSubscription.create({
      data: {
        userId: user.id,
        giftedBy: adminEmail,
        tier,
        durationDays,
        expiresAt,
        note: note || null
      }
    });

    // Update or create the user's subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId: user.id }
    });

    if (existingSubscription) {
      await prisma.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          tier,
          status: "active",
          currentPeriodEnd: expiresAt
        }
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          tier,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: expiresAt
        }
      });
    }

    // Log analytics event
    await prisma.analyticsEvent.create({
      data: {
        userId: user.id,
        eventType: "subscription_gifted",
        eventData: {
          tier,
          durationDays,
          giftedBy: adminEmail,
          expiresAt: expiresAt.toISOString()
        }
      }
    }).catch(() => {}); // Don't fail if analytics fails

    return NextResponse.json({
      success: true,
      giftedSubscription,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    }, { status: 201 });

  } catch (error) {
    console.error("[Admin Subscriptions POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get("x-admin-token");
    
    if (!await verifyAdminToken(token)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Gifted subscription ID is required" },
        { status: 400 }
      );
    }

    // Get the gifted subscription to find the user
    const giftedSub = await prisma.giftedSubscription.findUnique({
      where: { id }
    });

    if (!giftedSub) {
      return NextResponse.json(
        { error: "Gifted subscription not found" },
        { status: 404 }
      );
    }

    // Delete the gifted subscription record
    await prisma.giftedSubscription.delete({
      where: { id }
    });

    // Downgrade the user's subscription to free
    await prisma.subscription.updateMany({
      where: { userId: giftedSub.userId },
      data: {
        tier: "free",
        currentPeriodEnd: null
      }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Admin Subscriptions DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
