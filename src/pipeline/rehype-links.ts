import type { Element, Root } from "hast";
import { relative, sep } from "node:path";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";
import { isExternal, resolveLink, safeDecode } from "../shared/links.ts";

/**
 * Rewrites internal links (wikilinks and Markdown links alike) into the shared link markup:
 * `<a class="zn-link" data-zn-link="quiet|visible" data-zn-ref="<as written>" href="<page URL>">`.
 * Links that resolve outside content/ or use absolute paths lose their href. Whether a target exists is
 * checked later across all pages, so the output only depends on this file.
 */
export function rehypeLinks(options: { contentDir: string }) {
  return (tree: Root, file: VFile) => {
    const from = file.path ? relative(options.contentDir, file.path).split(sep).join("/") : "";
    visit(tree, "element", (node: Element) => {
      if (node.tagName !== "a") return;
      const props = node.properties;
      const href = props.href;
      if (typeof href !== "string" || isExternal(href) || props.dataFootnoteRef !== undefined || props.dataFootnoteBackref !== undefined) return;

      // mdast-util-to-hast percent-encodes URLs; keep `ref` as the author wrote it.
      const hash = href.indexOf("#");
      const ref = hash < 0 ? safeDecode(href) : `${safeDecode(href.slice(0, hash))}#${safeDecode(href.slice(hash + 1))}`;
      const target = resolveLink(from, ref);
      const classes = Array.isArray(props.className) ? props.className : [];
      props.className = [...classes, "zn-link"];
      props.dataZnLink = props.dataZnLink === "quiet" ? "quiet" : "visible";
      props.dataZnRef = ref;
      if (target.kind === "error") delete props.href;
      else props.href = target.href;
    });
  };
}
