import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { parseAttrs, preprocessMdx, splitTrailingAttrs } from "./attrs.ts";
import { rehypePlugins, remarkPlugins } from "./plugins.ts";
import { renderMarkdown } from "./render-md.ts";
import { compareByOrder } from "./scan.ts";
import { segment } from "./segment.ts";

describe("attrs", () => {
  it("parses id and classes", () => {
    expect(parseAttrs("#tcp-flags .fold")).toEqual({ id: "tcp-flags", classes: ["fold"] });
  });

  it("splits trailing attribute blocks only", () => {
    expect(splitTrailingAttrs("TCP Flags {#tcp-flags .fold}")).toEqual({ text: "TCP Flags", attrs: { id: "tcp-flags", classes: ["fold"] } });
    expect(splitTrailingAttrs("Set {a, b}")).toBeNull();
  });

  it("rewrites MDX headings but leaves fenced code alone", () => {
    const src = ["---", "title: T", "---", "## A {#a .fold}", "```md", "## B {#b}", "```", "## C"].join("\n");
    const out = preprocessMdx(src, { title: "T" }).split("\n");
    expect(out[0]).toBe('export const meta = {"title":"T"};');
    expect(out).toHaveLength(8);
    expect(out[3]).toBe("## A {/*zn #a .fold*/}");
    expect(out[5]).toBe("## B {#b}");
  });
});

describe("markdown rendering + segmenting", () => {
  it("nests sections and keeps CJK slugs", async () => {
    const html = await renderMarkdown("## 傳輸層\n\n文字\n\n### TCP {#tcp .fold}\n\n細節\n\n## 網路層\n");
    const { sections, toc } = segment(html, "x.md");
    expect(toc.map((t) => t.id)).toEqual(["傳輸層", "網路層"]);
    expect(toc[0].children).toMatchObject([{ id: "tcp", level: 3, fold: true }]);
    const top = sections.find((s) => s.id === "傳輸層")!;
    expect(top.children).toEqual(["tcp"]);
    expect(top.text).toBe("文字");
    expect(top.html).toContain('data-id="tcp"');
  });

  it("suffixes duplicate ids and warns", async () => {
    const html = await renderMarkdown("## 例子\n\n## 例子\n\n## X {#例子}\n");
    const { toc, diagnostics } = segment(html, "x.md");
    expect(toc.map((t) => t.id)).toEqual(["例子", "例子-1", "例子-2"]);
    expect(diagnostics).toHaveLength(2);
  });

  it("uses TeX source for math in titles and text", async () => {
    const html = await renderMarkdown("## 極限 $x^2$\n\n當 $x \\to 0$ 時\n");
    const [section] = segment(html, "x.md").sections;
    expect(section.title).toBe("極限 x^2");
    expect(section.text).toBe("當 x \\to 0 時");
  });

  it("includes interactive descriptions in text", () => {
    const html = '<section class="zn-section" data-id="a" data-level="2" data-title="A"><h2 id="a">A</h2><figure data-zn-description="拖動滑桿"><input></figure></section>';
    expect(segment(html, "x.tsx").sections[0].text).toBe("拖動滑桿");
  });

  it("renders mermaid blocks for the client", async () => {
    const html = await renderMarkdown("```mermaid\ngraph LR\nA-->B\n```\n");
    expect(html).toContain('<pre class="mermaid">graph LR\nA-->B\n</pre>');
  });
});

describe("mdx", () => {
  it("gives MDX headings the same attributes as Markdown", async () => {
    const src = preprocessMdx("## TCP Flags {#tcp-flags .fold}\n\n內容\n", {});
    const code = String(await compile(src, { remarkPlugins, rehypePlugins }));
    expect(code).toContain('"data-id": "tcp-flags"');
    expect(code).toContain('"data-fold": "true"');
    expect(code).not.toContain("zn #");
  });
});

describe("ordering", () => {
  it("puts explicit order first, then natural file names", () => {
    const items = [{ name: "ch10" }, { name: "ch2" }, { name: "intro", order: 1 }];
    expect(items.sort(compareByOrder).map((i) => i.name)).toEqual(["intro", "ch2", "ch10"]);
  });
});
