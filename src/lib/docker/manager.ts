/**
 * Docker Container Manager
 * 
 * Server-side service for managing Docker containers per project.
 * Handles provisioning, health checks, and cleanup of cloud services.
 */

import { randomBytes } from "crypto";
import {
  Container,
  ContainerType,
  ContainerStatus,
  ProjectContainers,
  ProvisionRequest,
  ProvisionResult,
  ConnectionStrings,
  CONTAINER_CONFIGS,
  TIER_LIMITS,
} from "./types";

// In-memory store for active containers (in production, use Redis or database)
const activeProjects = new Map<string, ProjectContainers>();

// Port allocation tracking
let nextPort = 10000;
const allocatedPorts = new Set<number>();

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${randomBytes(4).toString("hex")}`;
}

/**
 * Generate a secure password
 */
function generatePassword(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Allocate a unique port for a container
 */
function allocatePort(): number {
  while (allocatedPorts.has(nextPort)) {
    nextPort++;
    if (nextPort > 65000) nextPort = 10000;
  }
  const port = nextPort;
  allocatedPorts.add(port);
  nextPort++;
  return port;
}

/**
 * Release an allocated port
 */
function releasePort(port: number): void {
  allocatedPorts.delete(port);
}

/**
 * Get the Docker host URL (for server-side Docker daemon)
 */
function getDockerHost(): string {
  return process.env.DOCKER_HOST || "unix:///var/run/docker.sock";
}

/**
 * Execute a Docker command via the Docker API
 * In production, this would use dockerode or similar library
 */
async function dockerCommand(
  command: string,
  args: string[]
): Promise<{ success: boolean; output: string; error?: string }> {
  // This is a placeholder for actual Docker API calls
  // In production, use dockerode library:
  // import Docker from 'dockerode';
  // const docker = new Docker({ socketPath: '/var/run/docker.sock' });
  
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);
  
  try {
    const fullCommand = `docker ${command} ${args.join(" ")}`;
    const { stdout, stderr } = await execAsync(fullCommand, {
      timeout: 60000, // 60 second timeout
    });
    
    return {
      success: true,
      output: stdout.trim(),
      error: stderr ? stderr.trim() : undefined,
    };
  } catch (error) {
    const err = error as Error & { stderr?: string };
    return {
      success: false,
      output: "",
      error: err.stderr || err.message,
    };
  }
}

/**
 * Create a Docker network for a project
 */
async function createNetwork(projectId: string): Promise<string | null> {
  const networkName = `evolvo-${projectId}`;
  
  const result = await dockerCommand("network", [
    "create",
    "--driver", "bridge",
    "--label", `evolvo.project=${projectId}`,
    networkName,
  ]);
  
  if (result.success) {
    return result.output; // Network ID
  }
  
  console.error(`Failed to create network for project ${projectId}:`, result.error);
  return null;
}

/**
 * Remove a Docker network
 */
async function removeNetwork(networkName: string): Promise<boolean> {
  const result = await dockerCommand("network", ["rm", networkName]);
  return result.success;
}

/**
 * Create a container for a service
 */
async function createContainer(
  projectId: string,
  type: ContainerType,
  networkName: string,
  password?: string
): Promise<Container> {
  const config = CONTAINER_CONFIGS[type];
  const id = generateId();
  const port = allocatePort();
  const containerName = `evolvo-${projectId}-${type}`;
  const generatedPassword = password || generatePassword();
  
  // Build environment variables
  const envVars = { ...config.env };
  if (type === "postgres" || type === "pgvector") {
    envVars.POSTGRES_PASSWORD = generatedPassword;
  }
  
  const container: Container = {
    id,
    projectId,
    type,
    containerId: null,
    name: containerName,
    status: "creating",
    host: "localhost",
    port,
    createdAt: Date.now(),
  };
  
  // Build Docker run command
  const runArgs = [
    "--name", containerName,
    "--network", networkName,
    "-p", `${port}:${config.internalPort}`,
    "-d",
    "--restart", "unless-stopped",
    "--label", `evolvo.project=${projectId}`,
    "--label", `evolvo.type=${type}`,
  ];
  
  // Add resource limits
  if (config.resources) {
    runArgs.push("--cpus", config.resources.cpuLimit);
    runArgs.push("--memory", config.resources.memoryLimit);
  }
  
  // Add environment variables
  for (const [key, value] of Object.entries(envVars)) {
    runArgs.push("-e", `${key}=${value}`);
  }
  
  // Add health check
  if (config.healthCheck) {
    runArgs.push(
      "--health-cmd", config.healthCheck.command,
      "--health-interval", `${config.healthCheck.interval}s`,
      "--health-timeout", `${config.healthCheck.timeout}s`,
      "--health-retries", `${config.healthCheck.retries}`
    );
  }
  
  // Add image
  runArgs.push(`${config.image}:${config.tag}`);
  
  const result = await dockerCommand("run", runArgs);
  
  if (result.success) {
    container.containerId = result.output;
    container.status = "running";
    
    // Generate connection string
    if (type === "postgres") {
      container.connectionString = `postgresql://evolvo:${generatedPassword}@localhost:${port}/app`;
    } else if (type === "pgvector") {
      container.connectionString = `postgresql://evolvo:${generatedPassword}@localhost:${port}/vectors`;
    } else if (type === "redis") {
      container.connectionString = `redis://localhost:${port}`;
    }
  } else {
    container.status = "error";
    container.error = result.error;
    releasePort(port);
  }
  
  return container;
}

