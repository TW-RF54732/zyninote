// Cheat sheets: each subject's _cheats.json stores card refs and their order, never content.
// Card content is looked up in the index whenever it is shown, so edits to the source show up on the cards.
import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHEATS_FILE, resolveCardRef } from "../shared/cheats.ts";
import { pageUrl } from "../shared/links.ts";
import type { CheatCardView, Diagnostic, Page } from "../shared/types.ts";

/** A card as stored. Unknown fields are kept when the file is rewritten. */
export type StoredCard = Record<string, unknown> & { id: string; ref: string; added?: string };

export type CheatFile = {
  /** Top-level object, kept so unknown fields survive rewrites; `cards` is replaced on write. */
  data: Record<string, unknown>;
  cards: StoredCard[];
  /** Why the file cannot be used; when set, `cards` is empty and writes are refused. */
  error: string | null;
};

/** A request the API turns into an HTTP error. */
export class CheatError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Parses _cheats.json text; a missing file (`null`) is an empty cheat sheet. */
export function parseCheats(text: string | null): CheatFile {
  if (text === null) return { data: {}, cards: [], error: null };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { data: {}, cards: [], error: `JSON 格式錯誤：${(error as Error).message}` };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data) || !Array.isArray((data as { cards?: unknown }).cards)) {
    return { data: {}, cards: [], error: "最外層必須是含有 cards 陣列的物件" };
  }
  const cards = (data as { cards: unknown[] }).cards;
  for (const [i, card] of cards.entries()) {
    const c = card as Partial<StoredCard> | null;
    if (typeof c !== "object" || c === null || Array.isArray(c) || typeof c.id !== "string" || typeof c.ref !== "string") {
      return { data: {}, cards: [], error: `第 ${i + 1} 張卡片必須是含有字串 id 與 ref 的物件` };
    }
  }
  return { data: data as Record<string, unknown>, cards: cards as StoredCard[], error: null };
}

/** Pretty-prints a cheat sheet with one card per line, so reordering and adding make small diffs. */
export function serializeCheats(data: Record<string, unknown>, cards: StoredCard[]): string {
  const fields = Object.entries({ ...data, cards }).map(([key, value]) => {
    if (key !== "cards") return `  ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replace(/\n/g, "\n  ")}`;
    if (!cards.length) return `  "cards": []`;
    const lines = cards.map((card) => `    { ${Object.entries(card).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`);
    return `  "cards": [\n${lines.join(",\n")}\n  ]`;
  });
  return `{\n${fields.join(",\n")}\n}\n`;
}

/** Throws unless `ref` points at a heading of a note page. */
export function assertCardRef(subject: string, ref: unknown): asserts ref is string {
  if (typeof ref !== "string" || !ref) throw new CheatError(400, "缺少 ref");
  const target = resolveCardRef(subject, ref);
  if (target.kind === "error") throw new CheatError(400, target.error === "outside" ? `參照「${ref}」超出 content/` : `參照「${ref}」不是相對路徑`);
  if (target.kind !== "page" || !target.id) throw new CheatError(400, `參照「${ref}」必須指向筆記裡的標題，例如 ch2-tcp.mdx#tcp-flags`);
}

export function addCard(subject: string, cards: StoredCard[], ref: unknown, today: string, randomId = newCardId): StoredCard {
  assertCardRef(subject, ref);
  const taken = new Set(cards.map((c) => c.id));
  let id = randomId(4);
  for (let tries = 0; taken.has(id); tries++) id = randomId(tries < 16 ? 4 : 8);
  const card: StoredCard = { id, ref, added: today };
  cards.push(card);
  return card;
}

export function removeCard(cards: StoredCard[], id: string) {
  const at = cards.findIndex((c) => c.id === id);
  if (at < 0) throw new CheatError(404, "找不到這張卡片");
  cards.splice(at, 1);
}

export function repointCard(subject: string, cards: StoredCard[], id: string, ref: unknown) {
  assertCardRef(subject, ref);
  const card = cards.find((c) => c.id === id);
  if (!card) throw new CheatError(404, "找不到這張卡片");
  card.ref = ref;
}

