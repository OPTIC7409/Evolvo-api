/**
 * Security Audit Types
 * 
 * Types and interfaces for the security audit system.
 */

// Severity levels for security findings
export type SecuritySeverity = "critical" | "high" | "medium" | "low" | "info";

// Categories of security findings
export type SecurityCategory = 
  | "authentication"
  | "authorization"
  | "api-security"
  | "rate-limiting"
  | "csrf-xss"
  | "file-handling"
  | "dependencies"
  | "secrets"
  | "configuration"
  | "ai-specific";

// A single security finding
export interface SecurityFinding {
  id: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  title: string;
  description: string;
  file?: string;
  line?: number;
  code?: string;
  impact: string;
  recommendation: string;
  cve?: string; // For dependency vulnerabilities
  confidence: number; // 0.0 to 1.0 for heuristic findings
  isStatic: boolean; // true for deterministic, false for AI-assisted
}

// Summary of audit results
export interface AuditSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

// Security scan result (partial - free tier)
export interface PartialSecurityScan {
  hasIssues: boolean;
  summary: AuditSummary;
  categories: SecurityCategory[];
  previewFinding?: {
    category: SecurityCategory;
    severity: SecuritySeverity;
    title: string;
    // Description is blurred/hidden
  };
  scannedAt: string;
}

// Full security audit result (paid tier)
export interface FullSecurityAudit {
  id: string;
  projectId: string;
  status: "pending" | "complete" | "failed";
  summary: AuditSummary;
  findings: SecurityFinding[];
  scannedAt: string;
  completedAt?: string;
  exportFormat?: "markdown" | "pdf";
}

// Security audit purchase record
export interface SecurityAuditPurchase {
  id: string;
  userId: string;
  projectId: string;
  auditId: string;
  stripePaymentIntentId: string;
  amount: number; // in pence (1499 for £14.99)
  currency: string;
  status: "pending" | "completed" | "refunded";
  createdAt: string;
}

// Request types for API
export interface ScanProjectRequest {
  projectId: string;
  files: { path: string; content: string }[];
  packageJson?: string;
}

export interface PurchaseAuditRequest {
  projectId: string;
  scanId: string;
}

// Category display information
export const CATEGORY_INFO: Record<SecurityCategory, { label: string; icon: string; description: string }> = {
  "authentication": {
    label: "Authentication",
    icon: "key",
    description: "Issues with user authentication flows, session management, or credential handling"
  },
  "authorization": {
    label: "Authorization",
    icon: "shield",
    description: "Missing or improper access controls, privilege escalation risks"
  },
  "api-security": {
    label: "API Security",
    icon: "server",
    description: "Insecure API routes, missing validation, or improper error handling"
  },
  "rate-limiting": {
    label: "Rate Limiting",
    icon: "clock",
    description: "Missing or insufficient rate limiting, potential for abuse"
  },
  "csrf-xss": {
    label: "CSRF/XSS",
    icon: "bug",
    description: "Cross-site request forgery or cross-site scripting vulnerabilities"
  },
  "file-handling": {
    label: "File Handling",
    icon: "folder",
    description: "Unsafe file uploads, path traversal, or file system access issues"
  },
  "dependencies": {
    label: "Dependencies",
    icon: "cube",
    description: "Vulnerable packages with known CVEs or outdated versions"
  },
  "secrets": {
    label: "Secrets Exposure",
    icon: "eye-off",
    description: "Hardcoded credentials, API keys, or sensitive data exposure"
  },
  "configuration": {
    label: "Configuration",
    icon: "settings",
    description: "Insecure defaults, missing security headers, or weak configurations"
  },
  "ai-specific": {
    label: "AI Risks",
    icon: "brain",
    description: "Prompt injection, unsafe AI tool usage, or AI-to-code flow vulnerabilities"
  }
};

// Severity display information
export const SEVERITY_INFO: Record<SecuritySeverity, { label: string; color: string; bgColor: string; description: string }> = {
  "critical": {
    label: "Critical",
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    description: "Immediate action required - exploitable with severe impact"
  },
  "high": {
    label: "High",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    description: "Should be fixed before deployment - significant security risk"
  },
  "medium": {
    label: "Medium",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
    description: "Should be addressed - moderate security concern"
  },
  "low": {
    label: "Low",
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    description: "Minor issue - best practice recommendation"
  },
  "info": {
    label: "Info",
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
    description: "Informational - security hardening suggestion"
  }
};

// Audit price in pence (£14.99)
export const SECURITY_AUDIT_PRICE = 1499;
export const SECURITY_AUDIT_PRICE_DISPLAY = "£14.99";
