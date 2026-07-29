import fs from "node:fs";
import path from "node:path";
import type { ToolDefinition } from "../index.js";
import { toolMap } from "../tools/registry.js";
import { registerPlugin } from "./database.js";

const PLUGIN_DIR = path.resolve(process.cwd(), "plugins");

interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  main: string;
}

interface PluginPackage {
  manifest: PluginManifest;
  dir: string;
  tools: ToolDefinition[];
}

const loadedPlugins: Map<string, PluginPackage> = new Map();

export function getPluginDir(): string {
  if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  }
  return PLUGIN_DIR;
}

export async function loadPlugins(): Promise<PluginPackage[]> {
  const dir = getPluginDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const plugins: PluginPackage[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pluginDir = path.join(dir, entry.name);
    const manifestPath = path.join(pluginDir, "plugin.json");

    if (!fs.existsSync(manifestPath)) {
      console.error(`⚠️ Plugin ${entry.name}: plugin.json not found, skipping`);
      continue;
    }

    try {
      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      if (!manifest.name || !manifest.version || !manifest.main) {
        console.error(`⚠️ Plugin ${entry.name}: invalid plugin.json, skipping`);
        continue;
      }

      const mainPath = path.resolve(pluginDir, manifest.main);
      if (!fs.existsSync(mainPath)) {
        console.error(`⚠️ Plugin ${manifest.name}: main file not found: ${mainPath}`);
        continue;
      }

      const pluginTools = await loadPluginTools(manifest, mainPath);
      if (pluginTools.length === 0) {
        console.error(`⚠️ Plugin ${manifest.name}: no tools exported, skipping`);
        continue;
      }

      for (const tool of pluginTools) {
        if (toolMap.has(tool.name)) {
          console.error(`⚠️ Plugin ${manifest.name}: tool "${tool.name}" already exists, skipping`);
          continue;
        }
        toolMap.set(tool.name, tool);
      }

      const pkg: PluginPackage = { manifest, dir: pluginDir, tools: pluginTools };
      loadedPlugins.set(manifest.name, pkg);
      plugins.push(pkg);
      registerPlugin(manifest.name, manifest.version, manifest.description);
      console.error(`🔌 Plugin loaded: ${manifest.name} v${manifest.version} (${pluginTools.length} tools)`);
    } catch (err) {
      console.error(`⚠️ Plugin ${entry.name}: failed to load: ${(err as Error).message}`);
    }
  }

  return plugins;
}

async function loadPluginTools(manifest: PluginManifest, mainPath: string): Promise<ToolDefinition[]> {
  try {
    const mod = await import(mainPath);
    const tools: ToolDefinition[] = [];

    if (mod.default && Array.isArray(mod.default)) {
      tools.push(...mod.default);
    }
    if (Array.isArray(mod.tools)) {
      tools.push(...mod.tools);
    }
    if (mod.tool && typeof mod.tool === "object" && mod.tool.name) {
      tools.push(mod.tool);
    }
    if (mod.execute && mod.name) {
      tools.push({ name: manifest.name, description: manifest.description, args: {}, execute: mod.execute } as ToolDefinition);
    }

    return tools;
  } catch (err) {
    console.error(`⚠️ Plugin ${manifest.name}: failed to import: ${(err as Error).message}`);
    return [];
  }
}

export function getLoadedPlugins(): PluginPackage[] {
  return Array.from(loadedPlugins.values());
}

export function createPluginScaffold(name: string, description: string): string {
  const dir = path.join(PLUGIN_DIR, name);
  if (fs.existsSync(dir)) {
    throw new Error(`Plugin directory already exists: ${dir}`);
  }

  fs.mkdirSync(dir, { recursive: true });

  const manifest: PluginManifest = {
    name,
    version: "0.1.0",
    description,
    main: "index.js",
  };
  fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(manifest, null, 2));

  const toolCode = `// Plugin: ${name}
// ${description}
//
// Export tools as array: export default [tool1, tool2]
// Or single tool: export const tool = { name, description, args, execute }
// 
// Example tool:
export default [
  {
    name: "${name}_hello",
    description: "A simple hello world tool from plugin ${name}",
    args: {
      name: { type: "string", description: "Your name" },
    },
    async execute(args) {
      return {
        content: [
          { type: "text", text: JSON.stringify({ message: "Hello " + (args.name || "world") + " from ${name}!" }) },
        ],
      };
    },
  },
];
`;
  fs.writeFileSync(path.join(dir, "index.js"), toolCode);

  return dir;
}
