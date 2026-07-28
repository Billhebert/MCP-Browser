import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

const KNOWN_LIBS: Record<string, { name: string; url: string; cveRisk: string }> = {
  "jquery": { name: "jQuery", url: "https://www.npmjs.com/package/jquery", cveRisk: "medium" },
  "react": { name: "React", url: "https://www.npmjs.com/package/react", cveRisk: "low" },
  "angular": { name: "Angular", url: "https://www.npmjs.com/package/@angular/core", cveRisk: "medium" },
  "vue": { name: "Vue.js", url: "https://www.npmjs.com/package/vue", cveRisk: "low" },
  "lodash": { name: "Lodash", url: "https://www.npmjs.com/package/lodash", cveRisk: "medium" },
  "moment": { name: "Moment.js", url: "https://www.npmjs.com/package/moment", cveRisk: "low" },
  "axios": { name: "Axios", url: "https://www.npmjs.com/package/axios", cveRisk: "low" },
  "bootstrap": { name: "Bootstrap", url: "https://www.npmjs.com/package/bootstrap", cveRisk: "medium" },
  "chart.js": { name: "Chart.js", url: "https://www.npmjs.com/package/chart.js", cveRisk: "low" },
  "d3": { name: "D3.js", url: "https://www.npmjs.com/package/d3", cveRisk: "low" },
  "three": { name: "Three.js", url: "https://www.npmjs.com/package/three", cveRisk: "low" },
  "socket.io": { name: "Socket.IO", url: "https://www.npmjs.com/package/socket.io", cveRisk: "medium" },
  "next": { name: "Next.js", url: "https://www.npmjs.com/package/next", cveRisk: "medium" },
  "express": { name: "Express", url: "https://www.npmjs.com/package/express", cveRisk: "medium" },
  "webpack": { name: "Webpack", url: "https://www.npmjs.com/package/webpack", cveRisk: "low" },
  "tailwindcss": { name: "Tailwind CSS", url: "https://www.npmjs.com/package/tailwindcss", cveRisk: "low" },
  "typescript": { name: "TypeScript", url: "https://www.npmjs.com/package/typescript", cveRisk: "low" },
};

function parseVersion(str: string): string | null {
  const m = str.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

function isOutdated(name: string, version: string): boolean {
  const outdated: Record<string, string> = {
    "jquery": "3.7.0",
    "react": "18.2.0",
    "angular": "17.0.0",
    "moment": "2.29.4",
    "lodash": "4.17.21",
    "bootstrap": "5.3.0",
    "axios": "1.6.0",
    "chart.js": "4.4.0",
  };
  const latest = outdated[name.toLowerCase()];
  if (!latest || !version) return false;
  try {
    const vParts = version.split(".").map(Number);
    const lParts = latest.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((vParts[i] || 0) < (lParts[i] || 0)) return true;
      if ((vParts[i] || 0) > (lParts[i] || 0)) return false;
    }
    return false;
  } catch { return false; }
}

export const scanDepsTool: ToolDefinition = {
  name: "scan_deps",
  description: "Detecta bibliotecas e frameworks JavaScript usados na página (jQuery, React, Vue, Angular, Bootstrap, Lodash, etc.), identifica versões, e verifica se estão descurrentizadas ou com CVEs conhecidos. Retorna inventário completo de dependências.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    console.error(`📦 Scanning dependencies: ${url}`);

    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll("script")).map((s) => ({
        src: (s as HTMLScriptElement).src || "",
        text: (s.textContent || "").slice(0, 1000),
        async: s.hasAttribute("async"),
        defer: s.hasAttribute("defer"),
      }))
    );

    const stylesheets = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => ({
        href: (l as HTMLLinkElement).href || "",
      }))
    );

    const allSources = [
      ...scripts.map((s) => ({ type: "script" as const, src: s.src, text: s.text })),
      ...stylesheets.map((s) => ({ type: "stylesheet" as const, src: s.href, text: "" })),
    ];

    const detected: Array<{
      library: string;
      version: string | null;
      source: string;
      type: string;
      outdated: boolean;
      risk: string;
    }> = [];

    for (const source of allSources) {
      const combined = source.src + " " + source.text;
      const lower = combined.toLowerCase();

      for (const [key, info] of Object.entries(KNOWN_LIBS)) {
        if (lower.includes(key) || lower.includes(info.name.toLowerCase())) {
          const version = parseVersion(combined);
          const outdated = version ? isOutdated(key, version) : false;
          if (!detected.some((d) => d.library === info.name && d.version === version)) {
            detected.push({
              library: info.name,
              version,
              source: source.src.slice(0, 100) || "inline",
              type: source.type,
              outdated,
              risk: outdated ? "descurrentizada" : info.cveRisk,
            });
          }
        }
      }
    }

    const riskCounts = { low: 0, medium: 0, high: 0 };
    for (const d of detected) {
      if (d.outdated) riskCounts.high++;
      else if (d.risk === "medium") riskCounts.medium++;
      else riskCounts.low++;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            totalScripts: scripts.length,
            totalStylesheets: stylesheets.length,
            totalDeps: detected.length,
            detected,
            riskSummary: riskCounts,
            recommendations: detected
              .filter((d) => d.outdated)
              .map((d) => `${d.library} ${d.version || "desconhecida"} está descurrentizada`)
              .concat(
                detected.length === 0 ? [] : [`Total de ${detected.length} dependências detectadas`]
              ),
          }, null, 2),
        },
      ],
    };
  },
};
