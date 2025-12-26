/**
 * Docker Provision API Route
 * 
 * Provisions Docker containers for a project (Premium feature)
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, getUserSubscription } from "@/lib/db/supabase";
import {
  provisionContainers,
  canProvision,
  getUserProjects as getDockerProjects,
  type ContainerType,
} from "@/lib/docker";

/**
 * POST /api/docker/provision - Provision Docker containers for a project
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    const user = await getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    const { projectId, services } = body as {
      projectId: string;
      services: ContainerType[];
    };
    
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }
    
    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json(
        { error: "At least one service must be specified" },
        { status: 400 }
      );
    }
    
    // Validate service types
    const validServices: ContainerType[] = ["postgres", "redis", "pgvector"];
    for (const service of services) {
      if (!validServices.includes(service)) {
        return NextResponse.json(
          { error: `Invalid service type: ${service}` },
          { status: 400 }
        );
      }
    }
    
    // Get user's subscription to check tier
    const subscription = await getUserSubscription(user.id);
    const tier = subscription?.tier || "free";
    
    console.log("[Docker Provision] User:", user.id, "Subscription:", subscription, "Tier:", tier);
    
    // Get current Docker projects count for user
    const userDockerProjects = getDockerProjects(user.id);
    
    // Check if user can provision
    const canProvisionResult = canProvision(tier, userDockerProjects.length, services);
    
    console.log("[Docker Provision] Can provision:", canProvisionResult);
    
    if (!canProvisionResult.allowed) {
      return NextResponse.json(
        { 
          error: canProvisionResult.reason,
          requiresUpgrade: true,
          debugInfo: { tier, subscriptionExists: !!subscription }
        },
        { status: 403 }
      );
    }
    
    // Provision containers
    const result = await provisionContainers({
      projectId,
      userId: user.id,
      services,
    });
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    // Return container details (connection strings are included)
    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      containers: result.containers.map(c => ({
        id: c.id,
        type: c.type,
        status: c.status,
        host: c.host,
        port: c.port,
        connectionString: c.connectionString,
      })),
    });
    
  } catch (error) {
    console.error("Error provisioning Docker containers:", error);
    return NextResponse.json(
      { error: "Failed to provision containers" },
      { status: 500 }
    );
  }
}
