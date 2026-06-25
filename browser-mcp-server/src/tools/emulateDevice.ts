import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getPage, getContext } from "../browser.js";

const DEVICE_PRESETS: Record<string, { width: number; height: number; userAgent: string; touch: boolean }> = {
  "iphone-14": { width: 390, height: 844, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", touch: true },
  "iphone-se": { width: 375, height: 667, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", touch: true },
  "pixel-7": { width: 412, height: 915, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36", touch: true },
  "samsung-s23": { width: 360, height: 780, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36", touch: true },
  "ipad-air": { width: 820, height: 1180, userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", touch: true },
  "ipad-pro": { width: 1024, height: 1366, userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", touch: true },
  "desktop-1080": { width: 1920, height: 1080, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", touch: false },
  "desktop-1440": { width: 2560, height: 1440, userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", touch: false },
  "macbook-pro": { width: 1512, height: 982, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", touch: false },
};

export const emulateDeviceTool: ToolDefinition = {
  name: "emulate_device",
  description:
    "Emular um dispositivo específico: ajusta viewport, user agent e touch support. Presets: iphone-14, iphone-se, pixel-7, samsung-s23, ipad-air, ipad-pro, desktop-1080, desktop-1440, macbook-pro. Ou especifique valores customizados.",
  args: {
    device: z.string().optional().describe("Nome do preset: iphone-14, iphone-se, pixel-7, samsung-s23, ipad-air, ipad-pro, desktop-1080, desktop-1440, macbook-pro"),
    width: z.string().optional().describe("Largura em px (usado com height se device não especificado)"),
    height: z.string().optional().describe("Altura em px"),
    userAgent: z.string().optional().describe("User agent string customizado"),
  },
  async execute(args: { device?: string; width?: string; height?: string; userAgent?: string }) {
    const page = await getPage();
    const ctx = await getContext();

    let config: { width: number; height: number; userAgent: string; touch: boolean };

    if (args.device && DEVICE_PRESETS[args.device]) {
      config = DEVICE_PRESETS[args.device];
    } else {
      config = {
        width: parseInt(args.width || "1440"),
        height: parseInt(args.height || "900"),
        userAgent: args.userAgent || "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        touch: false,
      };
    }

    await page.setViewportSize({ width: config.width, height: config.height });
    await ctx.addInitScript((ua: string) => {
      Object.defineProperty(navigator, "userAgent", { get: () => ua, configurable: true });
    }, config.userAgent);

    if (config.touch) {
      await page.evaluate(() => {
        Object.defineProperty(navigator, "maxTouchPoints", { get: () => 1, configurable: true });
      });
    }

    const deviceName = args.device || "custom";
    console.error(`📱 Device emulated: ${deviceName} (${config.width}x${config.height})`);
    return {
      content: [{ type: "text", text: JSON.stringify({
        device: deviceName,
        width: config.width,
        height: config.height,
        touch: config.touch,
        userAgent: config.userAgent.slice(0, 100),
      }, null, 2) }],
    };
  },
};
