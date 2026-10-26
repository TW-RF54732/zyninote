import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { ViteDevServer } from "vite";
import type { Diagnostic, Format, NoteSummary, Page, SubjectResponse, SubjectSummary, Tree } from "../shared/types.ts";
import { Cache, type CacheEntry } from "./cache.ts";
import { normalizePageMeta, normalizeSubjectMeta, readFrontmatter } from "./meta.ts";
import { renderMarkdown } from "./render-md.ts";
import { renderModule } from "./render-module.ts";
import { compareByOrder, scanContent, type ScanResult } from "./scan.ts";
import { segment } from "./segment.ts";

type Source = { path: string; subject: string; slug: string; format: Format; isSubject: boolean };

export type SyncResult = {
  /** Content-relative paths whose page was rebuilt or removed. */
  changed: string[];
  diagnostics: Diagnostic[];
  ms: number;
};

/**
 * Keeps the in-memory index in step with content/. `sync()` is used both at startup and after file changes:
 * it rescans the layout and rebuilds only pages whose source or dependencies changed, reusing the disk cache otherwise.
 */
export class Indexer {
  private pages = new Map<string, Page>();
  private entries: Record<string, CacheEntry>;
  private scan: ScanResult = { subjects: [], diagnostics: [] };
  private cache: Cache;
  private fileHashes = new Map<string, { mtimeMs: number; size: number; hash: string }>();

  constructor(private opts: { root: string; contentDir: string; cacheDir: string; vite: ViteDevServer }) {
    this.cache = new Cache(opts.cacheDir);
    this.entries = this.cache.loadEntries();
  }

  async sync(): Promise<SyncResult> {
    const start = performance.now();
    this.scan = scanContent(this.opts.contentDir);
    const sources = this.sources();
    const changed: string[] = [];
    const diagnostics: Diagnostic[] = [];

    for (const source of sources) {
      const hash = this.hashFile(join(this.opts.contentDir, source.path));
      const entry = this.entries[source.path];
      if (entry && entry.hash === hash && this.depsUnchanged(entry.deps)) {
        const cached = this.pages.get(source.path) ?? this.cache.readPage(source.path);
        if (cached) {
          this.pages.set(source.path, cached);
          continue;
        }
      }
      const { page, deps, ok } = await this.build(source, hash);
      this.pages.set(source.path, page);
      // A failed build keeps an empty hash so it is retried on every sync (a broken dependency may get fixed).
      this.entries[source.path] = { hash: ok ? hash : "", deps };
      if (ok) this.cache.writePage(page);
      else this.cache.removePage(page.path);
      changed.push(source.path);
      diagnostics.push(...page.diagnostics);
    }

    const live = new Set(sources.map((s) => s.path));
    for (const path of [...this.pages.keys(), ...Object.keys(this.entries)]) {
      if (live.has(path)) continue;
      this.pages.delete(path);
      delete this.entries[path];
      this.cache.removePage(path);
      if (!changed.includes(path)) changed.push(path);
    }

    if (changed.length) this.cache.saveEntries(this.entries);
    return { changed, diagnostics, ms: performance.now() - start };
  }

  getTree(): Tree {
    const subjects = this.scan.subjects
      .map((dir) => this.subjectSummary(dir.name)!)
      .sort((a, b) => compareByOrder({ order: a.meta.order, name: a.name }, { order: b.meta.order, name: b.name }));
    return { subjects, diagnostics: this.allDiagnostics() };
  }

  getSubject(name: string): SubjectResponse | null {
    const dir = this.scan.subjects.find((s) => s.name === name);
    if (!dir) return null;
    return { subject: this.subjectSummary(name)!, page: dir.subjectFile ? (this.pages.get(dir.subjectFile) ?? null) : null };
  }

  getPage(subject: string, slug: string): Page | null {
    const note = this.scan.subjects.find((s) => s.name === subject)?.notes.find((n) => n.slug === slug);
    return note ? (this.pages.get(note.path) ?? null) : null;
  }

  allDiagnostics(): Diagnostic[] {
    return [...this.scan.diagnostics, ...[...this.pages.values()].flatMap((p) => p.diagnostics)];
  }

  private subjectSummary(name: string): SubjectSummary | null {
    const dir = this.scan.subjects.find((s) => s.name === name);
    if (!dir) return null;
    const subjectPage = dir.subjectFile ? this.pages.get(dir.subjectFile) : undefined;
    const notes: NoteSummary[] = [];
    for (const note of dir.notes) {
      const page = this.pages.get(note.path);
      if (!page) continue;
      notes.push({ path: note.path, slug: note.slug, format: note.format, url: `/${name}/${note.slug}`, meta: page.meta, toc: page.toc });
    }
    notes.sort((a, b) => compareByOrder({ order: a.meta.order, name: a.slug }, { order: b.meta.order, name: b.slug }));
    return { name, url: `/${name}/`, meta: subjectPage?.subjectMeta ?? normalizeSubjectMeta(undefined, name), notes };
  }

  private sources(): Source[] {
    return this.scan.subjects.flatMap((dir) => [
      ...(dir.subjectFile ? [{ path: dir.subjectFile, subject: dir.name, slug: "", format: "md" as const, isSubject: true }] : []),
      ...dir.notes.map((n) => ({ ...n, isSubject: false })),
    ]);
  }

  private async build(source: Source, hash: string): Promise<{ page: Page; deps: Record<string, string>; ok: boolean }> {
    const file = join(this.opts.contentDir, source.path);
    const fallbackTitle = source.isSubject ? source.subject : source.slug;
    const page: Page = {
      path: source.path,
      subject: source.subject,
      slug: source.slug,
      format: source.format,
      meta: normalizePageMeta(undefined, fallbackTitle),
      hash,
      html: "",
      sections: [],
      toc: [],
      diagnostics: [],
    };
    const deps: Record<string, string> = {};

    try {
      if (source.format === "md") {
        const { data, body } = readFrontmatter(readFileSync(file, "utf8"));
        page.meta = normalizePageMeta(data, fallbackTitle);
        if (source.isSubject) page.subjectMeta = normalizeSubjectMeta(data, fallbackTitle);
        page.html = await renderMarkdown(body);
      } else {
        const rendered = await renderModule(this.opts.vite, this.opts.root, file);
        page.meta = normalizePageMeta(rendered.meta, fallbackTitle);
        page.html = rendered.html;
        for (const dep of rendered.deps) deps[relative(this.opts.root, dep)] = this.hashFile(dep);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      page.html = `<pre class="zn-error">${escapeHtml(message)}</pre>`;
      page.diagnostics.push({ level: "error", path: source.path, message: `渲染失敗：${message}` });
      return { page, deps, ok: false };
    }

    const segmented = segment(page.html, source.path);
    page.sections = segmented.sections;
    page.toc = segmented.toc;
    page.diagnostics.push(...segmented.diagnostics);
    page.hash = createHash("sha1").update(hash).update(JSON.stringify(deps)).digest("hex").slice(0, 12);
    return { page, deps, ok: true };
  }

  private depsUnchanged(deps: Record<string, string>): boolean {
    return Object.entries(deps).every(([dep, hash]) => {
      try {
        return this.hashFile(join(this.opts.root, dep)) === hash;
      } catch {
        return false;
      }
    });
  }

  private hashFile(file: string): string {
    const stat = statSync(file);
    const known = this.fileHashes.get(file);
    if (known && known.mtimeMs === stat.mtimeMs && known.size === stat.size) return known.hash;
    const hash = createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 16);
    this.fileHashes.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, hash });
    return hash;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
