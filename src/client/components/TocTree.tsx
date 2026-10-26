import type { MouseEvent } from "react";
import { Link } from "wouter";
import type { TocItem } from "../../shared/types.ts";

type TocTreeProps = {
  items: TocItem[];
  /** Page URL for links to another page; omit for in-page links. */
  pageUrl?: string;
  activeId?: string | null;
};

/** Nested heading list. In-page links update the hash and let NoteBody expand folded sections. */
export function TocTree({ items, pageUrl, activeId }: TocTreeProps) {
  if (!items.length) return null;
  return (
    <ul className="toc-tree">
      {items.map((item) => (
        <li key={item.id}>
          {pageUrl ? (
            <Link href={`${pageUrl}#${encodeURIComponent(item.id)}`} className="toc-link">
              <TocLabel item={item} />
            </Link>
          ) : (
            <a
              href={`#${encodeURIComponent(item.id)}`}
              className="toc-link"
              aria-current={item.id === activeId ? "location" : undefined}
              onClick={(event) => goToSection(event, item.id)}
            >
              <TocLabel item={item} />
            </a>
          )}
          <TocTree items={item.children} pageUrl={pageUrl} activeId={activeId} />
        </li>
      ))}
    </ul>
  );
}

function TocLabel({ item }: { item: TocItem }) {
  return (
    <>
      <span>{item.title}</span>
      {item.fold && (
        <span className="toc-fold" title="預設摺疊">
          ▸
        </span>
      )}
    </>
  );
}

function goToSection(event: MouseEvent, id: string) {
  event.preventDefault();
  history.pushState(null, "", `#${encodeURIComponent(id)}`);
  // pushState does not fire hashchange; NoteBody listens for it to expand and scroll.
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
