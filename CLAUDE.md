# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Zyninote is a study-notes system: users write `.md` / `.mdx` / `.tsx` under `content/`, and the system provides navigation, TOCs, styling and features. `PLAN.md` is the authoritative spec, written in Traditional Chinese with phased milestones. Phases 1–4 (pipeline, links, cheat sheet, tags/search) are done; Phase 5 covers agent docs. `README.md` records decisions that deviate from or extend PLAN.md. Keep it updated when making new ones.

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
- **Client**: `LinkLayer` handles all `a.zn-link` behavior at the document level: the `zn-mod` class while Ctrl/Cmd is held, the hover preview, the touch sheet and in-app navigation (`goTo`). `BlockView` is the shared block display (previews and cheat sheet cards). It renders the whole page body and hides everything except the target section (`focusSection`).

### Cheat sheet

- **Data**: `content/<subject>/_cheats.json` holds only `{ id, ref, added }` cards in display order. A card's `ref` is a relative link from that file, resolved with `resolveCardRef` (`src/shared/cheats.ts`, a wrapper over `resolveLink`), and must carry `#id`.
- **Server** (`src/pipeline/cheats.ts`): `CheatStore` reads the file fresh on every request and serializes writes per subject (temp file + rename, one card per line, unknown fields kept, malformed files never overwritten). `describeCards` resolves cards against the index into `CheatCardView`s plus diagnostics; the indexer reruns it on every `sync()`. The API lives under `/api/cheats/:subject`.
- **Client**: `CheatPanel` (mounted in `App`) is the edge dock; cards render through `BlockView`, so they follow source edits. `useCheatAdd` (used by `NoteBody` only) injects the heading `+` buttons into the DOM and asks before adding an overlapping block (`relatedSections`). Filtering (`filterCards`) and drag reordering (`moveCard`) are pure functions in `src/shared/cheats.ts`.
- **Client store**: cheat sheets have their own store in `data.ts` (not `useApi`). Writes apply an optimistic result at once, then the server response; sequence numbers drop stale responses. `zyninote:update` reloads watched sheets.

### Tags

- **Data**: a note's `tags` live in its frontmatter (TSX: `export const meta`); `_subject.md`'s `tags:` is the subject's registry, exposed as `SubjectMeta.tags`. `checkTags` (`src/pipeline/tags.ts`) warns about unregistered tags on every `sync()`, like the link and cheat checks.
- **Writes** (`TagStore`, API under `/api/tags/:subject`): set a note's tags (409 with `unregistered` unless `register`), register, rename (renaming onto an existing tag merges), remove. Files are read fresh from disk; every new file content is computed and verified (`writeTags` re-reads the result) before anything is written, so one unrewritable file aborts the whole operation. Only the `tags` entry is rewritten textually; the rest of the frontmatter must read back unchanged. TSX notes whose `tags` is not a string-array literal fall back to the indexed tags and fail only if they need rewriting.
- **Sync after writes**: tag routes await `resync` (passed from `main.ts`, the same serialized queue the watcher uses) before answering. Because that sync can run before the watcher's HMR invalidation, `renderModule` invalidates the note's SSR module itself before loading it.
- **Client**: `TagEditor` (note header) and `TagManager` (subject page); writes call `refetchAll()` in `data.ts`.

### Search

`src/pipeline/search.ts`: one document per section plus one per page (title, summary, tags), built lazily after each `sync()` in reading order. Every whitespace-separated term must occur (substring, `fold` = per-character NFKC + lowercase that keeps string length so match offsets map to the original text) in the heading, the block text or the page title. `GET /api/search?q=&subject=`; the client is `Search` in the header.

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
- **Layout decision** (overrides PLAN.md 6.1): copy only the *visual style* of onesource.zynimous.dev (dark #141414, monochrome, thin lines), not its layout. Every page is: sticky `.topbar` header, a left rail column (`--rail`) and the main column; no footer.
  - A chapter page's left rail shows **that page's own headings** (`PageToc`).
  - `NavSidebar` is the global sidebar (subjects → notes, never headings). Its open state lives in `nav.ts` and resets per route: open on directory pages (docked in the rail), closed while reading (when opened it floats over the page TOC). Narrow screens: drawer. Ctrl/Cmd+B toggles, `/` focuses search.
  - The subject page reads like a book's contents (chapters separated like h2 sections, heading trees, no cards or numbering); the home page does the same one level up.
  - Design tokens (colors, type scale with nothing under 14px, radii, shadow) live in `:root` in `styles.css`; components use the variables, not raw hex or pixel font sizes.

## Content rules (enforced by `scan.ts`)

- `content/` contains only subject folders, and each subject folder contains only flat files. Subfolders inside a subject are an error.
- Names starting with `_` are system files and never notes: `_subject.md`, `_cheats.json`, `_components/`. Components placed inside a subject must also start with `_`.
- Notes are sorted by frontmatter `order` first, then by numeric-aware file name.
- Each note is served at `/<subject>/<filename without extension>`. Two files with the same name but different extensions conflict.
- Diagnostics (UI text in Traditional Chinese) are printed to the terminal and returned by `/api/tree` and `/api/diagnostics`.
