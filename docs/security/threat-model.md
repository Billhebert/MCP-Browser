# Threat Model — MCP-Browser (STRIDE)

## Scope

- **Componentes**: MCP Server, HTTP Server, WebSocket Handler, Tool Executor, Database, File Store, Browser
- **Trust boundaries**: Network (HTTP/WS), Process (stdin/stdout), Filesystem
- **Assumptions**: Servidor roda em ambiente controlado. Claude Desktop é confiável. Usuários da REST API podem ser autenticados.

## Threat Table

### MCP Stdio Transport

| Threat | STRIDE | Descrição | Severidade | Mitigação |
|--------|--------|-----------|------------|-----------|
| Processo malicioso escrevendo no stdin | Spoofing | Attacker envia comandos MCP falsos | **High** | stdio é pipe do Claude Desktop — confiança no processo pai. Para ambientes multi-tenant, usar HTTP com API key |
| Leitura do stdout por processo não autorizado | Information Disclosure | Attacker lê respostas das tools | **Medium** | stdio deve ser pipe privado. Em Docker, usar `stdio: ["pipe"]` |
| Envio de payloads grandes no stdin | DoS | Payloads > 1MB podem causar OOM | **Low** | Zod schemas limitam tamanho de strings (max: 50000) |

### HTTP REST API

| Threat | STRIDE | Descrição | Severidade | Mitigação |
|--------|--------|-----------|------------|-----------|
| Acesso sem autenticação | Spoofing | Attacker chama API sem API key | **High** | `validateApiKey()` — se `BVP_API_KEY` configurada, requests sem key são rejeitados |
| Brute force de API keys | Tampering | Attacker tenta milhares de keys | **Medium** | Rate limiting por IP (via middleware). Key é HMAC rotacional |
| Injeção de argumentos maliciosos | Tampering | Attacker envia args com XSS, SQLi | **High** | Zod schemas validam tipos, tamanhos, enums. URLs passam por `isSafeUrl()`. JSON.parse em input tem try/catch |
| CORS misconfiguration | Information Disclosure | Site malicioso lê respostas da API | **Low** | CORS configurado para origens específicas |
| Logs expondo secrets | Information Disclosure | Attacker lê audit trail com tokens | **Medium** | Webhook masking de secrets antes de enviar. Audit trail não armazena secrets |

### Browser (Playwright)

| Threat | STRIDE | Descrição | Severidade | Mitigação |
|--------|--------|-----------|------------|-----------|
| SSRF via navigate tool | Spoofing | Usuário faz servidor acessar rede interna | **Critical** | `isSafeUrl()` bloqueia localhost, 127.0.0.1, RFC1918, não-http |
| Screenshot expondo dados sensíveis | Information Disclosure | Screenshot captura campos de senha | **High** | `maskSensitiveRegions()` automaticamente blur em inputs password, email, CC |
| Execução de JavaScript arbitrário | Tampering | `execute_js` permite código malicioso | **Critical** | Ferramenta proposital, mas logs auditam toda execução. Em produção, desabilitar com `BVP_DISABLED_MODULES=execute_js` |
| File upload path traversal | Tampering | Attacker faz upload de `/etc/passwd` | **Medium** | `uploadFile` usa o filesystem local do servidor — não expõe path traversal |

### Database (SQLite / JSONL)

| Threat | STRIDE | Descrição | Severidade | Mitigação |
|--------|--------|-----------|------------|-----------|
| SQL injection via sql_query tool | Tampering | Attacker executa SQL arbitrário | **High** | `sql_query` é tool proposital para consultas SQL. Restrito a conexões definidas via `sql_connect`. |
| Acesso indevido aos arquivos de banco | Information Disclosure | Attacker lê `data.db` ou `audit.jsonl` | **Medium** | Arquivos em `~/.bvp-browser/` com permissão 600. Em Docker, volume montado |

### Webhook / Notificações

| Threat | STRIDE | Descrição | Severidade | Mitigação |
|--------|--------|-----------|------------|-----------|
| Webhook URL apontando para rede interna | Spoofing | SSRF via webhook | **High** | Mesma proteção SSRF. Webhook URLs são configuradas via env var, não via tool |
| Secrets vazando em webhooks | Information Disclosure | Token ou password no payload de erro | **Medium** | Regex masking: `/password\|secret\|token\|api[_-]?key/` |

## Data Flow Security

```
[Claude Desktop] ──pipe──▶ [MCP Server] ──validate──▶ [Tool Executor] ──safe URL?──▶ [Browser]
                                     │                       │
                                     ▼                       ▼
                               [Auth + RateLimit]    [Audit Trail]
                                     │                       │
                                     ▼                       ▼
                               [Zod Validation]      [JSONL + SQLite]
```

## Recommendations

### Para Produção Multi-tenant

1. **Desabilitar tools perigosas**: `BVP_DISABLED_MODULES=execute_js,sql_connect,sql_query,sql_execute`
2. **Forçar API key**: Configurar `BVP_API_KEY` com valor forte (32+ caracteres hex)
3. **Rate limiting baixo**: `BVP_RATE_LIMIT=10` (10 req/min por user+tool)
4. **HTTPS**: Colocar atrás de reverse proxy (nginx, Caddy) com TLS
5. **Network isolation**: Servidor em rede interna, sem acesso à internet pública (exceto sites a serem auditados)
6. **Resource limits**: Docker com `--memory=1g --cpus=1`

### Para Desenvolvimento Local

1. API key pode ficar vazia (modo sem autenticação)
2. Browser headless pode ser desabilitado (`BROWSER_HEADLESS=false`) para depuração visual
3. Logs de auditoria em `~/.bvp-audit/` para depuração

## Incident Response

1. **Vazamento de dados via screenshot**: Rotacionar `BVP_API_KEY`, revisar audit trail, identificar ferramentas que chamaram `screenshot` sem `mask: true`
2. **SSRF detectada**: Bloquear IP de origem, revisar logs de `isSafeUrl()`, verificar se `BVP_WEBHOOKS` contém URLs internas
3. **SQL injection via sql_query**: Verificar se `sql_connect` foi chamado com credenciais que permitem escrita em tabelas sensíveis
