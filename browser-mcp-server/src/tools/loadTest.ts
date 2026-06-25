import { z } from "zod";
import type { ToolDefinition } from "../index.js";

const LOAD_PROFILES: Record<string, { vus: number; duration: string }> = {
  smoke: { vus: 1, duration: "10s" },
  load: { vus: 10, duration: "30s" },
  stress: { vus: 50, duration: "60s" },
  spike: { vus: 100, duration: "30s" },
  soak: { vus: 20, duration: "120s" },
};

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h)$/);
  if (!match) return 60000;
  const val = parseInt(match[1]!, 10);
  switch (match[2]) {
    case "s": return val * 1000;
    case "m": return val * 60000;
    case "h": return val * 3600000;
    default: return 60000;
  }
}

export const loadTestTool: ToolDefinition = {
  name: "load_test",
  description:
    "Executar teste de carga em uma URL usando Node.js fetch (não usa o navegador). Suporta perfis smoke/load/stress/spike/soak com múltiplos VUs concorrentes. Retorna p50/p95/p99, throughput, taxa de erro.",
  args: {
    url: z.string().describe("URL para testar"),
    profile: z
      .string()
      .optional()
      .describe("Perfil de carga: 'smoke' (padrão), 'load', 'stress', 'spike', 'soak'"),
    vus: z.string().optional().describe("Número de usuários virtuais simultâneos (sobrescreve o perfil)"),
    duration: z.string().optional().describe("Duração em segundos (ex: '30s') ou usar perfil"),
    p95Threshold: z.string().optional().describe("Threshold p95 em ms (padrão: 2000)"),
    errorRateThreshold: z.string().optional().describe("Threshold taxa de erro (padrão: 0.05 = 5%)"),
    rampUp: z.string().optional().describe("Tempo de ramp-up em ms (padrão: 20% da duração)"),
  },
  async execute(args: {
    url: string;
    profile?: string;
    vus?: string;
    duration?: string;
    p95Threshold?: string;
    errorRateThreshold?: string;
    rampUp?: string;
  }) {
    const profileName = args.profile || "smoke";
    const profile = LOAD_PROFILES[profileName] || LOAD_PROFILES.smoke;
    const vus = args.vus ? parseInt(args.vus, 10) : profile.vus;
    const durationMs = args.duration ? parseInt(args.duration, 10) * 1000 : parseDuration(profile.duration);
    const p95Threshold = parseInt(args.p95Threshold || "2000", 10);
    const errorRateThreshold = parseFloat(args.errorRateThreshold || "0.05");
    const rampUpMs = args.rampUp ? parseInt(args.rampUp, 10) : Math.min(durationMs * 0.2, 10000);

    console.error(`📊 Load test: ${args.url} (${vus} VUs, ${(durationMs / 1000).toFixed(0)}s, ramp: ${(rampUpMs / 1000).toFixed(0)}s)`);

    const latencies: number[] = [];
    let errors = 0;
    let completed = 0;
    const statusCounts: Record<string, number> = {};
    const startTime = Date.now();
    const endTime = startTime + durationMs;

    const runVu = async (vuIndex: number) => {
      const delay = rampUpMs > 0 ? (vuIndex / vus) * rampUpMs : 0;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));

      while (Date.now() < endTime) {
        const reqStart = performance.now();
        try {
          const res = await fetch(args.url);
          latencies.push(performance.now() - reqStart);
          if (!res.ok) errors++;
          statusCounts[String(res.status)] = (statusCounts[String(res.status)] || 0) + 1;
        } catch {
          errors++;
          statusCounts["-1"] = (statusCounts["-1"] || 0) + 1;
        }
        completed++;
      }
    };

    const promises: Promise<void>[] = [];
    for (let i = 0; i < vus; i++) promises.push(runVu(i));
    await Promise.all(promises);

    const actualDuration = durationMs / 1000;
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length * 0.5)] ?? 0) : 0;
    const p95 = sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0) : 0;
    const p99 = sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length * 0.99)] ?? 0) : 0;
    const throughput = actualDuration > 0 ? completed / actualDuration : 0;
    const errorRate = completed > 0 ? errors / completed : 0;
    const passed = p95 <= p95Threshold && errorRate <= errorRateThreshold;

    console.error(
      `${passed ? "✅" : "❌"} Load: p50=${p50}ms p95=${p95}ms p99=${p99}ms throughput=${throughput.toFixed(1)} req/s erros=${(errorRate * 100).toFixed(1)}%`,
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              url: args.url,
              profile: profileName,
              vus,
              durationSeconds: actualDuration,
              passed,
              p50,
              p95,
              p99,
              throughput: Math.round(throughput * 100) / 100,
              errorRate: Math.round(errorRate * 10000) / 10000,
              totalRequests: completed,
              errors,
              statusCounts,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
};
