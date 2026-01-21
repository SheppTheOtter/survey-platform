// Detecta se o navegador está rodando localmente
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// Define a URL automaticamente
// IMPORTANTE: Substitua a URL abaixo pela SUA URL do Render (sem a barra final)
export const API = isLocal 
    ? "http://localhost:8000" 
    : "https://survey-platform-sc3c.onrender.com";