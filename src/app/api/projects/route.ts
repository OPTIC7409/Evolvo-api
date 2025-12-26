/**
 * Projects API Route
 * 
 * Handles CRUD operations for user projects.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, getUserProjects, createProject } from "@/lib/db/supabase";

/**
 * GET /api/projects - Get all projects for current user
 */
export async function GET() {
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
    
    const projects = await getUserProjects(user.id);
    
    return NextResponse.json({ projects });
    
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects - Create a new project
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
    const { name, description, framework } = body;
    
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }
    
    const project = await createProject(user.id, name, description, framework);
    
    return NextResponse.json({ project });
    
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
