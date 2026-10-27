import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { SubjectSummary, TocItem } from "../../shared/types.ts";
import { Backlinks } from "../components/Backlinks.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { TagManager } from "../components/TagManager.tsx";
import { TocTree } from "../components/TocTree.tsx";
import { useSubject } from "../data.ts";
import { readLastRead } from "../lastRead.ts";

/**
 * A subject's home, read like a book's table of contents: the title, where you left off, a tag filter, then every
 * chapter with its heading tree, separated the way a note's sections are. The left column is left to the global
 * sidebar (subjects → files). Only the frontmatter of _subject.md is used; its body is not shown.
 */
export function SubjectPage({ name }: { name: string }) {
  const { data, error } = useSubject(name);
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (data) document.title = `${data.subject.meta.title} — Zyninote`;
  }, [data]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setTags([]);
  }, [name]);

  if (error) return <p className="zn-error">{error}</p>;
  if (!data) return null;
  const { subject, page } = data;
  const notes = subject.notes.filter((note) => !tags.length || tags.some((tag) => note.meta.tags.includes(tag)));

  return (
    <div className="note-layout">
      <div className="note-sidebar" aria-hidden="true" />

      <div className="subject-main">
        <header className="note-header">
          <h1>{subject.meta.title}</h1>
          {subject.meta.summary && <p className="lead">{subject.meta.summary}</p>}
        </header>

        <Resume subject={subject} />
        <TagFilter subject={subject} selected={tags} onChange={setTags} />

        {notes.length ? (
          <ol className="subject-chapters">
            {notes.map((note) => (
              <li key={note.slug} id={`chapter-${note.slug}`} className="subject-chapter">
                <Link href={note.url} className="subject-chapter-title">
                  {note.meta.title}
                </Link>
                {note.meta.summary && <p className="subject-chapter-summary">{note.meta.summary}</p>}
                <TocTree items={note.toc} pageUrl={note.url} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="subject-empty">沒有符合篩選的章節。</p>
        )}

        {page && <Backlinks backlinks={page.backlinks} subjectTitle={subject.meta.title} />}
      </div>
    </div>
  );
}

type TagFilterProps = { subject: SubjectSummary; selected: string[]; onChange: (tags: string[]) => void };

/**
 * The subject's tags as one row of text toggles, like the cheat sheet's mode row: "全部" clears, each tag toggles
 * (a chapter shows when it has any selected tag), and the last entry opens tag management.
 */
function TagFilter({ subject, selected, onChange }: TagFilterProps) {
  const [managing, setManaging] = useState(false);
  // Registered tags first, then tags notes use without registering.
  const tags = [...new Set([...subject.meta.tags, ...subject.notes.flatMap((n) => n.meta.tags)])];

  return (
    <div className="subject-filter" role="group" aria-label="依 tag 篩選">
      <button type="button" className="text-toggle" aria-pressed={!selected.length} onClick={() => onChange([])}>
        全部
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          className="text-toggle"
          aria-pressed={selected.includes(tag)}
          onClick={() => onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])}
        >
          {tag}
        </button>
      ))}
      <button type="button" className="text-toggle subject-filter-manage" onClick={() => setManaging(true)}>
        管理 tag…
      </button>
      {managing && (
        <Dialog title="管理 tag" wide onClose={() => setManaging(false)}>
          <TagManager subject={subject} />
        </Dialog>
      )}
    </div>
  );
}

/** One line back to where the reader left off in this subject; nothing when there is no record. */
function Resume({ subject }: { subject: SubjectSummary }) {
  const last = readLastRead(subject.name);
  const note = last && subject.notes.find((n) => n.slug === last.slug);
  if (!last || !note) return null;
  const section = last.section ? findTocItem(note.toc, last.section) : undefined;
  return (
    <Link href={section ? `${note.url}#${encodeURIComponent(section.id)}` : note.url} className="resume">
      <span className="resume-label">繼續閱讀</span>
      <span className="resume-title">{note.meta.title}</span>
      {section && <span className="resume-section">{section.title}</span>}
      <span className="resume-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

function findTocItem(items: TocItem[], id: string): TocItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const found = findTocItem(item.children, id);
    if (found) return found;
  }
  return undefined;
}
