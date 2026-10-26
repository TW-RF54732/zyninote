// Types shared by the pipeline, the server API and the client.
import type { ResolvedLink } from "./links.ts";

export type Format = "md" | "mdx" | "tsx";

export type PageMeta = {
  title: string;
  tags: string[];
  order?: number;
  summary?: string;
  links?: "visible";
};

export type SubjectMeta = {
  title: string;
  /** Tags registered for this subject (`tags:` in _subject.md), in the order written. */
  tags: string[];
  summary?: string;
  order?: number;
};

export type LinkRef = {
  /** Target as written in the source, e.g. "ch2-tcp.mdx#tcp-flags". */
  ref: string;
  /** Wikilinks are quiet; Markdown links and TSX `<Link>` are visible unless `quiet`. */
  style: "quiet" | "visible";
  target: ResolvedLink;
};

export type PageLink = LinkRef & {
  /** Id of the section the link sits in; null for content before the first heading. */
  section: string | null;
};

export type Section = {
  id: string;
  level: number;
  title: string;
  fold: boolean;
  /** Rendered HTML of the whole block, including nested sections. */
  html: string;
  /** Plain text of this block's own content (excluding child sections), including interactive component descriptions. */
  text: string;
  /** Links in this block's own content (excluding child sections). */
  links: LinkRef[];
  /** Ids of direct child sections. */
  children: string[];
};

export type TocItem = {
  id: string;
  level: number;
  title: string;
  fold: boolean;
  children: TocItem[];
};

export type Diagnostic = {
  level: "error" | "warning";
  /** Path relative to content/. */
  path: string;
  message: string;
};

export type Page = {
  /** Path relative to content/, e.g. "computer-network/ch1-intro.md". */
  path: string;
  subject: string;
  /** File name without extension; "" for a subject's _subject.md. */
  slug: string;
  format: Format;
  meta: PageMeta;
  /** Only on a subject's _subject.md page. */
  subjectMeta?: SubjectMeta;
  /** Content hash of the source and its dependencies; changes whenever the rendered output may change. */
  hash: string;
  html: string;
  sections: Section[];
  toc: TocItem[];
  /** Every internal link on the page, in document order. */
  links: PageLink[];
  diagnostics: Diagnostic[];
};

export type Backlink = {
  /** Key of the linking page ("subject/slug" or "subject/"). */
  page: string;
  url: string;
  title: string;
  subjectTitle: string;
  refs: {
    /** Section of the linking page that holds the link; null before its first heading. */
    from: { id: string; title: string } | null;
    /** Heading of this page the link points at; null for the page as a whole. */
    to: { id: string; title: string } | null;
  }[];
};

/** A page as served by the API: the cached page plus data that depends on other pages. */
export type PageView = Page & {
  url: string;
  backlinks: Backlink[];
  /** `ref`s of this page's links whose target is missing or invalid. */
  broken: string[];
};

export type NoteSummary = {
  path: string;
  slug: string;
  format: Format;
  url: string;
  meta: PageMeta;
  toc: TocItem[];
};

export type SubjectSummary = {
  name: string;
  url: string;
  meta: SubjectMeta;
  notes: NoteSummary[];
};

export type Tree = {
  subjects: SubjectSummary[];
  diagnostics: Diagnostic[];
};

export type SubjectResponse = {
  subject: SubjectSummary;
  /** Rendered _subject.md, or null when the subject has none. */
  page: PageView | null;
};

export type UpdateEvent = {
  /** Content-relative paths of pages whose output changed. */
  changed: string[];
};

/** A cheat sheet card as served by the API: the stored card plus what its `ref` points at in the current index. */
export type CheatCardView = {
  id: string;
  /** Relative to the subject's _cheats.json, e.g. "ch2-tcp.mdx#tcp-flags". */
  ref: string;
  added?: string;
  /** Page key the ref resolves to, even when that page or heading is missing; null for invalid paths. */
  page: string | null;
  sectionId: string | null;
  url: string | null;
  pageTitle: string | null;
  sectionTitle: string | null;
  /** Tags of the source page, for the advance filter. */
  tags: string[];
  /** Why the card cannot be shown ("來源已失效"); null when it is valid. */
  problem: string | null;
};

export type CheatSheetView = {
  subject: string;
  cards: CheatCardView[];
  /** Set when _cheats.json cannot be parsed; writes are refused until it is fixed. */
  error: string | null;
};

/** Text with [start, end) ranges of the query's matches. */
export type SearchText = { text: string; matches: [number, number][] };

/** One block found by search: a section, or a page's own entry (title, summary and tags) when `section` is null. */
export type SearchHit = {
  subject: string;
  subjectTitle: string;
  /** Page key. */
  page: string;
  pageTitle: string;
  section: { id: string; title: string } | null;
  url: string;
  /** The heading, or the page title for a page's own entry. */
  title: SearchText;
  /** A window of the block's text around the first match; `before`/`after` say whether text was cut off. */
  snippet: SearchText & { before: boolean; after: boolean };
};

export type SearchResponse = {
  query: string;
  hits: SearchHit[];
  /** Number of matching blocks, which may exceed `hits`. */
  total: number;
};

/** A tag write's answer: content-relative paths of the files rewritten. */
export type TagWriteResult = { files: string[] };
