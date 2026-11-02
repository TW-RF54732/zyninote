// Desktop shell (electron/): the window has no native title bar, so the page's top bar becomes an auto-hiding bar that
// slides in when the mouse touches the top edge, and the page scrollbar only shows near the right edge (Zen-style).
// In a normal browser `zyninoteShell` is undefined and nothing here runs.

export type Shell = {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  menu(x: number, y: number): void;
  onMaximized(fn: (maximized: boolean) => void): () => void;
};

declare global {
  interface Window {
    zyninoteShell?: Shell;
  }
}

export const shell: Shell | undefined = window.zyninoteShell;

/** How close (px) the mouse must come to the top / right edge to reveal the bar / the scrollbar. */
const TOP_EDGE = 6;
const RIGHT_EDGE = 20;
/** The bar hides only once the mouse is this far below it, after a short delay. */
const HIDE_MARGIN = 24;
const HIDE_DELAY = 250;

export function installShell() {
  if (!shell) return;
  const root = document.documentElement;
  root.dataset.shell = "electron";
  let hideTimer: number | undefined;

  const show = () => {
    window.clearTimeout(hideTimer);
    hideTimer = undefined;
    root.toggleAttribute("data-bar", true);
  };
  const scheduleHide = () => {
    if (hideTimer !== undefined) return;
    hideTimer = window.setTimeout(() => {
      hideTimer = undefined;
      root.removeAttribute("data-bar");
    }, HIDE_DELAY);
  };

  // State changes only on mousemove inside the page. The bar's drag region swallows mouse events, and leaving the window
  // fires nothing useful, so the bar stays as it was until the mouse moves over the page again.
  document.addEventListener(
    "mousemove",
    (event) => {
      root.toggleAttribute("data-scrollbar", window.innerWidth - event.clientX <= RIGHT_EDGE);
      if (event.clientY <= TOP_EDGE) return show();
      if (!root.hasAttribute("data-bar")) return;
      const bar = document.querySelector(".topbar");
      const inBar = event.target instanceof Element && event.target.closest(".topbar");
      const bottom = bar?.getBoundingClientRect().bottom ?? 0;
      if (inBar || event.clientY <= bottom + HIDE_MARGIN) show();
      else scheduleHide();
    },
    { passive: true },
  );
  root.addEventListener("mouseleave", () => root.removeAttribute("data-scrollbar"));
}
