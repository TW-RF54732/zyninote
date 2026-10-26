// The single list of remark/rehype plugins used by both the .md renderer and the MDX compiler.
import type { PluggableList } from "unified";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { rehypeMermaid } from "./rehype-mermaid.ts";
import { rehypeSectionize } from "./rehype-sectionize.ts";
import { remarkHeadingAttrs } from "./remark-heading-attrs.ts";

export const remarkPlugins: PluggableList = [remarkGfm, remarkMath, remarkHeadingAttrs];

// Sectionize runs before KaTeX so heading titles use the TeX source rather than rendered markup.
export const rehypePlugins: PluggableList = [rehypeSectionize, rehypeMermaid, rehypeKatex];
