import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const testFormTool: ToolDefinition = {
  name: "test_form",
  description:
    "Auditar e testar formulários na página atual. Detecta campos obrigatórios, validação HTML5 (required, pattern, minlength, maxlength, type), estados de erro, e testa submissão sem enviar (preventDefault).",
  args: {
    action: z.string().optional().describe("Ação: 'audit' (padrão, apenas inspeciona), 'test' (tenta submeter com preventDefault)"),
  },
  async execute(args: { action?: string }) {
    const page = await getPage();
    const url = page.url();
    const action = args.action || "audit";

    const result = await page.evaluate(async (act) => {
      const forms = document.querySelectorAll("form");
      const results: Array<{
        index: number;
        id: string;
        action: string;
        method: string;
        fields: Array<{
          name: string;
          type: string;
          required: boolean;
          placeholder: string;
          maxlength: number | null;
          minlength: number | null;
          pattern: string | null;
          autocomplete: string | null;
          label: string;
        }>;
        validationErrors: Array<{ field: string; message: string }>;
        submitResult: string | null;
      }> = [];

      for (const [i, form] of Array.from(forms).entries()) {
        const fields: Array<{
          name: string; type: string; required: boolean; placeholder: string;
          maxlength: number | null; minlength: number | null;
          pattern: string | null; autocomplete: string | null; label: string;
        }> = [];
        const validationErrors: Array<{ field: string; message: string }> = [];

        for (const el of Array.from(form.querySelectorAll("input, select, textarea"))) {
          const input = el as HTMLInputElement;
          const name = input.name || input.id || "unnamed";
          const label = form.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()
            || input.closest("label")?.textContent?.trim()
            || input.placeholder || name;
          fields.push({
            name,
            type: input.type || input.tagName.toLowerCase(),
            required: input.required,
            placeholder: input.placeholder || "",
            maxlength: input.maxLength > 0 ? input.maxLength : null,
            minlength: input.minLength > 0 ? input.minLength : null,
            pattern: input.pattern || null,
            autocomplete: input.autocomplete || null,
            label,
          });

          if (input.required && !input.value.trim()) {
            validationErrors.push({ field: name, message: `Campo obrigatório "${label}" vazio` });
          }
          if (input.pattern && input.value) {
            const regex = new RegExp(input.pattern);
            if (!regex.test(input.value)) {
              validationErrors.push({ field: name, message: `Pattern "${input.pattern}" não corresponde ao valor` });
            }
          }
        }

        let submitResult: string | null = null;
        if (act === "test") {
          submitResult = await new Promise((resolve) => {
            const handler = (e: SubmitEvent) => {
              e.preventDefault();
              const valid = form.checkValidity();
              resolve(valid ? "valid (submit prevented)" : `invalid: ${form.querySelector(":invalid")?.getAttribute("name") || "unknown field"}`);
            };
            form.addEventListener("submit", handler, { once: true });
            (form.querySelector('button[type="submit"], input[type="submit"]') as HTMLElement)?.click();
            setTimeout(() => {
              if (!document.contains(form)) resolve("form removed from DOM");
            }, 1000);
          });
        }

        results.push({
          index: i + 1,
          id: form.id || form.name || `form-${i + 1}`,
          action: form.action || "(same page)",
          method: form.method || "get",
          fields,
          validationErrors,
          submitResult,
        });
      }
      return results;
    }, action);

    const totalForms = result.length;
    const totalFields = result.reduce((s, f) => s + f.fields.length, 0);
    const totalErrors = result.reduce((s, f) => s + f.validationErrors.length, 0);

    console.error(`📝 Forms: ${totalForms} forms, ${totalFields} fields, ${totalErrors} validation issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({ url, totalForms, totalFields, forms: result }, null, 2) }],
    };
  },
};
