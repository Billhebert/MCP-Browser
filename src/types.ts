import type { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  args: Record<string, z.ZodType>;
  execute: (args: any) => Promise<ToolResult>;
}

export interface ToolResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface AuditEntry {
  timestamp: string;
  tool: string;
  user: string;
  session: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  durationMs: number;
}
