import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { chromium } from "playwright";

export const storybookScanTool: ToolDefinition = {
  name: "storybook_scan",
  description: "Conecta a uma instância Storybook, descobre todas as stories, cataloga componentes, variantes, args, e metadados. Retorna inventário completo de componentes com paths de stories.",
  args: {
    url: z.string().max(5000).describe("URL do Storybook (ex: http://localhost:6006)"),
    maxStories: z.string().max(10).optional().describe("Máximo de stories para catalogar (default: 200)"),
    detail: z.string().max(10).optional().describe("Nível de detalhe: 'basic' ou 'full' (padrão: 'basic')"),
  },
  async execute(args: { url: string; maxStories?: string; detail?: string }) {
    const sbUrl = args.url.replace(/\/$/, "");
    const maxStories = parseInt(args.maxStories || "200");
    const isFull = args.detail === "full";

    console.error(`📚 Scanning Storybook: ${sbUrl}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const stories: Array<{
      id: string;
      kind: string;
      name: string;
      parameters?: Record<string, unknown>;
    }> = [];

    try {
      await page.goto(sbUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const sbData = await page.evaluate(() => {
        const win = window as any;
        if (win.__STORYBOOK_STORY_STORE__) {
          const store = win.__STORYBOOK_STORY_STORE__;
          const all = store.extract ? store.extract() : store.raw ? store.raw() : [];
          return Array.isArray(all) ? all.slice(0, 1000) : [];
        }
        if (win.__STORYBOOK_PREVIEW__?.storyStore?.extract) {
          return win.__STORYBOOK_PREVIEW__.storyStore.extract().slice(0, 1000);
        }
        return [];
      });

      if (sbData && sbData.length > 0) {
        for (const item of sbData.slice(0, maxStories)) {
          stories.push({
            id: item.id || `${item.kind}--${item.name}`,
            kind: item.kind || "unknown",
            name: item.name || "unknown",
            parameters: isFull ? item.parameters || {} : undefined,
          });
        }
      } else {
        const navLinks = await page.evaluate(() => {
          const links: Array<{ kind: string; name: string; href: string }> = [];
          document.querySelectorAll("a[href*='path=/story/']").forEach((a) => {
            const href = a.getAttribute("href") || "";
            const match = href.match(/path=\/story\/(.+)/);
            if (match) {
              const path = match[1].replace(/^\/story\//, "");
              const parts = path.split("--");
              links.push({
                kind: parts[0]?.replace(/-/g, " ") || "unknown",
                name: parts[1]?.replace(/-/g, " ") || path,
                href,
              });
            }
          });
          return links;
        });

        for (const link of navLinks.slice(0, maxStories)) {
          stories.push({ id: link.href, kind: link.kind, name: link.name });
        }
      }

      const components = new Map<string, { component: string; variants: string[] }>();
      for (const s of stories) {
        const comp = s.kind.split("/").pop() || s.kind;
        if (!components.has(comp)) components.set(comp, { component: comp, variants: [] });
        components.get(comp)!.variants.push(s.name);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              storybookUrl: sbUrl,
              totalStories: stories.length,
              totalComponents: components.size,
              components: Array.from(components.values()).map((c) => ({
                component: c.component,
                variants: c.variants.length,
                variantNames: c.variants.slice(0, 20),
              })),
              stories: isFull ? stories : stories.map((s) => ({ id: s.id, kind: s.kind, name: s.name })),
            }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `Failed to scan Storybook: ${(err as Error).message}` }) }],
        isError: true,
      };
    } finally {
      await browser.close();
    }
  },
};
