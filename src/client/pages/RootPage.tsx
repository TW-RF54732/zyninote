import { useEffect } from "react";
import { Link } from "wouter";
import { useTree } from "../data.ts";

export function RootPage() {
  const { data: tree, error } = useTree();

  useEffect(() => {
    document.title = "Zyninote";
  }, []);

  if (error) return <p className="zn-error">{error}</p>;
  if (!tree) return null;

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">筆記庫</p>
        <h1>Zyninote</h1>
        <p className="lead">共 {tree.subjects.length} 個科目、{tree.subjects.reduce((n, s) => n + s.notes.length, 0)} 篇筆記</p>
      </div>
      <ul className="subject-grid">
        {tree.subjects.map((subject, i) => (
          <li key={subject.name}>
            <Link href={subject.url} className="subject-card">
              <span className="card-number">{String(i + 1).padStart(2, "0")}</span>
              <h2>{subject.meta.title}</h2>
              {subject.meta.summary && <p>{subject.meta.summary}</p>}
              <ol className="subject-card-notes">
                {subject.notes.map((note) => (
                  <li key={note.slug}>{note.meta.title}</li>
                ))}
              </ol>
              <span className="card-meta">{subject.notes.length} 篇筆記</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
