import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { getPage } from "../browser.js";
import fs from "fs";

export const exportPdfTool: ToolDefinition = {
  name: "export_pdf",
  description: "Save the current page as PDF and return base64 content or save to disk.",
  args: {
    filePath: z.string().max(2000).optional().describe("Optional path to save the PDF file. If omitted, returns base64."),
    format: z.enum(["A4", "Letter", "Legal"]).optional().describe("Paper format. Default: A4"),
  },
  async execute({ filePath, format }: { filePath?: string; format?: string }) {
    try {
      const page = await getPage();
      const url = page.url();
      const pdf = await page.pdf({
        format: (format as "A4" | "Letter" | "Legal") || "A4",
        printBackground: true,
        margin: { top: "20px", bottom: "20px", left: "15px", right: "15px" },
      });

      if (filePath) {
        fs.writeFileSync(filePath, pdf);
        return {
          content: [{ type: "text", text: JSON.stringify({ success: true, url, filePath, size: pdf.length }) }],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ url, pdfBase64: pdf.toString("base64"), size: pdf.length }) }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: `PDF generation failed: ${(err as Error).message}` }) }],
        isError: true,
      };
    }
  },
};
