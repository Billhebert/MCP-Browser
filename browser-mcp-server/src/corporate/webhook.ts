const WEBHOOKS: Array<{ url: string; events: string[] }> = [];

export function loadWebhooks(): void {
  const raw = process.env.BVP_WEBHOOKS;
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as Array<{ url: string; events: string[] }>;
    WEBHOOKS.length = 0;
    WEBHOOKS.push(...parsed);
  } catch (e) {
    console.error(`[Webhooks] Invalid BVP_WEBHOOKS: ${(e as Error).message}`);
  }
}

export function sendWebhook(event: string, payload: Record<string, unknown>): void {
  const targets = WEBHOOKS.filter((w) => w.events.includes("*") || w.events.includes(event));
  for (const t of targets) {
    fetch(t.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ...payload, timestamp: new Date().toISOString() }),
    }).catch((e) => console.error(`[Webhook] Failed ${t.url}: ${(e as Error).message}`));
  }
}
