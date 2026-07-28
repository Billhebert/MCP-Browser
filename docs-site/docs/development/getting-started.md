# Getting Started

## Prerequisites

- Node.js >= 18 (recommended 22+)
- npm >= 8

## Setup

```bash
git clone https://github.com/Billhebert/MCP-Browser.git
cd MCP-Browser/browser-mcp-server
npm install
npm run build
npm start
```

## Verify It Works

```bash
# In another terminal:
curl -s http://localhost:3100/api/health
# → {"status":"ok","timestamp":"...","version":"1.0.0"}

curl -s http://localhost:3100/api/tools | jq '.count'
# → 129
```
