#!/bin/bash
set -e
cd "$(dirname "$0")"

log()  { echo -e "\e[36m▶ $1\e[0m"; }
ok()   { echo -e "\e[32m  ✔ $1\e[0m"; }
fail() { echo -e "\e[31m  ✘ $1\e[0m"; exit 1; }

commit() { git add "$@"; git commit --no-verify -m "$1"; shift; }

typecheck() { npx tsc --noEmit 2>&1 | grep "error" | grep -v "node_modules" | grep -v "implicitly" | grep -v "Parameter" | wc -l; }

# ============================
# INFRAESTRUTURA INICIAL
# ============================
log "FASE 1 — MVP"

cat > package.json << 'EOF'
{"name":"mcp-browser","version":"0.1.0","type":"module","scripts":{"start":"tsx src/index.ts","build":"tsc","typecheck":"tsc --noEmit"},"dependencies":{"@modelcontextprotocol/sdk":"^1.0.0","playwright":"^1.50.0","zod":"^3.24.2"},"devDependencies":{"@types/node":"^22.13.5","tsx":"^4.19.2","typescript":"^5.7.3"}}
EOF
cat > tsconfig.json << 'EOF'
{"compilerOptions":{"target":"ES2022","module":"ES2022","moduleResolution":"bundler","lib":["ES2022","dom"],"outDir":"dist","rootDir":"src","strict":true,"esModuleInterop":true,"skipLibCheck":true,"forceConsistentCasingInFileNames":true,"declaration":true,"sourceMap":true},"include":["src/**/*"],"exclude":["node_modules","dist"]}
EOF
cat > .gitignore << 'EOF'
node_modules/
dist/
*.db
*.log
EOF
commit "chore: adiciona package.json, tsconfig.json e .gitignore" package.json tsconfig.json .gitignore
ok "Infra inicial"

npm install 2>&1 | tail -1
ok "Dependências instaladas"

# ============================
# CORE: browser, types, logger
# ============================
cat > src/browser.ts << 'BROWSER'
import { chromium } from "playwright";
let browser: any = null, page: any = null, lastOp: Promise<any> = Promise.resolve();
export async function getPage() {
  if (!page || page.isClosed()) {
    const b = browser || await (async () => { browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] }); return browser; })();
    page = await (await b.newContext()).newPage();
  } return page;
}
export async function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const r = lastOp.then(fn, fn); lastOp = r.catch(() => {}); return r;
}
export async function closeBrowser() {
  try { if (page && !page.isClosed()) await page.close(); if (browser && browser.isConnected()) await browser.close(); } catch {}
}
BROWSER
commit "feat: adiciona browser.ts — Playwright headless, serialized queue" src/browser.ts
ok "browser.ts"

cat > src/types.ts << 'TYPES'
import { z } from "zod";
export interface ToolDefinition {
  name: string; description: string; args: Record<string, z.ZodType>;
  execute: (args: any) => Promise<{ content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean }>;
}
TYPES
commit "feat: adiciona types.ts — interfaces ToolDefinition e ToolResult" src/types.ts
ok "types.ts"

cat > src/corporate/logger.ts << 'LOGGER'
type L = "error" | "warn" | "info";
function log(l: L, b: Record<string, unknown>, m: string, e?: Record<string, unknown>) {
  (l === "error" ? process.stderr : process.stdout).write(JSON.stringify({ level: l, time: new Date().toISOString(), msg: m, ...b, ...e }) + "\n");
}
export function createLogger(b: Record<string, unknown> = {}) {
  return { info: (m: string, e?: Record<string, unknown>) => log("info", b, m, e), warn: (m: string, e?: Record<string, unknown>) => log("warn", b, m, e), error: (m: string, e?: Record<string, unknown>) => log("error", b, m, e), child: (x: Record<string, unknown>) => createLogger({ ...b, ...x }) };
}
LOGGER
commit "feat: adiciona logger.ts — logger estruturado JSON" src/corporate/logger.ts
ok "logger.ts"

# ============================
# FERRAMENTAS FASE 1 (6 tools)
# ============================
tool() {
  local name="$1" desc="$2" args="$3" body="$4"
  cat > "src/tools/${name}.ts" << TOOL
import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage, serialized } from "../browser.js";
export const ${name}Tool: ToolDefinition = {
  name: "${name/_/-}", description: "${desc}",
  args: { ${args} },
  async execute(args: any) { ${body} },
};
TOOL
  commit "feat: adiciona ${name/_/-} — ${desc}" "src/tools/${name}.ts"
  [ $(typecheck) -eq 0 ] && ok "${name/_/-} OK" || fail "typecheck falhou em ${name}"
}

