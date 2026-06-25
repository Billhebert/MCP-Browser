import { z } from "zod";
import type { ToolDefinition } from "../index.js";

function validateSchema(body: any, schema: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const [key, type] of Object.entries(schema)) {
    const parts = key.split(".");
    let val = body;
    for (const p of parts) val = val?.[p];
    if (val === undefined || val === null) {
      errors.push(`Campo ausente: ${key}`);
      continue;
    }
    const actualType = Array.isArray(val) ? "array" : typeof val;
    if (actualType !== type) errors.push(`Campo "${key}" esperava ${type}, recebeu ${actualType}`);
  }
  return errors;
}

export const testApiTool: ToolDefinition = {
  name: "test_api",
  description:
    "Testar um endpoint de API via HTTP. Faz requisição com método/configuração especificados, valida status code, tempo de resposta, e schema JSON. Não usa o navegador — chamada direta via Node. Útil para testar APIs do sistema que o browser está acessando.",
  args: {
    url: z.string().describe("URL do endpoint para testar"),
    method: z
      .string()
      .optional()
      .describe("Método HTTP: GET, POST, PUT, DELETE, PATCH (padrão: GET)"),
    expectedStatus: z
      .string()
      .optional()
      .describe("Status code esperado (ex: 200, 201, 204)"),
    expectedSchema: z
      .string()
      .optional()
      .describe(
        "Schema JSON esperado como string JSON (ex: '{\"id\":\"string\",\"name\":\"string\"}')",
      ),
    headers: z
      .string()
      .optional()
      .describe("Headers customizados como string JSON (ex: '{\"Authorization\":\"Bearer xyz\"}')"),
    body: z.string().optional().describe("Body da requisição (string)"),
    maxTime: z.string().optional().describe("Tempo máximo em ms (padrão: 30000)"),
  },
  async execute(args: {
    url: string;
    method?: string;
    expectedStatus?: string;
    expectedSchema?: string;
    headers?: string;
    body?: string;
    maxTime?: string;
  }) {
    const method = (args.method || "GET").toUpperCase();
    const expectedStatus = args.expectedStatus ? parseInt(args.expectedStatus, 10) : undefined;
    const expectedSchema = args.expectedSchema ? JSON.parse(args.expectedSchema) : undefined;
    const customHeaders = args.headers ? JSON.parse(args.headers) : undefined;
    const maxTime = args.maxTime ? parseInt(args.maxTime, 10) : 30000;
    const start = Date.now();
    const errors: string[] = [];

    console.error(`🧪 API test: ${method} ${args.url}`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), maxTime);
      const resp = await fetch(args.url, {
        method,
        headers: { Accept: "application/json", ...customHeaders },
        body: args.body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const time = Date.now() - start;
      const status = resp.status;

      if (expectedStatus !== undefined && status !== expectedStatus) {
        errors.push(`Status esperado ${expectedStatus}, recebido ${status}`);
      }

      if (maxTime !== undefined && time > maxTime) {
        errors.push(`Excedeu tempo máximo: ${time}ms > ${maxTime}ms`);
      }

      let body: any = null;
      if (expectedSchema && resp.headers.get("content-type")?.includes("json")) {
        try {
          body = await resp.json();
          const schemaErrors = validateSchema(body, expectedSchema);
          errors.push(...schemaErrors);
        } catch {
          errors.push("Resposta não é JSON válido");
        }
      }

      const result = {
        url: args.url,
        method,
        status,
        time,
        passed: errors.length === 0,
        errors,
        body: body || undefined,
      };

      const icon = result.passed ? "✅" : "❌";
      console.error(`${icon} ${method} ${args.url} → ${status} (${time}ms)${errors.length ? ": " + errors.join("; ") : ""}`);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: any) {
      const time = Date.now() - start;
      console.error(`❌ ${method} ${args.url} → Erro (${time}ms): ${err.message}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                url: args.url,
                method,
                status: 0,
                time,
                passed: false,
                errors: [err.name === "AbortError" ? `Timeout após ${maxTime}ms` : `Erro: ${err.message}`],
              },
              null,
              2,
            ),
          },
        ],
      };
    }
  },
};
