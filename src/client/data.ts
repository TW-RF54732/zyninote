import { useEffect, useState, useSyncExternalStore } from "react";
import type { CheatCardView, CheatSheetView, PageView, SearchResponse, SubjectResponse, TagWriteResult, Tree, UpdateEvent } from "../shared/types.ts";

// Every content update bumps the version, so every mounted query refetches.
let version = 0;
const listeners = new Set<() => void>();

if (import.meta.hot) {
  import.meta.hot.on("zyninote:update", (_event: UpdateEvent) => {
    refetchAll();
    for (const [subject, count] of watchedSheets) if (count > 0) void loadCheats(subject);
  });
}

function refetchAll() {
  version++;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useContentVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

type Query<T> = { data: T | null; error: string | null; loading: boolean };

/** `url` null means nothing to fetch. */
function useApi<T>(url: string | null): Query<T> {
  const v = useContentVersion();
  const [state, setState] = useState<{ url: string | null; data: T | null; error: string | null }>({ url, data: null, error: null });

  useEffect(() => {
    if (url === null) return;
    let alive = true;
    fetchShared<T>(url, v).then(
      (data) => alive && setState({ url, data, error: null }),
      (error: Error) => alive && setState({ url, data: null, error: error.message }),
    );
    return () => {
      alive = false;
    };
  }, [url, v]);

  if (url === null) return { data: null, error: null, loading: false };
  // While a refetch of the same URL is in flight, keep showing the previous data.
  if (state.url !== url) return { data: null, error: null, loading: true };
  return { data: state.data, error: state.error, loading: !state.data && !state.error };
}

// Queries mounted together (e.g. cheat sheet cards from the same page) share one request per URL and version.
const inflight = new Map<string, Promise<unknown>>();

function fetchShared<T>(url: string, v: number): Promise<T> {
  const key = `${v} ${url}`;
  let request = inflight.get(key);
  if (!request) {
    request = fetchJson<T>(url).finally(() => inflight.delete(key));
    inflight.set(key, request);
  }
  return request as Promise<T>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

export const useTree = () => useApi<Tree>("/api/tree");
export const useSubject = (name: string) => useApi<SubjectResponse>(`/api/subject/${encodeURIComponent(name)}`);
export const usePage = (subject: string, slug: string) => useApi<PageView>(`/api/page/${encodeURIComponent(subject)}/${encodeURIComponent(slug)}`);
/** Any page by key: "subject/slug" for a note, "subject/" for a subject's _subject.md. */
export const usePageByKey = (key: string) => useApi<PageView>(`/api/page/${key.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`);
/** Block search; an empty query fetches nothing. */
export const useSearch = (query: string, subject: string | null) =>
  useApi<SearchResponse>(query.trim() ? `/api/search?${new URLSearchParams({ q: query, ...(subject ? { subject } : {}) })}` : null);

/** A tag write rejected because some tags are not registered yet. */
export class UnregisteredTagsError extends Error {
  constructor(
    message: string,
    public tags: string[],
  ) {
    super(message);
  }
}

// Tag writes rewrite notes and _subject.md; the server resyncs before answering, so refetching then shows the result.
async function writeTags(subject: string, path: string, method: string, body: unknown): Promise<TagWriteResult> {
  const res = await fetch(`/api/tags/${encodeURIComponent(subject)}${path}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Array.isArray(data.unregistered) ? new UnregisteredTagsError(data.error, data.unregistered) : new Error(data.error ?? res.statusText);
  refetchAll();
  return data as TagWriteResult;
}

/** Sets a note's tags; `register` also registers the ones the subject does not know yet. */
export const setNoteTags = (subject: string, slug: string, tags: string[], register: boolean) =>
  writeTags(subject, `/notes/${encodeURIComponent(slug)}`, "PUT", { tags, register });
export const registerTag = (subject: string, tag: string) => writeTags(subject, "/register", "POST", { tag });
/** Renames a tag in every note of the subject; renaming onto an existing tag merges the two. */
export const renameTag = (subject: string, from: string, to: string) => writeTags(subject, "/rename", "POST", { from, to });
export const removeTag = (subject: string, tag: string) => writeTags(subject, "/remove", "POST", { tag });
// Cheat sheets have their own store so a write updates the buttons and the panel at once (optimistically), without
// refetching every page. Every load and write takes a sequence number; a response older than what is shown is dropped.
type SheetState = { sheet: CheatSheetView | null; error: string | null };
const sheets = new Map<string, SheetState>();
const sheetSeq = new Map<string, { issued: number; shown: number }>();
const sheetListeners = new Set<() => void>();
const watchedSheets = new Map<string, number>();

function nextSeq(subject: string): number {
  const seq = sheetSeq.get(subject) ?? { issued: 0, shown: 0 };
  sheetSeq.set(subject, seq);
  return ++seq.issued;
}

function showSheet(subject: string, seq: number, state: SheetState) {
  const current = sheetSeq.get(subject)!;
  if (seq < current.shown) return;
  current.shown = seq;
  sheets.set(subject, state);
  sheetListeners.forEach((listener) => listener());
}

const cheatsUrl = (subject: string) => `/api/cheats/${encodeURIComponent(subject)}`;

async function loadCheats(subject: string) {
  const seq = nextSeq(subject);
  try {
    showSheet(subject, seq, { sheet: await fetchJson<CheatSheetView>(cheatsUrl(subject)), error: null });
  } catch (error) {
    showSheet(subject, seq, { sheet: null, error: (error as Error).message });
  }
}

function subscribeSheets(listener: () => void) {
  sheetListeners.add(listener);
  return () => sheetListeners.delete(listener);
}

export function useCheats(subject: string): { data: CheatSheetView | null; error: string | null } {
  useEffect(() => {
    watchedSheets.set(subject, (watchedSheets.get(subject) ?? 0) + 1);
    void loadCheats(subject);
    return () => void watchedSheets.set(subject, watchedSheets.get(subject)! - 1);
  }, [subject]);
  const state = useSyncExternalStore(subscribeSheets, () => sheets.get(subject));
  return { data: state?.sheet ?? null, error: state?.error ?? null };
}

/**
 * A cheat sheet write. `optimistic` shows the expected result at once; the server's answer then replaces it,
 * and a failure reloads the real sheet and rejects with the server's message.
 */
async function writeCheats(subject: string, path: string, method: string, body?: unknown, optimistic?: (cards: CheatCardView[]) => CheatCardView[]): Promise<CheatSheetView> {
  const seq = nextSeq(subject);
  const current = sheets.get(subject)?.sheet;
  if (optimistic && current) showSheet(subject, seq, { sheet: { ...current, cards: optimistic(current.cards) }, error: null });
  try {
    const sheet = await fetchJson<CheatSheetView>(`${cheatsUrl(subject)}${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    showSheet(subject, seq, { sheet, error: null });
    return sheet;
  } catch (error) {
    void loadCheats(subject);
    throw error;
  }
}

/** `preview` is the card shown until the server answers with the real one. */
export const addCheat = (subject: string, ref: string, preview?: CheatCardView) =>
  writeCheats(subject, "/cards", "POST", { ref }, preview && ((cards) => [...cards, preview]));
export const removeCheat = (subject: string, id: string) =>
  writeCheats(subject, `/cards/${encodeURIComponent(id)}`, "DELETE", undefined, (cards) => cards.filter((card) => card.id !== id));
export const repointCheat = (subject: string, id: string, ref: string) => writeCheats(subject, `/cards/${encodeURIComponent(id)}`, "PATCH", { ref });
export const reorderCheats = (subject: string, ids: string[]) =>
  writeCheats(subject, "/order", "PUT", { ids }, (cards) => ids.flatMap((id) => cards.find((card) => card.id === id) ?? []));
