// Cheat sheet logic shared by the server and the client: ref resolution, filtering, containment and reordering.
import { resolveLink, type ResolvedLink } from "./links.ts";
import type { CheatCardView } from "./types.ts";

export const CHEATS_FILE = "_cheats.json";

/** A card's `ref` is a relative link written from the subject's _cheats.json. */
export function resolveCardRef(subject: string, ref: string): ResolvedLink {
  return resolveLink(`${subject}/${CHEATS_FILE}`, ref);
}

/** The ref the "add to cheat sheet" button writes for heading `id` of the note at content-relative `path`. */
export function cardRefFor(path: string, id: string): string {
  return `${path.slice(path.lastIndexOf("/") + 1)}#${id}`;
}

export type CheatMode = "sub" | "local" | "advance";

export type CheatFilter = {
  mode: CheatMode;
  /** Key of the page being read, for `local`. */
  currentPage: string | null;
  /** Page keys checked in `advance`; empty means any chapter. */
  chapters: string[];
  /** Source-page tags checked in `advance`; empty means any tag. */
  tags: string[];
  /** Union ("any") or intersection ("all") of the checked tags. */
  tagMode: "any" | "all";
};

/** The cards a filter shows, always in cheat sheet order. */
export function filterCards(cards: CheatCardView[], filter: CheatFilter): CheatCardView[] {
  if (filter.mode === "sub") return cards;
  if (filter.mode === "local") return cards.filter((card) => card.page !== null && card.page === filter.currentPage);
  const chapters = new Set(filter.chapters);
  return cards.filter((card) => {
    if (chapters.size && !(card.page && chapters.has(card.page))) return false;
    if (!filter.tags.length) return true;
    return filter.tagMode === "all" ? filter.tags.every((tag) => card.tags.includes(tag)) : filter.tags.some((tag) => card.tags.includes(tag));
  });
}

/** Ids of the sections that contain `id` or are contained in it (not `id` itself), from a page's section tree. */
export function relatedSections(sections: { id: string; children: string[] }[], id: string): Set<string> {
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const section of sections) {
    children.set(section.id, section.children);
    for (const child of section.children) parent.set(child, section.id);
  }
  const related = new Set<string>();
  for (let up = parent.get(id); up !== undefined; up = parent.get(up)) related.add(up);
  const stack = [...(children.get(id) ?? [])];
  while (stack.length) {
    const next = stack.pop()!;
    if (related.has(next)) continue;
    related.add(next);
    stack.push(...(children.get(next) ?? []));
  }
  return related;
}

/**
 * Moves card `dragged` next to another card in the full order. Dragging happens in a possibly filtered list,
 * so the drop position is expressed relative to a visible neighbour rather than as an index.
 */
export function moveCard(ids: string[], dragged: string, target: { before: string } | { after: string }): string[] {
  const rest = ids.filter((id) => id !== dragged);
  if (rest.length === ids.length) return ids;
  const anchor = "before" in target ? target.before : target.after;
  const at = rest.indexOf(anchor);
  if (at < 0 || anchor === dragged) return ids;
  rest.splice("before" in target ? at : at + 1, 0, dragged);
  return rest;
}
