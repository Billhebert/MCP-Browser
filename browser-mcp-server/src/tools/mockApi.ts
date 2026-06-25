import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const mockApiTool: ToolDefinition = {
  name: "mock_api",
  description:
    "Interceptar e mockar requisições de API na página atual. Permite simular respostas de endpoints específicos sem chamá-los realmente. Útil para testar cenários de erro, loading, e dados mockados.",
  args: {
    mocks: z.string().describe("JSON array de mocks: [{\"url\":\"https://api.exemplo.com/users\",\"status\":200,\"body\":\"{\\\"data\\\":[]}\",\"method\":\"GET\"}]"),
    clear: z.string().optional().describe("Se 'true', remove todos os mocks ativos em vez de adicionar"),
  },
  async execute(args: { mocks: string; clear?: string }) {
    const page = await getPage();

    if (args.clear === "true") {
      await page.unrouteAll({ behavior: "wait" });
      console.error(`🗑️ Mocks cleared`);
      return { content: [{ type: "text", text: JSON.stringify({ cleared: true }, null, 2) }] };
    }

    const mocks: Array<{ url: string; status?: number; body?: string; method?: string; headers?: Record<string, string> }> = JSON.parse(args.mocks);

    for (const mock of mocks) {
      await page.route(mock.url, async (route) => {
        const reqMethod = route.request().method();
        if (mock.method && reqMethod !== mock.method) {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: mock.status || 200,
          headers: { "Content-Type": "application/json", ...(mock.headers || {}) },
          body: mock.body || "{}",
        });
      });
    }

    console.error(`🗺️ Mocked ${mocks.length} endpoint(s)`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        totalMocks: mocks.length,
        mocks: mocks.map((m) => ({ url: m.url, method: m.method || "ANY", status: m.status || 200 })),
      }, null, 2) }],
    };
  },
};
