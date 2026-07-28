import type { IAuditRepository, AuditEntry, AuditStats } from "../contracts/repositories.js";
import { writeAudit as jsonlWrite, readAudits as jsonlRead, getAuditStats as jsonlStats } from "../corporate/auditTrail.js";
import { insertAudit as dbInsert, queryAudits as dbQuery, getAuditStats as dbStats } from "../corporate/database.js";

export class AuditRepository implements IAuditRepository {
  write(entry: AuditEntry): void {
    jsonlWrite(entry as any);
    try { dbInsert(entry as any); } catch {}
  }

  async readAll(limit = 200, filter?: Record<string, unknown>): Promise<AuditEntry[]> {
    try {
      const fromDb = dbQuery(limit, 0);
      if (fromDb.length > 0) return fromDb as unknown as AuditEntry[];
    } catch {}
    return jsonlRead(limit, filter) as unknown as AuditEntry[];
  }

  async getStats(): Promise<AuditStats> {
    try {
      const fromDb = await jsonlStats();
      if (fromDb.totalExecutions > 0) return fromDb;
    } catch {}
    return { totalExecutions: 0, totalErrors: 0, averageScore: 0, topTools: [], uptimeDays: 0 };
  }
}
