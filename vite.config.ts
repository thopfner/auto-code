import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function deploymentHost(): string | undefined {
  const value = process.env.AUTO_FORGE_PUBLIC_BASE_URL;
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

const allowedHosts = [
  "web",
  "localhost",
  "127.0.0.1",
  deploymentHost(),
  ...(process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean)
].filter((host): host is string => Boolean(host));

const allowAllHosts = process.env.AUTO_FORGE_ALLOW_ALL_WEB_HOSTS === "1";

export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  server: {
    allowedHosts: allowAllHosts ? true : allowedHosts,
    port: 5173
  }
});
