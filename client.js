// client.js
console.log("El frontend ha cargado correctamente");
document.getElementById('root').innerHTML = "<h1>¡Emisora activa!</h1>";

// Aquí conectarás tu WebSocket más tarde
const socket = new WebSocket(`ws://${window.location.host}`);
socket.onopen = () => console.log("Conectado al servidor");
