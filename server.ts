import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Render asigna el puerto mediante variable de entorno
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 10000;

// Definición de clientes
const clients = new Map<WebSocket, { id: string; username: string; channel: number; subtone: string; isTalking: boolean }>();

// 1. WebSocket Server
const wss = new WebSocketServer({ server });

const broadcastState = () => {
  const usersList: any = {};
  clients.forEach((user, ws) => {
    usersList[user.id] = { username: user.username, channel: user.channel, subtone: user.subtone, isTalking: user.isTalking };
  });
  const msg = JSON.stringify({ type: "state", users: usersList });
  clients.forEach((_, ws) => { if (ws.readyState === WebSocket.OPEN) ws.send(msg); });
};

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const payload = JSON.parse(message.toString());
      if (payload.type === "join") {
        clients.set(ws, { id: payload.userId, username: payload.username, channel: payload.channel, subtone: payload.subtone, isTalking: false });
        broadcastState();
      } else if (payload.type === "audio" || payload.type === "talking_start" || payload.type === "talking_stop") {
        const user = clients.get(ws);
        if (user) {
          if (payload.type === "talking_start") user.isTalking = true;
          if (payload.type === "talking_stop") user.isTalking = false;
          
          clients.forEach((otherUser, otherWs) => {
            if (otherWs !== ws && otherUser.channel === user.channel && otherUser.subtone === user.subtone) {
              otherWs.send(JSON.stringify({ ...payload, userId: user.id }));
            }
          });
          broadcastState();
        }
      }
    } catch (e) { console.error("Error procesando mensaje:", e); }
  });
  ws.on("close", () => { clients.delete(ws); broadcastState(); });
});

// 2. Servir archivos estáticos desde la raíz
// Usamos path.resolve(process.cwd()) para asegurar una ruta absoluta correcta
const rootDir = process.cwd();
app.use(express.static(rootDir));

// Ruta comodín para enviar siempre index.html (SPA)
app.get("*", (req, res) => {
  res.sendFile(path.resolve(rootDir, "index.html"));
});

// 3. Inicio del servidor
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
