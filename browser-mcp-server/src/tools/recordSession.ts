import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getContext } from "../browser.js";

export const recordSessionTool: ToolDefinition = {
  name: "record_session",
  description:
    "Gravar uma sessão de navegação usando Playwright Tracing. Gera um arquivo .zip com trace que pode ser visualizado em https://trace.playwright.dev/. Útil para debug de fluxos complexos.",
  args: {
    action: z.string().describe("Ação: 'start' (inicia gravação), 'stop' (finaliza e retorna link), 'status' (verifica se está gravando)"),
    name: z.string().optional().describe("Nome do snapshot (opcional, usado com stop)"),
  },
  async execute(args: { action: string; name?: string }) {
    const ctx = await getContext();
    const page = await getPage();

    if (args.action === "start") {
      await ctx.tracing.start({ screenshots: true, snapshots: true });
      console.error(`🔴 Recording started`);
      return { content: [{ type: "text", text: JSON.stringify({ status: "recording", action: "start" }, null, 2) }] };
    }

    if (args.action === "status") {
      return { content: [{ type: "text", text: JSON.stringify({ status: "unknown", hint: "Call action=start to begin, action=stop to end" }, null, 2) }] };
    }

    if (args.action === "stop") {
      const now = Date.now();
      const tracePath = `/tmp/bvp-trace-${now}.zip`;
      await ctx.tracing.stop({ path: tracePath });
      const fs = await import("fs");
      const stats = fs.statSync(tracePath);
      console.error(`⏹️ Recording saved: ${tracePath} (${(stats.size / 1024).toFixed(0)}KB)`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "saved",
            tracePath,
            sizeKB: Math.round(stats.size / 1024),
            viewerUrl: "https://trace.playwright.dev/",
            instructions: `Abra ${tracePath} em https://trace.playwright.dev/ para visualizar`,
          }, null, 2),
        }],
      };
    }

    return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${args.action}. Use start, stop, or status` }, null, 2) }] };
  },
};
