export interface AuditEntry {
  timestamp: string;
  tool: string;
  user: string;
  session: string;
  args: Record<string, unknown>;
  result: { status: string; score?: number; issueCount?: number };
  durationMs: number;
}

export interface AuditStats {
  totalExecutions: number;
  totalErrors: number;
  averageScore: number;
  topTools: Array<{ tool: string; count: number }>;
  uptimeDays: number;
}

export interface IAuditRepository {
  write(entry: AuditEntry): void;
  readAll(limit?: number, filter?: Record<string, unknown>): Promise<AuditEntry[]>;
  getStats(): Promise<AuditStats>;
}

export interface ISettingsRepository {
  get(key: string): string | null;
  getAll(): Record<string, string>;
  set(key: string, value: string): void;
}

export interface ISnapshotRepository {
  save(name: string, data: Record<string, unknown>, tags?: string[]): void;
  get(name: string): Record<string, unknown> | null;
  list(): Array<{ name: string; created_at: string; tags: string[] }>;
  delete(name: string): void;
}

export interface IPluginRepository {
  register(name: string, version: string, description: string): void;
  list(): Array<{ name: string; version: string; description: string; enabled: number; installed_at: string }>;
  toggle(name: string, enabled: boolean): void;
}
