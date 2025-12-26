/**
 * Supabase Client
 * 
 * Provides client and server-side Supabase instances.
 */

import { createClient } from "@supabase/supabase-js";

// Database types
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

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Subscription, "id" | "created_at" | "updated_at">>;
      };
      usage: {
        Row: Usage;
        Insert: Omit<Usage, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Usage, "id" | "created_at" | "updated_at">>;
      };
    };
  };
}

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_PUBLIC_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!supabaseUrl) {
  console.warn("Missing SUPABASE_URL environment variable");
}

/**
 * Client-side Supabase client (uses anon key)
 * Use this in React components
 */
export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

/**
 * Server-side Supabase client with service role (bypasses RLS)
 * Use this in API routes and server actions
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables for server");
  }
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Get or create a user in the database
 */
export async function getOrCreateUser(email: string, name?: string, image?: string): Promise<User> {
  const supabase = createServerClient();
  
  // Try to get existing user (use maybeSingle to handle no rows gracefully)
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
    
  // If we got a user, return it
  if (existingUser) {
    return existingUser;
  }
  
  // Check if table exists (fetchError will have specific message if not)
  if (fetchError && (
    fetchError.message.includes("schema cache") ||
    fetchError.message.includes("does not exist") ||
    fetchError.message.includes("relation")
  )) {
    throw new Error(`Database tables not created: ${fetchError.message}`);
  }
  
  // Create new user
  const { data: newUser, error } = await supabase
    .from("users")
    .insert({
      email,
      name: name || null,
      image: image || null,
      stripe_customer_id: null,
    })
    .select()
    .single();
    
  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }
  
  // Create free subscription for new user
  try {
    await supabase.from("subscriptions").insert({
      user_id: newUser.id,
      tier: "free",
      status: "active",
    });
  } catch {
    // Ignore subscription creation errors
  }
  
  return newUser;
}

/**
 * Get user's current subscription
 */
export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const supabase = createServerClient();
  
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
    
  return data;
}

/**
 * Update user's subscription
 */
export async function updateSubscription(
  userId: string,
  data: Partial<Omit<Subscription, "id" | "user_id" | "created_at" | "updated_at">>
): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("subscriptions")
    .update(data)
    .eq("user_id", userId);
    
  if (error) {
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
}

/**
 * Get user's usage for current month
 */
export async function getMonthlyUsage(userId: string): Promise<Usage | null> {
  const supabase = createServerClient();
  const month = new Date().toISOString().slice(0, 7); // "2024-12"
  
  const { data } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();
    
  return data;
}

/**
 * Increment AI request count for user
 */
export async function incrementUsage(userId: string): Promise<void> {
  const supabase = createServerClient();
  const month = new Date().toISOString().slice(0, 7);
  
  // Try to increment existing record
  const { data: existing } = await supabase
    .from("usage")
    .select("*")
    .eq("user_id", userId)
    .eq("month", month)
    .maybeSingle();
    
  if (existing) {
    await supabase
      .from("usage")
      .update({ ai_requests: existing.ai_requests + 1 })
      .eq("id", existing.id);
  } else {
    // Create new usage record
    await supabase.from("usage").insert({
      user_id: userId,
      month,
      ai_requests: 1,
    });
  }
}

/**
 * Update user's Stripe customer ID
 */
export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("users")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", userId);
    
  if (error) {
    throw new Error(`Failed to update Stripe customer ID: ${error.message}`);
  }
}

/**
 * Get user by Stripe customer ID
 */
export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
  const supabase = createServerClient();
  
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
    
  return data;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = createServerClient();
  
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();
    
  return data;
}

// ========================================
// PROJECT FUNCTIONS
// ========================================

/**
 * Get all projects for a user
 */
export async function getUserProjects(userId: string): Promise<Project[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_opened_at", { ascending: false });
    
  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Get a single project by ID
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const supabase = createServerClient();
  
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
    
  return data;
}

/**
 * Create a new project
 */
