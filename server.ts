import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

// 1. Correcciones de entorno y rutas
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const PORT = Number(process.env.PORT) || 3000;

// Tipado más limpio
interface User {
  id: string;
  username: string;
  channel: number;
  subtone: string;
  isTalking: boolean;
}

const clients = new Map<WebSocket, User>();

// 2. WebSocket Server optimizado
const wss = new WebSocketServer({ server }); // Conectado directamente al server

// Broadcast optimizado: evitar iterar innecesariamente
const broadcastState = () => {
  const usersList: Record<string, Omit<User, 'id'>> = {};
  clients.forEach((user) => {
    usersList[user.id] = {
      username: user.username,
      channel: user.channel,
      subtone: user.subtone,
      isTalking: user.isTalking
    };
  });

  const stateMessage = JSON.stringify({ type: "state", users: usersList });
  
  for (const [ws] of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(stateMessage);
  }
};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const payload = JSON.parse(message.toString());
      const user = clients.get(ws);

      switch (payload.type) {
        case "join":
          clients.set(ws, {
            id: payload.userId,
            username: payload.username,
            channel: payload.channel,
            subtone: payload.subtone,
            isTalking: false
          });
          broadcastState();
          break;

        case "state_update":
          if (user) {
            Object.assign(user, { username: payload.username, channel: payload.channel, subtone: payload.subtone });
            broadcastState();
          }
          break;

        case "talking_start":
        case "talking_stop":
          if (user) {
            user.isTalking = payload.type === "talking_start";
            broadcastState();
            // Forward directo a pares
            clients.forEach((otherUser, otherWs) => {
              if (otherWs !== ws && otherUser.channel === user.channel && otherUser.subtone === user.subtone) {
                otherWs.send(JSON.stringify({ ...payload, userId: user.id }));
              }
            });
          }
          break;

        case "audio":
          if (user?.isTalking) {
            const audioMsg = JSON.stringify({ ...payload, userId: user.id });
            clients.forEach((otherUser, otherWs) => {
              if (otherWs !== ws && otherUser.channel === user.channel && otherUser.subtone === user.subtone) {
                otherWs.send(audioMsg);
              }
            });
          }
          break;
      }
    } catch (err) {
      console.error("Socket error:", err);
    }
  });

  ws.on("close", () => {
    if (clients.has(ws)) {
      clients.delete(ws);
      broadcastState();
    }
  });
});

// 3. Servir frontend (Producción robusta)
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
