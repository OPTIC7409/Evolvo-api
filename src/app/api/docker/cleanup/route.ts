/**
 * Docker Cleanup API Route
 * 
 * Cleans up Docker containers for a project
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db/supabase";
import {
  cleanupProject,
  getProjectContainers,
} from "@/lib/docker";

/**
 * DELETE /api/docker/cleanup?projectId=xxx - Remove all containers for a project
 */
export async function DELETE(request: Request) {
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
        message: "No containers to clean up",
      });
    }
    
    // Verify user owns this project
    if (project.userId !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }
    
    // Clean up containers
    const cleaned = await cleanupProject(projectId);
    
    if (!cleaned) {
      return NextResponse.json(
        { error: "Some containers failed to clean up" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "All containers removed successfully",
    });
    
  } catch (error) {
    console.error("Error cleaning up Docker containers:", error);
    return NextResponse.json(
      { error: "Failed to clean up containers" },
      { status: 500 }
    );
  }
}
