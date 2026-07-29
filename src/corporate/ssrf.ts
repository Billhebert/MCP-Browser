import { URL } from "url";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]", "255.255.255.255"]);
const RFC1918 = ["10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168."];

export function isSafeUrl(urlStr: string): { safe: boolean; reason?: string } {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();

    if (BLOCKED_HOSTS.has(host)) return { safe: false, reason: `Blocked host: ${host}` };

    if (isIP(host)) {
      for (const prefix of RFC1918) {
        if (host.startsWith(prefix)) return { safe: false, reason: "Blocked RFC1918 address" };
      }
    }

    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { safe: false, reason: `Blocked protocol: ${u.protocol}` };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }
}
