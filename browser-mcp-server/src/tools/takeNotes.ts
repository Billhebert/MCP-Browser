import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { addAnnotation, getAnnotations, listAnnotationKeys } from "../corporate/collab.js";

export const takeNotesTool: ToolDefinition = {
  name: "take_notes",
  description:
    "Adicionar anotações e comentários a issues de auditoria. Útil para workflow corporativo: QA anota issue, dev responde, lead aprova. Suporta adicionar, listar por issue, e listar todos os issues com anotações.",
  args: {
    action: z.string().describe("Ação: 'add' (adicionar nota), 'get' (ver notas de um issue), 'list' (listar todos issues com notas)"),
    issueKey: z.string().optional().describe("Chave única do issue (ex: 'seo-001', 'contrast-header'). Use type + número ou descrição curta."),
    author: z.string().optional().describe("Nome de quem está anotando (obrigatório para add)"),
    text: z.string().optional().describe("Texto da anotação (obrigatório para add)"),
  },
  async execute(args: { action: string; issueKey?: string; author?: string; text?: string }) {
    switch (args.action) {
      case "add": {
        if (!args.issueKey || !args.author || !args.text) {
          return { content: [{ type: "text", text: JSON.stringify({ error: "issueKey, author, and text required for add" }, null, 2) }] };
        }
        addAnnotation(args.issueKey, args.author, args.text);
        const notes = getAnnotations(args.issueKey);
        console.error(`📝 Note added to ${args.issueKey} by ${args.author}`);
        return { content: [{ type: "text", text: JSON.stringify({ added: true, issueKey: args.issueKey, totalNotes: notes.length }, null, 2) }] };
      }
      case "get": {
        if (!args.issueKey) return { content: [{ type: "text", text: JSON.stringify({ error: "issueKey required for get" }, null, 2) }] };
        const notes = getAnnotations(args.issueKey);
        return { content: [{ type: "text", text: JSON.stringify({ issueKey: args.issueKey, notes }, null, 2) }] };
      }
      case "list": {
        const keys = listAnnotationKeys();
        return { content: [{ type: "text", text: JSON.stringify({ totalIssuesWithNotes: keys.length, issueKeys: keys }, null, 2) }] };
      }
      default:
        return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown action: ${args.action}. Use add, get, list` }, null, 2) }] };
    }
  },
};
