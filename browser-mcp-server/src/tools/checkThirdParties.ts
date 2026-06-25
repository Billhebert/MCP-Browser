import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getNetworkLogs } from "../browser.js";

const KNOWN_THIRD_PARTIES: Array<{ domain: string; category: string; name: string }> = [
  { domain: "google-analytics.com", category: "analytics", name: "Google Analytics" },
  { domain: "googletagmanager.com", category: "tag-manager", name: "Google Tag Manager" },
  { domain: "googleadservices.com", category: "ads", name: "Google Ads" },
  { domain: "doubleclick.net", category: "ads", name: "DoubleClick" },
  { domain: "facebook.com", category: "social", name: "Facebook" },
  { domain: "facebook.net", category: "social", name: "Facebook" },
  { domain: "connect.facebook.net", category: "social", name: "Facebook SDK" },
  { domain: "twitter.com", category: "social", name: "Twitter/X" },
  { domain: "twimg.com", category: "social", name: "Twitter/X" },
  { domain: "linkedin.com", category: "social", name: "LinkedIn" },
  { domain: "youtube.com", category: "video", name: "YouTube" },
  { domain: "ytimg.com", category: "video", name: "YouTube" },
  { domain: "vimeo.com", category: "video", name: "Vimeo" },
  { domain: "cdnjs.cloudflare.com", category: "cdn", name: "Cloudflare CDN" },
  { domain: "cdn.jsdelivr.net", category: "cdn", name: "jsDelivr CDN" },
  { domain: "unpkg.com", category: "cdn", name: "Unpkg CDN" },
  { domain: "fonts.googleapis.com", category: "fonts", name: "Google Fonts" },
  { domain: "fonts.gstatic.com", category: "fonts", name: "Google Fonts" },
  { domain: "hotjar.com", category: "analytics", name: "Hotjar" },
  { domain: "mouseflow.com", category: "analytics", name: "Mouseflow" },
  { domain: "fullstory.com", category: "analytics", name: "FullStory" },
  { domain: "intercom.io", category: "chat", name: "Intercom" },
  { domain: "zendesk.com", category: "chat", name: "Zendesk" },
  { domain: "hubspot.com", category: "marketing", name: "HubSpot" },
  { domain: "segment.com", category: "analytics", name: "Segment" },
  { domain: "amplitude.com", category: "analytics", name: "Amplitude" },
  { domain: "mixpanel.com", category: "analytics", name: "Mixpanel" },
  { domain: "stripe.com", category: "payment", name: "Stripe" },
  { domain: "paypal.com", category: "payment", name: "PayPal" },
  { domain: "cloudflare.com", category: "cdn", name: "Cloudflare" },
  { domain: "algolia.net", category: "search", name: "Algolia" },
  { domain: "sentry.io", category: "monitoring", name: "Sentry" },
  { domain: "datadoghq.com", category: "monitoring", name: "Datadog" },
  { domain: "newrelic.com", category: "monitoring", name: "New Relic" },
];

export const checkThirdPartiesTool: ToolDefinition = {
  name: "check_third_parties",
  description:
    "Analisar requisições de terceiros na página. Classifica por categoria (analytics, ads, social, CDN, fonts, etc), mede impacto em número de requests e bytes transferidos.",
  args: {},
  async execute() {
    const networkLogs = getNetworkLogs();
    const categories: Record<string, { count: number; totalSize: number; services: Set<string> }> = {};
    const unknown: Array<{ domain: string; url: string; size: number; type: string }> = [];

    for (const req of networkLogs) {
      if (!req.isThirdParty) continue;
      try {
        const hostname = new URL(req.url).hostname;
        const known = KNOWN_THIRD_PARTIES.find((k) => hostname.includes(k.domain));

        if (known) {
          if (!categories[known.category]) categories[known.category] = { count: 0, totalSize: 0, services: new Set() };
          categories[known.category].count++;
          categories[known.category].totalSize += req.transferSize;
          categories[known.category].services.add(known.name);
        } else {
          unknown.push({ domain: hostname, url: req.url.slice(0, 100), size: req.transferSize, type: req.type });
        }
      } catch {}
    }

    const totalThirdParty = Object.values(categories).reduce((s, c) => s + c.count, 0) + unknown.length;
    const totalSize = Object.values(categories).reduce((s, c) => s + c.totalSize, 0) + unknown.reduce((s, u) => s + u.size, 0);

    const report = Object.fromEntries(
      Object.entries(categories).map(([cat, data]) => [cat, { count: data.count, totalSizeKB: Math.round(data.totalSize / 1024), services: Array.from(data.services) }]),
    );

    console.error(`🌐 Third-parties: ${totalThirdParty} requests (${(totalSize / 1024).toFixed(0)}KB), ${Object.keys(categories).length} categories, ${unknown.length} unknown`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        totalThirdPartyRequests: totalThirdParty,
        totalSizeKB: Math.round(totalSize / 1024),
        categories: report,
        unknownDomains: unknown.slice(0, 20),
      }, null, 2) }],
    };
  },
};
