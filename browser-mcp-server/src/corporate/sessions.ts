const sessions = new Map<string, { createdAt: number; data: Record<string, unknown> }>();

export function getSession(name: string): { createdAt: number; data: Record<string, unknown> } {
  if (!sessions.has(name)) {
    sessions.set(name, { createdAt: Date.now(), data: {} });
  }
  return sessions.get(name)!;
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}

export function deleteSession(name: string): boolean {
  return sessions.delete(name);
}

export function cleanupSessions(maxAgeMs = 86400000): number {
  const now = Date.now();
  let removed = 0;
  for (const [name, session] of sessions) {
    if (now - session.createdAt > maxAgeMs) {
      sessions.delete(name);
      removed++;
    }
  }
  return removed;
}
