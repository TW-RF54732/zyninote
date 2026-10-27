import { compile } from "@mdx-js/mdx";
import { describe, expect, it } from "vitest";
import { pageKeyFromPathname, pageKeyOf, resolveLink } from "../shared/links.ts";
import type { Page } from "../shared/types.ts";
import { preprocessMdx } from "./attrs.ts";
import { checkLinks } from "./link-check.ts";
import { notePlugins } from "./plugins.ts";
import { createMarkdownRenderer } from "./render-md.ts";
import { segment } from "./segment.ts";

const CONTENT = "/notes/content";
const render = createMarkdownRenderer(CONTENT);

/** Renders and segments Markdown as the note at content-relative `path`. */
async function md(body: string, path = "net/ch1-intro.md") {
  const html = await render(body, `${CONTENT}/${path}`);
  return { html, ...segment(html, path) };
}

describe("resolveLink", () => {
  const from = "net/ch1-intro.md";

  it("resolves notes in the same subject, with or without extension", () => {
    expect(resolveLink(from, "ch2-tcp.mdx#tcp-flags")).toEqual({ kind: "page", page: "net/ch2-tcp", id: "tcp-flags", href: "/net/ch2-tcp#tcp-flags" });
    expect(resolveLink(from, "./ch2-tcp")).toMatchObject({ kind: "page", page: "net/ch2-tcp" });
  });

  it("resolves other subjects, subject pages, the root and same-page anchors", () => {
    expect(resolveLink(from, "../calc/ch1-limits.md")).toMatchObject({ page: "calc/ch1-limits", href: "/calc/ch1-limits" });
    expect(resolveLink(from, "../calc/")).toMatchObject({ page: "calc/", href: "/calc/" });
    expect(resolveLink(from, "../calc/_subject.md")).toMatchObject({ page: "calc/" });
    expect(resolveLink(from, "_subject.md")).toMatchObject({ page: "net/" });
    expect(resolveLink(from, "..")).toMatchObject({ page: "", href: "/" });
    expect(resolveLink(from, "#osi-七層")).toEqual({ kind: "page", page: "net/ch1-intro", id: "osi-七層", href: "/net/ch1-intro#osi-%E4%B8%83%E5%B1%A4" });
  });

  it("treats other files as files", () => {
    expect(resolveLink(from, "slides.pdf")).toEqual({ kind: "file", file: "net/slides.pdf", href: "/content/net/slides.pdf" });
  });

  it("rejects paths outside content/ and absolute paths", () => {
    expect(resolveLink(from, "../../src/server/main.ts")).toEqual({ kind: "error", error: "outside" });
    expect(resolveLink(from, "../calc/../../x.md")).toEqual({ kind: "error", error: "outside" });
    expect(resolveLink(from, "/net/ch2-tcp")).toEqual({ kind: "error", error: "absolute" });
  });

  it("maps page keys to and from URLs", () => {
    expect(pageKeyOf("net/_subject.md")).toBe("net/");
    expect(pageKeyOf("net/ch2-tcp.mdx")).toBe("net/ch2-tcp");
    expect(pageKeyFromPathname("/net/ch1-intro")).toBe("net/ch1-intro");
    expect(pageKeyFromPathname("/net")).toBe("net/");
    expect(pageKeyFromPathname("/%E5%BE%AE/x")).toBe("微/x");
    expect(pageKeyFromPathname("/content/net/slides.pdf")).toBeNull();
  });
});

