const WINDOW_MS = 60000;
const MAX_REQUESTS = parseInt(process.env.BVP_RATE_LIMIT || "60");

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;
  const remaining = Math.max(0, MAX_REQUESTS - bucket.count);
  const resetInMs = bucket.resetAt - now;

  return { allowed: bucket.count <= MAX_REQUESTS, remaining, resetInMs };
}

export function getRateLimitStatus(key: string): { total: number; remaining: number; resetInMs: number } {
  const bucket = buckets.get(key);
  if (!bucket) return { total: MAX_REQUESTS, remaining: MAX_REQUESTS, resetInMs: WINDOW_MS };
  return { total: MAX_REQUESTS, remaining: Math.max(0, MAX_REQUESTS - bucket.count), resetInMs: bucket.resetAt - Date.now() };
}

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 60000);
