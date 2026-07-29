import { getPage } from "../browser.js";

interface CacheEntry {
  result: any;
  timestamp: number;
  ttl: number;
  url: string;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 2000;
const CLEANUP_INTERVAL = 30000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let hits = 0;
let misses = 0;

export function initCache(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupExpired, CLEANUP_INTERVAL);
}

export function stopCache(): void {
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > entry.ttl) cache.delete(key);
  }
}

function hash(args: Record<string, unknown>): string {
  try { return JSON.stringify(args); } catch { return ""; }
}

function getCacheKey(toolName: string, args: Record<string, unknown>, url: string): string {
  return `${toolName}:${hash(args)}:${url}`;
}

export async function withCache<T>(
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const page = await getPage();
  const url = page.url();
  const key = getCacheKey(toolName, args, url);

  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    hits++;
    return cached.result as T;
  }

  misses++;
  const result = await fn();
  cache.set(key, { result, timestamp: Date.now(), ttl, url });
  return result;
}

export function getCacheStats(): { size: number; hits: number; misses: number; hitRate: string } {
  const total = hits + misses;
  return {
    size: cache.size,
    hits,
    misses,
    hitRate: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : "0%",
  };
}

export function clearCache(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}

export function invalidateCache(toolName?: string): void {
  if (toolName) {
    for (const [key] of cache) {
      if (key.startsWith(`${toolName}:`)) cache.delete(key);
    }
  } else {
    clearCache();
  }
}
