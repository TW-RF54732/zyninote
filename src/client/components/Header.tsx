import { Link, useLocation } from "wouter";
import { useTree } from "../data.ts";
import { NavToggle } from "./NavSidebar.tsx";
import { Search } from "./Search.tsx";
import { WindowControls } from "./WindowControls.tsx";

/** Sticky top bar: sidebar toggle, breadcrumbs (Zyninote / subject / note), search and the problem count. */
export function Header() {
  const [location] = useLocation();
  const { data: tree } = useTree();
  const [subjectName, slug] = location.split("/").filter(Boolean).map(decodeURIComponent);
  const subject = tree?.subjects.find((s) => s.name === subjectName);
  const subjectLabel = subjectName === "_problems" ? "問題列表" : (subject?.meta.title ?? subjectName);
  const note = subject?.notes.find((n) => n.slug === slug);
  const problems = tree?.diagnostics.length ?? 0;

  return (
    <div className="topbar">
      <header className="header container">
        <NavToggle />
        <nav className="header-path" aria-label="麵包屑">
          <Link href="/" className="wordmark">
            Zyninote
          </Link>
          {subjectName && (
            <>
              <span aria-hidden="true">/</span>
              {slug ? (
                <Link href={`/${subjectName}/`}>{subjectLabel}</Link>
              ) : (
                <span aria-current="page">{subjectLabel}</span>
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
        <div className="header-tools">
          <Search />
          {problems > 0 && (
            <Link href="/_problems" className="header-problems">
              {problems} 個問題
            </Link>
          )}
        </div>
      </header>
      <WindowControls />
    </div>
  );
}
