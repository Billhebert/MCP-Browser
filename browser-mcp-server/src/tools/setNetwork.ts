import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

const NETWORK_PRESETS: Record<string, { offline: boolean; latency: number; download: number; upload: number }> = {
  "slow-3g": { offline: false, latency: 2000, download: 50, upload: 20 },
  "regular-3g": { offline: false, latency: 1000, download: 100, upload: 50 },
  "fast-3g": { offline: false, latency: 500, download: 400, upload: 100 },
  "slow-4g": { offline: false, latency: 170, download: 1000, upload: 300 },
  "regular-4g": { offline: false, latency: 100, download: 3000, upload: 1000 },
  "fast-4g": { offline: false, latency: 50, download: 10000, upload: 5000 },
  "offline": { offline: true, latency: 0, download: 0, upload: 0 },
  "wifi": { offline: false, latency: 10, download: 50000, upload: 20000 },
};

export const setNetworkTool: ToolDefinition = {
  name: "set_network",
  description:
    "Simular condições de rede na pagina atual. Presets: slow-3g, regular-3g, fast-3g, slow-4g, regular-4g, fast-4g, offline, wifi. Ou especifique latência, download, upload customizados. NOTA: Usa CDP para throttling real.",
  args: {
    preset: z.string().optional().describe("Preset de rede: slow-3g, regular-3g, fast-3g, slow-4g, regular-4g, fast-4g, offline, wifi"),
    latency: z.string().optional().describe("Latência em ms (usado com download/upload se preset não especificado)"),
    download: z.string().optional().describe("Download em kbps"),
    upload: z.string().optional().describe("Upload em kbps"),
  },
  async execute(args: { preset?: string; latency?: string; download?: string; upload?: string }) {
    const page = await getPage();

    let config: { offline: boolean; latency: number; download: number; upload: number };

    if (args.preset && NETWORK_PRESETS[args.preset]) {
      config = NETWORK_PRESETS[args.preset];
    } else if (args.preset === "offline") {
      config = NETWORK_PRESETS.offline;
    } else {
      config = {
        offline: false,
        latency: parseInt(args.latency || "0"),
        download: parseInt(args.download || "0"),
        upload: parseInt(args.upload || "0"),
      };
    }

    if (config.offline) {
      await page.context().setOffline(true);
      console.error(`📡 Network: OFFLINE`);
      return { content: [{ type: "text", text: JSON.stringify({ offline: true }, null, 2) }] };
    }

    const client = await (page.context() as any).newCDPSession(page);
    if (client) {
      await client.send("Network.emulateNetworkConditions", {
        offline: config.offline,
        latency: config.latency,
        downloadThroughput: config.download * 1000,
        uploadThroughput: config.upload * 1000,
        connectionType: "cellular",
      });
    }

    const presetName = args.preset || "custom";
    console.error(`📡 Network: ${presetName} (${config.latency}ms latency, ${config.download}kbps down, ${config.upload}kbps up)`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        preset: presetName,
        latency: config.latency,
        downloadKbps: config.download,
        uploadKbps: config.upload,
      }, null, 2) }],
    };
  },
};
