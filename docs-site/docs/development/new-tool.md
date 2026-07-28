# Adding a New Tool

Adding a new tool requires **exactly 1 file** — no manual registration.

## Steps

```bash
# 1. Create the file
touch src/tools/minha_tool.ts
```

```typescript
import { z } from "zod";
import type { ToolDefinition } from "../types.js";

export const minhaToolTool: ToolDefinition = {
  name: "minha_tool",
  description: "Description of what the tool does.",
  args: {
    param1: z.string().max(500).describe("Parameter description"),
    param2: z.number().optional().describe("Optional parameter"),
  },
  async execute(args: { param1: string; param2?: number }) {
    return {
      content: [{ type: "text", text: JSON.stringify({ result: "ok" }) }],
    };
  },
};
```

## Rules

- **File name**: `snake_case.ts`
- **Export name**: `{name}Tool`
- **Tool name**: `snake_case`
- **Args**: use Zod schemas for validation
- **Logging**: use `console.error()` not `console.log()`
- **No side effects** at module scope
