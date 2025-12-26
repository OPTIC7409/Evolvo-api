/**
 * Supabase Integration API Route
 * 
 * Connect and manage Supabase project integration
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserByEmail, getProject, updateProjectEnvVars, getProjectEnvVars } from "@/lib/db/supabase";

interface SupabaseConfig {
  projectUrl: string;
  anonKey: string;
  serviceRoleKey?: string;
}

/**
 * GET /api/projects/[id]/supabase - Get Supabase connection status
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const { id: projectId } = await params;
    const project = await getProject(projectId);
    
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    // Check if Supabase is configured via env vars
    const envVars = await getProjectEnvVars(projectId);
    const hasSupabase = envVars.some(v => v.key === "NEXT_PUBLIC_SUPABASE_URL");
    
    if (!hasSupabase) {
      return NextResponse.json({ connected: false });
    }
    
    const supabaseUrl = envVars.find(v => v.key === "NEXT_PUBLIC_SUPABASE_URL")?.value || "";
    const hasAnonKey = envVars.some(v => v.key === "NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const hasServiceKey = envVars.some(v => v.key === "SUPABASE_SERVICE_ROLE_KEY");
    
    return NextResponse.json({
      connected: true,
      projectUrl: supabaseUrl,
      hasAnonKey,
      hasServiceKey,
    });
    
  } catch (error) {
    console.error("Error getting Supabase status:", error);
    return NextResponse.json({ error: "Failed to get Supabase status" }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/supabase - Connect Supabase to project
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const { id: projectId } = await params;
    const project = await getProject(projectId);
    
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    const body = await request.json() as SupabaseConfig;
    const { projectUrl, anonKey, serviceRoleKey } = body;
    
    if (!projectUrl || !anonKey) {
      return NextResponse.json(
        { error: "Project URL and Anon Key are required" },
        { status: 400 }
      );
    }
    
    // Validate URL format
    if (!projectUrl.includes("supabase.co") && !projectUrl.includes("localhost")) {
      return NextResponse.json(
        { error: "Invalid Supabase URL format" },
        { status: 400 }
      );
    }
    
    // Validate key format (JWT or new sb_ format)
    const isValidKey = anonKey.startsWith("eyJ") || 
                       anonKey.startsWith("sb_publishable_") || 
                       anonKey.startsWith("sb_secret_");
    if (!isValidKey) {
      return NextResponse.json(
        { error: "Invalid key format. Use the Publishable Key from Supabase." },
        { status: 400 }
      );
    }
    
    // Get existing env vars
    const existingEnvVars = await getProjectEnvVars(projectId);
    
    // Build new env vars list
    const supabaseEnvVars = [
      { key: "NEXT_PUBLIC_SUPABASE_URL", value: projectUrl, is_secret: false },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: anonKey, is_secret: false },
    ];
    
    if (serviceRoleKey) {
      supabaseEnvVars.push({ key: "SUPABASE_SERVICE_ROLE_KEY", value: serviceRoleKey, is_secret: true });
    }
    
    // Merge with existing, replacing Supabase ones
    const supabaseKeys = supabaseEnvVars.map(v => v.key);
    const filteredExisting = existingEnvVars.filter(v => !supabaseKeys.includes(v.key));
    const mergedEnvVars = [...filteredExisting, ...supabaseEnvVars];
    
    // Update project env vars
    await updateProjectEnvVars(projectId, mergedEnvVars);
    
    return NextResponse.json({
      success: true,
      message: "Supabase connected successfully",
      envVars: supabaseEnvVars.map(v => ({ key: v.key, isSecret: v.is_secret })),
    });
    
  } catch (error) {
    console.error("Error connecting Supabase:", error);
    return NextResponse.json({ error: "Failed to connect Supabase" }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/supabase - Disconnect Supabase from project
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    const { id: projectId } = await params;
    const project = await getProject(projectId);
    
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    
    // Get existing env vars and remove Supabase ones
    const existingEnvVars = await getProjectEnvVars(projectId);
    const supabaseKeys = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ];
    
    const filteredEnvVars = existingEnvVars.filter(v => !supabaseKeys.includes(v.key));
    await updateProjectEnvVars(projectId, filteredEnvVars);
    
    return NextResponse.json({
      success: true,
      message: "Supabase disconnected",
    });
    
  } catch (error) {
    console.error("Error disconnecting Supabase:", error);
    return NextResponse.json({ error: "Failed to disconnect Supabase" }, { status: 500 });
  }
}
