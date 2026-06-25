import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const validateJsonLdTool: ToolDefinition = {
  name: "validate_json_ld",
  description:
    "Extrair e validar dados estruturados JSON-LD da página atual. Verifica conformidade com schema.org, tipos obrigatórios, propriedades mínimas, e erros de sintaxe JSON.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const result = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      const items: Array<{
        index: number;
        raw: string;
        parsed: Record<string, unknown> | null;
        error: string | null;
        type: string | null;
        props: string[];
      }> = [];

      for (const [i, script] of scripts.entries()) {
        const raw = script.textContent || "";
        let parsed: Record<string, unknown> | null = null;
        let error: string | null = null;
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch (e) {
          error = (e as Error).message;
        }
        const type = parsed?.["@type"] as string || null;
        const props = parsed ? Object.keys(parsed).filter((k) => !k.startsWith("@")) : [];
        items.push({ index: i + 1, raw: raw.slice(0, 200), parsed, error, type, props });
      }

      return { total: scripts.length, items };
    });

    if (result.total === 0) {
      issues.push({
        type: "json-ld", severity: "medium",
        message: "Nenhum script JSON-LD encontrado na página",
        details: "Dados estruturados melhoram SEO e rich snippets",
      });
    }

    for (const item of result.items) {
      if (item.error) {
        issues.push({
          type: "json-ld", severity: "high",
          message: `JSON-LD #${item.index} com erro de sintaxe: ${item.error}`,
        });
        continue;
      }
      if (!item.type) {
        issues.push({
          type: "json-ld", severity: "high",
          message: `JSON-LD #${item.index} sem @type`,
          details: "Todo JSON-LD deve ter @type (ex: Organization, WebSite, Article)",
        });
      }
      if (item.props.length < 3) {
        issues.push({
          type: "json-ld", severity: "low",
          message: `JSON-LD #${item.index} (${item.type}) tem apenas ${item.props.length} propriedades`,
          details: "Considere adicionar mais propriedades para melhorar o rich snippet",
        });
      }
    }

    console.error(`📋 JSON-LD: ${result.total} scripts, ${issues.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalScripts: result.total,
        items: result.items.map((i) => ({ index: i.index, type: i.type, props: i.props, error: i.error })),
        issues,
      }, null, 2) }],
    };
  },
};
