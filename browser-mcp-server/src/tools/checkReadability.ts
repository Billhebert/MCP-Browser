import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const checkReadabilityTool: ToolDefinition = {
  name: "check_readability",
  description:
    "Analisar legibilidade do texto da página atual. Calcula métricas: densidade de palavras, tamanho médio de frases, parágrafos longos, porcentagem de texto vs HTML, e estimativa de tempo de leitura.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const metrics = await page.evaluate(() => {
      const text = document.body.innerText;
      const words = text.split(/\s+/).filter(Boolean);
      const sentences = text.split(/[.!?]+/).filter(Boolean);
      const paragraphs = Array.from(document.querySelectorAll("p")).map((p) => p.textContent || "").filter(Boolean);
      const totalChars = text.length;
      const totalWords = words.length;
      const totalSentences = sentences.length;
      const totalParagraphs = paragraphs.length;

      const avgWordLength = totalWords > 0 ? totalChars / totalWords : 0;
      const avgSentenceWords = totalSentences > 0 ? totalWords / totalSentences : 0;
      const avgParagraphWords = totalParagraphs > 0 ? totalWords / totalParagraphs : 0;

      const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 100).length;
      const shortSyllables = words.filter((w) => w.length <= 3).length;
      const longSyllables = words.filter((w) => w.length >= 7).length;

      const readingTimeMin = Math.ceil(totalWords / 200);

      return {
        totalWords,
        totalSentences,
        totalParagraphs,
        avgWordLength: Math.round(avgWordLength * 10) / 10,
        avgSentenceWords: Math.round(avgSentenceWords * 10) / 10,
        avgParagraphWords: Math.round(avgParagraphWords),
        longParagraphs,
        shortWordPercent: totalWords > 0 ? Math.round((shortSyllables / totalWords) * 100) : 0,
        longWordPercent: totalWords > 0 ? Math.round((longSyllables / totalWords) * 100) : 0,
        readingTimeMin,
      };
    });

    if (metrics.longParagraphs > 0) {
      issues.push({
        type: "readability", severity: "medium",
        message: `${metrics.longParagraphs} parágrafo(s) com mais de 100 palavras`,
        details: "Parágrafos muito longos dificultam a leitura. Considere quebrá-los.",
      });
    }
    if (metrics.avgSentenceWords > 25) {
      issues.push({
        type: "readability", severity: "low",
        message: `Média de ${metrics.avgSentenceWords} palavras por frase — acima do recomendado (15-20)`,
        details: "Frases muito longas reduzem a legibilidade. Considere simplificar.",
      });
    }
    if (metrics.longWordPercent > 15) {
      issues.push({
        type: "readability", severity: "low",
        message: `${metrics.longWordPercent}% das palavras são longas (≥7 letras)`,
        details: "Alta densidade de palavras longas pode dificultar a leitura.",
      });
    }

    console.error(`📖 Readability: ${metrics.totalWords} words, ${metrics.readingTimeMin}min read, ${issues.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url, issues,
        metrics: {
          wordCount: metrics.totalWords,
          sentenceCount: metrics.totalSentences,
          paragraphCount: metrics.totalParagraphs,
          avgWordLength: metrics.avgWordLength,
          avgSentenceWords: metrics.avgSentenceWords,
          avgParagraphWords: metrics.avgParagraphWords,
          longParagraphs: metrics.longParagraphs,
          shortWordPercent: metrics.shortWordPercent,
          longWordPercent: metrics.longWordPercent,
          readingTimeMin: metrics.readingTimeMin,
        },
      }, null, 2) }],
    };
  },
};
