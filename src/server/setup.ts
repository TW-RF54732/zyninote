// Setup shared by the dev server (main.ts) and the one-shot checker (check.ts).
import type { Server } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import type { Diagnostic } from "../shared/types.ts";
import { zyninotePlugins } from "./vite-plugins.ts";

export const root = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
export const contentDir = join(root, "content");
export const cacheDir = join(root, ".zyninote/cache");

/** Vite in middleware mode. Without an HTTP server there is no HMR and no file watching (used by the checker). */
export function createVite(httpServer?: Server): Promise<ViteDevServer> {
  return createViteServer({
    configFile: false,
    root,
    appType: "custom",
    logLevel: "warn",
    server: httpServer
      ? { middlewareMode: true, hmr: { server: httpServer }, watch: { ignored: ["**/.zyninote/**"] } }
      : { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { zyninote: join(root, "src/runtime/index.ts") } },
    optimizeDeps: httpServer
      ? {
          entries: ["src/client/main.tsx", "content/**/*.tsx"],
          include: ["react", "react/jsx-runtime", "react-dom/client", "wouter", "wouter/use-browser-location", "mermaid"],
        }
      : { noDiscovery: true },
    plugins: zyninotePlugins(contentDir),
  });
}

export function printDiagnostics(diagnostics: Diagnostic[]) {
  for (const d of diagnostics) {
    const log = d.level === "error" ? console.error : console.warn;
    log(`[zyninote] ${d.level === "error" ? "錯誤" : "警告"} ${d.path}：${d.message}`);
  }
}
