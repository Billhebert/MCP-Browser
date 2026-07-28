# Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BVP_API_KEY` | — | API key for authentication (empty = no auth) |
| `BVP_RATE_LIMIT` | 60 | Requests/minute per user+tool |
| `BVP_HEALTH_PORT` | 9090 | Health check server port |
| `BVP_HTTP_PORT` | 3100 | HTTP server port (REST + Web UI) |
| `BVP_AUDIT_DIR` | ~/.bvp-audit | Audit files directory |
| `BVP_SESSIONS_DIR` | ~/.bvp-sessions | Session data directory |
| `BVP_WEBHOOKS` | — | JSON array of webhook URLs with event filters |
| `BVP_EXTENSIONS` | — | Comma-separated paths to Chrome extensions |
| `BVP_BROWSER_IDLE_TIMEOUT` | 300000 | Browser idle timeout (ms) |
| `BVP_DISABLED_MODULES` | — | Disabled modules (comma-separated) |
| `BROWSER_HEADLESS` | true | Force headless mode |
| `JIRA_HOST` | — | Jira host URL |
| `JIRA_EMAIL` | — | Jira email |
| `JIRA_TOKEN` | — | Jira API token |
