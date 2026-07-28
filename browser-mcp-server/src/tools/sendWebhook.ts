import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { sendWebhook, loadWebhooks } from "../corporate/webhook.js";

export const sendWebhookTool: ToolDefinition = {
  name: "send_webhook",
  description: "Send a webhook to configured URLs with custom payload and event filtering.",
  args: {
    event: z.string().max(100).describe("Event name: 'audit_complete', 'error', 'custom'"),
    payload: z.string().max(50000).describe("JSON string with payload to send"),
  },
  async execute(args: { event: string; payload: string }) {
    loadWebhooks();
    const payload = JSON.parse(args.payload) as Record<string, unknown>;
    sendWebhook(args.event, payload);
    console.error(`🔔 Webhook sent: ${args.event}`);
    return { content: [{ type: "text", text: JSON.stringify({ sent: true, event: args.event }, null, 2) }] };
  },
};
