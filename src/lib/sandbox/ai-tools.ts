/**
 * AI Tools for Sandbox (Backend API version)
 * 
 * Defines the tools available to the AI for manipulating files
 * and running commands in the sandbox environment.
 * 
 * NOTE: This is the backend version - it only contains tool definitions.
 * Tool execution happens on the frontend using WebContainer.
 */

import Anthropic from "@anthropic-ai/sdk";

// Tool definitions for Claude
export const SANDBOX_TOOLS: Anthropic.Tool[] = [
  // === FILE OPERATIONS ===
  {
    name: "write_file",
    description: "Create or update a file in the project. Use this to create new files or modify existing ones. Always provide the complete file content.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path relative to the project root (e.g., 'src/components/Button.jsx')"
        },
        content: {
          type: "string",
          description: "The complete content to write to the file"
        }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "read_file",
    description: "Read the contents of a file. Use this to understand existing code before making changes.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path relative to the project root"
        }
      },
      required: ["path"]
    }
  },
  {
    name: "delete_file",
    description: "Delete a file from the project. Use with caution.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "The file path to delete"
        }
      },
      required: ["path"]
    }
  },

  // === COMMAND OPERATIONS ===
  {
    name: "run_command",
    description: "Run a shell command in the project. Use for installing packages, running scripts, etc. Commands run in the project root directory.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to run (e.g., 'npm install axios')"
        }
      },
      required: ["command"]
    }
  },
  {
    name: "start_dev_server",
    description: "Start the development server. Call this after setting up the project to see the live preview.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  // === ENVIRONMENT VARIABLE OPERATIONS ===
  {
    name: "prompt_env_var",
    description: "Prompt the user to enter an environment variable value. Use this when the application needs an API key, secret, or configuration value. The user will see a modal with your description and instructions. Common env vars: OPENROUTER_API_KEY (for AI features), STRIPE_SECRET_KEY, SUPABASE_URL, DATABASE_URL, etc.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The environment variable name (e.g., 'OPENROUTER_API_KEY', 'STRIPE_SECRET_KEY'). Must be SCREAMING_SNAKE_CASE."
        },
        title: {
          type: "string",
          description: "A short, user-friendly title for the prompt modal (e.g., 'OpenRouter API Key Required')"
        },
        description: {
          type: "string",
          description: "A clear description of what this environment variable is used for and why it's needed"
        },
        instructions: {
          type: "string",
          description: "Step-by-step instructions on how to get this value (e.g., 'Go to openrouter.ai/keys and create a new API key')"
        },
        helpUrl: {
          type: "string",
          description: "Optional URL where the user can get help or create the required value"
        },
        placeholder: {
          type: "string",
          description: "Optional placeholder text showing the expected format (e.g., 'sk-or-...')"
        },
        sensitive: {
          type: "boolean",
          description: "Whether this is a sensitive value that should be masked in the input (default: true)"
        }
      },
      required: ["name", "title", "description", "instructions"]
    }
  },

  // === BELIEF MEMORY OPERATIONS ===
  {
    name: "store_belief",
    description: "Store or update a belief about the user's preferences, project requirements, or architectural decisions. Use this to remember important context for future interactions.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The belief content - a clear statement about a preference, requirement, or decision"
        },
        scope: {
          type: "string",
          enum: ["architecture", "ux", "product", "dev-habits", "cost", "general"],
          description: "The category of this belief"
        },
        evidence: {
          type: "string",
          description: "Optional evidence or context that supports this belief"
        },
        existingBeliefId: {
          type: "string",
          description: "If updating an existing belief, provide its ID"
        }
      },
      required: ["content", "scope"]
    }
  },
  {
    name: "reinforce_belief",
    description: "Reinforce an existing belief with new evidence. This increases the belief's confidence.",
    input_schema: {
      type: "object",
      properties: {
        beliefId: {
          type: "string",
          description: "The ID of the belief to reinforce"
        },
        evidence: {
          type: "string",
          description: "New evidence that supports this belief"
        }
      },
      required: ["beliefId", "evidence"]
    }
  },
  {
    name: "contradict_belief",
    description: "Record a contradiction to an existing belief. This decreases the belief's confidence and may deprecate it.",
    input_schema: {
      type: "object",
      properties: {
        beliefId: {
          type: "string",
          description: "The ID of the belief being contradicted"
        },
        contradiction: {
          type: "string",
          description: "The contradicting evidence or statement"
        }
      },
      required: ["beliefId", "contradiction"]
    }
  },
  {
    name: "search_beliefs",
    description: "Search through stored beliefs to find relevant context for the current task.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to find relevant beliefs"
        },
        scope: {
          type: "string",
          enum: ["architecture", "ux", "product", "dev-habits", "cost", "general"],
          description: "Optional scope to filter beliefs"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_belief_context",
    description: "Get a summary of relevant beliefs for the current context. Use this at the start of complex tasks to understand user preferences.",
    input_schema: {
      type: "object",
      properties: {
        taskDescription: {
          type: "string",
          description: "Brief description of the current task"
        },
        scopes: {
          type: "array",
          items: {
            type: "string",
            enum: ["architecture", "ux", "product", "dev-habits", "cost", "general"]
          },
          description: "Which belief categories are relevant to this task"
        }
      },
      required: ["taskDescription"]
    }
  }
];

// Get tool by name
export function getToolByName(name: string): Anthropic.Tool | undefined {
  return SANDBOX_TOOLS.find(tool => tool.name === name);
}

// Get all tool names
export function getToolNames(): string[] {
  return SANDBOX_TOOLS.map(tool => tool.name);
}
