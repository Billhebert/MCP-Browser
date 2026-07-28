import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const frontComponentsTool: ToolDefinition = {
  name: "front_components",
  description: "Descobre e analisa componentes de frontend na página. Detecta: React (root, __REACT_DEVTOOLS_GLOBAL_HOOK__, data-reactroot), Vue (__VUE__, data-v-), Angular (ng-* attributes), Web Components (custom elements). Retorna inventário de componentes, props, e árvore de componentes.",
  args: {
    detail: z.string().max(10).optional().describe("Nível de detalhe: 'basic', 'full' (padrão: 'basic'). full tenta extract props e estado."),
  },
  async execute(args: { detail?: string }) {
    const page = await getPage();
    const url = page.url();
    const detail = args.detail || "basic";
    console.error(`🔍 Scanning frontend components: ${url}`);

    const frameworkData = await page.evaluate(() => {
      const result: { framework: string; detected: boolean; version?: string; details: string[] }[] = [];

      const hasReact = !!(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      const reactRoots = document.querySelectorAll('[data-reactroot], [id="root"], [id="__next"]');
      result.push({
        framework: "React",
        detected: hasReact || reactRoots.length > 0,
        version: (window as any).React?.version || undefined,
        details: hasReact ? ["React devtools hook detected"] : reactRoots.length > 0 ? [`${reactRoots.length} React root(s)`] : [],
      });

      const hasVue = !!(window as any).__VUE__;
      const vueEls = document.querySelectorAll('[data-v-]');
      result.push({
        framework: "Vue.js",
        detected: hasVue || vueEls.length > 0,
        version: (window as any).__VUE__?.version || undefined,
        details: hasVue ? ["Vue devtools detected"] : vueEls.length > 0 ? [`${vueEls.length} elements com data-v-`] : [],
      });

      const ngEls = document.querySelectorAll('[ng-version], [ng-app], [ng-controller], .ng-scope');
      const ngVersion = document.querySelector('[ng-version]')?.getAttribute("ng-version") || undefined;
      result.push({
        framework: "Angular",
        detected: ngEls.length > 0,
        version: ngVersion,
        details: ngEls.length > 0 ? [`${ngEls.length} elements Angular`] : [],
      });

      const customElements = Array.from(document.querySelectorAll("*")).filter((el) => el.tagName.includes("-"));
      result.push({
        framework: "Web Components",
        detected: customElements.length > 0,
        details: customElements.length > 0 ? [`${customElements.length} custom elements: ${[...new Set(customElements.map((e) => e.tagName.toLowerCase()))].slice(0, 20).join(", ")}`] : [],
      });

      const svelteEls = document.querySelectorAll("[svelte-h]");
      result.push({
        framework: "Svelte",
        detected: svelteEls.length > 0,
        details: svelteEls.length > 0 ? [`${svelteEls.length} elements Svelte`] : [],
      });

      return result;
    });

    const components: Array<{ tag: string; id?: string; classes: string[]; children: number; attributes: Record<string, string> }> = await page.evaluate((isFull) => {
      const items: Array<{ tag: string; id?: string; classes: string[]; children: number; attributes: Record<string, string> }> = [];
      const maxItems = isFull ? 200 : 50;

      const all = document.querySelectorAll("body *");
      for (const el of Array.from(all)) {
        if (items.length >= maxItems) break;
        const tag = el.tagName.toLowerCase();
        if (tag === "script" || tag === "style" || tag === "noscript") continue;

        const attrs: Record<string, string> = {};
        for (let ai = 0; ai < el.attributes.length; ai++) {
          const attr = el.attributes[ai];
          if (attr.name.startsWith("data-") || attr.name.startsWith("ng-") || attr.name === "class" || attr.name === "id") continue;
          if (attr.name === "style" || attr.name === "onclick") continue;
          if (attr.value && attr.value.length < 100) attrs[attr.name] = attr.value;
        }

        if (tag.includes("-") || attrs["data-reactroot"] !== undefined || el.hasAttribute("ng-version") || attrs["v-bind"] !== undefined) {
          items.push({
            tag,
            id: el.getAttribute("id") || undefined,
            classes: Array.from(el.classList).filter((c) => c.startsWith("_") || c.includes("-") || c.startsWith("ng-")),
            children: el.children.length,
            attributes: attrs,
          });
        }
      }
      return items;
    }, detail === "full");

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            url,
            frameworks: frameworkData,
            totalComponents: components.length,
            components: detail === "full" ? components : components.map((c) => ({ tag: c.tag, id: c.id, children: c.children })),
            componentBreakdown: Object.entries(
              components.reduce((acc, c) => {
                acc[c.tag] = (acc[c.tag] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag, count]) => ({ tag, count })),
          }, null, 2),
        },
      ],
    };
  },
};
