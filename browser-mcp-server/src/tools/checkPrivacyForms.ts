import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

const PERSONAL_DATA_TYPES = [
  "name", "nome", "email", "e-mail", "phone", "telefone", "celular", "address", "endereço",
  "cpf", "rg", "document", "documento", "birth", "nascimento", "password", "senha",
  "credit", "cartão", "card", "payment", "pagamento", "cep", "zip", "cidade", "city",
  "estado", "state", "sex", "gênero", "gender", "profession", "profissão", "company", "empresa",
];

export const checkPrivacyFormsTool: ToolDefinition = {
  name: "check_privacy_forms",
  description:
    "Auditar formulários que coletam dados pessoais na página atual. Identifica campos de dados sensíveis (nome, email, CPF, RG, telefone, etc), verifica presença de política de privacidade próxima, e avalia conformidade básica com LGPD.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const result = await page.evaluate(() => {
      const forms: Array<{
        index: number;
        id: string;
        action: string;
        personalDataFields: Array<{ name: string; type: string; label: string; dataType: string }>;
        hasPrivacyCheckbox: boolean;
        hasPrivacyLink: boolean;
      }> = [];

      for (const [i, form] of Array.from(document.querySelectorAll("form")).entries()) {
        const fields: Array<{ name: string; type: string; label: string; dataType: string }> = [];
        let hasPrivacyCheckbox = false;
        let hasPrivacyLink = false;

        for (const el of Array.from(form.querySelectorAll("input, textarea, select"))) {
          const input = el as HTMLInputElement;
          const name = input.name || input.id || "";
          const type = input.type || "text";
          const labelText = form.querySelector(`label[for="${input.id}"]`)?.textContent?.trim()
            || input.closest("label")?.textContent?.trim()
            || input.placeholder || name;

          for (const pdt of ["name", "nome", "email", "e-mail", "phone", "telefone", "celular", "address",
            "endereço", "cpf", "rg", "document", "nascimento", "birth", "password", "senha",
            "credit", "cartão", "card", "payment", "pagamento"]) {
            if (name.toLowerCase().includes(pdt) || labelText.toLowerCase().includes(pdt)) {
              fields.push({ name, type, label: labelText.slice(0, 40), dataType: pdt });
              break;
            }
          }
        }

        const formHtml = form.innerHTML.toLowerCase();
        hasPrivacyCheckbox = formHtml.includes("li") && (formHtml.includes("concordo") || formHtml.includes("aceito") || formHtml.includes("agree") || formHtml.includes("accept"));
        hasPrivacyLink = formHtml.includes("privacidade") || formHtml.includes("privacy") || formHtml.includes("lgpd") || formHtml.includes("gdpr");

        if (fields.length > 0) {
          forms.push({ index: i + 1, id: form.id || form.name || `form-${i + 1}`, action: form.action || "(same page)", personalDataFields: fields, hasPrivacyCheckbox, hasPrivacyLink });
        }
      }
      return forms;
    });

    for (const form of result) {
      if (!form.hasPrivacyCheckbox && !form.hasPrivacyLink) {
        issues.push({
          type: "privacy", severity: "medium",
          message: `Formulário #${form.index} coleta dados pessoais sem checkbox de consentimento ou link de privacidade`,
          details: `Campos: ${form.personalDataFields.map((f) => f.label).join(", ")}`,
        });
      }
      const sensitiveFields = form.personalDataFields.filter((f) => ["cpf", "rg", "password", "senha", "credit", "cartão", "card"].includes(f.dataType));
      if (sensitiveFields.length > 0 && !form.action.startsWith("https://")) {
        issues.push({
          type: "privacy", severity: "high",
          message: `Formulário #${form.index} envia dados sensíveis (${sensitiveFields.map((f) => f.dataType).join(", ")}) via ${form.action.startsWith("http://") ? "HTTP" : "same page"} sem HTTPS`,
          details: `Ação: ${form.action || "mesma página"}`,
        });
      }
    }

    const totalForms = result.length;
    const totalSensitiveFields = result.reduce((s, f) => s + f.personalDataFields.length, 0);

    console.error(`🔒 Privacy: ${totalForms} forms collect personal data, ${totalSensitiveFields} fields, ${issues.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalFormsWithPersonalData: totalForms,
        totalPersonalDataFields: totalSensitiveFields,
        forms: result,
        issues,
      }, null, 2) }],
    };
  },
};
