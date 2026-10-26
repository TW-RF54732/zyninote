// Tags: each note lists its own tags (frontmatter `tags:` or TSX `export const meta = { tags }`), and the subject's
// _subject.md registers the tags the subject uses. Edits rewrite only the `tags` entry and leave the rest of the file as written.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Diagnostic, Format, Page } from "../shared/types.ts";
import { readFrontmatter, toStringList } from "./meta.ts";
import { scanContent } from "./scan.ts";

export const SUBJECT_FILE = "_subject.md";

/** A request the API turns into an HTTP error. */
export class TagError extends Error {
  constructor(
    public status: 400 | 404 | 409,
    message: string,
    /** For 409 on an unregistered tag: the tags that need registering. */
    public unregistered?: string[],
  ) {
    super(message);
  }
}

/** Trims a tag and rejects ones that cannot be written back safely. */
export function normalizeTag(raw: unknown): string {
  if (typeof raw !== "string") throw new TagError(400, "tag 必須是字串");
  const tag = raw.normalize("NFC").trim();
  if (!tag) throw new TagError(400, "tag 不能是空白");
  if (/[\u0000-\u001f\u007f]/.test(tag)) throw new TagError(400, `tag「${tag}」含有控制字元`);
  if (tag.length > 40) throw new TagError(400, `tag「${tag}」太長（最多 40 字）`);
  return tag;
}

export function normalizeTagList(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new TagError(400, "tags 必須是陣列");
  return [...new Set(raw.map(normalizeTag))];
}

/** Tags of a source file as written; for md/mdx this is exactly what the indexer reads from the frontmatter. */
export function readTags(source: string, format: Format): string[] {
  if (format !== "tsx") return toStringList(readFrontmatter(source).data.tags);
  const meta = findTsxMeta(source);
  if (!meta) return [];
  const array = findTsxTags(source, meta);
  return array ? array.tags : [];
}

/** `source` with its tag list replaced by `tags`. Throws when the file's tags cannot be rewritten safely. */
export function writeTags(source: string, format: Format, tags: string[]): string {
  const next = format === "tsx" ? writeTsxTags(source, tags) : writeFrontmatterTags(source, tags);
  if (!isDeepStrictEqual(readTags(next, format), tags)) throw new TagError(400, "無法自動修改這個檔案的 tags，請手動編輯");
  return next;
}

