import type { Link, Parent, PhrasingContent, Root, Text } from "mdast";
import { SKIP, visit } from "unist-util-visit";

/** `[[path]]`, `[[path#id]]`, `[[path|text]]`, `[[path#id|text]]`. Inside GFM tables, write the pipe as `\|`. */
const WIKILINK = /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g;

/**
 * Turns wikilinks into ordinary link nodes marked as quiet. Path resolution happens later in `rehypeLinks`,
 * which treats every link the same way. Only plain text is scanned, so wikilinks in code stay literal.
 */
export function remarkWikilinks() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent: Parent | undefined) => {
      if (!parent || index === undefined || parent.type === "link" || !node.value.includes("[[")) return;
      const parts: PhrasingContent[] = [];
      let last = 0;
      for (const match of node.value.matchAll(WIKILINK)) {
        if (match.index > last) parts.push({ type: "text", value: node.value.slice(last, match.index) });
        const target = match[1].trim();
        const link: Link = {
          type: "link",
          url: target,
          children: [{ type: "text", value: match[2]?.trim() || target }],
          data: { hProperties: { dataZnLink: "quiet" } },
        };
        parts.push(link);
        last = match.index + match[0].length;
      }
      if (!parts.length) return;
      if (last < node.value.length) parts.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...(parts as typeof parent.children));
      return [SKIP, index + parts.length];
    });
  };
}
