import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const server = {} as Record<string, unknown>;

  const requestedHost = process.env.VITE_HOST?.trim();
  if (requestedHost && requestedHost.length > 0) {
    server.host = requestedHost;
  }

  const requestedPort = process.env.VITE_PORT;
  if (requestedPort && requestedPort.length > 0) {
    const parsedPort = Number(requestedPort);
    if (!Number.isNaN(parsedPort)) {
      server.port = parsedPort;
    }
  }

  const config = {
    ...(Object.keys(server).length > 0 ? { server } : {}),
    plugins: [
      react(),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };

  return config;
});
