/**
 * Security Scan API
 * 
 * POST /api/security/scan
 * Runs a partial security scan (free) on project files.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runPartialScan, type PartialSecurityScan } from "@/lib/security";
import { getUserByEmail, getProject, savePartialScan } from "@/lib/db/supabase";

export const runtime = "nodejs";

interface ScanRequest {
  projectId: string;
  files: { path: string; content: string }[];
  packageJson?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const body: ScanRequest = await request.json();
    
    if (!body.projectId || !body.files || !Array.isArray(body.files)) {
      return NextResponse.json(
        { error: "Invalid request: projectId and files are required" },
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
    
    // Run the partial security scan
    const scan: PartialSecurityScan = runPartialScan(body.files, body.packageJson);
    
    // Save the scan result to the database
    const savedAudit = await savePartialScan(body.projectId, user.id, scan);
    
    return NextResponse.json({
      success: true,
      scan,
      auditId: savedAudit?.id,
    });
    
  } catch (error) {
    console.error("Security scan error:", error);
    return NextResponse.json(
      { error: "Failed to run security scan" },
      { status: 500 }
    );
  }
}
