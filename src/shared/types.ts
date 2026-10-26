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
