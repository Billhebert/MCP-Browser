# ADR-005: Execução Serializada de Operações no Navegador

**Status:** Implementado (v0.1.0)
**Data:** 2026-07-28
**Autor:** BVP Engineering

## Contexto

O Playwright compartilha um único `BrowserContext` e `Page` entre todas as tools concorrentes. Se duas tools executarem simultaneamente (ex: `navigate` + `screenshot`), o estado do navegador fica inconsistente — a screenshot pode capturar a página errada.

## Decisão

Implementar um **mutex baseado em Promise chain**:

```typescript
let lastOperation = Promise.resolve();

export async function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const result = lastOperation.then(fn, fn);
  lastOperation = result.catch(() => {});
  return result;
}
```

Cada tool que acessa o navegador passa por `serialized()` — a operação é enfileirada atrás da anterior. Se a operação anterior rejeitar, a corrente não quebra (`catch(() => {})`).

## Alternativas Rejeitadas

### Mutex real (Locker/Semaphore)
- **Prós**: Controle fino, timeout, fila prioritária
- **Contra**: **Overengineering** para o caso de uso. Operaçẽs Playwright são I/O-bound, um mutex real bloquearia o event loop sem necessidade.

### Fila de mensagens
- **Prós**: Desacoplamento, persistência, retry
- **Contra**: Latência adicional, complexidade, sem garantia de ordenação estrita

### Sem proteção (concorrência total)
- **Prós**: Máximo throughput
- **Contra**: Inconsistência de estado, crashes, bugs de racing condition

## Consequências

- **Positivas**: Garantia de que operações no navegador são sequenciais. Zero racing conditions. Implementação em 6 linhas.
- **Negativas**: Throughput máximo limitado pela latência de cada operação. Se navigate leva 2s, as ferramentas seguintes esperam 2s.
- **Impacto**: Para a maioria dos casos de uso (uma ferramenta por vez), o impacto é zero. Para cenários de batch, múltiplas sessões podem ser usadas em paralelo.

## Lições Aprendidas

A promise chain precisa ser **imune a rejeição** — se uma operação falha e a promise rejeita, as operações na fila nunca executam (`then` não é chamado em promise rejeitada). O `catch(() => {})` garante que a corrente continua mesmo após erros.
