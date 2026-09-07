#!/usr/bin/env node
/**
 * apple-mcp — an open-source MCP server for Apple Notes, Reminders,
 * and Calendar on macOS.
 *
 * Speaks the Model Context Protocol over stdio, so it works with
 * Claude Desktop, Claude Code, and any other MCP client.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { modules } from "./modules/index.js";

const VERSION = "1.0.0";

const server = new McpServer({ name: "apple-mcp", version: VERSION });

let toolCount = 0;
for (const mod of modules) {
  for (const tool of mod.tools) {
    toolCount++;
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.schema,
        annotations: tool.annotations,
      },
      (async (args: Record<string, any>) => {
        try {
          const result = await tool.handler(args ?? {});
          const text =
            typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return { content: [{ type: "text" as const, text }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Error: " + message }],
          };
        }
      }) as any
    );
  }
}

async function main() {
  if (process.platform !== "darwin") {
    console.error(
      "apple-mcp only runs on macOS: it controls Apple apps (Notes, Reminders, Calendar) via Apple events."
    );
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr, not stdout — stdout is reserved for the MCP protocol.
  console.error(
    "apple-mcp v" +
      VERSION +
      " ready: " +
      toolCount +
      " tools for " +
      modules.map((m) => m.app).join(", ")
  );
}

main().catch((err) => {
  console.error("apple-mcp failed to start:", err);
  process.exit(1);
});
