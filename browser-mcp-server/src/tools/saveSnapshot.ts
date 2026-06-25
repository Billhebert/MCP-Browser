import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

interface SnapshotData {
  name: string;
  title: string;
  url: string;
  text: string;
  screenshot: string;
  timestamp: number;
}

const snapshotsStore = new Map<string, SnapshotData>();

export function getSnapshots() {
  return snapshotsStore;
}

export const saveSnapshotTool: ToolDefinition = {
  name: "save_snapshot",
  description:
    "Salvar um snapshot (foto) do estado atual da página: URL, título, texto visível e screenshot. O snapshot fica armazenado em memória.",
  args: {
    name: z.string().optional().describe("Nome opcional para identificar o snapshot"),
  },
  async execute({ name }: { name?: string }) {
    const page = await getPage();
    const snapshotName = name || `snapshot-${Date.now()}`;
    console.error(`📸 Salvando snapshot: ${snapshotName}`);

    const data: SnapshotData = {
      name: snapshotName,
      title: await page.title(),
      url: page.url(),
      text: await page.evaluate(() => document.body.innerText).catch(() => ""),
      screenshot: (await page.screenshot({ type: "png" })).toString("base64"),
      timestamp: Date.now(),
    };

    snapshotsStore.set(snapshotName, data);
    console.error(`✅ Snapshot salvo: ${snapshotName}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            name: snapshotName,
            title: data.title,
            url: data.url,
            textLength: data.text.length,
          }),
        },
      ],
    };
  },
};

export const getSnapshotsTool: ToolDefinition = {
  name: "get_snapshots",
  description: "Listar todos os snapshots salvos anteriormente com save_snapshot.",
  args: {},
  async execute() {
    if (snapshotsStore.size === 0) {
      return { content: [{ type: "text", text: "Nenhum snapshot salvo." }] };
    }

    const text = Array.from(snapshotsStore.values())
      .map(
        (s) =>
          `📸 ${s.name}\n   ${s.title}\n   ${s.url}\n   ${new Date(s.timestamp).toLocaleTimeString()}`,
      )
      .join("\n\n");

    return { content: [{ type: "text", text }] };
  },
};

export const restoreSnapshotTool: ToolDefinition = {
  name: "restore_snapshot",
  description:
    "Restaurar um snapshot salvo: navega para a URL, verifica se o título e texto conferem, e retorna o screenshot para comparação visual.",
  args: {
    name: z.string().describe("Nome do snapshot salvo anteriormente"),
  },
  async execute({ name }: { name: string }) {
    const data = snapshotsStore.get(name);
    if (!data) {
      return {
        content: [{ type: "text", text: `Snapshot não encontrado: ${name}` }],
        isError: true,
      };
    }

    const page = await getPage();
    console.error(`🔄 Restaurando snapshot: ${name}`);

    await page.goto(data.url, { waitUntil: "networkidle" });
    const currentTitle = await page.title();
    const currentText = await page.evaluate(() => document.body.innerText).catch(() => "");

    const titleMatch = currentTitle === data.title;
    const textSimilarity = currentText.length > 0 && data.text.length > 0
      ? currentText.slice(0, 200) === data.text.slice(0, 200)
      : false;

    console.error(`✅ Snapshot restaurado: ${name}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: true,
              name,
              url: data.url,
              titleMatch,
              textMatch: textSimilarity,
            },
            null,
            2,
          ),
        },
        { type: "image", data: data.screenshot, mimeType: "image/png" },
        {
          type: "text",
          text: `📸 Screenshot do snapshot original para comparação.`,
        },
      ],
    };
  },
};
