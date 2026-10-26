import { Hono, type Context } from "hono";
import { addCard, CheatError, removeCard, reorderCards, repointCard, today, type StoredCard } from "../pipeline/cheats.ts";
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

  // Cheat sheets. Every write goes straight to content/<subject>/_cheats.json and answers with the new sheet;
  // the file watcher then resyncs and notifies every open browser.
  app.get("/cheats/:subject", (c) => {
    const sheet = indexer.getCheats(c.req.param("subject"));
    return sheet ? c.json(sheet) : c.json({ error: "找不到此科目" }, 404);
  });

  const writeCheats = async (c: Context, mutate: (subject: string, cards: StoredCard[], body: Record<string, unknown>) => void) => {
    const subject = c.req.param("subject")!;
    if (!indexer.hasSubject(subject)) return c.json({ error: "找不到此科目" }, 404);
    const body: Record<string, unknown> = c.req.method === "DELETE" ? {} : await c.req.json().catch(() => ({}));
    try {
      await indexer.cheats.update(subject, (cards) => mutate(subject, cards, body));
    } catch (error) {
      if (error instanceof CheatError) return c.json({ error: error.message }, error.status);
      throw error;
    }
    return c.json(indexer.getCheats(subject));
  };

  app.post("/cheats/:subject/cards", (c) => writeCheats(c, (subject, cards, body) => addCard(subject, cards, body.ref, today())));
  app.delete("/cheats/:subject/cards/:id", (c) => writeCheats(c, (_subject, cards) => removeCard(cards, c.req.param("id")!)));
  app.patch("/cheats/:subject/cards/:id", (c) => writeCheats(c, (subject, cards, body) => repointCard(subject, cards, c.req.param("id")!, body.ref)));
  app.put("/cheats/:subject/order", (c) => writeCheats(c, (_subject, cards, body) => reorderCards(cards, body.ids)));

  return app;
}
