# ADR-001: Dual Transport — MCP Stdio + HTTP REST

**Status:** Implementado (v0.1.0)
**Data:** 2026-07-28
**Autor:** BVP Engineering

## Contexto

O servidor MCP-Browser precisa atender dois públicos distintos:
1. **LLMs (Claude, etc.)** via protocolo MCP padrão
2. **Desenvolvedores e scripts** via REST API e Web UI

## Decisão

Implementar **dois transports simultâneos**:
- **MCP stdio** (JSON-RPC via stdin/stdout) — para Claude Desktop
- **HTTP REST + WebSocket** (Express) — para API e Web UI

Ambos compartilham o mesmo `toolMap` e `ToolExecutorService`.

## Alternativas Rejeitadas

### Apenas MCP HTTP (StreamableHTTP)
- **Prós**: Transporte único, sem necessidade de stdio
- **Contra**: Claude Desktop não suporta StreamableHTTP nativamente. Exigiria configuração de rede. stdio é zero-config para o usuário.

### Apenas Stdio
- **Prós**: Máxima compatibilidade MCP
- **Contra**: Sem REST API, sem Web UI, sem WebSocket, sem health checks HTTP

### Servidores Separados
- **Prós**: Isolamento total
- **Contra**: Duas codebases, duas manutenções, inconsistência de tools

## Consequências

- **Positivas**: Claude Desktop funciona com `command` + `args` simples. REST API permite `curl`, scripts, Web UI. Ambos compartilham o mesmo `toolMap`, garantindo consistência.
- **Negativas**: O `Server` do SDK MCP `connect()` é chamado apenas para stdio. HTTP REST é implementado manualmente com Express, sem usar o SDK MCP HTTP — significa que o HTTP não expõe Resources/Prompts, apenas Tools.
- **Técnica**: O startup precisa iniciar dois servidores (stdio + HTTP), com tratamento de erro independente.

## Lições Aprendidas

A primeira implementação tentou conectar o mesmo `Server` MCP a dois transports (`server.connect(stdioTransport)` + `server.connect(httpTransport)`). O SDK não suporta dual transport — a segunda conexão sobrescreve a primeira. A solução foi usar stdio para MCP puro e Express para REST.
