/**
 * Full Security Audit API
 * 
 * POST /api/security/audit
 * Runs a full security audit after payment verification.
 * 
 * GET /api/security/audit?projectId=xxx
 * Get the latest audit for a project (if purchased).
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runFullAudit, exportAuditMarkdown } from "@/lib/security";
import {
  getUserByEmail,
  getProject,
  getProjectFiles,
  saveFullAudit,
  getLatestSecurityAudit,
  hasFullAuditPurchase,
} from "@/lib/db/supabase";

export const runtime = "nodejs";

interface AuditRequest {
  projectId: string;
  files?: { path: string; content: string }[];
  packageJson?: string;
  export?: "markdown";
}

// Run full audit after payment
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const body: AuditRequest = await request.json();
    
    if (!body.projectId) {
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
    
    const project = await getProject(body.projectId);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }
    
    // Check if user has purchased audit for this project
    const hasPurchased = await hasFullAuditPurchase(user.id, body.projectId);
    if (!hasPurchased) {
      return NextResponse.json(
        { error: "Security audit not purchased for this project" },
        { status: 403 }
      );
    }
    
    // Get files - either from request or from database
    let files = body.files;
    let packageJson = body.packageJson;
    
    if (!files || files.length === 0) {
      // Load files from database
      const projectFiles = await getProjectFiles(body.projectId);
      files = projectFiles.map(f => ({ path: f.path, content: f.content }));
      
      // Extract package.json if present
      const pkgFile = files.find(f => f.path === "package.json");
      if (pkgFile) {
        packageJson = pkgFile.content;
      }
    }
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files found to audit" },
        { status: 400 }
      );
    }
    
    // Run the full security audit
    const audit = runFullAudit(body.projectId, files, packageJson);
    
    // Save the audit result
    await saveFullAudit(user.id, audit);
    
    // Export if requested
    if (body.export === "markdown") {
      const markdown = exportAuditMarkdown(audit);
      return NextResponse.json({
        success: true,
        audit,
        markdown,
      });
    }
    
    return NextResponse.json({
      success: true,
      audit,
    });
    
  } catch (error) {
    console.error("Full audit error:", error);
    return NextResponse.json(
      { error: "Failed to run security audit" },
      { status: 500 }
    );
  }
}

// Get existing audit for a project
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    
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
    
    // Check purchase status
    const hasPurchased = await hasFullAuditPurchase(user.id, projectId);
    
    // Get the latest audit
    const latestAudit = await getLatestSecurityAudit(
      projectId,
      hasPurchased ? "full" : "partial"
    );
    
    return NextResponse.json({
      hasPurchased,
      audit: latestAudit,
    });
    
  } catch (error) {
    console.error("Get audit error:", error);
    return NextResponse.json(
      { error: "Failed to get audit" },
      { status: 500 }
    );
  }
}
