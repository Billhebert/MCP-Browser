import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

const FUZZ_VALUES: Array<{ label: string; value: string }> = [
  { label: "empty", value: "" },
  { label: "xss_basic", value: "<script>alert(1)</script>" },
  { label: "xss_attr", value: "\" onfocus=\"alert(1)\" autofocus=\"true\"" },
  { label: "sql_injection", value: "' OR '1'='1" },
  { label: "long_string", value: "A".repeat(10000) },
  { label: "special_chars", value: "!@#$%^&*()_+-=[]{}|;':\",./<>?" },
  { label: "unicode", value: "汉字日本語한글αβγäöüñ" },
  { label: "js_url", value: "javascript:alert(1)" },
  { label: "null_byte", value: "\x00null" },
  { label: "whitespace", value: "   \t\n  " },
];

export const fuzzFormTool: ToolDefinition = {
  name: "fuzz_form",
  description:
    "Testar formulários com valores extremos (XSS, SQL injection, strings longas, caracteres especiais, unicode, etc). Preenche cada campo com cada valor, verifica se a página quebra ou mostra erros. Não submete formulários.",
  args: {
    formSelector: z.string().optional().describe("Seletor CSS do formulário a testar (padrão: primeiro form da página)"),
  },
  async execute(args: { formSelector?: string }) {
    const page = await getPage();
    const url = page.url();
    const selector = args.formSelector || "form";

    const formExists = await page.locator(selector).count();
    if (formExists === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ url, error: `No form found with selector "${selector}"` }, null, 2) }] };
    }

    const errors: Array<{
      fieldName: string;
      fieldType: string;
      fuzzLabel: string;
      fuzzValue: string;
      error: string;
    }> = [];

    const fields = await page.evaluate((sel) => {
      const form = document.querySelector(sel) as HTMLFormElement;
      if (!form) return [];
      return Array.from(form.querySelectorAll("input, textarea")).map((el) => {
        const input = el as HTMLInputElement;
        let label = "";
        const lbl = form.querySelector(`label[for="${input.id}"]`);
        if (lbl) label = lbl.textContent?.trim() || "";
        if (!label && input.placeholder) label = input.placeholder;
        if (!label) label = input.name || input.id || "unnamed";
        return { name: input.name || input.id || "unnamed", type: input.type || "text", label };
      });
    }, selector);

    for (const field of fields) {
      if (field.type === "hidden" || field.type === "submit" || field.type === "button" || field.type === "file") continue;
      for (const fuzz of FUZZ_VALUES) {
        try {
          await page.fill(`${selector} [name="${field.name}"], ${selector} #${field.name}`, fuzz.value);
          const pageError = await page.evaluate(() => {
            const el = document.querySelector(":invalid") as HTMLElement | null;
            return el ? el.getAttribute("validationMessage") || "invalid" : null;
          });
          if (pageError && fuzz.label !== "empty") {
            errors.push({ fieldName: field.label, fieldType: field.type, fuzzLabel: fuzz.label, fuzzValue: fuzz.value.slice(0, 30), error: pageError });
          }
        } catch (err) {
          errors.push({ fieldName: field.label, fieldType: field.type, fuzzLabel: fuzz.label, fuzzValue: fuzz.value.slice(0, 30), error: (err as Error).message.slice(0, 100) });
        }
      }
    }

    console.error(`🧪 Fuzz: ${fields.length} fields × ${FUZZ_VALUES.length} values = ${errors.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({ url, fieldsTested: fields.length, fuzzValues: FUZZ_VALUES.length, issues: errors.length, results: errors.slice(0, 50) }, null, 2) }],
    };
  },
};
