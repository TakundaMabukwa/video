// dataWebsocket.ts

import { Server as HttpServer } from "http";

import WebSocket, { WebSocketServer } from "ws";
 
type BroadcastPayload = unknown;
 
export class DataWebSocketServer {

  private wss: WebSocketServer;

  private clients = new Set<WebSocket>();
 
  constructor(httpServer: HttpServer, path = "/ws/data") {

    this.wss = new WebSocketServer({ 
      server: httpServer, 
      path,
      perMessageDeflate: {
        zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
        zlibInflateOptions: { chunkSize: 10 * 1024 },
        threshold: 1024
      }
    });
 
    this.wss.on("connection", (ws, req) => {

      this.clients.add(ws);
 
      console.log(

        `[WS] client connected (${this.clients.size}) from ${req.socket.remoteAddress}`

      );
 
      // Optional: send a hello so you can see immediate traffic in the browser

      this.safeSend(ws, { type: "hello", ts: Date.now() });
 
      ws.on("message", (raw) => {

        // If you want, you can accept client commands here

        // console.log("[WS] message from client:", raw.toString());

      });
 
      ws.on("close", () => {

        this.clients.delete(ws);

        console.log(`[WS] client disconnected (${this.clients.size})`);

      });
 
      ws.on("error", (err) => {

        console.error("[WS] client error:", err);

      });

    });
 
    // Keep-alive pings (helps with proxies / idle connections)

    const interval = setInterval(() => {

      for (const ws of this.clients) {

        if (ws.readyState === WebSocket.OPEN) {

          ws.ping();

        }

      }

    }, 25000);
 
    this.wss.on("close", () => clearInterval(interval));
 
    console.log(`[WS] mounted on path: ${path}`);

  }
 
  public broadcast(payload: BroadcastPayload) {

    const message = JSON.stringify(payload);

    let sent = 0;

    let skipped = 0;
 
    for (const ws of this.clients) {

      if (ws.readyState !== WebSocket.OPEN) {

        skipped++;

        continue;

      }

      try {

        ws.send(message);

        sent++;

      } catch (e) {

        skipped++;

      }

    }
 
    console.log(`[WS] broadcast -> sent=${sent} skipped=${skipped}`);

  }
 
  public getClientCount() {

    return this.clients.size;

  }
 
  private safeSend(ws: WebSocket, payload: any) {

    try {

      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));

    } catch {

      // ignore

    }

  }

}