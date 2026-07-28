# Architecture Roadmap

## Current Status (v1.0.0 — July 2026)

- 129 MCP tools for browser automation
- Dual transport: MCP stdio + HTTP REST + WebSocket
- Middleware pipeline (5 stages)
- Plugin system with dynamic discovery
- SQLite persistence + JSONL audit trail
- Multi-session browser manager
- SSRF, rate limiting, circuit breaker, retry
- Prometheus metrics + health checks
- React + Vite web UI
- Docker multi-stage build
- GitHub Actions CI

## Q3 2026 — Performance & Scale

### Multi-Instance Support
```
Goal: Horizontal scaling with session affinity
Approach:
  - Redis pub/sub for event bus across instances
  - Redis-based rate limiter (replaces in-memory)
  - Session → instance mapping with sticky routing
  - Shared SQLite → optional PostgreSQL
```

### Performance Improvements
- **Lazy tool loading**: Load tools on first use instead of at startup (reduce startup time from ~3s to ~500ms)
- **Browser pool**: Pre-warm browser contexts for faster tool execution
- **Zero-copy screenshots**: Stream PNG directly without base64 encode for large images
- **Query optimization**: Add SQLite indexes for audit queries

## Q4 2026 — GraphQL & API Evolution

### GraphQL API
```graphql
type Query {
  tools: [Tool!]!
  tool(name: String!): Tool
  audits(limit: Int, filter: AuditFilter): [AuditEntry!]!
  sessions: [Session!]!
  stats: ServerStats
}

type Mutation {
  executeTool(name: String!, args: JSON!, sessionId: String): ToolResult!
  createSession(label: String): Session!
  closeSession(id: String!): Boolean!
}
```

### Streaming Tools (Server-Sent Events)
Tools that produce incremental results (crawling, full-site audit) will stream progress via SSE:
```
POST /api/tools/full_site_audit/execute-stream
→ data: {"type":"progress","current":3,"total":10,"url":"https://..."}
→ data: {"type":"page_result","url":"https://...","score":78}
→ data: {"type":"complete","dashboard":{...}}
```

## Q1 2027 — Cloud Native

### Kubernetes Helm Chart
```yaml
# values.yaml
replicaCount: 3
image:
  repository: bvp/browser-mcp
  tag: latest
service:
  port: 3100
ingress:
  enabled: true
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
resources:
  limits:
    memory: 1Gi
    cpu: 1
persistence:
  enabled: true
  size: 10Gi
```

### Service Mesh Integration
- Istio/Linkerd for mTLS, traffic splitting, retries
- Distributed tracing with OpenTelemetry (Jaeger/Zipkin)

### Chaos Engineering
- Weekly chaos experiments: browser crash, network partition, disk full, OOM
- GameDays to validate runbook and on-call response

## Q2 2027 — AI-Native Features

### Auto-Healing
- Automatic browser crash recovery with state restoration
- Self-tuning rate limiter based on observed latency
- Proactive memory cleanup based on GC metrics

### Tool Recommendation Engine
- ML model suggests tools based on page content and user intent
- Automatic tool chaining for common workflows
- Example: "audit this page" → auto-selects check_a11y + analyze_seo + check_security

### Natural Language Query Interface
- LLM-powered query layer for audit data
- "Show me all pages with contrast issues" → SQL query
- "Which tools had the most errors this week?" → aggregation

## Beyond 2027

- **WebAssembly plugins**: Run tools in sandboxed WASM isolates
- **Federated MCP**: Connect multiple MCP-Browser instances as a single logical server
- **Browserless fallback**: HTTP-only mode for environments without Playwright
- **Visual test recorder**: Record user interactions and export as MCP tool calls
