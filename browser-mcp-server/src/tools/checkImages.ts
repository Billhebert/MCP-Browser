import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getNetworkLogs } from "../browser.js";

export const checkImagesTool: ToolDefinition = {
  name: "check_images",
  description:
    "Auditar imagens na página atual. Verifica dimensões (oversized vs exibidas), formato, alt text, lazy loading, tamanho de arquivo via network log, e imagens não carregadas.",
  args: {},
  async execute() {
    const page = await getPage();
    const url = page.url();
    const networkLogs = getNetworkLogs();
    const issues: Array<{ type: string; severity: string; message: string; details?: string }> = [];
    const imageMap = new Map<string, { size: number; format: string; status: number }>();

    for (const req of networkLogs) {
      if (req.type === "image" || req.url.match(/\.(png|jpg|jpeg|gif|svg|webp|avif|ico)(\?|#|$)/i)) {
        imageMap.set(req.url, {
          size: req.transferSize,
          format: req.url.match(/\.(\w+)(\?|#|$)/)?.[1]?.toLowerCase() || "unknown",
          status: req.status,
        });
      }
    }

    const images = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img")).map((img) => ({
        src: img.src,
        alt: img.alt,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayWidth: img.clientWidth,
        displayHeight: img.clientHeight,
        loading: img.loading || "auto",
        hasLazy: img.loading === "lazy",
        hasAlt: img.hasAttribute("alt"),
        isBroken: !img.complete || img.naturalWidth === 0,
      }));
    });

    for (const img of images) {
      if (img.isBroken) {
        issues.push({ type: "image", severity: "high", message: `Imagem não carregou: ${img.src.slice(0, 100)}`, details: "Verifique URL ou permissões CORS" });
        continue;
      }
      if (!img.hasAlt) {
        issues.push({ type: "image", severity: "high", message: `Imagem sem alt text: ${img.src.slice(0, 80)}`, details: "Adicione alt para acessibilidade" });
      }
      if (img.naturalWidth > 0 && img.displayWidth > 0) {
        const ratio = img.naturalWidth / img.displayWidth;
        if (ratio > 2) {
          issues.push({ type: "image", severity: "medium", message: `Imagem oversized: ${img.naturalWidth}x${img.naturalHeight} exibida como ${img.displayWidth}x${img.displayHeight} (${ratio.toFixed(1)}x maior)`, details: `Src: ${img.src.slice(0, 80)}` });
        }
      }
      if (img.naturalWidth > 2000 || img.naturalHeight > 2000) {
        const netInfo = imageMap.get(img.src);
        if (netInfo && netInfo.size > 200000) {
          issues.push({ type: "image", severity: "medium", message: `Imagem muito grande: ${(netInfo.size / 1024).toFixed(0)}KB (${img.naturalWidth}x${img.naturalHeight})`, details: `Considere redimensionar ou usar WebP/AVIF: ${img.src.slice(0, 80)}` });
        }
      }
    }

    const totalNetworkImages = imageMap.size;
    const totalSize = Array.from(imageMap.values()).reduce((s, i) => s + i.size, 0);
    const formats = new Set(Array.from(imageMap.values()).map((i) => i.format));
    const hasModern = formats.has("webp") || formats.has("avif");

    if (!hasModern && totalNetworkImages > 3) {
      issues.push({ type: "image", severity: "low", message: "Nenhuma imagem em formato moderno (WebP/AVIF)", details: "WebP reduz ~30% do peso comparado a PNG/JPEG" });
    }

    console.error(`🖼️ Images: ${images.length} elements, ${totalNetworkImages} network requests, ${(totalSize / 1024).toFixed(0)}KB total, ${issues.length} issues`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        url,
        totalImages: images.length,
        totalNetworkRequests: totalNetworkImages,
        totalSizeKB: Math.round(totalSize / 1024),
        modernFormats: hasModern,
        issues,
      }, null, 2) }],
    };
  },
};
