/**
 * Database Functions
 * 
 * Uses Prisma for all database operations.
 * Maintains backwards-compatible function signatures.
 */

import prisma from "./prisma";
import { Prisma } from "@prisma/client";

// ============================================================================
// Type Exports (for backwards compatibility)
// ============================================================================

export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  tier: "free" | "pro" | "enterprise";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface Usage {
  id: string;
  user_id: string;
  month: string;
  ai_requests: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  framework: string | null;
  status: "active" | "archived" | "deleted";
  last_opened_at: string;
  created_at: string;
  updated_at: string;
}

export interface ToolCall {
  id: string;
  name: string;
  status: "pending" | "running" | "complete";
  result?: string;
  input?: Record<string, unknown>;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  message_id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: number;
  tool_calls: ToolCall[];
  saved_files: string[];
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectEnvVar {
  id: string;
  project_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

// Keep Database interface for any code that references it
export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Omit<User, "id" | "created_at" | "updated_at">; Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>; };
      subscriptions: { Row: Subscription; Insert: Omit<Subscription, "id" | "created_at" | "updated_at">; Update: Partial<Omit<Subscription, "id" | "created_at" | "updated_at">>; };
      usage: { Row: Usage; Insert: Omit<Usage, "id" | "created_at" | "updated_at">; Update: Partial<Omit<Usage, "id" | "created_at" | "updated_at">>; };
    };
  };
}

// ============================================================================
// Legacy Supabase Client Functions (now use Prisma)
// ============================================================================

/**
 * @deprecated Use prisma directly instead
 * Kept for backwards compatibility - returns a mock object
 */
export function createBrowserClient() {
  console.warn("createBrowserClient is deprecated - use Prisma directly");
  throw new Error("Browser client not available - use API routes");
}

/**
 * @deprecated Use prisma directly instead
 * Returns prisma instance for backwards compatibility
 */
export function createServerClient() {
  return prisma;
}

// ============================================================================
// Helper to convert Prisma records to legacy format
// ============================================================================

function toUser(record: {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: record.id,
    email: record.email,
    name: record.name,
    image: record.image,
    stripe_customer_id: record.stripeCustomerId,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

function toSubscription(record: {
  id: string;
  userId: string;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: string;
  tier: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}): Subscription {
  return {
    id: record.id,
    user_id: record.userId,
    stripe_subscription_id: record.stripeSubscriptionId,
    stripe_price_id: record.stripePriceId,
    status: record.status as Subscription["status"],
    tier: record.tier as Subscription["tier"],
    current_period_start: record.currentPeriodStart?.toISOString() || null,
    current_period_end: record.currentPeriodEnd?.toISOString() || null,
    cancel_at_period_end: record.cancelAtPeriodEnd ?? false,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

function toProject(record: {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  framework: string | null;
  status: string;
  lastOpenedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  return {
    id: record.id,
    user_id: record.userId,
    name: record.name,
    description: record.description,
    thumbnail: record.thumbnail,
    framework: record.framework,
    status: record.status as Project["status"],
    last_opened_at: record.lastOpenedAt?.toISOString() || record.createdAt.toISOString(),
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

// ============================================================================
// User Functions
// ============================================================================

export async function getOrCreateUser(email: string, name?: string, image?: string): Promise<User> {
  // Try to get existing user
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    return toUser(user);
  }

  // Create new user
  user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      image: image || null,
    },
  });

  // Create free subscription for new user
  try {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        tier: "free",
        status: "active",
      },
    });
  } catch {
    // Ignore subscription creation errors
  }

  return toUser(user);
}

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const subscription = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return subscription ? toSubscription(subscription) : null;
}

