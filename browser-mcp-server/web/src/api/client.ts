const BASE = "/api";

export interface ToolArg {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

export interface ToolInfo {
  name: string;
  description: string;
  args: ToolArg[];
}

export interface ToolResult {
  success: boolean;
  duration: number;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
  error?: string;
}

export interface AuditEntry {
  timestamp: string;
  tool: string;
  user: string;
  args: Record<string, unknown>;
  result: { status: string; score?: number; issueCount?: number };
  durationMs: number;
}

type WsCallback = (msg: any) => void;

export class ApiClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer: ReturnType<typeof setTimeout> }>();
  private msgId = 0;
  private listeners = new Map<string, Set<WsCallback>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private shouldReconnect = true;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((e: Error) => void) | null = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) { resolve(); return; }
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.shouldReconnect = true;
      this.doConnect();
    });
  }

  private doConnect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      this.handleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      if (this.connectResolve) { this.connectResolve(); this.connectResolve = null; this.connectReject = null; }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "connected") return;
        if (msg.type === "pong") return;
        if (msg.type === "ping") { this.ws?.send(JSON.stringify({ type: "pong" })); return; }
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: r, timer } = this.pending.get(msg.id)!;
          clearTimeout(timer);
          this.pending.delete(msg.id);
          r(msg);
        }
        if (msg.type) {
          const cbs = this.listeners.get(msg.type);
          if (cbs) cbs.forEach((cb) => cb(msg));
        }
      } catch {}
    };

    this.ws.onerror = () => {
      if (this.connectReject) { this.connectReject(new Error("WebSocket connection failed")); this.connectResolve = null; this.connectReject = null; }
    };

    this.ws.onclose = () => {
      if (this.shouldReconnect) this.handleReconnect();
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => this.doConnect(), delay);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.ws?.close();
    this.ws = null;
  }

  on(type: string, cb: WsCallback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  off(type: string, cb: WsCallback) {
    this.listeners.get(type)?.delete(cb);
  }

  async executeTool(tool: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const id = `req_${++this.msgId}`;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return this.executeToolRest(tool, args);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Tool execution timed out"));
      }, 300000);

      this.pending.set(id, {
        resolve: (msg: any) => {
          clearTimeout(timer);
          resolve(msg);
        },
        reject,
        timer,
      });

      this.ws?.send(JSON.stringify({ id, type: "execute", tool, args }));
    });
  }

  async listTools(): Promise<ToolInfo[]> {
    const res = await fetch(`${BASE}/tools`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "unknown")}`);
    const data = await res.json();
    return data.tools;
  }

  async getTool(name: string): Promise<ToolInfo> {
    const res = await fetch(`${BASE}/tools/${name}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "unknown")}`);
    return res.json();
  }

  async executeToolRest(tool: string, args: Record<string, unknown> = {}, timeout = 300000): Promise<ToolResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(`${BASE}/tools/${encodeURIComponent(tool)}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "unknown");
        return { success: false, duration: 0, content: [], isError: true, error: `HTTP ${res.status}: ${text}` };
      }
      return res.json();
    } catch (err: any) {
      if (err.name === "AbortError") return { success: false, duration: 0, content: [], isError: true, error: "Request timed out" };
      return { success: false, duration: 0, content: [], isError: true, error: err.message };
    } finally {
      clearTimeout(timer);
    }
  }

  async getAudits(): Promise<AuditEntry[]> {
    const res = await fetch(`${BASE}/audits`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.audits;
  }

  async getHealth(): Promise<any> {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getStats(): Promise<any> {
    const res = await fetch(`${BASE}/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const api = new ApiClient();
