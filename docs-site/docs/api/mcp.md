# MCP Protocol

The server implements the standard [Model Context Protocol](https://modelcontextprotocol.io/).

## Available Methods

| Method | Description |
|--------|-------------|
| `tools/list` | List all 129 tools |
| `tools/call` | Execute a tool |
| `resources/list` | List 6 browser resources |
| `resources/read` | Read a resource |
| `prompts/list` | List 2 prompt templates |
| `prompts/get` | Get a prompt |


## Connecting via Claude Desktop

```json
{
  "mcpServers": {
    "bvp-browser": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": { "BROWSER_HEADLESS": "true" }
    }
  }
}
```
