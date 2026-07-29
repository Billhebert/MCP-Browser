import { useState, useCallback, useRef, useEffect } from "react";
import type { AuditStreamState, AuditPageResult, AuditDashboard, AuditProgress } from "../types/audit.ts";
import { api } from "../api/client.ts";

const initialProgress: AuditProgress = { completed: 0, total: 0, elapsed: 0 };

const initialState: AuditStreamState = {
  status: "idle",
  phase: "",
  message: "",
  progress: initialProgress,
  pages: new Map(),
  dashboard: null,
  error: null,
};

export function useAuditStream() {
  const [state, setState] = useState<AuditStreamState>(initialState);
  const pagesRef = useRef<Map<string, AuditPageResult>>(new Map());

  useEffect(() => {
    const onStatus = (msg: any) => {
      setState((s) => ({ ...s, phase: msg.phase || "", message: msg.message || "" }));
    };
    const onDiscovered = (msg: any) => {
      setState((s) => ({ ...s, progress: { ...s.progress, total: msg.count || msg.urls?.length || 0 } }));
    };
    const onPageComplete = (msg: any) => {
      const page: AuditPageResult = {
        url: msg.url,
        title: msg.title || "",
        status: msg.status || "success",
        score: msg.score ?? null,
        toolCount: msg.toolCount || 0,
        issueCount: msg.issueCount || 0,
        loadTimeMs: msg.loadTimeMs || 0,
      };
      pagesRef.current.set(msg.url, page);
      setState((s) => ({
        ...s,
        pages: new Map(pagesRef.current),
      }));
    };
    const onProgress = (msg: any) => {
      setState((s) => ({
        ...s,
        progress: { completed: msg.completed, total: msg.total, elapsed: msg.elapsed },
      }));
    };
    const onComplete = (msg: any) => {
      setState((s) => ({
        ...s,
        status: "complete",
        dashboard: msg.dashboard,
        progress: { ...s.progress, completed: s.progress.total },
      }));
    };

    api.on("audit:status", onStatus);
    api.on("audit:discovered", onDiscovered);
    api.on("audit:page-complete", onPageComplete);
    api.on("audit:progress", onProgress);
    api.on("audit:complete", onComplete);

    return () => {
      api.off("audit:status", onStatus);
      api.off("audit:discovered", onDiscovered);
      api.off("audit:page-complete", onPageComplete);
      api.off("audit:progress", onProgress);
      api.off("audit:complete", onComplete);
    };
  }, []);

  const startScan = useCallback(async (url: string, options?: {
    maxPages?: number;
    maxDepth?: number;
    categories?: string;
    exclude?: string;
    include?: string;
    concurrency?: number;
    noSitemap?: boolean;
  }) => {
    pagesRef.current = new Map();
    setState({
      ...initialState,
      status: "running",
      phase: "starting",
      message: "Iniciando auditoria...",
    });

    try {
      const result = await api.executeTool("full_site_audit", {
        url,
        ...(options?.maxPages ? { maxPages: options.maxPages } : {}),
        ...(options?.maxDepth ? { maxDepth: options.maxDepth } : {}),
        ...(options?.categories ? { categories: options.categories } : {}),
        ...(options?.exclude ? { exclude: options.exclude } : {}),
        ...(options?.include ? { include: options.include } : {}),
        ...(options?.concurrency ? { concurrency: options.concurrency } : {}),
        ...(options?.noSitemap ? { noSitemap: true } : {}),
      });

      if (result.isError) {
        setState((s) => ({
          ...s,
          status: "error",
          error: (result.content?.[0] as any)?.text || "Unknown error",
        }));
      }
    } catch (err) {
      setState((s) => ({ ...s, status: "error", error: (err as Error).message }));
    }
  }, []);

  const reset = useCallback(() => {
    pagesRef.current = new Map();
    setState(initialState);
  }, []);

  return { state, startScan, reset };
}
