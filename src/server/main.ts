import { getRequestListener } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { join } from "node:path";
import { Indexer, type SyncResult } from "../pipeline/indexer.ts";
import type { UpdateEvent } from "../shared/types.ts";
import { createApi } from "./api.ts";
import { cacheDir, contentDir, createVite, printDiagnostics, root } from "./setup.ts";

const port = Number(process.env.PORT ?? 5180);

const httpServer = createHttpServer();
const vite = await createVite(httpServer);

const indexer = new Indexer({ root, contentDir, cacheDir, vite });

const first = await indexer.sync();
console.log(`[zyninote] 索引完成：重建 ${first.changed.length} 頁，${first.ms.toFixed(0)}ms`);
printDiagnostics(indexer.allDiagnostics());

// Content changes: debounce, then resync (only changed pages are rebuilt) and tell the browser.
let timer: NodeJS.Timeout | undefined;
let running: Promise<void> = Promise.resolve();
vite.watcher.on("all", (_event, file) => {
  if (!file.startsWith(contentDir)) return;
  clearTimeout(timer);
  timer = setTimeout(queueResync, 50);
});

/** Syncs run one at a time; the promise settles once this one has finished. */
function queueResync(): Promise<void> {
  running = running.then(resync, resync);
  return running;
}

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

const api = getRequestListener(createApi(indexer, { resync: queueResync }).fetch);
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
