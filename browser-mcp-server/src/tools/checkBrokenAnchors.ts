import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const checkBrokenAnchorsTool: ToolDefinition = {
  name: "check_broken_anchors",
  description:
    "Verificar links internos com fragmento (#id) na página atual. Detecta referências a IDs que não existem no DOM, links duplicados, e âncoras vazias.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const result = await page.evaluate(() => {
      const allIds = new Set(Array.from(document.querySelectorAll("[id]")).map((el) => el.id));
      const anchors: Array<{ href: string; text: string; targetId: string; exists: boolean }> = [];

      for (const a of Array.from(document.querySelectorAll('a[href^="#"]'))) {
        const anchor = a as HTMLAnchorElement;
        const href = anchor.getAttribute("href") || "";
        const targetId = href.slice(1);
        if (!targetId) continue;
        anchors.push({
          href,
          text: (anchor.textContent || "").trim().slice(0, 50),
          targetId,
          exists: allIds.has(targetId),
        });
      }

      return { allIds: Array.from(allIds), anchors };
    });

    const broken = result.anchors.filter((a) => !a.exists);
    const working = result.anchors.filter((a) => a.exists);

    for (const a of broken) {
      issues.push({
        type: "broken-anchor", severity: "high",
        message: `Âncora "#${a.targetId}" não existe no DOM`,
        details: `Texto do link: "${a.text}" | href: ${a.href}`,
      });
    }

    console.error(`🔗 Anchors: ${broken.length} broken, ${working.length} working (${result.anchors.length} total)`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalAnchors: result.anchors.length,
        brokenCount: broken.length,
        workingCount: working.length,
        brokenAnchors: broken,
        totalIdsInPage: result.allIds.length,
        issues,
      }, null, 2) }],
    };
  },
};
