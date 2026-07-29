import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import fs from "node:fs";
import path from "node:path";
import { getPage } from "../browser.js";

export const testContractSuiteTool: ToolDefinition = {
  name: "test_contract_suite",
  description: "Executa todos os contratos JSON (.contract.json) de um diretório. Retorna relatório consolidado com status geral, scores por contrato, e lista de falhas. Ideal para rodar como suite de testes antes de deploy.",
  args: {
    dir: z.string().max(2000).describe("Diretório containing files .contract.json"),
    pattern: z.string().max(200).optional().describe("Glob pattern para filter files (padrão: '*.contract.json')"),
    failFast: z.string().max(10).optional().describe("Parar no primeiro contrato que falhar? 'true' ou 'false'"),
  },
  async execute(args: { dir: string; pattern?: string; failFast?: string }) {
    const dir = args.dir;
    const pattern = args.pattern || ".contract.json";
    const failFast = args.failFast === "true";

    if (!fs.existsSync(dir)) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Diretório não encontrado: ${dir}` }) }], isError: true };
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(pattern));
    if (files.length === 0) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `Nenhum file ${pattern} encontrado em ${dir}` }) }], isError: true };
    }

    console.error(`🧪 Contract Suite: ${files.length} contratos em ${dir}`);

    const { testContractTool } = await import("./testContract.js");
    const results: Array<{ file: string; contract: string; passed: number; failed: number; total: number; score: number; status: string; firstFailure?: string }> = [];

    for (const file of files.sort()) {
      const filePath = path.join(dir, file);
      console.error(`  Testing ${file}...`);
      try {
        const res = await testContractTool.execute({ file: filePath });
        const text = res.content?.[0]?.text || "{}";
        const data = JSON.parse(text);
        results.push({
          file,
          contract: data.contract || file,
          passed: data.passed,
          failed: data.failed,
          total: data.total,
          score: data.score,
          status: data.status,
          firstFailure: data.results?.find((r: any) => r.status === "fail")?.name,
        });
        if (failFast && data.failed > 0) break;
      } catch (err) {
        results.push({ file, contract: file, passed: 0, failed: 1, total: 1, score: 0, status: "error", firstFailure: (err as Error).message });
      }
    }

    const totalPassed = results.reduce((s, r) => s + r.passed, 0);
    const totalFailed = results.reduce((s, r) => s + r.failed, 0);
    const total = totalPassed + totalFailed;
    const overallScore = total > 0 ? Math.round((totalPassed / total) * 100) : 0;
    const failedContracts = results.filter((r) => r.failed > 0);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            suite: { dir, files: files.length, contracts: results.length },
            overall: {
              totalAssertions: total,
              passed: totalPassed,
              failed: totalFailed,
              score: overallScore,
              verdict: failedContracts.length === 0 ? "✅ ALL CONTRACTS PASSED" : `❌ ${failedContracts.length} CONTRACT(S) FAILED`,
            },
            results,
            failures: failedContracts.map((r) => ({ file: r.file, contract: r.contract, score: r.score, firstFailure: r.firstFailure })),
          }, null, 2),
        },
      ],
    };
  },
};
