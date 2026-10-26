// Derived data only. Everything here can be deleted and rebuilt from content/.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Page } from "../shared/types.ts";

/** Bump whenever rendering or segmenting output changes, to invalidate existing caches. */
export const PIPELINE_VERSION = 2;

export type CacheEntry = {
  hash: string;
  /** Dependency path (relative to the project root) → content hash at build time. */
  deps: Record<string, string>;
};

type Manifest = {
  pipelineVersion: number;
  entries: Record<string, CacheEntry>;
};

export class Cache {
  constructor(private dir: string) {}

  loadEntries(): Record<string, CacheEntry> {
    try {
      const manifest = JSON.parse(readFileSync(join(this.dir, "manifest.json"), "utf8")) as Manifest;
      return manifest.pipelineVersion === PIPELINE_VERSION ? manifest.entries : {};
    } catch {
      return {};
    }
  }

  saveEntries(entries: Record<string, CacheEntry>) {
    this.write("manifest.json", JSON.stringify({ pipelineVersion: PIPELINE_VERSION, entries } satisfies Manifest));
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
