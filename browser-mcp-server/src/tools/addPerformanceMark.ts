import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, getNetworkLogs, getConsoleLogs } from "../browser.js";

export const addPerformanceMarkTool: ToolDefinition = {
  name: "add_performance_mark",
  description: "Add a custom performance mark for timing measurement.",
  args: {
    name: z.string().max(500).describe("Name do marcador (ex: 'antes-login', 'após-login')"),
    data: z.string().max(50000).optional().describe("Dados opcionais associados ao marcador"),
  },
  async execute({ name, data }: { name: string; data?: string }) {
    const { addPerformanceMark } = await import("../browser.js");
    addPerformanceMark(name, data);
    console.error(`⏱️  Mark added: ${name}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, mark: name }),
        },
      ],
    };
  },
};
