import type { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { validateApiKey } from "../corporate/auth.js";
import { ToolExecutorService } from "../services/toolExecutorService.js";
import { AuthError, RateLimitError, NotFoundError } from "../contracts/errors.js";

let wssInstance: WebSocketServer | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const executor = new ToolExecutorService();

interface WsMessage {
  id?: string;
  type: string;
  tool?: string;
  args?: Record<string, unknown>;
  apiKey?: string;
  sessionId?: string;
}

function send(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === ws.OPEN) {
    try { ws.send(JSON.stringify(msg)); } catch {}
  }
}

export function broadcast(event: string, data: Record<string, unknown>): void {
  if (!wssInstance) return;
  const msg = JSON.stringify({ type: event, ...data });
  for (const client of wssInstance.clients) {
    if (client.readyState === client.OPEN) {
      try { client.send(msg); } catch {}
    }
  }
}

export function setupWsHandler(wss: WebSocketServer) {
  wssInstance = wss;

  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        try { client.send(JSON.stringify({ type: "ping" })); } catch {}
      }
    }
  }, 30000);

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => {
    console.error(`WebSocket client connected`);

    let msgCount = 0;
    const MAX_MSG_PER_SEC = 20;
    let lastMsgReset = Date.now();

    ws.on("message", async (raw) => {
      const now = Date.now();
      if (now - lastMsgReset > 1000) { msgCount = 0; lastMsgReset = now; }
      msgCount++;
      if (msgCount > MAX_MSG_PER_SEC) {
        send(ws, { type: "error", error: "Rate limit: too many messages" });
        return;
      }

      let msg: WsMessage;
      try { msg = JSON.parse(raw.toString()); }
      catch { send(ws, { type: "error", error: "Invalid JSON" }); return; }

      if (msg.type === "pong") return;
      if (msg.type === "execute" && msg.tool) await handleExecute(ws, msg);
    });

    ws.on("close", () => console.error(`WebSocket client disconnected`));
    ws.on("error", (err) => console.error(`WebSocket error:`, err.message));
    send(ws, { type: "connected", server: "bvp-browser" });
  });
}

async function handleExecute(ws: WebSocket, msg: WsMessage) {
  const { tool: name, args = {}, id, apiKey, sessionId = "default" } = msg;

  const auth = validateApiKey(apiKey);
  if (!auth.valid) {
    send(ws, { type: "result", id, error: "Unauthorized: invalid API key", isError: true });
    return;
  }

  send(ws, { type: "status", id, status: "running" });

  try {
    const { result } = await executor.execute({
      toolName: name!,
      args: args || {},
      user: auth.user,
      sessionId,
    });

    send(ws, { type: "result", id, success: !result.isError, duration: (result as any).duration, content: result.content, isError: result.isError });
  } catch (err) {
    send(ws, { type: "result", id, error: (err as Error).message, isError: true });
  }
}
