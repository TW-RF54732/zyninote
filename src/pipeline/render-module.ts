import { relative } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import type { EnvironmentModuleNode, ViteDevServer } from "vite";

export type RenderedModule = {
  html: string;
  meta: Record<string, unknown> | undefined;
  /** Absolute paths of project files this module imports (transitively), excluding itself. */
  deps: string[];
};

/** Renders a .mdx or .tsx note through Vite's SSR loader, so it uses the exact plugin chain the browser uses. */
export async function renderModule(vite: ViteDevServer, root: string, file: string): Promise<RenderedModule> {
  const url = `/${relative(root, file).split("\\").join("/")}`;
  const mod = await vite.ssrLoadModule(url);
  const Component = mod.default as ComponentType | undefined;
  if (typeof Component !== "function") throw new Error("缺少 default export 的元件");
  return {
    html: renderToString(createElement(Component)),
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
