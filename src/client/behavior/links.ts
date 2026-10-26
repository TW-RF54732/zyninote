// Note links in the DOM: what a rendered `a.zn-link` points at, in-app navigation, broken-link marks and block focus.
import { navigate } from "wouter/use-browser-location";
import { pageKeyFromPathname, safeDecode } from "../../shared/links.ts";

/** Rendered note links that can be followed (links leaving content/ have no href). */
export const NOTE_LINK = "a.zn-link[href]";

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
/** The preview modifier: Cmd on macOS, Ctrl elsewhere. */
export const MOD_KEY = IS_MAC ? "Meta" : "Control";
export const modHeld = (event: MouseEvent | KeyboardEvent) => (IS_MAC ? event.metaKey : event.ctrlKey);

export type LinkTarget = {
  /** Page key, as in the API: "subject/slug" or "subject/". */
  page: string;
  id?: string;
  /** Pathname plus hash. */
  href: string;
};

/** The page a link points at, or null for files, other origins and the root page (nothing to preview). */
export function linkTarget(a: HTMLAnchorElement): LinkTarget | null {
  const url = new URL(a.href);
  if (url.origin !== location.origin) return null;
  const page = pageKeyFromPathname(url.pathname);
  if (!page) return null;
  return { page, ...(url.hash ? { id: safeDecode(url.hash.slice(1)) } : {}), href: url.pathname + url.hash };
}

/** In-app navigation. On the same page it only updates the hash and lets NoteBody expand and scroll to the target. */
export function goTo(href: string) {
  const url = new URL(href, location.href);
  if (url.pathname !== location.pathname) {
    navigate(url.pathname + url.hash);
    return;
  }
  if (url.hash !== location.hash) history.pushState(null, "", url.hash || url.pathname);
  if (url.hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
  else window.scrollTo(0, 0);
}

/** Marks links whose target the index reports as missing or invalid. */
export function markBroken(root: HTMLElement, broken: string[]) {
  const set = new Set(broken);
  for (const a of root.querySelectorAll<HTMLElement>("a.zn-link")) a.toggleAttribute("data-zn-broken", set.has(a.dataset.znRef ?? ""));
}

/**
 * Shows only section `id` inside `root`: everything that is not the section or one of its ancestors is hidden,
 * and the section and its ancestors are expanded even when folded. Folded sections inside it stay folded.
 */
export function focusSection(root: HTMLElement, id: string): boolean {
  for (const node of root.querySelectorAll("[data-zn-off], [data-zn-focus]")) {
    node.removeAttribute("data-zn-off");
    node.removeAttribute("data-zn-focus");
  }
  const target = [...root.querySelectorAll<HTMLElement>("section.zn-section")].find((s) => s.dataset.id === id);
  if (!target) return false;
  target.setAttribute("data-zn-focus", "");
  for (let node: HTMLElement = target; node !== root && node.parentElement; node = node.parentElement) {
    if (node.matches("section.zn-section")) node.removeAttribute("data-collapsed");
    for (const sibling of node.parentElement.children) if (sibling !== node) sibling.setAttribute("data-zn-off", "");
  }
  return true;
}
