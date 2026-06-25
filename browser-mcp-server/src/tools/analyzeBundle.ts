import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs } from "../browser.js";

export const analyzeBundleTool: ToolDefinition = {
  name: "analyze_bundle",
  description:
    "Analisar bundles JavaScript da página atual. Identifica scripts carregados (inline vs externo), estima tamanho via network log, detecta frameworks, e lista dependências externas.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const networkLogs = getNetworkLogs();

    const scriptInfo = await page.evaluate(() => {
      const results: Array<{ src: string; type: string; async: boolean; defer: boolean; isModule: boolean; isInline: boolean; size: number }> = [];
      for (const s of Array.from(document.scripts)) {
        results.push({
          src: s.src || "(inline)",
          type: s.type || "text/javascript",
          async: s.async,
          defer: s.defer,
          isModule: s.type === "module",
          isInline: !s.src,
          size: s.textContent?.length || 0,
        });
      }
      return results;
    });

    const jsNetwork = networkLogs.filter((r) => r.type === "script" || r.url.match(/\.(js|mjs)\b/i));
    const totalNetworkJS = jsNetwork.reduce((s, r) => s + r.transferSize, 0);
    const totalInlineSize = scriptInfo.filter((s) => s.isInline).reduce((s, i) => s + i.size, 0);

    const libraries: Array<{ name: string; found: boolean; version?: string }> = await page.evaluate(() => {
      const checks: Array<{ name: string; check: string; versionProp?: string }> = [
        { name: "React", check: "window.React", versionProp: "React.version" },
        { name: "Vue", check: "window.Vue", versionProp: "Vue.version" },
        { name: "Angular", check: "window.ng", versionProp: "" },
        { name: "jQuery", check: "window.jQuery", versionProp: "jQuery.fn.jquery" },
        { name: "Lodash", check: "window._", versionProp: "_.VERSION" },
        { name: "Moment", check: "window.moment", versionProp: "moment.version" },
        { name: "Axios", check: "window.axios", versionProp: "" },
        { name: "GSAP", check: "window.gsap", versionProp: "gsap.version" },
        { name: "D3", check: "window.d3", versionProp: "d3.version" },
        { name: "Bootstrap", check: "window.bootstrap", versionProp: "" },
        { name: "Alpine.js", check: "window.Alpine", versionProp: "Alpine.version" },
        { name: "Svelte", check: "window.__svelte", versionProp: "" },
        { name: "Next.js", check: "window.__NEXT_DATA__", versionProp: "" },
        { name: "Nuxt", check: "window.__NUXT__", versionProp: "" },
        { name: "Gatsby", check: "window.___GATSBY", versionProp: "" },
      ];
      return checks.map((c) => {
        try {
          const found = !!eval(c.check);
          let version: string | undefined;
          if (found && c.versionProp) {
            const v = eval(c.versionProp);
            if (v) version = String(v);
          }
          return { name: c.name, found, version };
        } catch { return { name: c.name, found: false }; }
      });
    });

    const foundLibs = libraries.filter((l) => l.found);

    console.error(`📦 Bundle: ${scriptInfo.length} scripts (${(totalNetworkJS / 1024).toFixed(0)}KB network + ${(totalInlineSize / 1024).toFixed(0)}KB inline), ${foundLibs.length} frameworks detected`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalScripts: scriptInfo.length,
        totalNetworkJSKB: Math.round(totalNetworkJS / 1024),
        totalInlineKB: Math.round(totalInlineSize / 1024),
        libraries: libraries,
        scripts: scriptInfo.map((s) => ({ src: s.src.length > 100 ? s.src.slice(0, 100) + "..." : s.src, type: s.type, async: s.async, defer: s.defer, isModule: s.isModule, isInline: s.isInline })),
      }, null, 2) }],
    };
  },
};
