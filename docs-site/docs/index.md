# MCP-Browser

**MCP-Browser** is an **MCP (Model Context Protocol)** server for browser automation via **Playwright**. It exposes **130+ tools** for navigation, testing, auditing, analysis, and web automation through **MCP stdio**, **REST API**, and **WebSocket** protocols.

[![CI](https://github.com/Billhebert/MCP-Browser/actions/workflows/ci.yml/badge.svg)](https://github.com/Billhebert/MCP-Browser/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-22%2B-339933)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.50-45ba4b)](https://playwright.dev/)
[![MCP](https://img.shields.io/badge/MCP-1.0-000)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-ISC-lightgrey)](https://opensource.org/licenses/ISC)

## Quick Start

```bash
git clone https://github.com/Billhebert/MCP-Browser.git
cd MCP-Browser/browser-mcp-server
npm install
npm run build
npm start
```

## Key Features

- **130+ tools** for browser automation via MCP protocol
- **Dual transport**: MCP stdio (Claude Desktop) + HTTP REST + WebSocket
- **Middleware pipeline**: auth, rate limiting, audit, metrics, webhooks
- **Plugin system** with dynamic discovery
- **SQLite persistence** for audits, settings, snapshots
- **Multi-session** browser management
- **SSRF protection**, rate limiting, circuit breaker
- **Prometheus metrics** + health checks
- **Web UI**: React + Vite + Tailwind CSS

## Documentation

| Section | Description |
|---------|-------------|
| [Architecture](./architecture/overview.md) | C4 diagrams, sequence diagrams, deployment, DFD |
| [Tools](./tools/overview.md) | Complete tool reference (130+) |
| [ADR](./adr/ADR-001-transport-selection.md) | Architecture Decision Records |
| [Operations](./operations/runbook.md) | Runbook, SLOs, benchmarks, alerts |
| [Security](./security/threat-model.md) | STRIDE threat model, env config |
| [Development](./development/getting-started.md) | Setup, contributing, testing |
| [API Reference](./api/rest.md) | REST, WebSocket, MCP protocol |
| [Roadmap](./roadmap.md) | Future plans |
| [Changelog](./changelog.md) | Release history |
