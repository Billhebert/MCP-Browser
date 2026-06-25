import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const findTool: ToolDefinition = {
  name: "find",
  description:
    "Buscar elementos na página por texto, role, placeholder, label ou CSS. Retorna uma lista de seletores CSS que você pode usar em click/fill/get_text.",
  args: {
    text: z
      .string()
      .optional()
      .describe("Texto visível do elemento (ex: 'Kanban', 'Enviar')"),
    role: z
      .string()
      .optional()
      .describe("Role ARIA (ex: 'button', 'link', 'textbox', 'heading')"),
    placeholder: z
      .string()
      .optional()
      .describe("Placeholder do input (ex: 'Buscar...', 'Email')"),
    label: z
      .string()
      .optional()
      .describe("Label associado ao campo (ex: 'Nome', 'Senha')"),
    tag: z
      .string()
      .optional()
      .describe("Tag HTML (ex: 'button', 'a', 'input', 'select')"),
    css: z
      .string()
      .optional()
      .describe("Seletor CSS direto para verificar se existe"),
  },
  async execute(args: {
    text?: string;
    role?: string;
    placeholder?: string;
    label?: string;
    tag?: string;
    css?: string;
  }) {
    const page = await getPage();
    console.error(`🔎 Buscando elementos na página...`);

    let selectors: string[] = [];

    if (args.css) {
      const count = await page.locator(args.css).count();
      if (count > 0) {
        selectors.push(args.css);
      }
    }

    if (args.text) {
      const textSelector = `text=${args.text}`;
      const count = await page.locator(textSelector).count();
      if (count > 0) {
        selectors.push(textSelector);
      }
      const hasTextSelector = `:has-text("${args.text}")`;
      const count2 = await page.locator(hasTextSelector).count();
      if (count2 > 0) {
        selectors.push(hasTextSelector);
      }
    }

    if (args.role) {
      const roleSelector = `[role="${args.role}"]`;
      const count = await page.locator(roleSelector).count();
      if (count > 0) {
        selectors.push(roleSelector);
      }
    }

    if (args.placeholder) {
      const placeholderSelector = `[placeholder="${args.placeholder}"]`;
      const count = await page.locator(placeholderSelector).count();
      if (count > 0) {
        selectors.push(placeholderSelector);
      }
    }

    if (args.label) {
      const labelSelector = `[aria-label="${args.label}"]`;
      const count = await page.locator(labelSelector).count();
      if (count > 0) {
        selectors.push(labelSelector);
      }
    }

    if (args.tag) {
      const count = await page.locator(args.tag).count();
      if (count > 0) {
        selectors.push(args.tag);
      }
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
        samples.push(
          `<${tagName}${id ? ` id="${id}"` : ""}${cls ? ` class="${cls.split(" ").slice(0, 2).join(" ")}"` : ""}>${text ? ` "${text}"` : ""}`,
        );
      }
      results.push({ selector: sel, count, samples });
    }

    if (results.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Nenhum elemento encontrado com os critérios fornecidos.",
          },
        ],
      };
    }

    const text = results
      .map(
        (r) =>
          `Selector: ${r.selector}\n  Encontrados: ${r.count}\n  Exemplo: ${r.samples.join(", ")}`,
      )
      .join("\n\n");

    console.error(`✅ Encontrados ${results.length} tipos de seletores`);
    return { content: [{ type: "text", text }] };
  },
};
