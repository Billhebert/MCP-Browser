import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const getFormFieldsTool: ToolDefinition = {
  name: "get_form_fields",
  description:
    "Listar todos os campos de formulário na página (input, select, textarea, button) com seus seletores, tipos, labels e valores atuais.",
  args: {
    includeHidden: z
      .boolean()
      .optional()
      .describe("Se true, inclui campos ocultos (type=hidden)"),
  },
  async execute({ includeHidden }: { includeHidden?: boolean }) {
    const page = await getPage();
    console.error(`📋 Listando campos do formulário...`);

    const fields = await page.evaluate(
      ({ includeHidden }: { includeHidden?: boolean }) => {
        const results: Array<{
          tag: string;
          type: string;
          name: string;
          id: string;
          placeholder: string;
          label: string;
          value: string;
          selector: string;
          visible: boolean;
        }> = [];

        document.querySelectorAll("input, select, textarea, button").forEach((el) => {
          const input = el as HTMLInputElement;
          if (input.type === "hidden" && !includeHidden) return;

          let label = "";
          const id = input.id;
          if (id) {
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) label = lbl.textContent?.trim() || "";
          }
          if (!label && input.closest("label")) {
            label = input.closest("label")!.textContent?.trim() || "";
          }
          if (!label) {
            const aria = input.getAttribute("aria-label");
            if (aria) label = aria;
          }

          const rect = input.getBoundingClientRect();
          const visible = rect.width > 0 && rect.height > 0;

          const selector = [
            input.tagName.toLowerCase(),
            input.id ? `#${input.id}` : "",
            input.name ? `[name="${input.name}"]` : "",
            input.type && input.type !== "text" ? `[type="${input.type}"]` : "",
          ]
            .filter(Boolean)
            .join("");

          results.push({
            tag: input.tagName.toLowerCase(),
            type: input.type || "",
            name: input.name || "",
            id: input.id || "",
            placeholder: input.placeholder || "",
            label,
            value: input.value?.slice(0, 50) || "",
            selector,
            visible,
          });
        });

        return results;
      },
      { includeHidden: !!includeHidden },
    );

    if (fields.length === 0) {
      return {
        content: [{ type: "text", text: "Nenhum campo de formulário encontrado na página." }],
      };
    }

    const text = fields
      .map(
        (f) =>
          `${f.visible ? "" : "(oculto) "}[${f.tag}${f.type ? ` type="${f.type}"` : ""}] ` +
          `${f.label ? `"${f.label}"` : ""}${f.placeholder ? ` placeholder="${f.placeholder}"` : ""}` +
          `${f.id ? ` #${f.id}` : ""}${f.name ? ` name="${f.name}"` : ""}` +
          `${f.value ? ` = "${f.value}"` : ""}` +
          `\n  → ${f.selector}`,
      )
      .join("\n\n");

    console.error(`✅ Encontrados ${fields.length} campos`);
    return { content: [{ type: "text", text }] };
  },
};
