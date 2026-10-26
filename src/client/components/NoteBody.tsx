import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import type { Page } from "../../shared/types.ts";
import { currentHashId, foldState, handleFoldClick, initFold, reveal, type FoldState } from "../behavior/fold.ts";
import { renderMermaid } from "../behavior/mermaid.ts";

type Loaded = { hash: string; Component: ComponentType };

/**
 * Renders a page body. Markdown uses the indexed HTML; MDX/TSX modules are imported through Vite
 * so interactive components run in the browser. Re-imports happen only when the page hash changes.
 */
export function NoteBody({ page }: { page: Page }) {
  const ref = useRef<HTMLDivElement>(null);
  const isModule = page.format !== "md";
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Fold state survives live updates of the same page, but not navigation.
  const foldMemory = useRef<{ path: string; state: FoldState } | null>(null);

  useEffect(() => {
    if (!isModule) return;
    let alive = true;
    // The 13-digit `t` query is Vite's cache-busting timestamp.
    import(/* @vite-ignore */ `/content/${page.path}?t=${Date.now()}`)
      .then((mod: { default: ComponentType }) => {
        if (alive) {
          setLoaded({ hash: page.hash, Component: mod.default });
          setLoadError(null);
        }
      })
      .catch((error: Error) => alive && setLoadError(error.message));
    return () => {
      alive = false;
    };
  }, [isModule, page.path, page.hash]);

  const body = useMemo(() => {
    if (!isModule) return <div className="note-body" dangerouslySetInnerHTML={{ __html: page.html }} />;
    if (!loaded) return <div className="note-body" dangerouslySetInnerHTML={{ __html: page.html }} />;
    return (
      <div className="note-body" key={loaded.hash}>
        <loaded.Component />
      </div>
    );
  }, [isModule, loaded, page.html]);

  // After every content swap: restore or initialise folds, render diagrams, honour the URL hash.
  const renderedKey = isModule ? (loaded?.hash ?? "ssr") : page.hash;
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
    <div ref={ref} onClick={onClick}>
      {loadError && <pre className="zn-error">{loadError}</pre>}
      {body}
    </div>
  );
}
