import { getPage } from "../browser.js";

export type PageType = "landing" | "form" | "article" | "dashboard" | "search" | "login" | "checkout" | "error" | "unknown";

export interface PageAnalysis {
  type: PageType;
  confidence: number;
  signals: string[];
  suggestedTools: string[];
  description: string;
}

const TYPE_SIGNALS: Record<PageType, { patterns: RegExp[]; tools: string[]; description: string }> = {
  landing: {
    patterns: [/hero/i, /landing/i, /portf[óo]lio/i, /home/i, /in[ií]cio/i],
    tools: ["check_a11y", "analyze_seo", "check_contrast", "check_images", "check_links", "check_typography"],
    description: "Página institucional ou de apresentação",
  },
  form: {
    patterns: [/form/i, /cadastro/i, /register/i, /signup/i, /inscri[cç][ãa]o/i, /contact/i, /contato/i, /input/i, /select/i],
    tools: ["test_form", "check_privacy_forms", "fuzz_form", "get_form_fields", "check_a11y"],
    description: "Página com formulário",
  },
  article: {
    patterns: [/blog/i, /article/i, /artigo/i, /post/i, /not[ií]cia/i, /news/i, /conte[úu]do/i],
    tools: ["check_readability", "check_spelling", "check_typography", "analyze_seo", "validate_html"],
    description: "Página de conteúdo / artigo",
  },
  dashboard: {
    patterns: [/dashboard/i, /panel/i, /painel/i, /admin/i, /manager/i, /gerenciar/i],
    tools: ["check_a11y", "check_contrast", "analyze_responsive", "check_console_errors"],
    description: "Painel administrativo ou dashboard",
  },
  search: {
    patterns: [/search/i, /busca/i, /pesquisa/i, /result/i, /find/i, /procurar/i],
    tools: ["find", "check_a11y", "analyze_seo", "check_images"],
    description: "Página de busca ou resultados",
  },
  login: {
    patterns: [/login/i, /signin/i, /entrar/i, /auth/i, /logon/i],
    tools: ["check_security", "check_ssl", "check_privacy_forms", "check_a11y"],
    description: "Página de autenticação",
  },
  checkout: {
    patterns: [/checkout/i, /cart/i, /carrinho/i, /payment/i, /pagamento/i, /checkout/i, /finalizar/i],
    tools: ["check_security", "check_ssl", "check_links", "check_a11y", "check_privacy_forms"],
    description: "Página de checkout / pagamento",
  },
  error: {
    patterns: [/404/i, /error/i, /not.found/i, /not found/i, /500/i, /fail/i],
    tools: ["check_security", "check_links", "check_console_errors"],
    description: "Página de erro",
  },
  unknown: {
    patterns: [],
    tools: ["check_a11y", "analyze_seo", "check_security", "check_links", "check_images"],
    description: "Página genérica",
  },
};

export async function analyzePage(): Promise<PageAnalysis> {
  const page = await getPage();
  const signals: string[] = [];
  let type: PageType = "unknown";
  let bestScore = 0;

  const url = page.url();
  const title = await page.title().catch(() => "");
  const text = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
  const html = await page.evaluate(() => document.documentElement.outerHTML || "").catch(() => "");
  const h1 = await page.evaluate(() => document.querySelector("h1")?.textContent || "").catch(() => "");

  signals.push(`URL: ${url}`);
  if (title) signals.push(`Título: ${title.slice(0, 80)}`);
  if (h1) signals.push(`H1: ${h1.slice(0, 80)}`);
  signals.push(`Tamanho do HTML: ${html.length} chars`);

  const hasForm = /<form|<input|<select|<textarea/i.test(html);
  const hasArticle = /<article|<main|<p{.{0,100}}<p/i.test(html);
  const isDark = html.includes("dark") && html.includes("dashboard");
  const textRatio = text.length / Math.max(html.length, 1);

  if (hasForm) {
    signals.push("Formulário detectado no HTML");
    type = "form";
    bestScore = 0.8;
  }

  if (hasArticle && textRatio > 0.3) {
    signals.push("Alto teor de texto (artigo)");
    if (bestScore < 0.6) { type = "article"; bestScore = 0.6; }
  }

  if (isDark) {
    signals.push("Padrão de dashboard escuro");
    if (bestScore < 0.5) { type = "dashboard"; bestScore = 0.5; }
  }

  if (textRatio < 0.05 && !hasForm) {
    signals.push("Pouco texto (landing)");
    if (bestScore < 0.3) { type = "landing"; bestScore = 0.3; }
  }

  for (const [pt, cfg] of Object.entries(TYPE_SIGNALS) as [PageType, typeof TYPE_SIGNALS[PageType]][]) {
    if (pt === "unknown") continue;
    const combined = `${url} ${title} ${h1}`;
    for (const pattern of cfg.patterns) {
      if (pattern.test(combined)) {
        signals.push(`Padrão "${pattern.source}" detectado no título/URL`);
        if (bestScore < 0.9) {
          type = pt;
          bestScore = 0.9;
        }
        break;
      }
    }
  }

  const config = TYPE_SIGNALS[type];
  const confidence = Math.max(bestScore, type === "unknown" ? 0.2 : 0.5);

  return {
    type,
    confidence,
    signals,
    suggestedTools: config.tools,
    description: config.description,
  };
}

export function getSuggestedTools(pageType: PageType): string[] {
  return TYPE_SIGNALS[pageType]?.tools || TYPE_SIGNALS.unknown.tools;
}
