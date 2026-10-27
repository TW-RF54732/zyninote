import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import { basename, join, resolve } from "node:path";
import { normalizePath, type PluginOption } from "vite";
import { preprocessMdx } from "../pipeline/attrs.ts";
import { normalizePageMeta, readFrontmatter } from "../pipeline/meta.ts";
import { notePlugins } from "../pipeline/plugins.ts";

/** Vite plugins shared by server-side rendering (indexing) and the browser, so both compile notes identically. */
export function zyninotePlugins(root: string, contentDir: string): PluginOption[] {
  const vault = normalizePath(contentDir);
  const inVault = (file: string) => {
    const f = normalizePath(file);
    return f === vault || f.startsWith(`${vault}/`);
  };
  // Bare imports from vault files fall back to resolving as if imported from the app, so a vault outside the
  // project still gets the app's react, katex, ... without its own node_modules.
  const appImporter = join(root, "src/client/main.tsx");
  return [
    {
      name: "zyninote:vault",
      enforce: "pre",
      async resolveId(source, importer, options) {
        // `/content/<path>` is the vault, wherever it is on disk (the browser and the indexer both import notes this way).
        if (source.startsWith("/content/")) {
          const q = source.indexOf("?");
          const raw = q < 0 ? source.slice(9) : source.slice(9, q);
          let rel = raw;
          try {
            rel = decodeURIComponent(raw);
          } catch {}
          const file = normalizePath(resolve(contentDir, rel));
          if (!inVault(file)) return null;
          return q < 0 ? file : file + source.slice(q);
        }
        if (!importer || !inVault(importer.split("?")[0])) return null;
        if (/^[./\\\0]/.test(source) || /^[a-zA-Z]:/.test(source) || source.includes(":")) return null;
        const own = await this.resolve(source, importer, { ...options, skipSelf: true });
        return own ?? this.resolve(source, appImporter, { ...options, skipSelf: true });
      },
    },
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
        if (!inVault(file)) return;
        const seen = new Set<(typeof modules)[number]>();
        for (const mod of modules) this.environment.moduleGraph.invalidateModule(mod, seen, timestamp, true);
        return [];
      },
    },
  ];
}
