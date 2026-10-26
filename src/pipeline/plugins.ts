// The single list of remark/rehype plugins used by both the .md renderer and the MDX compiler.
import type { PluggableList } from "unified";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { rehypeLinks } from "./rehype-links.ts";
import { rehypeMermaid } from "./rehype-mermaid.ts";
import { rehypeSectionize } from "./rehype-sectionize.ts";
import { remarkHeadingAttrs } from "./remark-heading-attrs.ts";
import { remarkWikilinks } from "./remark-wikilinks.ts";

/** Plugins for notes under `contentDir`; link paths are resolved relative to each file's path inside it. */
export function notePlugins(contentDir: string): { remarkPlugins: PluggableList; rehypePlugins: PluggableList } {
  return {
    remarkPlugins: [remarkGfm, remarkMath, remarkHeadingAttrs, remarkWikilinks],
    // Sectionize runs before KaTeX so heading titles use the TeX source rather than rendered markup.
    rehypePlugins: [[rehypeLinks, { contentDir }], rehypeSectionize, rehypeMermaid, rehypeKatex],
  };
}
