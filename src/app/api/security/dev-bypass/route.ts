/**
 * Security Audit Dev Bypass API
 * 
 * POST /api/security/dev-bypass
 * DEVELOPMENT ONLY - Bypasses payment to test full audit.
 * Remove or disable in production!
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runFullAudit } from "@/lib/security";
import {
  getUserByEmail,
  getProject,
  getProjectFiles,
  saveFullAudit,
  createAuditPurchase,
} from "@/lib/db/supabase";

export const runtime = "nodejs";

// Only allow in development
const isDev = process.env.NODE_ENV === "development";

export async function POST(request: Request) {
  // Block in production
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }
  
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const { projectId } = await request.json();
    
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }
    
    // Verify user owns the project
    const user = await getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    const project = await getProject(projectId);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }
    
    // Get files from database
    const projectFiles = await getProjectFiles(projectId);
    const files = projectFiles.map(f => ({ path: f.path, content: f.content }));
    
    // Extract package.json if present
    const pkgFile = files.find(f => f.path === "package.json");
    const packageJson = pkgFile?.content;
    
    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files found to audit" },
        { status: 400 }
      );
    }
    
    // Run the full security audit
    const audit = runFullAudit(projectId, files, packageJson);
    
    // Save the audit result
    await saveFullAudit(user.id, audit);
    
    // Create a fake completed purchase record for dev using helper function
    await createAuditPurchase(
      user.id,
      projectId,
      audit.id,
      `dev_bypass_${Date.now()}`,
      0,
      "gbp"
    );
    
    return NextResponse.json({
      success: true,
      message: "DEV BYPASS: Audit completed without payment",
      audit,
    });
    
  } catch (error) {
    console.error("Dev bypass error:", error);
    return NextResponse.json(
      { error: "Failed to run dev bypass audit" },
      { status: 500 }
    );
  }
}
