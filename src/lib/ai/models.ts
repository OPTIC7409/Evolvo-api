/**
 * AI Models Registry
 * 
 * Defines the available AI models for generation.
 * These correspond to the models shown in the landing page dropdown.
 */

export interface AIModel {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "google";
  contextWindow: number;
  maxOutput: number;
  costPer1kInput: number;  // USD per 1000 input tokens
  costPer1kOutput: number; // USD per 1000 output tokens
  capabilities: string[];
  badge?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: "claude-opus",
    name: "Claude Opus 4.5",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutput: 8192,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    capabilities: ["code", "reasoning", "vision", "long-context"],
    badge: "New",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4",
    provider: "anthropic",
    contextWindow: 200000,
    maxOutput: 8192,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    capabilities: ["code", "reasoning", "vision", "long-context"],
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    contextWindow: 128000,
    maxOutput: 16384,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
    capabilities: ["code", "reasoning", "vision", "function-calling"],
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.0 Pro",
    provider: "google",
    contextWindow: 1000000,
    maxOutput: 8192,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
    capabilities: ["code", "reasoning", "vision", "long-context"],
  },
];

/**
 * Get a model by ID
 */
export function getModel(id: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === id);
}

/**
 * Get the default model
 */
export function getDefaultModel(): AIModel {
  return AI_MODELS[0];
}

/**
 * Estimate cost for a generation
 */
export function estimateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModel(modelId);
  if (!model) return 0;

  return (
    (inputTokens / 1000) * model.costPer1kInput +
    (outputTokens / 1000) * model.costPer1kOutput
  );
}

