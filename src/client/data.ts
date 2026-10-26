import { useEffect, useState, useSyncExternalStore } from "react";
import type { CheatSheetView, PageView, SubjectResponse, Tree, UpdateEvent } from "../shared/types.ts";

// Every content update bumps the version, so every mounted query refetches.
// Cheat sheet writes bump it too: the watcher would, but only after a debounce and a sync.
let version = 0;
const listeners = new Set<() => void>();

function bumpVersion() {
  version++;
  listeners.forEach((listener) => listener());
}

if (import.meta.hot) {
  import.meta.hot.on("zyninote:update", (_event: UpdateEvent) => bumpVersion());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useContentVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

type Query<T> = { data: T | null; error: string | null; loading: boolean };

function useApi<T>(url: string): Query<T> {
  const v = useContentVersion();
  const [state, setState] = useState<{ url: string; data: T | null; error: string | null }>({ url, data: null, error: null });

  useEffect(() => {
    let alive = true;
    fetchShared<T>(url, v).then(
      (data) => alive && setState({ url, data, error: null }),
      (error: Error) => alive && setState({ url, data: null, error: error.message }),
    );
    return () => {
      alive = false;
    };
  }, [url, v]);

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
export const useCheats = (subject: string) => useApi<CheatSheetView>(`/api/cheats/${encodeURIComponent(subject)}`);

/** Cheat sheet writes. Each resolves with the new sheet and refreshes every query; failures reject with the server's message. */
async function writeCheats(subject: string, path: string, method: string, body?: unknown): Promise<CheatSheetView> {
  const sheet = await fetchJson<CheatSheetView>(`/api/cheats/${encodeURIComponent(subject)}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  bumpVersion();
  return sheet;
}

export const addCheat = (subject: string, ref: string) => writeCheats(subject, "/cards", "POST", { ref });
export const removeCheat = (subject: string, id: string) => writeCheats(subject, `/cards/${encodeURIComponent(id)}`, "DELETE");
export const repointCheat = (subject: string, id: string, ref: string) => writeCheats(subject, `/cards/${encodeURIComponent(id)}`, "PATCH", { ref });
export const reorderCheats = (subject: string, ids: string[]) => writeCheats(subject, "/order", "PUT", { ids });
