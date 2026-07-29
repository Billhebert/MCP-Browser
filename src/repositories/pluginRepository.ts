import type { IPluginRepository } from "../contracts/repositories.js";
import { registerPlugin, listPlugins, togglePlugin } from "../corporate/database.js";

export class PluginRepository implements IPluginRepository {
  register(name: string, version: string, description: string): void {
    registerPlugin(name, version, description);
  }

  list(): Array<{ name: string; version: string; description: string; enabled: number; installed_at: string }> {
    return listPlugins() as any;
  }

  toggle(name: string, enabled: boolean): void {
    togglePlugin(name, enabled);
  }
}