export async function createProject(
  userId: string,
  name: string,
  description?: string,
  framework?: string
): Promise<Project> {
  const supabase = createServerClient();
  
  // Try to create with framework column first
  let { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name,
      description: description || null,
      framework: framework || "react-vite",
      status: "active",
    })
    .select()
    .single();
  
  // If framework column doesn't exist, retry without it
  if (error && error.message.includes("framework")) {
    console.warn("Framework column not found, creating project without it. Run migration to add the column.");
    const result = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name,
        description: description || null,
        status: "active",
      })
      .select()
      .single();
    data = result.data;
    error = result.error;
  }
    
  if (error) {
    throw new Error(`Failed to create project: ${error.message}`);
  }
  
  return data;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  data: Partial<Pick<Project, "name" | "description" | "thumbnail" | "status">>
): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("projects")
    .update(data)
    .eq("id", projectId);
    
  if (error) {
    throw new Error(`Failed to update project: ${error.message}`);
  }
}

/**
 * Update project's last opened timestamp
 */
export async function touchProject(projectId: string): Promise<void> {
  const supabase = createServerClient();
  
  await supabase
    .from("projects")
    .update({ last_opened_at: new Date().toISOString() })
    .eq("id", projectId);
}

/**
 * Delete (archive) a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("projects")
    .update({ status: "deleted" })
    .eq("id", projectId);
    
  if (error) {
    throw new Error(`Failed to delete project: ${error.message}`);
  }
}

// ========================================
// PROJECT MESSAGE FUNCTIONS
// ========================================

/**
 * Get all messages for a project
 */
export async function getProjectMessages(projectId: string): Promise<ProjectMessage[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("project_messages")
    .select("*")
    .eq("project_id", projectId)
    .order("timestamp", { ascending: true });
    
  if (error) {
    // Table might not exist yet, return empty array
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("project_messages table does not exist. Run the migration to create it.");
      return [];
    }
    console.error("Error fetching messages:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Save a message to a project
 */
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
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("project_messages")
    .upsert({
      project_id: projectId,
      message_id: message.id,
      type: message.type,
      content: message.content,
      timestamp: message.timestamp,
      tool_calls: message.toolCalls || [],
      saved_files: message.savedFiles || [],
    }, {
      onConflict: "project_id,message_id"
    })
    .select()
    .single();
    
  if (error) {
    // Table might not exist yet
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("project_messages table does not exist. Run the migration to create it.");
      return null;
    }
    console.error("Error saving message:", error);
    return null;
  }
  
  return data;
}

/**
 * Update a message (for streaming updates)
 */
export async function updateProjectMessage(
  projectId: string,
  messageId: string,
  updates: {
    content?: string;
    toolCalls?: ToolCall[];
    savedFiles?: string[];
  }
): Promise<void> {
  const supabase = createServerClient();
  
  const updateData: Record<string, unknown> = {};
  if (updates.content !== undefined) updateData.content = updates.content;
  if (updates.toolCalls !== undefined) updateData.tool_calls = updates.toolCalls;
  if (updates.savedFiles !== undefined) updateData.saved_files = updates.savedFiles;
  
  const { error } = await supabase
    .from("project_messages")
    .update(updateData)
    .eq("project_id", projectId)
    .eq("message_id", messageId);
    
  if (error) {
    // Table might not exist yet, silently fail
    if (!error.message.includes("does not exist") && !error.message.includes("relation")) {
      console.error("Error updating message:", error);
    }
  }
}

/**
 * Delete all messages for a project
 */
export async function deleteProjectMessages(projectId: string): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("project_messages")
    .delete()
    .eq("project_id", projectId);
    
  if (error) {
    // Table might not exist yet, silently fail
    if (!error.message.includes("does not exist") && !error.message.includes("relation")) {
      console.error("Error deleting messages:", error);
    }
  }
}

// ============================================================================
// Project Files (Code Persistence)
// ============================================================================

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get all files for a project
 */
export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId);
    
  if (error) {
    // Table might not exist yet, return empty array
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("project_files table does not exist. Run the migration to create it.");
      return [];
    }
    console.error("Error fetching files:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Save or update a file in a project
 */
export async function saveProjectFile(
  projectId: string,
  path: string,
  content: string
): Promise<ProjectFile | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("project_files")
    .upsert(
      {
        project_id: projectId,
        path,
        content,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "project_id,path",
      }
    )
    .select()
    .single();
    
  if (error) {
    // Table might not exist yet
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("project_files table does not exist. Run the migration to create it.");
      return null;
    }
    console.error("Error saving file:", error);
    return null;
  }
  
  return data;
}

