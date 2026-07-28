# ADR-003: Middleware Pipeline para Execução de Tools

**Status:** Implementado (v1.0.0)
**Data:** 2026-07-28
**Autor:** BVP Engineering

## Contexto

A execução de tools precisa aplicar consistentemente: autenticação, rate limiting, auditoria, métricas e webhooks. No handler MCP inline (`index.ts`), esses cross-cutting concerns estavam misturados com a lógica de negócio, dificultando teste, reuso e manutenção.

## Decisão

Extrair os cross-cutting concerns para um **Pipeline de Middleware** (Chain of Responsibility). Cada middleware implementa:

```typescript
interface Middleware {
  name: string;
  before?: (ctx: ExecutionContext) => Promise<void>;
  after?: (ctx: ExecutionContext) => Promise<void>;
  onError?: (ctx: ExecutionContext, error: Error) => Promise<void>;
}
```

O `ToolExecutorService` constrói o pipeline com 5 middlewares em ordem fixa:
```
Metrics → Auth → RateLimit → [TOOL] → Audit → Webhook
```

## Alternativas Rejeitadas

### Decorator Pattern
- **Prós**: Anotações declarativas
- **Contra**: TypeScript decorators são experimentais, não funcionam com funções assíncronas simples

### Express-style middleware (req, res, next)
- **Prós**: Familiar para desenvolvedores Node.js
- **Contra**: Acoplado a HTTP, não funciona para MCP stdio

### Inline no handler MCP
- **Prós**: Simples, sem abstração
- **Contra**: Testar auth exige chamar tool. Adicionar novo cross-cutting concern exige modificar o handler. Violação SRP.

## Consequências

- **Positivas**: Cada middleware é testável isoladamente. Ordem clara: metrics → auth → rate-limit → tool → audit → webhook.
- **Negativas**: O middleware `MetricsMiddleware.before()` executa antes do auth — significa que requests não autenticados são contados como "requests" nas métricas.
- **Complexidade**: O pipeline executa `before` em ordem direta e `after`/`onError` em ordem reversa, garantindo que webhooks executem após auditoria.

## Lições Aprendidas

A primeira versão tinha auth, rate-limit e audit inline no `CallToolRequestSchema` handler. Isso levou a duplicação quando o `ToolExecutorService` foi introduzido para a REST API. Migrar para pipeline eliminou a duplicação e centralizou a lógica.
