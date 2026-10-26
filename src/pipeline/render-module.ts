import { relative } from "node:path";
import { createElement, type ComponentType, type Context } from "react";
import { renderToString } from "react-dom/server";
import type { EnvironmentModuleNode, ViteDevServer } from "vite";

export type RenderedModule = {
  html: string;
  meta: Record<string, unknown> | undefined;
  /** Absolute paths of project files this module imports (transitively), excluding itself. */
  deps: string[];
};

/**
 * Renders a .mdx or .tsx note through Vite's SSR loader, so it uses the exact plugin chain the browser uses.
 * `path` is the note's content-relative path, provided to `<Link>` through NoteContext like the client does.
 */
export async function renderModule(vite: ViteDevServer, root: string, file: string, path: string): Promise<RenderedModule> {
  const url = `/${relative(root, file).split("\\").join("/")}`;
  // A note is only rebuilt when its source changed, but Vite's invalidation arrives with the watcher, which can be
  // later than the sync (tag writes resync right away). Drop the cached module so the current source is loaded.
  const graph = vite.environments.ssr.moduleGraph;
  graph.getModulesByFile(file)?.forEach((cached) => graph.invalidateModule(cached));
  const mod = await vite.ssrLoadModule(url);
  const Component = mod.default as ComponentType | undefined;
  if (typeof Component !== "function") throw new Error("缺少 default export 的元件");
  // Load the runtime through Vite as well: the note imports it from the SSR module graph, so the context must come from there.
  const runtime = await vite.ssrLoadModule("/src/runtime/index.ts");
  const NoteContext = runtime.NoteContext as Context<string | null>;
  return {
    html: renderToString(createElement(NoteContext.Provider, { value: path }, createElement(Component))),
    meta: mod.meta as Record<string, unknown> | undefined,
    deps: collectDeps(vite, root, file),
  };
}

function collectDeps(vite: ViteDevServer, root: string, file: string): string[] {
  const graph = vite.environments.ssr.moduleGraph;
  const deps = new Set<string>();
  const seen = new Set<EnvironmentModuleNode>();
  const walk = (mod: EnvironmentModuleNode) => {
    if (seen.has(mod)) return;
    seen.add(mod);
    if (mod.file && mod.file !== file && mod.file.startsWith(root) && !mod.file.includes("/node_modules/")) deps.add(mod.file);
    mod.importedModules.forEach(walk);
  };
  graph.getModulesByFile(file)?.forEach(walk);
  return [...deps];
}
