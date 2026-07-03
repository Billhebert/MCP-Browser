import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getCDPSession, getExtensionsDir } from "../browser.js";
import path from "path";
import fs from "fs";

export const installExtensionTool: ToolDefinition = {
  name: "install_extension",
  description:
    "Instalar uma extensão do Chrome a partir de um diretório local. Aceita apenas caminho local para diretório da extensão (unpacked). Não suporta download remoto por segurança.",
  args: {
    source: z.string().max(5000).describe("Caminho local para diretório da extensão (apenas caminho local, URLs não são suportadas)"),
    enableInIncognito: z.boolean().optional().describe("Se true, permite a extensão em modo anônimo (padrão: false)"),
  },
  async execute(args: { source: string; enableInIncognito?: boolean }) {
    const cdp = await getCDPSession();
    const extDir = getExtensionsDir();

    if (args.source.startsWith("http://") || args.source.startsWith("https://")) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Download remoto não é suportado por segurança. Forneça um caminho local para o diretório da extensão." }, null, 2) }],
        isError: true,
      };
    }

    let installPath = args.source;
    if (!path.isAbsolute(args.source)) {
      installPath = path.resolve(extDir, args.source);
    }
    if (!fs.existsSync(installPath)) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Caminho não encontrado: ${installPath}` }, null, 2) }],
        isError: true,
      };
    }
    if (!fs.existsSync(path.join(installPath, "manifest.json"))) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `manifest.json não encontrado em ${installPath}` }, null, 2) }],
        isError: true,
      };
    }

    try {
      const result: any = await cdp.send("Extensions.loadUnpacked", {
        path: installPath,
        enableInIncognito: args.enableInIncognito || false,
      });

      let manifestName = "unknown";
      let manifestVersion = "0.0";
      try {
        const manifest = JSON.parse(fs.readFileSync(path.join(installPath, "manifest.json"), "utf-8"));
        manifestName = manifest.name || manifestName;
        manifestVersion = manifest.version || manifestVersion;
      } catch {}

      console.error(`✅ Extensão instalada: ${manifestName} v${manifestVersion} (ID: ${result.id})`);
      return { content: [{ type: "text", text: JSON.stringify({ success: true, id: result.id, name: manifestName, version: manifestVersion, path: installPath }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Falha ao instalar via CDP: ${(err as Error).message}`, path: installPath }, null, 2) }], isError: true };
    }
  },
};
