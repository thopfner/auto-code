import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  server: {
    allowedHosts: ["web", "localhost", "127.0.0.1"],
    port: 5173
  }
});
