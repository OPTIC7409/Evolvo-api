/**
 * Docker Cloud Services Types
 * 
 * Types for Docker container management and cloud service provisioning.
 */

export type ContainerType = "postgres" | "redis" | "pgvector" | "app";

export type ContainerStatus = 
  | "pending" 
  | "creating" 
  | "running" 
  | "stopped" 
  | "error" 
  | "removing";

export interface ContainerConfig {
  type: ContainerType;
  image: string;
  tag: string;
  port: number;
  internalPort: number;
  env: Record<string, string>;
  volumes?: string[];
  healthCheck?: {
    command: string;
    interval: number;
    timeout: number;
    retries: number;
  };
  resources?: {
    cpuLimit: string;
    memoryLimit: string;
  };
}

export interface Container {
  id: string;
  projectId: string;
  type: ContainerType;
  containerId: string | null; // Docker container ID
  name: string;
  status: ContainerStatus;
  host: string;
  port: number;
  connectionString?: string;
  createdAt: number;
  lastHealthCheck?: number;
  error?: string;
}

export interface ProjectContainers {
  projectId: string;
  userId: string;
  networkId: string | null;
  containers: Container[];
  createdAt: number;
  lastActivity: number;
}

export interface ProvisionRequest {
  projectId: string;
  userId: string;
  services: ContainerType[];
}

export interface ProvisionResult {
  success: boolean;
  projectId: string;
  containers: Container[];
  error?: string;
}

export interface ConnectionStrings {
  postgres?: string;
  redis?: string;
  pgvector?: string;
}

// Default container configurations
export const CONTAINER_CONFIGS: Record<ContainerType, ContainerConfig> = {
  postgres: {
    type: "postgres",
    image: "postgres",
    tag: "16-alpine",
    port: 5432,
    internalPort: 5432,
    env: {
      POSTGRES_USER: "evolvo",
      POSTGRES_PASSWORD: "", // Generated per project
      POSTGRES_DB: "app",
    },
    healthCheck: {
      command: "pg_isready -U evolvo -d app",
      interval: 10,
      timeout: 5,
      retries: 5,
    },
    resources: {
      cpuLimit: "0.5",
      memoryLimit: "512m",
    },
  },
  redis: {
    type: "redis",
    image: "redis",
    tag: "7-alpine",
    port: 6379,
    internalPort: 6379,
    env: {},
    healthCheck: {
      command: "redis-cli ping",
      interval: 10,
      timeout: 5,
      retries: 5,
    },
    resources: {
      cpuLimit: "0.25",
      memoryLimit: "256m",
    },
  },
  pgvector: {
    type: "pgvector",
    image: "pgvector/pgvector",
    tag: "pg16",
    port: 5433,
    internalPort: 5432,
    env: {
      POSTGRES_USER: "evolvo",
      POSTGRES_PASSWORD: "", // Generated per project
      POSTGRES_DB: "vectors",
    },
    healthCheck: {
      command: "pg_isready -U evolvo -d vectors",
      interval: 10,
      timeout: 5,
      retries: 5,
    },
    resources: {
      cpuLimit: "0.5",
      memoryLimit: "512m",
    },
  },
  app: {
    type: "app",
    image: "node",
    tag: "20-alpine",
    port: 3000,
    internalPort: 3000,
    env: {
      NODE_ENV: "development",
    },
    resources: {
      cpuLimit: "1",
      memoryLimit: "1g",
    },
  },
};

// Resource limits per subscription tier
export const TIER_LIMITS: Record<string, {
  maxContainers: number;
  maxProjects: number;
  cpuLimit: string;
  memoryLimit: string;
  inactivityTimeout: number; // hours
}> = {
  free: {
    maxContainers: 0, // No Docker access
    maxProjects: 0,
    cpuLimit: "0",
    memoryLimit: "0",
    inactivityTimeout: 0,
  },
  pro: {
    maxContainers: 3,
    maxProjects: 3,
    cpuLimit: "2",
    memoryLimit: "2g",
    inactivityTimeout: 24,
  },
  team: {
    maxContainers: 5,
    maxProjects: 10,
    cpuLimit: "4",
    memoryLimit: "4g",
    inactivityTimeout: 72,
  },
  enterprise: {
    maxContainers: 10,
    maxProjects: 50,
    cpuLimit: "8",
    memoryLimit: "8g",
    inactivityTimeout: 168, // 1 week
  },
};