describe("link rendering", () => {
  it("renders wikilinks as quiet links and Markdown links as visible ones", async () => {
    const { html, links } = await md("見 [[ch2-tcp.mdx#tcp-flags|旗標]]、[[ch3-routing]] 與 [OSI](#osi-七層)。");
    expect(html).toContain('<a href="/net/ch2-tcp#tcp-flags" data-zn-link="quiet" class="zn-link" data-zn-ref="ch2-tcp.mdx#tcp-flags">旗標</a>');
    expect(html).toContain('data-zn-ref="ch3-routing">ch3-routing</a>');
    expect(html).toContain('class="zn-link" data-zn-link="visible" data-zn-ref="#osi-七層"');
    expect(links.map((l) => [l.ref, l.style])).toEqual([
      ["ch2-tcp.mdx#tcp-flags", "quiet"],
      ["ch3-routing", "quiet"],
      ["#osi-七層", "visible"],
    ]);
  });

  it("supports escaped pipes in tables and leaves code alone", async () => {
    const { html, links } = await md("| a |\n|---|\n| [[ch2-tcp.mdx\\|TCP]] |\n\n`[[not-a-link]]`\n");
    expect(links.map((l) => l.ref)).toEqual(["ch2-tcp.mdx"]);
    expect(html).toContain(">TCP</a>");
    expect(html).toContain("<code>[[not-a-link]]</code>");
  });

  it("drops the href of links leaving content/", async () => {
    const { html, links } = await md("[原始碼](../../src/server/main.ts)");
    expect(html).toContain('<a class="zn-link" data-zn-link="visible" data-zn-ref="../../src/server/main.ts">');
    expect(links[0].target).toEqual({ kind: "error", error: "outside" });
  });

  it("leaves external links and footnotes untouched", async () => {
    const { html, links } = await md("[x](https://example.com) 註腳[^1]\n\n[^1]: 內容\n");
    expect(links).toEqual([]);
    expect(html).toContain('<a href="https://example.com">x</a>');
  });

  it("attributes links to their own section", async () => {
    const { sections, links } = await md("[[a]]\n\n## A\n\n[[b]]\n\n### B\n\n[[c]]\n");
    expect(links.map((l) => [l.ref, l.section])).toEqual([
      ["a", null],
      ["b", "a"],
      ["c", "b"],
    ]);
    expect(sections.find((s) => s.id === "a")!.links.map((l) => l.ref)).toEqual(["b"]);
  });

  it("resolves relative image paths to vault files and leaves external images alone", async () => {
    const { html, links } = await md('![a](img/a%20b.png) ![b](../calc/b.svg) ![c](../../c.png) ![d](https://x.test/d.png)\n\n<img src="e.png">');
    expect(html).toContain('<img src="/content/net/img/a%20b.png" alt="a">');
    expect(html).toContain('<img src="/content/calc/b.svg" alt="b">');
    expect(html).toContain('<img alt="c">');
    expect(html).toContain('<img src="https://x.test/d.png" alt="d" referrerpolicy="no-referrer">');
    expect(html).toContain('<img src="/content/net/e.png">');
    expect(links).toEqual([]);
  });

  it("resolves MDX links relative to the file", async () => {
    const src = preprocessMdx("## A\n\n[[ch1-intro.md#osi|OSI]] [x](../calc/)\n", {});
    const code = String(await compile({ value: src, path: `${CONTENT}/net/ch2-tcp.mdx` }, notePlugins(CONTENT)));
    expect(code).toContain('href: "/net/ch1-intro#osi"');
    expect(code).toContain('"data-zn-link": "quiet"');
    expect(code).toContain('href: "/calc/"');
  });
});

describe("checkLinks", () => {
  const page = (path: string, ids: string[], links: Page["links"]): Page => ({
    path,
    subject: path.split("/")[0],
    slug: "",
    format: "md",
    meta: { title: path, tags: [] },
    hash: "",
    html: "",
    sections: ids.map((id) => ({ id, level: 2, title: id.toUpperCase(), fold: false, html: "", text: "", links: [], children: [] })),
    toc: [],
    links,
    diagnostics: [],
  });
  const link = (from: string, ref: string, section: string | null = null) => ({ ref, style: "quiet" as const, target: resolveLink(from, ref), section });

  const a = "net/a.md";
  const pages = [
    page(a, ["x"], [
      link(a, "b.md#y", "x"),
      link(a, "b.md#y", "x"),
      link(a, "b.md"),
      link(a, "#x"),
      link(a, "b.md#nope"),
      link(a, "missing.md"),
      link(a, "../../etc/passwd"),
      link(a, "slides.pdf"),
      link(a, "../calc/"),
    ]),
    page("net/b.md", ["y"], []),
  ];
  const index = checkLinks({ pages, virtualPages: ["", "calc/"], subjectTitle: (s) => s.toUpperCase(), fileExists: () => false });

  it("reports broken targets and invalid paths", () => {
    expect(index.diagnostics.map((d) => [d.level, d.message])).toEqual([
      ["warning", "斷鏈：「b.md#nope」找不到標題 #nope"],
      ["warning", "斷鏈：找不到頁面「missing.md」"],
      ["error", "連結「../../etc/passwd」超出 content/，已停用"],
      ["warning", "斷鏈：找不到檔案「slides.pdf」"],
    ]);
    expect(index.broken.get(a)).toEqual(["b.md#nope", "missing.md", "../../etc/passwd", "slides.pdf"]);
  });

  it("collects backlinks per target, excluding links to the same page", () => {
    expect(index.backlinks.get("net/b")).toEqual([
      {
        page: "net/a",
        url: "/net/a",
        title: a,
        subjectTitle: "NET",
        refs: [
          { from: { id: "x", title: "X" }, to: { id: "y", title: "Y" } },
          { from: null, to: null },
        ],
      },
    ]);
    expect(index.backlinks.has("net/a")).toBe(false);
    expect(index.backlinks.get("calc/")).toHaveLength(1);
  });
});
