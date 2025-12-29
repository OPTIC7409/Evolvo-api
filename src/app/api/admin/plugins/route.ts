/**
 * Admin Plugins API
 * 
 * CRUD operations for marketplace plugins.
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

// Generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
    const category = searchParams.get("category");
    const published = searchParams.get("published");

    const where: Record<string, unknown> = {};
    if (category && category !== "all") {
      where.category = category;
    }
    if (published !== null) {
      where.published = published === "true";
    }

    const plugins = await prisma.marketplaceItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { installations: true }
        }
      }
    });

    return NextResponse.json({ plugins });

  } catch (error) {
    console.error("[Admin Plugins GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("x-admin-token");
    
    if (!await verifyAdminToken(token)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      longDescription,
      category,
      icon,
      version,
      features,
      requirements,
      documentation,
      repository,
      published,
      verified
    } = body;

    if (!name || !description || !category || !icon) {
      return NextResponse.json(
        { error: "Missing required fields: name, description, category, icon" },
        { status: 400 }
      );
    }

    const slug = generateSlug(name);

    // Check if slug already exists
    const existing = await prisma.marketplaceItem.findUnique({
      where: { slug }
    });

    if (existing) {
      return NextResponse.json(
        { error: "A plugin with this name already exists" },
        { status: 409 }
      );
    }

    const plugin = await prisma.marketplaceItem.create({
      data: {
        slug,
        name,
        description,
        longDescription: longDescription || null,
        category,
        author: "Evolvo",
        icon,
        version: version || "1.0.0",
        features: features || [],
        requirements: requirements || [],
        documentation: documentation || null,
        repository: repository || null,
        published: published ?? false,
        verified: verified ?? true
      }
    });

    return NextResponse.json({ plugin }, { status: 201 });

  } catch (error) {
    console.error("[Admin Plugins POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get("x-admin-token");
    
    if (!await verifyAdminToken(token)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Plugin ID is required" },
        { status: 400 }
      );
    }

    // If name is being updated, regenerate slug
    if (updates.name) {
      updates.slug = generateSlug(updates.name);
    }

    const plugin = await prisma.marketplaceItem.update({
      where: { id },
      data: updates
    });

    return NextResponse.json({ plugin });

  } catch (error) {
    console.error("[Admin Plugins PUT] Error:", error);
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
        { error: "Plugin ID is required" },
        { status: 400 }
      );
    }

    await prisma.marketplaceItem.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[Admin Plugins DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
