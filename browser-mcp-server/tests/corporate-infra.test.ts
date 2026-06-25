import { describe, it, expect, beforeAll } from "vitest";
import { writeAudit, readAudits, getAuditStats } from "../src/corporate/auditTrail.js";
import { checkRateLimit, getRateLimitStatus } from "../src/corporate/rateLimiter.js";
import { loadWebhooks, sendWebhook } from "../src/corporate/webhook.js";
import { getSession, listSessions, deleteSession, cleanupSessions } from "../src/corporate/sessions.js";
import { validateApiKey, requireApiKey } from "../src/corporate/auth.js";
import { addAnnotation, getAnnotations, listAnnotationKeys, addSchedule, listSchedules, removeSchedule, toggleSchedule } from "../src/corporate/collab.js";
import { maskSensitiveRegions, findSensitiveRegions } from "../src/corporate/dataMasker.js";
import { PNG } from "pngjs";
import fs from "fs";
import path from "path";
import os from "os";

// Clean audit log from any previous run
try { fs.unlinkSync(path.join(os.tmpdir(), "audit.jsonl")); } catch {}
try { fs.unlinkSync(path.join(os.homedir(), ".bvp-audit", "audit.jsonl")); } catch {}

describe("auditTrail", () => {
  it("writeAudit e readAudits", () => {
    writeAudit({ timestamp: "2025-01-01", tool: "ut-test", user: "tester", session: "s1", args: {}, result: { status: "pass", score: 90 }, durationMs: 100 });
    const entries = readAudits(10);
    const ours = entries.filter(e => e.tool === "ut-test");
    expect(ours.length).toBeGreaterThanOrEqual(1);
    expect(ours[0].result.score).toBe(90);
  });

  it("readAudits com filtro", () => {
    writeAudit({ timestamp: "2025-01-01", tool: "ut-seo", user: "t1", session: "s1", args: {}, result: { status: "pass" }, durationMs: 10 });
    writeAudit({ timestamp: "2025-01-01", tool: "ut-a11y", user: "t1", session: "s1", args: {}, result: { status: "fail" }, durationMs: 10 });
    const filtered = readAudits(100, { tool: "ut-seo" });
    expect(filtered.length).toBe(1);
    expect(filtered[0].tool).toBe("ut-seo");
    const failFilter = readAudits(100, { status: "fail" });
    expect(failFilter.length).toBeGreaterThanOrEqual(1);
  });

  it("getAuditStats", () => {
    writeAudit({ timestamp: "2025-01-01", tool: "ut-stats-a", user: "u", session: "s", args: {}, result: { status: "pass", score: 80 }, durationMs: 5 });
    writeAudit({ timestamp: "2025-01-01", tool: "ut-stats-a", user: "u", session: "s", args: {}, result: { status: "fail" }, durationMs: 5 });
    writeAudit({ timestamp: "2025-01-01", tool: "ut-stats-b", user: "u", session: "s", args: {}, result: { status: "pass", score: 100 }, durationMs: 5 });
    const stats = getAuditStats();
    expect(stats.totalExecutions).toBeGreaterThanOrEqual(3);
    expect(stats.totalErrors).toBeGreaterThanOrEqual(1);
    expect(stats.averageScore).toBeGreaterThan(0);
    expect(stats.topTools.length).toBeGreaterThan(0);
  });
});

describe("rateLimiter", () => {
  it("checkRateLimit permite primeiras requisições", () => {
    const r = checkRateLimit("rl-test-1");
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeGreaterThanOrEqual(59);
    expect(r.resetInMs).toBeGreaterThan(0);
  });

  it("getRateLimitStatus", () => {
    checkRateLimit("rl-test-2");
    const s = getRateLimitStatus("rl-test-2");
    expect(s.total).toBeGreaterThan(0);
    expect(s.remaining).toBeLessThan(s.total);
  });
});

