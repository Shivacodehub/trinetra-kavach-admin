import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// In dev, /api is proxied to FastAPI, so the browser never needs CORS and no URL is hard-coded in components.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // `npm test` renders every page against a RUNNING backend (http://localhost:8000) with demo data.
  test: { environment: "jsdom", environmentOptions: { jsdom: { url: "http://localhost:8000/" } }, testTimeout: 20000 },
  server: {
    port: 5173,
    proxy: { "/api": { target: process.env.VITE_BACKEND_URL ?? "http://localhost:8000", changeOrigin: true } },
  },
});
