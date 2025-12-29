/**
 * Admin Users API
 * 
 * User management operations.
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
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          subscriptions: {
            where: { status: "active" },
            take: 1
          },
          _count: {
            select: { projects: true }
          }
        }
      }),
      prisma.user.count({ where })
    ]);

    return NextResponse.json({
      users: users.map((user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        createdAt: Date;
        subscriptions: { tier: string; status: string }[];
        _count: { projects: number };
      }) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        createdAt: user.createdAt,
        subscription: user.subscriptions[0] || null,
        projectCount: user._count.projects
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("[Admin Users GET] Error:", error);
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
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Soft delete - we could add a deletedAt field, but for now just delete
    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Admin Users DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
