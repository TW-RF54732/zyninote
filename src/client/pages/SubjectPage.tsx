import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import type { NoteSummary, SubjectSummary, TocItem } from "../../shared/types.ts";
import { Backlinks } from "../components/Backlinks.tsx";
import { CheckGroup } from "../components/CheckGroup.tsx";
import { Dialog } from "../components/Dialog.tsx";
import { useActiveSection } from "../components/PageToc.tsx";
import { TagManager } from "../components/TagManager.tsx";
import { TocTree } from "../components/TocTree.tsx";
import { useSubject } from "../data.ts";
import { readLastRead } from "../lastRead.ts";

const CHAPTER_PREFIX = "chapter-";

/**
 * A subject's home, laid out like a note page: the sidebar lists the chapters for quick jumps, the main column
 * holds the title, a toolbar (resume, filter) and one card per chapter with its heading tree. Only the
 * frontmatter of _subject.md is used; its body is not shown.
 */
export function SubjectPage({ name }: { name: string }) {
  const { data, error } = useSubject(name);
  const [tags, setTags] = useState<string[]>([]);
  const active = useActiveSection(`${name}:${tags.join(",")}`, ".subject-chapter");

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
  const activeSlug = active?.slice(CHAPTER_PREFIX.length) ?? notes[0]?.slug;

  const backLink = (
    <Link href="/" className="sidebar-back">
      ← 所有科目
    </Link>
  );

  return (
    <div className="note-layout">
      <aside className="note-sidebar">
        <div className="desktop-toc">
          {backLink}
          <p className="eyebrow">章節</p>
          <ChapterNav notes={notes} active={activeSlug} />
        </div>
        <details className="mobile-toc">
          <summary>章節</summary>
          {backLink}
          <ChapterNav notes={notes} active={activeSlug} />
        </details>
      </aside>

      <div className="subject-main">
        <header className="note-header">
          <h1>{subject.meta.title}</h1>
          {subject.meta.summary && <p className="lead">{subject.meta.summary}</p>}
        </header>

        <div className="subject-toolbar">
          <ResumeButton subject={subject} />
          <FilterMenu subject={subject} selected={tags} onChange={setTags} />
        </div>

        {notes.length ? (
          <ol className="subject-chapters">
            {notes.map((note) => (
              <li key={note.slug} id={CHAPTER_PREFIX + note.slug} className="subject-chapter">
                <div className="subject-chapter-head">
                  <Link href={note.url} className="subject-chapter-title">
                    {note.meta.title}
                  </Link>
                  {note.meta.tags.length > 0 && <span className="subject-chapter-tags">{note.meta.tags.join(" · ")}</span>}
                </div>
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

/** Chapter titles only; a click scrolls the main column to that chapter's card. */
function ChapterNav({ notes, active }: { notes: NoteSummary[]; active: string | undefined }) {
  return (
    <nav aria-label="章節">
      <ul className="toc-tree">
        {notes.map((note) => (
          <li key={note.slug}>
            <a
              href={note.url}
              className="toc-link"
              aria-current={note.slug === active ? "location" : undefined}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(CHAPTER_PREFIX + note.slug)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {note.meta.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type FilterMenuProps = { subject: SubjectSummary; selected: string[]; onChange: (tags: string[]) => void };

/** Tag filter (a chapter shows when it has any selected tag) and the entry to tag management, in one floating menu. */
function FilterMenu({ subject, selected, onChange }: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Registered tags first, then tags notes use without registering.
  const tags = [...new Set([...subject.meta.tags, ...subject.notes.flatMap((n) => n.meta.tags)])];

  // The menu floats over the chapters, so opening it never moves anything. Outside clicks and Esc close it.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="filter">
      <button ref={buttonRef} type="button" className="filter-button" aria-expanded={open} aria-pressed={selected.length > 0} onClick={() => setOpen(!open)}>
        篩選{selected.length > 0 && ` (${selected.length})`} ▾
      </button>
      {open && (
        <div className="filter-menu" ref={menuRef} role="group" aria-label="篩選條件">
          {tags.length ? (
            <CheckGroup
              label="Tag"
              options={tags.map((tag) => ({ value: tag, label: tag, meta: String(subject.notes.filter((n) => n.meta.tags.includes(tag)).length) }))}
              selected={selected}
              onToggle={(tag) => onChange(selected.includes(tag) ? selected.filter((t) => t !== tag) : [...selected, tag])}
            />
          ) : (
            <p className="filter-empty">這個科目還沒有 tag。</p>
          )}
          <div className="filter-foot">
            <button type="button" className="cheat-toggle" disabled={!selected.length} onClick={() => onChange([])}>
              清除
            </button>
            <button
              type="button"
              className="cheat-toggle filter-manage"
              onClick={() => {
                setOpen(false);
                setManaging(true);
              }}
            >
              管理 tag…
            </button>
          </div>
        </div>
      )}
      {managing && (
        <Dialog title="管理 tag" wide onClose={() => setManaging(false)}>
          <TagManager subject={subject} />
        </Dialog>
      )}
    </div>
  );
}

/** The whole button is one link back to where the reader left off in this subject. */
function ResumeButton({ subject }: { subject: SubjectSummary }) {
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
