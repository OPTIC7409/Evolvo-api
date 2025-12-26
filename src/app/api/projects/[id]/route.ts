/**
 * Single Project API Route
 * 
 * Handles operations on a specific project.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, getProject, updateProject, deleteProject, touchProject } from "@/lib/db/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id] - Get a specific project
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
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
    
    const project = await getProject(id);
    
    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    
    // Update last opened timestamp
    await touchProject(id);
    
    return NextResponse.json({ project });
    
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id] - Update a project
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
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
    
    const project = await getProject(id);
    
    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    const { name, description, thumbnail, status } = body;
    
    await updateProject(id, { name, description, thumbnail, status });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id] - Delete a project
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    
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
    
    const project = await getProject(id);
    
    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    
    await deleteProject(id);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
