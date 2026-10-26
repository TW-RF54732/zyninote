// Section folding. State is never persisted: each load starts from the `.fold` markers.

const SECTION = "section.zn-section";

export type FoldState = { known: Set<string>; collapsed: Set<string> };

/**
 * Applies the default fold state. With `keep` (the same page re-rendered after an edit),
 * sections that existed before keep their state and only new sections use the default.
 */
export function initFold(root: HTMLElement, keep?: FoldState) {
  for (const section of root.querySelectorAll<HTMLElement>(SECTION)) {
    const id = section.dataset.id ?? "";
    const collapsed = keep?.known.has(id) ? keep.collapsed.has(id) : section.dataset.fold === "true";
    section.toggleAttribute("data-collapsed", collapsed);
  }
}

export function foldState(root: HTMLElement): FoldState {
  const state: FoldState = { known: new Set(), collapsed: new Set() };
  for (const section of root.querySelectorAll<HTMLElement>(SECTION)) {
    const id = section.dataset.id ?? "";
    state.known.add(id);
    if (section.hasAttribute("data-collapsed")) state.collapsed.add(id);
  }
  return state;
}

/** Click handler for the note body: clicking a section heading toggles that section. */
export function handleFoldClick(event: MouseEvent): HTMLElement | null {
  const target = event.target as HTMLElement;
  if (target.closest("a, button, input, select, textarea")) return null;
  const heading = target.closest<HTMLElement>("h1, h2, h3, h4, h5, h6");
  const section = heading?.parentElement;
  if (!heading || !section?.matches(SECTION) || section.firstElementChild !== heading) return null;
  section.toggleAttribute("data-collapsed");
  return section;
}

/** Expands every section that hides `id` (including its own section), then scrolls to it. */
export function reveal(id: string, behavior: ScrollBehavior = "smooth"): HTMLElement | null {
  const target = document.getElementById(id);
  if (!target) return null;
  for (let section = target.closest<HTMLElement>(SECTION); section; section = section.parentElement?.closest<HTMLElement>(SECTION) ?? null) {
    section.removeAttribute("data-collapsed");
  }
  target.scrollIntoView({ behavior, block: "start" });
  return target;
}

export function currentHashId(): string | null {
  const hash = window.location.hash.slice(1);
  return hash ? decodeURIComponent(hash) : null;
}