describe("webhook", () => {
  it("loadWebhooks com JSON inválido não quebra", () => {
    process.env.BVP_WEBHOOKS = "invalid json";
    expect(() => loadWebhooks()).not.toThrow();
  });

  it("sendWebhook não lança erro (sem webhooks configurados)", () => {
    process.env.BVP_WEBHOOKS = "[]";
    loadWebhooks();
    expect(() => sendWebhook("test", {})).not.toThrow();
  });
});

describe("sessions", () => {
  it("getSession cria nova sessão se não existir", () => {
    const s = getSession("sess-test-1");
    expect(s.data).toEqual({});
    expect(s.createdAt).toBeGreaterThan(0);
  });

  it("listSessions", () => {
    getSession("sess-test-2");
    expect(listSessions()).toContain("sess-test-2");
  });

  it("deleteSession", () => {
    const name = "sess-test-3";
    getSession(name);
    expect(deleteSession(name)).toBe(true);
    expect(deleteSession("nonexistent")).toBe(false);
  });

  it("cleanupSessions", () => {
    const count = cleanupSessions(0);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe("auth", () => {
  it("validateApiKey sem chave configurada retorna local", () => {
    const API_KEY = process.env.BVP_API_KEY || "";
    if (!API_KEY) {
      const result = validateApiKey(undefined);
      expect(result.valid).toBe(true);
      expect(result.user).toBe("local");
    } else {
      const result = validateApiKey(undefined);
      expect(result.valid).toBe(false);
    }
  });

  it("requireApiKey não lança", () => {
    expect(() => requireApiKey()).not.toThrow();
  });
});

describe("collab", () => {
  it("addAnnotation e getAnnotations", () => {
    addAnnotation("ISSUE-1", "Tester", "Precisa de correção");
    const notes = getAnnotations("ISSUE-1");
    expect(notes.length).toBe(1);
    expect(notes[0].author).toBe("Tester");
    expect(notes[0].text).toContain("correção");
  });

  it("listAnnotationKeys", () => {
    addAnnotation("ISSUE-2", "T", "x");
    expect(listAnnotationKeys()).toContain("ISSUE-2");
  });

  it("addSchedule e listSchedules", () => {
    const id = addSchedule("0 */6 * * *", "analyze_seo", {});
    expect(id).toContain("schedule-");

    const schedules = listSchedules();
    expect(schedules.some((s) => s.id === id)).toBe(true);
  });

  it("removeSchedule", () => {
    const id = addSchedule("* * * * *", "check_a11y", {});
    expect(removeSchedule(id)).toBe(true);
    expect(removeSchedule("fake-id")).toBe(false);
  });

  it("toggleSchedule", () => {
    const id = addSchedule("* * * * *", "test", {});
    expect(toggleSchedule("fake-id", false)).toBe(false);
    expect(toggleSchedule(id, false)).toBe(true);
  });

  it("getAnnotations retorna vazio para issue sem anotações", () => {
    expect(getAnnotations("ISSUE-NONE")).toEqual([]);
  });
});

describe("dataMasker", () => {
  it("maskSensitiveRegions com PNG pequeno", async () => {
    const img = new PNG({ width: 2, height: 2 });
    for (let i = 0; i < img.data.length; i++) img.data[i] = 128;
    const buf = PNG.sync.write(img);
    const regions = [{ x: 0, y: 0, width: 1, height: 1 }];
    const masked = await maskSensitiveRegions(buf, regions);
    expect(masked.length).toBeGreaterThan(0);
    const decoded = PNG.sync.read(masked);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
  });

  it("findSensitiveRegions retorna pelo menos uma região", async () => {
    const png = new PNG({ width: 4, height: 4, fill: true });
    const buf = PNG.sync.write(png);
    const regions = await findSensitiveRegions(buf);
    expect(regions.length).toBeGreaterThanOrEqual(1);
    expect(regions[0].width).toBe(4);
  });
});
