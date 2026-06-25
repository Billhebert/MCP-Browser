import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage } from "../browser.js";

export const checkCookiesConsentTool: ToolDefinition = {
  name: "check_cookies_consent",
  description:
    "Auditar consentimento de cookies na página atual. Detecta presença de banner/notificação de cookies, verifica se há mecanismo de recusa, e analisa conformidade básica com LGPD/GDPR.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];

    const result = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const html = document.documentElement.innerHTML.toLowerCase();

      const keywords = ["cookies", "lgpd", "gdpr", "privacidade", "privacy", "consentimento", "consent",
        "aceitar", "accept", "recusar", "reject", "configurar", "settings", "personalizar", "customize"];
      const foundKeywords = keywords.filter((k) => bodyText.includes(k) || html.includes(k));

      const cookieBanners: string[] = [];
      const bannerSelectors = [
        "[class*=cookie]", "[class*=consent]", "[class*=gdpr]", "[class*=lgpd]",
        "[class*=privacy]", "[id*=cookie]", "[id*=consent]", "[id*=gdpr]",
        "[aria-label*=cookie]", "[role=dialog]", "[class*=notice]",
      ];
      for (const sel of bannerSelectors) {
        const els = document.querySelectorAll(sel);
        for (const el of Array.from(els)) {
          const text = (el.textContent || "").toLowerCase();
          if (text.includes("cookie") || text.includes("privacidade") || text.includes("privacy")) {
            cookieBanners.push(sel + ` (${text.slice(0, 60)}...)`);
            break;
          }
        }
      }

      const hasCookieScript = !!document.querySelector('script[src*="cookie" i]') || !!document.querySelector('script[src*="consent" i]');
      const hasRejectButton = !!document.querySelector('[class*=reject], [class*=recusar], [aria-label*=reject i], [class*="opt-out"]');

      return {
        hasCookieBanner: cookieBanners.length > 0,
        bannerElements: cookieBanners,
        foundKeywords,
        hasCookieScript,
        hasRejectButton,
        bodyContainsCookie: bodyText.includes("cookie") || bodyText.includes("lgpd") || bodyText.includes("gdpr"),
      };
    });

    if (!result.bodyContainsCookie && !result.hasCookieBanner) {
      issues.push({
        type: "cookies-consent", severity: "medium",
        message: "Nenhuma menção a cookies ou política de privacidade encontrada",
        details: "Sites com público brasileiro devem seguir a LGPD. Considere adicionar um banner de consentimento.",
      });
    } else if (result.hasCookieBanner && !result.hasRejectButton) {
      issues.push({
        type: "cookies-consent", severity: "medium",
        message: "Banner de cookies detectado mas sem botão de recusa explícito",
        details: "LGPD/GDPR exigem que o usuário possa recusar cookies com a mesma facilidade que aceitar.",
      });
    }

    if (result.hasCookieBanner) {
      console.error(`🍪 Cookies consent: banner found, ${result.foundKeywords.length} keywords`);
    } else {
      console.error(`🍪 Cookies consent: no banner found`);
    }

    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        hasConsentBanner: result.hasCookieBanner,
        hasRejectButton: result.hasRejectButton,
        hasCookieScript: result.hasCookieScript,
        keywordsFound: result.foundKeywords,
        bannerSelectors: result.bannerElements,
        compliant: issues.length === 0,
        issues,
      }, null, 2) }],
    };
  },
};
