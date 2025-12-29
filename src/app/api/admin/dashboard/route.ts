/**
 * Admin Dashboard API
 * 
 * Returns dashboard statistics and analytics.
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

    // Get date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Parallel queries for performance
    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      totalProjects,
      activeSubscriptions,
      proSubscriptions,
      teamSubscriptions,
      totalPlugins,
      publishedPlugins,
      totalInstalls,
      recentEvents
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: thisWeek } } }),
      prisma.user.count({ where: { createdAt: { gte: thisMonth } } }),
      prisma.project.count(),
      prisma.subscription.count({ where: { status: "active" } }),
      prisma.subscription.count({ where: { status: "active", tier: "pro" } }),
      prisma.subscription.count({ where: { status: "active", tier: "team" } }),
      prisma.marketplaceItem.count().catch(() => 0),
      prisma.marketplaceItem.count({ where: { published: true } }).catch(() => 0),
      prisma.userInstalledPlugin.count().catch(() => 0),
      prisma.analyticsEvent.findMany({
        take: 20,
        orderBy: { createdAt: "desc" }
      }).catch(() => [])
    ]);

    // Calculate revenue (rough estimate based on subscriptions)
    const proRevenue = proSubscriptions * 19; // $19/month
    const teamRevenue = teamSubscriptions * 49; // $49/month
    const mrr = proRevenue + teamRevenue;

    return NextResponse.json({
      stats: {
        users: {
          total: totalUsers,
          today: newUsersToday,
          thisWeek: newUsersThisWeek,
          thisMonth: newUsersThisMonth
        },
        projects: {
          total: totalProjects
        },
        subscriptions: {
          active: activeSubscriptions,
          pro: proSubscriptions,
          team: teamSubscriptions,
          free: totalUsers - activeSubscriptions
        },
        revenue: {
          mrr,
          proRevenue,
          teamRevenue
        },
        plugins: {
          total: totalPlugins,
          published: publishedPlugins,
          installs: totalInstalls
        }
      },
      recentEvents
    });

  } catch (error) {
    console.error("[Admin Dashboard] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