export async function updateSubscription(
  userId: string,
  data: Partial<Omit<Subscription, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<void> {
  await prisma.subscription.updateMany({
    where: { userId },
    data: {
      stripeSubscriptionId: data.stripe_subscription_id,
      stripePriceId: data.stripe_price_id,
      status: data.status,
      tier: data.tier,
      currentPeriodStart: data.current_period_start ? new Date(data.current_period_start) : undefined,
      currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : undefined,
      cancelAtPeriodEnd: data.cancel_at_period_end,
    },
  });
}

export async function getMonthlyUsage(userId: string): Promise<Usage | null> {
  const month = new Date().toISOString().slice(0, 7);

  const usage = await prisma.usage.findUnique({
    where: {
      userId_month: { userId, month },
    },
  });

  if (!usage) return null;

  return {
    id: usage.id,
    user_id: usage.userId,
    month: usage.month,
    ai_requests: usage.aiRequests || 0,
    created_at: usage.createdAt.toISOString(),
    updated_at: usage.updatedAt.toISOString(),
  };
}

export async function incrementUsage(userId: string): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);

  await prisma.usage.upsert({
    where: {
      userId_month: { userId, month },
    },
    update: {
      aiRequests: { increment: 1 },
    },
    create: {
      userId,
      month,
      aiRequests: 1,
    },
  });
}

export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  });
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId },
  });

  return user ? toUser(user) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  return user ? toUser(user) : null;
}

// ============================================================================
// Project Functions
// ============================================================================

export async function getUserProjects(userId: string): Promise<Project[]> {
  const projects = await prisma.project.findMany({
    where: {
      userId,
      status: "active",
    },
    orderBy: { lastOpenedAt: "desc" },
  });

  return projects.map(toProject);
}

export async function getProject(projectId: string): Promise<Project | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  return project ? toProject(project) : null;
}

export async function createProject(
  userId: string,
  name: string,
  description?: string,
  framework?: string
): Promise<Project> {
  const project = await prisma.project.create({
    data: {
      userId,
      name,
      description: description || null,
      framework: framework || "react-vite",
      status: "active",
    },
  });

  return toProject(project);
}

export async function updateProject(
  projectId: string,
  data: Partial<Pick<Project, "name" | "description" | "thumbnail" | "status">>
): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data,
  });
}

export async function touchProject(projectId: string): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { lastOpenedAt: new Date() },
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "deleted" },
  });
}

// ============================================================================
// Project Message Functions
// ============================================================================

export async function getProjectMessages(projectId: string): Promise<ProjectMessage[]> {
  const messages = await prisma.projectMessage.findMany({
    where: { projectId },
    orderBy: { timestamp: "asc" },
  });

  return messages.map((m) => ({
    id: m.id,
    project_id: m.projectId,
    message_id: m.messageId,
    type: m.type as "user" | "assistant",
    content: m.content,
    timestamp: Number(m.timestamp),
    tool_calls: (m.toolCalls as unknown as ToolCall[]) || [],
    saved_files: (m.savedFiles as unknown as string[]) || [],
    created_at: m.createdAt.toISOString(),
  }));
}

