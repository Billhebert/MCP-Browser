import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ToolDefinition {
  name: string;
  description: string;
  args: Record<string, z.ZodType>;
  execute: (args: any) => Promise<{
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    isError?: boolean;
  }>;
}

const toolMap = new Map<string, ToolDefinition>();
let _tools: ToolDefinition[] | null = null;

function isToolDefinition(obj: unknown): obj is ToolDefinition {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "description" in obj &&
    "args" in obj &&
    "execute" in obj
  );
}

async function discoverTools(): Promise<ToolDefinition[]> {
  const isDist = __dirname.includes("dist");
  const ext = isDist ? ".js" : ".ts";
  const selfFile = isDist ? "registry.js" : "registry.ts";
  const discoveryFile = isDist ? "discovery.js" : "discovery.ts";
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith(ext) && !f.endsWith(".d.ts") && f !== selfFile && f !== discoveryFile)
    .map(f => path.join(__dirname, f));

  const found: ToolDefinition[] = [];

  for (const file of files) {
    try {
      const mod = await import(file);
      for (const key of Object.keys(mod)) {
        const val = mod[key];
        if (isToolDefinition(val)) {
          found.push(val);
        } else if (Array.isArray(val) && val.every(isToolDefinition)) {
          found.push(...val);
        }
      }
    } catch (err) {
      console.error(`Failed to load tool: ${file}`, (err as Error).message);
    }
  }

  return found;
}

async function ensureTools(): Promise<ToolDefinition[]> {
  if (!_tools) {
    _tools = await discoverTools();
    for (const t of _tools) {
      toolMap.set(t.name, t);
    }
  }
  return _tools;
}

function getZodJsonType(zodType: z.ZodType): string {
  if (zodType instanceof z.ZodString) return "string";
  if (zodType instanceof z.ZodNumber) return "number";
  if (zodType instanceof z.ZodBoolean) return "boolean";
  if (zodType instanceof z.ZodEnum) return "string";
  if (zodType instanceof z.ZodArray) return "array";
  if (zodType instanceof z.ZodOptional) return getZodJsonType(zodType.unwrap());
  if (zodType instanceof z.ZodNullable) return getZodJsonType(zodType.unwrap());
  if (zodType instanceof z.ZodDefault) return getZodJsonType(zodType.removeDefault());
  return "string";
}

function convertToMCPTool(tool: ToolDefinition) {
  const properties: Record<string, unknown> = {};
  for (const [key, zodType] of Object.entries(tool.args)) {
    properties[key] = {
      type: getZodJsonType(zodType),
      description: zodType.description || key,
    };
  }
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties,
      required: Object.entries(tool.args)
        .filter(([_, zt]) => !zt.isOptional())
        .map(([key]) => key),
    },
  };
}

export { toolMap, ensureTools, isToolDefinition, convertToMCPTool };
