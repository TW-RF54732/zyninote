import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import type { SearchHit, SearchResponse, SearchText } from "../../shared/types.ts";
import { goTo, IS_MAC } from "../behavior/links.ts";
import { useSearch } from "../data.ts";

const DEBOUNCE = 120;

/** Header search over blocks. `/` or Ctrl/Cmd+K focuses it; inside a subject it searches that subject unless switched to all. */
export function Search() {
  const [location] = useLocation();
  const first = decodeURIComponent(location.split("/").filter(Boolean)[0] ?? "");
  const currentSubject = first && !first.startsWith("_") ? first : null;

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [everywhere, setEverywhere] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const scope = currentSubject && !everywhere ? currentSubject : null;
  const { data, error } = useSearch(debounced, scope);
  // Keep the previous results while the next query is in flight, so the list does not flash empty on every key.
  const shownRef = useRef<SearchResponse | null>(null);
  if (data || !debounced.trim()) shownRef.current = data;
  const result = shownRef.current;
  const hits = result?.hits ?? [];

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => setActive(0), [result]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]");
      const shortcut = (event.key === "k" && (IS_MAC ? event.metaKey : event.ctrlKey)) || (event.key === "/" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey);
      if (!shortcut) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  // Navigating elsewhere (a result, a link) closes the list.
  useEffect(() => setOpen(false), [location]);

  const follow = (hit: SearchHit) => {
    setOpen(false);
    inputRef.current?.blur();
    goTo(hit.url);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      if (open) setOpen(false);
      else inputRef.current?.blur();
      return;
    }
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (hits.length) setActive((i) => (i + (event.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length);
    } else if (event.key === "Enter" && hits[active]) {
      event.preventDefault();
      follow(hits[active]);
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const showList = open && query.trim() !== "";

  return (
    <div className="search" ref={rootRef}>
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder={`搜尋${currentSubject && !everywhere ? "本科目" : ""}`}
        aria-label="搜尋筆記"
        aria-keyshortcuts="/ Control+K"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && hits[active] ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <div className="search-panel">
          <div className="search-status">
            <span>{error ? <span className="search-error">{error}</span> : result ? `${result.total} 個區塊` : "搜尋中…"}</span>
            {currentSubject && (
              <span className="search-scope" role="group" aria-label="搜尋範圍">
                <button type="button" aria-pressed={!everywhere} onClick={() => setEverywhere(false)}>
                  本科目
                </button>
                <button type="button" aria-pressed={everywhere} onClick={() => setEverywhere(true)}>
                  全部
                </button>
              </span>
            )}
          </div>
          <ul className="search-results" id={listId} role="listbox" aria-label="搜尋結果">
            {hits.map((hit, i) => (
              <li key={`${hit.page}#${hit.section?.id ?? ""}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <a
                  href={hit.url}
                  className="search-hit"
                  tabIndex={-1}
                  onMouseMove={() => setActive(i)}
                  onClick={(event) => {
                    if (event.ctrlKey || event.metaKey || event.shiftKey) return;
                    event.preventDefault();
                    follow(hit);
                  }}
                >
                  <span className="search-hit-head">
                    <span className="search-hit-title">
                      <Marked {...hit.title} />
                    </span>
                    <span className="search-hit-where">
                      {[!scope && hit.subjectTitle, hit.section ? hit.pageTitle : "頁面"].filter(Boolean).join(" / ")}
                    </span>
                  </span>
                  {hit.snippet.text && (
                    <span className="search-hit-snippet">
                      {hit.snippet.before && "…"}
                      <Marked {...hit.snippet} />
                      {hit.snippet.after && "…"}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
          {result && result.total > hits.length && <p className="search-more">只顯示前 {hits.length} 個，請加上更多關鍵字</p>}
        </div>
      )}
    </div>
  );
}

function Marked({ text, matches }: SearchText) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of matches) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<mark key={start}>{text.slice(start, end)}</mark>);
    at = end;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}
