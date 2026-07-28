export default {
  "browser-mcp-server/src/**/*.ts": [
    "cd browser-mcp-server && npx eslint --fix",
    "cd browser-mcp-server && npx prettier --write"
  ],
  "browser-mcp-server/tests/**/*.ts": [
    "cd browser-mcp-server && npx eslint --fix",
    "cd browser-mcp-server && npx prettier --write"
  ]
}
