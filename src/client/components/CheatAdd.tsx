import { useLayoutEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { cardRefFor, relatedSections } from "../../shared/cheats.ts";
import { pageKeyOf } from "../../shared/links.ts";
import type { CheatCardView, PageView } from "../../shared/types.ts";
import { cheatButtonAt, initCheatButtons } from "../behavior/cheats.ts";
import { addCheat, useCheats } from "../data.ts";
import { Dialog } from "./Dialog.tsx";

type Pending = { kind: "confirm"; id: string; related: CheatCardView[] } | { kind: "error"; message: string };

/**
 * The "add to cheat sheet" buttons of a page body. Adding a block that contains, or is contained in, an existing card
 * asks first but is still allowed; adding the same block again is simply allowed.
 * Returns a click handler for the body (true when it handled the click) and the dialog to render.
 */
export function useCheatAdd(page: PageView, rootRef: RefObject<HTMLElement | null>, renderedKey: string): { onClick: (event: MouseEvent) => boolean; dialog: ReactNode } {
  const { data: sheet } = useCheats(page.subject);
  const [pending, setPending] = useState<Pending | null>(null);
  const key = pageKeyOf(page.path);
  const cards = useMemo(() => sheet?.cards.filter((card) => card.page === key && card.sectionId) ?? [], [sheet, key]);

  useLayoutEffect(() => {
    if (rootRef.current) initCheatButtons(rootRef.current, new Set(cards.map((card) => card.sectionId!)));
  }, [rootRef, renderedKey, cards]);

  const add = (id: string) => {
    setPending(null);
    addCheat(page.subject, cardRefFor(page.path, id)).catch((error: Error) => setPending({ kind: "error", message: error.message }));
  };

  const onClick = (event: MouseEvent) => {
    const button = cheatButtonAt(event);
    if (!button?.dataset.id) return false;
    const id = button.dataset.id;
    const related = relatedSections(page.sections, id);
    const overlapping = cards.filter((card, i) => related.has(card.sectionId!) && cards.findIndex((c) => c.sectionId === card.sectionId) === i);
    if (overlapping.length) setPending({ kind: "confirm", id, related: overlapping });
    else add(id);
    return true;
  };

  let dialog: ReactNode = null;
  if (pending?.kind === "confirm") {
    const title = page.sections.find((s) => s.id === pending.id)?.title ?? pending.id;
    dialog = (
      <Dialog title="與既有卡片重疊" confirm="仍要加入" onConfirm={() => add(pending.id)} onClose={() => setPending(null)}>
        <p>「{title}」與 cheat sheet 中的這些卡片有包含關係：</p>
        <ul>
          {pending.related.map((card) => (
            <li key={card.id}>{card.sectionTitle ?? card.ref}</li>
          ))}
        </ul>
      </Dialog>
    );
  } else if (pending?.kind === "error") {
    dialog = (
      <Dialog title="無法加入 cheat sheet" onClose={() => setPending(null)}>
        <p>{pending.message}</p>
      </Dialog>
    );
  }
  return { onClick, dialog };
}
