# REST API Reference

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/tools` | List all tools |
| `GET` | `/api/tools/:name` | Get tool details |
| `POST` | `/api/tools/:name/execute` | Execute a tool |
| `GET` | `/api/audits` | Audit history |
| `GET` | `/api/audits/stats` | Audit statistics |
| `GET` | `/api/stats` | Server statistics |
| `GET` | `/api/sessions` | List sessions |
| `POST` | `/api/sessions` | Create session |
| `POST` | `/api/sessions/:id/switch` | Switch session |
| `POST` | `/api/sessions/:id/close` | Close session |
| `GET` | `/api/sessions/:id` | Session details |
| `GET` | `/api/plugins` | List plugins |
| `POST` | `/api/plugins/:name/toggle` | Toggle plugin |
| `GET` | `/api/settings` | List settings |
| `POST` | `/api/settings/:key` | Update setting |
| `GET` | `/api/snapshots` | List snapshots |
| `POST` | `/api/snapshots` | Save snapshot |
| `GET` | `/api/snapshots/:name` | Get snapshot |
| `DELETE` | `/api/snapshots/:name` | Delete snapshot |

See [openapi.yaml](https://github.com/Billhebert/MCP-Browser/blob/main/openapi.yaml) for the full OpenAPI 3.1 specification.
