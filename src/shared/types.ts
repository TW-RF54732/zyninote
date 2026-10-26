// Types shared by the pipeline, the server API and the client.

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
  /** Raw target as written in the source. */
  target: string;
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
  diagnostics: Diagnostic[];
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
  page: Page | null;
};

export type UpdateEvent = {
  /** Content-relative paths of pages whose output changed. */
  changed: string[];
};
