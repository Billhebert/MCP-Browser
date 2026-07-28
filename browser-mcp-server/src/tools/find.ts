import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const findTool: ToolDefinition = {
  name: "find",
  description: "Find elements matching CSS selector. Returns count and preview.",
  args: {
    text: z
      .string().max(5000)
      .optional()
      .describe("Texto visível do element (ex: 'Kanban', 'Enviar')"),
    role: z
      .string().max(5000)
      .optional()
      .describe("Role ARIA (ex: 'button', 'link', 'textbox', 'heading')"),
    placeholder: z
      .string().max(5000)
      .optional()
      .describe("Placeholder do input (ex: 'Buscar...', 'Email')"),
    label: z
      .string().max(5000)
      .optional()
      .describe("Label associado ao campo (ex: 'Name', 'Senha')"),
    testId: z
      .string().max(5000)
      .optional()
      .describe("Valor do atributo data-testid (ex: 'submit-btn', 'board-card')"),
    tag: z
      .string().max(5000)
      .optional()
      .describe("Tag HTML (ex: 'button', 'a', 'input', 'select')"),
    css: z
      .string().max(5000)
      .optional()
      .describe("CSS selector direto para verificar se existe"),
  },
  async execute(args: {
    text?: string;
    role?: string;
    placeholder?: string;
    label?: string;
    testId?: string;
    tag?: string;
    css?: string;
  }) {
    const page = await getPage();
    console.error(`🔎 Buscando elements na página...`);

    const selectors: string[] = [];
    const visited = new Set<string>();

    function add(s: string) {
      if (!visited.has(s)) { visited.add(s); selectors.push(s); }
    }

    if (args.css) {
      const count = await page.locator(args.css).count();
      if (count > 0) add(args.css);
    }

    if (args.text) {
      // Playwright text selectors (may fail with Unicode)
      add(`text=${args.text}`);
      add(`text="${args.text}"`);
      add(`:has-text("${args.text}")`);

      // XPath-based text search (handles accents, Unicode, normalized whitespace)
      try {
        const escaped = args.text.replace(/'/g, "&apos;");
        add(`xpath=//*[contains(text(), '${escaped}')]`);
        add(`xpath=//*[contains(normalize-space(.), '${escaped}')]`);
        // Case-insensitive XPath
        const upper = args.text.toUpperCase();
        const lower = args.text.toLowerCase();
        add(`xpath=//*[contains(translate(text(), '${upper}', '${lower}'), '${lower}')]`);
      } catch {}
    }

    if (args.role) {
      add(`[role="${args.role}"]`);
      add(`${args.tag || '*'}[role="${args.role}"]`);
    }

    if (args.placeholder) {
      add(`[placeholder="${args.placeholder}"]`);
      add(`[placeholder*="${args.placeholder}"]`);
      add(`${args.tag || 'input'}[placeholder="${args.placeholder}"]`);

      // Case-insensitive placeholder via XPath
      try {
        const escaped = args.placeholder.replace(/'/g, "&apos;");
        add(`xpath=//${args.tag || 'input'}[contains(@placeholder, '${escaped}')]`);
      } catch {}
    }

    if (args.label) {
      add(`[aria-label="${args.label}"]`);
      add(`[aria-label*="${args.label}"]`);
      // Find label by text content and get its 'for' attribute
      try {
        const labelFor = await page.evaluate((labelText) => {
          const labels = Array.from(document.querySelectorAll('label'));
          const label = labels.find(l => l.textContent?.trim() === labelText)
            || labels.find(l => l.textContent?.trim().toLowerCase() === labelText.toLowerCase())
            || labels.find(l => l.textContent?.includes(labelText));
          if (label?.htmlFor) return `#${CSS.escape(label.htmlFor)}`;
          // Check if label wraps an input
          const input = label?.querySelector('input, select, textarea');
          if (input?.id) return `#${CSS.escape(input.id)}`;
          return null;
        }, args.label);
        if (labelFor) add(labelFor);
      } catch {}
    }

    if (args.testId) {
      add(`[data-testid="${args.testId}"]`);
      add(`[data-testid*="${args.testId}"]`);
    }

    if (args.tag) {
      const count = await page.locator(args.tag).count();
      if (count > 0) add(args.tag);
    }

    const results: Array<{
      selector: string;
      count: number;
      samples: string[];
    }> = [];

    for (const sel of [...new Set(selectors)]) {
      const count = await page.locator(sel).count();
      const samples: string[] = [];
      if (count > 0) {
        const el = page.locator(sel).first();
        const tagName = await el.evaluate((el) => (el as HTMLElement).tagName?.toLowerCase() || "");
        const text = (await el.textContent())?.trim().slice(0, 80) || "";
        const id = await el.getAttribute("id");
        const cls = await el.getAttribute("class");
        const aria = await el.getAttribute("aria-label");
        const testid = await el.getAttribute("data-testid");
        const parts = [`<${tagName}`];
        if (id) parts.push(` id="${id}"`);
        if (cls) parts.push(` class="${cls.split(" ").slice(0, 2).join(" ")}"`);
        if (aria) parts.push(` aria="${aria.slice(0, 40)}"`);
        if (testid) parts.push(` testid="${testid}"`);
        parts.push(`>`);
        if (text) parts.push(` "${text}"`);
        samples.push(parts.join(""));
      }
      results.push({ selector: sel, count, samples });
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Nenhum element encontrado com os critérios fornecidos.",
          },
        ],
      };
    }

    const text = results
      .map(
        (r) =>
          `Selector: ${r.selector}\n  Found: ${r.count}\n  Exemplo: ${r.samples.join(", ")}`,
      )
      .join("\n\n");

    console.error(`✅ Found ${results.length} tipos de seletores`);
    return { content: [{ type: "text", text }] };
  },
};
