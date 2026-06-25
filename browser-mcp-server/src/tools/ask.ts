import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const askTool: ToolDefinition = {
  name: "ask",
  description:
    "EXIBE UMA MENSAGEM PARA O USUÁRIO E AGUARDA RESPOSTA. Use esta tool para perguntar qualquer coisa ao usuário antes de prosseguir. É OBRIGATÓRIO usar depois de cada navegação e antes de cada ação destrutiva.",
  args: {
    question: z.string().describe("Pergunta clara sobre o que precisa saber ou confirmar"),
    context: z
      .string()
      .optional()
      .describe("Contexto opcional: URL atual, título, resumo do que encontrou na página"),
  },
  async execute({ question, context }: { question: string; context?: string }) {
    const page = await getPage();
    const title = await page.title().catch(() => "?");
    const url = page.url();

    const prefix = context
      ? `📍 ${title} — ${url}\n📋 ${context}\n\n❓ ${question}`
      : `📍 ${title} — ${url}\n\n❓ ${question}`;

    console.error(`❓ Aguardando resposta do usuário...`);
    console.error(`❓ ${prefix}`);

    return {
      content: [
        {
          type: "text",
          text: prefix,
        },
      ],
    };
  },
};
