import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "wouter";

/**
 * Open state of the global sidebar (subjects → files). It resets on every route change: closed while reading a
 * note (the left column belongs to that page's own TOC, and the sidebar would cover it), open on the directory
 * pages (home, subject, problems) where it is the page's location. On narrow screens it always starts closed.
 */
let open = false;
const listeners = new Set<() => void>();

export function setNavOpen(value: boolean) {
  if (open === value) return;
  open = value;
  for (const listener of listeners) listener();
}

export const toggleNav = () => setNavOpen(!open);

export function useNavOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
  );
}

const WIDE = "(min-width: 901px)";

/** Whether the current route is a note being read (`/:subject/:slug`). */
export function isReading(location: string) {
  const parts = location.split("/").filter(Boolean);
  return parts.length === 2 && !location.startsWith("/_");
}

/** Mounted once in App: applies the per-route default and the keyboard shortcuts. */
export function useNavDefaults() {
  const [location] = useLocation();

  useEffect(() => {
    setNavOpen(!isReading(location) && window.matchMedia(WIDE).matches);
  }, [location]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']");
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b" && !typing) {
        event.preventDefault();
        toggleNav();
      } else if (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const input = document.querySelector<HTMLInputElement>(".search-input");
        if (input) {
          event.preventDefault();
          input.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
