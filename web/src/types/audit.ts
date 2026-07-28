export interface AuditPageResult {
  url: string;
  title: string;
  status: string;
  score: number | null;
  toolCount: number;
  issueCount: number;
  loadTimeMs: number;
}

export interface AuditProgress {
  completed: number;
  total: number;
  elapsed: number;
}

export interface AuditDashboard {
  site: {
    url: string;
    totalPages: number;
    successfulPages: number;
    failedPages: number;
    totalIssuesFound: number;
    overallScore: number;
    scanDurationMs: number;
  };
  categories: Record<string, {
    averageScore: number;
    minScore: number;
    maxScore: number;
    passCount: number;
    failCount: number;
    toolsUsed: string[];
  }>;
  patterns: Array<{
    type: string;
    category: string;
    severity: string;
    message: string;
    affectedCount: number;
    totalPages: number;
    percentage: number;
  }>;
  perPage: Array<{
    url: string;
    title: string;
    status: string;
    overallScore: number;
    categoryScores: Record<string, number>;
    totalIssues: number;
    toolResults: Array<{
      tool: string;
      category: string;
      status: string;
      score: number | null;
      issueCount: number;
      duration: number;
    }>;
  }>;
  worstPages: Array<{ url: string; score: number }>;
  recommendations: string[];
}

export interface AuditStreamState {
  status: "idle" | "running" | "complete" | "error";
  phase: string;
  message: string;
  progress: AuditProgress;
  pages: Map<string, AuditPageResult>;
  dashboard: AuditDashboard | null;
  error: string | null;
}
