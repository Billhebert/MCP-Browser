import type { ISnapshotRepository } from "../contracts/repositories.js";
import { saveSnapshot, getSnapshot, listSnapshots, deleteSnapshot } from "../corporate/database.js";

export class SnapshotRepository implements ISnapshotRepository {
  save(name: string, data: Record<string, unknown>, tags?: string[]): void {
    saveSnapshot(name, data, tags);
  }

  get(name: string): Record<string, unknown> | null {
    return getSnapshot(name);
  }

  list(): Array<{ name: string; created_at: string; tags: string[] }> {
    return listSnapshots() as any;
  }

  delete(name: string): void {
    deleteSnapshot(name);
  }
}
