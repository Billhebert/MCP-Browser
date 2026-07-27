import { z } from "zod";

export const envSchema = z.object({
  BVP_API_KEY: z.string().optional().describe("API key for authentication"),
  BVP_RATE_LIMIT: z.coerce.number().int().min(1).default(60).describe("Max requests/min per user+tool"),
  BVP_AUDIT_DIR: z.string().optional().describe("Custom audit trail directory"),
  BVP_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).default(9090).describe("Health/metrics server port"),
  BVP_WEBHOOKS: z.string().optional().describe("JSON array of webhook URLs with event filters"),
  BVP_EXTENSIONS: z.string().optional().describe("Comma-separated paths to Chrome extensions"),
  BROWSER_HEADLESS: z.enum(["true", "false"]).optional().describe("Force headless mode"),
  JIRA_HOST: z.string().optional().describe("Jira host URL"),
  JIRA_EMAIL: z.string().optional().describe("Jira email"),
  JIRA_TOKEN: z.string().optional().describe("Jira API token"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (!_config) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
      throw new Error("Invalid environment configuration");
    }
    _config = parsed.data as EnvConfig;
  }
  return _config;
}

export function getEnvRaw(key: string): string | undefined {
  return process.env[key];
}
