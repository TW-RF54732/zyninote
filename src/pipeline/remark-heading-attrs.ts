import type { Properties } from "hast";
import type { Heading, Root } from "mdast";
import { visit } from "unist-util-visit";
import { MDX_ATTR_MARKER, parseAttrs, splitTrailingAttrs, type HeadingAttrs } from "./attrs.ts";

/**
 * Moves `{#id .fold}` from the end of a heading onto the rendered element.
 * Handles both plain Markdown text and the MDX marker produced by `preprocessMdx`.
 */
export function remarkHeadingAttrs() {
  return (tree: Root) => {
    visit(tree, "heading", (heading: Heading) => {
      const attrs = takeAttrs(heading);
      if (!attrs) return;
      const props: Properties = { ...(heading.data?.hProperties ?? {}) };
      if (attrs.id) props.id = attrs.id;
      if (attrs.classes.includes("fold")) props.dataZnFold = "true";
      heading.data = { ...heading.data, hProperties: props };
    });
  };
}

function takeAttrs(heading: Heading): HeadingAttrs | null {
  const last = heading.children.at(-1);
  if (!last) return null;

  if ((last.type as string) === "mdxTextExpression") {
    const match = MDX_ATTR_MARKER.exec(((last as unknown as { value: string }).value ?? "").trim());
    if (!match) return null;
    heading.children.pop();
    trimEnd(heading);
    return parseAttrs(match[1]);
  }

  if (last.type !== "text") return null;
  const split = splitTrailingAttrs(last.value);
  if (!split) return null;
  last.value = split.text;
  if (!last.value) heading.children.pop();
  trimEnd(heading);
  return split.attrs;
}

function trimEnd(heading: Heading) {
  const last = heading.children.at(-1);
  if (last?.type === "text") last.value = last.value.trimEnd();
}
