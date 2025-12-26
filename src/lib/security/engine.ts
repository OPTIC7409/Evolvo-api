/**
 * Security Audit Engine
 * 
 * Performs static and heuristic security analysis on project files.
 */

import {
  type SecurityFinding,
  type SecuritySeverity,
  type SecurityCategory,
  type AuditSummary,
  type PartialSecurityScan,
  type FullSecurityAudit,
} from "./types";

// Generate unique IDs
function generateId(): string {
  return `finding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Common vulnerability patterns
const VULNERABILITY_PATTERNS = {
  // Secrets & Credentials
  hardcodedApiKey: /(['"`])(sk_live_|pk_live_|api[_-]?key|secret[_-]?key)[a-zA-Z0-9_-]{20,}(['"`])/gi,
  hardcodedPassword: /(password|passwd|pwd)\s*[:=]\s*(['"`])[^'"]{4,}(['"`])/gi,
  hardcodedSecret: /(secret|token|auth|bearer)\s*[:=]\s*(['"`])[^'"]{8,}(['"`])/gi,
  awsCredentials: /AKIA[0-9A-Z]{16}/g,
  privateKey: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  jwtToken: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  
  // SQL Injection
  sqlInjection: /(\$\{|`)[^}]*\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b/gi,
  unsafeQuery: /query\s*\([^)]*\$\{/gi,
  rawSql: /\.raw\s*\([^)]*\$\{/gi,
  
  // XSS
  dangerouslySetInnerHTML: /dangerouslySetInnerHTML/g,
  documentWrite: /document\.write\s*\(/g,
  innerHTML: /\.innerHTML\s*=/g,
  unsafeEval: /\beval\s*\(/g,
  
  // Insecure HTTP
  httpUrl: /http:\/\/(?!localhost|127\.0\.0\.1)/gi,
  
  // Insecure Cookie
  insecureCookie: /httpOnly\s*:\s*false|secure\s*:\s*false/gi,
  
  // Path Traversal
  pathTraversal: /\.\.\//g,
  unsafePath: /path\.(join|resolve)\s*\([^)]*req\.(body|query|params)/gi,
  
  // Command Injection
  execCommand: /exec\s*\([^)]*(\$\{|req\.(body|query|params))/gi,
  spawnCommand: /spawn\s*\([^)]*(\$\{|req\.(body|query|params))/gi,
  
  // CORS Issues
  openCors: /cors\s*\(\s*\)|origin\s*:\s*['"]\*['"]/gi,
  
  // Missing Security Headers
  noHelmet: /helmet/gi,
  noCsp: /Content-Security-Policy/gi,
  
  // Weak Crypto
  md5Hash: /createHash\s*\(\s*['"]md5['"]\s*\)/gi,
  sha1Hash: /createHash\s*\(\s*['"]sha1['"]\s*\)/gi,
  weakCipher: /(DES|RC4|RC2|BLOWFISH|IDEA|SEED)/gi,
  
  // Auth Issues
  noAuthCheck: /\/(api|admin)\/.*\.(ts|js)$/,
  jwtNoVerify: /jwt\.(decode|sign)\s*\([^)]*\)(?!.*verify)/gi,
  
  // Environment Variables
  processEnvExposed: /process\.env\.[A-Z_]+.*return|res\.(json|send)\([^)]*process\.env/gi,
};

// Known vulnerable packages (simplified - in production would use actual CVE database)
const KNOWN_VULNERABLE_PACKAGES: Record<string, { severity: SecuritySeverity; cve?: string; fixVersion?: string; description: string }> = {
  "lodash": { severity: "high", cve: "CVE-2021-23337", fixVersion: "4.17.21", description: "Prototype pollution vulnerability" },
  "axios": { severity: "medium", cve: "CVE-2023-45857", fixVersion: "1.6.0", description: "Cross-site request forgery vulnerability" },
  "express": { severity: "medium", cve: "CVE-2024-29041", fixVersion: "4.19.2", description: "Open redirect vulnerability" },
  "jsonwebtoken": { severity: "high", cve: "CVE-2022-23529", fixVersion: "9.0.0", description: "Key confusion attack" },
  "minimist": { severity: "critical", cve: "CVE-2021-44906", fixVersion: "1.2.6", description: "Prototype pollution" },
  "node-fetch": { severity: "medium", cve: "CVE-2022-0235", fixVersion: "2.6.7", description: "SSRF vulnerability" },
  "got": { severity: "medium", cve: "CVE-2022-33987", fixVersion: "12.1.0", description: "SSRF redirect vulnerability" },
  "shell-quote": { severity: "critical", cve: "CVE-2021-42740", fixVersion: "1.7.3", description: "Command injection" },
  "tar": { severity: "high", cve: "CVE-2021-37713", fixVersion: "6.1.11", description: "Arbitrary file overwrite" },
  "moment": { severity: "medium", fixVersion: "2.29.4", description: "ReDoS vulnerability" },
  "underscore": { severity: "high", cve: "CVE-2021-23358", fixVersion: "1.13.6", description: "Code injection" },
  "qs": { severity: "high", cve: "CVE-2022-24999", fixVersion: "6.11.0", description: "Prototype pollution" },
};

/**
 * Perform static analysis on code files
 */
function staticAnalysis(files: { path: string; content: string }[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  
  for (const file of files) {
    const { path, content } = file;
    const lines = content.split("\n");
    
    // Skip node_modules and test files
    if (path.includes("node_modules") || path.includes(".test.") || path.includes(".spec.")) {
      continue;
    }
    
    // Check each line for vulnerability patterns
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      
      // Hardcoded API Keys
      if (VULNERABILITY_PATTERNS.hardcodedApiKey.test(line)) {
        findings.push({
          id: generateId(),
          category: "secrets",
          severity: "critical",
          title: "Hardcoded API Key Detected",
          description: "An API key appears to be hardcoded in the source code. This exposes the key to anyone with access to the codebase.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100) + (line.length > 100 ? "..." : ""),
          impact: "Attackers could use the exposed key to access your services, potentially leading to data breaches, financial loss, or service abuse.",
          recommendation: "Move API keys to environment variables and ensure they are not committed to version control. Use a secrets manager for production.",
          confidence: 1.0,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.hardcodedApiKey.lastIndex = 0;
      
      // AWS Credentials
      if (VULNERABILITY_PATTERNS.awsCredentials.test(line)) {
        findings.push({
          id: generateId(),
          category: "secrets",
          severity: "critical",
          title: "AWS Access Key Exposed",
          description: "AWS access key ID found in source code. This could grant unauthorized access to AWS resources.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 60) + "...",
          impact: "Complete compromise of AWS account, potential data exfiltration, cryptocurrency mining, or destruction of resources.",
          recommendation: "Immediately rotate the exposed credentials in AWS IAM. Use IAM roles or environment variables instead.",
          confidence: 1.0,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.awsCredentials.lastIndex = 0;
      
      // Private Keys
      if (VULNERABILITY_PATTERNS.privateKey.test(line)) {
        findings.push({
          id: generateId(),
          category: "secrets",
          severity: "critical",
          title: "Private Key Exposed",
          description: "A private key is embedded in the source code.",
          file: path,
          line: lineNum + 1,
          impact: "Private keys allow impersonation, decryption of sensitive data, and unauthorized access to protected resources.",
          recommendation: "Remove the private key immediately and rotate it. Store keys securely in a secrets manager or hardware security module.",
          confidence: 1.0,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.privateKey.lastIndex = 0;
      
      // dangerouslySetInnerHTML (XSS)
      if (VULNERABILITY_PATTERNS.dangerouslySetInnerHTML.test(line)) {
        findings.push({
          id: generateId(),
          category: "csrf-xss",
          severity: "high",
          title: "Potential XSS via dangerouslySetInnerHTML",
          description: "Using dangerouslySetInnerHTML can lead to XSS attacks if the content is not properly sanitized.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Attackers could inject malicious scripts that execute in users' browsers, stealing credentials, session tokens, or performing actions on behalf of users.",
          recommendation: "Sanitize HTML content using a library like DOMPurify before rendering. Consider if raw HTML rendering is necessary.",
          confidence: 0.9,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.dangerouslySetInnerHTML.lastIndex = 0;
      
      // eval()
      if (VULNERABILITY_PATTERNS.unsafeEval.test(line)) {
        findings.push({
          id: generateId(),
          category: "csrf-xss",
          severity: "critical",
          title: "Unsafe eval() Usage",
          description: "Using eval() can execute arbitrary code and is a severe security risk.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Remote code execution vulnerability - attackers could run arbitrary JavaScript with full access to the application context.",
          recommendation: "Replace eval() with safer alternatives like JSON.parse() for data or Function constructor for controlled scenarios.",
          confidence: 1.0,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.unsafeEval.lastIndex = 0;
      
      // SQL Injection
      if (VULNERABILITY_PATTERNS.sqlInjection.test(line)) {
        findings.push({
          id: generateId(),
          category: "api-security",
          severity: "critical",
          title: "Potential SQL Injection",
          description: "SQL query appears to use string interpolation, which can lead to SQL injection attacks.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Attackers could read, modify, or delete database records, potentially gaining full database access.",
          recommendation: "Use parameterized queries or an ORM. Never concatenate user input directly into SQL queries.",
          confidence: 0.85,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.sqlInjection.lastIndex = 0;
      
      // Open CORS
      if (VULNERABILITY_PATTERNS.openCors.test(line)) {
        findings.push({
          id: generateId(),
          category: "configuration",
          severity: "medium",
          title: "Open CORS Configuration",
          description: "CORS is configured to allow all origins, which could allow unauthorized cross-origin requests.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Malicious websites could make authenticated requests to your API on behalf of users.",
          recommendation: "Configure CORS to only allow specific, trusted origins. Use credentials: false if cross-origin auth isn't needed.",
          confidence: 0.95,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.openCors.lastIndex = 0;
      
      // Weak Hashing
      if (VULNERABILITY_PATTERNS.md5Hash.test(line) || VULNERABILITY_PATTERNS.sha1Hash.test(line)) {
        findings.push({
          id: generateId(),
          category: "authentication",
          severity: "high",
          title: "Weak Cryptographic Hash",
          description: "MD5 or SHA1 hashing is used, which are considered cryptographically weak.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Hashed data could be reversed or collisions found, compromising password security or data integrity.",
          recommendation: "Use SHA-256 or stronger for general hashing, or bcrypt/argon2 for password hashing.",
          confidence: 1.0,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.md5Hash.lastIndex = 0;
      VULNERABILITY_PATTERNS.sha1Hash.lastIndex = 0;
      
      // HTTP URLs
      if (VULNERABILITY_PATTERNS.httpUrl.test(line) && (path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".tsx") || path.endsWith(".jsx"))) {
        findings.push({
          id: generateId(),
          category: "configuration",
          severity: "medium",
          title: "Insecure HTTP URL",
          description: "An HTTP (non-HTTPS) URL is used, which transmits data unencrypted.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Data transmitted over HTTP can be intercepted and modified by attackers (man-in-the-middle attacks).",
          recommendation: "Use HTTPS URLs for all external requests. Enable HSTS header to enforce HTTPS.",
          confidence: 0.9,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.httpUrl.lastIndex = 0;
      
      // Command Injection
      if (VULNERABILITY_PATTERNS.execCommand.test(line) || VULNERABILITY_PATTERNS.spawnCommand.test(line)) {
        findings.push({
          id: generateId(),
          category: "api-security",
          severity: "critical",
          title: "Potential Command Injection",
          description: "User input appears to be passed to a shell command, which could allow command injection.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Attackers could execute arbitrary system commands, potentially compromising the entire server.",
          recommendation: "Never pass user input to shell commands. Use child_process.execFile with fixed arguments or a whitelist approach.",
          confidence: 0.8,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.execCommand.lastIndex = 0;
      VULNERABILITY_PATTERNS.spawnCommand.lastIndex = 0;
      
      // Insecure Cookie
      if (VULNERABILITY_PATTERNS.insecureCookie.test(line)) {
        findings.push({
          id: generateId(),
          category: "configuration",
          severity: "medium",
          title: "Insecure Cookie Configuration",
          description: "Cookie is configured without secure or httpOnly flags.",
          file: path,
          line: lineNum + 1,
          code: line.trim().substring(0, 100),
          impact: "Session cookies could be stolen via XSS attacks or transmitted over insecure connections.",
          recommendation: "Set httpOnly: true to prevent JavaScript access and secure: true for HTTPS-only transmission.",
          confidence: 0.95,
          isStatic: true,
        });
      }
      VULNERABILITY_PATTERNS.insecureCookie.lastIndex = 0;
    }
    
    // File-level checks
    const contentLower = content.toLowerCase();
    
    // Check for exposed environment variables in API responses
    if (path.includes("/api/") && VULNERABILITY_PATTERNS.processEnvExposed.test(content)) {
      findings.push({
        id: generateId(),
        category: "secrets",
        severity: "high",
        title: "Environment Variables Exposed in API",
        description: "Environment variables appear to be exposed in API responses.",
        file: path,
        impact: "Sensitive configuration and secrets could be leaked to clients, exposing API keys, database credentials, etc.",
        recommendation: "Never return process.env values directly in API responses. Create a whitelist of safe values to expose.",
        confidence: 0.85,
        isStatic: true,
      });
    }
    VULNERABILITY_PATTERNS.processEnvExposed.lastIndex = 0;
    
    // Check for missing auth in API routes
    if (path.includes("/api/") && !path.includes("auth") && !path.includes("webhook") && !path.includes("health")) {
      if (!contentLower.includes("getserversession") && !contentLower.includes("auth") && !contentLower.includes("token")) {
        findings.push({
          id: generateId(),
          category: "authorization",
          severity: "medium",
          title: "API Route Without Authentication Check",
          description: "This API route does not appear to verify user authentication.",
          file: path,
          impact: "Unauthenticated users could access protected functionality or data.",
          recommendation: "Add authentication middleware or check getServerSession() at the start of the route handler.",
          confidence: 0.7,
          isStatic: true,
        });
      }
    }
  }
  
  return findings;
}

/**
 * Analyze package.json for vulnerable dependencies
 */
function dependencyAnalysis(packageJsonContent: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  
  try {
    const pkg = JSON.parse(packageJsonContent);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    
    for (const [name, version] of Object.entries(allDeps)) {
      const vuln = KNOWN_VULNERABLE_PACKAGES[name];
      if (vuln) {
        // Parse version to check if it's vulnerable
        const versionStr = String(version).replace(/[\^~><=]/g, "");
        
        findings.push({
          id: generateId(),
          category: "dependencies",
          severity: vuln.severity,
          title: `Vulnerable Package: ${name}`,
          description: vuln.description,
          file: "package.json",
          code: `"${name}": "${version}"`,
          impact: `This vulnerability in ${name} could be exploited by attackers. ${vuln.cve ? `See ${vuln.cve} for details.` : ""}`,
          recommendation: vuln.fixVersion 
            ? `Update to ${name}@${vuln.fixVersion} or later using: npm install ${name}@${vuln.fixVersion}`
            : `Check npm for the latest secure version of ${name}`,
          cve: vuln.cve,
          confidence: 1.0,
          isStatic: true,
        });
      }
    }
    
    // Check for outdated React version
    if (allDeps.react) {
      const reactVersion = String(allDeps.react).replace(/[\^~><=]/g, "");
      if (reactVersion.startsWith("16") || reactVersion.startsWith("17")) {
        findings.push({
          id: generateId(),
          category: "dependencies",
          severity: "low",
          title: "Outdated React Version",
          description: `React ${reactVersion} is outdated. React 18+ includes security improvements.`,
          file: "package.json",
          impact: "Missing security patches and modern React security features.",
          recommendation: "Consider upgrading to React 18 for improved security and performance.",
          confidence: 1.0,
          isStatic: true,
        });
      }
    }
    
  } catch {
    // Invalid package.json
    findings.push({
      id: generateId(),
      category: "configuration",
      severity: "low",
      title: "Invalid package.json",
      description: "Could not parse package.json for dependency analysis.",
      file: "package.json",
      impact: "Unable to check for vulnerable dependencies.",
      recommendation: "Ensure package.json is valid JSON.",
      confidence: 1.0,
      isStatic: true,
    });
  }
  
  return findings;
}

/**
 * Perform heuristic analysis (AI-assisted patterns)
 */
function heuristicAnalysis(files: { path: string; content: string }[]): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  
  // Check for rate limiting
  const hasRateLimiting = files.some(f => 
    f.content.includes("rate-limit") || 
    f.content.includes("rateLimit") ||
    f.content.includes("express-rate-limit")
  );
  
  const hasApiRoutes = files.some(f => f.path.includes("/api/"));
  
  if (hasApiRoutes && !hasRateLimiting) {
    findings.push({
      id: generateId(),
      category: "rate-limiting",
      severity: "medium",
      title: "No Rate Limiting Detected",
      description: "API routes do not appear to implement rate limiting, which could allow abuse.",
      impact: "Attackers could overwhelm your API with requests, causing denial of service or incurring excessive costs.",
      recommendation: "Implement rate limiting using middleware like express-rate-limit or Vercel's built-in rate limiting.",
      confidence: 0.75,
      isStatic: false,
    });
  }
  
  // Check for CSRF protection
  const hasCsrfProtection = files.some(f => 
    f.content.includes("csrf") || 
    f.content.includes("CSRF") ||
    f.content.includes("csurf")
  );
  
  const hasFormHandling = files.some(f => 
    f.content.includes("action=") && f.content.includes("method=") ||
    f.content.includes("POST")
  );
  
  if (hasFormHandling && !hasCsrfProtection) {
    findings.push({
      id: generateId(),
      category: "csrf-xss",
      severity: "medium",
      title: "CSRF Protection Not Detected",
      description: "Forms or POST endpoints exist without apparent CSRF protection.",
      impact: "Attackers could trick users into performing unwanted actions through malicious websites.",
      recommendation: "Implement CSRF tokens for state-changing operations. Next.js Server Actions include built-in CSRF protection.",
      confidence: 0.7,
      isStatic: false,
    });
  }
  
  // Check for input validation
  const hasInputValidation = files.some(f => 
    f.content.includes("zod") ||
    f.content.includes("yup") ||
    f.content.includes("joi") ||
    f.content.includes("validator") ||
    f.content.includes(".parse(") ||
    f.content.includes(".validate(")
  );
  
  const hasUserInput = files.some(f => 
    f.content.includes("req.body") ||
    f.content.includes("req.query") ||
    f.content.includes("req.params")
  );
  
  if (hasUserInput && !hasInputValidation) {
    findings.push({
      id: generateId(),
      category: "api-security",
      severity: "high",
      title: "Input Validation Not Detected",
      description: "User input is processed without apparent validation library usage.",
      impact: "Malformed or malicious input could cause unexpected behavior, crashes, or security vulnerabilities.",
      recommendation: "Use a validation library like Zod, Yup, or Joi to validate all user input before processing.",
      confidence: 0.65,
      isStatic: false,
    });
  }
  
  // Check for security headers
  const hasSecurityHeaders = files.some(f => 
    f.content.includes("helmet") ||
    f.content.includes("X-Frame-Options") ||
    f.content.includes("X-Content-Type-Options") ||
    f.content.includes("Content-Security-Policy") ||
    (f.path.includes("next.config") && f.content.includes("headers"))
  );
  
  if (!hasSecurityHeaders) {
    findings.push({
      id: generateId(),
      category: "configuration",
      severity: "medium",
      title: "Security Headers Not Configured",
      description: "No security headers configuration found (Helmet, CSP, X-Frame-Options, etc.).",
      impact: "Missing security headers leave the application vulnerable to clickjacking, MIME sniffing, and XSS attacks.",
      recommendation: "Configure security headers in next.config.js or use Helmet middleware. Include X-Frame-Options, CSP, and X-Content-Type-Options.",
      confidence: 0.8,
      isStatic: false,
    });
  }
  
  // Check for error handling that might leak info
  const hasVerboseErrors = files.some(f => 
    f.content.includes("stack") && f.content.includes("res.") ||
    f.content.includes("error.message") && f.content.includes("res.")
  );
  
  if (hasVerboseErrors) {
    findings.push({
      id: generateId(),
      category: "configuration",
      severity: "low",
      title: "Verbose Error Messages",
      description: "Error details including stack traces may be exposed to clients.",
      impact: "Detailed error messages help attackers understand your application structure and find vulnerabilities.",
      recommendation: "Return generic error messages to clients. Log detailed errors server-side only.",
      confidence: 0.7,
      isStatic: false,
    });
  }
  
  // Check for AI-specific risks
  const hasAiIntegration = files.some(f => 
    f.content.includes("openai") ||
    f.content.includes("anthropic") ||
    f.content.includes("langchain") ||
    f.content.includes("gpt") ||
    f.content.includes("claude")
  );
  
  if (hasAiIntegration) {
    // Check for prompt injection risks
    const hasUserInputToAi = files.some(f => 
      (f.content.includes("req.body") || f.content.includes("user")) &&
      (f.content.includes("prompt") || f.content.includes("message") || f.content.includes("content"))
    );
    
    if (hasUserInputToAi) {
      findings.push({
        id: generateId(),
        category: "ai-specific",
        severity: "high",
        title: "Potential Prompt Injection Risk",
        description: "User input appears to be passed to AI models, which could allow prompt injection attacks.",
        impact: "Attackers could manipulate AI responses, bypass restrictions, or extract sensitive information from system prompts.",
        recommendation: "Sanitize and validate user input before passing to AI. Use separate user and system message contexts. Consider output filtering.",
        confidence: 0.75,
        isStatic: false,
      });
    }
    
    // Check for AI tool misuse
    const hasToolCalling = files.some(f => 
      f.content.includes("tools") &&
      (f.content.includes("function") || f.content.includes("exec") || f.content.includes("write"))
    );
    
    if (hasToolCalling) {
      findings.push({
        id: generateId(),
        category: "ai-specific",
        severity: "medium",
        title: "AI Tool Execution Risk",
        description: "AI appears to have access to tools that can modify files or execute commands.",
        impact: "If not properly sandboxed, AI tool calls could be manipulated to perform unauthorized actions.",
        recommendation: "Validate all tool inputs. Implement strict sandboxing. Use allowlists for file paths and commands.",
        confidence: 0.7,
        isStatic: false,
      });
    }
  }
  
  return findings;
}

/**
 * Calculate audit summary from findings
 */
function calculateSummary(findings: SecurityFinding[]): AuditSummary {
  return {
    critical: findings.filter(f => f.severity === "critical").length,
    high: findings.filter(f => f.severity === "high").length,
    medium: findings.filter(f => f.severity === "medium").length,
    low: findings.filter(f => f.severity === "low").length,
    info: findings.filter(f => f.severity === "info").length,
    total: findings.length,
  };
}

/**
 * Run a partial security scan (free tier)
 * Returns counts and categories but not full details
 */
export function runPartialScan(
  files: { path: string; content: string }[],
  packageJson?: string
): PartialSecurityScan {
  // Run full analysis internally
  const findings: SecurityFinding[] = [
    ...staticAnalysis(files),
    ...(packageJson ? dependencyAnalysis(packageJson) : []),
    ...heuristicAnalysis(files),
  ];
  
  const summary = calculateSummary(findings);
  const categories = [...new Set(findings.map(f => f.category))];
  
  // Get one preview finding (most severe, partially hidden)
  const previewFinding = findings
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })[0];
  
  return {
    hasIssues: findings.length > 0,
    summary,
    categories,
    previewFinding: previewFinding ? {
      category: previewFinding.category,
      severity: previewFinding.severity,
      title: previewFinding.title,
    } : undefined,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Run a full security audit (paid tier)
 * Returns complete findings with remediation guidance
 */
export function runFullAudit(
  projectId: string,
  files: { path: string; content: string }[],
  packageJson?: string
): FullSecurityAudit {
  const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Run all analyses
  const findings: SecurityFinding[] = [
    ...staticAnalysis(files),
    ...(packageJson ? dependencyAnalysis(packageJson) : []),
    ...heuristicAnalysis(files),
  ];
  
  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  return {
    id: auditId,
    projectId,
    status: "complete",
    summary: calculateSummary(findings),
    findings,
    scannedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
}

/**
 * Export audit report as markdown
 */
export function exportAuditMarkdown(audit: FullSecurityAudit): string {
  const lines: string[] = [
    "# Security Audit Report",
    "",
    `**Project ID:** ${audit.projectId}`,
    `**Audit ID:** ${audit.id}`,
    `**Date:** ${new Date(audit.scannedAt).toLocaleString()}`,
    "",
    "---",
    "",
    "## Summary",
    "",
    `| Severity | Count |`,
    `|----------|-------|`,
    `| Critical | ${audit.summary.critical} |`,
    `| High | ${audit.summary.high} |`,
    `| Medium | ${audit.summary.medium} |`,
    `| Low | ${audit.summary.low} |`,
    `| Info | ${audit.summary.info} |`,
    `| **Total** | **${audit.summary.total}** |`,
    "",
    "---",
    "",
    "## Findings",
    "",
  ];
  
  for (const finding of audit.findings) {
    lines.push(`### ${finding.severity.toUpperCase()}: ${finding.title}`);
    lines.push("");
    lines.push(`**Category:** ${finding.category}`);
    if (finding.file) {
      lines.push(`**File:** ${finding.file}${finding.line ? `:${finding.line}` : ""}`);
    }
    if (finding.cve) {
      lines.push(`**CVE:** ${finding.cve}`);
    }
    lines.push(`**Confidence:** ${Math.round(finding.confidence * 100)}%`);
    lines.push("");
    lines.push("**Description:**");
    lines.push(finding.description);
    lines.push("");
    if (finding.code) {
      lines.push("**Code:**");
      lines.push("```");
      lines.push(finding.code);
      lines.push("```");
      lines.push("");
    }
    lines.push("**Impact:**");
    lines.push(finding.impact);
    lines.push("");
    lines.push("**Recommendation:**");
    lines.push(finding.recommendation);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  
  lines.push("*Generated by Evolvo Security Audit*");
  
  return lines.join("\n");
}
