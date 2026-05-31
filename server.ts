import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = 3000;

  // Track connected users
  // Map of client sockets to user metadata
  const clients = new Map<WebSocket, {
    id: string;
    username: string;
    channel: number;
    subtone: string;
    isTalking: boolean;
  }>();

  // Create WebSocket server attached to the HTTP server
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  // Broadcast function
  const broadcastState = () => {
    const usersList: { [id: string]: { username: string; channel: number; subtone: string; isTalking: boolean } } = {};
    clients.forEach((user) => {
      usersList[user.id] = {
        username: user.username,
        channel: user.channel,
        subtone: user.subtone,
        isTalking: user.isTalking
      };
    });

    const stateMessage = JSON.stringify({
      type: "state",
      users: usersList
    });

    clients.forEach((_, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(stateMessage);
      }
    });
  };

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      try {
        const payload = JSON.parse(message.toString());

        if (payload.type === "join") {
          clients.set(ws, {
            id: payload.userId,
            username: payload.username,
            channel: payload.channel,
            subtone: payload.subtone,
            isTalking: false
          });
          broadcastState();
        } else if (payload.type === "state_update") {
          const user = clients.get(ws);
          if (user) {
            user.username = payload.username;
            user.channel = payload.channel;
            user.subtone = payload.subtone;
            broadcastState();
          }
        } else if (payload.type === "talking_start") {
          const user = clients.get(ws);
          if (user) {
            user.isTalking = true;
            // Broadcast talking state change
            broadcastState();
            // Also forward specific talking action
            clients.forEach((otherUser, otherWs) => {
              if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
                if (otherUser.channel === user.channel && otherUser.subtone === user.subtone) {
                  otherWs.send(JSON.stringify({
                    type: "talking_start",
                    userId: user.id,
                    username: user.username,
                    channel: user.channel,
                    subtone: user.subtone
                  }));
                }
              }
            });
          }
        } else if (payload.type === "talking_stop") {
          const user = clients.get(ws);
          if (user) {
            user.isTalking = false;
            // Broadcast talking state change
            broadcastState();
            // Also forward stop action
            clients.forEach((otherUser, otherWs) => {
              if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
                if (otherUser.channel === user.channel && otherUser.subtone === user.subtone) {
                  otherWs.send(JSON.stringify({
                    type: "talking_stop",
                    userId: user.id,
                    username: user.username,
                    channel: user.channel,
                    subtone: user.subtone
                  }));
                }
              }
            });
          }
        } else if (payload.type === "audio") {
          const user = clients.get(ws);
          if (user && user.isTalking) {
            // Forward audio to all OTHER users on the same channel + subtone
            const audioMsg = JSON.stringify({
              type: "audio",
              userId: user.id,
              username: user.username,
              channel: user.channel,
              subtone: user.subtone,
              samples: payload.samples
            });

            clients.forEach((otherUser, otherWs) => {
              if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
                if (otherUser.channel === user.channel && otherUser.subtone === user.subtone) {
                  otherWs.send(audioMsg);
                }
              }
            });
          }
        }
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });

    ws.on("close", () => {
      const user = clients.get(ws);
      if (user) {
        clients.delete(ws);
        broadcastState();
      }
    });
  });

  // Express API endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Integrate Vite as middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Express and WebSocket server running on http://localhost:${PORT}`);
  });
}

startServer();