/**
 * Save multiple files at once (batch upsert)
 */
export async function saveProjectFiles(
  projectId: string,
  files: { path: string; content: string }[]
): Promise<boolean> {
  const supabase = createServerClient();
  
  const records = files.map(f => ({
    project_id: projectId,
    path: f.path,
    content: f.content,
    updated_at: new Date().toISOString(),
  }));
  
  const { error } = await supabase
    .from("project_files")
    .upsert(records, { onConflict: "project_id,path" });
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("project_files table does not exist. Run the migration to create it.");
      return false;
    }
    console.error("Error saving files:", error);
    return false;
  }
  
  return true;
}

/**
 * Delete a file from a project
 */
export async function deleteProjectFile(projectId: string, path: string): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId)
    .eq("path", path);
    
  if (error) {
    if (!error.message.includes("does not exist") && !error.message.includes("relation")) {
      console.error("Error deleting file:", error);
    }
  }
}

/**
 * Delete all files for a project
 */
export async function deleteProjectFiles(projectId: string): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("project_id", projectId);
    
  if (error) {
    if (!error.message.includes("does not exist") && !error.message.includes("relation")) {
      console.error("Error deleting files:", error);
    }
  }
}

// ============================================================================
// Security Audit Functions
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

/**
 * Save a partial security scan result
 */
export async function savePartialScan(
  projectId: string,
  userId: string,
  scan: PartialSecurityScan
): Promise<SecurityAudit | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("security_audits")
    .insert({
      project_id: projectId,
      user_id: userId,
      scan_type: "partial",
      status: "complete",
      summary: scan.summary,
      findings: [], // Empty for partial scans
      categories: scan.categories,
      preview_finding: scan.previewFinding || null,
      scanned_at: scan.scannedAt,
      completed_at: scan.scannedAt,
    })
    .select()
    .single();
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("security_audits table does not exist. Run the migration to create it.");
      return null;
    }
    console.error("Error saving partial scan:", error);
    return null;
  }
  
  return data;
}

/**
 * Save a full security audit result
 */
export async function saveFullAudit(
  userId: string,
  audit: FullSecurityAudit
): Promise<SecurityAudit | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("security_audits")
    .insert({
      project_id: audit.projectId,
      user_id: userId,
      scan_type: "full",
      status: audit.status,
      summary: audit.summary,
      findings: audit.findings,
      categories: [...new Set(audit.findings.map(f => f.category))],
      preview_finding: null,
      scanned_at: audit.scannedAt,
      completed_at: audit.completedAt,
    })
    .select()
    .single();
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("security_audits table does not exist. Run the migration to create it.");
      return null;
    }
    console.error("Error saving full audit:", error);
    return null;
  }
  
  return data;
}

/**
 * Get the latest security audit for a project
 */
export async function getLatestSecurityAudit(
  projectId: string,
  scanType?: "partial" | "full"
): Promise<SecurityAudit | null> {
  const supabase = createServerClient();
  
  let query = supabase
    .from("security_audits")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);
    
  if (scanType) {
    query = query.eq("scan_type", scanType);
  }
  
  const { data, error } = await query.maybeSingle();
  
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return null;
    }
    console.error("Error fetching security audit:", error);
    return null;
  }
  
  return data;
}

/**
 * Get a security audit by ID
 */
export async function getSecurityAudit(auditId: string): Promise<SecurityAudit | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("security_audits")
    .select("*")
    .eq("id", auditId)
    .maybeSingle();
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return null;
    }
    console.error("Error fetching security audit:", error);
    return null;
  }
  
  return data;
}

/**
 * Check if user has purchased a full audit for a project
 */
export async function hasFullAuditPurchase(
  userId: string,
  projectId: string
): Promise<boolean> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("security_audit_purchases")
    .select("id")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return false;
    }
    console.error("Error checking audit purchase:", error);
    return false;
  }
  
  return !!data;
}

/**
 * Create a pending audit purchase record
 */
export async function createAuditPurchase(
  userId: string,
  projectId: string,
  auditId: string,
  paymentIntentId: string,
  amount: number,
  currency: string = "gbp"
): Promise<SecurityAuditPurchase | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("security_audit_purchases")
    .insert({
      user_id: userId,
      project_id: projectId,
      audit_id: auditId,
      stripe_payment_intent_id: paymentIntentId,
      amount,
      currency,
      status: "pending",
    })
    .select()
    .single();
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      console.warn("security_audit_purchases table does not exist.");
      return null;
    }
    console.error("Error creating audit purchase:", error);
    return null;
  }
  
  return data;
}

