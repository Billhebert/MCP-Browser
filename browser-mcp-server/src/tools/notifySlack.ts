import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { isSafeUrl } from "../corporate/ssrf.js";

async function sendSlack(webhookUrl: string, message: string, blocks?: Array<Record<string, unknown>>): Promise<boolean> {
  const body: Record<string, unknown> = { text: message };
  if (blocks) body.blocks = blocks;
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export const notifySlackTool: ToolDefinition = {
  name: "notify_slack",
  description:
    "Enviar notificação para Slack via webhook. Requer URL de webhook do Slack (criar em api.slack.com/apps → Incoming Webhooks). Suporte a mensagens simples e blocks formatados.",
  args: {
    webhookUrl: z.string().max(5000).describe("URL do webhook do Slack (ex: https://hooks.slack.com/services/...)"),
    message: z.string().max(5000).describe("Mensagem a enviar (formatação Markdown suportada)"),
    title: z.string().max(500).optional().describe("Título opcional para o attachment"),
    color: z.string().max(100).optional().describe("Cor da barra lateral: 'good' (verde), 'warning' (amarelo), 'danger' (vermelho)"),
  },
  async execute(args: { webhookUrl: string; message: string; title?: string; color?: string }) {
    const urlCheck = isSafeUrl(args.webhookUrl);
    if (!urlCheck.safe) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Webhook URL bloqueada: ${urlCheck.reason}` }, null, 2) }], isError: true };
    }
    const blocks: Array<Record<string, unknown>> = [
      {
        type: "section",
        text: { type: "mrkdwn", text: args.message },
      },
    ];
    if (args.title) {
      blocks.unshift({
        type: "header",
        text: { type: "plain_text", text: args.title },
      });
    }
    if (args.color) {
      const colorMap: Record<string, string> = { good: "#22c55e", warning: "#eab308", danger: "#ef4444" };
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: `BVP Browser MCP · ${new Date().toLocaleString("pt-BR")}` }],
      });
    }

    const ok = await sendSlack(args.webhookUrl, args.message, blocks);
    console.error(`🔔 Slack: ${ok ? "sent" : "failed"}`);
    return { content: [{ type: "text", text: JSON.stringify({ sent: ok }, null, 2) }] };
  },
};
