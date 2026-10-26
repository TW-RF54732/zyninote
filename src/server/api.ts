import { Hono } from "hono";
import type { Indexer } from "../pipeline/indexer.ts";

export function createApi(indexer: Indexer) {
  const app = new Hono().basePath("/api");

  app.get("/tree", (c) => c.json(indexer.getTree()));

  app.get("/subject/:name", (c) => {
    const subject = indexer.getSubject(c.req.param("name"));
    return subject ? c.json(subject) : c.json({ error: "找不到此科目" }, 404);
  });

  app.get("/page/:subject/:slug", (c) => {
    const page = indexer.getPage(c.req.param("subject"), c.req.param("slug"));
    return page ? c.json(page) : c.json({ error: "找不到此筆記" }, 404);
  });

  app.get("/diagnostics", (c) => c.json(indexer.allDiagnostics()));

  return app;
}
