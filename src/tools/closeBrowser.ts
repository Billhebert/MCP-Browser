import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, serialized } from "../browser.js";

export const closeBrowserTool: ToolDefinition = {
  name: "closeBrowser",
  description: "Fecha navegador",
  args: {  },
  async execute(args: any) {
    const { closeBrowser: cb } = await import("../browser.js"); await cb(); return { content: [{ type: "text", text: "Navegador fechado" }] };
  },
};
