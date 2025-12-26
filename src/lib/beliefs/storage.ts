/**
 * Belief Storage Layer
 * 
 * localStorage-based persistence for the belief memory system.
 * Namespaced and versioned for safe migrations.
 */

import { BeliefStore, createEmptyStore } from "./types";

const STORAGE_KEY = "evolvo:beliefs:v1";

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/**
 * Load the belief store from localStorage
 */
export function loadStore(): BeliefStore {
  if (!isBrowser()) {
    return createEmptyStore();
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return createEmptyStore();
  }

  const parsed = safeJsonParse<BeliefStore>(stored, createEmptyStore());
  
  // Validate structure
  if (!Array.isArray(parsed.beliefs) || !Array.isArray(parsed.events)) {
    return createEmptyStore();
  }

  return parsed;
}

/**
 * Save the belief store to localStorage
 */
export function saveStore(store: BeliefStore): void {
  if (!isBrowser()) {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    // Handle quota exceeded or other storage errors
    console.error("[Evolvo] Failed to save beliefs:", error);
  }
}

/**
 * Clear all stored beliefs (for testing/reset)
 */
export function clearStore(): void {
  if (!isBrowser()) {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export store as JSON string (for backup/debug)
 */
export function exportStore(): string {
  const store = loadStore();
  return JSON.stringify(store, null, 2);
}

/**
 * Import store from JSON string (for restore/debug)
 */
export function importStore(json: string): boolean {
  const parsed = safeJsonParse<BeliefStore | null>(json, null);
  if (!parsed || !Array.isArray(parsed.beliefs) || !Array.isArray(parsed.events)) {
    return false;
  }

  saveStore(parsed);
  return true;
}

