import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import { basename } from "node:path";
import type { PluginOption } from "vite";
import { preprocessMdx } from "../pipeline/attrs.ts";
import { normalizePageMeta, readFrontmatter } from "../pipeline/meta.ts";
import { notePlugins } from "../pipeline/plugins.ts";

/** Vite plugins shared by server-side rendering (indexing) and the browser, so both compile notes identically. */
export function zyninotePlugins(contentDir: string): PluginOption[] {
  return [
    {
      name: "zyninote:mdx-preprocess",
      enforce: "pre",
      transform(code, id) {
        const file = id.split("?")[0];
        if (!file.endsWith(".mdx")) return;
        const { data } = readFrontmatter(code);
        return preprocessMdx(code, normalizePageMeta(data, basename(file, ".mdx")));
      },
    },
    { enforce: "pre", ...mdx(notePlugins(contentDir)) },
    react(),
    {
      // Content changes are handled by the indexer, which tells the client what to refetch.
      // Here we only invalidate the changed modules (and their importers) and suppress Vite's own reload.
      name: "zyninote:content-hmr",
      hotUpdate({ file, modules, timestamp }) {
        if (!file.startsWith(contentDir)) return;
        const seen = new Set<(typeof modules)[number]>();
        for (const mod of modules) this.environment.moduleGraph.invalidateModule(mod, seen, timestamp, true);
        return [];
      },
    },
  ];
}
