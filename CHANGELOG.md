# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-07-28

### Added
- 129 tools de navegação, auditoria, extração e automação via MCP
- Auto-descoberta de tools via filesystem scan (registry.ts)
- Dual transport: MCP stdio (Claude Desktop) + HTTP REST (Express + WebSocket)
- Middleware pipeline com 5 estágios: Metrics → Auth → RateLimit → Audit → Webhook
- Resources MCP (6 URIs: browser://page/url, title, html, console/logs, network/logs, status)
- Prompts MCP (2 templates: audit-page, check-a11y)
- Sistema de plugins com manifest.json e carregamento dinâmico
- Gerenciamento de múltiplas sessões de navegador (sessionManager.ts)
- SQLite persistence (sql.js) para auditorias, settings, snapshots, plugins
- Auditoria dual-write: JSONL (append) + SQLite (consultas)
- SSRF protection, rate limiting sliding window, circuit breaker, exponential backoff retry
- Servidor health check (porta 9090) com métricas Prometheus
- Web UI: React 19 + Vite 6 + Tailwind CSS 4 + Mermaid + Recharts
- Chat WebSocket em tempo real para execução de tools
- REST API completa (20 endpoints)
- Docker multi-stage build com Chromium embarcado
- GitHub Actions CI: lint, typecheck, test, build, audit
- 147 testes MCP reais via SDK oficial
- 175 testes unitários (Vitest)

### Architecture
- Strategy pattern: fallback chains para click, fill, drag_and_drop, navigate
- Event Bus (pub/sub) com histórico de 100 eventos
- DI Container com detecção de dependência circular
- Validação Zod em todas as boundaries (env, args, config)
- Idle timeout de navegador com cleanup automático (5min)
- Screenshot masking automático de dados sensíveis (password, email, CC)
- Webhook masking de secrets em notificações de erro

## [0.1.0] — 2026-07-26

### Added
- Estrutura inicial do projeto
- Suporte a ~40 tools de navegação e interação
- Integração com @modelcontextprotocol/sdk
- Playwright + Chromium headless
- Corporate infra: auth, audit, rate limit, webhook
- Testes básicos

### Changed
- UTF-16 para UTF-8 em todos os arquivos fonte
- Sistema de imports manuais → auto-discovery

### Fixed
- Dual transport: server.connect() chamado 2x
- Missing required args causando crashes (undefined.toLowerCase())
- JSON.parse em input não validado (suggestFixes, smokeTest, testFlow)
- listExtensions retornando isError em vez de lista vazia
- EPIPE flood durante shutdown
- SPA catch-all route com sintaxe Hono (/{*path}) → Express (*)

## [0.0.1] — 2026-07-25

### Added
- Initial commit com estrutura básica
- README inicial
- Licença ISC
