import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const analyzeStateTool: ToolDefinition = {
  name: "analyze_state",
  description:
    "Inspecionar estado interno de aplicações frontend (React, Vue, Angular). Tenta acessar devtools hooks, __NEXT_DATA__, __NUXT__, Vue reativity, e expõe dados serializados do componente raiz.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();

    const result = await page.evaluate(() => {
      const data: Record<string, unknown> = {};

      // React
      try {
        const hook = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (hook) {
          const fibers = hook.renderers;
          data.react = { renderers: (fibers as any).size || (fibers as any).length || "present" };
          // Try to get root fiber
          const rootEl = document.getElementById("root") || document.querySelector("[data-reactroot]");
          if (rootEl) {
            const key = Object.keys(rootEl).find((k) => k.startsWith("__reactFiber$"));
            if (key) (data.react as any).fiberAttached = true;
          }
        }
      } catch { data.react = null; }

      // Next.js
      const nextData = (window as any).__NEXT_DATA__;
      if (nextData) {
        data.nextJs = {
          page: nextData.page,
          buildId: nextData.buildId,
          isFallback: nextData.isFallback,
          hasProps: !!nextData.props?.pageProps,
          gsp: nextData.gsp,
          gssp: nextData.gssp,
        };
      }

      // Nuxt
      const nuxt = (window as any).__NUXT__;
      if (nuxt) {
        data.nuxt = {
          hasData: !!nuxt.data,
          hasState: !!nuxt.state,
          route: nuxt.route,
        };
      }

      // Vue
      try {
        const vueHook = (window as any).__VUE_DEVTOOLS_GLOBAL_HOOK__;
        if (vueHook) {
          data.vue = { connected: vueHook.Vue?.version || "detected" };
        }
      } catch { data.vue = null; }

      // Redux
      try {
        if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
          data.redux = true;
        }
      } catch {}

      // Vuex / Pinia
      try {
        const appEl = document.querySelector("#app, [data-v-app]");
        if (appEl) {
          const vueApp = (appEl as any).__vue_app__;
          if (vueApp) {
            data.vueApp = { version: vueApp.version, hasPinia: !!vueApp.config?.globalProperties?.$pinia };
          }
        }
      } catch {}

      // Angular
      const ngEl = document.querySelector("[ng-version]");
      if (ngEl) {
        data.angular = { version: ngEl.getAttribute("ng-version") };
      }

      // localStorage state
      try {
        const ls: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) ls[key] = localStorage.getItem(key)?.slice(0, 100) || "";
        }
        if (Object.keys(ls).length > 0) data.localStorage = ls;
      } catch {}

      // sessionStorage state
      try {
        const ss: Record<string, string> = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) ss[key] = sessionStorage.getItem(key)?.slice(0, 100) || "";
        }
        if (Object.keys(ss).length > 0) data.sessionStorage = ss;
      } catch {}

      return data;
    });

    // Sanitize: remove values, keep structure
    const frameworks = Object.entries(result)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k]) => k);

    console.error(`🔬 State: frameworks detected: ${frameworks.join(", ") || "none"}`);
    return {
      content: [{ type: "text", text: JSON.stringify({ url, frameworks, state: result }, null, 2) }],
    };
  },
};