/**
 * Update audit purchase status
 */
export async function updateAuditPurchaseStatus(
  paymentIntentId: string,
  status: "completed" | "refunded" | "failed"
): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("security_audit_purchases")
    .update({ status })
    .eq("stripe_payment_intent_id", paymentIntentId);
    
  if (error) {
    if (!error.message.includes("does not exist") && !error.message.includes("relation")) {
      console.error("Error updating audit purchase:", error);
    }
  }
}

/**
 * Get audit purchase by payment intent ID
 */
export async function getAuditPurchaseByPaymentIntent(
  paymentIntentId: string
): Promise<SecurityAuditPurchase | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("security_audit_purchases")
    .select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return null;
    }
    console.error("Error fetching audit purchase:", error);
    return null;
  }
  
  return data;
}

/**
 * Update a partial scan to full audit after payment
 */
export async function upgradeToFullAudit(
  auditId: string,
  findings: SecurityFinding[]
): Promise<void> {
  const supabase = createServerClient();
  
  const categories = [...new Set(findings.map(f => f.category))];
  
  const { error } = await supabase
    .from("security_audits")
    .update({
      scan_type: "full",
      findings,
      categories,
      completed_at: new Date().toISOString(),
    })
    .eq("id", auditId);
    
  if (error) {
    if (!error.message.includes("does not exist") && !error.message.includes("relation")) {
      console.error("Error upgrading audit:", error);
    }
  }
}

// ========================================
// PROJECT ENVIRONMENT VARIABLES
// ========================================

export interface ProjectEnvVar {
  id: string;
  project_id: string;
  key: string;
  value: string;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get all environment variables for a project
 */
export async function getProjectEnvVars(projectId: string): Promise<ProjectEnvVar[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from("project_env_vars")
    .select("*")
    .eq("project_id", projectId)
    .order("key");
    
  if (error) {
    // Table might not exist yet
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return [];
    }
    console.error("Error fetching project env vars:", error);
    return [];
  }
  
  return data || [];
}

/**
 * Update environment variables for a project (replaces all existing)
 */
export async function updateProjectEnvVars(
  projectId: string,
  envVars: { key: string; value: string; is_secret?: boolean }[]
): Promise<boolean> {
  const supabase = createServerClient();
  
  try {
    // Delete existing env vars for this project
    await supabase
      .from("project_env_vars")
      .delete()
      .eq("project_id", projectId);
    
    // Insert new env vars
    if (envVars.length > 0) {
      const { error } = await supabase
        .from("project_env_vars")
        .insert(
          envVars.map(v => ({
            project_id: projectId,
            key: v.key,
            value: v.value,
            is_secret: v.is_secret || false,
          }))
        );
        
      if (error) {
        // Table might not exist yet
        if (error.message.includes("does not exist") || error.message.includes("relation")) {
          console.warn("project_env_vars table does not exist, skipping update");
          return true;
        }
        console.error("Error updating project env vars:", error);
        return false;
      }
    }
    
    return true;
  } catch (err) {
    console.error("Error updating project env vars:", err);
    return false;
  }
}

/**
 * Set a single environment variable for a project
 */
export async function setProjectEnvVar(
  projectId: string,
  key: string,
  value: string,
  isSecret: boolean = false
): Promise<boolean> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("project_env_vars")
    .upsert({
      project_id: projectId,
      key,
      value,
      is_secret: isSecret,
    }, {
      onConflict: "project_id,key",
    });
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return true;
    }
    console.error("Error setting project env var:", error);
    return false;
  }
  
  return true;
}

/**
 * Delete an environment variable from a project
 */
export async function deleteProjectEnvVar(projectId: string, key: string): Promise<boolean> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .from("project_env_vars")
    .delete()
    .eq("project_id", projectId)
    .eq("key", key);
    
  if (error) {
    if (error.message.includes("does not exist") || error.message.includes("relation")) {
      return true;
    }
    console.error("Error deleting project env var:", error);
    return false;
  }
  
  return true;
}
