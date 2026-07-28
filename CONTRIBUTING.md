# Contributing Guide

## Como Adicionar uma Nova Tool

Adicionar uma nova tool MCP requer **exatamente 1 arquivo** — sem registro manual, sem imports, sem configuração.

### 1. Crie o arquivo

```bash
touch browser-mcp-server/src/tools/minhaTool.ts
```

### 2. Implemente a ToolDefinition

```typescript
import { z } from "zod";
import type { ToolDefinition } from "../types.js";

export const minhaToolTool: ToolDefinition = {
  name: "minha_tool",
  description: "Descrição clara do que a ferramenta faz. Máximo 200 caracteres.",
  args: {
    parametro1: z.string().max(500).describe("Descrição do parâmetro"),
    parametro2: z.number().min(0).max(100).optional().describe("Descrição opcional"),
  },
  async execute(args: { parametro1: string; parametro2?: number }) {
    // Lógica da ferramenta
    return {
      content: [{ type: "text", text: JSON.stringify({ resultado: "ok" }) }],
    };
  },
};
```

### 3. Pronto

O `registry.ts` descobre automaticamente sua tool via filesystem scan. Nenhum arquivo adicional precisa ser modificado.

## Regras

### Nomenclatura
- **Arquivo**: `snake_case.ts` (ex: `check_a11y.ts`)
- **Export**: `{nome}Tool` (ex: `checkA11yTool`)
- **Tool name**: `snake_case` (ex: `check_a11y`)
- **Args**: verbos no imperativo, nomes descritivos

### Estrutura
- Toda tool deve ter `name`, `description`, `args` (mesmo que vazio) e `execute`
- `execute` deve retornar `{ content: [{ type: "text", text: string }], isError?: boolean }`
- Use `zod` para validar argumentos — toda regra de negócio deve estar no schema Zod
- Prefira `console.error()` para logging interno (não polui stdout do MCP)

### O que NÃO fazer
- ❌ Não importe de `registry.ts` ou `index.ts` (circular dependency risk)
- ❌ Não use `process.exit()`, `process.stdout.write()`, ou `console.log()`
- ❌ Não crie side effects globais no module scope
- ❌ Não modifique `registry.ts`, `index.ts` ou `types.ts`

## Conventional Commits

```
feat: add check_contrast tool with WCAG AA/AAA
fix: handle undefined args in explain_issue
refactor: extract pipeline middleware from index.ts
docs: add C4 component diagram to README
test: add MCP tests for all 129 tools
```

## Pull Request Checklist

- [ ] Tool funciona via MCP stdio (testar com `test-mcp-comprehensive.mjs`)
- [ ] Tool funciona via REST API (`curl -X POST`)
- [ ] Typecheck passa (`npm run typecheck`)
- [ ] Testes passam (`npm test`)
- [ ] Lint passa (`npm run lint`)
- [ ] README.md atualizado com a nova tool
- [ ] ADR criado se a decisão de design for relevante
