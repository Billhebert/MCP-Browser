import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getCDPSession, getPage } from "../browser.js";

export const listExtensionsTool: ToolDefinition = {
  name: "list_extensions",
  description:
    "Listar todas as extensões instaladas no navegador. Retorna ID, nome, versão, caminho e status (enabled/disabled). Útil para verificar extensões carregadas via BVP_EXTENSIONS ou install_extension.",
  args: {
    enabled: z.boolean().optional().describe("Filtrar: true só enabled, false só disabled, omitir = todas"),
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
        content: [{ type: "text", text: JSON.stringify({ error: `Falha ao listar extensões: ${(err as Error).message}` }, null, 2) }],
        isError: true,
      };
    }
  },
};
