import { useEffect } from "react";
import { Link } from "wouter";
import { Backlinks } from "../components/Backlinks.tsx";
import { NoteBody } from "../components/NoteBody.tsx";
import { PageToc, useActiveSection } from "../components/PageToc.tsx";
import { Pager } from "../components/Pager.tsx";
import { TagEditor } from "../components/TagEditor.tsx";
import { usePage, useTree } from "../data.ts";
import { writeLastRead } from "../lastRead.ts";

export function NotePage({ subject, slug }: { subject: string; slug: string }) {
  const { data: page, error } = usePage(subject, slug);
  const { data: tree } = useTree();
  const subjectSummary = tree?.subjects.find((s) => s.name === subject);
  const active = useActiveSection(page?.hash ?? "");

  useEffect(() => {
    if (page) document.title = `${page.meta.title} — Zyninote`;
  }, [page]);

  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [subject, slug]);

  // Remembered for the subject page's resume button.
  useEffect(() => {
    if (page) writeLastRead(subject, { slug, section: active });
  }, [page, subject, slug, active]);

  if (error) return <p className="zn-error">{error}</p>;
  if (!page) return null;

  const backLink = (
    <Link href={`/${subject}/`} className="sidebar-back">
      ← {subjectSummary?.meta.title ?? subject} 目錄
    </Link>
  );

  return (
    <div className="note-layout">
      <aside className="note-sidebar">
        <div className="desktop-toc">
          {backLink}
          <p className="eyebrow">本頁目錄</p>
          <PageToc toc={page.toc} active={active} />
        </div>
        <details className="mobile-toc">
          <summary>本頁目錄</summary>
          {backLink}
          <PageToc toc={page.toc} active={active} />
        </details>
      </aside>

      <article className="note">
        <header className="note-header">
          <p className="eyebrow">{subjectSummary?.meta.title ?? subject}</p>
          <h1>{page.meta.title}</h1>
          {page.meta.summary && <p className="lead">{page.meta.summary}</p>}
          <TagEditor key={page.path} subject={subject} slug={slug} tags={page.meta.tags} registered={subjectSummary?.meta.tags ?? []} />
        </header>
        <NoteBody page={page} />
        <Backlinks backlinks={page.backlinks} subjectTitle={subjectSummary?.meta.title} />
        {subjectSummary && <Pager subject={subjectSummary} slug={slug} />}
      </article>
    </div>
  );
}
