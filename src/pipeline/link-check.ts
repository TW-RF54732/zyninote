// Cross-page link analysis: broken links, invalid paths and backlinks. Runs over the whole index after every sync,
// because a page's links can break (or heal) without the page itself changing.
import { pageKeyOf, pageUrl } from "../shared/links.ts";
import type { Backlink, Diagnostic, Page, PageLink } from "../shared/types.ts";

export type LinkIndex = {
  diagnostics: Diagnostic[];
  /** Target page key → pages linking to it. */
  backlinks: Map<string, Backlink[]>;
  /** Source page path → `ref`s of its broken or invalid links. */
  broken: Map<string, string[]>;
};

export type LinkCheckInput = {
  pages: Page[];
  /** Keys of pages that exist without a source file: the root ("") and subjects without _subject.md. */
  virtualPages: string[];
  subjectTitle: (subject: string) => string;
  /** Whether a content-relative path is an existing file. */
  fileExists: (path: string) => boolean;
};

export function checkLinks({ pages, virtualPages, subjectTitle, fileExists }: LinkCheckInput): LinkIndex {
  const byKey = new Map(pages.map((page) => [pageKeyOf(page.path), page]));
  const virtual = new Set(virtualPages);
  const diagnostics: Diagnostic[] = [];
  const broken = new Map<string, string[]>();
  const backlinks = new Map<string, Map<string, Backlink>>();

  const problemOf = (page: Page, link: PageLink): Pick<Diagnostic, "level" | "message"> | null => {
    const { ref, target } = link;
    if (target.kind === "error") {
      return target.error === "outside"
        ? { level: "error", message: `連結「${ref}」超出 content/，已停用` }
        : { level: "error", message: `連結「${ref}」不是相對路徑，已停用` };
    }
    if (target.kind === "file") return fileExists(target.file) ? null : { level: "warning", message: `斷鏈：找不到檔案「${ref}」` };
    const targetPage = target.page === pageKeyOf(page.path) ? page : byKey.get(target.page);
    if (!targetPage && !virtual.has(target.page)) return { level: "warning", message: `斷鏈：找不到頁面「${ref}」` };
    if (!target.id) return null;
    // A page that failed to render has no sections; its own error is reported already.
    if (targetPage && !targetPage.sections.length && targetPage.diagnostics.some((d) => d.level === "error")) return null;
    if (targetPage?.sections.some((s) => s.id === target.id)) return null;
    return { level: "warning", message: `斷鏈：「${ref}」找不到標題 #${target.id}` };
  };

  for (const page of pages) {
    const sourceKey = pageKeyOf(page.path);
    const reported = new Set<string>();
    for (const link of page.links) {
      const problem = problemOf(page, link);
      if (problem) {
        if (reported.has(link.ref)) continue;
        reported.add(link.ref);
        diagnostics.push({ ...problem, path: page.path });
        broken.set(page.path, [...(broken.get(page.path) ?? []), link.ref]);
        continue;
      }
      const { target } = link;
      if (target.kind !== "page" || target.page === sourceKey) continue;

      const forTarget = backlinks.get(target.page) ?? new Map<string, Backlink>();
      backlinks.set(target.page, forTarget);
      let entry = forTarget.get(sourceKey);
      if (!entry) {
        entry = { page: sourceKey, url: pageUrl(sourceKey), title: page.meta.title, subjectTitle: subjectTitle(page.subject), refs: [] };
        forTarget.set(sourceKey, entry);
      }
      const from = link.section ? { id: link.section, title: titleOf(page, link.section) } : null;
      const targetPage = byKey.get(target.page);
      const to = target.id ? { id: target.id, title: targetPage ? titleOf(targetPage, target.id) : target.id } : null;
      if (!entry.refs.some((r) => r.from?.id === from?.id && r.to?.id === to?.id)) entry.refs.push({ from, to });
    }
  }

  const sorted = new Map<string, Backlink[]>();
  for (const [key, entries] of backlinks) {
    sorted.set(
      key,
      [...entries.values()].sort((a, b) => a.page.localeCompare(b.page, undefined, { numeric: true })),
    );
  }
  return { diagnostics, backlinks: sorted, broken };
}

function titleOf(page: Page, id: string): string {
  return page.sections.find((s) => s.id === id)?.title ?? id;
}
