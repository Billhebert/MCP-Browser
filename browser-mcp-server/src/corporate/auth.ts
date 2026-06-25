import * as crypto from "crypto";

const API_KEY = process.env.BVP_API_KEY || "";

export function validateApiKey(key: string | undefined): { valid: boolean; user: string } {
  if (!API_KEY) return { valid: true, user: "local" };
  if (!key) return { valid: false, user: "anonymous" };
  if (key === API_KEY) return { valid: true, user: "admin" };

  // Rotational key support: key:timestamp:hmac
  try {
    const [providedKey, ts, hmac] = key.split(":");
    if (!providedKey || !ts || !hmac) return { valid: false, user: "anonymous" };
    const expected = crypto.createHmac("sha256", API_KEY).update(`${providedKey}:${ts}`).digest("hex");
    if (hmac === expected) return { valid: true, user: providedKey };
  } catch {}
  return { valid: false, user: "anonymous" };
}

export function requireApiKey(): void {
  if (API_KEY) {
    console.error(`🔑 Auth required: BVP_API_KEY configured (${API_KEY.slice(0, 4)}...${API_KEY.slice(-4)})`);
  } else {
    console.error(`🔓 Auth disabled: no BVP_API_KEY set`);
  }
}
