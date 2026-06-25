import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";
import fs from "fs";

export const exportPdfTool: ToolDefinition = {
  name: "export_pdf",
  description: "Salvar a página atual como PDF e retornar o conteúdo base64.",
  args: {
    filePath: z
      .string()
      .optional()
      .describe("Caminho opcional para salvar o PDF no disco. Se omitido, retorna base64."),
    format: z
      .enum(["A4", "Letter", "Legal"])
      .optional()
      .describe("Formato do papel. Padrão: A4"),
  },
  async execute({ filePath, format }: { filePath?: string; format?: string }) {
    const page = await getPage();
    console.error(`📄 Exportando PDF...`);

    const pdf = await page.pdf({
      format: (format as "A4" | "Letter" | "Legal") || "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "15px", right: "15px" },
    });

    const base64 = pdf.toString("base64");

    if (filePath) {
      fs.writeFileSync(filePath, pdf);
      console.error(`✅ PDF salvo em: ${filePath}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              filePath,
              size: pdf.length,
            }),
          },
        ],
      };
    }

    console.error(`✅ PDF gerado: ${pdf.length} bytes`);
    return {
      content: [
        { type: "text", text: `PDF gerado (${pdf.length} bytes)` },
      ],
    };
  },
};
