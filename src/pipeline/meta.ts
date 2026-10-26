import matter from "gray-matter";
import type { PageMeta, SubjectMeta } from "../shared/types.ts";

/** Splits frontmatter from Markdown/MDX source. */
export function readFrontmatter(source: string): { data: Record<string, unknown>; body: string } {
  const parsed = matter(source);
  return { data: parsed.data, body: parsed.content };
}

export function normalizePageMeta(data: Record<string, unknown> | undefined, fallbackTitle: string): PageMeta {
  const meta: PageMeta = {
    title: typeof data?.title === "string" && data.title.trim() ? data.title.trim() : fallbackTitle,
    tags: toStringList(data?.tags),
  };
  if (typeof data?.order === "number") meta.order = data.order;
  if (typeof data?.summary === "string") meta.summary = data.summary;
  if (data?.links === "visible") meta.links = "visible";
  return meta;
}

export function normalizeSubjectMeta(data: Record<string, unknown> | undefined, fallbackTitle: string): SubjectMeta {
  const meta: SubjectMeta = {
    title: typeof data?.title === "string" && data.title.trim() ? data.title.trim() : fallbackTitle,
  };
  if (typeof data?.order === "number") meta.order = data.order;
  if (typeof data?.summary === "string") meta.summary = data.summary;
  return meta;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return [value];
  return [];
}