/** Reorders to `ids`, which must list exactly the current cards; otherwise the file changed since the client read it. */
export function reorderCards(cards: StoredCard[], ids: unknown) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  if (!Array.isArray(ids) || ids.length !== cards.length || byId.size !== cards.length || ids.some((id) => !byId.has(id)) || new Set(ids).size !== ids.length) {
    throw new CheatError(409, "cheat sheet 已在別處被修改，請重新整理後再排序");
  }
  cards.splice(0, cards.length, ...ids.map((id: string) => byId.get(id)!));
}

function newCardId(bytes: number): string {
  return `c_${randomBytes(bytes / 2).toString("hex")}`;
}

/** Local date as YYYY-MM-DD. */
export function today(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * What each card points at in the current index. `pageOf` looks a page up by key.
 * Returns the views plus diagnostics for invalid refs and duplicate ids.
 */
export function describeCards(subject: string, file: CheatFile, pageOf: (key: string) => Page | undefined): { cards: CheatCardView[]; diagnostics: Diagnostic[] } {
  const path = `${subject}/${CHEATS_FILE}`;
  const diagnostics: Diagnostic[] = [];
  if (file.error) diagnostics.push({ level: "error", path, message: `_cheats.json 無法讀取：${file.error}` });

  const seen = new Set<string>();
  const cards = file.cards.map((card): CheatCardView => {
    if (seen.has(card.id)) diagnostics.push({ level: "warning", path, message: `卡片 id「${card.id}」重複` });
    seen.add(card.id);

    const view: CheatCardView = {
      id: card.id,
      ref: card.ref,
      ...(typeof card.added === "string" ? { added: card.added } : {}),
      page: null,
      sectionId: null,
      url: null,
      pageTitle: null,
      sectionTitle: null,
      tags: [],
      problem: null,
    };
    const target = resolveCardRef(subject, card.ref);
    const fail = (level: Diagnostic["level"], problem: string, report = true) => {
      view.problem = problem;
      if (report) diagnostics.push({ level, path, message: `失效參照：${problem}` });
      return view;
    };

    if (target.kind === "error") return fail("error", target.error === "outside" ? `「${card.ref}」超出 content/` : `「${card.ref}」不是相對路徑`);
    if (target.kind !== "page" || !target.id) return fail("warning", `「${card.ref}」沒有指向標題（需要 #id）`);
    view.page = target.page;
    view.sectionId = target.id;
    const page = pageOf(target.page);
    if (!page) return fail("warning", `找不到頁面「${card.ref}」`);
    view.pageTitle = page.meta.title;
    view.tags = page.meta.tags;
    view.url = pageUrl(target.page, target.id);
    const section = page.sections.find((s) => s.id === target.id);
    if (!section) {
      // A page that failed to render has no sections; its own error is reported already.
      const failed = !page.sections.length && page.diagnostics.some((d) => d.level === "error");
      return fail("warning", failed ? `來源頁面「${card.ref}」渲染失敗` : `「${card.ref}」找不到標題 #${target.id}`, !failed);
    }
    view.sectionTitle = section.title;
    return view;
  });
  return { cards, diagnostics };
}

/** Reads and writes subjects' _cheats.json. Writes to one file are serialized and atomic (temp file + rename). */
export class CheatStore {
  private queues = new Map<string, Promise<unknown>>();

  constructor(private contentDir: string) {}

  read(subject: string): CheatFile {
    let text: string | null = null;
    try {
      text = readFileSync(this.file(subject), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return { data: {}, cards: [], error: (error as Error).message };
    }
    return parseCheats(text);
  }

  /** Runs `mutate` on the current cards and writes the result. Refuses to touch a file that does not parse. */
  update<T>(subject: string, mutate: (cards: StoredCard[]) => T): Promise<T> {
    const run = async () => {
      const file = this.read(subject);
      if (file.error) throw new CheatError(409, `_cheats.json 格式錯誤，請先修正：${file.error}`);
      const result = mutate(file.cards);
      const target = this.file(subject);
      // Dot-prefixed, so the scanner and the watcher-triggered sync ignore it.
      const temp = join(this.contentDir, subject, `.${CHEATS_FILE}.tmp`);
      writeFileSync(temp, serializeCheats(file.data, file.cards));
      renameSync(temp, target);
      return result;
    };
    const next = (this.queues.get(subject) ?? Promise.resolve()).then(run, run);
    this.queues.set(
      subject,
      next.catch(() => {}),
    );
    return next;
  }

  private file(subject: string): string {
    return join(this.contentDir, subject, CHEATS_FILE);
  }
}
