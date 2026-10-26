import { readdirSync } from "node:fs";
import { join } from "node:path";
import { NOTE_EXT } from "../shared/links.ts";
import type { Diagnostic, Format } from "../shared/types.ts";

export type NoteFile = {
  /** Path relative to content/, always with forward slashes. */
  path: string;
  subject: string;
  slug: string;
  format: Format;
};

export type SubjectDir = {
  name: string;
  /** Relative path of _subject.md when present. */
  subjectFile: string | null;
  notes: NoteFile[];
};

export type ScanResult = {
  subjects: SubjectDir[];
  diagnostics: Diagnostic[];
};

/**
 * Reads the content/ layout: one level of subject folders, each holding flat note files.
 * Names starting with `_` are system files (subject config, cheat sheets, components) and never notes.
 */
export function scanContent(contentDir: string): ScanResult {
  const diagnostics: Diagnostic[] = [];
  const subjects: SubjectDir[] = [];

  for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    if (!entry.isDirectory()) {
      diagnostics.push({ level: "warning", path: entry.name, message: "content/ 底下只能放 subject 資料夾，此檔案被忽略" });
      continue;
    }

    const subject: SubjectDir = { name: entry.name, subjectFile: null, notes: [] };
    const slugs = new Map<string, string>();
    for (const file of readdirSync(join(contentDir, entry.name), { withFileTypes: true })) {
      const path = `${entry.name}/${file.name}`;
      if (file.name.startsWith(".")) continue;
      if (file.isDirectory()) {
        if (!file.name.startsWith("_")) diagnostics.push({ level: "error", path, message: "subject 內不允許子資料夾，已忽略" });
        continue;
      }
      if (file.name === "_subject.md") {
        subject.subjectFile = path;
        continue;
      }
      if (file.name.startsWith("_")) continue;
      const match = NOTE_EXT.exec(file.name);
      if (!match) continue;

      const slug = file.name.slice(0, match.index);
      const clash = slugs.get(slug);
      if (clash) {
        diagnostics.push({ level: "error", path, message: `與 ${clash} 的網址相同（/${entry.name}/${slug}），已忽略` });
        continue;
      }
      slugs.set(slug, path);
      subject.notes.push({ path, subject: entry.name, slug, format: match[1] as Format });
    }
    if (!subject.subjectFile) diagnostics.push({ level: "warning", path: entry.name, message: "缺少 _subject.md" });
    subjects.push(subject);
  }

  return { subjects, diagnostics };
}

/** Sort by `order` when given, otherwise by file name with numeric awareness (ch2 before ch10). */
export function compareByOrder(a: { order?: number; name: string }, b: { order?: number; name: string }): number {
  const oa = a.order ?? Number.POSITIVE_INFINITY;
  const ob = b.order ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa < ob ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}
