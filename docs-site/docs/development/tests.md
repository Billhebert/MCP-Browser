# Running Tests

| Suite | Count | What it covers | How to run |
|-------|-------|----------------|------------|
| Unit | 175 tests | Individual tools, corporate infra, browser | `npm test` |
| E2E Web | 24 tests | REST API + Web UI via Playwright | `npx vitest run --config vitest.e2e.config.ts` |
| MCP Real | 147 tests | Real MCP protocol via SDK | `node tests/test-mcp-comprehensive.mjs` |

## Writing Tests

- Unit tests: Vitest, under `tests/*.test.ts`
- E2E tests: Playwright + Vitest, spawns real server
- MCP tests: Connects via actual MCP SDK
