import { Link } from "wouter";
import type { SubjectSummary } from "../../shared/types.ts";

/** Previous / next within a subject, in chapter order. The first chapter's "previous" is the subject directory. */
export function Pager({ subject, slug }: { subject: SubjectSummary; slug: string }) {
  const index = subject.notes.findIndex((n) => n.slug === slug);
  if (index < 0) return null;
  const prev = index > 0 ? { href: subject.notes[index - 1].url, title: subject.notes[index - 1].meta.title } : { href: subject.url, title: `${subject.meta.title} 目錄` };
  const next = subject.notes[index + 1];

  return (
    <nav className="pager" aria-label="上一頁與下一頁">
      <Link href={prev.href} className="pager-link">
        <span className="eyebrow">上一頁</span>
        <span>{prev.title}</span>
      </Link>
      {next && (
        <Link href={next.url} className="pager-link pager-next">
          <span className="eyebrow">下一頁</span>
          <span>{next.meta.title}</span>
        </Link>
      )}
    </nav>
  );
}
