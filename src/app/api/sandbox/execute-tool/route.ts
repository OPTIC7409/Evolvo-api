/**
 * Tool Execution Continuation API Route
 * 
 * After the client executes tools locally, this endpoint continues the conversation
 * with the tool results.
 */

import Anthropic from "@anthropic-ai/sdk";
import { SANDBOX_TOOLS, SYSTEM_PROMPT } from "@/lib/sandbox/ai-tools";

export const runtime = "edge";
export const maxDuration = 60;

interface ToolResult {
  toolUseId: string;
  result: string;
}

interface RequestBody {
  messages: Anthropic.MessageParam[];
  toolResults: ToolResult[];
  apiKey?: string;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { messages, toolResults, apiKey } = body;
    
    const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "No API key provided" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    
    const client = new Anthropic({ apiKey: anthropicApiKey });
    
    // Add tool results to messages
    const toolResultContent: Anthropic.ToolResultBlockParam[] = toolResults.map(tr => ({
      type: "tool_result",
      tool_use_id: tr.toolUseId,
      content: tr.result
    }));
    
    const updatedMessages: Anthropic.MessageParam[] = [
      ...messages,
      { role: "user", content: toolResultContent }
    ];
    
    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    (async () => {
      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          tools: SANDBOX_TOOLS,
          messages: updatedMessages,
          stream: true
        });
        
        let currentText = "";
        const toolUses: { id: string; name: string; input: string }[] = [];
        let currentToolUse: { id: string; name: string; input: string } | null = null;
        
        for await (const event of response) {
          switch (event.type) {
            case "content_block_start":
              if (event.content_block.type === "tool_use") {
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
          }
        }
        
        if (toolUses.length > 0) {
          // Build assistant content for continuation
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
          
          await writer.write(encoder.encode(`data: ${JSON.stringify({ 
            type: "need_tool_results", 
            tools: toolUses,
            assistantContent
          })}\n\n`));
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
