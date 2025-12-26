/**
 * Docker Exec API Route
 * 
 * Execute commands in Docker containers (SQL, Redis commands)
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/db/supabase";
import {
  executeSql,
  executeRedisCommand,
  getProjectContainers,
  updateProjectActivity,
} from "@/lib/docker";

/**
 * POST /api/docker/exec - Execute a command in a container
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
    const { projectId, containerType, command } = body as {
      projectId: string;
      containerType: "postgres" | "pgvector" | "redis";
      command: string;
    };
    
    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }
    
    if (!containerType || !["postgres", "pgvector", "redis"].includes(containerType)) {
      return NextResponse.json(
        { error: "Valid container type is required (postgres, pgvector, redis)" },
        { status: 400 }
      );
    }
    
    if (!command || typeof command !== "string") {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }
    
    // Basic command sanitization (prevent dangerous commands)
    const dangerousPatterns = [
      /DROP\s+DATABASE/i,
      /DROP\s+SCHEMA/i,
      /TRUNCATE/i,
      /DELETE\s+FROM\s+(?!.*WHERE)/i, // DELETE without WHERE
      /FLUSHALL/i,
      /FLUSHDB/i,
      /CONFIG\s+SET/i,
      /SHUTDOWN/i,
      /DEBUG/i,
      /;.*;/s, // Multiple statements
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return NextResponse.json(
          { error: "This command is not allowed for security reasons" },
          { status: 403 }
        );
      }
    }
    
    // Get project containers
    const project = getProjectContainers(projectId);
    
    if (!project) {
      return NextResponse.json(
        { error: "Project has no active containers" },
        { status: 404 }
      );
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
    
    // Execute command based on container type
    let result;
    
    if (containerType === "redis") {
      result = await executeRedisCommand(projectId, command);
    } else {
      result = await executeSql(projectId, command, containerType);
    }
    
    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || "Command execution failed" 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      output: result.output,
    });
    
  } catch (error) {
    console.error("Error executing Docker command:", error);
    return NextResponse.json(
      { error: "Failed to execute command" },
      { status: 500 }
    );
  }
}
