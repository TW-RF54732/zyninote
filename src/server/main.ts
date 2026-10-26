import { getRequestListener } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { Indexer, type SyncResult } from "../pipeline/indexer.ts";
import type { Diagnostic, UpdateEvent } from "../shared/types.ts";
import { createApi } from "./api.ts";
import { zyninotePlugins } from "./vite-plugins.ts";

const root = fileURLToPath(new URL("../..", import.meta.url)).replace(/\/$/, "");
const contentDir = join(root, "content");
const port = Number(process.env.PORT ?? 5180);

const httpServer = createHttpServer();
const vite = await createViteServer({
  configFile: false,
  root,
  appType: "custom",
  logLevel: "warn",
  server: { middlewareMode: true, hmr: { server: httpServer }, watch: { ignored: ["**/.zyninote/**"] } },
  resolve: { alias: { zyninote: join(root, "src/runtime/index.ts") } },
  optimizeDeps: {
    entries: ["src/client/main.tsx", "content/**/*.tsx"],
    include: ["react", "react/jsx-runtime", "react-dom/client", "wouter", "mermaid"],
  },
  plugins: zyninotePlugins(contentDir),
});

const indexer = new Indexer({ root, contentDir, cacheDir: join(root, ".zyninote/cache"), vite });

const first = await indexer.sync();
console.log(`[zyninote] 索引完成：重建 ${first.changed.length} 頁，${first.ms.toFixed(0)}ms`);
printDiagnostics(indexer.allDiagnostics());

// Content changes: debounce, then resync (only changed pages are rebuilt) and tell the browser.
let timer: NodeJS.Timeout | undefined;
let running: Promise<void> = Promise.resolve();
vite.watcher.on("all", (_event, file) => {
  if (!file.startsWith(contentDir)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    running = running.then(resync, resync);
  }, 50);
});

async function resync() {
  let result: SyncResult;
  try {
    result = await indexer.sync();
  } catch (error) {
    console.error("[zyninote] 同步失敗", error);
    return;
  }
  if (result.changed.length) console.log(`[zyninote] 更新 ${result.changed.join(", ")}（${result.ms.toFixed(0)}ms）`);
  printDiagnostics(result.diagnostics);
  vite.hot.send({ type: "custom", event: "zyninote:update", data: { changed: result.changed } satisfies UpdateEvent });
}

const api = getRequestListener(createApi(indexer).fetch);
const indexHtml = join(root, "src/client/index.html");

httpServer.on("request", (req, res) => {
  if (req.url?.startsWith("/api/")) {
    api(req, res);
    return;
  }
  vite.middlewares(req, res, async () => {
    if (req.method !== "GET") {
      res.statusCode = 404;
      res.end();
      return;
    }
    try {
      const html = await vite.transformIndexHtml(req.url ?? "/", await readFile(indexHtml, "utf8"));
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      res.statusCode = 500;
      res.end(String(error));
    }
  });
});

httpServer.listen(port, () => console.log(`[zyninote] http://localhost:${port}/`));

function printDiagnostics(diagnostics: Diagnostic[]) {
  for (const d of diagnostics) {
    const log = d.level === "error" ? console.error : console.warn;
    log(`[zyninote] ${d.level === "error" ? "錯誤" : "警告"} ${d.path}：${d.message}`);
  }
}