// ---- Markdown / MDX frontmatter ----

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function writeFrontmatterTags(source: string, tags: string[]): string {
  const line = `tags: [${tags.map(yamlScalar).join(", ")}]`;
  const match = FRONTMATTER.exec(source);
  if (!match) return `---\n${line}\n---\n\n${source}`;

  const before = readFrontmatter(source).data;
  const eol = match[0].includes("\r\n") ? "\r\n" : "\n";
  const lines = match[1].split(/\r?\n/);
  const at = lines.findIndex((l) => /^tags[ \t]*:/.test(l));
  if (at < 0) {
    const title = lines.findIndex((l) => /^title[ \t]*:/.test(l));
    lines.splice(title < 0 ? lines.length : title + 1, 0, line);
  } else {
    // The value may continue on following lines: a block list (`- a`) or a flow list spread over several lines.
    const value = lines[at].replace(/^tags[ \t]*:/, "").replace(/\s#.*$/, "").trim();
    let end = at + 1;
    if (!value) while (end < lines.length && /^([ \t]+\S|-([ \t]|$))/.test(lines[end])) end++;
    else if (value.startsWith("[") && !value.includes("]")) {
      while (end < lines.length && !lines[end].includes("]")) end++;
      end = Math.min(end + 1, lines.length);
    }
    lines.splice(at, end - at, line);
  }
  const head = source.slice(0, source.indexOf("\n") + 1);
  const tail = source.slice(match[0].length);
  const closing = match[0].slice(match[0].lastIndexOf("---"));
  const next = `${head}${lines.join(eol)}${eol}${closing}${tail}`;

  // Everything but `tags` must read back exactly as before.
  const { tags: _old, ...rest } = before;
  const { tags: _new, ...after } = readFrontmatter(next).data;
  if (!isDeepStrictEqual(rest, after)) throw new TagError(400, "無法自動修改這個檔案的 frontmatter，請手動編輯 tags");
  return next;
}

/** A YAML flow scalar: plain when it reads back as the same string, double-quoted (JSON is valid YAML) otherwise. */
function yamlScalar(tag: string): string {
  const plain = /^[\p{L}\p{N}_][\p{L}\p{N}_\-. ]*$/u.test(tag) && !/ $/.test(tag) && !/^([-+.\d_eE]+|true|false|yes|no|on|off|null|~|y|n)$/i.test(tag);
  return plain ? tag : JSON.stringify(tag);
}

// ---- TSX `export const meta = { ... }` ----

type Span = { start: number; end: number };

/** The object literal of `export const meta = {...}`, from `{` to just past `}`. */
function findTsxMeta(source: string): Span | null {
  const match = /export\s+const\s+meta\s*(?::[^=]+)?=\s*\{/.exec(source);
  if (!match) return null;
  const start = match.index + match[0].length - 1;
  const end = matchBracket(source, start);
  return end < 0 ? null : { start, end };
}

/** The `tags: [...]` array directly inside the meta object, with its parsed strings. */
function findTsxTags(source: string, meta: Span): (Span & { tags: string[] }) | null {
  let depth = 0;
  for (let i = meta.start + 1; i < meta.end - 1; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(source, i) - 1;
      continue;
    }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    if (depth !== 0) continue;
    const key = /^(?:tags|"tags"|'tags')\s*:\s*/.exec(source.slice(i, i + 16));
    if (!key || /[\w$]/.test(source[i - 1])) continue;
    const start = i + key[0].length;
    if (source[start] !== "[") throw new TagError(400, "meta.tags 必須是字串陣列，才能自動修改");
    const end = matchBracket(source, start);
    if (end < 0) throw new TagError(400, "meta.tags 的格式無法辨識");
    return { start, end, tags: parseStringArray(source.slice(start + 1, end - 1)) };
  }
  return null;
}

function writeTsxTags(source: string, tags: string[]): string {
  const meta = findTsxMeta(source);
  if (!meta) throw new TagError(400, "找不到 export const meta = { ... }，無法自動修改 tags");
  const array = `[${tags.map((t) => JSON.stringify(t)).join(", ")}]`;
  const existing = findTsxTags(source, meta);
  if (existing) return source.slice(0, existing.start) + array + source.slice(existing.end);
  // No `tags` yet: add it as the first property, on its own line when the object spans several lines.
  const open = meta.start + 1;
  const newline = /^[ \t]*(\r?\n)([ \t]*)/.exec(source.slice(open));
  if (!newline) return `${source.slice(0, open)} tags: ${array},${source.slice(open)}`;
  const at = open + newline[0].length - newline[2].length;
  return `${source.slice(0, at)}${newline[2]}tags: ${array},${newline[1]}${source.slice(at)}`;
}

/** Index just past the bracket closing the one at `open`, skipping strings; -1 when unbalanced. */
function matchBracket(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '"' || c === "'" || c === "`") {
      i = skipString(source, i) - 1;
      continue;
    }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** Index just past the string literal starting at `at`. */
function skipString(source: string, at: number): number {
  const quote = source[at];
  for (let i = at + 1; i < source.length; i++) {
    if (source[i] === "\\") i++;
    else if (source[i] === quote) return i + 1;
  }
  return source.length;
}

/** Contents of an array literal holding only string literals. */
function parseStringArray(body: string): string[] {
  const tags: string[] = [];
  const item = /\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\$]|\\.)*`)\s*(?:,|$)/y;
  const blank = /\s*$/y;
  let at = 0;
  while (at < body.length) {
    blank.lastIndex = at;
    if (blank.test(body)) break;
    item.lastIndex = at;
    const match = item.exec(body);
    if (!match) throw new TagError(400, "meta.tags 只能包含字串，才能自動修改");
    tags.push(parseJsString(match[1]));
    at = item.lastIndex;
  }
  return tags;
}

function parseJsString(literal: string): string {
  const inner = literal.slice(1, -1);
  try {
    if (literal[0] === '"') return JSON.parse(literal);
    return JSON.parse(`"${inner.replace(/\\(['`])/g, "$1").replace(/(^|[^\\])"/g, '$1\\"')}"`);
  } catch {
    throw new TagError(400, `無法解析 tag 字串 ${literal}`);
  }
}

// ---- Registry check ----

/** Warnings for tags that notes use but their subject's _subject.md does not register. */
export function checkTags(pages: Page[], registered: (subject: string) => string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const page of pages) {
    if (!page.slug) continue;
    const known = new Set(registered(page.subject));
    for (const tag of page.meta.tags) {
      if (!known.has(tag)) diagnostics.push({ level: "warning", path: page.path, message: `未註冊的 tag「${tag}」：請加入 ${page.subject}/${SUBJECT_FILE} 的 tags` });
    }
  }
  return diagnostics;
}

// ---- Writes ----

type Edit = { file: string; next: string };

/**
 * Tag writes for one subject touch several files (the notes and _subject.md). Every new file content is computed
 * first, so a file that cannot be rewritten aborts the whole operation before anything is written.
 */
export class TagStore {
  private queues = new Map<string, Promise<unknown>>();

  /** `indexedTags` gives a note's tags as the indexer evaluated them, for notes whose source cannot be read here. */
  constructor(
    private contentDir: string,
    private indexedTags: (path: string) => string[] | undefined = () => undefined,
  ) {}

  /** Sets a note's tags. Unregistered tags are refused unless `register`, which adds them to _subject.md. */
  setNoteTags(subject: string, slug: string, rawTags: unknown, register: boolean) {
    return this.run(subject, (ctx) => {
      const tags = normalizeTagList(rawTags);
      const note = ctx.notes.find((n) => n.slug === slug);
      if (!note) throw new TagError(404, "找不到此筆記");
      const missing = tags.filter((t) => !ctx.registry.includes(t));
      if (missing.length && !register) throw new TagError(409, `未註冊的 tag：${missing.join("、")}`, missing);
      if (missing.length) ctx.setRegistry([...ctx.registry, ...missing]);
      ctx.setNote(note, tags);
    });
  }

