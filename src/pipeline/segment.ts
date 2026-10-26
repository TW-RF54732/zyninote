// The only segmenter: every format's HTML goes through here to become sections and a TOC.
import type { Element, ElementContent, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { resolveLink } from "../shared/links.ts";
import type { Diagnostic, PageLink, Section, TocItem } from "../shared/types.ts";

export type Segmented = {
  sections: Section[];
  toc: TocItem[];
  links: PageLink[];
  diagnostics: Diagnostic[];
};

/** `path` is the page's content-relative path; links are resolved against it. */
export function segment(html: string, path: string): Segmented {
  const root = fromHtml(html, { fragment: true });
  const sections: Section[] = [];
  const links: PageLink[] = [];
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<string>();

  const walk = (nodes: (Root | Element)["children"], current: Section | null): TocItem[] => {
    const items: TocItem[] = [];
    for (const node of nodes) {
      if (node.type !== "element") continue;
      if (!isSection(node)) {
        if (node.tagName === "a" && typeof node.properties.dataZnRef === "string") {
          const ref = node.properties.dataZnRef;
          const link = { ref, style: node.properties.dataZnLink === "quiet" ? "quiet" : "visible", target: resolveLink(path, ref) } as const;
          links.push({ ...link, section: current?.id ?? null });
          current?.links.push(link);
        }
        items.push(...walk(node.children, current));
        continue;
      }
      const props = node.properties;
      const id = String(props.dataId);
      const item: TocItem = {
        id,
        level: Number(props.dataLevel) || 2,
        title: String(props.dataTitle ?? ""),
        fold: props.dataFold === "true",
        children: [],
      };
      if (typeof props.dataZnDup === "string") {
        diagnostics.push({ level: "warning", path, message: `重複的標題 ID「${props.dataZnDup}」，已自動改為「${id}」` });
      } else if (seen.has(id)) {
        diagnostics.push({ level: "warning", path, message: `重複的標題 ID「${id}」` });
      }
      seen.add(id);

      const section: Section = {
        id,
        level: item.level,
        title: item.title,
        fold: item.fold,
        html: toHtml(node),
        text: ownText(node),
        links: [],
        children: [],
      };
      sections.push(section);
      item.children = walk(node.children, section);
      section.children = item.children.map((c) => c.id);
      items.push(item);
    }
    return items;
  };

  const toc = walk(root.children, null);
  return { sections, toc, links, diagnostics };
}

function isSection(node: Element): boolean {
  return node.tagName === "section" && node.properties.dataId !== undefined;
}

/** Text of a section excluding its heading and child sections; KaTeX becomes its TeX source, interactive components their description. */
function ownText(section: Element): string {
  const parts: string[] = [];
  const visit = (node: ElementContent, isTop: boolean) => {
    if (node.type === "text") {
      parts.push(node.value);
      return;
    }
    if (node.type !== "element") return;
    if (isSection(node)) return;
    if (isTop && /^h[1-6]$/.test(node.tagName)) return;
    const classes = node.properties.className;
    if (Array.isArray(classes) && classes.includes("katex")) {
      parts.push(" ", texSource(node), " ");
      return;
    }
    if (typeof node.properties.dataZnDescription === "string") {
      parts.push(" ", node.properties.dataZnDescription, " ");
      return;
    }
    const block = BLOCK.has(node.tagName);
    if (block) parts.push("\n");
    else if (node.tagName === "td" || node.tagName === "th") parts.push(" ");
    for (const child of node.children) visit(child, false);
    if (block) parts.push("\n");
  };
  for (const child of section.children) visit(child, true);
  return parts.join("").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

function texSource(katex: Element): string {
  let tex = "";
  const find = (node: ElementContent) => {
    if (tex || node.type !== "element") return;
    if (node.tagName === "annotation") {
      tex = node.children.map((c) => (c.type === "text" ? c.value : "")).join("");
      return;
    }
    node.children.forEach(find);
  };
  katex.children.forEach(find);
  return tex;
}

const BLOCK = new Set(["p", "div", "li", "ul", "ol", "pre", "blockquote", "table", "tr", "figure", "dl", "dt", "dd"]);
