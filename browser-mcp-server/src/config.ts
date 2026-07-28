import { z } from "zod";

const ConfigSchema = z.object({
  auth: z.object({ apiKey: z.string().optional() }).default({}),
  server: z.object({
    port: z.coerce.number().default(3100),
    healthPort: z.coerce.number().default(9090),
  }).default({}),
  browser: z.object({
    headless: z.preprocess((v) => v === "true" || v === true, z.boolean()).default(false),
    extensions: z.array(z.string()).default([]),
  }).default({}),
  modules: z.object({
    disabled: z.array(z.string()).default([]),
  }).default({}),
  audit: z.object({
    dir: z.string().optional(),
    maxFileSize: z.coerce.number().default(10 * 1024 * 1024),
    maxFiles: z.coerce.number().default(5),
  }).default({}),
  rateLimit: z.coerce.number().default(60),
  plugins: z.object({
    dir: z.string().optional(),
  }).default({}),
}).passthrough();

export type BvpConfig = z.infer<typeof ConfigSchema>;

let _config: BvpConfig | null = null;

export function loadConfig(): BvpConfig {
  if (_config) return _config;

  _config = ConfigSchema.parse({
    auth: { apiKey: process.env.BVP_API_KEY },
    server: {
      port: process.env.BVP_HTTP_PORT ? Number(process.env.BVP_HTTP_PORT) : undefined,
      healthPort: process.env.BVP_HEALTH_PORT ? Number(process.env.BVP_HEALTH_PORT) : undefined,
    },
    browser: {
      headless: process.env.BROWSER_HEADLESS,
      extensions: (process.env.BVP_EXTENSIONS || "").split(",").filter(Boolean),
    },
    modules: {
      disabled: (process.env.BVP_DISABLED_MODULES || "").split(",").filter(Boolean),
    },
    audit: {
      dir: process.env.BVP_AUDIT_DIR,
    },
    rateLimit: process.env.BVP_RATE_LIMIT ? Number(process.env.BVP_RATE_LIMIT) : undefined,
  });

  return _config;
}

export function getConfig(): BvpConfig {
  if (!_config) return loadConfig();
  return _config;
}
