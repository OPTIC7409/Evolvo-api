/**
 * Prompt Builder
 * 
 * Constructs structured prompts for AI generation, incorporating:
 * - User's app description
 * - Selected model context
 * - Belief memory summary
 * - Backend toggle state
 */

import { generateBeliefContextSummary, BeliefScope } from "@/lib/beliefs";
import { AIModel, getModel, getDefaultModel } from "./models";

export interface PromptInput {
  userPrompt: string;
  modelId?: string;
  backendEnabled?: boolean;
  beliefScopes?: BeliefScope[];
}

export interface StructuredPrompt {
  systemPrompt: string;
  userPrompt: string;
  beliefContext: string;
  model: AIModel;
  metadata: {
    backendEnabled: boolean;
    beliefCount: number;
    estimatedInputTokens: number;
  };
}

/**
 * System prompt template for app generation
 */
const SYSTEM_PROMPT_TEMPLATE = `You are Evolvo, an AI assistant that builds mobile applications.

Your key traits:
- You remember user preferences and beliefs about architecture, UX, and development patterns
- You acknowledge when beliefs might be contradicted by new information
- You explain your reasoning based on the beliefs you hold
- You generate clean, production-ready code

{BACKEND_CONTEXT}

When generating an app:
1. Consider the user's stated beliefs and preferences
2. Flag any potential contradictions with existing beliefs
3. Provide clear explanations for architectural decisions
4. Generate complete, runnable code

{BELIEF_CONTEXT}`;

/**
 * Build a structured prompt for generation
 */
export function buildPrompt(input: PromptInput): StructuredPrompt {
  const model = input.modelId ? getModel(input.modelId) : getDefaultModel();
  if (!model) {
    throw new Error(`Unknown model: ${input.modelId}`);
  }

  // Generate belief context
  const beliefContext = generateBeliefContextSummary(input.beliefScopes);
  const beliefCount = beliefContext ? beliefContext.split("\n").filter(l => l.startsWith("-")).length : 0;

  // Backend context
  const backendContext = input.backendEnabled
    ? "Backend generation is ENABLED. Include server-side code, API routes, and database schemas as needed."
    : "Backend generation is DISABLED. Focus on frontend/client-side code only.";

  // Build system prompt
  let systemPrompt = SYSTEM_PROMPT_TEMPLATE
    .replace("{BACKEND_CONTEXT}", backendContext)
    .replace(
      "{BELIEF_CONTEXT}",
      beliefContext
        ? `\n## Your Current Beliefs:\n${beliefContext}`
        : "\n## No beliefs stored yet. Generate based on best practices."
    );

  // Rough token estimation (4 chars ≈ 1 token)
  const estimatedInputTokens = Math.ceil(
    (systemPrompt.length + input.userPrompt.length) / 4
  );

  return {
    systemPrompt,
    userPrompt: input.userPrompt,
    beliefContext,
    model,
    metadata: {
      backendEnabled: input.backendEnabled ?? false,
      beliefCount,
      estimatedInputTokens,
    },
  };
}

/**
 * Format prompt for API request (stub for future use)
 */
export function formatForAPI(prompt: StructuredPrompt): {
  messages: Array<{ role: "system" | "user"; content: string }>;
  model: string;
  max_tokens: number;
} {
  return {
    messages: [
      { role: "system", content: prompt.systemPrompt },
      { role: "user", content: prompt.userPrompt },
    ],
    model: prompt.model.id,
    max_tokens: prompt.model.maxOutput,
  };
}

