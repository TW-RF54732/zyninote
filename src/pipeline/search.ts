// Full-text search over the index's blocks. Every section is one document; each page adds one more for its title,
// summary and tags. Matching is case- and width-insensitive substring search, so Chinese needs no word segmentation.
import { pageKeyOf, pageUrl } from "../shared/links.ts";
import type { Page, SearchHit, SearchResponse, SearchText } from "../shared/types.ts";

export type SearchDoc = {
  subject: string;
  subjectTitle: string;
  page: string;
  pageTitle: string;
  section: { id: string; title: string } | null;
  /** The heading (or page title), the block's own text, and the page title as context for sections. */
  title: string;
  text: string;
  context: string;
  folded: { title: string; text: string; context: string };
};

/** Documents in reading order: pages as given, then each page's sections in document order. */
export function buildSearchDocs(pages: Page[], subjectTitle: (subject: string) => string): SearchDoc[] {
  const docs: SearchDoc[] = [];
  const add = (doc: Omit<SearchDoc, "folded">) => docs.push({ ...doc, folded: { title: fold(doc.title), text: fold(doc.text), context: fold(doc.context) } });
  for (const page of pages) {
    const key = pageKeyOf(page.path);
    const title = page.slug ? page.meta.title : subjectTitle(page.subject);
    const summary = page.slug ? page.meta.summary : page.subjectMeta?.summary;
    const base = { subject: page.subject, subjectTitle: subjectTitle(page.subject), page: key, pageTitle: title };
    add({ ...base, section: null, title, text: [summary, ...(page.slug ? page.meta.tags : [])].filter(Boolean).join("\n"), context: "" });
    for (const section of page.sections) {
      add({ ...base, section: { id: section.id, title: section.title }, title: section.title, text: section.text, context: title });
    }
  }
  return docs;
}

const SNIPPET = 140;
const SNIPPET_LEAD = 30;

/** Every term must appear in the block's heading, text or page title. Ties keep reading order. */
export function search(docs: SearchDoc[], query: string, opts: { subject?: string; limit?: number } = {}): SearchResponse {
  const terms = [...new Set(fold(query).split(/\s+/).filter(Boolean))].slice(0, 8);
  if (!terms.length) return { query, hits: [], total: 0 };
  const whole = fold(query.trim());

  const scored: { doc: SearchDoc; score: number }[] = [];
  for (const doc of docs) {
    if (opts.subject && doc.subject !== opts.subject) continue;
    const { title, text, context } = doc.folded;
    let score = 0;
    let all = true;
    for (const term of terms) {
      const inTitle = title.includes(term);
      const inText = count(text, term, 5);
      const inContext = context.includes(term);
      if (!inTitle && !inText && !inContext) {
        all = false;
        break;
      }
      score += (inTitle ? 10 + (title.startsWith(term) ? 5 : 0) : 0) + inText + (inContext ? 2 : 0);
    }
    if (!all) continue;
    if (title === whole) score += 20;
    // A page's own entry only wins when the query is about the page itself.
    if (!doc.section) score -= 1;
    scored.push({ doc, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const hits = scored.slice(0, opts.limit ?? 50).map(({ doc }): SearchHit => ({
    subject: doc.subject,
    subjectTitle: doc.subjectTitle,
    page: doc.page,
    pageTitle: doc.pageTitle,
    section: doc.section,
    url: pageUrl(doc.page, doc.section?.id),
    title: { text: doc.title, matches: ranges(doc.folded.title, terms, 0, doc.title.length) },
    snippet: snippet(doc, terms),
  }));
  return { query, hits, total: scored.length };
}

function snippet(doc: SearchDoc, terms: string[]): SearchText & { before: boolean; after: boolean } {
  const text = doc.folded.text;
  let first = -1;
  for (const term of terms) {
    const at = text.indexOf(term);
    if (at >= 0 && (first < 0 || at < first)) first = at;
  }
  const start = first <= SNIPPET_LEAD ? 0 : first - SNIPPET_LEAD;
  const end = Math.min(doc.text.length, start + SNIPPET);
  return {
    text: doc.text.slice(start, end).replace(/\s/g, " "),
    matches: ranges(text, terms, start, end).map(([a, b]) => [a - start, b - start]),
    before: start > 0,
    after: end < doc.text.length,
  };
}

/** Sorted, merged [start, end) ranges of every term occurring within [from, to). */
function ranges(folded: string, terms: string[], from: number, to: number): [number, number][] {
  const found: [number, number][] = [];
  for (const term of terms) {
    for (let at = folded.indexOf(term, from); at >= 0 && at < to; at = folded.indexOf(term, at + term.length)) {
      found.push([at, Math.min(at + term.length, to)]);
    }
  }
  found.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const range of found) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return merged;
}

function count(text: string, term: string, max: number): number {
  let n = 0;
  for (let at = text.indexOf(term); at >= 0 && n < max; at = text.indexOf(term, at + term.length)) n++;
  return n;
}

/**
 * Lowercase plus NFKC (full-width ＡＢＣ and １２３ match ASCII), character by character so the result has exactly
 * the same length as the input and match offsets apply to the original text.
 */
export function fold(text: string): string {
  let out = "";
  for (const ch of text) {
    const folded = ch.normalize("NFKC").toLowerCase();
    if (folded.length === ch.length) out += folded;
    else {
      const lower = ch.toLowerCase();
      out += lower.length === ch.length ? lower : ch;
    }
  }
  return out;
}
