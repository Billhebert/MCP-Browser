import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

const waitTypes = ["load", "selector", "url", "timeout"] as const;

export const waitTool: ToolDefinition = {
  name: "wait",
  description:
    "Aguardar por um estado específico da página: load (carregamento), selector (elemento aparecer), url (URL mudar) ou timeout (tempo em ms).",
  args: {
    type: z.enum(waitTypes).describe("Tipo de espera: 'load', 'selector', 'url', 'timeout'"),
    value: z
      .string()
      .optional()
      .describe(
        "Valor para a espera: seletor CSS para 'selector', URL para 'url', ms para 'timeout'. Obrigatório exceto para 'load'.",
      ),
  },
  async execute({
    type,
    value,
  }: {
    type: (typeof waitTypes)[number];
    value?: string;
  }) {
    const page = await getPage();
    console.error(`⏳ Aguardando: ${type}${value ? ` (${value})` : ""}...`);

    switch (type) {
      case "load":
        await page.waitForLoadState("networkidle");
        break;
      case "selector":
        if (!value) throw new Error("value é obrigatório para type=selector");
        await page.waitForSelector(value);
        break;
      case "url":
        if (!value) throw new Error("value é obrigatório para type=url");
        await page.waitForURL(value);
        break;
      case "timeout":
        if (!value) throw new Error("value é obrigatório para type=timeout");
        await page.waitForTimeout(Number(value));
        break;
    }

    console.error(`✅ Espera concluída: ${type}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            type,
            url: page.url(),
          }),
        },
      ],
    };
  },
};
