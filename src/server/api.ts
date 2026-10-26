import { Hono } from "hono";
import type { Indexer } from "../pipeline/indexer.ts";

export function createApi(indexer: Indexer) {
  const app = new Hono().basePath("/api");

  // The index changes on every edit; a browser-cached response would be shown with the wrong shape or stale content.
  app.use("*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  app.get("/tree", (c) => c.json(indexer.getTree()));

  app.get("/subject/:name", (c) => {
    const subject = indexer.getSubject(c.req.param("name"));
    return subject ? c.json(subject) : c.json({ error: "找不到此科目" }, 404);
  });

  // A subject's own page (_subject.md), addressed like a note so previews can fetch any page key.
  app.get("/page/:subject", (c) => {
    const page = indexer.getSubjectPage(c.req.param("subject"));
    return page ? c.json(page) : c.json({ error: "此科目沒有 _subject.md" }, 404);
  });

  app.get("/page/:subject/:slug", (c) => {
    const page = indexer.getPage(c.req.param("subject"), c.req.param("slug"));
    return page ? c.json(page) : c.json({ error: "找不到此筆記" }, 404);
  });

  app.get("/diagnostics", (c) => c.json(indexer.allDiagnostics()));

  return app;
}
