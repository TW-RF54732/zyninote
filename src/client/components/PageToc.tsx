import { useEffect, useState } from "react";
import type { TocItem } from "../../shared/types.ts";
import { TocTree } from "./TocTree.tsx";

/** The note page sidebar: this page's own headings, highlighting the one currently being read (`useActiveSection`). */
export function PageToc({ toc, active }: { toc: TocItem[]; active: string | null }) {
  return (
    <nav aria-label="本頁目錄">
      <TocTree items={toc} activeId={active} />
    </nav>
  );
}

const NOTE_HEADINGS = "#content .note-body section.zn-section > :first-child";

/** The id of the last visible element matching `selector` (by default the note's headings) whose top has scrolled past the top of the screen. */
export function useActiveSection(contentKey: string, selector = NOTE_HEADINGS): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const heading of document.querySelectorAll<HTMLElement>(selector)) {
        if (heading.offsetParent === null) continue;
        if (heading.getBoundingClientRect().top > 120) break;
        current = heading.id;
      }
      setActive(current);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("hashchange", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, [contentKey, selector]);

  return active;
}
