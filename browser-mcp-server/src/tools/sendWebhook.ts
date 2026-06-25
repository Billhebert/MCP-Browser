import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { sendWebhook, loadWebhooks } from "../corporate/webhook.js";

export const sendWebhookTool: ToolDefinition = {
  name: "send_webhook",
  description:
    "Enviar notificação via webhook corporativo. Configurar webhooks via env var BVP_WEBHOOKS como JSON array: [{\"url\":\"https://hooks.slack.com/...\",\"events\":[\"audit_complete\",\"*\"],\"headers\":{\"Authorization\":\"Bearer ...\"}}]. Events comuns: audit_complete, error, schedule_tick.",
  args: {
    event: z.string().describe("Nome do evento: 'audit_complete', 'error', 'custom'"),
    payload: z.string().describe("JSON string com payload a enviar"),
  },
  async execute(args: { event: string; payload: string }) {
    loadWebhooks();
    const payload = JSON.parse(args.payload) as Record<string, unknown>;
    sendWebhook(args.event, payload);
    console.error(`🔔 Webhook sent: ${args.event}`);
    return { content: [{ type: "text", text: JSON.stringify({ sent: true, event: args.event }, null, 2) }] };
  },
};
