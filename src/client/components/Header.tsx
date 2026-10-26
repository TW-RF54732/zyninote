import { Link, useLocation } from "wouter";
import { useTree } from "../data.ts";

/** Breadcrumbs: Zyninote / subject / note. */
export function Header() {
  const [location] = useLocation();
  const { data: tree } = useTree();
  const [subjectName, slug] = location.split("/").filter(Boolean).map(decodeURIComponent);
  const subject = tree?.subjects.find((s) => s.name === subjectName);
  const note = subject?.notes.find((n) => n.slug === slug);
  const problems = tree?.diagnostics.length ?? 0;

  return (
    <header className="header container">
      <nav className="header-path" aria-label="麵包屑">
        <Link href="/" className="wordmark">
          Zyninote
        </Link>
        {subjectName && (
          <>
            <span aria-hidden="true">/</span>
            {slug ? (
              <Link href={`/${subjectName}/`}>{subject?.meta.title ?? subjectName}</Link>
            ) : (
              <span aria-current="page">{subject?.meta.title ?? subjectName}</span>
            )}
          </>
        )}
        {slug && (
          <>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{note?.meta.title ?? slug}</span>
          </>
        )}
      </nav>
      {problems > 0 && (
        <Link href="/_problems" className="header-problems">
          {problems} 個問題
        </Link>
      )}
    </header>
  );
}
