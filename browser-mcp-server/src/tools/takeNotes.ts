import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { addAnnotation, getAnnotations, listAnnotationKeys } from "../corporate/collab.js";

export const takeNotesTool: ToolDefinition = {
  name: "take_notes",
  description: "Add collaboration notes to the session.",
  args: {
    action: z.string().max(100).describe("Ação: 'add' (add nota), 'get' (ver notas de um issue), 'list' (list todos issues com notas)"),
    issueKey: z.string().max(500).optional().describe("Chave única do issue (ex: 'seo-001', 'contrast-header'). Use type + número ou descrição curta."),
    author: z.string().max(500).optional().describe("Name de quem está anotando (obrigatório para add)"),
    text: z.string().max(5000).optional().describe("Texto da anotaction (obrigatório para add)"),
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