export async function saveProjectMessage(
  projectId: string,
  message: {
    id: string;
    type: "user" | "assistant";
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
    savedFiles?: string[];
  }
): Promise<ProjectMessage | null> {
  const result = await prisma.projectMessage.upsert({
    where: {
      projectId_messageId: {
        projectId,
        messageId: message.id,
      },
    },
    update: {
      content: message.content,
      toolCalls: (message.toolCalls || []) as unknown as Prisma.InputJsonValue,
      savedFiles: (message.savedFiles || []) as unknown as Prisma.InputJsonValue,
    },
    create: {
      projectId,
      messageId: message.id,
      type: message.type,
      content: message.content,
      timestamp: BigInt(message.timestamp),
      toolCalls: (message.toolCalls || []) as unknown as Prisma.InputJsonValue,
      savedFiles: (message.savedFiles || []) as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    id: result.id,
    project_id: result.projectId,
    message_id: result.messageId,
    type: result.type as "user" | "assistant",
    content: result.content,
    timestamp: Number(result.timestamp),
    tool_calls: (result.toolCalls as unknown as ToolCall[]) || [],
    saved_files: (result.savedFiles as unknown as string[]) || [],
    created_at: result.createdAt.toISOString(),
  };
}

export async function updateProjectMessage(
  projectId: string,
  messageId: string,
  updates: {
    content?: string;
    toolCalls?: ToolCall[];
    savedFiles?: string[];
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (updates.content !== undefined) data.content = updates.content;
  if (updates.toolCalls !== undefined) data.toolCalls = updates.toolCalls;
  if (updates.savedFiles !== undefined) data.savedFiles = updates.savedFiles;

  await prisma.projectMessage.updateMany({
    where: {
      projectId,
      messageId,
    },
    data,
  });
}

export async function deleteProjectMessages(projectId: string): Promise<void> {
  await prisma.projectMessage.deleteMany({
    where: { projectId },
  });
}

// ============================================================================
// Project Files Functions
// ============================================================================

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const files = await prisma.projectFile.findMany({
    where: { projectId },
  });

  return files.map((f) => ({
    id: f.id,
    project_id: f.projectId,
    path: f.path,
    content: f.content,
    created_at: f.createdAt.toISOString(),
    updated_at: f.updatedAt.toISOString(),
  }));
}

export async function saveProjectFile(
  projectId: string,
  path: string,
  content: string
): Promise<ProjectFile | null> {
  const result = await prisma.projectFile.upsert({
    where: {
      projectId_path: { projectId, path },
    },
    update: { content },
    create: {
      projectId,
      path,
      content,
    },
  });

  return {
    id: result.id,
    project_id: result.projectId,
    path: result.path,
    content: result.content,
    created_at: result.createdAt.toISOString(),
    updated_at: result.updatedAt.toISOString(),
  };
}

export async function saveProjectFiles(
  projectId: string,
  files: { path: string; content: string }[]
): Promise<boolean> {
  try {
    await prisma.$transaction(
      files.map((f) =>
        prisma.projectFile.upsert({
          where: {
            projectId_path: { projectId, path: f.path },
          },
          update: { content: f.content },
          create: {
            projectId,
            path: f.path,
            content: f.content,
          },
        })
      )
    );
    return true;
  } catch (err) {
    console.error("Error saving files:", err);
    return false;
  }
}

export async function deleteProjectFile(projectId: string, path: string): Promise<void> {
  await prisma.projectFile.deleteMany({
    where: { projectId, path },
  });
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  await prisma.projectFile.deleteMany({
    where: { projectId },
  });
}

// ============================================================================
// Security Audit Types
// ============================================================================

import type {
  SecurityFinding,
  SecurityCategory,
  AuditSummary,
  PartialSecurityScan,
  FullSecurityAudit,
} from "@/lib/security/types";

export interface SecurityAudit {
  id: string;
  project_id: string;
  user_id: string;
  scan_type: "partial" | "full";
  status: "pending" | "complete" | "failed";
  summary: AuditSummary;
  findings: SecurityFinding[];
  categories: SecurityCategory[];
  preview_finding?: {
    category: SecurityCategory;
    severity: string;
    title: string;
  };
  scanned_at: string;
  completed_at?: string;
  created_at: string;
}

export interface SecurityAuditPurchase {
  id: string;
  user_id: string;
  project_id: string;
  audit_id: string;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "refunded" | "failed";
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Security Audit Functions
// ============================================================================

export async function savePartialScan(
  projectId: string,
  userId: string,
  scan: PartialSecurityScan
): Promise<SecurityAudit | null> {
  const result = await prisma.securityAudit.create({
    data: {
      projectId,
      userId,
      scanType: "partial",
      status: "complete",
      summary: scan.summary as object,
      findings: [],
      categories: scan.categories,
      previewFinding: scan.previewFinding ? (scan.previewFinding as object) : Prisma.JsonNull,
      scannedAt: new Date(scan.scannedAt),
      completedAt: new Date(scan.scannedAt),
    },
  });

  return {
    id: result.id,
    project_id: result.projectId,
    user_id: result.userId,
    scan_type: result.scanType as "partial" | "full",
    status: result.status as "pending" | "complete" | "failed",
    summary: result.summary as unknown as AuditSummary,
    findings: (result.findings as unknown as SecurityFinding[]) || [],
    categories: (result.categories as unknown as SecurityCategory[]) || [],
    preview_finding: result.previewFinding as SecurityAudit["preview_finding"],
    scanned_at: result.scannedAt.toISOString(),
    completed_at: result.completedAt?.toISOString(),
    created_at: result.createdAt.toISOString(),
  };
}

export async function saveFullAudit(
  userId: string,
  audit: FullSecurityAudit
): Promise<SecurityAudit | null> {
  const result = await prisma.securityAudit.create({
    data: {
      projectId: audit.projectId,
      userId,
      scanType: "full",
      status: audit.status,
      summary: audit.summary as object,
      findings: audit.findings as object[],
      categories: [...new Set(audit.findings.map((f) => f.category))],
      previewFinding: Prisma.JsonNull,
      scannedAt: new Date(audit.scannedAt),
      completedAt: audit.completedAt ? new Date(audit.completedAt) : null,
    },
  });

  return {
    id: result.id,
    project_id: result.projectId,
    user_id: result.userId,
    scan_type: result.scanType as "partial" | "full",
    status: result.status as "pending" | "complete" | "failed",
    summary: result.summary as unknown as AuditSummary,
    findings: (result.findings as unknown as SecurityFinding[]) || [],
    categories: (result.categories as unknown as SecurityCategory[]) || [],
    preview_finding: undefined,
    scanned_at: result.scannedAt.toISOString(),
    completed_at: result.completedAt?.toISOString(),
    created_at: result.createdAt.toISOString(),
  };
}

export async function getLatestSecurityAudit(
  projectId: string,
  scanType?: "partial" | "full"
): Promise<SecurityAudit | null> {
  const result = await prisma.securityAudit.findFirst({
    where: {
      projectId,
      ...(scanType && { scanType }),
    },
    orderBy: { createdAt: "desc" },
  });

  if (!result) return null;

  return {
    id: result.id,
    project_id: result.projectId,
    user_id: result.userId,
    scan_type: result.scanType as "partial" | "full",
    status: result.status as "pending" | "complete" | "failed",
    summary: result.summary as unknown as AuditSummary,
    findings: (result.findings as unknown as SecurityFinding[]) || [],
    categories: (result.categories as unknown as SecurityCategory[]) || [],
    preview_finding: result.previewFinding as SecurityAudit["preview_finding"],
    scanned_at: result.scannedAt.toISOString(),
    completed_at: result.completedAt?.toISOString(),
    created_at: result.createdAt.toISOString(),
  };
}

export async function getSecurityAudit(auditId: string): Promise<SecurityAudit | null> {
  const result = await prisma.securityAudit.findUnique({
    where: { id: auditId },
  });

  if (!result) return null;

  return {
    id: result.id,
    project_id: result.projectId,
    user_id: result.userId,
    scan_type: result.scanType as "partial" | "full",
    status: result.status as "pending" | "complete" | "failed",
    summary: result.summary as unknown as AuditSummary,
    findings: (result.findings as unknown as SecurityFinding[]) || [],
    categories: (result.categories as unknown as SecurityCategory[]) || [],
    preview_finding: result.previewFinding as SecurityAudit["preview_finding"],
    scanned_at: result.scannedAt.toISOString(),
    completed_at: result.completedAt?.toISOString(),
    created_at: result.createdAt.toISOString(),
  };
}

export async function hasFullAuditPurchase(
  userId: string,
  projectId: string
): Promise<boolean> {
  const count = await prisma.securityAuditPurchase.count({
    where: {
      userId,
      projectId,
      status: "completed",
    },
  });

  return count > 0;
}

export async function createAuditPurchase(
  userId: string,
  projectId: string,
  auditId: string,
  paymentIntentId: string,
  amount: number,
  currency: string = "gbp"
): Promise<SecurityAuditPurchase | null> {
  const result = await prisma.securityAuditPurchase.create({
    data: {
      userId,
      projectId,
      auditId,
      stripePaymentIntentId: paymentIntentId,
      amount,
      currency,
      status: "pending",
    },
  });

  return {
    id: result.id,
    user_id: result.userId,
    project_id: result.projectId,
    audit_id: result.auditId,
    stripe_payment_intent_id: result.stripePaymentIntentId || undefined,
    amount: result.amount,
    currency: result.currency,
    status: result.status as SecurityAuditPurchase["status"],
    created_at: result.createdAt.toISOString(),
    updated_at: result.updatedAt.toISOString(),
  };
}

export async function updateAuditPurchaseStatus(
  paymentIntentId: string,
  status: "completed" | "refunded" | "failed"
): Promise<void> {
  await prisma.securityAuditPurchase.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: { status },
  });
}

export async function getAuditPurchaseByPaymentIntent(
  paymentIntentId: string
): Promise<SecurityAuditPurchase | null> {
  const result = await prisma.securityAuditPurchase.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!result) return null;

  return {
    id: result.id,
    user_id: result.userId,
    project_id: result.projectId,
    audit_id: result.auditId,
    stripe_payment_intent_id: result.stripePaymentIntentId || undefined,
    amount: result.amount,
    currency: result.currency,
    status: result.status as SecurityAuditPurchase["status"],
    created_at: result.createdAt.toISOString(),
    updated_at: result.updatedAt.toISOString(),
  };
}

