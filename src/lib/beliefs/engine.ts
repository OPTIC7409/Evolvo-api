/**
 * Belief Engine
 * 
 * Core logic for managing beliefs: create, reinforce, contradict, deprecate, delete.
 * Implements confidence decay rules and status transitions.
 */

import { 
  Belief, 
  BeliefEvent, 
  BeliefScope, 
  BeliefStatus,
  BeliefStore 
} from "./types";
import { loadStore, saveStore } from "./storage";

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Confidence adjustment constants
const REINFORCE_DELTA = 0.05;
const CONTRADICT_DELTA = -0.15;
const MAX_CONFIDENCE = 0.99;
const MIN_CONFIDENCE = 0.01;
const UNSTABLE_THRESHOLD = 0.4;
const DEPRECATED_THRESHOLD = 0.2;
const MAX_CONTRADICTIONS_BEFORE_DEPRECATE = 3;

/**
 * Determine belief status based on confidence and contradictions
 */
function computeStatus(confidence: number, contradictionCount: number): BeliefStatus {
  if (confidence < DEPRECATED_THRESHOLD || contradictionCount >= MAX_CONTRADICTIONS_BEFORE_DEPRECATE) {
    return "deprecated";
  }
  if (confidence < UNSTABLE_THRESHOLD) {
    return "unstable";
  }
  return "active";
}

/**
 * Clamp confidence to valid range
 */
function clampConfidence(value: number): number {
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, value));
}

/**
 * Create a belief event
 */
function createEvent(
  type: BeliefEvent["type"],
  beliefId: string,
  beliefText?: string,
  deltaConfidence?: number,
  note?: string
): BeliefEvent {
  return {
    id: generateId(),
    type,
    beliefId,
    beliefText,
    at: Date.now(),
    deltaConfidence,
    note,
  };
}

/**
 * List all beliefs
 */
export function listBeliefs(): Belief[] {
  const store = loadStore();
  return store.beliefs;
}

/**
 * Get beliefs filtered by scope and/or status
 */
export function getBeliefs(options?: {
  scope?: BeliefScope;
  status?: BeliefStatus;
  minConfidence?: number;
}): Belief[] {
  let beliefs = listBeliefs();

  if (options?.scope) {
    beliefs = beliefs.filter(b => b.scope === options.scope);
  }
  if (options?.status) {
    beliefs = beliefs.filter(b => b.status === options.status);
  }
  if (options?.minConfidence !== undefined) {
    const minConf = options.minConfidence;
    beliefs = beliefs.filter(b => b.confidence >= minConf);
  }

  return beliefs;
}

/**
 * Get a single belief by ID
 */
export function getBelief(id: string): Belief | undefined {
  const store = loadStore();
  return store.beliefs.find(b => b.id === id);
}

/**
 * Get recent events
 */
