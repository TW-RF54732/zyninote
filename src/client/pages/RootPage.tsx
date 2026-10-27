import { useEffect } from "react";
import { Link } from "wouter";
import type { NoteSummary, SubjectSummary, TocItem } from "../../shared/types.ts";
import { useTree } from "../data.ts";
import { type LastRead, readLastRead } from "../lastRead.ts";

const RECENT = 4;

/**
 * The home page only answers "where do I go": pick up where you left off (most recent first), or pick a subject.
 * Chapter lists belong to the subject page and the sidebar, so the page stays the same size however much content
 * there is, and both rows use the full width as a grid.
 */
export function RootPage() {
  const { data: tree, error } = useTree();

  useEffect(() => {
    document.title = "Zyninote";
  }, []);

  if (error) return <p className="zn-error">{error}</p>;
  if (!tree) return null;

  const recent = tree.subjects
    .map((subject) => {
      const last = readLastRead(subject.name);
      const note = last && subject.notes.find((n) => n.slug === last.slug);
      return last && note ? { subject, note, last } : null;
    })
    .filter((r) => r !== null)
    .sort((a, b) => b.last.at - a.last.at)
    .slice(0, RECENT);

  return (
    <div className="note-layout" data-wide>
      <div className="note-sidebar" aria-hidden="true" />

      <div className="subject-main">
        {recent.length > 0 && (
          <section className="home-section" aria-labelledby="home-recent">
            <h2 id="home-recent" className="eyebrow">
              繼續閱讀
            </h2>
            <ul className="tile-grid">
              {recent.map((r) => (
                <li key={r.subject.name}>
                  <RecentTile {...r} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="home-section" aria-labelledby="home-subjects">
          <h2 id="home-subjects" className="eyebrow">
            所有科目
          </h2>
          <ul className="tile-grid">
            {tree.subjects.map((subject) => (
              <li key={subject.name}>
                <Link href={subject.url} className="tile">
                  <span className="tile-title">{subject.meta.title}</span>
                  {subject.meta.summary && <span className="tile-text">{subject.meta.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function RecentTile({ subject, note, last }: { subject: SubjectSummary; note: NoteSummary; last: LastRead }) {
  const section = last.section ? findTocItem(note.toc, last.section) : undefined;
  return (
    <Link href={section ? `${note.url}#${encodeURIComponent(section.id)}` : note.url} className="tile">
      <span className="tile-label">{subject.meta.title}</span>
      <span className="tile-title">{note.meta.title}</span>
      {section && <span className="tile-text">{section.title}</span>}
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
