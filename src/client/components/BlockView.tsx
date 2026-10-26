import { useLayoutEffect, useRef } from "react";
import type { PageView } from "../../shared/types.ts";
import { handleFoldClick, initFold } from "../behavior/fold.ts";
import { focusSection, markBroken } from "../behavior/links.ts";
import { renderMermaid } from "../behavior/mermaid.ts";
import { usePageBody } from "./NoteBody.tsx";

/**
 * One block of a page (section `id` with its sub-sections), or the whole page, shown away from that page:
 * link previews and, later, cheat sheet cards. It renders the real page body, so interactive components run;
 * the target section is expanded even when it is `.fold`, while folded sections inside it stay folded.
 */
export function BlockView({ page, id }: { page: PageView; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { body, error, renderedKey } = usePageBody(page);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    initFold(root);
    if (id) focusSection(root, id);
    void renderMermaid(root);
  }, [renderedKey, id]);

  const broken = page.broken.join("\n");
  useLayoutEffect(() => {
    if (ref.current) markBroken(ref.current, page.broken);
  }, [renderedKey, broken]);

  const onClick = (event: React.MouseEvent) => {
    const section = handleFoldClick(event.nativeEvent);
    if (section) void renderMermaid(section);
  };

  return (
    <div ref={ref} className="zn-block" onClick={onClick} data-links={page.meta.links}>
      {error && <pre className="zn-error">{error}</pre>}
      {body}
    </div>
  );
}
