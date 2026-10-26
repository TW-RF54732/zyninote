# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Zyninote is a study-notes system: users write `.md` / `.mdx` / `.tsx` under `content/`, and the system provides navigation, TOCs, styling and features. `PLAN.md` is the authoritative spec, written in Traditional Chinese with phased milestones. Phase 1 (skeleton and pipeline) is done; later phases cover links, cheat sheets, tags/search and agent docs. `README.md` records decisions that deviate from or extend PLAN.md. Keep it updated when making new ones.

## Commands

```sh
npm run dev                                   # tsx watch src/server/main.ts (restarts on server code changes) → http://localhost:5180 (PORT env overrides)
npm run check                                 # index once, print diagnostics, exit 1 on errors (src/server/check.ts)
npm test                                      # vitest run (src/**/*.test.ts)
npx vitest run -t "suffixes duplicate ids"    # single test by name
npm run typecheck                             # tsc --noEmit (TypeScript 7)
```

There is no build step yet; the app runs only as a local dev server. Only npm is available (no pnpm/bun).

## Architecture

The app is a single Node process: Vite 8 in middleware mode plus a Hono API (`src/server/main.ts`). Requests to `/api/*` go to Hono. Everything else goes to Vite's middlewares, then an SPA fallback serves `src/client/index.html`. Vite is configured inline (`configFile: false`) in `src/server/setup.ts`, shared with `check.ts`, and its plugins live in `src/server/vite-plugins.ts`.

### The unified pipeline (core invariant)

Each format renders to HTML whose headings are wrapped in `<section class="zn-section" data-id data-level data-title data-fold>`. One segmenter, `src/pipeline/segment.ts`, then turns that HTML into `Section[]` plus a nested `toc`. Any new feature that needs blocks (search, cheat sheet, preview, backlinks) should read from these sections, not re-parse sources.

- **`.md`**: unified pipeline in `render-md.ts`.
- **`.mdx` and `.tsx`**: rendered through Vite's `ssrLoadModule` + `renderToString` (`render-module.ts`). The browser imports the same modules through the same Vite plugin chain, so server-indexed output and client-rendered output match, including heading IDs. Keep that property when changing plugins.
- **Shared plugin list**: `notePlugins(contentDir)` in `src/pipeline/plugins.ts` is the single list of remark/rehype plugins used by both md and MDX. `rehypeSectionize` must run before `rehypeKatex` so heading titles come from the TeX source.
- **Heading attributes** `{#id .fold}`:
  - In `.md`, `remark-heading-attrs.ts` strips them from the heading text.
  - In MDX, `{}` is a JS expression, so the `zyninote:mdx-preprocess` Vite plugin (`preprocessMdx` in `attrs.ts`, fence-aware) first rewrites them to `{/*zn #id .fold*/}`. The same remark plugin then reads that marker. The preprocessor also turns frontmatter into `export const meta`.
- **Duplicate IDs**: `rehypeSectionize` suffixes duplicate IDs and marks the section `data-zn-dup`, which `segment.ts` turns into a diagnostic.
- **TSX notes**: use `<Section id title fold>` from `src/runtime` (imported as `"zyninote"` via alias in both Vite and tsconfig). The heading level comes from React-context nesting, outermost = h2. Duplicate IDs in TSX are only warned about, never rewritten.
- **Interactive components**: wrap output in `<Interactive description>`. That emits `data-zn-description`, which the segmenter uses as the block's text.

### Links

- **One resolver**: `resolveLink(from, ref)` in `src/shared/links.ts` is pure string logic, shared by the pipeline, the TSX `<Link>`, the segmenter, the checker and the client. It maps a relative ref to a page key (`subject/slug`, `subject/` or `""`), a file, or an error (`outside` / `absolute`). Page key and URL coincide: `pageUrl(key)`.
- **One markup**: every internal link renders as `<a class="zn-link" data-zn-link="quiet|visible" data-zn-ref="<ref as written>" href>`. `remark-wikilinks.ts` turns `[[...]]` into link nodes marked quiet, `rehype-links.ts` rewrites every `<a>` (it needs `file.path`, so renderers pass the absolute file path), and `<Link>` emits the same markup. Error links have no href. `segment.ts` reads this markup into `Section.links` and `Page.links`.
- **TSX path context**: `<Link>` gets the note's path from `NoteContext`. The server must take the context from `vite.ssrLoadModule("/src/runtime/index.ts")`, not a Node import, because notes use the SSR module instance. The client provides it in `usePageBody`.
- **Render output never depends on other pages**: existence checks, `broken` refs and backlinks come from `checkLinks` (`link-check.ts`), which reruns over the whole index after every `sync()`. The API serves pages as `PageView` (page + url + backlinks + broken), and the client marks broken links in the DOM.
- **Client**: `LinkLayer` handles all `a.zn-link` behavior at the document level: the `zn-mod` class while Ctrl/Cmd is held, the hover preview, the touch sheet and in-app navigation (`goTo`). `BlockView` is the shared block display (previews now, cheat sheet cards later). It renders the whole page body and hides everything except the target section (`focusSection`).

### Indexing, cache and live update

`src/pipeline/indexer.ts` exposes one `sync()`, used both at startup and after every change:

1. It rescans the layout (`scan.ts`).
2. It hashes each source plus its recorded dependencies. MDX/TSX dependencies come from the Vite SSR module graph.
3. It rebuilds only pages whose hashes changed, otherwise reusing `.zyninote/cache/` (`cache.ts`).

Failed builds keep an empty hash so they retry on every sync. Bump `PIPELINE_VERSION` in `cache.ts` whenever rendering or segmenting output changes. The cache must stay purely derived: deleting it must never lose data.

On a change under `content/`:

1. The `zyninote:content-hmr` plugin invalidates the affected modules and returns `[]`, suppressing Vite's own reload.
2. `main.ts` debounces watcher events (50ms), runs `sync()`, and sends the custom WS event `zyninote:update`.
3. The client (`src/client/data.ts`) bumps a version and every query refetches.
4. `NoteBody` re-imports an MDX/TSX module only when `page.hash` changes. It uses a 13-digit `?t=` query, which is Vite's timestamp format; don't use `?v=`.

### Client

The client is React 19 with wouter. Routes are `/`, `/:subject/` (the detailed chapter directory) and `/:subject/:slug` (a note).

- **Rendering**: `.md` notes are shown from the indexed HTML. MDX/TSX notes are rendered live from the imported module.
- **DOM behaviors** in `src/client/behavior/`:
  - Folding is a `data-collapsed` attribute toggled by clicking a heading. Fold state is never persisted across loads.
  - Hash navigation expands collapsed ancestors (`reveal`).
  - Mermaid loads lazily and renders only visible diagrams.
- **Layout decision** (overrides PLAN.md 6.1): copy only the *visual style* of onesource.zynimous.dev (dark #141414, monochrome, thin lines; tokens in `styles.css`), not its layout. A chapter page's sidebar shows **that page's own headings**. The subject page is a detailed directory of every chapter's full heading tree.

## Content rules (enforced by `scan.ts`)

- `content/` contains only subject folders, and each subject folder contains only flat files. Subfolders inside a subject are an error.
- Names starting with `_` are system files and never notes: `_subject.md`, `_cheats.json`, `_components/`. Components placed inside a subject must also start with `_`.
- Notes are sorted by frontmatter `order` first, then by numeric-aware file name.
- Each note is served at `/<subject>/<filename without extension>`. Two files with the same name but different extensions conflict.
- Diagnostics (UI text in Traditional Chinese) are printed to the terminal and returned by `/api/tree` and `/api/diagnostics`.
