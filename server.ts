import express from "express";
import path from "path";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

// Puerto para Render
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Servir archivos estáticos desde la carpeta actual
app.use(express.static(process.cwd()));

// Ruta para enviar index.html a cualquier petición
app.get("*", (req, res) => {
  res.sendFile(path.join(process.cwd(), "index.html"));
});

// Configuración básica de WebSocket
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    // Aquí irá tu lógica de manejo de audio
    console.log("Mensaje recibido:", message.toString());
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor iniciado en puerto ${PORT}`);
});
