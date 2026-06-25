import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs, clearNetworkLogs } from "../browser.js";

export const exportHarTool: ToolDefinition = {
  name: "export_har",
  description:
    "Exportar todas as requisições de rede capturadas no formato HAR (HTTP Archive). Útil para compartilhar com desenvolvedores ou analisar performance.",
  args: {
    clear: z
      .boolean()
      .optional()
      .describe("Se true, limpa o log de rede após exportar"),
  },
  async execute({ clear }: { clear?: boolean }) {
    const page = await getPage();
    console.error(`📦 Exportando HAR...`);

    const logs = getNetworkLogs();
    const hostname = new URL(page.url()).hostname;

    const har = {
      log: {
        version: "1.2",
        creator: { name: "BVP Browser MCP", version: "0.1.0" },
        browser: { name: "Chromium", version: "" },
        pages: [
          {
            startedDateTime: new Date().toISOString(),
            id: "page_1",
            title: await page.title().catch(() => ""),
            pageTimings: { onLoad: -1, onContentLoad: -1 },
          },
        ],
        entries: logs.slice(-200).map((r, i) => ({
          _initiator: { type: r.type },
          pageref: "page_1",
          startedDateTime: new Date(r.timestamp).toISOString(),
          request: {
            method: r.method,
            url: r.url,
            httpVersion: "HTTP/2",
            headers: [],
            queryString: [],
            cookies: [],
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: r.status,
            statusText: "",
            httpVersion: "HTTP/2",
            headers: [],
            cookies: [],
            content: {
              size: -1,
              mimeType: r.type,
            },
            redirectURL: "",
            headersSize: -1,
            bodySize: -1,
          },
          cache: {},
          timings: { send: 0, wait: 0, receive: 0 },
          time: 0,
        })),
      },
    };

    if (clear) {
      clearNetworkLogs();
      console.error(`🧹 Logs de rede limpos`);
    }

    console.error(`✅ HAR exportado: ${logs.length} entradas`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(har, null, 2),
        },
      ],
    };
  },
};
