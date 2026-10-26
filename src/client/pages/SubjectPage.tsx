import { useEffect } from "react";
import { Link } from "wouter";
import { NoteBody } from "../components/NoteBody.tsx";
import { Tags } from "../components/Tags.tsx";
import { TocTree } from "../components/TocTree.tsx";
import { useSubject } from "../data.ts";

/** A subject's home: its _subject.md, then a detailed directory of every chapter and all of its headings. */
export function SubjectPage({ name }: { name: string }) {
  const { data, error } = useSubject(name);

  useEffect(() => {
    if (data) document.title = `${data.subject.meta.title} — Zyninote`;
  }, [data]);

  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [name]);

  if (error) return <p className="zn-error">{error}</p>;
  if (!data) return null;
  const { subject, page } = data;

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">科目</p>
        <h1>{subject.meta.title}</h1>
        {subject.meta.summary && <p className="lead">{subject.meta.summary}</p>}
        <Tags tags={subject.meta.tags} />
      </div>

      {page && page.html.trim() && (
        <div className="subject-body">
          <NoteBody page={page} />
        </div>
      )}

      <section className="directory" aria-labelledby="directory-title">
        <div className="directory-heading">
          <h2 id="directory-title">章節目錄</h2>
          <span className="card-meta">{subject.notes.length} 篇筆記</span>
        </div>
        <ol className="chapter-list">
          {subject.notes.map((note, i) => (
            <li key={note.slug} className="chapter">
              <Link href={note.url} className="chapter-title">
                {i + 1}. {note.meta.title}
              </Link>
              {note.meta.summary && <p className="chapter-summary">{note.meta.summary}</p>}
              <TocTree items={note.toc} pageUrl={note.url} />
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
