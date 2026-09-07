import type { ZodRawShape } from "zod";

/** Standard MCP tool behavior hints, surfaced to clients. */
export interface ToolAnnotations {
  /** Tool only reads data, never modifies anything. */
  readOnlyHint?: boolean;
  /** Tool may delete or irreversibly change data. */
  destructiveHint?: boolean;
  /** Calling twice with the same args has the same effect as once. */
  idempotentHint?: boolean;
  /** Tool reaches outside the local machine (always false here). */
  openWorldHint?: boolean;
}

export interface AppleTool {
  /** MCP tool name, e.g. "notes_search". Snake_case, prefixed by app. */
  name: string;
  /** Short human title shown in client UIs. */
  title: string;
  /** Full description the model reads to decide when/how to call it. */
  description: string;
  /** Zod raw shape describing the tool's input arguments. */
  schema: ZodRawShape;
  annotations?: ToolAnnotations;
  handler: (args: Record<string, any>) => Promise<unknown>;
}

/**
 * A module wraps one Apple app. To add support for a new app
 * (Mail, Messages, Contacts, ...) create a new file exporting an
 * AppleModule and add it to the list in modules/index.ts.
 */
export interface AppleModule {
  /** Name of the Apple app this module wraps, e.g. "Notes". */
  app: string;
  tools: AppleTool[];
}