/**
 * Stop and remove a container
 */
async function removeContainer(container: Container): Promise<boolean> {
  if (!container.containerId && !container.name) {
    return true;
  }
  
  const target = container.containerId || container.name;
  
  // Stop the container
  await dockerCommand("stop", [target, "-t", "10"]);
  
  // Remove the container
  const result = await dockerCommand("rm", ["-f", target]);
  
  if (result.success) {
    releasePort(container.port);
  }
  
  return result.success;
}

/**
 * Check container health
 */
async function checkContainerHealth(containerId: string): Promise<ContainerStatus> {
  const result = await dockerCommand("inspect", [
    "--format", "{{.State.Status}}",
    containerId,
  ]);
  
  if (!result.success) {
    return "error";
  }
  
  const status = result.output.toLowerCase();
  
  switch (status) {
    case "running":
      return "running";
    case "exited":
    case "dead":
      return "stopped";
    case "created":
    case "restarting":
      return "creating";
    default:
      return "error";
  }
}

/**
 * Check if Docker is available on the server
 */
export async function isDockerAvailable(): Promise<boolean> {
  const result = await dockerCommand("info", ["--format", "{{.ServerVersion}}"]);
  return result.success && result.output.length > 0;
}

/**
 * Check if user can provision containers based on their subscription
 */
export function canProvision(
  tier: string,
  currentProjectCount: number,
  requestedServices: ContainerType[]
): { allowed: boolean; reason?: string } {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  
  if (limits.maxContainers === 0) {
    return {
      allowed: false,
      reason: "Docker cloud services require a Pro subscription or higher.",
    };
  }
  
  if (currentProjectCount >= limits.maxProjects) {
    return {
      allowed: false,
      reason: `You've reached the maximum of ${limits.maxProjects} Docker projects for your ${tier} plan.`,
    };
  }
  
  if (requestedServices.length > limits.maxContainers) {
    return {
      allowed: false,
      reason: `Your ${tier} plan allows up to ${limits.maxContainers} containers per project.`,
    };
  }
  
  return { allowed: true };
}

/**
 * Check if simulation mode is enabled (for development without Docker)
 */
function isSimulationMode(): boolean {
  return process.env.DOCKER_SIMULATION === "true" || process.env.NODE_ENV === "development";
}

/**
 * Create a simulated container (for development/demo)
 */
