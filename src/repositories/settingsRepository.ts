import type { ISettingsRepository } from "../contracts/repositories.js";
import { upsertSetting, getSetting, getAllSettings } from "../corporate/database.js";

export class SettingsRepository implements ISettingsRepository {
  get(key: string): string | null {
    return getSetting(key);
  }

  getAll(): Record<string, string> {
    return getAllSettings();
  }

  set(key: string, value: string): void {
    upsertSetting(key, value);
  }
}
