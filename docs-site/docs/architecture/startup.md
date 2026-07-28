# Startup Sequence

When the server starts (`main()` in `index.ts`):

1. **Validate environment** (`getEnv()`) — fail fast on invalid config
2. **Load webhooks** (`loadWebhooks()`) — parse `BVP_WEBHOOKS`
3. **Start health server** (`startHealthServer()`) — port 9090
4. **Initialize SQLite** (`initDatabase()`) — create tables if not exist
5. **Ensure default session** (`ensureDefaultSession()`) — headless browser
6. **Connect MCP stdio** — ready for Claude Desktop
7. **Start HTTP server** (`startHttpServer()`) — Express + WebSocket
