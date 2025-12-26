/**
 * Project Files API Route
 * 
 * Handles CRUD operations for project files (code persistence).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { 
  getUserByEmail, 
  getProject, 
  getProjectFiles, 
  saveProjectFile,
  saveProjectFiles,
  deleteProjectFile,
  deleteProjectFiles,
} from "@/lib/db/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/files - Get all files for a project
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
    
    const files = await getProjectFiles(id);
    
    // Transform to simpler format for client
    const clientFiles = files.map(f => ({
      path: f.path,
      content: f.content,
    }));
    
    return NextResponse.json({ files: clientFiles });
    
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/files - Save file(s)
 * 
 * Body can be:
 * - Single file: { path: string, content: string }
 * - Multiple files: { files: [{ path: string, content: string }, ...] }
 */
export async function POST(request: Request, { params }: RouteParams) {
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
    
    // Handle batch file save
    if (body.files && Array.isArray(body.files)) {
      const success = await saveProjectFiles(id, body.files);
      return NextResponse.json({ success });
    }
    
    // Handle single file save
    const { path, content } = body;
    
    if (!path || content === undefined) {
      return NextResponse.json(
        { error: "Missing path or content" },
        { status: 400 }
      );
    }
    
    const file = await saveProjectFile(id, path, content);
    
    return NextResponse.json({ success: true, file });
    
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: "Failed to save file" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/files - Delete file(s)
 * 
 * Query params:
 * - path: Delete specific file
 * - all=true: Delete all files
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    const deleteAll = url.searchParams.get("all") === "true";
    
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
    
    if (deleteAll) {
      await deleteProjectFiles(id);
    } else if (path) {
      await deleteProjectFile(id, path);
    } else {
      return NextResponse.json(
        { error: "Specify path or all=true" },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
