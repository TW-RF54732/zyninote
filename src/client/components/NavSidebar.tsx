import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTree } from "../data.ts";
import { isReading, setNavOpen, toggleNav, useNavOpen } from "../nav.ts";

/**
 * The global sidebar: where you are and where you can jump, at file granularity only (subjects → notes, never
 * headings; a note's headings are the page TOC's job). While reading it floats over the page TOC column, since
 * opening it is a deliberate switch of attention; on directory pages it simply sits in that column.
 */
export function NavSidebar() {
  const open = useNavOpen();
  const [location] = useLocation();
  const { data: tree } = useTree();
  const panelRef = useRef<HTMLElement>(null);
  const [subjectName, slug] = location.split("/").filter(Boolean).map(decodeURIComponent);
  const overlay = isReading(location);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // The current subject is always expanded; others keep whatever the reader chose.
  useEffect(() => {
    if (subjectName) setExpanded((prev) => (prev.has(subjectName) ? prev : new Set(prev).add(subjectName)));
  }, [subjectName]);

  // Floating (reading, or any narrow screen): outside clicks and Esc close it.
  useEffect(() => {
    if (!open) return;
    const floating = () => overlay || !window.matchMedia("(min-width: 901px)").matches;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!floating() || panelRef.current?.contains(target) || target.closest(".nav-toggle")) return;
      setNavOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && floating()) setNavOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, overlay]);

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <>
      <div className="nav-backdrop" data-open={open || undefined} aria-hidden="true" />
      <aside ref={panelRef} className="nav-sidebar" data-open={open || undefined} data-overlay={overlay || undefined} inert={!open} aria-label="所有科目">
        <nav className="nav-scroll">
          <ul className="nav-subjects">
            {tree?.subjects.map((subject) => {
              const isOpen = expanded.has(subject.name);
              const here = subject.name === subjectName;
              return (
                <li key={subject.name}>
                  <div className="nav-subject">
                    <button type="button" className="nav-chevron" aria-expanded={isOpen} aria-label={`${isOpen ? "收起" : "展開"} ${subject.meta.title}`} onClick={() => toggle(subject.name)}>
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M3 1.5 6.5 5 3 8.5" />
                      </svg>
                    </button>
                    <Link href={subject.url} className="nav-link nav-subject-link" aria-current={here && !slug ? "page" : undefined} data-here={here || undefined}>
                      {subject.meta.title}
                    </Link>
                  </div>
                  {isOpen && (
                    <ul className="nav-notes">
                      {subject.notes.map((note) => (
                        <li key={note.slug}>
                          <Link href={note.url} className="nav-link" aria-current={here && note.slug === slug ? "page" : undefined}>
                            {note.meta.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

/** Header button that opens and closes the sidebar (also Ctrl/Cmd+B). */
export function NavToggle() {
  const open = useNavOpen();
  return (
    <button type="button" className="nav-toggle" aria-pressed={open} aria-label={open ? "收起側邊欄" : "打開側邊欄"} title="側邊欄（Ctrl+B）" onClick={toggleNav}>
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect x="1.5" y="2.5" width="15" height="13" rx="2.5" />
        <path d="M6.5 2.5v13" />
      </svg>
    </button>
  );
}
