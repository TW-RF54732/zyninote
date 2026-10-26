// Heading attribute syntax shared by .md and .mdx: `## Title {#id .fold}`.

export type HeadingAttrs = {
  id?: string;
  classes: string[];
};

/** Matches a trailing `{#id .cls}` block (with the leading whitespace). Only `#id` and `.class` tokens are allowed. */
export const TRAILING_ATTRS = /\s*\{\s*((?:[#.][^\s{}#.][^\s{}]*\s*)+)\}\s*$/;

/** Parses the inside of an attribute block, e.g. `#tcp-flags .fold`. */
export function parseAttrs(inner: string): HeadingAttrs {
  const attrs: HeadingAttrs = { classes: [] };
  for (const token of inner.trim().split(/\s+/)) {
    if (token.startsWith("#")) attrs.id = token.slice(1);
    else if (token.startsWith(".")) attrs.classes.push(token.slice(1));
  }
  return attrs;
}

/** Splits `Title {#id}` into the title text and its attributes, or returns null when there is no attribute block. */
export function splitTrailingAttrs(text: string): { text: string; attrs: HeadingAttrs } | null {
  const match = TRAILING_ATTRS.exec(text);
  if (!match) return null;
  return { text: text.slice(0, match.index), attrs: parseAttrs(match[1]) };
}

/** Marker used to carry attributes through MDX, where `{...}` is a JS expression. `{/*zn #id .fold*\/}` is an empty expression. */
export const MDX_ATTR_MARKER = /^\/\*zn ([^*]*)\*\/$/;

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const ATX_HEADING = /^ {0,3}#{1,6}\s/;

/**
 * Prepares MDX source before compilation:
 * - frontmatter is replaced by `export const meta = {...}` (padded to keep line numbers);
 * - trailing heading attribute blocks become MDX comment expressions the remark plugin understands.
 * Fenced code blocks are left untouched.
 */
export function preprocessMdx(source: string, meta: unknown): string {
  const lines = source.split("\n");
  let start = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
    if (end > 0) {
      const padding = Array(end).fill("");
      lines.splice(0, end + 1, `export const meta = ${JSON.stringify(meta)};`, ...padding);
      start = end + 1;
    }
  }

  let fence: string | null = null;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = FENCE.exec(line);
    if (fence) {
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      continue;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      continue;
    }
    if (!ATX_HEADING.test(line)) continue;
    const match = TRAILING_ATTRS.exec(line);
    if (match) lines[i] = `${line.slice(0, match.index)} {/*zn ${match[1].trim()}*/}`;
  }
  return lines.join("\n");
}
