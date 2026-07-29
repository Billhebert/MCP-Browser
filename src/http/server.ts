import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { setupApiRoutes } from "./apiRoutes.js";
import { setupWsHandler } from "./wsHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startHttpServer(port = parseInt(process.env.BVP_HTTP_PORT || "3100")) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  setupApiRoutes(app);

  const webDist = path.resolve(__dirname, "..", "..", "web", "dist");
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("/*", (_req, res) => {
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: "/ws" });
  setupWsHandler(wss);

  server.listen(port, () => {
    console.error(`HTTP server listening on :${port}`);
    console.error(`WebSocket server on ws://localhost:${port}/ws`);
    console.error(`Web UI at http://localhost:${port}`);
  });

  return server;
}
