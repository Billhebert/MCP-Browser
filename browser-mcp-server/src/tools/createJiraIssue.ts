import { z } from "zod";
import type { ToolDefinition } from "../index.js";

export const createJiraIssueTool: ToolDefinition = {
  name: "create_jira_issue",
  description:
    "Criar ticket no Jira a partir de resultado de auditoria. Requer JIRA_HOST, JIRA_EMAIL, JIRA_TOKEN variáveis de ambiente. Cria issue com título, descrição, prioridade e labels baseados no resultado da auditoria.",
  args: {
    project: z.string().describe("Chave do projeto Jira (ex: 'PROJ', 'QA')"),
    summary: z.string().describe("Título resumido do issue (ex: 'Auditoria SEO - missing meta description')"),
    description: z.string().describe("Descrição detalhada do issue"),
    priority: z.string().optional().describe("Prioridade: 'Highest', 'High', 'Medium', 'Low' (padrão: 'Medium')"),
    labels: z.string().optional().describe("JSON array de labels (ex: '[\"auditoria\",\"seo\"]')"),
    issueType: z.string().optional().describe("Tipo: 'Bug', 'Task', 'Improvement' (padrão: 'Bug')"),
  },
  async execute(args: { project: string; summary: string; description: string; priority?: string; labels?: string; issueType?: string }) {
    const host = process.env.JIRA_HOST;
    const email = process.env.JIRA_EMAIL;
    const token = process.env.JIRA_TOKEN;

    if (!host || !email || !token) {
      return {
        content: [{ type: "text", text: JSON.stringify({
          error: "JIRA_HOST, JIRA_EMAIL, and JIRA_TOKEN env vars required",
          hint: "Crie um token em https://id.atlassian.com/manage/api-tokens",
        }, null, 2) }],
      };
    }

    const labels = args.labels ? JSON.parse(args.labels) as string[] : ["bvp-audit"];
    const priority = args.priority || "Medium";
    const issueType = args.issueType || "Bug";

    const body = {
      fields: {
        project: { key: args.project },
        summary: args.summary,
        description: {
          type: "doc",
          version: 1,
          content: [
            { type: "paragraph", content: [{ type: "text", text: args.description }] },
          ],
        },
        issuetype: { name: issueType },
        priority: { name: priority },
        labels,
      },
    };

    try {
      const url = `${host}/rest/api/3/issue`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${email}:${token}`).toString("base64"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await res.json() as Record<string, unknown>;
      if (res.ok) {
        console.error(`📋 Jira issue created: ${result.key} (${args.summary.slice(0, 50)})`);
        return { content: [{ type: "text", text: JSON.stringify({ created: true, key: result.key, url: `${host}/browse/${result.key}` }, null, 2) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify({ error: result.errorMessages || result }, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ error: (err as Error).message }, null, 2) }] };
    }
  },
};
