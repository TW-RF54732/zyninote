import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import { NoteContext } from "zyninote";
import type { Page, PageView } from "../../shared/types.ts";
import { currentHashId, foldState, handleFoldClick, initFold, reveal, type FoldState } from "../behavior/fold.ts";
import { markBroken } from "../behavior/links.ts";
import { renderMermaid } from "../behavior/mermaid.ts";

type Loaded = { path: string; hash: string; Component: ComponentType };

/**
 * A page's body. Markdown uses the indexed HTML; MDX/TSX modules are imported through Vite
 * so interactive components run in the browser. Re-imports happen only when the page hash changes.
 * `renderedKey` changes whenever the body's DOM is replaced.
 */
export function usePageBody(page: Page): { body: ReactNode; error: string | null; renderedKey: string } {
  const isModule = page.format !== "md";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isModule) return;
    let alive = true;
    // The 13-digit `t` query is Vite's cache-busting timestamp.
    import(/* @vite-ignore */ `/content/${page.path}?t=${Date.now()}`)
      .then((mod: { default: ComponentType }) => {
        if (alive) {
          setLoaded({ path: page.path, hash: page.hash, Component: mod.default });
          setLoadError(null);
        }
      })
      .catch((error: Error) => alive && setLoadError(error.message));
    return () => {
      alive = false;
    };
  }, [isModule, page.path, page.hash]);

  const current = loaded?.path === page.path ? loaded : null;
  const body = useMemo(() => {
    if (!isModule || !current) return <div className="note-body" dangerouslySetInnerHTML={{ __html: page.html }} />;
    return (
      <div className="note-body" key={current.hash}>
        <NoteContext.Provider value={page.path}>
          <current.Component />
        </NoteContext.Provider>
      </div>
    );
  }, [isModule, current, page.html, page.path]);

  return { body, error: loadError, renderedKey: isModule ? (current?.hash ?? "ssr") : page.hash };
}

/** The body of the page being read: folding, hash navigation, diagrams and broken-link marks. */
export function NoteBody({ page }: { page: PageView }) {
  const ref = useRef<HTMLDivElement>(null);
  const { body, error, renderedKey } = usePageBody(page);
  // Fold state survives live updates of the same page, but not navigation.
  const foldMemory = useRef<{ path: string; state: FoldState } | null>(null);

  // After every content swap: restore or initialise folds, render diagrams, honour the URL hash.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const memory = foldMemory.current;
    initFold(root, memory?.path === page.path ? memory.state : undefined);
    const id = currentHashId();
    if (id && memory?.path !== page.path) reveal(id, "auto");
    void renderMermaid(root);
    foldMemory.current = { path: page.path, state: foldState(root) };
  }, [page.path, renderedKey]);

  // Link targets can break or heal without this page changing.
  const broken = page.broken.join("\n");
  useLayoutEffect(() => {
    if (ref.current) markBroken(ref.current, page.broken);
  }, [renderedKey, broken]);

  useEffect(() => {
    const onHash = () => {
      const id = currentHashId();
      if (!id || !reveal(id) || !ref.current) return;
      void renderMermaid(ref.current);
      if (foldMemory.current) foldMemory.current.state = foldState(ref.current);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const onClick = (event: React.MouseEvent) => {
    const section = handleFoldClick(event.nativeEvent);
    if (!section || !ref.current) return;
    foldMemory.current = { path: page.path, state: foldState(ref.current) };
    void renderMermaid(section);
  };

  return (
    <div ref={ref} onClick={onClick} data-links={page.meta.links}>
      {error && <pre className="zn-error">{error}</pre>}
      {body}
    </div>
  );
}