export async function upgradeToFullAudit(
  auditId: string,
  findings: SecurityFinding[]
): Promise<void> {
  const categories = [...new Set(findings.map((f) => f.category))];

  await prisma.securityAudit.update({
    where: { id: auditId },
    data: {
      scanType: "full",
      findings: findings as object[],
      categories,
      completedAt: new Date(),
    },
  });
}

// ============================================================================
// Project Environment Variables
// ============================================================================

export async function getProjectEnvVars(projectId: string): Promise<ProjectEnvVar[]> {
  // Note: project_env_vars table may not exist yet - handle gracefully
  try {
    const results = await prisma.$queryRaw<Array<{
      id: string;
      project_id: string;
      key: string;
      value: string;
      is_secret: boolean;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT * FROM project_env_vars WHERE project_id = ${projectId} ORDER BY key
    `;

    return results.map((r) => ({
      id: r.id,
      project_id: r.project_id,
      key: r.key,
      value: r.value,
      is_secret: r.is_secret,
      created_at: r.created_at.toISOString(),
      updated_at: r.updated_at.toISOString(),
    }));
  } catch {
    // Table doesn't exist
    return [];
  }
}

export async function updateProjectEnvVars(
  projectId: string,
  envVars: { key: string; value: string; is_secret?: boolean }[]
): Promise<boolean> {
  try {
    // Delete existing
    await prisma.$executeRaw`DELETE FROM project_env_vars WHERE project_id = ${projectId}`;

    // Insert new
    for (const v of envVars) {
      await prisma.$executeRaw`
        INSERT INTO project_env_vars (project_id, key, value, is_secret)
        VALUES (${projectId}, ${v.key}, ${v.value}, ${v.is_secret || false})
      `;
    }

    return true;
  } catch {
    // Table doesn't exist
    return true;
  }
}

export async function setProjectEnvVar(
  projectId: string,
  key: string,
  value: string,
  isSecret: boolean = false
): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      INSERT INTO project_env_vars (project_id, key, value, is_secret)
      VALUES (${projectId}, ${key}, ${value}, ${isSecret})
      ON CONFLICT (project_id, key) DO UPDATE SET value = ${value}, is_secret = ${isSecret}
    `;
    return true;
  } catch {
    return true;
  }
}

export async function deleteProjectEnvVar(projectId: string, key: string): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      DELETE FROM project_env_vars WHERE project_id = ${projectId} AND key = ${key}
    `;
    return true;
  } catch {
    return true;
  }
}
