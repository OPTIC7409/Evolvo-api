/**
 * Project Messages API Route
 * 
 * Handles CRUD operations for project chat messages.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { 
  getUserByEmail, 
  getProject, 
  getProjectMessages, 
  saveProjectMessage, 
  updateProjectMessage,
  deleteProjectMessages,
  type ToolCall 
} from "@/lib/db/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]/messages - Get all messages for a project
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
    
    const messages = await getProjectMessages(id);
    
    // Transform database format to client format
    const clientMessages = messages.map(msg => ({
      id: msg.message_id,
      type: msg.type,
      content: msg.content,
      timestamp: msg.timestamp,
      toolCalls: msg.tool_calls,
      savedFiles: msg.saved_files,
    }));
    
    return NextResponse.json({ messages: clientMessages });
    
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/messages - Save a new message
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
    const { id: messageId, type, content, timestamp, toolCalls, savedFiles } = body;
    
    if (!messageId || !type || content === undefined || !timestamp) {
      return NextResponse.json(
        { error: "Missing required message fields" },
        { status: 400 }
      );
    }
    
    const message = await saveProjectMessage(id, {
      id: messageId,
      type,
      content,
      timestamp,
      toolCalls: toolCalls as ToolCall[],
      savedFiles,
    });
    
    return NextResponse.json({ success: true, message });
    
  } catch (error) {
    console.error("Error saving message:", error);
    return NextResponse.json(
      { error: "Failed to save message" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[id]/messages - Update an existing message
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
    const { messageId, content, toolCalls, savedFiles } = body;
    
    if (!messageId) {
      return NextResponse.json(
        { error: "Missing messageId" },
        { status: 400 }
      );
    }
    
    await updateProjectMessage(id, messageId, {
      content,
      toolCalls: toolCalls as ToolCall[],
      savedFiles,
    });
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error updating message:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/messages - Delete all messages for a project
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
    
    await deleteProjectMessages(id);
    
    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error("Error deleting messages:", error);
    return NextResponse.json(
      { error: "Failed to delete messages" },
      { status: 500 }
    );
  }
}
