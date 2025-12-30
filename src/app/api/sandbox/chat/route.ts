/**
 * Sandbox Chat API Route
 * 
 * Handles streaming AI responses with tool calling for the sandbox environment.
 * Uses Server-Sent Events (SSE) for real-time streaming.
 * 
 * Supports agent addons via custom system prompts passed from the frontend.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SANDBOX_TOOLS, SYSTEM_PROMPT } from "@/lib/sandbox/ai-tools";

export const runtime = "edge";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  apiKey?: string;
  tier?: "free" | "pro" | "enterprise";
  /** Custom system prompt from frontend (with agent addons applied) */
  customSystemPrompt?: string;
  /** Custom tools from frontend (with agent addon tools) */
  customTools?: Anthropic.Tool[];
  /** Active addon IDs for logging/analytics */
  activeAddons?: string[];
}

// Response delay based on subscription tier (in ms)
const TIER_DELAYS: Record<string, number> = {
  free: 3000,      // 3 second delay for free users
  pro: 0,          // No delay for pro users
  enterprise: 0,   // No delay for enterprise users
};

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { messages, apiKey, tier = "free", customSystemPrompt, customTools, activeAddons } = body;
    
    // Apply artificial delay for free tier users
    const delay = TIER_DELAYS[tier] || TIER_DELAYS.free;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Use provided API key or environment variable
    const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "No API key provided. Set ANTHROPIC_API_KEY or provide apiKey in request." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const client = new Anthropic({ apiKey: anthropicApiKey });
    
    // Use custom system prompt if provided (from frontend agent addons), otherwise use default
    const systemPrompt = customSystemPrompt || SYSTEM_PROMPT;
    
    // Use custom tools if provided (with addon tools merged), otherwise use default
    const tools = customTools || SANDBOX_TOOLS;
    
    // Log active addons for analytics (optional)
    if (activeAddons && activeAddons.length > 0) {
      console.log(`[Sandbox Chat] Active agent addons: ${activeAddons.join(", ")}`);
    }
    
    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Process the AI response in the background
    (async () => {
      try {
        let continueLoop = true;
        let currentMessages = anthropicMessages;
        
        while (continueLoop) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 8192,
            system: systemPrompt,
            tools: tools,
            messages: currentMessages,
            stream: true
          });
          
          let currentText = "";
          const toolUses: { id: string; name: string; input: string }[] = [];
          let currentToolUse: { id: string; name: string; input: string } | null = null;
          
          for await (const event of response) {
            switch (event.type) {
              case "content_block_start":
                if (event.content_block.type === "text") {
                  // Text block starting
                } else if (event.content_block.type === "tool_use") {
                  currentToolUse = {
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: ""
                  };
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "tool_start", id: event.content_block.id, name: event.content_block.name })}\n\n`));
                }
                break;
                
              case "content_block_delta":
                if (event.delta.type === "text_delta") {
                  currentText += event.delta.text;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "text", text: event.delta.text })}\n\n`));
                } else if (event.delta.type === "input_json_delta" && currentToolUse) {
                  currentToolUse.input += event.delta.partial_json;
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "tool_input", input: event.delta.partial_json })}\n\n`));
                }
                break;
                
              case "content_block_stop":
                if (currentToolUse) {
                  toolUses.push(currentToolUse);
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "tool_complete", id: currentToolUse.id, name: currentToolUse.name, input: currentToolUse.input })}\n\n`));
                  currentToolUse = null;
                }
                break;
                
              case "message_stop":
                // Check if we need to continue with tool results
                break;
            }
          }
          
          // If there were tool uses, we need to send the results back
          if (toolUses.length > 0) {
            // Add assistant message with tool uses
            const assistantContent: (Anthropic.TextBlockParam | Anthropic.ToolUseBlockParam)[] = [];
            
            if (currentText) {
              assistantContent.push({ type: "text", text: currentText });
            }
            
            for (const tool of toolUses) {
              let parsedInput = {};
              try {
                parsedInput = JSON.parse(tool.input);
              } catch {
                // Use empty object if parsing fails
              }
              
              assistantContent.push({
                type: "tool_use",
                id: tool.id,
                name: tool.name,
                input: parsedInput
              });
            }
            
            currentMessages = [
              ...currentMessages,
              { role: "assistant", content: assistantContent }
            ];
            
            // Collect tool results from the client
            // For now, we'll signal that tools need execution
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "need_tool_results", tools: toolUses })}\n\n`));
            
            // In a real implementation, we'd wait for tool results from the client
            // For simplicity, we'll end the loop here and let the client handle tool execution
            continueLoop = false;
          } else {
            continueLoop = false;
          }
        }
        
        await writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`));
        await writer.close();
      }
    })();
    
    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
