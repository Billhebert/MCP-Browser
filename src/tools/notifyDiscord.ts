import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { upsertSetting, getSetting } from "../corporate/database.js";

async function sendDiscord(webhookUrl: string, message: string, title?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      content: message.slice(0, 2000),
    };
    if (title) {
      payload.embeds = [{ title, description: message.slice(0, 4000), color: 3447003 }];
      delete payload.content;
    }
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${await res.text().catch(() => "unknown")}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export const notifyDiscordTool: ToolDefinition = {
  name: "notify_discord",
  description: "Send notification to Discord via webhook.",
  args: {
    message: z.string().max(2000).describe("Mensagem a send (máx 2000 chars)"),
    title: z.string().max(256).optional().describe("Título do embed (optional)"),
    webhookUrl: z.string().max(2000).optional().describe("URL do webhook do Discord. Se omitido, usa o salvo em settings"),
    saveWebhook: z.string().max(10).optional().describe("Salvar webhook URL para uso futuro? 'true' ou 'false'"),
  },
  async execute(args: { message: string; title?: string; webhookUrl?: string; saveWebhook?: string }) {
    let webhookUrl: string | undefined = args.webhookUrl;
    if (!webhookUrl) {
      webhookUrl = getSetting("discord_webhook") || undefined;
      if (!webhookUrl) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: "Webhook URL não fornecida e nenhuma salva em settings. Use webhookUrl ou salve com saveWebhook=true" }) }],
          isError: true,
        };
      }
    }

    const result = await sendDiscord(webhookUrl, args.message, args.title);

    if (result.ok && args.saveWebhook === "true") {
      upsertSetting("discord_webhook", webhookUrl);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ sent: result.ok, error: result.error, saved: args.saveWebhook === "true" }, null, 2),
        },
      ],
    };
  },
};
