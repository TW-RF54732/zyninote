import { useEffect, useState, useSyncExternalStore } from "react";
import type { Page, SubjectResponse, Tree, UpdateEvent } from "../shared/types.ts";

// Every content update bumps the version, so every mounted query refetches.
let version = 0;
const listeners = new Set<() => void>();

if (import.meta.hot) {
  import.meta.hot.on("zyninote:update", (_event: UpdateEvent) => {
    version++;
    listeners.forEach((listener) => listener());
  });
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
    fetch(url)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        return body as T;
      })
      .then(
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

export const useTree = () => useApi<Tree>("/api/tree");
export const useSubject = (name: string) => useApi<SubjectResponse>(`/api/subject/${encodeURIComponent(name)}`);
export const usePage = (subject: string, slug: string) => useApi<Page>(`/api/page/${encodeURIComponent(subject)}/${encodeURIComponent(slug)}`);
