import type { Element, Root } from "hast";
import { toString } from "hast-util-to-string";
import { visit } from "unist-util-visit";

/** Turns ```mermaid code blocks into `<pre class="mermaid">` for client-side rendering. */
export function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;
      const code = node.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
      const classes = code?.properties.className;
      if (!code || !Array.isArray(classes) || !classes.includes("language-mermaid")) return;
      parent.children[index] = {
        type: "element",
        tagName: "pre",
        properties: { className: ["mermaid"] },
        children: [{ type: "text", value: toString(code) }],
      };
    });
  };
}
