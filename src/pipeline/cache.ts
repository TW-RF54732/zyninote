// Derived data only. Everything here can be deleted and rebuilt from content/.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Page } from "../shared/types.ts";

/** Bump whenever rendering or segmenting output changes, to invalidate existing caches. */
export const PIPELINE_VERSION = 3;

export type CacheEntry = {
  hash: string;
  /** Dependency path (relative to the project root) → content hash at build time. */
  deps: Record<string, string>;
};

type Manifest = {
  pipelineVersion: number;
  /** Hash of the installed dependency tree; renderers (remark-math, KaTeX, ...) change output without a source change. */
  installed: string;
  entries: Record<string, CacheEntry>;
};

export class Cache {
  private installed: string;

  /** `root` is the project root, whose `node_modules/.package-lock.json` records what npm actually installed. */
  constructor(private dir: string, root: string) {
    this.installed = installedHash(root);
  }

  loadEntries(): Record<string, CacheEntry> {
    try {
      const manifest = JSON.parse(readFileSync(join(this.dir, "manifest.json"), "utf8")) as Manifest;
      return manifest.pipelineVersion === PIPELINE_VERSION && manifest.installed === this.installed ? manifest.entries : {};
    } catch {
      return {};
    }
  }

  saveEntries(entries: Record<string, CacheEntry>) {
    this.write("manifest.json", JSON.stringify({ pipelineVersion: PIPELINE_VERSION, installed: this.installed, entries } satisfies Manifest));
  }

  readPage(path: string): Page | null {
    try {
      return JSON.parse(readFileSync(this.pageFile(path), "utf8")) as Page;
    } catch {
      return null;
    }
  }

  writePage(page: Page) {
    this.write(join("pages", `${page.path}.json`), JSON.stringify(page));
  }

  removePage(path: string) {
    rmSync(this.pageFile(path), { force: true });
  }

  private pageFile(path: string) {
    return join(this.dir, "pages", `${path}.json`);
  }

  private write(name: string, data: string) {
    const file = join(this.dir, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, data);
  }
}

function installedHash(root: string): string {
  for (const file of ["node_modules/.package-lock.json", "package-lock.json"]) {
    try {
      return createHash("sha1").update(readFileSync(join(root, file))).digest("hex").slice(0, 16);
    } catch {}
  }
  return "";
}