function createSimulatedContainer(
  projectId: string,
  type: ContainerType,
  password: string
): Container {
  const config = CONTAINER_CONFIGS[type];
  const id = generateId();
  const port = allocatePort();
  const containerName = `evolvo-${projectId}-${type}`;
  
  const container: Container = {
    id,
    projectId,
    type,
    containerId: `sim-${id}`, // Simulated container ID
    name: containerName,
    status: "running",
    host: "localhost",
    port,
    createdAt: Date.now(),
    lastHealthCheck: Date.now(),
  };
  
  // Generate connection string
  if (type === "postgres") {
    container.connectionString = `postgresql://evolvo:${password}@localhost:${port}/app`;
  } else if (type === "pgvector") {
    container.connectionString = `postgresql://evolvo:${password}@localhost:${port}/vectors`;
  } else if (type === "redis") {
    container.connectionString = `redis://localhost:${port}`;
  }
  
  return container;
}

/**
 * Provision containers for a project
 */
export async function provisionContainers(
  request: ProvisionRequest
): Promise<ProvisionResult> {
  const { projectId, userId, services } = request;
  
  // Check if project already has containers
  if (activeProjects.has(projectId)) {
    return {
      success: false,
      projectId,
      containers: [],
      error: "Project already has active containers. Clean up first.",
    };
  }
  
  // Check if we're in simulation mode (development without Docker)
  const simulationMode = isSimulationMode();
  
  if (!simulationMode) {
    // Check Docker availability only in production
    const dockerAvailable = await isDockerAvailable();
    if (!dockerAvailable) {
      return {
        success: false,
        projectId,
        containers: [],
        error: "Docker is not available on this server.",
      };
    }
  }
  
  const networkName = `evolvo-${projectId}`;
  const containers: Container[] = [];
  const sharedPassword = generatePassword(); // Shared password for DB services
  let networkId: string | null = null;
  
  // In simulation mode, skip Docker network creation
  if (simulationMode) {
    console.log(`[Docker Simulation] Creating simulated containers for project ${projectId}`);
    networkId = `sim-network-${projectId}`;
    
    // Create simulated containers
    for (const serviceType of services) {
      const container = createSimulatedContainer(
        projectId,
        serviceType,
        serviceType === "postgres" || serviceType === "pgvector" ? sharedPassword : ""
      );
      containers.push(container);
      console.log(`[Docker Simulation] Created ${serviceType} container:`, container.connectionString);
    }
  } else {
    // Create real network for project
    networkId = await createNetwork(projectId);
    if (!networkId) {
      return {
        success: false,
        projectId,
        containers: [],
        error: "Failed to create Docker network for project.",
      };
    }
    
    // Provision each requested service
    for (const serviceType of services) {
      const container = await createContainer(
        projectId,
        serviceType,
        networkName,
        serviceType === "postgres" || serviceType === "pgvector" ? sharedPassword : undefined
      );
      containers.push(container);
      
      // If any container fails, clean up and return error
      if (container.status === "error") {
        // Clean up created containers
        for (const c of containers) {
          if (c.status === "running") {
            await removeContainer(c);
          }
        }
        await removeNetwork(networkName);
        
        return {
          success: false,
          projectId,
          containers: [],
          error: `Failed to create ${serviceType} container: ${container.error}`,
        };
      }
    }
  }
  
  // Store project containers
  const projectContainers: ProjectContainers = {
    projectId,
    userId,
    networkId,
    containers,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  
  activeProjects.set(projectId, projectContainers);
  
  return {
    success: true,
    projectId,
    containers,
  };
}

/**
 * Get containers for a project
 */
export function getProjectContainers(projectId: string): ProjectContainers | null {
  return activeProjects.get(projectId) || null;
}

/**
 * Get connection strings for a project
 */
export function getConnectionStrings(projectId: string): ConnectionStrings {
  const project = activeProjects.get(projectId);
  if (!project) {
    return {};
  }
  
  const connections: ConnectionStrings = {};
  
  for (const container of project.containers) {
    if (container.connectionString) {
      if (container.type === "postgres") {
        connections.postgres = container.connectionString;
      } else if (container.type === "redis") {
        connections.redis = container.connectionString;
      } else if (container.type === "pgvector") {
        connections.pgvector = container.connectionString;
      }
    }
  }
  
  return connections;
}

/**
 * Update last activity timestamp for a project
 */
export function updateProjectActivity(projectId: string): void {
  const project = activeProjects.get(projectId);
  if (project) {
    project.lastActivity = Date.now();
  }
}

/**
 * Clean up containers for a project
 */
export async function cleanupProject(projectId: string): Promise<boolean> {
  const project = activeProjects.get(projectId);
  if (!project) {
    return true; // Nothing to clean up
  }
  
  let allCleaned = true;
  
  // Remove all containers
  for (const container of project.containers) {
    const removed = await removeContainer(container);
    if (!removed) {
      allCleaned = false;
    }
  }
  
  // Remove network
  const networkName = `evolvo-${projectId}`;
  await removeNetwork(networkName);
  
  // Remove from active projects
  activeProjects.delete(projectId);
  
  return allCleaned;
}

/**
 * Clean up inactive projects
 */
export async function cleanupInactiveProjects(
  inactivityThresholdHours: number
): Promise<string[]> {
  const now = Date.now();
  const thresholdMs = inactivityThresholdHours * 60 * 60 * 1000;
  const cleanedProjects: string[] = [];
  
  for (const [projectId, project] of activeProjects.entries()) {
    if (now - project.lastActivity > thresholdMs) {
      await cleanupProject(projectId);
      cleanedProjects.push(projectId);
    }
  }
  
  return cleanedProjects;
}

/**
 * Get all active projects for a user
 */
export function getUserProjects(userId: string): ProjectContainers[] {
  const userProjects: ProjectContainers[] = [];
  
  for (const project of activeProjects.values()) {
    if (project.userId === userId) {
      userProjects.push(project);
    }
  }
  
  return userProjects;
}

/**
 * Get container status summary
 */
export async function getContainerStatus(
  projectId: string
): Promise<{ status: ContainerStatus; containers: Container[] } | null> {
  const project = activeProjects.get(projectId);
  if (!project) {
    return null;
  }
  
  // Update container statuses
  for (const container of project.containers) {
    if (container.containerId) {
      container.status = await checkContainerHealth(container.containerId);
      container.lastHealthCheck = Date.now();
    }
  }
  
  // Determine overall status
  const statuses = project.containers.map(c => c.status);
  let overallStatus: ContainerStatus = "running";
  
  if (statuses.includes("error")) {
    overallStatus = "error";
  } else if (statuses.includes("creating") || statuses.includes("pending")) {
    overallStatus = "creating";
  } else if (statuses.every(s => s === "stopped")) {
    overallStatus = "stopped";
  }
  
  return {
    status: overallStatus,
    containers: project.containers,
  };
}

/**
 * Execute SQL in a PostgreSQL container
 */
export async function executeSql(
  projectId: string,
  sql: string,
  containerType: "postgres" | "pgvector" = "postgres"
): Promise<{ success: boolean; output: string; error?: string }> {
  const project = activeProjects.get(projectId);
  if (!project) {
    return { success: false, output: "", error: "Project not found" };
  }
  
  const container = project.containers.find(c => c.type === containerType);
  if (!container || !container.containerId) {
    return { success: false, output: "", error: `${containerType} container not found` };
  }
  
  const dbName = containerType === "pgvector" ? "vectors" : "app";
  
  // Execute SQL via docker exec
  const result = await dockerCommand("exec", [
    container.containerId,
    "psql", "-U", "evolvo", "-d", dbName, "-c", sql,
  ]);
  
  return result;
}

/**
 * Execute Redis command
 */
export async function executeRedisCommand(
  projectId: string,
  command: string
): Promise<{ success: boolean; output: string; error?: string }> {
  const project = activeProjects.get(projectId);
  if (!project) {
    return { success: false, output: "", error: "Project not found" };
  }
  
  const container = project.containers.find(c => c.type === "redis");
  if (!container || !container.containerId) {
    return { success: false, output: "", error: "Redis container not found" };
  }
  
  // Execute Redis command via docker exec
  const result = await dockerCommand("exec", [
    container.containerId,
    "redis-cli", ...command.split(" "),
  ]);
  
  return result;
}
