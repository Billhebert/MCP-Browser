import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";

export const askTool: ToolDefinition = {
  name: "ask",
  description: "Display a question to the user and wait for response.",
  args: {
    question: z.string().max(5000).describe("Pergunta clara about o que precisa saber ou confirmar"),
    context: z
      .string().max(5000)
      .optional()
      .describe("Contexto optional: URL current, título, resumo do que encontrou na page"),
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
