import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getCDPSession, getPage } from "../browser.js";

export const listExtensionsTool: ToolDefinition = {
  name: "list_extensions",
  description: "List installed Chrome extensions.",
  args: {
    enabled: z.boolean().optional().describe("Filter : true só enabled, false só disabled, omitir = todas"),
  },
  async execute(args: { enabled?: boolean }) {
    const page = await getPage();
    const cdp = await getCDPSession(page);

    try {
      const result: any = await cdp.send("Extensions.getExtensions");
      const extensions: Array<{
        id: string;
        name: string;
        version: string;
        path: string;
        enabled: boolean;
      }> = result.extensions || [];

      let filtered = extensions;
      if (args.enabled !== undefined) {
        filtered = extensions.filter((e) => e.enabled === args.enabled);
      }

      console.error(`📦 Extensões: ${filtered.length} encontradas (${extensions.length} total)`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total: extensions.length,
            filtered: filtered.length,
            extensions: filtered,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Falha ao list extensões: ${(err as Error).message}` }, null, 2) }],
        isError: true,
      };
    }
  },
};
