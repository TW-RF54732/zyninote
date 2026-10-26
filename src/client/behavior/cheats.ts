// "Add to cheat sheet" buttons on the headings of the page being read. They are added to the rendered DOM
// (never to the indexed HTML), so previews and cheat sheet cards, which render the same body, do not get them.

const HEADING = "section.zn-section > :is(h1, h2, h3, h4, h5, h6):first-child";
export const CHEAT_ADD = "button.zn-cheat-add";

// Drawn as SVG with straight strokes and square ends, rather than font glyphs, so both marks look geometric.
const svg = (shape: string) => `<svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true">${shape}</svg>`;
const PLUS = svg(`<path d="M8 2.5v11M2.5 8h11" />`);
const CHECK = svg(`<path d="M2.5 8.5 6.5 12.5 13.5 3.5" />`);

/** Adds a button to every section heading that has none yet, and marks those whose section is already a card. */
export function initCheatButtons(root: HTMLElement, added: Set<string>) {
  for (const heading of root.querySelectorAll<HTMLElement>(HEADING)) {
    const id = heading.parentElement!.dataset.id ?? "";
    let button = heading.querySelector<HTMLButtonElement>(`:scope > ${CHEAT_ADD}`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "zn-cheat-add";
      heading.append(button);
    }
    button.dataset.id = id;
    const isAdded = added.has(id);
    button.toggleAttribute("data-added", isAdded);
    const icon = isAdded ? CHECK : PLUS;
    if (button.innerHTML !== icon) button.innerHTML = icon;
    button.title = isAdded ? "從 cheat sheet 移除" : "加入 cheat sheet";
    button.setAttribute("aria-label", `${button.title}：${heading.parentElement!.dataset.title ?? id}`);
  }
}

/** The add button a click landed on, or null when the click was elsewhere. */
export function cheatButtonAt(event: MouseEvent): HTMLButtonElement | null {
  return event.target instanceof Element ? event.target.closest<HTMLButtonElement>(CHEAT_ADD) : null;
}
