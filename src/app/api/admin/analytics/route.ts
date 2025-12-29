/**
 * Admin Analytics API
 * 
 * Detailed analytics and reports.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Verify admin token middleware
async function verifyAdminToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  
  const session = await prisma.adminSession.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() }
    }
  });
  
  return !!session;
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

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d"; // 7d, 30d, 90d
    
    // Calculate date range
    const days = range === "90d" ? 90 : range === "30d" ? 30 : 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get user signups over time
    const userSignups = await prisma.user.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: startDate }
      },
      _count: true,
      orderBy: { createdAt: "asc" }
    });

    // Get project creations over time
    const projectCreations = await prisma.project.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: startDate }
      },
      _count: true,
      orderBy: { createdAt: "asc" }
    });

    // Get subscription distribution
    const subscriptionTiers = await prisma.subscription.groupBy({
      by: ["tier"],
      where: { status: "active" },
      _count: true
    });

    // Get plugin categories distribution
    const pluginCategories = await prisma.marketplaceItem.groupBy({
      by: ["category"],
      where: { published: true },
      _count: true
    }).catch(() => []);

    // Get top plugins by downloads
    const topPlugins = await prisma.marketplaceItem.findMany({
      where: { published: true },
      orderBy: { downloads: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        downloads: true,
        rating: true,
        category: true
      }
    }).catch(() => []);

    // Get recent analytics events
    const recentEvents = await prisma.analyticsEvent.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    }).catch(() => []);

    // Event type distribution
    const eventTypeCounts: Record<string, number> = {};
    recentEvents.forEach((event: { eventType: string }) => {
      eventTypeCounts[event.eventType] = (eventTypeCounts[event.eventType] || 0) + 1;
    });

    // Process daily data
    const dailyData: Record<string, { signups: number; projects: number }> = {};
    
    // Initialize all days in range
    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = date.toISOString().split("T")[0];
      dailyData[key] = { signups: 0, projects: 0 };
    }

    return NextResponse.json({
      timeRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days
      },
      userSignups: {
        total: userSignups.reduce((sum: number, day: { _count: number }) => sum + day._count, 0),
        byDay: dailyData
      },
      projectCreations: {
        total: projectCreations.reduce((sum: number, day: { _count: number }) => sum + day._count, 0)
      },
      subscriptions: {
        distribution: subscriptionTiers.reduce((acc: Record<string, number>, tier: { tier: string; _count: number }) => {
          acc[tier.tier] = tier._count;
          return acc;
        }, {} as Record<string, number>)
      },
      plugins: {
        categories: pluginCategories.reduce((acc: Record<string, number>, cat: { category: string; _count: number }) => {
          acc[cat.category] = cat._count;
          return acc;
        }, {} as Record<string, number>),
        top: topPlugins
      },
      events: {
        distribution: eventTypeCounts,
        recent: recentEvents.slice(0, 20)
      }
    });

  } catch (error) {
    console.error("[Admin Analytics GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Track analytics event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, eventType, eventData } = body;

    if (!eventType) {
      return NextResponse.json(
        { error: "eventType is required" },
        { status: 400 }
      );
    }

    await prisma.analyticsEvent.create({
      data: {
        userId: userId || null,
        eventType,
        eventData: eventData || {}
      }
    });

    return NextResponse.json({ success: true }, { status: 201 });

  } catch (error) {
    console.error("[Admin Analytics POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
