# ADR-004: Dual Write — JSONL + SQLite para Auditoria

**Status:** Implementado (v1.0.0)
**Data:** 2026-07-28
**Autor:** BVP Engineering

## Contexto

Cada execução de tool deve ser auditada para: depuração, compliance, métricas de qualidade e feed para o dashboard. O append é crítico de performance — não pode bloquear a resposta da tool.

## Decisão

Implementar **dual write**: cada auditoria é escrita em dois formatos simultaneamente:

1. **JSONL** (`auditTrail.ts`): Append síncrono a arquivo JSON Lines. Rápido, sem lock, rotação a 10MB (5 arquivos).
2. **SQLite** (`database.ts`): Insert via sql.js. Permite consultas SQL (filtro por tool, data, agregações).

O `AuditRepository` implementa a interface `IAuditRepository` com fallback automático:
```typescript
write(entry) {
  jsonlWrite(entry);     // sempre escreve
  try { dbInsert(entry); } catch {}  // SQLite é opcional
}
```

## Alternativas Rejeitadas

### Apenas SQLite
- **Prós**: Consultas SQL, índices, joins
- **Contra**: Insert em arquivo SQLite tem lock de escrita. sql.js é WASM — exportar o banco inteiro a cada `save()` é caro.

### Apenas JSONL
- **Prós**: Append O(1), sem lock, formato legível
- **Contra**: Sem consultas SQL, difícil agregar dados sem ler tudo

### Apenas PostgreSQL externo
- **Prós**: Performance, concorrência, consultas complexas
- **Contra**: Dependência externa, complexidade operacional, latência de rede

## Consequências

- **Positivas**: JSONL garante que nenhuma auditoria é perdida (append é atômico). SQLite permite consultas rápidas para o dashboard e API REST.
- **Negativas**: Escrita duplicada — 2x I/O por auditoria. SQLite pode falhar silenciosamente sem interromper a resposta.
- **Impacto**: ~2ms extra por tool call (JSONL append é ~0.5ms, SQLite insert é ~1.5ms em banco pequeno).

## Lições Aprendidas

sql.js requer `save()` manual para persitir o banco em disco. Em versões iniciais, o `save()` era chamado a cada insert, causando lentidão. A solução foi chamar `save()` apenas após batches ou em intervalos fixos (a cada 2s ou 20 writes).
