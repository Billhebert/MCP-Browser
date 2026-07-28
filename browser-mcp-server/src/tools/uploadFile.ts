import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";
import path from "path";
import fs from "fs";

export const uploadFileTool: ToolDefinition = {
  name: "upload_file",
  description: "Upload a file to a file input element.",
  args: {
    selector: z
      .string().max(2000)
      .describe("CSS selector do input[type=file] (ex: '#file-upload', 'input[type=\"file\"]')"),
    filePath: z
      .string().max(2000)
      .describe("Path absoluto do File no sistema (ex: '/home/user/documento.pdf')"),
  },
  async execute({ selector, filePath }: { selector: string; filePath: string }) {
    const page = await getPage();
    console.error(`📎 Fazendo upload: ${filePath} → ${selector}`);

    if (!fs.existsSync(filePath)) {
      return {
        content: [{ type: "text", text: `File não encontrado: ${filePath}` }],
        isError: true,
      };
    }

    const absolutePath = path.resolve(filePath);
    await page.locator(selector).setInputFiles(absolutePath);
    await page.waitForTimeout(500);

    console.error(`✅ Upload realizado: ${path.basename(filePath)}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            file: path.basename(filePath),
            selector,
          }),
        },
      ],
    };
  },
};
