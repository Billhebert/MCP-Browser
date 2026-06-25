import { z } from "zod";
import type { ToolDefinition } from "../index.js";
import { getContext } from "../browser.js";

export const setGeoTool: ToolDefinition = {
  name: "set_geo",
  description:
    "Simular uma localização geográfica no navegador. Útil para testar conteúdo regionalizado.",
  args: {
    latitude: z.number().min(-90).max(90).describe("Latitude (ex: -23.5505 para São Paulo)"),
    longitude: z.number().min(-180).max(180).describe("Longitude (ex: -46.6333 para São Paulo)"),
    accuracy: z
      .number()
      .optional()
      .describe("Precisão em metros. Padrão: 100"),
  },
  async execute({
    latitude,
    longitude,
    accuracy,
  }: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }) {
    console.error(`🗺️  Simulando localização: ${latitude}, ${longitude}`);
    const ctx = await getContext();
    await ctx.setGeolocation({
      latitude,
      longitude,
      accuracy: accuracy || 100,
    });

    console.error(`✅ Localização simulada: ${latitude}, ${longitude}`);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            latitude,
            longitude,
            accuracy: accuracy || 100,
          }),
        },
      ],
    };
  },
};
