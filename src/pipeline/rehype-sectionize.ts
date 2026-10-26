import { slug } from "github-slugger";
import type { Element, ElementContent, Root, RootContent } from "hast";
import { toString } from "hast-util-to-string";

const HEADING = /^h([1-6])$/;

/**
 * Wraps every top-level heading and the content up to the next heading of the same or higher level
 * in `<section data-id data-level data-title data-fold>`, nesting deeper headings inside.
 *
 * Heading ids: a manual `{#id}` wins, otherwise a github-slugger slug of the heading text (CJK kept).
 * Duplicate ids get a `-1`, `-2`... suffix and the section carries `data-zn-dup` so the segmenter can report it.
 */
export function rehypeSectionize() {
  return (tree: Root) => {
    const used = new Set<string>();
    const out: RootContent[] = [];
    const stack: { level: number; node: Element }[] = [];

    for (const child of tree.children) {
      const level = headingLevel(child);
      if (level === 0) {
        // MDX import/export statements must stay at the root.
        if ((child.type as string) === "mdxjsEsm" || !stack.length) out.push(child);
        else stack[stack.length - 1].node.children.push(child as ElementContent);
        continue;
      }

      const heading = child as Element;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();

      const title = toString(heading).trim();
      const base = typeof heading.properties.id === "string" && heading.properties.id ? heading.properties.id : slug(title) || "section";
      let id = base;
      for (let n = 1; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);

      const fold = heading.properties.dataZnFold === "true";
      delete heading.properties.dataZnFold;
      heading.properties.id = id;

      const section: Element = {
        type: "element",
        tagName: "section",
        properties: {
          className: ["zn-section"],
          dataId: id,
          dataLevel: String(level),
          dataTitle: title,
          ...(fold ? { dataFold: "true" } : {}),
          ...(id !== base ? { dataZnDup: base } : {}),
        },
        children: [heading],
      };
      if (stack.length) stack[stack.length - 1].node.children.push(section);
      else out.push(section);
      stack.push({ level, node: section });
    }

    tree.children = out;
  };
}

function headingLevel(node: RootContent): number {
  if (node.type !== "element") return 0;
  const match = HEADING.exec(node.tagName);
  return match ? Number(match[1]) : 0;
}