export function getEvents(limit = 20): BeliefEvent[] {
  const store = loadStore();
  return store.events
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

/**
 * Create or update a belief
 * If a belief with the exact same text exists, reinforces it instead.
 */
export function upsertBelief(
  beliefText: string,
  scope: BeliefScope,
  evidence: string[] = []
): Belief {
  const store = loadStore();
  const now = Date.now();
  
  // Check for existing belief with same text (case-insensitive)
  const existing = store.beliefs.find(
    b => b.belief.toLowerCase().trim() === beliefText.toLowerCase().trim()
  );

  if (existing) {
    // Reinforce existing belief
    return reinforceBelief(existing.id, evidence[0] || "Re-stated by user");
  }

  // Create new belief
  const newBelief: Belief = {
    id: generateId(),
    belief: beliefText.trim(),
    scope,
    confidence: 0.6, // Start with moderate confidence
    evidence: evidence.filter(e => e.trim()),
    createdAt: now,
    lastReinforced: now,
    status: "active",
    contradictions: [],
  };

  store.beliefs.push(newBelief);
  store.events.push(createEvent("create", newBelief.id, newBelief.belief, undefined, `Created with scope: ${scope}`));
  
  saveStore(store);
  return newBelief;
}

/**
 * Reinforce a belief (increase confidence)
 */
export function reinforceBelief(id: string, evidenceItem?: string): Belief {
  const store = loadStore();
  const belief = store.beliefs.find(b => b.id === id);

  if (!belief) {
    throw new Error(`Belief not found: ${id}`);
  }

  const oldConfidence = belief.confidence;
  belief.confidence = clampConfidence(belief.confidence + REINFORCE_DELTA);
  belief.lastReinforced = Date.now();
  
  if (evidenceItem?.trim()) {
    belief.evidence.push(evidenceItem.trim());
  }

  // Recompute status (reinforcement might restore from unstable)
  belief.status = computeStatus(belief.confidence, belief.contradictions.length);

  store.events.push(createEvent(
    "reinforce",
    belief.id,
    belief.belief,
    belief.confidence - oldConfidence,
    evidenceItem
  ));

  saveStore(store);
  return belief;
}

/**
 * Contradict a belief (decrease confidence)
 */
export function contradictBelief(id: string, reason: string, evidenceItem?: string): Belief {
  const store = loadStore();
  const belief = store.beliefs.find(b => b.id === id);

  if (!belief) {
    throw new Error(`Belief not found: ${id}`);
  }

  const oldConfidence = belief.confidence;
  belief.confidence = clampConfidence(belief.confidence + CONTRADICT_DELTA);
  
  belief.contradictions.push({
    beliefId: id,
    reason: reason.trim(),
    at: Date.now(),
  });

  if (evidenceItem?.trim()) {
    belief.evidence.push(`[CONTRADICTION] ${evidenceItem.trim()}`);
  }

  // Recompute status
  belief.status = computeStatus(belief.confidence, belief.contradictions.length);

  store.events.push(createEvent(
    "contradict",
    belief.id,
    belief.belief,
    belief.confidence - oldConfidence,
    reason
  ));

  saveStore(store);
  return belief;
}

/**
 * Deprecate a belief manually
 */
export function deprecateBelief(id: string, reason?: string): Belief {
  const store = loadStore();
  const belief = store.beliefs.find(b => b.id === id);

  if (!belief) {
    throw new Error(`Belief not found: ${id}`);
  }

  belief.status = "deprecated";
  belief.confidence = MIN_CONFIDENCE;

  store.events.push(createEvent(
    "deprecate",
    belief.id,
    belief.belief,
    undefined,
    reason || "Manually deprecated"
  ));

  saveStore(store);
  return belief;
}

/**
 * Delete a belief permanently
 */
export function deleteBelief(id: string): void {
  const store = loadStore();
  const belief = store.beliefs.find(b => b.id === id);

  if (!belief) {
    throw new Error(`Belief not found: ${id}`);
  }

  store.events.push(createEvent(
    "delete",
    belief.id,
    belief.belief,
    undefined,
    "Permanently deleted"
  ));

  store.beliefs = store.beliefs.filter(b => b.id !== id);
  saveStore(store);
}

/**
 * Get top N beliefs by confidence for a given context
 * Used for generating belief context summaries
 */
export function getTopBeliefs(n: number = 5, scopes?: BeliefScope[]): Belief[] {
  let beliefs = listBeliefs().filter(b => b.status !== "deprecated");
  
  if (scopes && scopes.length > 0) {
    beliefs = beliefs.filter(b => scopes.includes(b.scope));
  }

  return beliefs
    .sort((a, b) => {
      // Sort by confidence, then by lastReinforced
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return b.lastReinforced - a.lastReinforced;
    })
    .slice(0, n);
}

/**
 * Get unstable beliefs that might need attention
 */
export function getUnstableBeliefs(): Belief[] {
  return listBeliefs().filter(b => b.status === "unstable");
}

/**
 * Generate a belief context summary for prompts
 * Returns a string summarising top beliefs (max ~800 chars)
 */
export function generateBeliefContextSummary(scopes?: BeliefScope[]): string {
  const topBeliefs = getTopBeliefs(5, scopes);
  const unstableBeliefs = getUnstableBeliefs()
    .filter(b => !scopes || scopes.includes(b.scope))
    .slice(0, 2);

  if (topBeliefs.length === 0 && unstableBeliefs.length === 0) {
    return "";
  }

  const lines: string[] = [];
  
  if (topBeliefs.length > 0) {
    lines.push("## Active Beliefs:");
    topBeliefs.forEach(b => {
      lines.push(`- [${Math.round(b.confidence * 100)}%] ${b.belief}`);
    });
  }

  if (unstableBeliefs.length > 0) {
    lines.push("\n## Unstable (needs validation):");
    unstableBeliefs.forEach(b => {
      lines.push(`- [${Math.round(b.confidence * 100)}%] ${b.belief}`);
    });
  }

  const summary = lines.join("\n");
  
  // Truncate if too long
  if (summary.length > 800) {
    return summary.substring(0, 797) + "...";
  }
  
  return summary;
}

/**
 * Search beliefs by text
 */
export function searchBeliefs(query: string): Belief[] {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) {
    return listBeliefs();
  }

  return listBeliefs().filter(b => 
    b.belief.toLowerCase().includes(lowerQuery) ||
    b.evidence.some(e => e.toLowerCase().includes(lowerQuery))
  );
}

