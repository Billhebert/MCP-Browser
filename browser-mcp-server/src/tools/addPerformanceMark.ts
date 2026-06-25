import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs, getConsoleLogs } from "../browser.js";

export const addPerformanceMarkTool: ToolDefinition = {
  name: "add_performance_mark",
  description: "Adicionar um marcador de performance personalizado. Útil para medir tempos entre ações.",
  args: {
    name: z.string().describe("Nome do marcador (ex: 'antes-login', 'após-login')"),
    data: z.string().optional().describe("Dados opcionais associados ao marcador"),
  },
  async execute({ name, data }: { name: string; data?: string }) {
    const { addPerformanceMark } = await import("../browser.js");
    addPerformanceMark(name, data);
    console.error(`⏱️  Marcador adicionado: ${name}`);
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
