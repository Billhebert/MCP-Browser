# Deployment Diagram

```mermaid
deploymentDiagram
  node "Claude Desktop" as cd
  node "CI/CD Pipeline" as ci
  node "Server" as host {
    node "Docker" as docker {
      container "MCP-Browser" as mcpb
    }
  }
  node "Browser" as browser {
    component "Chromium" as cr
  }
  cd --> mcpb: MCP stdio
  ci --> mcpb: MCP stdio / HTTP
  browser --> mcpb: ws://host:3100/ws
  mcpb --> cr: Playwright CDP
```
