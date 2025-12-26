/**
 * Belief Memory System Types
 * 
 * Core data model for Evolvo's belief-driven memory system.
 * Beliefs have confidence levels, evidence, and can be revised/contradicted over time.
 */

export type BeliefScope = 
  | "architecture" 
  | "ux" 
  | "product" 
  | "dev-habits" 
  | "cost" 
  | "general";

export type BeliefStatus = "active" | "unstable" | "deprecated";

export interface Contradiction {
  beliefId: string;
  reason: string;
  at: number; // timestamp
}

export interface Belief {
  id: string;
  belief: string;
  scope: BeliefScope;
  confidence: number; // 0.0 to 1.0
  evidence: string[];
  createdAt: number; // timestamp
  lastReinforced: number; // timestamp
  status: BeliefStatus;
  contradictions: Contradiction[];
}

export type BeliefEventType = 
  | "create" 
  | "reinforce" 
  | "contradict" 
  | "deprecate" 
  | "delete";

export interface BeliefEvent {
  id: string;
  type: BeliefEventType;
  beliefId: string;
  beliefText?: string; // snapshot of belief text at event time
  at: number; // timestamp
  deltaConfidence?: number;
  note?: string;
}

export interface BeliefStore {
  beliefs: Belief[];
  events: BeliefEvent[];
  version: number;
}

// Initial/default store state
export const createEmptyStore = (): BeliefStore => ({
  beliefs: [],
  events: [],
  version: 1,
});

// Scope metadata for UI
export const BELIEF_SCOPES: { value: BeliefScope; label: string; color: string }[] = [
  { value: "architecture", label: "Architecture", color: "accent-2" },
  { value: "ux", label: "UX", color: "accent" },
  { value: "product", label: "Product", color: "accent-3" },
  { value: "dev-habits", label: "Dev Habits", color: "accent-2" },
  { value: "cost", label: "Cost", color: "accent-3" },
  { value: "general", label: "General", color: "muted" },
];

// Helper to get scope color class
export const getScopeColor = (scope: BeliefScope): string => {
  const found = BELIEF_SCOPES.find(s => s.value === scope);
  return found?.color ?? "muted";
};

