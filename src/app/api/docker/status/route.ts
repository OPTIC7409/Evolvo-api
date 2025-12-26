/**
 * Docker Status API Route
 * 
 * Gets the status of Docker containers for a project
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db/supabase";
import {
  getContainerStatus,
  getProjectContainers,
  getConnectionStrings,
  updateProjectActivity,
} from "@/lib/docker";

/**
 * GET /api/docker/status?projectId=xxx - Get container status for a project
 */
export async function GET(request: Request) {
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
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }
    
    // Get project containers
    const project = getProjectContainers(projectId);
    
    if (!project) {
      return NextResponse.json({
        success: true,
        hasContainers: false,
        containers: [],
        connectionStrings: {},
      });
    }
    
    // Verify user owns this project
    if (project.userId !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    
    // Update activity timestamp
    updateProjectActivity(projectId);
    
    // Get detailed status
    const status = await getContainerStatus(projectId);
    
    if (!status) {
      return NextResponse.json({
        success: true,
        hasContainers: false,
        containers: [],
        connectionStrings: {},
      });
    }
    
    // Get connection strings
    const connectionStrings = getConnectionStrings(projectId);
    
    return NextResponse.json({
      success: true,
      hasContainers: true,
      overallStatus: status.status,
      containers: status.containers.map(c => ({
        id: c.id,
        type: c.type,
        name: c.name,
        status: c.status,
        host: c.host,
        port: c.port,
        error: c.error,
        lastHealthCheck: c.lastHealthCheck,
      })),
      connectionStrings,
      createdAt: project.createdAt,
      lastActivity: project.lastActivity,
    });
    
  } catch (error) {
    console.error("Error getting Docker status:", error);
    return NextResponse.json(
      { error: "Failed to get container status" },
      { status: 500 }
    );
  }
}
