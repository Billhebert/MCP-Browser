import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getConsoleLogs, clearConsoleLogs } from "../browser.js";

export const checkConsoleErrorsTool: ToolDefinition = {
  name: "check_console_errors",
  description:
    "Analisar erros do console do navegador na página atual. Categoriza por tipo (JS error, warning, network, promise rejection, React error), agrupa por mensagem, e classifica por severidade.",
  args: {
    clear: z.string().optional().describe("Se 'true', limpa os logs após análise"),
  },
  async execute(args: { clear?: string }) {
    const page = await getPage();
    const url = page.url();
    const doClear = args.clear === "true";

    const logs = getConsoleLogs();
    const categories: Record<string, Array<{ text: string; count: number; samples: string[] }>> = {};
    const severityMap: Record<string, string> = {
      error: "high",
      pageerror: "high",
      warning: "medium",
      info: "low",
      log: "info",
    };

    const groups = new Map<string, { texts: Set<string>; count: number; samples: string[] }>();
    for (const log of logs) {
      const cat = log.type;
      const key = `${cat}:${log.text.slice(0, 100)}`;
      if (!groups.has(key)) groups.set(key, { texts: new Set(), count: 0, samples: [] });
      const g = groups.get(key)!;
      g.count++;
      g.texts.add(log.text);
      if (g.samples.length < 3) g.samples.push(log.text);
    }

    for (const [key, g] of groups) {
      const cat = key.split(":")[0];
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({
        text: Array.from(g.texts).join(" | ").slice(0, 200),
        count: g.count,
        samples: g.samples.map((s) => s.slice(0, 150)),
      });
    }

    const issues: Array<{ type: string; severity: string; message: string; count: number }> = [];
    for (const [cat, entries] of Object.entries(categories)) {
      const severity = severityMap[cat] || "info";
      for (const entry of entries) {
        if (severity !== "info") {
          issues.push({ type: `console-${cat}`, severity, message: entry.text, count: entry.count });
        }
      }
    }

    if (doClear) clearConsoleLogs();

    console.error(`📋 Console: ${logs.length} entries across ${Object.keys(categories).length} categories, ${issues.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalEntries: logs.length,
        categories,
        issues,
        cleared: doClear,
      }, null, 2) }],
    };
  },
};
