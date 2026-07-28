# ADR-002: Tool Auto-Discovery via Filesystem Scan

**Status:** Implementado (v1.0.0)
**Data:** 2026-07-28
**Autor:** BVP Engineering

## Contexto

Cada tool MCP é um arquivo `.ts` individual em `src/tools/`. Com mais de 130 tools, manter um registro centralizado com imports manuais é insustentável — toda nova tool exige modificar `registry.ts`.

## Decisão

Implementar **auto-descoberta dinâmica**: o `discoverTools()` escaneia o diretório `src/tools/` (ou `dist/tools/` em produção), filtra `registry.ts` e `discovery.ts`, e faz `import()` dinâmico de cada arquivo. Cada arquivo que exporta um `ToolDefinition` é automaticamente registrado no `toolMap`.

```typescript
async function discoverTools(): Promise<ToolDefinition[]> {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith(ext) && !f.includes("registry") && !f.includes("discovery"));
  for (const file of files) {
    const mod = await import(file);
    for (const key of Object.keys(mod)) {
      if (isToolDefinition(mod[key])) found.push(mod[key]);
    }
  }
  return found;
}
```

## Alternativas Rejeitadas

### Imports manuais centralizados
- **Prós**: Controle explícito, ordem de carregamento garantida
- **Contra**: ~130 imports manuais, erros de merge frequentes, esquecer de registrar nova tool

### Decorators / Anotações
- **Prós**: Expressivo, auto-documentado
- **Contra**: TypeScript decorators são experimentais, exigem configuração adicional

### Plugin-style com registro explícito
- **Prós**: Cada tool se auto-registra
- **Contra**: Efeito colateral em tempo de import, difícil de rastrear

## Consequências

- **Positivas**: Adicionar nova tool = criar arquivo. Zero configuração. Remover tool = deletar arquivo.
- **Negativas**: Ordem de carregamento não é garantida (depende do filesystem). Cross-tool imports (ex: `fullSiteAudit.ts` importa `analyzeSeoTool` de `analyzeSeo.ts`) podem causar circular dependencies.
- **Mitigação**: `isToolDefinition()` verifica a estrutura do objeto exportado, não o nome. Cross-tool imports funcionam porque ESM `import()` resolve dependências transitivity.

## Lições Aprendidas

A primeira versão (V0.0.2) usava imports manuais. Com ~90 tools, o arquivo `registry.ts` tinha 90 linhas de import + 90 linhas de registro. Cada PR com nova tool exigia editar `registry.ts`. Auto-discovery reduziu o boilerplate a zero.
