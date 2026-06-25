import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const analyzeDepsTool: ToolDefinition = {
  name: "analyze_deps",
  description:
    "Detectar bibliotecas e frameworks JavaScript carregados na página. Varre window globals, scripts carregados, e identifica versões de React, Vue, Angular, jQuery, Lodash, e outras 20+ libs.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();

    const result = await page.evaluate(() => {
      const checks: Array<{
        name: string; category: string; check: string; versionExp?: string; global?: string;
      }> = [
        { name: "React", category: "framework", check: "!!(window.React || window.__REACT_DEVTOOLS_GLOBAL_HOOK__)", versionExp: "window.React?.version", global: "React" },
        { name: "Vue", category: "framework", check: "!!(window.Vue || window.__VUE_DEVTOOLS_GLOBAL_HOOK__)", versionExp: "window.Vue?.version", global: "Vue" },
        { name: "Angular", category: "framework", check: "!!(window.ng || document.querySelector('[ng-version]'))", versionExp: "document.querySelector('[ng-version]')?.getAttribute('ng-version')", global: "ng" },
        { name: "Svelte", category: "framework", check: "!!(window.__svelte || document.querySelector('[svelte]'))", versionExp: "", global: "__svelte" },
        { name: "Next.js", category: "framework", check: "!!window.__NEXT_DATA__", versionExp: "", global: "__NEXT_DATA__" },
        { name: "Nuxt", category: "framework", check: "!!window.__NUXT__", versionExp: "", global: "__NUXT__" },
        { name: "Gatsby", category: "framework", check: "!!window.___GATSBY", versionExp: "", global: "___GATSBY" },
        { name: "jQuery", category: "utility", check: "!!window.jQuery", versionExp: "window.jQuery?.fn?.jquery", global: "jQuery" },
        { name: "Lodash", category: "utility", check: "!!window._", versionExp: "window._?.VERSION", global: "_" },
        { name: "Moment.js", category: "date", check: "!!window.moment", versionExp: "window.moment?.version", global: "moment" },
        { name: "Day.js", category: "date", check: "!!window.dayjs", versionExp: "window.dayjs?.version", global: "dayjs" },
        { name: "Axios", category: "http", check: "!!window.axios", versionExp: "", global: "axios" },
        { name: "D3", category: "visualization", check: "!!window.d3", versionExp: "window.d3?.version", global: "d3" },
        { name: "Chart.js", category: "visualization", check: "!!window.Chart", versionExp: "window.Chart?.version", global: "Chart" },
        { name: "GSAP", category: "animation", check: "!!window.gsap", versionExp: "window.gsap?.version", global: "gsap" },
        { name: "Three.js", category: "3d", check: "!!window.THREE", versionExp: "window.THREE?.REVISION", global: "THREE" },
        { name: "Bootstrap", category: "css", check: "!!window.bootstrap", versionExp: "", global: "bootstrap" },
        { name: "Tailwind CSS", category: "css", check: "!!document.querySelector('[class*=\\'grid\\']')", versionExp: "", global: "" },
        { name: "Alpine.js", category: "framework", check: "!!window.Alpine", versionExp: "window.Alpine?.version", global: "Alpine" },
        { name: "Turbo/Stimulus", category: "framework", check: "!!window.Turbo || !!window.Stimulus", versionExp: "", global: "Turbo/Stimulus" },
        { name: "htmx", category: "framework", check: "!!window.htmx", versionExp: "window.htmx?.version", global: "htmx" },
        { name: "Mapbox GL", category: "maps", check: "!!window.mapboxgl", versionExp: "window.mapboxgl?.version", global: "mapboxgl" },
        { name: "Leaflet", category: "maps", check: "!!window.L", versionExp: "window.L?.version", global: "L" },
        { name: "Google Maps", category: "maps", check: "!!window.google?.maps", versionExp: "", global: "google.maps" },
        { name: "Stripe", category: "payment", check: "!!window.Stripe", versionExp: "", global: "Stripe" },
        { name: "Sentry", category: "monitoring", check: "!!window.Sentry", versionExp: "window.Sentry?.VERSION", global: "Sentry" },
        { name: "New Relic", category: "monitoring", check: "!!window.NREUM", versionExp: "", global: "NREUM" },
        { name: "Google Analytics", category: "analytics", check: "!!window.ga || !!window.gtag", versionExp: "", global: "ga/gtag" },
      ];

      return checks.map((c) => {
        try {
          const detected = !!eval(c.check);
          let version: string | undefined;
          if (detected && c.versionExp) { try { const v = eval(c.versionExp); if (v) version = String(v); } catch {} }
          return { name: c.name, category: c.category, detected, version };
        } catch {
          return { name: c.name, category: c.category, detected: false };
        }
      });
    });

    const detected = result.filter((d) => d.detected);
    const categories = [...new Set(detected.map((d) => d.category))];

    console.error(`📦 Dependencies: ${detected.length} libs detected in ${categories.length} categories`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalLibsDetected: detected.length,
        categories,
        libraries: detected,
        allChecked: result.length,
      }, null, 2) }],
    };
  },
};
