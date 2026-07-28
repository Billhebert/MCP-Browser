import type { ToolResult } from "../types.js";
import type { AuditEntry } from "./repositories.js";

export interface ExecuteOptions {
  toolName: string;
  args: Record<string, unknown>;
  user: string;
  sessionId?: string;
}

export interface ExecuteResult {
  result: ToolResult;
  auditEntry: AuditEntry;
}

export interface IToolExecutorService {
  execute(options: ExecuteOptions): Promise<ExecuteResult>;
}