  register(subject: string, rawTag: unknown) {
    return this.run(subject, (ctx) => {
      const tag = normalizeTag(rawTag);
      if (ctx.registry.includes(tag)) throw new TagError(409, `「${tag}」已經註冊`);
      ctx.setRegistry([...ctx.registry, tag]);
    });
  }

  /** Renames `from` to `to` in every note and the registry; when `to` already exists the two tags are merged. */
  rename(subject: string, rawFrom: unknown, rawTo: unknown) {
    return this.run(subject, (ctx) => {
      const from = normalizeTag(rawFrom);
      const to = normalizeTag(rawTo);
      if (from === to) throw new TagError(400, "新名稱與原名稱相同");
      const replace = (tags: string[]) => [...new Set(tags.map((t) => (t === from ? to : t)))];
      let used = ctx.registry.includes(from);
      for (const note of ctx.notes) {
        if (!note.tags.includes(from)) continue;
        used = true;
        ctx.setNote(note, replace(note.tags));
      }
      if (!used) throw new TagError(404, `本科目沒有 tag「${from}」`);
      // A tag in use but never registered becomes registered under its new name.
      ctx.setRegistry(ctx.registry.includes(from) ? replace(ctx.registry) : [...new Set([...ctx.registry, to])]);
    });
  }

  /** Removes a tag from every note and from the registry. */
  remove(subject: string, rawTag: unknown) {
    return this.run(subject, (ctx) => {
      const tag = normalizeTag(rawTag);
      let used = ctx.registry.includes(tag);
      for (const note of ctx.notes) {
        if (!note.tags.includes(tag)) continue;
        used = true;
        ctx.setNote(
          note,
          note.tags.filter((t) => t !== tag),
        );
      }
      if (!used) throw new TagError(404, `本科目沒有 tag「${tag}」`);
      ctx.setRegistry(ctx.registry.filter((t) => t !== tag));
    });
  }

  private run(subject: string, plan: (ctx: PlanContext) => void): Promise<{ files: string[] }> {
    const run = async () => {
      const ctx = this.context(subject);
      plan(ctx);
      for (const { file, next } of ctx.edits.values()) {
        // Dot-prefixed, so the scanner and the watcher-triggered sync ignore it.
        const temp = join(dirname(file), `.${basename(file)}.tmp`);
        writeFileSync(temp, next);
        renameSync(temp, file);
      }
      return { files: [...ctx.edits.keys()] };
    };
    const next = (this.queues.get(subject) ?? Promise.resolve()).then(run, run);
    this.queues.set(
      subject,
      next.catch(() => {}),
    );
    return next;
  }

  /** Reads the subject's files fresh from disk. */
  private context(subject: string): PlanContext {
    const dir = scanContent(this.contentDir).subjects.find((s) => s.name === subject);
    if (!dir) throw new TagError(404, "找不到此科目");
    const edits = new Map<string, Edit>();
    const read = (path: string) => readFileSync(join(this.contentDir, path), "utf8");

    const registryPath = `${subject}/${SUBJECT_FILE}`;
    const registrySource = dir.subjectFile ? read(registryPath) : null;
    const ctx: PlanContext = {
      registry: registrySource === null ? [] : readTags(registrySource, "md"),
      notes: dir.notes.map((n) => {
        const source = read(n.path);
        try {
          return { ...n, source, tags: readTags(source, n.format), unreadable: null };
        } catch (error) {
          // Only an operation that has to rewrite this note fails.
          if (!(error instanceof TagError)) throw error;
          return { ...n, source, tags: this.indexedTags(n.path) ?? [], unreadable: error };
        }
      }),
      edits,
      setRegistry: (tags) => {
        if (isDeepStrictEqual(tags, ctx.registry)) return;
        // A subject without _subject.md gets one holding just the registry.
        const next = registrySource === null ? `---\ntitle: ${subject}\ntags: [${tags.map(yamlScalar).join(", ")}]\n---\n` : writeTags(registrySource, "md", tags);
        edits.set(registryPath, { file: join(this.contentDir, registryPath), next });
      },
      setNote: (note, tags) => {
        if (isDeepStrictEqual(tags, note.tags)) return;
        try {
          if (note.unreadable) throw note.unreadable;
          edits.set(note.path, { file: join(this.contentDir, note.path), next: writeTags(note.source, note.format, tags) });
        } catch (error) {
          if (error instanceof TagError) throw new TagError(error.status, `${note.path}：${error.message}`);
          throw error;
        }
      },
    };
    return ctx;
  }
}

type PlanNote = { path: string; slug: string; format: Format; source: string; tags: string[]; unreadable: TagError | null };

type PlanContext = {
  registry: string[];
  notes: PlanNote[];
  edits: Map<string, Edit>;
  setRegistry: (tags: string[]) => void;
  setNote: (note: PlanNote, tags: string[]) => void;
};
