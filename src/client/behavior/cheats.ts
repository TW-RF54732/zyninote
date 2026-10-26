// "Add to cheat sheet" buttons on the headings of the page being read. They are added to the rendered DOM
// (never to the indexed HTML), so previews and cheat sheet cards, which render the same body, do not get them.

const HEADING = "section.zn-section > :is(h1, h2, h3, h4, h5, h6):first-child";
export const CHEAT_ADD = "button.zn-cheat-add";

/** Adds a button to every section heading that has none yet, and marks those whose section is already a card. */
export function initCheatButtons(root: HTMLElement, added: Set<string>) {
  for (const heading of root.querySelectorAll<HTMLElement>(HEADING)) {
    const id = heading.parentElement!.dataset.id ?? "";
    let button = heading.querySelector<HTMLButtonElement>(`:scope > ${CHEAT_ADD}`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "zn-cheat-add";
      button.textContent = "+";
      heading.append(button);
    }
    button.dataset.id = id;
    const isAdded = added.has(id);
    button.toggleAttribute("data-added", isAdded);
    button.title = isAdded ? "已在 cheat sheet（再按一次會重複加入）" : "加入 cheat sheet";
    button.setAttribute("aria-label", `${button.title}：${heading.parentElement!.dataset.title ?? id}`);
  }
}

/** The add button a click landed on, or null when the click was elsewhere. */
export function cheatButtonAt(event: MouseEvent): HTMLButtonElement | null {
  return event.target instanceof Element ? event.target.closest<HTMLButtonElement>(CHEAT_ADD) : null;
}