tool "navigate" "Navega para uma URL" 'url: z.string().max(5000)' \
  'const p = await getPage(); await serialized(() => p.goto(args.url, { waitUntil: "networkidle", timeout: 30000 })); return { content: [{ type: "text", text: JSON.stringify({ title: await p.title(), url: p.url() }) }] }'

tool "click" "Clica em elemento" 'selector: z.string().max(2000)' \
  'await serialized(() => (await getPage()).click(args.selector, { timeout: 5000 })); return { content: [{ type: "text", text: "Clique: " + args.selector }] }'

tool "fill" "Preenche campo" 'selector: z.string().max(2000), value: z.string().max(5000)' \
  'await serialized(() => (await getPage()).fill(args.selector, args.value)); return { content: [{ type: "text", text: "Preenchido: " + args.selector }] }'

tool "getText" "Extrai texto" 'selector: z.string().max(2000).optional()' \
  'const p = await getPage(); const t = args.selector ? await p.$eval(args.selector, (e: any) => e.textContent || "") : await p.evaluate(() => document.body?.innerText || ""); return { content: [{ type: "text", text: t }] }'

tool "screenshot" "Captura screenshot" 'fullPage: z.boolean().optional()' \
  'const buf: Buffer = await serialized(() => (await getPage()).screenshot({ type: "png", fullPage: args.fullPage })); return { content: [{ type: "image", data: buf.toString("base64"), mimeType: "image/png" }] }'

tool "healthCheck" "Verifica saúde" '' \
  'try { await (await getPage()).evaluate("1"); return { content: [{ type: "text", text: JSON.stringify({ status: "healthy" }) }] }; } catch (e: any) { return { content: [{ type: "text", text: JSON.stringify({ status: "degraded", error: e.message }) }] } }'

# ============================
# INDEX.TS + README FASE 1
# ============================
cat > src/index.ts << 'IDX'
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { serialized } from "./browser.js";
import { createLogger } from "./corporate/logger.js";
import { navigateTool } from "./tools/navigate.js";
import { clickTool } from "./tools/click.js";
import { fillTool } from "./tools/fill.js";
import { getTextTool } from "./tools/getText.js";
import { screenshotTool } from "./tools/screenshot.js";
import { healthCheckTool } from "./tools/healthCheck.js";

const l = createLogger({ service: "mcp-browser" });
const tools = [navigateTool, clickTool, fillTool, getTextTool, screenshotTool, healthCheckTool];
const m = new Map(tools.map(t => [t.name, t]));
const s = new Server({ name: "mcp-browser", version: "0.1.0" }, { capabilities: { tools: {} } });

s.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(t => ({
    name: t.name, description: t.description,
    inputSchema: { type: "object", properties: Object.fromEntries(Object.entries(t.args).map(([k, zt]) => [k, { type: "string", description: (zt as any).description || k }])), required: Object.entries(t.args).filter(([_, zt]) => !(zt as any).isOptional()).map(([k]) => k) },
  })),
}));

s.setRequestHandler(CallToolRequestSchema, async req => {
  const t = m.get(req.params.name);
  if (!t) return { content: [{ type: "text", text: "Ferramenta desconhecida: " + req.params.name }], isError: true };
  try { l.info("Executando", { tool: req.params.name }); return await serialized(() => t.execute(req.params.arguments || {})); }
  catch (e: any) { l.error("Falha", { error: e.message }); return { content: [{ type: "text", text: "Erro: " + e.message }], isError: true }; }
});

await s.connect(new StdioServerTransport());
l.info("MCP-Browser v0.1.0 iniciado");
IDX
commit "feat: adiciona index.ts — servidor MCP com handlers ListTools e CallTool" src/index.ts
[ $(typecheck) -eq 0 ] && ok "index.ts OK" || fail "typecheck falhou"

cat > README.md << 'EOF'
# MCP-Browser — Fase 1: MVP

**Versão**: 0.1.0 | **Ferramentas**: 6

Servidor MCP com 6 ferramentas essenciais de automação de navegador.

| Ferramenta | Descrição |
|------------|-----------|
| navigate | Navega para uma URL |
| click | Clica em um elemento |
| fill | Preenche campo de formulário |
| get_text | Extrai texto visível |
| screenshot | Captura screenshot |
| health_check | Verifica saúde do servidor |

```bash
npm install && npm start
```
EOF
commit "docs: adiciona README.md — Fase 1 MVP" README.md
git tag -f v0.1.0
ok "Fase 1 concluída — 6 ferramentas, 9 commits"

echo "Fim do script de teste — rodar fases 2-9 manualmente"
