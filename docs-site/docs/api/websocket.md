# WebSocket API

Connect to `ws://localhost:3100/ws`

## Messages

```json
// Execute a tool
{ "type": "execute", "tool": "navigate", "args": { "url": "..." }, "id": "req-1" }

// Response
{ "type": "result", "id": "req-1", "success": true, "content": [...] }

// Status update
{ "type": "status", "id": "req-1", "status": "running" }

// Heartbeat
{ "type": "ping" }
// → respond with { "type": "pong" }
```

## Rate Limit

- Max 20 messages/second per connection
- Violation → `{ "type": "error", "error": "Rate limit: too many messages" }`
