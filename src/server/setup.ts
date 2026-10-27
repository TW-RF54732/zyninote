// Setup shared by the dev server (main.ts) and the one-shot checker (check.ts).
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer, normalizePath, type ViteDevServer } from "vite";
import type { Diagnostic } from "../shared/types.ts";
import { resolveVault, vaultStateDir } from "./vault.ts";
import { zyninotePlugins } from "./vite-plugins.ts";

export const root = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
/** The vault: the notes folder picked at startup (see vault.ts). Not necessarily inside `root`. */
export const contentDir = resolveVault(root);
export const cacheDir = join(vaultStateDir(contentDir), "cache");

/**
 * The app's packages. A vault outside the project has no node_modules of its own, and on the server Vite resolves
 * a note's bare imports (react, katex, ...) from the note's folder; deduping makes them resolve from the app instead.
 */
const appPackages = Object.keys(
  (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string> }).dependencies ?? {},
);

/** Vite in middleware mode. Without an HTTP server there is no HMR and no file watching (used by the checker). */
export function createVite(httpServer?: Server): Promise<ViteDevServer> {
  return createViteServer({
    configFile: false,
    root,
    appType: "custom",
    logLevel: "warn",
    // The checker's optimizer would otherwise rewrite node_modules/.vite/deps with its smaller dep set under a
    // running dev server, which then answers 504 for deps it already handed out (mermaid failed silently this way).
    cacheDir: join(root, httpServer ? "node_modules/.vite" : "node_modules/.vite-check"),
    server: httpServer
      ? { middlewareMode: true, hmr: { server: httpServer }, watch: { ignored: ["**/.zyninote/**"] }, fs: { allow: [root, contentDir] } }
      : { middlewareMode: true, hmr: false, watch: null, fs: { allow: [root, contentDir] } },
    resolve: { alias: { zyninote: join(root, "src/runtime/index.ts") }, dedupe: appPackages },
    optimizeDeps: httpServer
      ? {
          entries: ["src/client/main.tsx", `${normalizePath(contentDir)}/**/*.tsx`],
          include: ["react", "react/jsx-runtime", "react-dom/client", "wouter", "wouter/use-browser-location", "mermaid"],
        }
      : { noDiscovery: true },
    plugins: zyninotePlugins(root, contentDir),
  });
}

export function printDiagnostics(diagnostics: Diagnostic[]) {
  for (const d of diagnostics) {
    const log = d.level === "error" ? console.error : console.warn;
    log(`[zyninote] ${d.level === "error" ? "錯誤" : "警告"} ${d.path}：${d.message}`);
  }
}
